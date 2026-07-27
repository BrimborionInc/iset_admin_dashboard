#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  extractProdData,
} = require('./generate-regional-snapshot-from-prod');
const {
  classifyApplicationOutcome,
  isExplicitManualReportingRecord,
  isRegionalSnapshotFundingEligible,
  resolveReportingApplicationLineage,
} = require('../src/server/regionalSnapshotMetrics');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(
  REPO_ROOT,
  'docs/data/temp/regional-snapshot-integrity-audit-2026-07-27.json'
);
const VALID_PROVINCES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
]);
const PROVINCE_ALIASES = new Map([
  ['alberta', 'AB'],
  ['british columbia', 'BC'],
  ['manitoba', 'MB'],
  ['new brunswick', 'NB'],
  ['newfoundland and labrador', 'NL'],
  ['nova scotia', 'NS'],
  ['northwest territories', 'NT'],
  ['nunavut', 'NU'],
  ['ontario', 'ON'],
  ['prince edward island', 'PE'],
  ['quebec', 'QC'],
  ['québec', 'QC'],
  ['saskatchewan', 'SK'],
  ['yukon', 'YT'],
]);
const FUNDING_ELIGIBLE_STATUSES = new Set([
  'approved', 'in_progress', 'suspended', 'completed', 'complete',
]);
const TERMINAL_DENIED_STATUSES = new Set([
  'rejected', 'declined', 'denied', 'ineligible', 'withdrawn', 'cancelled', 'canceled',
]);

const normalizeToken = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

const normalizeProvince = value => {
  const text = String(value || '').trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  if (VALID_PROVINCES.has(upper)) return upper;
  return PROVINCE_ALIASES.get(text.toLowerCase()) || null;
};

const toPositiveInteger = value => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const toAmount = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
};

const toDateOnly = value => {
  const match = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const asObject = value => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
};

const readCostLines = row => {
  const metadata = asObject(row?.metadata_json);
  const payload = asObject(row?.payload_json);
  const snapshot = asObject(metadata?.snapshot);
  const candidates = [
    metadata.costLines,
    metadata.cost_lines,
    snapshot.costLines,
    payload.costLines,
    payload.cost_lines,
    payload?.intervention?.costLines,
    payload?.intervention?.cost_lines,
  ];
  return {
    metadata,
    payload,
    actionPlanMetadata: asObject(row?.action_plan_metadata_json),
    lines: candidates.find(Array.isArray) || [],
  };
};

const resolveApprovedAmount = (row, metadata) => {
  const candidates = [
    row?.approved_amount,
    row?.budget_amount,
    row?.intervention_cost,
    row?.proposed_cost,
    metadata?.costTotal,
    metadata?.cost,
  ];
  for (const candidate of candidates) {
    const amount = toAmount(candidate);
    if (amount !== null && amount > 0) return amount;
  }
  return null;
};

const resolveFundingSource = (line, row, metadata, actionPlanMetadata) => {
  const candidates = [
    line?.fundingSource,
    line?.funding_source,
    line?.fundingStream,
    line?.funding_stream,
    row?.pot_funding_source,
    row?.funding_stream_decision,
    row?.plan_funding_stream,
    metadata?.fundingStream,
    metadata?.funding_stream,
    actionPlanMetadata?.fundingStream,
    actionPlanMetadata?.funding_stream,
  ];
  for (const candidate of candidates) {
    const source = String(candidate || '').trim().toUpperCase();
    if (source === 'CRF' || source === 'EI') return source;
  }
  return null;
};

const recordKey = row => {
  const interventionId = toPositiveInteger(row?.intervention_id);
  if (interventionId) return `intervention-${interventionId}`;
  const proposalId = toPositiveInteger(row?.proposal_id);
  return proposalId ? `proposal-${proposalId}` : 'unknown-record';
};

async function main() {
  process.stderr.write('Reading Regional Snapshot source rows from PROD (read-only)...\n');
  const data = extractProdData({ fiscalYearStart: 2026 });
  const applications = data.__APPLICATIONS__ || [];
  const records = [
    ...(data.__INTERVENTIONS__ || []),
    ...(data.__PROPOSALS__ || []),
  ];
  const applicationById = new Map(
    applications
      .map(application => [toPositiveInteger(application.id), application])
      .filter(([id]) => id)
  );
  const findings = [];
  const expectedManualRecords = [];
  const linkedRecordDates = new Map();
  const seenRecordKeys = new Set();
  const globalCostLineOwner = new Map();

  const addFinding = (severity, type, row, details = {}) => {
    findings.push({
      severity,
      type,
      record: row ? recordKey(row) : null,
      interventionId: toPositiveInteger(row?.intervention_id),
      proposalId: toPositiveInteger(row?.proposal_id),
      actionPlanId: toPositiveInteger(row?.action_plan_id),
      caseId: toPositiveInteger(row?.case_id),
      applicationId: toPositiveInteger(
        row?.resolved_application_id ?? row?.application_id
      ),
      ...details,
    });
  };

  applications.forEach(application => {
    const applicationId = toPositiveInteger(application.id);
    const clientProvince = normalizeProvince(application.client_address_province);
    const submissionProvince = normalizeProvince(application.submission_address_province);
    if (clientProvince && submissionProvince && clientProvince !== submissionProvince) {
      findings.push({
        severity: 'warning',
        type: 'province_source_conflict',
        record: null,
        caseId: toPositiveInteger(application.case_id),
        applicationId,
        clientProvince,
        submissionProvince,
        reportingEffect: 'Participant-home province must control Regional Snapshot attribution.',
      });
    }
    if (!clientProvince && !submissionProvince) {
      findings.push({
        severity: 'error',
        type: 'missing_application_province',
        record: null,
        caseId: toPositiveInteger(application.case_id),
        applicationId,
        reportingEffect: 'The application cannot be assigned to a regional report.',
      });
    }
    if (!toPositiveInteger(application.client_id)) {
      findings.push({
        severity: 'error',
        type: 'missing_application_client',
        record: null,
        caseId: toPositiveInteger(application.case_id),
        applicationId,
        reportingEffect: 'Funded-client deduplication cannot use canonical client identity.',
      });
    }
    const decision = normalizeToken(application.decision_outcome);
    const status = normalizeToken(application.status);
    if (
      (decision === 'approved' && TERMINAL_DENIED_STATUSES.has(status)) ||
      (decision === 'denied' && status === 'approved')
    ) {
      findings.push({
        severity: 'warning',
        type: 'application_outcome_status_conflict',
        record: null,
        caseId: toPositiveInteger(application.case_id),
        applicationId,
        decisionOutcome: decision,
        status,
        reportingEffect: 'The report applies the current terminal/denied outcome precedence rule.',
      });
    }
  });

  records.forEach(row => {
    const key = recordKey(row);
    if (seenRecordKeys.has(key)) {
      addFinding('error', 'duplicate_reporting_record', row, {
        reportingEffect: 'The same intervention/proposal could be counted more than once.',
      });
    }
    seenRecordKeys.add(key);

    const lineage = resolveReportingApplicationLineage({
      actionPlanApplicationId: row.action_plan_application_id,
      proposalApplicationId: row.proposal_application_id,
      esdcApplicationId: row.esdc_application_id,
      uniquePlanProposalApplicationId: row.unique_plan_proposal_application_id,
      planProposalApplicationCount: row.plan_proposal_application_count,
    });
    row.resolved_application_id = lineage.applicationId;
    if (lineage.conflict) {
      addFinding('error', 'conflicting_application_lineage', row, {
        candidateApplicationIds: lineage.candidateApplicationIds,
        reportingEffect: 'The record is excluded because authoritative application links conflict.',
      });
      return;
    }
    const applicationId = toPositiveInteger(lineage.applicationId);
    const application = applicationById.get(applicationId);
    const {
      metadata,
      payload,
      actionPlanMetadata,
      lines,
    } = readCostLines(row);
    const isManual = isExplicitManualReportingRecord({
      metadata,
      payload,
      actionPlanMetadata,
    });

    if (!applicationId || !application) {
      const detail = {
        source:
          metadata.source ||
          payload.source ||
          actionPlanMetadata.source ||
          null,
        clientProvince: normalizeProvince(row.client_address_province),
      };
      if (isManual) {
        expectedManualRecords.push({
          record: key,
          actionPlanId: toPositiveInteger(row.action_plan_id),
          caseId: toPositiveInteger(row.case_id),
          ...detail,
        });
      } else {
        addFinding('error', 'missing_application_lineage', row, {
          ...detail,
          reportingEffect:
            'The record is excluded because no authoritative application provenance exists.',
        });
      }
      return;
    }

    if (
      toPositiveInteger(application.case_id) !== toPositiveInteger(row.case_id)
    ) {
      addFinding('error', 'cross_case_application_lineage', row, {
        applicationCaseId: toPositiveInteger(application.case_id),
        reportingEffect: 'The intervention is attributed to an application on another case.',
      });
    }
    if (
      toPositiveInteger(application.client_id) &&
      toPositiveInteger(row.client_id) &&
      toPositiveInteger(application.client_id) !== toPositiveInteger(row.client_id)
    ) {
      addFinding('error', 'application_client_mismatch', row, {
        applicationClientId: toPositiveInteger(application.client_id),
        interventionClientId: toPositiveInteger(row.client_id),
        reportingEffect: 'Regional and funded-client attribution may use different people.',
      });
    }
    if (
      toPositiveInteger(row.proposal_application_id) &&
      toPositiveInteger(row.action_plan_application_id) &&
      toPositiveInteger(row.proposal_application_id) !==
        toPositiveInteger(row.action_plan_application_id)
    ) {
      addFinding('error', 'proposal_action_plan_application_conflict', row, {
        proposalApplicationId: toPositiveInteger(row.proposal_application_id),
        actionPlanApplicationId: toPositiveInteger(row.action_plan_application_id),
        reportingEffect: 'The report currently gives proposal provenance precedence.',
      });
    }
    if (
      toPositiveInteger(row.proposal_application_id) &&
      !toPositiveInteger(row.action_plan_application_id)
    ) {
      addFinding('warning', 'proposal_only_application_lineage', row, {
        proposalApplicationId: toPositiveInteger(row.proposal_application_id),
        reportingEffect:
          'The record is attributed through its proposal, but sibling interventions on the same plan may remain unattributed.',
      });
    }
    if (
      applicationId &&
      !toPositiveInteger(row.action_plan_application_id) &&
      !toPositiveInteger(row.proposal_application_id)
    ) {
      addFinding('warning', 'indirect_application_lineage', row, {
        lineageSources: lineage.sources,
        reportingEffect:
          'The record is attributed through agreeing plan-level proposal or ESDC provenance.',
      });
    }

    const dates = [
      toDateOnly(row.start_date),
      ...lines.flatMap(line => {
        const recurrence = asObject(line?.recurrence);
        return [
          toDateOnly(
            line?.paymentDueDate ??
            line?.payment_due_date ??
            line?.dueDate ??
            line?.due_date
          ),
          toDateOnly(recurrence.startDate ?? recurrence.start_date),
          toDateOnly(recurrence.endDate ?? recurrence.end_date),
        ];
      }),
    ].filter(Boolean);
    const currentDates = linkedRecordDates.get(applicationId) || [];
    currentDates.push(...dates);
    linkedRecordDates.set(applicationId, currentDates);

    const storedStatus = normalizeToken(row.status);
    const effectiveStatus = FUNDING_ELIGIBLE_STATUSES.has(storedStatus)
      ? storedStatus
      : normalizeToken(row.proposal_review_status ?? row.review_status);
    const fundingEligible = isRegionalSnapshotFundingEligible({
      effectiveStatus,
      storedInterventionStatus: row.status,
      actionPlanStatus: row.action_plan_status,
      actionPlanArchivedAt: row.action_plan_archived_at,
      sourceInterventionId: row.proposal_source_intervention_id,
    });
    const approvedAmount = resolveApprovedAmount(row, metadata);
    let positiveLineTotal = 0;
    let positiveLineCount = 0;
    const localCostLineIds = new Set();

    lines.forEach((line, index) => {
      const amount = toAmount(line?.amount);
      const lineId = String(line?.id || '').trim() || null;
      if (lineId) {
        if (localCostLineIds.has(lineId)) {
          addFinding('error', 'duplicate_cost_line_id_within_record', row, {
            costLineId: lineId,
            costLineIndex: index + 1,
            reportingEffect: 'The same approved line may be counted twice.',
          });
        }
        localCostLineIds.add(lineId);
        const owner = globalCostLineOwner.get(lineId);
        if (owner && owner !== key) {
          addFinding('warning', 'cost_line_id_reused_across_records', row, {
            costLineId: lineId,
            otherRecord: owner,
            reportingEffect: 'Confirm this is proposal/intervention lineage, not duplicated funding.',
          });
        } else {
          globalCostLineOwner.set(lineId, key);
        }
      }
      if (amount !== null && amount < 0) {
        addFinding('error', 'negative_funding_line', row, {
          costLineIndex: index + 1,
          amount,
          reportingEffect: 'The line is excluded from funding totals.',
        });
        return;
      }
      if (amount === null || amount <= 0) return;
      positiveLineCount += 1;
      positiveLineTotal += amount;

      const recurrence = asObject(line?.recurrence);
      const recurrenceEnabled =
        recurrence.enabled === true ||
        normalizeToken(recurrence.enabled) === 'true';
      if (recurrenceEnabled) {
        const recurrenceStart = toDateOnly(
          recurrence.startDate ?? recurrence.start_date
        ) || toDateOnly(row.start_date);
        const recurrenceEnd = toDateOnly(
          recurrence.endDate ?? recurrence.end_date
        );
        const occurrences = Number(recurrence.occurrences);
        const amountPerPeriod = toAmount(
          recurrence.amountPerPeriod ?? recurrence.amount_per_period
        );
        if (
          !recurrenceStart ||
          (!recurrenceEnd && !(Number.isInteger(occurrences) && occurrences > 0)) ||
          amountPerPeriod === null ||
          amountPerPeriod <= 0
        ) {
          addFinding('error', 'incomplete_recurrence_schedule', row, {
            costLineIndex: index + 1,
            reportingEffect: 'Scheduled occurrences may be missing or assigned to the wrong period.',
          });
        }
        if (recurrenceStart && recurrenceEnd && recurrenceEnd < recurrenceStart) {
          addFinding('error', 'reversed_recurrence_dates', row, {
            costLineIndex: index + 1,
            recurrenceStart,
            recurrenceEnd,
            reportingEffect: 'No defensible recurrence schedule can be expanded.',
          });
        }
        if (
          Number.isInteger(occurrences) &&
          occurrences > 0 &&
          amountPerPeriod !== null &&
          Math.abs(amount - occurrences * amountPerPeriod) > 0.01
        ) {
          addFinding('error', 'recurrence_total_mismatch', row, {
            costLineIndex: index + 1,
            lineAmount: amount,
            occurrences,
            amountPerPeriod,
            expectedTotal: Math.round(occurrences * amountPerPeriod * 100) / 100,
            reportingEffect: 'Expanded scheduled funding will not reconcile with the approved line amount.',
          });
        }
      }

      if (
        fundingEligible &&
        !resolveFundingSource(line, row, metadata, actionPlanMetadata)
      ) {
        addFinding('warning', 'unknown_funding_source', row, {
          costLineIndex: index + 1,
          amount,
          reportingEffect: 'The report includes the line in CRF by default.',
        });
      }
    });

    positiveLineTotal = Math.round(positiveLineTotal * 100) / 100;
    if (
      fundingEligible &&
      approvedAmount !== null &&
      positiveLineCount > 0 &&
      Math.abs(approvedAmount - positiveLineTotal) > 0.01
    ) {
      addFinding('error', 'approved_amount_cost_line_mismatch', row, {
        approvedAmount,
        costLineTotal: positiveLineTotal,
        reportingEffect: 'The report sums approved cost lines, not the inconsistent intervention header amount.',
      });
    }
    if (fundingEligible && approvedAmount !== null && positiveLineCount === 0) {
      addFinding('warning', 'missing_approved_funding_lines', row, {
        approvedAmount,
        reportingEffect: 'The report falls back to the intervention start date and header amount.',
      });
    }
    if (
      fundingEligible &&
      (positiveLineCount > 0 || approvedAmount !== null) &&
      classifyApplicationOutcome(application) === 'denied'
    ) {
      addFinding('error', 'funding_on_denied_or_withdrawn_application', row, {
        applicationStatus: application.status,
        decisionOutcome: application.decision_outcome,
        approvedAmount,
        costLineTotal: positiveLineTotal,
        reportingEffect: 'Current approved intervention funding is still included in Section C.',
      });
    }
  });

  applications.forEach(application => {
    const applicationId = toPositiveInteger(application.id);
    const receivedDate = toDateOnly(application.submitted_at);
    const activityDates = linkedRecordDates.get(applicationId) || [];
    if (!receivedDate && !activityDates.length) {
      findings.push({
        severity: 'error',
        type: 'missing_application_reporting_date',
        record: null,
        caseId: toPositiveInteger(application.case_id),
        applicationId,
        reportingEffect: 'The application is absent from every reporting period.',
      });
    }
  });

  const byType = {};
  const bySeverity = {};
  findings.forEach(finding => {
    byType[finding.type] = (byType[finding.type] || 0) + 1;
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
  });
  const report = {
    generatedAt: new Date().toISOString(),
    source: 'PROD read-only extraction',
    scope: {
      applications: applications.length,
      interventions: (data.__INTERVENTIONS__ || []).length,
      standaloneProposals: (data.__PROPOSALS__ || []).length,
      expectedManualRecords: expectedManualRecords.length,
    },
    summary: {
      findings: findings.length,
      bySeverity,
      byType,
    },
    findings,
    expectedManualRecords,
  };
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    output: OUTPUT_PATH,
    scope: report.scope,
    summary: report.summary,
  }, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
