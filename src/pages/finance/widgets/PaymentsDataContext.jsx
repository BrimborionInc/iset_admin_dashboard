import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../../auth/apiClient";

const PaymentsDataContext = createContext(undefined);

const summarizeEvidence = items => {
  const requiredItems = items.filter(item => item.required);
  const requiredCount = requiredItems.length;
  const receivedCount = requiredItems.filter(item => item.received).length;
  return {
    required: requiredCount,
    received: receivedCount,
    verified: receivedCount,
    missing: Math.max(0, requiredCount - receivedCount),
  };
};

const mergeEvidenceSummaries = summaries =>
  summaries.reduce(
    (acc, summary) => ({
      required: acc.required + summary.required,
      received: acc.received + summary.received,
      verified: acc.verified + summary.verified,
      missing: acc.missing + summary.missing,
    }),
    { required: 0, received: 0, verified: 0, missing: 0 },
  );

const formatPeriod = (start, end) => (start && end ? `${start} to ${end}` : "-");

const buildApiError = (resp, payload, fallbackMessage) => {
  const message =
    payload?.message || payload?.error || fallbackMessage || `Request failed (${resp.status})`;
  const error = new Error(message);
  error.code = payload?.error || payload?.code || null;
  error.details = payload?.details || payload?.missing || payload?.requiredRoles || null;
  error.status = resp.status;
  error.payload = payload;
  return error;
};

const normalizeEvidenceItem = item => {
  if (!item || typeof item !== "object") {
    return {
      type: "Evidence",
      required: false,
      received: false,
      verified: false,
      note: null,
    };
  }
  const documentName =
    item.documentName ||
    item.document_name ||
    item.file_name ||
    item.label ||
    null;
  const documentNames = Array.isArray(item.documentNames)
    ? item.documentNames.map(value => String(value)).filter(Boolean)
    : documentName
      ? [String(documentName)]
      : [];
  const documentIds = Array.isArray(item.documentIds)
    ? item.documentIds.map(value => String(value)).filter(Boolean)
    : item.documentId || item.document_id
      ? [String(item.documentId || item.document_id)]
      : [];
  const documentLinks = Array.isArray(item.documentLinks)
    ? item.documentLinks
        .map(entry => {
          if (!entry || typeof entry !== "object") return null;
          const linkId =
            entry.id || entry.linkId || entry.link_id || entry.documentLinkId || null;
          const documentId = entry.documentId || entry.document_id || null;
          const name = entry.name || entry.documentName || entry.document_name || entry.file_name || entry.label || null;
          if (!linkId && !documentId && !name) return null;
          return {
            id: linkId ? String(linkId) : null,
            documentId: documentId ? String(documentId) : null,
            name: name ? String(name) : null,
          };
        })
        .filter(Boolean)
    : null;
  return {
    id: item.id ? String(item.id) : item.linkId ? String(item.linkId) : null,
    documentId: item.documentId ? String(item.documentId) : item.document_id ? String(item.document_id) : null,
    type:
      item.type ||
      item.evidenceType ||
      item.evidence_type ||
      item.documentType ||
      item.document_type ||
      "Evidence",
    required: !!item.required,
    received: !!item.received,
    verified: !!item.verified,
    note: item.note || item.notes || null,
    receivedAt: item.receivedAt || item.received_at || null,
    verifiedAt: item.verifiedAt || item.verified_at || null,
    verifiedBy: item.verifiedBy || item.verified_by || null,
    documentName: documentName || (documentNames.length ? documentNames[0] : null),
    documentNames: documentNames.length ? documentNames : null,
    documentIds: documentIds.length ? documentIds : null,
    documentLinks: documentLinks && documentLinks.length ? documentLinks : null,
    source: item.source || item.source_type || null,
  };
};

const normalizeEvidenceList = list =>
  Array.isArray(list) ? list.filter(Boolean).map(normalizeEvidenceItem) : [];

const normalizeRecipients = input => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter(Boolean).map(value => String(value));
  }
  if (typeof input === "string") {
    return input
      .split(/[;,]+/)
      .map(entry => entry.trim())
      .filter(Boolean);
  }
  if (typeof input === "object") {
    const combined = [];
    ["to", "cc", "bcc"].forEach(key => {
      const value = input[key];
      if (Array.isArray(value)) {
        combined.push(...value.filter(Boolean));
      } else if (typeof value === "string") {
        combined.push(...value.split(/[;,]+/).map(entry => entry.trim()).filter(Boolean));
      }
    });
    return combined.map(value => String(value));
  }
  return [];
};

const normalizeCommunication = raw => {
  if (!raw || typeof raw !== "object") return null;
  const recipients = normalizeRecipients(
    raw.recipients || raw.recipients_json || raw.to || raw.cc || raw.bcc
  );
  return {
    id: raw.id ? String(raw.id) : "",
    packetId: raw.packetId || raw.payment_packet_id || raw.paymentPacketId || null,
    lineId: raw.lineId || raw.payment_packet_line_id || null,
    direction: raw.direction || "outbound",
    channel: raw.channel || "email",
    sender: raw.sender || raw.sender_label || raw.sender_name || raw.sender_email || null,
    recipients,
    subject: raw.subject || null,
    body: raw.body || raw.message || null,
    template: raw.template || raw.template_key || "custom",
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    sentOn: raw.sentOn || raw.sent_on || raw.sent_at || raw.created_at || new Date().toISOString(),
  };
};

const normalizeInterventionCodeValue = value => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return String(Math.trunc(numeric));
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? String(parsed) : null;
};

const buildLine = line => {
  const amount = Number(line.amount || 0);
  const evidenceSummary = summarizeEvidence(line.evidenceChecklist ?? []);
  return {
    ...line,
    amount: Number.isFinite(amount) ? amount : 0,
    servicePeriodLabel: formatPeriod(line.servicePeriodStart, line.servicePeriodEnd),
    evidenceSummary,
  };
};

const normalizeLine = raw => {
  if (!raw || typeof raw !== "object") {
    return buildLine({ amount: 0, evidenceChecklist: [] });
  }
  return buildLine({
    ...raw,
    id: raw.id ? String(raw.id) : "",
    packetId: raw.packetId || raw.payment_packet_id || null,
    paymentType: raw.paymentType || raw.payment_type || null,
    payeeType: raw.payeeType || raw.payee_type || null,
    payeeName: raw.payeeName || raw.payee_name || null,
    payeeReference: raw.payeeReference || raw.payee_reference || null,
    potId: raw.potId || raw.budget_pot_id || null,
    potName: raw.potName || raw.pot_name || null,
    fundingStream: raw.fundingStream || raw.funding_stream || null,
    reportingUnit: raw.reportingUnit || raw.reporting_unit || null,
    holdReason: raw.holdReason || raw.hold_reason || null,
    servicePeriodStart: raw.servicePeriodStart || raw.service_period_start || null,
    servicePeriodEnd: raw.servicePeriodEnd || raw.service_period_end || null,
    requestedPaymentDate: raw.requestedPaymentDate || raw.requested_payment_date || null,
    invoiceReferenceNumber: raw.invoiceReferenceNumber || raw.invoice_reference_number || null,
    paidAt: raw.paidAt || raw.paid_at || null,
    paymentReference: raw.paymentReference || raw.payment_reference || null,
    paymentProofDocumentId: raw.paymentProofDocumentId || raw.payment_proof_document_id || null,
    authorization: raw.authorization || null,
    batch: raw.batch || raw.batchInfo || raw.batch_info || null,
    evidenceChecklist: normalizeEvidenceList(raw.evidenceChecklist || raw.evidence_checklist),
  });
};

const buildPacket = packet => {
  const lines = (packet.lines ?? []).map(line => (line.evidenceSummary ? line : buildLine(line)));
  const baselineSummary = summarizeEvidence(packet.baselineEvidence ?? []);
  const lineEvidenceSummary = mergeEvidenceSummaries(lines.map(line => line.evidenceSummary));
  const evidenceSummary = mergeEvidenceSummaries([baselineSummary, lineEvidenceSummary]);
  const paymentTypes = Array.from(new Set(lines.map(line => line.paymentType).filter(Boolean)));
  const totalAmount = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const streamTotals = { CRF: 0, EI: 0 };
  lines.forEach(line => {
    const stream = line.fundingStream || "Unclassified";
    streamTotals[stream] = (streamTotals[stream] ?? 0) + (Number(line.amount) || 0);
  });
  const ageDays = packet.submittedOn
    ? Math.max(0, Math.floor((Date.now() - new Date(packet.submittedOn).getTime()) / 86400000))
    : 0;

  return {
    ...packet,
    lines,
    baselineEvidenceSummary: baselineSummary,
    evidenceSummary,
    paymentTypes,
    totalAmount,
    streamTotals,
    ageDays,
  };
};

const normalizePacket = packet => {
  const riskFlagsInput = Array.isArray(packet?.riskFlags)
    ? packet.riskFlags
    : Array.isArray(packet?.risk_flags)
      ? packet.risk_flags
      : [];
  return buildPacket({
    ...packet,
    id: packet?.id ? String(packet.id) : "",
    caseId: packet?.caseId || packet?.case_id || null,
    caseNumber: packet?.caseNumber || packet?.case_number || null,
    applicationId:
      packet?.applicationId || packet?.application_id
        ? String(packet.applicationId || packet.application_id)
        : null,
    applicantUserId:
      packet?.applicantUserId || packet?.applicant_user_id
        ? String(packet.applicantUserId || packet.applicant_user_id)
        : null,
    clientId: packet?.clientId || packet?.client_id || null,
    clientName: packet?.clientName || packet?.client_name || null,
    interventionId: packet?.interventionId || packet?.intervention_id || null,
    interventionName: packet?.interventionName || packet?.intervention_name || null,
    interventionCode: packet?.interventionCode || packet?.intervention_code || null,
    reportingUnit: packet?.reportingUnit || packet?.reporting_unit || null,
    potId: packet?.potId || packet?.pot_id || null,
    potName: packet?.potName || packet?.pot_name || null,
    requester: packet?.requester || packet?.requester_name || null,
    requesterRole: packet?.requesterRole || packet?.requester_role || null,
    status: packet?.status || "draft",
    submittedOn: packet?.submittedOn || packet?.submitted_on || null,
    dueBy: packet?.dueBy || packet?.due_by || null,
    notes: packet?.notes || packet?.notes_internal || null,
    riskFlags: riskFlagsInput.filter(Boolean),
    baselineEvidence: normalizeEvidenceList(packet?.baselineEvidence || packet?.baseline_evidence),
    lines: Array.isArray(packet?.lines) ? packet.lines.filter(Boolean).map(normalizeLine) : [],
    approvals: Array.isArray(packet?.approvals) ? packet.approvals : [],
    timeline: Array.isArray(packet?.timeline) ? packet.timeline : [],
    documents: Array.isArray(packet?.documents) ? packet.documents : [],
    duplicateWarnings: Array.isArray(packet?.duplicateWarnings) ? packet.duplicateWarnings : [],
    overrideHistory: Array.isArray(packet?.overrideHistory) ? packet.overrideHistory : [],
    turnaroundDays: Number.isFinite(packet?.turnaroundDays) ? packet.turnaroundDays : packet?.turnaround_days || null,
  });
};

const normalizePaymentTypeMappingPayload = payload => {
  if (!payload || payload.enabled === false) return null;
  const interventionsRaw = Array.isArray(payload.interventions) ? payload.interventions : [];
  const interventions = interventionsRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const codeRaw = entry.code ?? entry.interventionCode ?? entry.intervention_code ?? null;
      const code = normalizeInterventionCodeValue(codeRaw);
      if (!code) return null;
      const typesRaw =
        entry.availablePaymentTypes ||
        entry.available_payment_types ||
        entry.paymentTypes ||
        entry.payment_types ||
        [];
      const types = Array.isArray(typesRaw)
        ? Array.from(
            new Set(
              typesRaw
                .map(value => (value === null || value === undefined ? "" : String(value).trim()))
                .filter(Boolean),
            ),
          )
        : [];
      return {
        code,
        name: entry.name || entry.label || null,
        availablePaymentTypes: types,
      };
    })
    .filter(Boolean);
  if (!interventions.length) return null;
  return {
    ...payload,
    interventions,
  };
};

const buildPaymentTypeMappingLookup = mapping => {
  const lookup = new Map();
  if (!mapping?.interventions) return lookup;
  mapping.interventions.forEach(entry => {
    const code = normalizeInterventionCodeValue(entry?.code);
    if (!code) return;
    const types = Array.isArray(entry.availablePaymentTypes)
      ? entry.availablePaymentTypes.filter(Boolean)
      : [];
    lookup.set(code, new Set(types));
  });
  return lookup;
};

const computeSlaSnapshot = requests => {
  const snapshot = {
    draftsNeedingEvidence: 0,
    submitted: 0,
    overdueEvidence: 0,
    avgSubmissionAgeDays: 0,
  };
  const submissionAges = [];

  requests.forEach(packet => {
    const statusKey =
      packet.status === "draft" || packet.status === "returned"
        ? "draft"
        : packet.status === "cancelled"
          ? "cancelled"
          : "submitted";
    if (statusKey === "draft") {
      const missing = packet.evidenceSummary?.missing ?? 0;
      if (missing > 0) {
        snapshot.draftsNeedingEvidence += 1;
      }
    } else if (statusKey === "submitted") {
      snapshot.submitted += 1;
      if (Number.isFinite(packet.ageDays)) {
        submissionAges.push(packet.ageDays);
      }
    }
    if ((packet.riskFlags ?? []).some(flag => flag.toLowerCase().includes("overdue"))) {
      snapshot.overdueEvidence += 1;
    }
  });

  if (submissionAges.length) {
    const total = submissionAges.reduce((sum, value) => sum + value, 0);
    snapshot.avgSubmissionAgeDays = total / submissionAges.length;
  }

  return snapshot;
};

const normalizeFilterValue = value => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const buildPaymentsQuery = ({
  status,
  statuses,
  caseId,
  clientId,
  interventionId,
  reportingUnit,
  limit,
} = {}) => {
  const params = new URLSearchParams();
  const normalizedStatus = normalizeFilterValue(status);
  const normalizedCaseId = normalizeFilterValue(caseId);
  const normalizedClientId = normalizeFilterValue(clientId);
  const normalizedInterventionId = normalizeFilterValue(interventionId);
  const normalizedReportingUnit = normalizeFilterValue(reportingUnit);
  const normalizedLimit = normalizeFilterValue(limit);
  const statusList = Array.isArray(statuses)
    ? statuses.map(item => normalizeFilterValue(item)).filter(Boolean)
    : normalizeFilterValue(statuses)
      ? String(statuses)
          .split(",")
          .map(item => normalizeFilterValue(item))
          .filter(Boolean)
      : [];

  if (normalizedStatus) {
    params.set("status", normalizedStatus);
  }
  if (statusList.length) {
    params.set("statuses", statusList.join(","));
  }
  if (normalizedCaseId) {
    params.set("caseId", normalizedCaseId);
  }
  if (normalizedClientId) {
    params.set("clientId", normalizedClientId);
  }
  if (normalizedInterventionId) {
    params.set("interventionId", normalizedInterventionId);
  }
  if (normalizedReportingUnit) {
    params.set("reportingUnit", normalizedReportingUnit);
  }
  if (normalizedLimit) {
    params.set("limit", normalizedLimit);
  }

  return params.toString();
};

export const PaymentsDataProvider = ({ children, filters = {} }) => {
  const {
    status,
    statuses,
    caseId,
    clientId,
    interventionId,
    reportingUnit,
    limit,
  } = filters || {};
  const queryString = useMemo(
    () =>
      buildPaymentsQuery({
        status,
        statuses,
        caseId,
        clientId,
        interventionId,
        reportingUnit,
        limit,
      }),
    [status, statuses, caseId, clientId, interventionId, reportingUnit, limit]
  );
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [communications, setCommunications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentTypeMapping, setPaymentTypeMapping] = useState(null);
  const [paymentTypeMappingLoading, setPaymentTypeMappingLoading] = useState(false);

  const loadCommunications = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/finance/payment-communications");
      if (!resp.ok) {
        throw new Error(`Communications load failed (${resp.status})`);
      }
      const data = await resp.json();
      const normalized = Array.isArray(data)
        ? data.map(normalizeCommunication).filter(Boolean)
        : [];
      setCommunications(normalized);
    } catch (err) {
      console.error("[Payments] failed to load communications", err);
      setCommunications([]);
    }
  }, []);

  const loadPaymentTypeMapping = useCallback(async () => {
    setPaymentTypeMappingLoading(true);
    try {
      const resp = await apiFetch("/api/finance/payment-intervention-type-map");
      if (!resp.ok) {
        throw new Error(`Mapping load failed (${resp.status})`);
      }
      const payload = await resp.json();
      const normalized = normalizePaymentTypeMappingPayload(payload);
      setPaymentTypeMapping(normalized);
    } catch (err) {
      console.error("[Payments] failed to load payment type mapping", err);
      setPaymentTypeMapping(null);
    } finally {
      setPaymentTypeMappingLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = queryString
        ? `/api/finance/payment-packets?${queryString}`
        : "/api/finance/payment-packets";
      const resp = await apiFetch(endpoint);
      if (!resp.ok) {
        throw new Error(`Load failed (${resp.status})`);
      }
      const data = await resp.json();
      const normalized = Array.isArray(data) ? data.map(normalizePacket) : [];
      setRequests(normalized);
    } catch (err) {
      console.error("[Payments] failed to load packets", err);
      setError(err.message || "Failed to load payment packets");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    loadCommunications();
  }, [loadCommunications]);

  useEffect(() => {
    loadPaymentTypeMapping();
  }, [loadPaymentTypeMapping]);

  useEffect(() => {
    if (!requests.length) {
      setSelectedRequestId(null);
      return;
    }
    if (selectedRequestId && requests.some(entry => entry.id === selectedRequestId)) {
      return;
    }
    setSelectedRequestId(requests[0].id);
  }, [requests, selectedRequestId]);

  const selectRequest = useCallback(requestId => {
    setSelectedRequestId(requestId ?? null);
  }, []);

  const updatePacketStatus = useCallback(async (packetId, status, options = {}) => {
    if (!packetId || !status) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(packetId)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            notes: options.notes || null,
            override: options.override === true,
            overrideReason: options.overrideReason || null,
            overrideType: options.overrideType || null,
          }),
        }
      );
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw buildApiError(resp, payload, `Update failed (${resp.status})`);
      }
      const updated = normalizePacket(await resp.json());
      setRequests(prev => {
        const next = Array.isArray(prev) ? prev.slice() : [];
        const index = next.findIndex(entry => entry.id === updated.id);
        if (index >= 0) {
          next[index] = updated;
          return next;
        }
        return [updated, ...next];
      });
      setSelectedRequestId(updated.id);
      return updated;
    } catch (err) {
      console.error("[Payments] failed to update packet status", err);
      const message = err.message || "Failed to update packet status";
      setError(message);
      throw err;
    }
  }, []);

  const validatePacket = useCallback(async packetId => {
    if (!packetId) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(packetId)}/validate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw buildApiError(resp, payload, `Validation failed (${resp.status})`);
      }
      const updated = normalizePacket(payload);
      setRequests(prev => {
        const next = Array.isArray(prev) ? prev.slice() : [];
        const index = next.findIndex(entry => entry.id === updated.id);
        if (index >= 0) {
          next[index] = updated;
          return next;
        }
        return [updated, ...next];
      });
      setSelectedRequestId(updated.id);
      return updated;
    } catch (err) {
      console.error("[Payments] failed to validate packet", err);
      const message = err.message || "Failed to validate payment packet";
      setError(message);
      throw err;
    }
  }, []);

  const updateLineStatus = useCallback(async (lineId, status, options = {}) => {
    if (!lineId || !status) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-lines/${encodeURIComponent(lineId)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, ...options }),
        }
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw buildApiError(resp, payload, `Update failed (${resp.status})`);
      }
      const updatedLine = normalizeLine(payload);
      let updatedPacket = null;
      if (updatedLine?.packetId) {
        const packetResp = await apiFetch(
          `/api/finance/payment-packets/${encodeURIComponent(updatedLine.packetId)}`
        );
        if (packetResp.ok) {
          updatedPacket = normalizePacket(await packetResp.json());
        }
      }
      if (updatedPacket) {
        setRequests(prev => {
          const next = Array.isArray(prev) ? prev.slice() : [];
          const index = next.findIndex(entry => entry.id === updatedPacket.id);
          if (index >= 0) {
            next[index] = updatedPacket;
            return next;
          }
          return [updatedPacket, ...next];
        });
        setSelectedRequestId(updatedPacket.id);
      } else if (updatedLine?.packetId) {
        setRequests(prev =>
          prev.map(packet => {
            if (packet.id !== updatedLine.packetId) return packet;
            const nextLines = (packet.lines || []).map(line =>
              line.id === updatedLine.id ? updatedLine : line
            );
            return normalizePacket({ ...packet, lines: nextLines });
          })
        );
      }
      return updatedLine;
    } catch (err) {
      console.error("[Payments] failed to update line status", err);
      const message = err.message || "Failed to update payment line status";
      setError(message);
      throw err;
    }
  }, []);

  const updateLine = useCallback(async (lineId, payload = {}) => {
    if (!lineId) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-lines/${encodeURIComponent(lineId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw buildApiError(resp, data, `Update failed (${resp.status})`);
      }
      const updatedLine = normalizeLine(data);
      let updatedPacket = null;
      if (updatedLine?.packetId) {
        const packetResp = await apiFetch(
          `/api/finance/payment-packets/${encodeURIComponent(updatedLine.packetId)}`
        );
        if (packetResp.ok) {
          updatedPacket = normalizePacket(await packetResp.json());
        }
      }
      if (updatedPacket) {
        setRequests(prev => {
          const next = Array.isArray(prev) ? prev.slice() : [];
          const index = next.findIndex(entry => entry.id === updatedPacket.id);
          if (index >= 0) {
            next[index] = updatedPacket;
            return next;
          }
          return [updatedPacket, ...next];
        });
        setSelectedRequestId(updatedPacket.id);
      } else if (updatedLine?.packetId) {
        setRequests(prev =>
          prev.map(packet => {
            if (packet.id !== updatedLine.packetId) return packet;
            const nextLines = (packet.lines || []).map(line =>
              line.id === updatedLine.id ? updatedLine : line
            );
            return normalizePacket({ ...packet, lines: nextLines });
          })
        );
      }
      return updatedLine;
    } catch (err) {
      console.error("[Payments] failed to update payment line", err);
      const message = err.message || "Failed to update payment line";
      setError(message);
      throw err;
    }
  }, []);

  const deleteLine = useCallback(async lineId => {
    if (!lineId) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-lines/${encodeURIComponent(lineId)}`,
        { method: "DELETE" }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw buildApiError(resp, data, `Delete failed (${resp.status})`);
      }
      if (data?.id) {
        const updated = normalizePacket(data);
        setRequests(prev => {
          const next = Array.isArray(prev) ? prev.slice() : [];
          const index = next.findIndex(entry => entry.id === updated.id);
          if (index >= 0) {
            next[index] = updated;
            return next;
          }
          return [updated, ...next];
        });
        setSelectedRequestId(updated.id);
        return updated;
      }
      await loadRequests();
      return data;
    } catch (err) {
      console.error("[Payments] failed to delete payment line", err);
      const message = err.message || "Failed to delete payment line";
      setError(message);
      throw err;
    }
  }, [loadRequests]);

  const createPacket = useCallback(async payload => {
    try {
      const resp = await apiFetch("/api/finance/payment-packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw buildApiError(resp, data, `Create failed (${resp.status})`);
      }
      const created = normalizePacket(data);
      setRequests(prev => {
        const next = Array.isArray(prev) ? prev.slice() : [];
        const existingIndex = next.findIndex(entry => entry.id === created.id);
        if (existingIndex >= 0) {
          next[existingIndex] = created;
          return next;
        }
        return [created, ...next];
      });
      setSelectedRequestId(created.id);
      return created;
    } catch (err) {
      console.error("[Payments] failed to create payment packet", err);
      const message = err.message || "Failed to create payment packet";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const deletePacket = useCallback(async packetId => {
    if (!packetId) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(packetId)}`,
        { method: "DELETE" }
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw buildApiError(resp, payload, `Delete failed (${resp.status})`);
      }
      setRequests(prev => {
        const next = Array.isArray(prev)
          ? prev.filter(entry => entry.id !== String(packetId))
          : [];
        if (selectedRequestId && String(selectedRequestId) === String(packetId)) {
          setSelectedRequestId(next[0]?.id ?? null);
        }
        return next;
      });
      return payload;
    } catch (err) {
      console.error("[Payments] failed to delete payment packet", err);
      const message = err.message || "Failed to delete payment packet";
      setError(message);
      throw err;
    }
  }, [selectedRequestId]);

  const addPacketLines = useCallback(async (packetId, payload = {}) => {
    if (!packetId) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(packetId)}/lines`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw buildApiError(resp, data, `Create failed (${resp.status})`);
      }
      const updated = normalizePacket(data);
      setRequests(prev => {
        const next = Array.isArray(prev) ? prev.slice() : [];
        const index = next.findIndex(entry => entry.id === updated.id);
        if (index >= 0) {
          next[index] = updated;
          return next;
        }
        return [updated, ...next];
      });
      setSelectedRequestId(updated.id);
      return updated;
    } catch (err) {
      console.error("[Payments] failed to add payment lines", err);
      const message = err.message || "Failed to add payment lines";
      setError(message);
      throw err;
    }
  }, []);

  const createBatch = useCallback(async lineIds => {
    const normalized = Array.isArray(lineIds)
      ? lineIds.map(id => String(id)).filter(Boolean)
      : [];
    if (!normalized.length) return null;
    try {
      const resp = await apiFetch("/api/finance/payment-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineIds: normalized }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(payload?.message || payload?.error || `Create batch failed (${resp.status})`);
      }
      await loadRequests();
      return payload;
    } catch (err) {
      console.error("[Payments] failed to create batch", err);
      const message = err.message || "Failed to create payment batch";
      setError(message);
      throw new Error(message);
    }
  }, [loadRequests]);

  const updateBatchStatus = useCallback(async (batchId, status) => {
    if (!batchId || !status) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-batches/${encodeURIComponent(batchId)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(payload?.message || payload?.error || `Update failed (${resp.status})`);
      }
      await loadRequests();
      return payload;
    } catch (err) {
      console.error("[Payments] failed to update batch status", err);
      const message = err.message || "Failed to update payment batch status";
      setError(message);
      throw new Error(message);
    }
  }, [loadRequests]);

  const createRecurringLines = useCallback(async (packetId, payload = {}) => {
    if (!packetId) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(packetId)}/lines/recurring`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.message || data?.error || `Create failed (${resp.status})`);
      }
      const updated = normalizePacket(data);
      setRequests(prev => {
        const next = Array.isArray(prev) ? prev.slice() : [];
        const index = next.findIndex(entry => entry.id === updated.id);
        if (index >= 0) {
          next[index] = updated;
          return next;
        }
        return [updated, ...next];
      });
      setSelectedRequestId(updated.id);
      return updated;
    } catch (err) {
      console.error("[Payments] failed to create recurring lines", err);
      const message = err.message || "Failed to create recurring lines";
      setError(message);
      throw new Error(message);
    }
  }, []);

  const updateEvidence = useCallback(async (documentLinkId, payload = {}) => {
    if (!documentLinkId) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-documents/${encodeURIComponent(documentLinkId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload || {}),
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.message || data?.error || `Update failed (${resp.status})`);
      }
      await loadRequests();
      return normalizeEvidenceItem(data);
    } catch (err) {
      console.error("[Payments] failed to update evidence", err);
      const message = err.message || "Failed to update evidence";
      setError(message);
      throw new Error(message);
    }
  }, [loadRequests]);

  const addCommunication = useCallback(async payload => {
    if (!payload?.packetId) return null;
    try {
      const resp = await apiFetch("/api/finance/payment-communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packetId: payload.packetId,
          subject: payload.subject ?? "Payment correspondence",
          recipients: payload.recipients ?? [],
          direction: payload.direction ?? "outbound",
          channel: payload.channel ?? "email",
          body: payload.body ?? null,
          template: payload.template ?? "manual",
          attachments: payload.attachments ?? [],
        }),
      });
      if (!resp.ok) {
        const message = (await resp.json().catch(() => ({}))).message || resp.statusText;
        throw new Error(message || "Failed to log communication");
      }
      const created = normalizeCommunication(await resp.json());
      if (created) {
        setCommunications(prev => [created, ...prev]);
      }
      return created;
    } catch (err) {
      console.error("[Payments] failed to log communication", err);
      return null;
    }
  }, []);

  const sendPacketEmail = useCallback(async (packetId, note = null) => {
    if (!packetId) return null;
    try {
      const resp = await apiFetch(
        `/api/finance/payment-packets/${encodeURIComponent(packetId)}/send-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }
      );
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(payload?.message || payload?.error || `Send failed (${resp.status})`);
      }
      const created = normalizeCommunication(payload?.communication);
      if (created) {
        setCommunications(prev => [created, ...prev]);
      } else {
        loadCommunications();
      }
      return payload;
    } catch (err) {
      console.error("[Payments] failed to send finance email", err);
      throw err;
    }
  }, [loadCommunications]);

  const selectedRequest = useMemo(
    () => requests.find(entry => entry.id === selectedRequestId) ?? null,
    [requests, selectedRequestId],
  );

  const paymentTypeMappingLookup = useMemo(
    () => buildPaymentTypeMappingLookup(paymentTypeMapping),
    [paymentTypeMapping],
  );

  const slaSnapshot = useMemo(() => computeSlaSnapshot(requests), [requests]);

  const value = useMemo(
    () => ({
      requests,
      selectedRequest,
      selectedRequestId,
      selectRequest,
      updatePacketStatus,
      validatePacket,
      updateLineStatus,
      updateLine,
      deleteLine,
      createPacket,
      deletePacket,
      addPacketLines,
      createBatch,
      updateBatchStatus,
      createRecurringLines,
      updateEvidence,
      communications,
      addCommunication,
      sendPacketEmail,
      slaSnapshot,
      paymentTypeMapping,
      paymentTypeMappingLookup,
      paymentTypeMappingLoading,
      loading,
      error,
      reloadRequests: loadRequests,
      reloadCommunications: loadCommunications,
      reloadPaymentTypeMapping: loadPaymentTypeMapping,
    }),
    [
      requests,
      selectedRequest,
      selectedRequestId,
      selectRequest,
      updatePacketStatus,
      validatePacket,
      updateLineStatus,
      updateLine,
      deleteLine,
      createPacket,
      deletePacket,
      addPacketLines,
      createBatch,
      updateBatchStatus,
      createRecurringLines,
      updateEvidence,
      communications,
      addCommunication,
      sendPacketEmail,
      slaSnapshot,
      paymentTypeMapping,
      paymentTypeMappingLookup,
      paymentTypeMappingLoading,
      loading,
      error,
      loadRequests,
      loadCommunications,
      loadPaymentTypeMapping,
    ],
  );

  return <PaymentsDataContext.Provider value={value}>{children}</PaymentsDataContext.Provider>;
};

export const usePaymentsData = () => {
  const context = useContext(PaymentsDataContext);
  if (!context) {
    throw new Error("usePaymentsData must be used within a PaymentsDataProvider");
  }
  return context;
};
