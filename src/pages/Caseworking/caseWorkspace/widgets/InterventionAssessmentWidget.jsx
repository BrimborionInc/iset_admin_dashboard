import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  Checkbox,
  ColumnLayout,
  DatePicker,
  FormField,
  Grid,
  Header,
  Input,
  Link,
  Modal,
  Select,
  SpaceBetween,
  Textarea,
  Autosuggest,
  Multiselect,
  Wizard,
  Table,
  StatusIndicator,
  Tabs,
} from "@cloudscape-design/components";
import { apiFetch } from "../../../../auth/apiClient";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import useCurrentUser from "../../../../hooks/useCurrentUser.js";
import { findOptionByValue } from "../../../finance/widgets/paymentOptions";
import { getCurrencyInputDisplayValue } from "../../../../utils/currencyFormat";
import { buildApplicantFacingReasonSentence } from "../../../../utils/decisionLetterText";
import { normalizeInterventionStatus } from "../../../../utils/interventionStatus.js";
import {
  isEducationInterventionCode as isEducationCode,
  isEmployerInterventionCode as isEmployerCode,
  isWageSubsidyInterventionCode as isWageSubsidyCode,
  requiresExternalPartnerForInterventionCode as requiresExternalPartnerForCode,
  requiresNocForInterventionCode as requiresNocForCode,
} from "../../../../utils/interventionCodeRules.js";
import styles from "./InterventionAssessmentWidget.module.css";

const BARRIER_OPTIONS = [
  { value: "education", label: "Education" },
  { value: "lack_of_skills", label: "Lack of marketable skills" },
  { value: "lack_of_experience", label: "Lack of work experience" },
  { value: "remoteness", label: "Remoteness" },
  { value: "transportation", label: "Lack of transportation" },
  { value: "economic", label: "Economic" },
  { value: "language", label: "Language" },
  { value: "dependent_care", label: "Dependent care" },
  { value: "health", label: "Health" },
  { value: "other", label: "Other" },
];

const ESDC_OPTIONS = [
  { label: "CRF", value: "CRF" },
  { label: "EI Active Claim", value: "EI Active Claim" },
  { label: "EI Reach Back", value: "EI Reach Back" },
];

const POSTING_CONTEXT_OPTIONS = [
  { value: "external", label: "External (region/PTMA)" },
  { value: "internal", label: "Internal (NWAC)" },
];

const EI_ELIGIBILITY_ROLE_KEYS = new Set([
  "systemadministrator",
  "nwacadministrator",
  "regionalmanager",
]);

const SUBMITTED_PROPOSAL_EDITOR_ROLE_KEYS = new Set([
  "systemadministrator",
  "nwacadministrator",
  "regionalmanager",
  "isetcoordinator",
]);

const SUBMITTED_PROPOSAL_DECIDER_ROLE_KEYS = new Set([
  "systemadministrator",
  "nwacadministrator",
  "regionalmanager",
]);

const normalizeRoleKey = value =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const normalizeFundingStream = value => {
  if (!value) return "";
  const normalized = String(value).trim().toUpperCase();
  if (normalized.includes("CRF")) return "CRF";
  if (normalized.includes("EI")) return "EI";
  return normalized;
};

const deriveFundingStreamFromEiStatus = status => {
  if (!status) return "";
  const normalized = String(status).trim().toUpperCase();
  return normalized === "CRF" ? "CRF" : "EI";
};

const ELIGIBILITY_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/bmp",
  "image/tiff",
];
const ELIGIBILITY_MAX_BYTES = 6 * 1024 * 1024;

const DECISION_OPTIONS = [
  { value: "approved", label: "Approve" },
  { value: "changes_requested", label: "Request changes" },
  { value: "rejected", label: "Reject" },
];

const BASE_STEP_IDS = [
  "plan",
  "framing",
  "rationale",
  "otherFunding",
  "childcare",
  "cost",
  "docs",
  "review",
];
const SUBMITTED_STEP_IDS = ["decision"];
const COMMUNICATION_STEP_ID = "communication";
const ALL_STEP_IDS = [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS, COMMUNICATION_STEP_ID];
const STEP_LABELS = {
  plan: "Action plan",
  framing: "What is being proposed?",
  rationale: "Why is this intervention needed?",
  otherFunding: "Other funding sources",
  childcare: "Does the client need childcare?",
  cost: "What will it cost?",
  docs: "Do you have the right supporting documents?",
  review: "Review and submit",
  decision: "Record of decision",
  communication: "Approval letters",
};
const REQUIRED_STEP_IDS = ["plan", "framing", "rationale", "cost"];

const RATIONALE_WORD_LIMIT = 400;
const OTHER_FUNDING_INVOLVED_OPTIONS = [
  { label: "No", value: "no" },
  { label: "Yes", value: "yes" },
  { label: "Unknown", value: "unknown" },
];
const OTHER_FUNDER_TYPE_OPTIONS = [
  {
    label: "ISET Holder",
    value: "iset_holder",
    description: "Another ISET holder funding part of the plan.",
  },
  {
    label: "Federal Program",
    value: "federal_program",
    description: "Federal funding program outside ISET.",
  },
  {
    label: "Prov/Terr Program",
    value: "provincial_territorial_program",
    description: "Provincial or territorial grant/support.",
  },
  {
    label: "Indigenous Government",
    value: "indigenous_government_org",
    description: "Band, Tribal Council, Métis/Inuit/regional Indigenous org.",
  },
  {
    label: "Employer",
    value: "employer",
    description: "Employer-funded training, wage support, or sponsorship.",
  },
  {
    label: "Bursary/Scholarship",
    value: "education_bursary_scholarship",
    description: "Education bursary, scholarship, or award.",
  },
  {
    label: "Nonprofit/Charity",
    value: "nonprofit_charity",
    description: "Foundation, charity, or community nonprofit support.",
  },
  {
    label: "Insurance/Compensation",
    value: "insurance_compensation",
    description: "Insurance, WCB/WSIB, settlement, or compensation support.",
  },
  {
    label: "Personal/Family",
    value: "personal_family",
    description: "Self-funded or family-funded support.",
  },
  {
    label: "Other Public",
    value: "other_public",
    description: "Municipal or other public agency support.",
  },
  {
    label: "Other",
    value: "other",
    description: "Any other funding source.",
  },
];
const OTHER_FUNDER_TYPE_VALUE_SET = new Set(OTHER_FUNDER_TYPE_OPTIONS.map(option => option.value));
const resolveOtherFunderTypeLabel = value =>
  OTHER_FUNDER_TYPE_OPTIONS.find(option => option.value === normalizeOtherFunderType(value))?.label || "Other";

const defaultFormState = {
  actionPlanId: "",
  rationale: "",
  otherFundingInvolved: "",
  otherFundingSources: [],
  otherFundingNwacCoverage: "",
  otherFundingNotes: "",
  childcareNeed: "",
  childcareFunding: "",
  barriers: [],
  proposedInterventions: [],
  eiVerificationStatus: "",
  eiVerificationNotes: "",
  decisionOutcome: "",
  decisionNotes: "",
  eiVerificationDocumentId: null,
};

const DEFAULT_ORG_NAME = "NWAC ISET Program";
const SUPPORT_LABEL_OVERRIDES = {
  TuitionFeesDirect: "tuition",
  TuitionFeesReimbursement: "tuition",
  BooksMaterialsDirect: "books or program materials",
  BooksMaterialsReimbursement: "books or program materials",
  LivingAllowance: "living allowance",
  Childcare: "childcare",
  Transportation: "transportation",
  WageSubsidyEmployer: "targeted wage subsidy",
  SpecializedEquipmentAdvance: "specialized equipment",
  SpecializedEquipmentReimbursement: "specialized equipment",
  JCPProjectCost: "project costs",
  SEBSupport: "SEB support",
  OtherEligibleCost: "other eligible cost",
};

const toSafeFileToken = (value, fallback = "letter") => {
  const token = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return token || fallback;
};

const toTitleCaseWords = value =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

const toSentenceCaseWords = value => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};

const formatCostTypeForLetter = type => {
  const direct = String(type || "").trim();
  if (!direct) return "Approved support";
  if (SUPPORT_LABEL_OVERRIDES[direct]) {
    return toSentenceCaseWords(SUPPORT_LABEL_OVERRIDES[direct]);
  }
  return toSentenceCaseWords(toTitleCaseWords(direct));
};

const formatCaseManagerSignatureLines = ({ caseManagerName = "", caseManagerEmail = "", caseManagerPhone = "" } = {}) => {
  const lines = [];
  lines.push("NATIVE WOMEN'S ASSOCIATION OF CANADA (ISET Program)");
  lines.push("");
  if (caseManagerName) lines.push(caseManagerName);
  if (caseManagerEmail) lines.push(caseManagerEmail);
  if (caseManagerPhone) lines.push(caseManagerPhone);
  return lines.join("\n");
};

const buildInstitutionApprovalLetters = ({
  interventions = [],
  applicantName = "",
  decisionDate = "",
  caseManagerName = "",
  caseManagerEmail = "",
  caseManagerPhone = "",
  isRevision = false,
} = {}) => {
  const normalizePayeeType = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const resolveInstitutionPayeeCategory = (line, institutionName) => {
    const payee = line?.payee && typeof line.payee === "object" ? line.payee : {};
    const payeeTypeKey = normalizePayeeType(payee.type);
    const payeeTypeRaw = String(payee.type || "").trim().toLowerCase();
    const payeeName = String(payee.name || "").trim().toLowerCase();
    const institutionKey = String(institutionName || "").trim().toLowerCase();
    const paymentType = String(line?.type || "").trim().toLowerCase();
    const payeeHint = `${payeeTypeKey} ${payeeTypeRaw} ${payeeName}`.trim();

    if (/(participant|client|student|applicant)/.test(payeeHint)) return "client";
    if (/(institution|university|college|school|training)/.test(payeeHint)) return "institution";
    if (/(employer|supplier|vendor|provider|organization|organisation|community|nonprofit|charity)/.test(payeeHint)) {
      return "other";
    }
    if (
      payeeTypeKey === "accreditededucationaltraininginstitution" ||
      payeeTypeKey === "traininginstitution" ||
      payeeTypeKey === "traininginstitute"
    ) {
      return "institution";
    }
    if (institutionKey && payeeName && payeeName.includes(institutionKey)) return "institution";
    if (paymentType.includes("tuition")) return "institution";
    if (paymentType.includes("reimbursement")) return "client";
    if (
      paymentType.includes("living") ||
      paymentType.includes("transport") ||
      paymentType.includes("childcare")
    ) {
      return "client";
    }
    if (paymentType.includes("books") || paymentType.includes("materials") || paymentType.includes("equipment")) {
      if (paymentType.includes("direct")) return "other";
      return "client";
    }
    return "other";
  };

  const byInstitution = new Map();
  (Array.isArray(interventions) ? interventions : []).forEach(intervention => {
    const institution = String(intervention?.institution || "").trim();
    if (!institution) return;
    const interventionId = intervention?.id;
    if (!byInstitution.has(institution)) {
      byInstitution.set(institution, {
        institution,
        programs: new Set(),
        terms: new Set(),
        lineItems: [],
      });
    }
    const target = byInstitution.get(institution);
    const programName = String(intervention?.programName || "").trim();
    if (programName) target.programs.add(programName);
    const termLabel = formatInterventionDates(intervention?.startDate, intervention?.endDate);
    if (termLabel && termLabel !== "—") target.terms.add(termLabel);
    const costLines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
    costLines.forEach((line, lineIndex) => {
      const amount = parseCurrencyToNumber(line?.amount);
      if (!(amount > 0)) return;
      const label = formatCostTypeForLetter(line?.type);
      target.lineItems.push({
        id: `${interventionId || "intervention"}-${line?.id || lineIndex + 1}`,
        label,
        amount,
        termLabel,
        type: line?.type || "",
        payee: line?.payee && typeof line.payee === "object" ? { ...line.payee } : null,
      });
    });
  });

  return Array.from(byInstitution.values()).map((item, index) => {
    const programText = item.programs.size ? Array.from(item.programs).join(", ") : "approved training supports";
    const termText = item.terms.size ? Array.from(item.terms).join("; ") : "As assessed";
    const fundingLines = item.lineItems.length
      ? item.lineItems
      : [{
          id: `total-${index + 1}`,
          label: "Approved training costs",
          amount: 0,
          termLabel: termText,
          type: "TuitionFeesDirect",
          payee: { type: "AccreditedEducationalTrainingInstitution", name: item.institution },
        }];
    const formatFundingLine = line => `- ${line.label}: $${Number(line.amount || 0).toFixed(2)}  Term/Dates: ${line.termLabel || termText}`;
    const institutionPayLines = [];
    const clientPayLines = [];
    const otherPayLines = [];
    fundingLines.forEach(line => {
      const category = resolveInstitutionPayeeCategory(line, item.institution);
      if (category === "institution") institutionPayLines.push(line);
      else if (category === "client") clientPayLines.push(line);
      else otherPayLines.push(line);
    });
    const fundingSectionParts = [];
    if (institutionPayLines.length) {
      fundingSectionParts.push(
        isRevision
          ? `The revised approved costs payable directly to ${item.institution} on behalf of the student are:`
          : `The NWAC ISET Program has approved payment of the following costs directly to ${item.institution} on behalf of the student:`,
        institutionPayLines.map(formatFundingLine).join("\n")
      );
    }
    if (clientPayLines.length) {
      fundingSectionParts.push(
        isRevision
          ? "The following revised supports are also approved for payment directly to the student:"
          : "The following supports have also been approved for payment directly to the student:",
        clientPayLines.map(formatFundingLine).join("\n")
      );
    }
    if (otherPayLines.length) {
      fundingSectionParts.push(
        isRevision
          ? "The following revised supports are also approved for payment to other eligible payees:"
          : "The following supports have also been approved for payment to other eligible payees:",
        otherPayLines.map(formatFundingLine).join("\n")
      );
    }
    const signatureBlock = formatCaseManagerSignatureLines({
      caseManagerName,
      caseManagerEmail,
      caseManagerPhone,
    });
    const body = [
      isRevision ? "Funding Revision Letter (Institution)" : "Letter of Approval (Institution)",
      `Date: ${decisionDate || ""}`,
      "",
      item.institution,
      "",
      "To Whom It May Concern,",
      "",
      isRevision
        ? "This letter is to formally confirm that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, has approved a revision to the education-related funding previously approved on behalf of the following student:"
        : "This letter is to formally confirm that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, has approved education-related funding on behalf of the following student:",
      "",
      `Student Name: ${applicantName || "Student"}`,
      `Training Institution: ${item.institution}`,
      `Program of Study: ${programText}`,
      "",
      fundingSectionParts.join("\n\n"),
      "",
      isRevision
        ? "These revised funds are provided under the ISET Program and are intended solely to support the student's participation in the approved training program noted above. Please note that all payments are made on behalf of the student. In the event of an overpayment, withdrawal, or change in enrollment status, any unused or refunded funds must be returned directly to the NWAC ISET Program and not issued to the student."
        : "These funds are provided under the ISET Program and are intended solely to support the student's participation in the approved training program noted above. Please note that all payments are made on behalf of the student. In the event of an overpayment, withdrawal, or change in enrollment status, any unused or refunded funds must be returned directly to the NWAC ISET Program and not issued to the student.",
      "",
      "Should you require additional documentation or clarification, please do not hesitate to contact the undersigned.",
      "",
      "Sincerely,",
      signatureBlock,
    ].join("\n");
    return {
      id: `institution-${index + 1}`,
      recipientName: item.institution,
      title: isRevision
        ? `Institution Funding Revision Letter — ${item.institution}`
        : `Institution Letter — ${item.institution}`,
      fileName: `institution-letter-${toSafeFileToken(item.institution, `recipient-${index + 1}`)}.txt`,
      body,
    };
  });
};

const buildCoFunderApprovalLetters = ({
  fundingSources = [],
  nwacCoverage = "",
  notes = "",
  interventions = [],
  applicantName = "",
  trackingReference = "",
  decisionDate = "",
  caseManagerName = "",
  caseManagerEmail = "",
  caseManagerPhone = "",
  isRevision = false,
} = {}) => {
  const normalizeInlineText = value => String(value || "").replace(/\s+/g, " ").trim();
  const approvedTotal = (Array.isArray(interventions) ? interventions : []).reduce((sum, intervention) => {
    const lines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
    return sum + lines.reduce((lineSum, line) => {
      const amount = parseCurrencyToNumber(line?.amount);
      return lineSum + (amount > 0 ? amount : 0);
    }, 0);
  }, 0);
  const institutionSet = new Set();
  const programSet = new Set();
  const termSet = new Set();
  const nwacFundingBreakdownLines = [];
  (Array.isArray(interventions) ? interventions : []).forEach(intervention => {
    const institution = String(intervention?.institution || "").trim();
    const program = String(intervention?.programName || "").trim();
    if (institution) institutionSet.add(institution);
    if (program) programSet.add(program);
    const term = formatInterventionDates(intervention?.startDate, intervention?.endDate);
    if (term && term !== "—") termSet.add(term);
    const costLines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
    costLines.forEach(line => {
      const amount = parseCurrencyToNumber(line?.amount);
      if (!(amount > 0)) return;
      const lineLabel = formatCostTypeForLetter(line?.type);
      const payee = line?.payee && typeof line.payee === "object" ? line.payee : {};
      const payeeType = String(payee.type || deriveDefaultPayeeTypeForCostLine(line?.type) || "").trim();
      const explicitPayeeName = normalizeInlineText(payee.name || "");
      const defaultPayeeName = normalizeInlineText(
        deriveDefaultPayeeNameForCostLine(payeeType, intervention, applicantName || "")
      );
      const payeeName = explicitPayeeName || defaultPayeeName;
      const payeeTypeKey = normalizePayeeTypeKey(payeeType);
      const payeePhrase = (() => {
        if (payeeName) return payeeName;
        if (payeeTypeKey === "participantclient" || payeeTypeKey === "client") return applicantName || "the student";
        const target = PAYEE_TYPE_DETAIL_TARGET_BY_KEY[payeeTypeKey] || "";
        return target ? `the ${target}` : "the approved payee";
      })();
      const termLabel = term && term !== "—" ? term : "";
      nwacFundingBreakdownLines.push(
        `- ${lineLabel}: $${Number(amount).toFixed(2)} payable to ${payeePhrase}${termLabel ? ` (Term/Dates: ${termLabel})` : ""}`
      );
    });
  });
  const institutionText = institutionSet.size ? Array.from(institutionSet).join("; ") : "the approved training institution";
  const programText = programSet.size ? Array.from(programSet).join("; ") : "the approved program";
  const termText = termSet.size ? Array.from(termSet).join("; ") : "the approved term(s)";
  const signatureBlock = formatCaseManagerSignatureLines({
    caseManagerName,
    caseManagerEmail,
    caseManagerPhone,
  });

  return (Array.isArray(fundingSources) ? fundingSources : [])
    .map((source, index) => {
      const funderName = String(source?.name || "").trim();
      if (!funderName) return null;
      const funderTypeLabel = resolveOtherFunderTypeLabel(source?.type);
      const sourceCoverage = String(source?.coverage || "").trim();
      const body = [
        isRevision ? "Funding Revision Letter (Other Funding Source)" : "Letter of Approval (Other Funding Source)",
        `Date: ${decisionDate || ""}`,
        "",
        funderName,
        "",
        "To Whom It May Concern,",
        "",
        isRevision
          ? `I am writing to let you know that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, has approved a revision to the funding for ${applicantName || "the student"} for ${termText} in ${programText} at ${institutionText}.`
          : `I am writing to let you know that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, will be funding ${applicantName || "the student"} for ${termText} in ${programText} at ${institutionText}.`,
        "",
        approvedTotal > 0
          ? isRevision
            ? `The revised approved NWAC funding is $${Number(approvedTotal).toFixed(2)} for eligible costs under this intervention plan, which will be paid directly to approved payees as specified in the assessment.`
            : `I have approved funding in the amount of $${Number(approvedTotal).toFixed(2)} for eligible costs under this intervention plan, which will be paid directly to approved payees as specified in the assessment.`
          : isRevision
            ? "The approved NWAC funding for eligible costs under this intervention plan has been revised and will be paid directly to approved payees as specified in the assessment."
            : "I have approved funding for eligible costs under this intervention plan, which will be paid directly to approved payees as specified in the assessment.",
        nwacFundingBreakdownLines.length ? "" : null,
        nwacFundingBreakdownLines.length ? (isRevision ? "Revised NWAC funding breakdown:" : "NWAC funding breakdown:") : null,
        nwacFundingBreakdownLines.length ? nwacFundingBreakdownLines.join("\n") : null,
        "",
        `As documented in the assessment records, ${funderName} (${funderTypeLabel}) is identified as funding the following:`,
        sourceCoverage ? `- ${normalizeInlineText(sourceCoverage)}` : "- Funding details to be confirmed through your office.",
        nwacCoverage ? `- NWAC coverage summary: ${normalizeInlineText(nwacCoverage)}` : "",
        notes ? `- Coordination notes: ${normalizeInlineText(notes)}` : "",
        trackingReference ? `- File reference: ${normalizeInlineText(trackingReference)}` : "",
        "",
        "If you have any questions, please do not hesitate to contact me directly.",
        "",
        "Sincerely,",
        signatureBlock,
      ]
        .map(line => (line === null || typeof line === "undefined" ? "" : String(line)))
        .join("\n");
      return {
        id: source?.id || `funder-${index + 1}`,
        recipientName: funderName,
        title: isRevision
          ? `Other Funding Source Revision Letter — ${funderName}`
          : `Other Funding Source Letter — ${funderName}`,
        fileName: `other-funding-source-letter-${toSafeFileToken(funderName, `recipient-${index + 1}`)}.txt`,
        body,
      };
    })
    .filter(Boolean);
};

const buildLoanProviderApprovalLetters = ({
  interventions = [],
  applicantName = "",
  trackingReference = "",
  decisionDate = "",
  caseManagerName = "",
  caseManagerEmail = "",
  caseManagerPhone = "",
  isRevision = false,
} = {}) => {
  const normalizeInlineText = value => String(value || "").replace(/\s+/g, " ").trim();
  const formatCurrency = value => `$${Number(value || 0).toFixed(2)}`;
  const groupedLetters = new Map();

  (Array.isArray(interventions) ? interventions : []).forEach(intervention => {
    const termLabel = formatInterventionDates(intervention?.startDate, intervention?.endDate);
    const costLines = Array.isArray(intervention?.costLines) ? intervention.costLines : [];
    costLines.forEach((line, lineIndex) => {
      if (normalizePaymentTypeCode(line?.type) !== "StudentLoanRepayment") return;
      const amount = parseCurrencyToNumber(line?.amount);
      if (!(amount > 0)) return;
      const payee = line?.payee && typeof line.payee === "object" ? line.payee : {};
      const payeeType = String(payee.type || deriveDefaultPayeeTypeForCostLine(line?.type) || "").trim();
      const explicitPayeeName = normalizeInlineText(payee.name || "");
      const defaultPayeeName = normalizeInlineText(
        deriveDefaultPayeeNameForCostLine(payeeType, intervention, applicantName || "")
      );
      const payeeName = explicitPayeeName || defaultPayeeName || "Student loan provider";
      const accountNumber = normalizeInlineText(payee.reference || "");
      const groupKey = `${payeeName.toLowerCase()}::${accountNumber.toLowerCase() || "no-account"}`;
      if (!groupedLetters.has(groupKey)) {
        groupedLetters.set(groupKey, {
          payeeName,
          accountNumber,
          totalAmount: 0,
          lineItems: [],
        });
      }
      const target = groupedLetters.get(groupKey);
      target.totalAmount += amount;
      target.lineItems.push({
        id: `${intervention?.id || "intervention"}-${line?.id || lineIndex + 1}`,
        label: formatCostTypeForLetter(line?.type),
        amount,
        termLabel: termLabel && termLabel !== "—" ? termLabel : "",
      });
    });
  });

  const signatureBlock = formatCaseManagerSignatureLines({
    caseManagerName,
    caseManagerEmail,
    caseManagerPhone,
  });

  return Array.from(groupedLetters.values()).map((item, index) => {
    const applicantPossessive = applicantName ? `${applicantName}'s` : "the participant's";
    const fundingLines = item.lineItems.map(line =>
      `- ${line.label}: ${formatCurrency(line.amount)}${line.termLabel ? ` (Term/Dates: ${line.termLabel})` : ""}`
    );
    const body = [
      isRevision ? "Funding Revision Letter (Loan Provider)" : "Letter of Approval (Loan Provider)",
      `Date: ${decisionDate || ""}`,
      "",
      item.payeeName,
      "",
      "To Whom It May Concern,",
      "",
      isRevision
        ? `This letter is to formally confirm that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, has approved a revision to the repayment support for ${applicantPossessive} eligible student loan. The revised total amount is ${formatCurrency(item.totalAmount)}. Please apply this payment to the repayable portion of the account noted below.`
        : `This letter is to formally confirm that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, will repay a portion of ${applicantPossessive} eligible student loan in the total amount of ${formatCurrency(item.totalAmount)}. Please apply this payment to the repayable portion of the account noted below.`,
      "",
      `Student Name: ${applicantName || "Student"}`,
      item.accountNumber
        ? `Loan Account Number: ${item.accountNumber}`
        : "Loan Account Number: To be confirmed by case manager",
      trackingReference ? `File Reference: ${normalizeInlineText(trackingReference)}` : null,
      fundingLines.length ? "" : null,
      fundingLines.length ? (isRevision ? "Revised approved repayment lines:" : "Approved repayment lines:") : null,
      fundingLines.length ? fundingLines.join("\n") : null,
      "",
      "If there is an overpayment, or if the participant withdraws from the approved program, any refunded funds must be returned directly to the NWAC ISET Program and not to the participant.",
      "",
      "Please let me know if you have any questions.",
      "",
      "Sincerely,",
      signatureBlock,
    ]
      .map(line => (line === null || typeof line === "undefined" ? "" : String(line)))
      .join("\n");
    return {
      id: `loan-provider-${index + 1}`,
      recipientName: item.payeeName,
      title: isRevision
        ? `Loan Provider Revision Letter — ${item.payeeName}`
        : `Loan Provider Letter — ${item.payeeName}`,
      fileName: `loan-provider-letter-${toSafeFileToken(item.payeeName, `recipient-${index + 1}`)}.txt`,
      body,
    };
  });
};

const formatDate = value => {
  if (!value) return "";
  if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const parseIsoDateToUtc = value => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\//g, "-");
  const parts = normalized.split("-");
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts.map(part => Number.parseInt(part, 10));
  if (![yyyy, mm, dd].every(Number.isFinite)) return null;
  return Date.UTC(yyyy, mm - 1, dd);
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatShortDate = value => {
  const normalized = formatDate(value);
  if (!normalized) return "";
  const [yyyy, mm, dd] = normalized.split("-");
  const monthIndex = Number(mm) - 1;
  if (!yyyy || !dd || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return "";
  const monthLabel = MONTH_LABELS[monthIndex];
  return `${dd.padStart(2, "0")} ${monthLabel} ${yyyy}`;
};

const formatInterventionDates = (startDate, endDate) => {
  const normalizedStart = formatDate(startDate);
  const normalizedEnd = formatDate(endDate);
  const start = formatShortDate(normalizedStart);
  const end = formatShortDate(normalizedEnd);
  if (!start) return "—";
  if (!end || (normalizedStart && normalizedStart === normalizedEnd)) return start;
  return `${start}-${end}`;
};

const calculateDurationDays = (start, end) => {
  const startUtc = parseIsoDateToUtc(start);
  const endUtc = parseIsoDateToUtc(end);
  if (startUtc === null || endUtc === null) return null;
  const diff = Math.round((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff;
};

const addMonthsUtc = (startDate, monthsToAdd) => {
  const startUtc = parseIsoDateToUtc(startDate);
  if (startUtc === null) return "";
  const base = new Date(startUtc);
  const monthIndex = base.getUTCMonth() + monthsToAdd;
  base.setUTCMonth(monthIndex);
  if (Number.isNaN(base.getTime())) return "";
  return base.toISOString().slice(0, 10);
};

const deriveEndDateFromOccurrences = (startDate, occurrences) => {
  if (!startDate || !Number.isFinite(occurrences) || occurrences <= 0) return "";
  return addMonthsUtc(startDate, occurrences - 1);
};

const resolveCaseContext = caseData => {
  if (caseData?.caseContext && typeof caseData.caseContext === "object") {
    return caseData.caseContext;
  }
  if (caseData?.case_context && typeof caseData.case_context === "object") {
    return caseData.case_context;
  }
  const rawContext = caseData?.case_context_json;
  if (typeof rawContext === "string" && rawContext.trim()) {
    try {
      const parsed = JSON.parse(rawContext);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (_) {
      return {};
    }
  }
  return {};
};

const autoOccurrencesFromDates = (startDate, endDate, period) => {
  if (!startDate || !endDate || !period) return null;
  const startUtc = parseIsoDateToUtc(startDate);
  const endUtc = parseIsoDateToUtc(endDate);
  if (startUtc === null || endUtc === null || endUtc < startUtc) return null;
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const monthCount =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;
  if (period === "monthly") return Math.max(1, monthCount);
  if (period === "quarterly") return Math.max(1, Math.ceil(monthCount / 3));
  const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(diffDays) || diffDays < 1) return null;
  const periodDays = period === "bi_weekly" ? 14 : period === "weekly" ? 7 : null;
  if (!periodDays) return null;
  return Math.max(1, Math.ceil(diffDays / periodDays));
};

const mergeRecurrenceDefaults = (base, overrides = {}) => {
  const pick = (value, fallback) =>
    value === "" || value === null || typeof value === "undefined" ? fallback : value;
  return {
    ...base,
    ...overrides,
    startDate: pick(overrides.startDate, base.startDate),
    endDate: pick(overrides.endDate, base.endDate),
    occurrences: pick(overrides.occurrences, base.occurrences),
    amountPerPeriod: pick(overrides.amountPerPeriod, base.amountPerPeriod),
  };
};

const buildUuid = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalizeOtherFundingInvolved = value => {
  if (value === null || typeof value === "undefined") return "";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "yes") return "yes";
  if (normalized === "no") return "no";
  if (normalized === "unknown") return "unknown";
  return "";
};

const normalizeOtherFunderType = value => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return "other";
  if (OTHER_FUNDER_TYPE_VALUE_SET.has(normalized)) return normalized;
  return "other";
};

const buildEmptyOtherFundingSource = (overrides = {}) => {
  const base = {
    id: overrides.id || buildUuid(),
    name: "",
    type: "other",
    coverage: "",
    ...overrides,
  };
  return {
    ...base,
    type: normalizeOtherFunderType(base.type || "other"),
  };
};

const buildOtherFundingSourceModalState = (overrides = {}) => ({
  visible: false,
  mode: "add",
  sourceId: null,
  draft: buildEmptyOtherFundingSource(),
  original: null,
  ...overrides,
});

const validateOtherFundingSourceDraft = draft => {
  const next = buildEmptyOtherFundingSource(draft || {});
  const errors = {};
  if (!String(next.name || "").trim()) {
    errors.name = "Funder name is required.";
  }
  if (!String(next.coverage || "").trim()) {
    errors.coverage = "Coverage details are required.";
  }
  return errors;
};

const normalizeOtherFundingSources = (value, { keepEmpty = false, preserveWhitespace = false } = {}) => {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const rawName = String(entry.name || "");
      const rawCoverage = String(entry.coverage || "");
      const normalized = buildEmptyOtherFundingSource({
        id: entry.id || buildUuid(),
        name: preserveWhitespace ? rawName : rawName.trim(),
        type: entry.type || "other",
        coverage: preserveWhitespace ? rawCoverage : rawCoverage.trim(),
      });
      const hasValues = rawName.trim() || rawCoverage.trim();
      return hasValues || keepEmpty ? normalized : null;
    })
    .filter(Boolean);
};

const normalizeOtherFundingDetails = (rawDetails, options = {}) => {
  const source = rawDetails && typeof rawDetails === "object" ? rawDetails : {};
  const keepEmptySources = Boolean(options.keepEmptySources);
  const preserveWhitespace = Boolean(options.preserveWhitespace);
  const involved = normalizeOtherFundingInvolved(source.involved);
  const populatedSources = normalizeOtherFundingSources(
    source.sources,
    { preserveWhitespace }
  );
  const sources = keepEmptySources
    ? normalizeOtherFundingSources(
        source.sources,
        { keepEmpty: true, preserveWhitespace }
      )
    : populatedSources;
  const rawNwacCoverage = String(source.nwacCoverage || "");
  const nwacCoverage = preserveWhitespace ? rawNwacCoverage : rawNwacCoverage.trim();
  const rawNotes = String(source.notes || "");
  const notes = preserveWhitespace ? rawNotes : rawNotes.trim();

  const resolvedInvolved =
    involved ||
    (populatedSources.length || String(nwacCoverage || "").trim() || String(notes || "").trim() ? "yes" : "");

  return {
    involved: resolvedInvolved,
    sources,
    nwacCoverage,
    notes,
  };
};

const normalizeId = value => {
  if (value === null || typeof value === "undefined") return "";
  return String(value);
};

const idsMatch = (left, right) => {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);
  if (!leftId || !rightId) return false;
  return leftId === rightId;
};

const parseCurrencyInput = value => {
  if (value === null || typeof value === "undefined") return null;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
};

const parseCurrencyToNumber = value => {
  if (value === null || typeof value === "undefined") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.+-]/g, "");
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrencyDisplay = value => {
  const num = parseCurrencyInput(value);
  if (num === null) return "";
  return `$ ${num.toFixed(2)}`;
};

const sanitizeCurrencyInput = value => {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const [whole, ...rest] = cleaned.split(".");
  const decimals = rest.join("").slice(0, 2);
  return decimals.length ? `${whole}.${decimals}` : whole;
};

const recalcRecurringAmounts = ({ amount, amountPerPeriod, occurrences, adjustMode }) => {
  const occ = Number(occurrences);
  if (!Number.isFinite(occ) || occ <= 0) {
    return { amount, amountPerPeriod };
  }
  const totalValue = parseCurrencyInput(amount);
  const perPeriodValue = parseCurrencyInput(amountPerPeriod);
  const normalize = value => (value === null || typeof value === "undefined" ? "" : formatCurrencyDisplay(value));
  if (adjustMode === "total") {
    if (Number.isFinite(perPeriodValue)) {
      return { amount: normalize(perPeriodValue * occ), amountPerPeriod };
    }
    if (Number.isFinite(totalValue)) {
      return { amount, amountPerPeriod: normalize(totalValue / occ) };
    }
    return { amount, amountPerPeriod };
  }
  if (Number.isFinite(totalValue)) {
    return { amount, amountPerPeriod: normalize(totalValue / occ) };
  }
  if (Number.isFinite(perPeriodValue)) {
    return { amount: normalize(perPeriodValue * occ), amountPerPeriod };
  }
  return { amount, amountPerPeriod };
};

const normalizeInterventionCodeValue = value => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const RECURRENCE_MODE_REQUIRED = "required";
const RECURRENCE_MODE_OPTIONAL = "optional";
const RECURRENCE_MODE_NOT_ALLOWED = "not_allowed";
const SUBMISSION_TIMING_INTERVENTION_START = "intervention_start";
const SUBMISSION_TIMING_INTERVENTION_END = "intervention_end";
const SUBMISSION_TIMING_RECURRENCE_SCHEDULE = "recurrence_schedule";
const SUBMISSION_TIMING_MANUAL_TRIGGER = "manual_trigger";
const DEFAULT_SUBMISSION_TIMING_BY_TYPE = {
  LivingAllowance: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  TuitionFeesDirect: SUBMISSION_TIMING_INTERVENTION_START,
  TuitionFeesReimbursement: SUBMISSION_TIMING_INTERVENTION_END,
  SpecializedEquipmentAdvance: SUBMISSION_TIMING_INTERVENTION_START,
  SpecializedEquipmentReimbursement: SUBMISSION_TIMING_INTERVENTION_END,
  WageSubsidyEmployer: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  Childcare: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  Transportation: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  BooksMaterialsDirect: SUBMISSION_TIMING_INTERVENTION_START,
  BooksMaterialsReimbursement: SUBMISSION_TIMING_INTERVENTION_END,
  JCPProjectCost: SUBMISSION_TIMING_MANUAL_TRIGGER,
  SEBSupport: SUBMISSION_TIMING_RECURRENCE_SCHEDULE,
  OtherEligibleCost: SUBMISSION_TIMING_MANUAL_TRIGGER,
};
const PAYMENT_TYPE_ALIASES = {
  wagesubsidyemployer: "WageSubsidyEmployer",
  wagesubsidy: "WageSubsidyEmployer",
  targetedwagesubsidyemployer: "WageSubsidyEmployer",
  targetedwagesubsidy: "WageSubsidyEmployer",
};
const PAYEE_TYPE_PARTICIPANT_CLIENT = "ParticipantClient";
const PAYEE_TYPES_DEFAULT_FROM_INTERVENTION = new Set([
  "AccreditedEducationalTrainingInstitution",
  "EmployerWageSubsidyPartner",
  "CommunityNonProfitOrganization",
]);
const PAYMENT_TYPE_DEFAULT_PAYEE_TYPE = {
  LivingAllowance: PAYEE_TYPE_PARTICIPANT_CLIENT,
  TuitionFeesReimbursement: PAYEE_TYPE_PARTICIPANT_CLIENT,
  SpecializedEquipmentReimbursement: PAYEE_TYPE_PARTICIPANT_CLIENT,
  Transportation: PAYEE_TYPE_PARTICIPANT_CLIENT,
  BooksMaterialsReimbursement: PAYEE_TYPE_PARTICIPANT_CLIENT,
  TuitionFeesDirect: "AccreditedEducationalTrainingInstitution",
  WageSubsidyEmployer: "EmployerWageSubsidyPartner",
  Childcare: "ChildcareProvider",
  BooksMaterialsDirect: "TrainingRelatedSupplier",
  SpecializedEquipmentAdvance: "TrainingRelatedSupplier",
  JCPProjectCost: "CommunityNonProfitOrganization",
  StudentLoanRepayment: "StudentLoanServicer",
};
const normalizePayeeTypeKey = value =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
const PAYEE_TYPE_DETAIL_TARGET_BY_KEY = {
  participantclient: "client",
  client: "client",
  vendor: "vendor",
  traininginstitution: "institution",
  traininginstitute: "institution",
  traininginstitue: "institution",
  accreditededucationaltraininginstitution: "institution",
  employer: "employer",
  employerwagesubsidypartner: "employer",
  childcareprovider: "childcare provider",
  communitynonprofitorganization: "community organization",
  trainingrelatedsupplier: "supplier",
  professionalbusinessservicesprovider: "service provider",
  studentloanservicer: "student loan provider",
  other: "other payee",
};

const normalizePaymentTypeCode = value => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return PAYMENT_TYPE_ALIASES[key] || raw;
};
const deriveDefaultPayeeTypeForCostLine = costLineType => {
  const normalizedType = normalizePaymentTypeCode(costLineType);
  if (!normalizedType) return "";
  return PAYMENT_TYPE_DEFAULT_PAYEE_TYPE[normalizedType] || "";
};
const deriveDefaultPayeeNameForCostLine = (payeeType, intervention, participantLegalName) => {
  const normalizedType = String(payeeType || "").trim();
  if (!normalizedType) return "";
  if (normalizedType === PAYEE_TYPE_PARTICIPANT_CLIENT) {
    return participantLegalName || "";
  }
  if (PAYEE_TYPES_DEFAULT_FROM_INTERVENTION.has(normalizedType)) {
    return String(intervention?.institution || "").trim();
  }
  return "";
};
const applyCostLinePayeeDefaults = (draft, intervention, participantLegalName, options = {}) => {
  if (!draft || typeof draft !== "object") return draft;
  const { allowTypeAutofill = true } = options;
  const payee = draft.payee && typeof draft.payee === "object" ? draft.payee : {};
  let payeeType = String(payee.type || "").trim();
  if (!payeeType && allowTypeAutofill) {
    payeeType = deriveDefaultPayeeTypeForCostLine(draft.type);
  }
  const existingName = String(payee.name || "").trim();
  const defaultName = deriveDefaultPayeeNameForCostLine(payeeType, intervention, participantLegalName);
  const nextPayee = {
    type: payeeType,
    name: existingName,
    reference: String(payee.reference || "").trim(),
  };
  if (payeeType === PAYEE_TYPE_PARTICIPANT_CLIENT) {
    nextPayee.name = defaultName || existingName;
    nextPayee.reference = "";
  } else if (!nextPayee.name && defaultName) {
    nextPayee.name = defaultName;
  }
  return { ...draft, payee: nextPayee };
};

const normalizeRecurrenceMode = value => {
  if (typeof value !== "string") return RECURRENCE_MODE_NOT_ALLOWED;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === RECURRENCE_MODE_REQUIRED) return RECURRENCE_MODE_REQUIRED;
  if (normalized === RECURRENCE_MODE_OPTIONAL) return RECURRENCE_MODE_OPTIONAL;
  if (normalized === RECURRENCE_MODE_NOT_ALLOWED || normalized === "disabled") {
    return RECURRENCE_MODE_NOT_ALLOWED;
  }
  return RECURRENCE_MODE_NOT_ALLOWED;
};

const normalizeSubmissionTiming = value => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === SUBMISSION_TIMING_INTERVENTION_START) return SUBMISSION_TIMING_INTERVENTION_START;
  if (normalized === SUBMISSION_TIMING_INTERVENTION_END) return SUBMISSION_TIMING_INTERVENTION_END;
  if (normalized === SUBMISSION_TIMING_RECURRENCE_SCHEDULE) return SUBMISSION_TIMING_RECURRENCE_SCHEDULE;
  if (normalized === SUBMISSION_TIMING_MANUAL_TRIGGER) return SUBMISSION_TIMING_MANUAL_TRIGGER;
  return null;
};

const buildPaymentTypeMappingLookup = mapping => {
  const lookup = new Map();
  if (!mapping || !Array.isArray(mapping.interventions)) return lookup;
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

const normalizePaymentTypeMappingPayload = payload => {
  if (!payload || typeof payload !== "object") {
    return { enabled: false, paymentTypes: [], payeeTypes: [], interventions: [] };
  }
  const paymentTypesRaw = Array.isArray(payload.paymentTypes)
    ? payload.paymentTypes
    : Array.isArray(payload.payment_types)
      ? payload.payment_types
      : [];
  const payeeTypesRaw = Array.isArray(payload.payeeTypes)
    ? payload.payeeTypes
    : Array.isArray(payload.payee_types)
      ? payload.payee_types
      : [];
  const paymentTypes = paymentTypesRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const code = normalizePaymentTypeCode(
        entry.code || entry.value || entry.paymentType || entry.payment_type,
      );
      if (!code) return null;
      return {
        code,
        label:
          typeof entry.label === "string" && entry.label.trim()
            ? entry.label.trim()
            : typeof entry.name === "string" && entry.name.trim()
              ? entry.name.trim()
              : code,
        submissionTiming: normalizeSubmissionTiming(
          entry.submissionTiming || entry.submission_timing,
        ),
      };
    })
    .filter(Boolean);
  const payeeTypes = payeeTypesRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const codeRaw = entry.code || entry.value || entry.payeeType || entry.payee_type;
      const code = typeof codeRaw === "string" ? codeRaw.trim() : "";
      if (!code) return null;
      return {
        code,
        label:
          typeof entry.label === "string" && entry.label.trim()
            ? entry.label.trim()
            : typeof entry.name === "string" && entry.name.trim()
              ? entry.name.trim()
              : code,
        description:
          typeof entry.description === "string" && entry.description.trim()
            ? entry.description.trim()
            : typeof entry.helpText === "string" && entry.helpText.trim()
              ? entry.helpText.trim()
              : null,
      };
    })
    .filter(Boolean);
  const interventionsRaw = Array.isArray(payload.interventions) ? payload.interventions : [];
  const interventions = interventionsRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const code = normalizeInterventionCodeValue(
        entry.code || entry.interventionCode || entry.intervention_code,
      );
      if (!code) return null;
      const typesRaw =
        entry.availablePaymentTypes ||
        entry.available_payment_types ||
        entry.paymentTypes ||
        entry.payment_types ||
        [];
      const types = Array.isArray(typesRaw)
        ? Array.from(new Set(typesRaw.map(value => String(value || "").trim()).filter(Boolean)))
        : [];
      return {
        code,
        name: entry.name || entry.label || null,
        availablePaymentTypes: types,
      };
    })
    .filter(Boolean);
  return {
    enabled: payload.enabled !== false,
    paymentTypes,
    payeeTypes,
    interventions,
  };
};

const normalizeCostingDefaults = payload => {
  if (!payload || payload.enabled === false) return { enabled: false };
  const interventionsRaw = Array.isArray(payload.interventions) ? payload.interventions : [];
  const paymentTypesRaw = Array.isArray(payload.paymentTypes) ? payload.paymentTypes : [];
  const interventions = interventionsRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const code = normalizeInterventionCodeValue(entry.code || entry.interventionCode || entry.intervention_code);
      if (!code) return null;
      const suggested = Array.isArray(entry.suggested || entry.suggestedItems || entry.suggested_items)
        ? entry.suggested || entry.suggestedItems || entry.suggested_items
        : [];
      const normalizedSuggested = suggested
        .map(item => {
          if (typeof item === "string") return { type: item };
          if (item && typeof item === "object") {
            return {
              type: normalizePaymentTypeCode(item.type || item.paymentType || item.payment_type) || "",
              notes: item.notes || "",
              recurrenceEnabled: typeof item.recurrenceEnabled === "boolean" ? item.recurrenceEnabled : undefined,
            };
          }
          return null;
        })
        .filter(item => item && item.type);
      return {
        code,
        suggested: normalizedSuggested,
      };
    })
    .filter(Boolean);
  const paymentTypes = paymentTypesRaw
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const code = normalizePaymentTypeCode(entry.code || entry.paymentType || entry.payment_type);
      if (!code) return null;
      const recurrence = entry.recurrence && typeof entry.recurrence === "object" ? entry.recurrence : {};
      return {
        code,
        recurrence: {
          mode: normalizeRecurrenceMode(
            recurrence.mode || recurrence.rule || entry.recurrenceMode || entry.recurrence_mode,
          ),
        },
      };
    })
    .filter(Boolean);
  return {
    enabled: payload.enabled !== false,
    strategy: payload.strategy || "allowed",
    interventions,
    paymentTypes,
  };
};

const buildEmptyCostLine = overrides => ({
  id: buildUuid(),
  type: "",
  amount: "",
  notes: "",
  payee: {
    type: "",
    name: "",
    reference: "",
  },
  recurrence: {
    enabled: false,
    startDate: "",
    endDate: "",
    occurrences: "",
    amountPerPeriod: "",
  },
  ...(overrides || {}),
});

const buildEmptyIntervention = overrides => ({
  id: buildUuid(),
  code: "",
  startDate: "",
  endDate: "",
  deliveryMode: "partner",
  institution: "",
  programName: "",
  itpDetails: "",
  wageSubsidyDetails: "",
  interventionNoc: "",
  interventionNocVersion: "",
  suggestionsSeeded: false,
  costLines: [],
  ...(overrides || {}),
});

const normalizeCostLine = raw => {
  if (!raw || typeof raw !== "object") return null;
  const recurrenceRaw = raw.recurrence && typeof raw.recurrence === "object" ? raw.recurrence : {};
  const payeeRaw = raw.payee && typeof raw.payee === "object" ? raw.payee : {};
  return {
    id: raw.id || buildUuid(),
    type: normalizePaymentTypeCode(raw.type || raw.paymentType || raw.payment_type) || "",
    amount:
      raw.amount === null || typeof raw.amount === "undefined"
        ? ""
        : String(raw.amount),
    notes: raw.notes || raw.description || "",
    payee: {
      type: String(payeeRaw.type || raw.payeeType || raw.payee_type || "").trim(),
      name: String(payeeRaw.name || raw.payeeName || raw.payee_name || "").trim(),
      reference: String(payeeRaw.reference || raw.payeeReference || raw.payee_reference || "").trim(),
    },
    recurrence: {
      enabled: Boolean(recurrenceRaw.enabled),
      startDate: recurrenceRaw.startDate || "",
      endDate: recurrenceRaw.endDate || "",
      occurrences:
        recurrenceRaw.occurrences === null || typeof recurrenceRaw.occurrences === "undefined"
          ? ""
          : String(recurrenceRaw.occurrences),
      amountPerPeriod:
        recurrenceRaw.amountPerPeriod === null || typeof recurrenceRaw.amountPerPeriod === "undefined"
          ? ""
          : String(recurrenceRaw.amountPerPeriod),
    },
  };
};

const hasApprovedFundingAmount = line => {
  if (!line || typeof line !== "object") return false;
  const totalAmount = parseCurrencyInput(line.amount);
  if (totalAmount !== null && totalAmount > 0) return true;
  const recurrence = line.recurrence && typeof line.recurrence === "object" ? line.recurrence : {};
  const amountPerPeriod = parseCurrencyInput(recurrence.amountPerPeriod);
  return amountPerPeriod !== null && amountPerPeriod > 0;
};

const normalizeProposedIntervention = raw => {
  if (!raw || typeof raw !== "object") return null;
  const costLines = Array.isArray(raw.costLines)
    ? raw.costLines.map(normalizeCostLine).filter(Boolean)
    : [];
  return {
    id: raw.id || buildUuid(),
    code: raw.code || "",
    startDate: raw.startDate || "",
    endDate: raw.endDate || "",
    deliveryMode: raw.deliveryMode === "in_house" ? "in_house" : "partner",
    institution: raw.institution || "",
    programName: raw.programName || "",
    itpDetails: raw.itpDetails || "",
    wageSubsidyDetails: raw.wageSubsidyDetails || "",
    interventionNoc: raw.interventionNoc || raw.interventionNocCode || raw.intervention_noc || "",
    interventionNocVersion: raw.interventionNocVersion || raw.interventionNocVersionCode || "",
    suggestionsSeeded: Boolean(raw.suggestionsSeeded),
    costLines,
  };
};

const normalizeProposedInterventions = raw => {
  const list = Array.isArray(raw) ? raw : [];
  const normalized = list.map(normalizeProposedIntervention).filter(Boolean);
  return normalized.length ? normalized : [];
};

const normalizeRevisionContext = raw => {
  if (!raw || typeof raw !== "object") return null;
  const sourceInterventionId = raw.sourceInterventionId || raw.source_intervention_id || null;
  if (!sourceInterventionId) return null;
  const sourceActionPlanId = raw.sourceActionPlanId || raw.source_action_plan_id || null;
  return {
    kind: raw.kind || "approved_intervention",
    sourceInterventionId: String(sourceInterventionId),
    sourceActionPlanId: sourceActionPlanId ? String(sourceActionPlanId) : "",
    sourceStatus: normalizeInterventionStatus(raw.sourceStatus || raw.source_status, null),
    sourceTitle: raw.sourceTitle || raw.source_title || "Intervention",
    openedAt: raw.openedAt || raw.opened_at || null,
  };
};

const isRecurrenceScheduleComplete = line => {
  const recurrence = line?.recurrence || {};
  if (!recurrence.enabled) return false;
  const startDate = formatDate(recurrence.startDate);
  if (!startDate) return false;
  const occurrencesValue =
    recurrence.occurrences === "" || recurrence.occurrences === null || typeof recurrence.occurrences === "undefined"
      ? null
      : Number(recurrence.occurrences);
  const occurrences = Number.isFinite(occurrencesValue) ? occurrencesValue : null;
  if (!occurrences || occurrences <= 0) return false;
  const endDate = formatDate(recurrence.endDate) || deriveEndDateFromOccurrences(startDate, occurrences);
  if (!endDate) return false;
  const startUtc = parseIsoDateToUtc(startDate);
  const endUtc = parseIsoDateToUtc(endDate);
  if (startUtc !== null && endUtc !== null && endUtc < startUtc) return false;
  return true;
};

const InterventionAssessmentWidget = ({ actions, metadata = {}, toggleHelpPanel }) => {
  const currentUser = useCurrentUser();
  const {
    caseId: workspaceCaseId,
    caseData,
    refresh,
    updateActionPlan,
    createIntervention,
    deleteIntervention: deleteInterventionRecord,
    updateIntervention: updateInterventionRecord,
    interventionCodes,
    interventionCodesLoading,
    loadInterventionCodes,
    nocVersions,
    nocVersionsLoading,
    loadNocVersions,
    fundingStreams,
    fundingStreamsLoading,
    loadFundingStreams,
    selectedActionPlanId,
    setSelectedActionPlanId,
    selectedInterventionId,
    setSelectedInterventionId,
    getInterventionWizardStep,
    setInterventionWizardStep,
    getInterventionWizardDraft,
    setInterventionWizardDraft,
    clearInterventionWizardStep,
    clearInterventionWizardDraft,
  } = useCaseWorkspace();

  const [form, setForm] = useState(defaultFormState);
  const [currentStep, setCurrentStep] = useState(BASE_STEP_IDS[0]);
  const [attemptedSteps, setAttemptedSteps] = useState({});
  const [completionNote, setCompletionNote] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [hydratedDraftId, setHydratedDraftId] = useState(null);
  const [hydratedDraftUpdatedAt, setHydratedDraftUpdatedAt] = useState(null);
  const [currentInterventionStatus, setCurrentInterventionStatus] = useState(null);
  const [revisionContext, setRevisionContext] = useState(null);
  const [interventionModal, setInterventionModal] = useState({
    visible: false,
    mode: "view",
    interventionId: null,
    draft: null,
    original: null,
  });
  const [interventionModalErrors, setInterventionModalErrors] = useState({});
  const [interventionDeleteId, setInterventionDeleteId] = useState(null);
  const [otherFundingSourceModal, setOtherFundingSourceModal] = useState(() =>
    buildOtherFundingSourceModalState()
  );
  const [otherFundingSourceModalErrors, setOtherFundingSourceModalErrors] = useState({});
  const [proposedInterventionsTableVersion, setProposedInterventionsTableVersion] = useState(0);
  const [costLineModal, setCostLineModal] = useState({
    visible: false,
    mode: "view",
    interventionId: null,
    lineId: null,
    draft: null,
    original: null,
  });
  const [costLineModalErrors, setCostLineModalErrors] = useState({});
  const [costLineAmountFocused, setCostLineAmountFocused] = useState(false);
  const [costLineAmountPerPeriodFocused, setCostLineAmountPerPeriodFocused] = useState(false);
  const [inlineAmountEditingId, setInlineAmountEditingId] = useState(null);
  const [decisionBlockerVisible, setDecisionBlockerVisible] = useState(false);
  const [decisionBlockerReasons, setDecisionBlockerReasons] = useState([]);
  const [decisionBlockerTargetStep, setDecisionBlockerTargetStep] = useState(null);
  const [letterWorkflows, setLetterWorkflows] = useState({ approval: null, denial: null });
  const [letterWorkflowsLoading, setLetterWorkflowsLoading] = useState(false);
  const [letterWorkflowsError, setLetterWorkflowsError] = useState(null);
  const [approvalLetterPackTabId, setApprovalLetterPackTabId] = useState("client");
  const [approvalLetterPackGenerated, setApprovalLetterPackGenerated] = useState(false);
  const [clientLetterBody, setClientLetterBody] = useState("");
  const [sendingLetter, setSendingLetter] = useState(false);
  const [sendingLetterError, setSendingLetterError] = useState(null);
  const [showSendApprovalLetterConfirmModal, setShowSendApprovalLetterConfirmModal] = useState(false);
  const [eiVerificationFile, setEiVerificationFile] = useState(null);
  const [eiVerificationFileError, setEiVerificationFileError] = useState(null);
  const [eiVerificationUploadError, setEiVerificationUploadError] = useState(null);
  const [eiVerificationUploadSuccess, setEiVerificationUploadSuccess] = useState(null);
  const [eiVerificationUploading, setEiVerificationUploading] = useState(false);
  const [actionPlanFundingDraft, setActionPlanFundingDraft] = useState({
    fundingStream: "",
    budgetPot: "",
    postingContext: "external",
  });
  const [actionPlanFundingErrors, setActionPlanFundingErrors] = useState({});
  const [actionPlanFundingSaving, setActionPlanFundingSaving] = useState(false);
  const [actionPlanBudgetPotOptions, setActionPlanBudgetPotOptions] = useState([]);
  const [actionPlanBudgetPotLoading, setActionPlanBudgetPotLoading] = useState(false);
  const eiVerificationFileInputRef = useRef(null);
  const initialFormRef = useRef(defaultFormState);
  const wizardStepRestoreKeyRef = useRef(null);
  const wizardStepRestoreStepsRef = useRef(null);

  const caseId = useMemo(
    () => workspaceCaseId ?? caseData?.id ?? caseData?.case_id ?? null,
    [workspaceCaseId, caseData]
  );

  const applicantUserId = useMemo(
    () => caseData?.applicantUserId ?? caseData?.applicant_user_id ?? null,
    [caseData]
  );
  const participantLegalName = useMemo(() => {
    const caseContext = resolveCaseContext(caseData);
    const personal = caseContext.applicationPersonal && typeof caseContext.applicationPersonal === "object"
      ? caseContext.applicationPersonal
      : {};
    const answers = caseContext.applicationAnswers && typeof caseContext.applicationAnswers === "object"
      ? caseContext.applicationAnswers
      : {};
    const client = caseData?.client && typeof caseData.client === "object" ? caseData.client : {};
    const clientDetails = client.details && typeof client.details === "object" ? client.details : {};
    const normalizeNamePart = value => {
      if (value === null || typeof value === "undefined") return "";
      const trimmed = String(value).trim();
      return trimmed || "";
    };
    const buildFullName = (first, last) => {
      const firstName = normalizeNamePart(first);
      const lastName = normalizeNamePart(last);
      if (!firstName || !lastName) return "";
      return `${firstName} ${lastName}`;
    };
    const normalizeFullName = value => {
      const text = normalizeNamePart(value);
      if (!text) return "";
      return text.includes(" ") ? text : "";
    };
    const candidates = [
      normalizeFullName(caseData?.applicant_legal_name || caseData?.applicantLegalName),
      buildFullName(
        caseData?.submission_first_name || caseData?.submissionFirstName || caseData?.first_name || caseData?.firstName,
        caseData?.submission_last_name || caseData?.submissionLastName || caseData?.last_name || caseData?.lastName
      ),
      buildFullName(client.firstName, client.lastName),
      buildFullName(
        clientDetails.first_name || clientDetails.firstName || clientDetails.given_name || clientDetails.givenName,
        clientDetails.last_name || clientDetails.lastName || clientDetails.family_name || clientDetails.familyName
      ),
      buildFullName(
        caseContext.first_name || caseContext.firstName || caseContext.given_name || caseContext.givenName,
        caseContext.last_name || caseContext.lastName || caseContext.family_name || caseContext.familyName
      ),
      buildFullName(
        personal.first_name || personal.firstName || personal.given_name || personal.givenName,
        personal.last_name || personal.lastName || personal.family_name || personal.familyName
      ),
      buildFullName(
        answers["first-name"] || answers.first_name || answers["personal-first-name"] || answers.personal_first_name,
        answers["last-name"] || answers.last_name || answers["personal-last-name"] || answers.personal_last_name
      ),
      normalizeFullName(
        client.fullName || client.full_name || clientDetails.full_name || clientDetails.fullName || caseData?.applicant_name || caseData?.applicantName
      ),
    ];
    return candidates.find(Boolean) || "";
  }, [caseData]);
  const applicantSalutationName = useMemo(() => {
    const caseContext = resolveCaseContext(caseData);
    const personal = caseContext.applicationPersonal && typeof caseContext.applicationPersonal === "object"
      ? caseContext.applicationPersonal
      : {};
    const answers = caseContext.applicationAnswers && typeof caseContext.applicationAnswers === "object"
      ? caseContext.applicationAnswers
      : {};
    const normalize = value => {
      if (value === null || typeof value === "undefined") return "";
      return String(value).trim();
    };
    const firstToken = value => {
      const normalized = normalize(value);
      if (!normalized) return "";
      return normalized.split(/\s+/)[0] || "";
    };
    const preferredCandidates = [
      caseData?.preferred_name,
      caseData?.preferredName,
      caseContext.preferredName,
      caseContext.preferred_name,
      answers["preferred-name"],
      answers.preferred_name,
      personal.preferred_name,
      personal.preferredName,
    ];
    const preferred = preferredCandidates.map(normalize).find(Boolean);
    if (preferred) return preferred;
    const firstNameCandidates = [
      caseData?.submission_first_name,
      caseData?.submissionFirstName,
      caseData?.first_name,
      caseData?.firstName,
      caseContext.first_name,
      caseContext.firstName,
      personal.first_name,
      personal.firstName,
      answers["first-name"],
      answers.first_name,
      answers["personal-first-name"],
      answers.personal_first_name,
    ];
    const firstName = firstNameCandidates.map(normalize).find(Boolean);
    if (firstName) return firstName;
    return firstToken(participantLegalName);
  }, [caseData, participantLegalName]);
  const trackingReference = useMemo(() => {
    const candidates = [
      caseData?.agreementNumber,
      caseData?.caseNumber,
      caseData?.tracking_id,
      caseData?.trackingId,
      caseData?.submission_reference,
      caseData?.reference_number,
    ];
    return candidates.map(v => (typeof v === "string" ? v.trim() : v)).find(Boolean) || "";
  }, [caseData]);
  const currentUserName = useMemo(
    () => String(currentUser?.displayName || currentUser?.name || "").trim(),
    [currentUser]
  );
  const currentUserEmail = useMemo(
    () => String(currentUser?.email || "").trim(),
    [currentUser]
  );
  const applicationId = useMemo(
    () => caseData?.applicationId ?? caseData?.application_id ?? null,
    [caseData]
  );
  useEffect(() => {
    if (!participantLegalName) return;
    setCostLineModal(prev => {
      if (!prev?.visible || !prev?.draft) return prev;
      const payee = prev.draft.payee && typeof prev.draft.payee === "object" ? prev.draft.payee : {};
      if (String(payee.type || "").trim() !== PAYEE_TYPE_PARTICIPANT_CLIENT) return prev;
      if (String(payee.name || "").trim() === participantLegalName) return prev;
      return {
        ...prev,
        draft: {
          ...prev.draft,
          payee: {
            ...payee,
            name: participantLegalName,
          },
        },
      };
    });
  }, [participantLegalName]);

  const logWizard = useCallback(() => {}, []);

  const resolveStoredStep = useCallback(
    (key, stepIds = ALL_STEP_IDS) => {
      if (!key || typeof getInterventionWizardStep !== "function") return null;
      const stored = getInterventionWizardStep(key);
      if (!stored) return null;
      return stepIds.includes(stored) ? stored : null;
    },
    [getInterventionWizardStep]
  );

  const resolveStoredDraft = useCallback(
    key => {
      if (!key || typeof getInterventionWizardDraft !== "function") return null;
      const stored = getInterventionWizardDraft(key);
      return stored && typeof stored === "object" ? stored : null;
    },
    [getInterventionWizardDraft]
  );

  const hasMeaningfulDraft = useCallback(draft => {
    if (!draft || typeof draft !== "object") return false;
    if (Array.isArray(draft.proposedInterventions) && draft.proposedInterventions.length) return true;
    const textKeys = [
      "rationale",
      "otherFundingInvolved",
      "otherFundingNwacCoverage",
      "otherFundingNotes",
      "childcareNeed",
      "childcareFunding",
      "eiVerificationStatus",
      "decisionOutcome",
      "decisionNotes",
    ];
    if (textKeys.some(key => String(draft[key] || "").trim())) return true;
    if (Array.isArray(draft.otherFundingSources) && draft.otherFundingSources.length) return true;
    if (Array.isArray(draft.barriers) && draft.barriers.length) return true;
    return false;
  }, []);

  const mergeStoredDraft = useCallback((baseForm, storedDraft) => {
    if (!storedDraft) return baseForm;
    const merged = { ...baseForm, ...storedDraft };
    if (Array.isArray(storedDraft.proposedInterventions)) {
      merged.proposedInterventions = storedDraft.proposedInterventions;
    }
    const normalizedOtherFunding = normalizeOtherFundingDetails(
      {
        involved: merged.otherFundingInvolved,
        sources: merged.otherFundingSources,
        nwacCoverage: merged.otherFundingNwacCoverage,
        notes: merged.otherFundingNotes,
      },
      { keepEmptySources: true, preserveWhitespace: true }
    );
    merged.otherFundingInvolved = normalizedOtherFunding.involved;
    merged.otherFundingSources = normalizedOtherFunding.sources;
    merged.otherFundingNwacCoverage = normalizedOtherFunding.nwacCoverage;
    merged.otherFundingNotes = normalizedOtherFunding.notes;
    return merged;
  }, []);

  const activeInterventionId = useMemo(
    () => selectedInterventionId ?? selectedDraftId ?? hydratedDraftId ?? null,
    [selectedInterventionId, selectedDraftId, hydratedDraftId]
  );

  const activeInterventionIdValue = useMemo(
    () => (activeInterventionId ? String(activeInterventionId) : null),
    [activeInterventionId]
  );

  const wizardStepKey = useMemo(() => {
    if (!caseId) return null;
    const keyId = selectedInterventionId ? String(selectedInterventionId) : null;
    if (keyId) return `${caseId}:${keyId}`;
    return `${caseId}:draft`;
  }, [caseId, selectedInterventionId]);

  const hasBlockingSubmitted = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.some(plan =>
      (plan.interventions || []).some(intervention => {
        const statusValue = normalizeInterventionStatus(intervention?.status, null);
        return statusValue === "submitted";
      })
    );
  }, [caseData]);

  const hasBlockingDraft = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.some(plan =>
      (plan.interventions || []).some(intervention => {
        const statusValue = normalizeInterventionStatus(intervention?.status, null);
        return statusValue === "draft" || statusValue === "changes_requested";
      })
    );
  }, [caseData]);

  const hasBlockingProposal = hasBlockingSubmitted || hasBlockingDraft;

  const statusValue = normalizeInterventionStatus(currentInterventionStatus, null);
  const isDraftStatus = statusValue === "draft";
  const isSubmittedStatus = statusValue === "submitted";
  const isChangesRequestedStatus = statusValue === "changes_requested";
  const isRevisionMode = Boolean(revisionContext?.sourceInterventionId);
  const revisionSourceInterventionId = revisionContext?.sourceInterventionId || null;
  const revisionSourceActionPlanId = revisionContext?.sourceActionPlanId || "";
  const revisionSourceStatus = revisionContext?.sourceStatus || "approved";
  const revisionSourceTitle = revisionContext?.sourceTitle || "this approved intervention";
  const decisionOutcomeKey = String(form.decisionOutcome || "").trim().toLowerCase();
  const isApprovedDecisionOutcome = decisionOutcomeKey === "approved";
  const isRejectedDecisionOutcome = decisionOutcomeKey === "rejected";
  const showCommunicationStep = isSubmittedStatus && (isApprovedDecisionOutcome || isRejectedDecisionOutcome);
  const role = currentUser?.role || null;
  const roleKey = normalizeRoleKey(role);
  const canonicalRole = role === "Regional Manager" ? "Regional Manager" : role;
  const canManageEiEligibility = EI_ELIGIBILITY_ROLE_KEYS.has(roleKey);
  const isAssessor = canonicalRole === "ISET Coordinator";
  const canEditSubmittedProposal = SUBMITTED_PROPOSAL_EDITOR_ROLE_KEYS.has(roleKey);
  const canDecideSubmittedProposal = SUBMITTED_PROPOSAL_DECIDER_ROLE_KEYS.has(roleKey);

  const isEditable =
    isDraftStatus ||
    isChangesRequestedStatus ||
    (isSubmittedStatus && canEditSubmittedProposal) ||
    (!statusValue && !hasBlockingProposal);
  const isFormLocked = !isEditable || isSubmitting;
  const isDecisionReadOnly = isFormLocked || !canDecideSubmittedProposal;
  const statusLabel = completionNote
    ? "Completed"
    : statusValue
      ? statusValue.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase())
      : hasBlockingProposal
        ? "Read only"
        : "Draft";
  const statusBadgeColor = completionNote ? "green" : "blue";

  const activeStepIds = useMemo(() => {
    if (!isSubmittedStatus || !canDecideSubmittedProposal) return BASE_STEP_IDS;
    const submitted = [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS];
    return showCommunicationStep ? [...submitted, COMMUNICATION_STEP_ID] : submitted;
  }, [canDecideSubmittedProposal, isSubmittedStatus, showCommunicationStep]);

  const codeOptions = useMemo(() => {
    if (!Array.isArray(interventionCodes) || interventionCodes.length === 0) return [];
    return interventionCodes.map(item => ({
      value: String(item.code),
      label: `${item.code} — ${item.label}`,
      codeLabel: item.label,
    }));
  }, [interventionCodes]);

  const interventionCodeLookup = useMemo(() => {
    const map = new Map();
    codeOptions.forEach(option => {
      if (!option?.value) return;
      map.set(String(option.value), option);
    });
    return map;
  }, [codeOptions]);

  const resolveInterventionLabel = useCallback(
    code => {
      if (!code) return "";
      const normalized = String(code);
      const match = interventionCodeLookup.get(normalized);
      if (match?.label) return match.label.replace(/^\s*\d+\s*–\s*/, "");
      return normalized;
    },
    [interventionCodeLookup]
  );

  const selectablePlans = useMemo(() => {
    const plans = caseData?.actionPlans || [];
    return plans.filter(plan => {
      const status = String(plan.status || "").toLowerCase();
      if (status === "closed" || status === "archived") return false;
      if (plan.archivedAt) return false;
      return true;
    });
  }, [caseData]);

  const planOptions = useMemo(
    () =>
      selectablePlans.map(plan => ({
        value: String(plan.id),
        label: plan.title || `Action Plan ${plan.id}`,
        description: plan.status ? `Status: ${plan.status}` : "",
      })),
    [selectablePlans]
  );
  const isPlanStepBlocked = currentStep === "plan" && planOptions.length === 0;

  const activePlanId = useMemo(() => {
    const active = selectablePlans.find(plan => String(plan.status || "").toLowerCase() === "active");
    return active?.id || null;
  }, [selectablePlans]);

  const selectedPlan = useMemo(() => {
    if (!selectablePlans.length) return null;
    const selectedId = form.actionPlanId || selectedActionPlanId;
    if (selectedId) {
      return selectablePlans.find(plan => String(plan.id) === String(selectedId)) || null;
    }
    return null;
  }, [selectablePlans, form.actionPlanId, selectedActionPlanId]);

  const selectedPlanFundingStream = useMemo(
    () => normalizeFundingStream(selectedPlan?.fundingStream || selectedPlan?.funding_stream),
    [selectedPlan]
  );
  const selectedPlanBudgetPot = useMemo(
    () => (selectedPlan?.budgetPot || selectedPlan?.budget_pot ? String(selectedPlan?.budgetPot || selectedPlan?.budget_pot) : ""),
    [selectedPlan]
  );
  const selectedPlanPostingContext = useMemo(
    () => String(selectedPlan?.postingContext || selectedPlan?.posting_context || "external").trim().toLowerCase() || "external",
    [selectedPlan]
  );
  const participantProvince = useMemo(() => {
    const context = caseData?.caseContext || {};
    const clientRegionCode =
      caseData?.client?.regionDetails?.code ||
      caseData?.client?.region?.code ||
      null;
    const answersProvince =
      context?.applicationAnswers?.["address-province"] ||
      context?.applicationPayload?.answers?.["address-province"] ||
      null;
    const resolved =
      context.addressProvince ||
      context.address?.province ||
      clientRegionCode ||
      answersProvince ||
      "";
    return resolved ? String(resolved).trim().toUpperCase() : "";
  }, [caseData]);

  const requiredFundingStream = useMemo(
    () => deriveFundingStreamFromEiStatus(form.eiVerificationStatus),
    [form.eiVerificationStatus]
  );

  const effectiveDecisionPlanFundingStream = useMemo(
    () => normalizeFundingStream(actionPlanFundingDraft.fundingStream || selectedPlanFundingStream),
    [actionPlanFundingDraft.fundingStream, selectedPlanFundingStream]
  );

  const hasPlanFundingMismatch = useMemo(
    () =>
      Boolean(
        requiredFundingStream &&
          effectiveDecisionPlanFundingStream &&
          requiredFundingStream !== effectiveDecisionPlanFundingStream
      ),
    [effectiveDecisionPlanFundingStream, requiredFundingStream]
  );
  const needsActionPlanFundingSetup = useMemo(
    () =>
      Boolean(
        isApprovedDecisionOutcome &&
          selectedPlan &&
          (!selectedPlanFundingStream || !selectedPlanBudgetPot || hasPlanFundingMismatch)
      ),
    [
      hasPlanFundingMismatch,
      isApprovedDecisionOutcome,
      selectedPlan,
      selectedPlanBudgetPot,
      selectedPlanFundingStream,
    ]
  );

  useEffect(() => {
    if (!selectedPlan) {
      setActionPlanFundingDraft({
        fundingStream: requiredFundingStream || "",
        budgetPot: "",
        postingContext: "external",
      });
      setActionPlanFundingErrors({});
      return;
    }
    setActionPlanFundingDraft({
      fundingStream: selectedPlanFundingStream || requiredFundingStream || "",
      budgetPot: selectedPlanBudgetPot || "",
      postingContext: selectedPlanPostingContext || "external",
    });
    setActionPlanFundingErrors({});
  }, [
    requiredFundingStream,
    selectedPlan,
    selectedPlanBudgetPot,
    selectedPlanFundingStream,
    selectedPlanPostingContext,
  ]);

  const actionPlanFundingStreamOptions = useMemo(() => {
    const formatted = (Array.isArray(fundingStreams) ? fundingStreams : [])
      .map(item => {
        if (!item) return null;
        const value = item.code ? String(item.code).trim() : null;
        const label = item.label ? String(item.label).trim() : value;
        if (!value || !label) return null;
        return { value, label };
      })
      .filter(Boolean);
    if (
      actionPlanFundingDraft.fundingStream &&
      !formatted.some(option => option.value === actionPlanFundingDraft.fundingStream)
    ) {
      formatted.push({
        value: actionPlanFundingDraft.fundingStream,
        label: `${actionPlanFundingDraft.fundingStream} (legacy)`,
        disabled: true,
      });
    }
    return formatted;
  }, [actionPlanFundingDraft.fundingStream, fundingStreams]);

  const selectedActionPlanFundingStreamOption = useMemo(
    () =>
      actionPlanFundingStreamOptions.find(option => option.value === actionPlanFundingDraft.fundingStream) || null,
    [actionPlanFundingDraft.fundingStream, actionPlanFundingStreamOptions]
  );

  const selectedActionPlanBudgetPotOption = useMemo(() => {
    if (!actionPlanFundingDraft.budgetPot) return null;
    return (
      actionPlanBudgetPotOptions.find(option => String(option.value) === String(actionPlanFundingDraft.budgetPot)) ||
      {
        value: String(actionPlanFundingDraft.budgetPot),
        label:
          actionPlanBudgetPotOptions.find(option => String(option.value) === String(actionPlanFundingDraft.budgetPot))
            ?.label || String(actionPlanFundingDraft.budgetPot),
      }
    );
  }, [actionPlanBudgetPotOptions, actionPlanFundingDraft.budgetPot]);

  const selectedActionPlanPostingContextOption = useMemo(
    () =>
      POSTING_CONTEXT_OPTIONS.find(option => option.value === actionPlanFundingDraft.postingContext) ||
      POSTING_CONTEXT_OPTIONS[0],
    [actionPlanFundingDraft.postingContext]
  );

  const loadActionPlanBudgetPotOptions = useCallback(
    async query => {
      setActionPlanBudgetPotLoading(true);
      try {
        const resp = await apiFetch("/api/reference/budget-pots-lite?chargeableOnly=0");
        if (!resp.ok) {
          throw new Error(`Lookup failed (${resp.status})`);
        }
        const data = await resp.json();
        const qLower = String(query || "").trim().toLowerCase();
        const selectedBudgetPotId = actionPlanFundingDraft.budgetPot
          ? String(actionPlanFundingDraft.budgetPot)
          : "";
        const selectedFundingStream = normalizeFundingStream(actionPlanFundingDraft.fundingStream);
        const options = (Array.isArray(data) ? data : [])
          .filter(item => {
            const potType =
              item?.pot_type ??
              item?.potType ??
              item?.type ??
              item?.nodeType ??
              item?.metadata?.pot_type ??
              item?.metadata?.nodeType ??
              "";
            const normalizedType = String(potType).trim().toLowerCase().replace(/[_\s]+/g, " ");
            return normalizedType === "funding stream";
          })
          .filter(item => {
            const itemId = item?.id || item?.value || item?.code || "";
            const itemIdString = itemId ? String(itemId) : "";
            const isSelectedItem = selectedBudgetPotId && itemIdString && itemIdString === selectedBudgetPotId;
            const isActive = !(item?.isActive === false || item?.is_active === false || item?.is_active === 0);
            if (!isActive && !isSelectedItem) return false;

            const fundingSourceRaw = item.fundingSource || item.funding_source || "";
            const deriveStreamFromCode = codeValue => {
              const codeString = normalizeFundingStream(codeValue);
              if (!codeString) return "";
              if (codeString.includes("-EI") || codeString.endsWith(" EI")) return "EI";
              if (codeString.includes("-CRF") || codeString.endsWith(" CRF")) return "CRF";
              return "";
            };
            if (selectedFundingStream) {
              const potFundingStream =
                normalizeFundingStream(fundingSourceRaw) || deriveStreamFromCode(item.code);
              if (potFundingStream && potFundingStream !== selectedFundingStream) {
                return false;
              }
            }

            if (!participantProvince) return true;
            const regions = Array.isArray(item.regions)
              ? item.regions.map(region => String(region).trim().toUpperCase())
              : [];
            if (isSelectedItem && !regions.length) return true;
            if (!regions.length) return false;
            return regions.includes(participantProvince) || isSelectedItem;
          })
          .filter(item => {
            if (!qLower) return true;
            const name = String(item?.name || "").toLowerCase();
            const code = String(item?.code || "").toLowerCase();
            return name.includes(qLower) || code.includes(qLower);
          })
          .map(item => {
            const value = item.id || item.value || item.code;
            if (!value) return null;
            const code = item.code || "";
            const name = item.name || item.label || "";
            const label = [code, name].filter(Boolean).join(" - ") || code || name || String(value);
            return {
              value: String(value),
              label,
              description: code || undefined,
            };
          })
          .filter(Boolean);
        setActionPlanBudgetPotOptions(options);
      } catch (err) {
        console.warn("[InterventionAssessment] action plan pot lookup failed", err);
        setActionPlanBudgetPotOptions([]);
      } finally {
        setActionPlanBudgetPotLoading(false);
      }
    },
    [actionPlanFundingDraft.budgetPot, actionPlanFundingDraft.fundingStream, apiFetch, participantProvince]
  );

  useEffect(() => {
    if (!needsActionPlanFundingSetup) return;
    loadFundingStreams().catch(() => {});
  }, [loadFundingStreams, needsActionPlanFundingSetup]);

  useEffect(() => {
    if (!needsActionPlanFundingSetup) {
      setActionPlanBudgetPotOptions([]);
      return;
    }
    if (!actionPlanFundingDraft.fundingStream) {
      setActionPlanBudgetPotOptions([]);
      return;
    }
    loadActionPlanBudgetPotOptions().catch(() => {});
  }, [
    actionPlanFundingDraft.fundingStream,
    loadActionPlanBudgetPotOptions,
    needsActionPlanFundingSetup,
  ]);

  useEffect(() => {
    if (!isAssessor) return;
    if (!actionPlanFundingDraft.budgetPot) return;
    if (actionPlanFundingDraft.postingContext === "external") return;
    setActionPlanFundingDraft(current => ({ ...current, postingContext: "external" }));
  }, [actionPlanFundingDraft.budgetPot, actionPlanFundingDraft.postingContext, isAssessor]);

  const validateActionPlanFundingDraft = useCallback(
    draft => {
      const nextDraft = draft || actionPlanFundingDraft;
      const errors = {};
      if (!normalizeFundingStream(nextDraft.fundingStream)) {
        errors.fundingStream = "Funding stream is required.";
      }
      if (!String(nextDraft.budgetPot || "").trim()) {
        errors.budgetPot = "Budget pot is required.";
      }
      if (!String(nextDraft.postingContext || "").trim()) {
        errors.postingContext = "Paid from is required.";
      }
      const nextFundingStream = normalizeFundingStream(nextDraft.fundingStream);
      if (requiredFundingStream && nextFundingStream && nextFundingStream !== requiredFundingStream) {
        errors.fundingStream = `Funding stream must match EI eligibility (${requiredFundingStream}).`;
      }
      return errors;
    },
    [actionPlanFundingDraft, requiredFundingStream]
  );

  useEffect(() => {
    if (form.actionPlanId) return;
    if (activePlanId) {
      setForm(prev => ({ ...prev, actionPlanId: String(activePlanId) }));
      if (typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(activePlanId);
      }
      return;
    }
    if (selectedActionPlanId) {
      setForm(prev => ({ ...prev, actionPlanId: String(selectedActionPlanId) }));
    }
  }, [activePlanId, form.actionPlanId, selectedActionPlanId, setSelectedActionPlanId]);

  useEffect(() => {
    if (planOptions.length && error === "Create an action plan before proposing interventions.") {
      setError(null);
    }
  }, [planOptions.length, error]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = event => {
      if (event?.detail?.id !== "interventionAssessment") return;
      if (typeof clearInterventionWizardStep === "function") {
        clearInterventionWizardStep();
      }
      if (typeof clearInterventionWizardDraft === "function") {
        clearInterventionWizardDraft();
      }
    };
    window.addEventListener("iset-case-workspace:widget-removed", handler);
    return () => window.removeEventListener("iset-case-workspace:widget-removed", handler);
  }, [clearInterventionWizardStep, clearInterventionWizardDraft]);

  useEffect(() => {
    if (!wizardStepKey) return;
    const stepSignature = activeStepIds.join("|");
    const keyChanged = wizardStepRestoreKeyRef.current !== wizardStepKey;
    const stepsChanged = wizardStepRestoreStepsRef.current !== stepSignature;
    if (!keyChanged && !stepsChanged) return;
    wizardStepRestoreKeyRef.current = wizardStepKey;
    wizardStepRestoreStepsRef.current = stepSignature;
    const storedStep = resolveStoredStep(wizardStepKey, activeStepIds);
    if (storedStep && activeStepIds.includes(storedStep) && storedStep !== currentStep) {
      setCurrentStep(storedStep);
      return;
    }
    if (stepsChanged && !activeStepIds.includes(currentStep)) {
      setCurrentStep(BASE_STEP_IDS[0]);
    }
  }, [wizardStepKey, activeStepIds, currentStep, resolveStoredStep]);

  useEffect(() => {
    if (!wizardStepKey || typeof setInterventionWizardStep !== "function") return;
    setInterventionWizardStep(wizardStepKey, currentStep);
  }, [wizardStepKey, currentStep, setInterventionWizardStep]);

  useEffect(() => {
    if (!wizardStepKey || typeof setInterventionWizardDraft !== "function") return;
    const storedDraft = resolveStoredDraft(wizardStepKey);
    if (!hasMeaningfulDraft(form) && storedDraft && hasMeaningfulDraft(storedDraft)) {
      return;
    }
    if (!hasMeaningfulDraft(form) && !storedDraft) {
      return;
    }
    setInterventionWizardDraft(wizardStepKey, form);
  }, [wizardStepKey, form, setInterventionWizardDraft, resolveStoredDraft, hasMeaningfulDraft]);

  useEffect(() => {
    if (!wizardStepKey) return;
    if (selectedInterventionId || selectedDraftId || hydratedDraftId) return;
    if (hasBlockingProposal) return;
    if (hasMeaningfulDraft(form)) return;
    const storedDraft = resolveStoredDraft(wizardStepKey);
    if (!storedDraft || !hasMeaningfulDraft(storedDraft)) return;
    const merged = mergeStoredDraft(defaultFormState, storedDraft);
    setForm(merged);
    initialFormRef.current = merged;
  }, [
    wizardStepKey,
    selectedInterventionId,
    selectedDraftId,
    hydratedDraftId,
    hasBlockingProposal,
    form,
    resolveStoredDraft,
    hasMeaningfulDraft,
    mergeStoredDraft,
  ]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateOtherFundingFields = useCallback(
    updater => {
      setForm(prev => {
        const next = typeof updater === "function" ? updater(prev) : { ...prev, ...(updater || {}) };
        const normalizedOtherFunding = normalizeOtherFundingDetails(
          {
            involved: next.otherFundingInvolved,
            sources: next.otherFundingSources,
            nwacCoverage: next.otherFundingNwacCoverage,
            notes: next.otherFundingNotes,
          },
          { keepEmptySources: true, preserveWhitespace: true }
        );
        return {
          ...next,
          otherFundingInvolved: normalizedOtherFunding.involved,
          otherFundingSources: normalizedOtherFunding.sources,
          otherFundingNwacCoverage: normalizedOtherFunding.nwacCoverage,
          otherFundingNotes: normalizedOtherFunding.notes,
        };
      });
    },
    []
  );

  const addOtherFundingSource = useCallback(
    sourceDraft => {
      const nextSource = buildEmptyOtherFundingSource(sourceDraft || {});
      updateOtherFundingFields(prev => ({
        ...prev,
        otherFundingSources: [
          ...(Array.isArray(prev.otherFundingSources) ? prev.otherFundingSources : []),
          nextSource,
        ],
      }));
    },
    [updateOtherFundingFields]
  );

  const updateOtherFundingSource = useCallback(
    (sourceId, updates) => {
      updateOtherFundingFields(prev => ({
        ...prev,
        otherFundingSources: (Array.isArray(prev.otherFundingSources) ? prev.otherFundingSources : []).map(source =>
          idsMatch(source.id, sourceId)
            ? buildEmptyOtherFundingSource({ ...source, ...(updates || {}) })
            : source
        ),
      }));
    },
    [updateOtherFundingFields]
  );

  const removeOtherFundingSource = useCallback(
    sourceId => {
      updateOtherFundingFields(prev => ({
        ...prev,
        otherFundingSources: (Array.isArray(prev.otherFundingSources) ? prev.otherFundingSources : []).filter(
          source => !idsMatch(source.id, sourceId)
        ),
      }));
    },
    [updateOtherFundingFields]
  );

  const resetOtherFundingSourceModal = useCallback(() => {
    setOtherFundingSourceModal(buildOtherFundingSourceModalState());
    setOtherFundingSourceModalErrors({});
  }, []);

  const openAddOtherFundingSourceModal = useCallback(() => {
    setOtherFundingSourceModal(
      buildOtherFundingSourceModalState({
        visible: true,
        mode: "add",
        sourceId: null,
        draft: buildEmptyOtherFundingSource(),
        original: null,
      })
    );
    setOtherFundingSourceModalErrors({});
  }, []);

  const openEditOtherFundingSourceModal = useCallback(
    sourceId => {
      const current = Array.isArray(form.otherFundingSources) ? form.otherFundingSources : [];
      const source = current.find(item => idsMatch(item?.id, sourceId));
      if (!source) return;
      const normalized = buildEmptyOtherFundingSource(source);
      setOtherFundingSourceModal(
        buildOtherFundingSourceModalState({
          visible: true,
          mode: "edit",
          sourceId: normalized.id,
          draft: normalized,
          original: normalized,
        })
      );
      setOtherFundingSourceModalErrors({});
    },
    [form.otherFundingSources]
  );

  const updateOtherFundingSourceModalDraft = useCallback(updates => {
    setOtherFundingSourceModal(prev => {
      if (!prev?.draft) return prev;
      return {
        ...prev,
        draft: buildEmptyOtherFundingSource({
          ...prev.draft,
          ...(updates || {}),
        }),
      };
    });
  }, []);

  const saveOtherFundingSourceModal = useCallback(() => {
    const draft = buildEmptyOtherFundingSource(otherFundingSourceModal.draft || {});
    const errors = validateOtherFundingSourceDraft(draft);
    if (Object.keys(errors).length > 0) {
      setOtherFundingSourceModalErrors(errors);
      return;
    }
    if (otherFundingSourceModal.mode === "edit" && otherFundingSourceModal.sourceId) {
      updateOtherFundingSource(otherFundingSourceModal.sourceId, draft);
      resetOtherFundingSourceModal();
      return;
    }
    addOtherFundingSource(draft);
    resetOtherFundingSourceModal();
  }, [
    addOtherFundingSource,
    otherFundingSourceModal.draft,
    otherFundingSourceModal.mode,
    otherFundingSourceModal.sourceId,
    resetOtherFundingSourceModal,
    updateOtherFundingSource,
  ]);

  useEffect(() => {
    if (!interventionCodesLoading && (!interventionCodes || interventionCodes.length === 0)) {
      loadInterventionCodes().catch(() => {});
    }
  }, [interventionCodes, interventionCodesLoading, loadInterventionCodes]);

  useEffect(() => {
    if (!nocVersionsLoading && (!nocVersions || nocVersions.length === 0)) {
      loadNocVersions().catch(() => {});
    }
  }, [nocVersions, nocVersionsLoading, loadNocVersions]);

  const nocVersionOptions = useMemo(() => {
    if (!Array.isArray(nocVersions)) return [];
    return nocVersions
      .map(item => ({
        value: item.value || item.code || "",
        label: item.label || item.code || "",
        description: item.description || "",
      }))
      .filter(item => item.value && item.label);
  }, [nocVersions]);

  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);

  const fetchNocSuggestions = useCallback(
    async (queryText, version) => {
      if (!version) {
        setNocSuggestions([]);
        return;
      }
      const query = typeof queryText === "string" ? queryText.trim() : "";
      if (query.length < 2) {
        setNocSuggestions([]);
        return;
      }
      setNocSuggestionsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", "25");
        params.set("q", query);
        params.set("version", version);
        const response = await apiFetch(`/api/reference/noc-codes?${params.toString()}`, { method: "GET" });
        if (!response.ok) throw new Error(`Failed to load NOC codes (${response.status})`);
        const data = await response.json();
        const options = Array.isArray(data?.codes)
          ? data.codes
              .map(item => ({
                value: item?.code ? String(item.code).trim() : null,
                label: item?.title ? `${item.code} - ${item.title}` : String(item.code || ""),
                description: item?.title || null,
              }))
              .filter(option => option.value && option.label)
          : [];
        setNocSuggestions(options);
      } catch (_) {
        setNocSuggestions([]);
      } finally {
        setNocSuggestionsLoading(false);
      }
    },
    [apiFetch]
  );

  const [paymentTypeMapping, setPaymentTypeMapping] = useState(null);
  const [paymentTypeMappingLoading, setPaymentTypeMappingLoading] = useState(false);
  const [costingDefaults, setCostingDefaults] = useState(null);
  const [costingDefaultsLoading, setCostingDefaultsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadMapping = async () => {
      setPaymentTypeMappingLoading(true);
      try {
        const response = await apiFetch("/api/finance/payment-intervention-type-map", { method: "GET" });
        if (!response.ok) throw new Error(`Failed to load payment mapping (${response.status})`);
        const payload = await response.json().catch(() => null);
        if (!cancelled) setPaymentTypeMapping(normalizePaymentTypeMappingPayload(payload));
      } catch (_) {
        if (!cancelled) setPaymentTypeMapping(null);
      } finally {
        if (!cancelled) setPaymentTypeMappingLoading(false);
      }
    };
    loadMapping();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    let cancelled = false;
    const loadDefaults = async () => {
      setCostingDefaultsLoading(true);
      try {
        const response = await apiFetch("/api/config/runtime/assessment-costing", { method: "GET" });
        if (!response.ok) throw new Error(`Failed to load costing defaults (${response.status})`);
        const payload = await response.json().catch(() => null);
        if (!cancelled) setCostingDefaults(normalizeCostingDefaults(payload));
      } catch (_) {
        if (!cancelled) setCostingDefaults(null);
      } finally {
        if (!cancelled) setCostingDefaultsLoading(false);
      }
    };
    loadDefaults();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    let cancelled = false;
    const loadWorkflows = async () => {
      setLetterWorkflowsLoading(true);
      setLetterWorkflowsError(null);
      try {
        const resp = await apiFetch("/api/workflows");
        if (!resp.ok) throw new Error(`Failed to load letter workflows (${resp.status})`);
        const rows = await resp.json().catch(() => []);
        const list = Array.isArray(rows) ? rows : [];
        const normalizeDocType = value => String(value || "").trim().toLowerCase();
        const chooseBest = (current, candidate) => {
          if (!candidate) return current;
          if (!current) return candidate;
          const statusRank = value => {
            const key = String(value || "").trim().toLowerCase();
            if (key === "active") return 3;
            if (key === "draft") return 2;
            return 1;
          };
          const currentRank = statusRank(current.status);
          const candidateRank = statusRank(candidate.status);
          if (candidateRank > currentRank) return candidate;
          if (candidateRank < currentRank) return current;
          return Number(candidate.id || 0) > Number(current.id || 0) ? candidate : current;
        };
        let approval = null;
        let denial = null;
        list.forEach(row => {
          const docType = normalizeDocType(row?.document_type);
          if (docType === "assessment_approval_letter") {
            approval = chooseBest(approval, row);
          }
          if (docType === "assessment_denial_letter") {
            denial = chooseBest(denial, row);
          }
        });
        if (!cancelled) {
          setLetterWorkflows({
            approval: approval?.id ? Number(approval.id) : null,
            denial: denial?.id ? Number(denial.id) : null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setLetterWorkflows({ approval: null, denial: null });
          setLetterWorkflowsError(err?.message || "Failed to load letter workflows.");
        }
      } finally {
        if (!cancelled) setLetterWorkflowsLoading(false);
      }
    };
    loadWorkflows();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const paymentTypeMappingLookup = useMemo(
    () => buildPaymentTypeMappingLookup(paymentTypeMapping),
    [paymentTypeMapping]
  );

  const configuredPaymentTypeOptions = useMemo(() => {
    const list = Array.isArray(paymentTypeMapping?.paymentTypes) ? paymentTypeMapping.paymentTypes : [];
    return list
      .map(entry => {
        const code = normalizePaymentTypeCode(entry?.code);
        if (!code) return null;
        return {
          value: code,
          label: entry?.label || code,
        };
      })
      .filter(Boolean);
  }, [paymentTypeMapping]);
  const configuredPayeeTypeOptions = useMemo(() => {
    const list = Array.isArray(paymentTypeMapping?.payeeTypes) ? paymentTypeMapping.payeeTypes : [];
    return list
      .map(entry => {
        const code = typeof entry?.code === "string" ? entry.code.trim() : "";
        if (!code) return null;
        return {
          value: code,
          label: entry?.label || code,
          description: entry?.description || undefined,
        };
      })
      .filter(Boolean);
  }, [paymentTypeMapping]);

  const paymentTypeLabelLookup = useMemo(() => {
    const map = new Map();
    configuredPaymentTypeOptions.forEach(option => {
      if (!option?.value) return;
      map.set(String(option.value), option.label || option.value);
    });
    return map;
  }, [configuredPaymentTypeOptions]);

  const effectiveCostingDefaults = useMemo(() => {
    if (costingDefaults && costingDefaults.enabled !== false) return costingDefaults;
    return { enabled: false, strategy: "allowed", interventions: [], paymentTypes: [] };
  }, [costingDefaults]);

  const recurrenceModeByType = useMemo(() => {
    const map = new Map();
    if (effectiveCostingDefaults && Array.isArray(effectiveCostingDefaults.paymentTypes)) {
      effectiveCostingDefaults.paymentTypes.forEach(entry => {
        const code = normalizePaymentTypeCode(entry?.code);
        if (!code) return;
        const mode = normalizeRecurrenceMode(entry?.recurrence?.mode);
        map.set(code, mode);
      });
    }
    return map;
  }, [effectiveCostingDefaults]);

  const getRecurrenceModeForType = useCallback(
    type => {
      if (!type) return RECURRENCE_MODE_NOT_ALLOWED;
      const normalized = normalizePaymentTypeCode(type);
      return recurrenceModeByType.get(normalized) || RECURRENCE_MODE_NOT_ALLOWED;
    },
    [recurrenceModeByType]
  );
  const submissionTimingByType = useMemo(() => {
    const map = new Map();
    const paymentTypes = Array.isArray(paymentTypeMapping?.paymentTypes)
      ? paymentTypeMapping.paymentTypes
      : [];
    paymentTypes.forEach(entry => {
      const code = normalizePaymentTypeCode(entry?.code || entry?.paymentType || entry?.payment_type);
      if (!code) return;
      const timing =
        normalizeSubmissionTiming(entry?.submissionTiming || entry?.submission_timing) ||
        DEFAULT_SUBMISSION_TIMING_BY_TYPE[code] ||
        SUBMISSION_TIMING_MANUAL_TRIGGER;
      map.set(code, timing);
    });
    Object.entries(DEFAULT_SUBMISSION_TIMING_BY_TYPE).forEach(([code, timing]) => {
      if (!map.has(code)) map.set(code, timing);
    });
    return map;
  }, [paymentTypeMapping]);
  const getSubmissionTimingForType = useCallback(
    type => {
      const code = normalizePaymentTypeCode(type);
      if (!code) return SUBMISSION_TIMING_MANUAL_TRIGGER;
      return (
        submissionTimingByType.get(code) ||
        DEFAULT_SUBMISSION_TIMING_BY_TYPE[code] ||
        SUBMISSION_TIMING_MANUAL_TRIGGER
      );
    },
    [submissionTimingByType]
  );

  const getAllowedPaymentTypesForIntervention = useCallback(
    code => {
      const normalized = normalizeInterventionCodeValue(code);
      if (!normalized) return [];
      const allowed = paymentTypeMappingLookup.get(normalized);
      if (!allowed) return [];
      return Array.from(allowed);
    },
    [paymentTypeMappingLookup]
  );
  const getCostLineDetailsText = useCallback(
    (line, intervention = null) => {
      const recurrenceMode = getRecurrenceModeForType(line?.type);
      const recurrence = line?.recurrence || {};
      const recurrenceEnabled =
        recurrenceMode === RECURRENCE_MODE_REQUIRED || Boolean(recurrence.enabled);
      let occurrences = null;
      if (recurrenceEnabled) {
        const occurrencesRaw =
          recurrence.occurrences === "" ||
          recurrence.occurrences === null ||
          typeof recurrence.occurrences === "undefined"
            ? null
            : Number(recurrence.occurrences);
        occurrences = Number.isFinite(occurrencesRaw) && occurrencesRaw > 0 ? occurrencesRaw : null;
        if (!occurrences) {
          const startDate = formatDate(recurrence.startDate);
          const endDate = formatDate(recurrence.endDate);
          if (startDate && endDate) {
            const computed = autoOccurrencesFromDates(startDate, endDate, "monthly");
            if (computed) occurrences = computed;
          }
        }
      }
      const amountPerPeriod = parseCurrencyInput(recurrence.amountPerPeriod);
      const perPeriodText =
        recurrenceEnabled && amountPerPeriod !== null
          ? `${formatCurrencyDisplay(amountPerPeriod)} per month`
          : "";
      const submissionTiming = getSubmissionTimingForType(line?.type);
      const interventionStart = formatDate(intervention?.startDate);
      const interventionEnd = formatDate(intervention?.endDate);
      const recurrenceStart = formatDate(recurrence.startDate);
      const recurrenceEnd = formatDate(recurrence.endDate);
      const explicitPayableDate = formatDate(
        line?.payableDate ||
          line?.payable_date ||
          line?.paymentDate ||
          line?.payment_date ||
          line?.dateDue ||
          line?.date_due
      );
      const firstInstallmentDate =
        recurrenceStart ||
        explicitPayableDate ||
        (submissionTiming === SUBMISSION_TIMING_INTERVENTION_END
          ? interventionEnd || recurrenceEnd
          : interventionStart || recurrenceEnd);
      const firstInstallmentDateLabel = firstInstallmentDate
        ? formatShortDate(firstInstallmentDate)
        : "";
      let payableText = "payable";
      if (recurrenceEnabled) {
        if (occurrences && occurrences > 0) {
          payableText = `payable in ${occurrences} monthly installment${
            occurrences === 1 ? "" : "s"
          }`;
        } else {
          payableText = "payable in monthly installments";
        }
        if (firstInstallmentDateLabel) {
          payableText += ` starting ${firstInstallmentDateLabel}`;
        }
      } else {
        let payableDate = "";
        if (submissionTiming === SUBMISSION_TIMING_INTERVENTION_START) {
          payableDate = formatShortDate(interventionStart || recurrenceStart || explicitPayableDate);
        } else if (submissionTiming === SUBMISSION_TIMING_INTERVENTION_END) {
          payableDate = formatShortDate(interventionEnd || recurrenceEnd || explicitPayableDate);
        } else if (submissionTiming === SUBMISSION_TIMING_RECURRENCE_SCHEDULE) {
          payableDate = formatShortDate(
            recurrenceStart || explicitPayableDate || interventionStart || interventionEnd
          );
        } else if (submissionTiming === SUBMISSION_TIMING_MANUAL_TRIGGER) {
          payableDate = formatShortDate(explicitPayableDate);
        }
        payableText = payableDate ? `payable on ${payableDate}` : "payable";
      }
      const payeeName = String(line?.payee?.name || "").trim();
      const explicitPayeeTypeKey = normalizePayeeTypeKey(line?.payee?.type);
      const inferredPayeeTypeKey = normalizePayeeTypeKey(deriveDefaultPayeeTypeForCostLine(line?.type));
      const payeeTypeKey = explicitPayeeTypeKey || inferredPayeeTypeKey;
      const payeeTarget = PAYEE_TYPE_DETAIL_TARGET_BY_KEY[payeeTypeKey] || "";
      const payeeText = payeeName ? `to ${payeeName}` : payeeTarget ? `to ${payeeTarget}` : "";
      const notesText = String(line?.notes || "").trim();
      let text = payableText || "—";
      if (perPeriodText) {
        text = `${text} (${perPeriodText})`;
      }
      if (payeeText) {
        text = `${text} ${payeeText}`;
      }
      return {
        text,
        notesText
      };
    },
    [getRecurrenceModeForType, getSubmissionTimingForType]
  );

  const buildCostItemOptions = useCallback(
    intervention => {
      const allowed = new Set(getAllowedPaymentTypesForIntervention(intervention?.code));
      return configuredPaymentTypeOptions.filter(option => {
        if (!option?.value) return false;
        if (allowed.size && !allowed.has(option.value)) return false;
        return true;
      });
    },
    [configuredPaymentTypeOptions, getAllowedPaymentTypesForIntervention]
  );

  const buildSuggestedCostLines = useCallback(
    intervention => {
      if (!effectiveCostingDefaults.enabled) return [];
      const code = normalizeInterventionCodeValue(intervention?.code);
      if (!code) return [];
      const allowed = new Set(getAllowedPaymentTypesForIntervention(code));
      const defaultsEntry = Array.isArray(effectiveCostingDefaults.interventions)
        ? effectiveCostingDefaults.interventions.find(entry => entry.code === code)
        : null;
      const hasExplicitDefaults = Boolean(defaultsEntry);
      let suggested = defaultsEntry?.suggested || [];
      if (!suggested.length && effectiveCostingDefaults.strategy === "allowed" && !hasExplicitDefaults) {
        if (!allowed.size) return null;
        suggested = Array.from(allowed).map(type => ({ type }));
      }
      if (!Array.isArray(suggested) || !suggested.length) return [];
      const seen = new Set();
      return suggested
        .map(item => {
          const type = item?.type ? String(item.type).trim() : "";
          if (!type) return null;
          if (allowed.size && !allowed.has(type)) return null;
          if (seen.has(type)) return null;
          seen.add(type);
          const recurrenceMode = getRecurrenceModeForType(type);
          const recurrenceEnabled =
            typeof item?.recurrenceEnabled === "boolean"
              ? item.recurrenceEnabled
              : recurrenceMode === RECURRENCE_MODE_REQUIRED;
          return buildEmptyCostLine({
            type,
            notes: item?.notes || "",
            recurrence: {
              enabled: recurrenceEnabled,
              startDate: intervention?.startDate || "",
              endDate: intervention?.endDate || "",
              occurrences: "",
              amountPerPeriod: "",
            },
          });
        })
        .filter(Boolean);
    },
    [effectiveCostingDefaults, getAllowedPaymentTypesForIntervention, getRecurrenceModeForType]
  );

  const proposedInterventions = Array.isArray(form.proposedInterventions)
    ? form.proposedInterventions
    : [];
  const isFramingStepBlocked = currentStep === "framing" && proposedInterventions.length === 0;

  useEffect(() => {
    if (proposedInterventions.length && error === "Add at least one proposed intervention before continuing.") {
      setError(null);
    }
  }, [proposedInterventions.length, error]);

  const primaryIntervention = useMemo(() => {
    if (!proposedInterventions.length) return null;
    return (
      proposedInterventions.find(item => item?.code && item?.startDate) ||
      proposedInterventions[0] ||
      null
    );
  }, [proposedInterventions]);

  const updateProposedInterventions = useCallback(
    updater => {
      setForm(prev => {
        const current = Array.isArray(prev.proposedInterventions) ? prev.proposedInterventions : [];
        const next = typeof updater === "function" ? updater(current) : updater;
        return { ...prev, proposedInterventions: next };
      });
    },
    []
  );

  const interventionTotals = useMemo(() => {
    const totals = new Map();
    proposedInterventions.forEach(intervention => {
      const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
      const total = lines.reduce((sum, line) => sum + parseCurrencyToNumber(line.amount), 0);
      totals.set(intervention.id, total);
    });
    return totals;
  }, [proposedInterventions]);

  const overallCostTotal = useMemo(() => {
    let total = 0;
    interventionTotals.forEach(value => {
      if (Number.isFinite(value)) total += value;
    });
    return total;
  }, [interventionTotals]);

  useEffect(() => {
    if (costingDefaultsLoading || paymentTypeMappingLoading) return;
    updateProposedInterventions(current => {
      let changed = false;
      const next = current.map(intervention => {
        if (intervention.suggestionsSeeded) return intervention;
        const suggestions = buildSuggestedCostLines(intervention) || [];
        if (!suggestions.length) {
          return { ...intervention, suggestionsSeeded: true };
        }
        const existing = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const merged = [...existing, ...suggestions];
        changed = true;
        return { ...intervention, costLines: merged, suggestionsSeeded: true };
      });
      return changed ? next : current;
    });
  }, [buildSuggestedCostLines, costingDefaultsLoading, paymentTypeMappingLoading, updateProposedInterventions]);

  const updateIntervention = useCallback(
    (interventionId, updates) => {
      updateProposedInterventions(current =>
        current.map(item =>
          idsMatch(item.id, interventionId) ? { ...item, ...updates } : item
        )
      );
    },
    [updateProposedInterventions]
  );

  const addIntervention = useCallback(
    intervention => {
      updateProposedInterventions(current => [...current, intervention]);
    },
    [updateProposedInterventions]
  );

  const confirmInterventionDelete = useCallback(() => {
    if (isRevisionMode) {
      setInterventionDeleteId(null);
      return;
    }
    const deleteId = interventionDeleteId;
    if (deleteId !== null && typeof deleteId !== "undefined") {
      const nextProposedInterventions = proposedInterventions.filter(
        item => !idsMatch(item.id, deleteId)
      );
      const nextForm = { ...form, proposedInterventions: nextProposedInterventions };
      setForm(nextForm);
      if (wizardStepKey && typeof setInterventionWizardDraft === "function") {
        if (hasMeaningfulDraft(nextForm)) {
          setInterventionWizardDraft(wizardStepKey, nextForm);
        } else {
          setInterventionWizardDraft(wizardStepKey, null);
        }
      }
    }
    setInterventionDeleteId(null);
    setProposedInterventionsTableVersion(current => current + 1);
  }, [
    interventionDeleteId,
    proposedInterventions,
    form,
    wizardStepKey,
    setInterventionWizardDraft,
    hasMeaningfulDraft,
    isRevisionMode,
  ]);

  const openAddInterventionModal = useCallback(() => {
    if (isRevisionMode) return;
    setInterventionModal({
      visible: true,
      mode: "add",
      interventionId: null,
      draft: buildEmptyIntervention(),
      original: null,
    });
    setInterventionModalErrors({});
  }, [isRevisionMode]);

  const openViewInterventionModal = useCallback(
    interventionId => {
      const intervention = proposedInterventions.find(item => idsMatch(item.id, interventionId));
      if (!intervention) return;
      setInterventionModal({
        visible: true,
        mode: "view",
        interventionId,
        draft: { ...intervention },
        original: { ...intervention },
      });
      setInterventionModalErrors({});
    },
    [proposedInterventions]
  );

  const startInterventionEdit = () => {
    setInterventionModal(prev => ({ ...prev, mode: "edit" }));
  };

  const resetInterventionModal = () => {
    setInterventionModal({
      visible: false,
      mode: "view",
      interventionId: null,
      draft: null,
      original: null,
    });
    setInterventionModalErrors({});
  };

  const updateInterventionModalDraft = updates => {
    setInterventionModal(prev => ({
      ...prev,
      draft: { ...(prev.draft || {}), ...(updates || {}) },
    }));
  };

  const validateInterventionDraft = draft => {
    const errors = {};
    if (!draft?.code) {
      errors.code = "Select an intervention code.";
    }
    if (!draft?.startDate) {
      errors.startDate = "Start date is required.";
    }
    const startUtc = parseIsoDateToUtc(draft?.startDate);
    const endUtc = parseIsoDateToUtc(draft?.endDate);
    if (startUtc !== null && endUtc !== null && endUtc < startUtc) {
      errors.endDate = "End date cannot be before start date.";
    }
    if (!draft?.code) {
      return errors;
    }
    const requiresNocCode = requiresNocForCode(draft.code);
    if (requiresNocCode) {
      if (!draft.interventionNocVersion) {
        errors.interventionNocVersion = "Select a NOC version for this intervention.";
      }
      if (!draft.interventionNoc) {
        errors.interventionNoc = "Select a NOC code for this intervention.";
      }
    }
    const educationCode = isEducationCode(draft.code);
    const employerCode = isEmployerCode(draft.code);
    const wageSubsidyCode = isWageSubsidyCode(draft.code);
    if (educationCode) {
      if (!draft.institution || !draft.institution.trim()) {
        errors.institution = "Training institution is required for this intervention code.";
      }
      if (!draft.itpDetails || !draft.itpDetails.trim()) {
        errors.itpDetails = "ITP details are required for this intervention code.";
      }
    }
    if (employerCode) {
      if (!draft.institution || !draft.institution.trim()) {
        errors.institution = "Employer / delivery partner is required for this intervention code.";
      }
      if (wageSubsidyCode && (!draft.wageSubsidyDetails || !draft.wageSubsidyDetails.trim())) {
        errors.wageSubsidyDetails = "Wage subsidy details are required for this intervention code.";
      }
    }
    if (!educationCode && !employerCode && draft.deliveryMode !== "in_house") {
      if (!draft.institution || !draft.institution.trim()) {
        errors.institution = "Delivery partner is required when using external delivery.";
      }
    }
    return errors;
  };

  const saveInterventionModal = () => {
    const draft = interventionModal.draft || null;
    const errors = validateInterventionDraft(draft);
    if (Object.keys(errors).length) {
      setInterventionModalErrors(errors);
      return;
    }
    if (interventionModal.mode === "add" && draft) {
      addIntervention({
        ...draft,
        suggestionsSeeded: false,
        costLines: Array.isArray(draft.costLines) ? draft.costLines : [],
      });
      resetInterventionModal();
      return;
    }
    if (interventionModal.mode === "edit" && interventionModal.interventionId && draft) {
      updateIntervention(interventionModal.interventionId, draft);
      resetInterventionModal();
    }
  };

  const cancelInterventionEdit = () => {
    setInterventionModal(prev => ({
      ...prev,
      mode: "view",
      draft: prev.original,
    }));
    setInterventionModalErrors({});
  };

  const openAddCostLineModal = useCallback(
    interventionId => {
      const intervention = proposedInterventions.find(item => idsMatch(item.id, interventionId));
      if (!intervention) return;
      const draft = applyCostLinePayeeDefaults(
        buildEmptyCostLine({
          recurrence: {
            enabled: false,
            startDate: intervention.startDate || "",
            endDate: intervention.endDate || "",
            occurrences: "",
            amountPerPeriod: "",
          },
        }),
        intervention,
        participantLegalName,
        { allowTypeAutofill: true }
      );
      setCostLineModal({
        visible: true,
        mode: "add",
        interventionId,
        lineId: null,
        draft,
        original: null,
      });
      setCostLineModalErrors({});
      setCostLineAmountFocused(false);
      setCostLineAmountPerPeriodFocused(false);
    },
    [participantLegalName, proposedInterventions]
  );

  const openCostLineModal = useCallback(
    (interventionId, lineId) => {
      const intervention = proposedInterventions.find(item => idsMatch(item.id, interventionId));
      const line = intervention?.costLines?.find(item => idsMatch(item.id, lineId));
      if (!intervention || !line) return;
      const normalizedLine = normalizeCostLine(line) || buildEmptyCostLine();
      const draft = applyCostLinePayeeDefaults(normalizedLine, intervention, participantLegalName, {
        allowTypeAutofill: false,
      });
      setCostLineModal({
        visible: true,
        mode: "view",
        interventionId,
        lineId,
        draft,
        original: applyCostLinePayeeDefaults(
          normalizeCostLine(line) || buildEmptyCostLine(),
          intervention,
          participantLegalName,
          { allowTypeAutofill: false }
        ),
      });
      setCostLineModalErrors({});
      setCostLineAmountFocused(false);
      setCostLineAmountPerPeriodFocused(false);
    },
    [participantLegalName, proposedInterventions]
  );

  const resetCostLineModal = () => {
    setCostLineModal({
      visible: false,
      mode: "view",
      interventionId: null,
      lineId: null,
      draft: null,
      original: null,
    });
    setCostLineModalErrors({});
    setCostLineAmountFocused(false);
    setCostLineAmountPerPeriodFocused(false);
  };

  const updateCostLineDraft = updater => {
    setCostLineModal(prev => {
      const current = prev.draft || {};
      const nextDraft =
        typeof updater === "function"
          ? updater(current)
          : { ...current, ...(updater || {}) };
      return {
        ...prev,
        draft: nextDraft,
      };
    });
  };
  const updateCostLinePayeeType = useCallback(
    nextPayeeType => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention =
          proposedInterventions.find(item => idsMatch(item.id, prev.interventionId)) || null;
        const normalizedPayeeType = String(nextPayeeType || "").trim();
        const nextPayee = {
          ...(prev.draft.payee || {}),
          type: normalizedPayeeType,
        };
        if (normalizedPayeeType === PAYEE_TYPE_PARTICIPANT_CLIENT) {
          nextPayee.name = "";
          nextPayee.reference = "";
        }
        const nextDraft = applyCostLinePayeeDefaults(
          {
            ...prev.draft,
            payee: nextPayee,
          },
          intervention,
          participantLegalName,
          { allowTypeAutofill: false }
        );
        return {
          ...prev,
          draft: nextDraft,
        };
      });
      setCostLineModalErrors({});
    },
    [participantLegalName, proposedInterventions]
  );

  const buildRecurrenceFromIntervention = useCallback(
    (intervention, enabled) => {
      if (!enabled) {
        return {
          enabled: false,
          startDate: "",
          endDate: "",
          occurrences: "",
          amountPerPeriod: "",
        };
      }
      const startDate = intervention?.startDate || "";
      const endDate = intervention?.endDate || "";
      const occurrences = startDate && endDate ? autoOccurrencesFromDates(startDate, endDate, "monthly") : null;
      return {
        enabled: true,
        startDate,
        endDate,
        occurrences: occurrences ? String(occurrences) : "",
        amountPerPeriod: "",
      };
    },
    []
  );

  const updateCostLineType = useCallback(
    nextType => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention = proposedInterventions.find(item => idsMatch(item.id, prev.interventionId));
        if (!intervention) return prev;
        const recurrenceMode = getRecurrenceModeForType(nextType);
        const recurrenceEnabled =
          recurrenceMode === RECURRENCE_MODE_REQUIRED
            ? true
            : recurrenceMode === RECURRENCE_MODE_NOT_ALLOWED
              ? false
              : Boolean(prev.draft.recurrence?.enabled);
        const baseRecurrence = buildRecurrenceFromIntervention(intervention, recurrenceEnabled);
        const mergedRecurrence = mergeRecurrenceDefaults(baseRecurrence, prev.draft.recurrence || {});
        const recurrence = recurrenceEnabled
          ? { ...mergedRecurrence, enabled: true }
          : baseRecurrence;
        const nextDraft = applyCostLinePayeeDefaults(
          {
            ...prev.draft,
            type: normalizePaymentTypeCode(nextType) || nextType,
            recurrence,
          },
          intervention,
          participantLegalName,
          { allowTypeAutofill: true }
        );
        return {
          ...prev,
          draft: nextDraft,
        };
      });
      setCostLineModalErrors({});
    },
    [buildRecurrenceFromIntervention, getRecurrenceModeForType, participantLegalName, proposedInterventions]
  );

  const toggleCostLineRecurrence = useCallback(
    enabled => {
      setCostLineModal(prev => {
        if (!prev.draft) return prev;
        const intervention = proposedInterventions.find(item => idsMatch(item.id, prev.interventionId));
        if (!intervention) return prev;
        const recurrenceMode = getRecurrenceModeForType(prev.draft.type);
        const resolvedEnabled =
          recurrenceMode === RECURRENCE_MODE_REQUIRED
            ? true
            : recurrenceMode === RECURRENCE_MODE_NOT_ALLOWED
              ? false
              : enabled;
        const baseRecurrence = buildRecurrenceFromIntervention(intervention, resolvedEnabled);
        const existing = prev.draft.recurrence || {};
        const mergedRecurrence = mergeRecurrenceDefaults(baseRecurrence, existing);
        const recurrence = resolvedEnabled
          ? { ...mergedRecurrence, enabled: true }
          : baseRecurrence;
        return {
          ...prev,
          draft: {
            ...prev.draft,
            recurrence,
          },
        };
      });
      setCostLineModalErrors({});
    },
    [getRecurrenceModeForType, proposedInterventions]
  );

  const updateCostLineAmount = useCallback(
    value => {
      const sanitized = sanitizeCurrencyInput(value);
      updateCostLineDraft(draft => {
        const next = { ...draft, amount: sanitized };
        if (draft.recurrence?.enabled && draft.recurrence?.occurrences) {
          const occ = Number(draft.recurrence.occurrences);
          if (Number.isFinite(occ) && occ > 0) {
            const total = parseCurrencyInput(sanitized);
            next.recurrence = {
              ...draft.recurrence,
              amountPerPeriod: total !== null ? formatCurrencyDisplay(total / occ) : "",
            };
          }
        }
        return next;
      });
    },
    [updateCostLineDraft]
  );

  const blurCostLineAmount = useCallback(() => {
    setCostLineAmountFocused(false);
    updateCostLineDraft(draft => {
      const sanitized = sanitizeCurrencyInput(draft.amount);
      return { ...draft, amount: sanitized || "" };
    });
  }, [updateCostLineDraft]);

  const blurCostLineAmountPerPeriod = useCallback(() => {
    setCostLineAmountPerPeriodFocused(false);
    updateCostLineDraft(draft => {
      const recurrence = { ...(draft.recurrence || {}) };
      recurrence.amountPerPeriod = sanitizeCurrencyInput(recurrence.amountPerPeriod) || "";
      return { ...draft, recurrence };
    });
  }, [updateCostLineDraft]);

  const updateCostLineAmountPerPeriod = useCallback(
    value => {
      const sanitized = sanitizeCurrencyInput(value);
      updateCostLineDraft(draft => {
        const recurrence = { ...(draft.recurrence || {}), amountPerPeriod: sanitized };
        const occ = Number(recurrence.occurrences);
        let amount = draft.amount;
        if (Number.isFinite(occ) && occ > 0) {
          const per = parseCurrencyInput(sanitized);
          if (per !== null) {
            amount = formatCurrencyDisplay(per * occ);
          }
        }
        return { ...draft, amount, recurrence };
      });
    },
    [updateCostLineDraft]
  );

  const updateCostLineOccurrences = useCallback(
    value => {
      const cleaned = String(value || "").replace(/[^\d]/g, "");
      updateCostLineDraft(draft => {
        const recurrence = { ...(draft.recurrence || {}), occurrences: cleaned };
        if (recurrence.startDate && cleaned && !recurrence.endDate) {
          const derivedEnd = deriveEndDateFromOccurrences(recurrence.startDate, Number(cleaned));
          recurrence.endDate = derivedEnd || recurrence.endDate || "";
        }
        const amounts = recalcRecurringAmounts({
          amount: draft.amount,
          amountPerPeriod: recurrence.amountPerPeriod,
          occurrences: recurrence.occurrences,
          adjustMode: "total",
        });
        return {
          ...draft,
          amount: amounts.amount,
          recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod },
        };
      });
    },
    [updateCostLineDraft]
  );

  const updateCostLineRecurrenceStart = useCallback(
    value => {
      updateCostLineDraft(draft => {
        const recurrence = { ...(draft.recurrence || {}), startDate: value };
        if (recurrence.startDate && recurrence.endDate) {
          const occ = autoOccurrencesFromDates(recurrence.startDate, recurrence.endDate, "monthly");
          recurrence.occurrences = occ ? String(occ) : "";
        }
        const amounts = recalcRecurringAmounts({
          amount: draft.amount,
          amountPerPeriod: recurrence.amountPerPeriod,
          occurrences: recurrence.occurrences,
          adjustMode: "total",
        });
        return {
          ...draft,
          amount: amounts.amount,
          recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod },
        };
      });
    },
    [updateCostLineDraft]
  );

  const updateCostLineRecurrenceEnd = useCallback(
    value => {
      updateCostLineDraft(draft => {
        const recurrence = { ...(draft.recurrence || {}), endDate: value };
        if (recurrence.startDate && recurrence.endDate) {
          const occ = autoOccurrencesFromDates(recurrence.startDate, recurrence.endDate, "monthly");
          recurrence.occurrences = occ ? String(occ) : "";
        }
        const amounts = recalcRecurringAmounts({
          amount: draft.amount,
          amountPerPeriod: recurrence.amountPerPeriod,
          occurrences: recurrence.occurrences,
          adjustMode: "total",
        });
        return {
          ...draft,
          amount: amounts.amount,
          recurrence: { ...recurrence, amountPerPeriod: amounts.amountPerPeriod },
        };
      });
    },
    [updateCostLineDraft]
  );

  const validateCostLineDraft = draft => {
    const errors = {};
    if (!draft?.type) {
      errors.type = "Select a cost item.";
    }
    const parsedAmount = parseCurrencyInput(draft?.amount);
    if (draft?.amount === "" || parsedAmount === null || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      errors.amount = "Enter a valid amount in dollars.";
    }
    const recurrenceMode = getRecurrenceModeForType(draft?.type);
    const recurrenceRequired = recurrenceMode === RECURRENCE_MODE_REQUIRED;
    const recurrenceEnabled = Boolean(draft?.recurrence?.enabled);
    if ((recurrenceRequired || recurrenceEnabled) && !isRecurrenceScheduleComplete(draft)) {
      errors.recurrence = "Complete the installments schedule.";
    }
    return errors;
  };

  const commitCostLine = () => {
    const draft = costLineModal.draft || null;
    const intervention = proposedInterventions.find(item =>
      idsMatch(item.id, costLineModal.interventionId)
    );
    const resolvedDraft = applyCostLinePayeeDefaults(draft, intervention || null, participantLegalName, {
      allowTypeAutofill: true,
    });
    const errors = validateCostLineDraft(resolvedDraft);
    if (Object.keys(errors).length) {
      setCostLineModalErrors(errors);
      return;
    }
    updateProposedInterventions(current =>
      current.map(intervention => {
        if (!idsMatch(intervention.id, costLineModal.interventionId)) return intervention;
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        if (costLineModal.mode === "add") {
          return { ...intervention, costLines: [...lines, resolvedDraft] };
        }
        if (costLineModal.mode === "edit") {
          return {
            ...intervention,
            costLines: lines.map(line => (idsMatch(line.id, costLineModal.lineId) ? resolvedDraft : line)),
          };
        }
        return intervention;
      })
    );
    resetCostLineModal();
  };

  const removeCostLine = useCallback(
    (interventionId, lineId) => {
      updateProposedInterventions(current =>
        current.map(intervention => {
          if (!idsMatch(intervention.id, interventionId)) return intervention;
          const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
          return { ...intervention, costLines: lines.filter(line => !idsMatch(line.id, lineId)) };
        })
      );
    },
    [updateProposedInterventions]
  );

  const handleInlineAmountChange = (interventionId, lineId, value) => {
    const cleaned = sanitizeCurrencyInput(value);
    updateProposedInterventions(current =>
      current.map(intervention => {
        if (!idsMatch(intervention.id, interventionId)) return intervention;
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        return {
          ...intervention,
          costLines: lines.map(line => (idsMatch(line.id, lineId) ? { ...line, amount: cleaned } : line)),
        };
      })
    );
  };

  const handleInlineAmountBlur = lineId => {
    if (inlineAmountEditingId === lineId) {
      setInlineAmountEditingId(null);
    }
  };

  useEffect(() => {
    const handleSelect = event => {
      const detail = event?.detail || {};
      const interventionId = detail.interventionId;
      if (!interventionId) return;
      const selectionKey = caseId ? `${caseId}:${interventionId}` : null;
      const storedStep = resolveStoredStep(selectionKey);
      if (typeof setSelectedInterventionId === "function") {
        const numericInterventionId = Number(interventionId);
        setSelectedInterventionId(Number.isFinite(numericInterventionId) ? numericInterventionId : interventionId);
      }
      const planId = detail.planId;
      setSelectedDraftId(interventionId);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setCurrentInterventionStatus(null);
      setRevisionContext(null);
      setError(null);
      setSuccessMessage("");
      setCompletionNote(null);
      setAttemptedSteps({});
      setCurrentStep(storedStep || BASE_STEP_IDS[0]);
      if (planId) {
        const numericPlanId = Number(planId);
        const resolvedPlanId = Number.isFinite(numericPlanId) ? numericPlanId : planId;
        setForm(prev => ({ ...prev, actionPlanId: String(planId) }));
        if (typeof setSelectedActionPlanId === "function") {
          setSelectedActionPlanId(resolvedPlanId);
        }
      }
    };

    const handleNew = event => {
      const detail = event?.detail || {};
      const planId = detail.planId;
      if (hasBlockingProposal) {
        setError("A draft or submitted proposal already exists. Resume it from the table.");
        setSuccessMessage("");
        return;
      }
      setSelectedDraftId(null);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setCurrentInterventionStatus(null);
      setRevisionContext(null);
      if (typeof setSelectedInterventionId === "function") {
        setSelectedInterventionId(null);
      }
      setError(null);
      setSuccessMessage("");
      setCompletionNote(null);
      setAttemptedSteps({});
      setCurrentStep(BASE_STEP_IDS[0]);
      setForm(prev => ({
        ...defaultFormState,
        actionPlanId: planId ? String(planId) : prev.actionPlanId,
      }));
      if (planId && typeof setSelectedActionPlanId === "function") {
        const numericPlanId = Number(planId);
        setSelectedActionPlanId(Number.isFinite(numericPlanId) ? numericPlanId : planId);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("iset:intervention-assessment:select", handleSelect);
      window.addEventListener("iset:intervention-assessment:new", handleNew);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("iset:intervention-assessment:select", handleSelect);
        window.removeEventListener("iset:intervention-assessment:new", handleNew);
      }
    };
  }, [
    caseId,
    hasBlockingProposal,
    resolveStoredStep,
    setSelectedActionPlanId,
    setSelectedInterventionId,
  ]);

  useEffect(() => {
    const plans = caseData?.actionPlans || [];
    if (!plans.length) return;
    const isDraftStatusValue = value => String(value || "").toLowerCase() === "draft";
    const isChangesRequestedValue = value => String(value || "").toLowerCase() === "changes_requested";
    const isSubmittedValue = value => String(value || "").toLowerCase() === "submitted";
    const findById = interventionId => {
      const target = String(interventionId);
      for (const plan of plans) {
        const list = Array.isArray(plan.interventions) ? plan.interventions : [];
        const match = list.find(item => String(item?.id) === target);
        if (match) return match;
      }
      return null;
    };
    const pickLatestDraft = list => {
      const sorted = list
        .filter(
          item =>
            isDraftStatusValue(item?.status) ||
            isChangesRequestedValue(item?.status) ||
            isSubmittedValue(item?.status)
        )
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      return sorted[0] || null;
    };

    const hydrate = draft => {
      if (!draft) return;
      const metadata = draft.metadata || {};
      const revision = normalizeRevisionContext(metadata.revision);
      const review = metadata.review && typeof metadata.review === "object" ? metadata.review : {};
      const storedStepKey = caseId && draft.id ? `${caseId}:${draft.id}` : null;
      const storedDraft = resolveStoredDraft(storedStepKey);
      const proposed = normalizeProposedInterventions(metadata.proposedInterventions || metadata.proposed_interventions);
      let nextProposed = proposed;
      if (!nextProposed.length) {
        nextProposed = [
          buildEmptyIntervention({
            id: buildUuid(),
            code: metadata.snapshot?.code || draft.code || "",
            startDate: metadata.snapshot?.startDate || draft.startDate || "",
            endDate: metadata.snapshot?.endDate || draft.endDate || "",
            deliveryMode: metadata.snapshot?.deliveryMode === "in_house" ? "in_house" : "partner",
            institution: metadata.snapshot?.institution || draft.institution || "",
            programName: metadata.snapshot?.programName || draft.programName || "",
            itpDetails: metadata.snapshot?.itpDetails || "",
            wageSubsidyDetails: metadata.snapshot?.wageSubsidyDetails || "",
            interventionNoc: metadata.snapshot?.nocCode || draft.noc || "",
            interventionNocVersion: metadata.snapshot?.nocVersion || draft.nocVersion || "",
            costLines: Array.isArray(metadata.snapshot?.costLines)
              ? metadata.snapshot.costLines.map(normalizeCostLine).filter(Boolean)
              : [],
          }),
        ];
      }
      if (revision && nextProposed.length > 1) {
        nextProposed = nextProposed.slice(0, 1);
      }
      const mappedBarriers = Array.isArray(metadata.barriers)
        ? metadata.barriers
            .map(val => BARRIER_OPTIONS.find(opt => opt.value === (val.value || val)))
            .filter(Boolean)
        : [];
      const normalizedOtherFunding = normalizeOtherFundingDetails(
        metadata.otherFundingDetails
      );
      const hydratedForm = {
        ...defaultFormState,
        actionPlanId: draft.actionPlanId ? String(draft.actionPlanId) : form.actionPlanId,
        rationale: metadata.rationale || draft.notes || "",
        otherFundingInvolved: normalizedOtherFunding.involved,
        otherFundingSources: normalizedOtherFunding.sources,
        otherFundingNwacCoverage: normalizedOtherFunding.nwacCoverage,
        otherFundingNotes: normalizedOtherFunding.notes,
        childcareNeed: metadata.childcareNeed || "",
        childcareFunding: metadata.childcareFunding || "",
        barriers: mappedBarriers,
        proposedInterventions: nextProposed,
        eiVerificationStatus: review.eiStatus || "",
        eiVerificationNotes: review.eiNotes || "",
        decisionOutcome: review.decision || "",
        decisionNotes: review.decisionNotes || "",
        eiVerificationDocumentId: review.eiDocumentId || null,
      };
      const nextForm = storedDraft && hasMeaningfulDraft(storedDraft)
        ? mergeStoredDraft(hydratedForm, storedDraft)
        : hydratedForm;
      setForm(nextForm);
      initialFormRef.current = nextForm;
      if (draft.actionPlanId && typeof setSelectedActionPlanId === "function") {
        setSelectedActionPlanId(draft.actionPlanId);
      }
      if (draft.id && typeof setSelectedInterventionId === "function") {
        setSelectedInterventionId(draft.id);
      }
      const draftStatus = String(draft.status || "").toLowerCase();
      const stepIds = draftStatus === "submitted" ? [...BASE_STEP_IDS, ...SUBMITTED_STEP_IDS] : BASE_STEP_IDS;
      const storedStep = resolveStoredStep(storedStepKey, stepIds);
      const nextStep = storedStep || BASE_STEP_IDS[0];
      setHydratedDraftId(draft.id || null);
      setHydratedDraftUpdatedAt(draft.updatedAt || draft.createdAt || null);
      setCurrentInterventionStatus(draftStatus || null);
      setRevisionContext(revision);
      setCompletionNote(null);
      setAttemptedSteps({});
      setCurrentStep(nextStep);
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      setEiVerificationUploadError(null);
      setEiVerificationUploadSuccess(null);
      setEiVerificationUploading(false);
    };

    const resolved = selectedDraftId ? findById(selectedDraftId) : null;
    if (resolved) {
      const updatedAt = resolved.updatedAt || resolved.createdAt || null;
      if (resolved.id === hydratedDraftId && updatedAt === hydratedDraftUpdatedAt) return;
      hydrate(resolved);
      return;
    }

    if (selectedDraftId && !resolved) return;

    const fallbackDraft = pickLatestDraft(plans.flatMap(plan => plan.interventions || []));
    if (fallbackDraft) {
      const updatedAt = fallbackDraft.updatedAt || fallbackDraft.createdAt || null;
      if (fallbackDraft.id === hydratedDraftId && updatedAt === hydratedDraftUpdatedAt) return;
      hydrate(fallbackDraft);
    }
  }, [
    caseData,
    caseId,
    form.actionPlanId,
    hasMeaningfulDraft,
    hydratedDraftId,
    hydratedDraftUpdatedAt,
    mergeStoredDraft,
    resolveStoredDraft,
    resolveStoredStep,
    selectedDraftId,
    setSelectedActionPlanId,
    setSelectedInterventionId,
  ]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [form]
  );

  const requiresPrimaryNoc = useMemo(
    () => Boolean(primaryIntervention?.code && requiresNocForCode(primaryIntervention.code)),
    [primaryIntervention]
  );
  const hasPrimaryNoc = useMemo(
    () => Boolean(primaryIntervention?.interventionNocVersion && primaryIntervention?.interventionNoc),
    [primaryIntervention]
  );
  const canAutoSave = useMemo(
    () =>
      Boolean(
        form.actionPlanId &&
          primaryIntervention?.code &&
          primaryIntervention?.startDate &&
          (!requiresPrimaryNoc || hasPrimaryNoc)
      ),
    [form.actionPlanId, primaryIntervention, requiresPrimaryNoc, hasPrimaryNoc]
  );

  const serializeCostLine = useCallback(line => {
    const recurrence = line?.recurrence || {};
    const payee = line?.payee || {};
    const payeeType = typeof payee.type === "string" ? payee.type.trim() : "";
    const payeeName = typeof payee.name === "string" ? payee.name.trim() : "";
    const payeeReference = typeof payee.reference === "string" ? payee.reference.trim() : "";
    const occurrencesValue =
      recurrence.occurrences === "" || recurrence.occurrences === null || typeof recurrence.occurrences === "undefined"
        ? null
        : Number(recurrence.occurrences);
    const occurrences = Number.isFinite(occurrencesValue) ? occurrencesValue : null;
    return {
      id: line?.id || buildUuid(),
      type: line?.type || null,
      amount: parseCurrencyInput(line?.amount),
      notes: line?.notes || null,
      payee:
        payeeType || payeeName || payeeReference
          ? {
              type: payeeType || null,
              name: payeeName || null,
              reference: payeeReference || null,
            }
          : null,
      recurrence: {
        enabled: Boolean(recurrence.enabled),
        startDate: formatDate(recurrence.startDate) || null,
        endDate: formatDate(recurrence.endDate) || null,
        occurrences,
        amountPerPeriod: parseCurrencyInput(recurrence.amountPerPeriod),
      },
    };
  }, []);

  const serializeProposedInterventions = useCallback(
    interventions => {
      const list = Array.isArray(interventions) ? interventions.filter(item => item.code || item.startDate || item.endDate) : [];
      if (!list.length) return [];
      return list.map(item => ({
        id: item.id || buildUuid(),
        code: item.code || null,
        startDate: formatDate(item.startDate) || null,
        endDate: formatDate(item.endDate) || null,
        deliveryMode: item.deliveryMode === "in_house" ? "in_house" : "partner",
        institution: item.institution || null,
        programName: item.programName || null,
        itpDetails: item.itpDetails || null,
        wageSubsidyDetails: item.wageSubsidyDetails || null,
        interventionNoc: item.interventionNoc || null,
        interventionNocVersion: item.interventionNocVersion || null,
        suggestionsSeeded: Boolean(item.suggestionsSeeded),
        costLines: Array.isArray(item.costLines) ? item.costLines.map(serializeCostLine) : [],
      }));
    },
    [serializeCostLine]
  );

  const validateProposal = useCallback(
    () => {
      const errors = {};
      const interventionErrors = {};
      const costLineErrors = {};
      if (!form.actionPlanId) {
        errors.actionPlanId = "Action Plan is required.";
      }
      if (!form.rationale || !form.rationale.trim()) {
        errors.rationale = "Rationale is required.";
      }
      if (!proposedInterventions.length) {
        interventionErrors._global = "Add at least one proposed intervention.";
      }
      proposedInterventions.forEach(intervention => {
        const entryErrors = {};
        if (!intervention.code) entryErrors.code = "Select an intervention code.";
        if (!intervention.startDate) entryErrors.startDate = "Start date is required.";
        const startUtc = parseIsoDateToUtc(intervention.startDate);
        const endUtc = parseIsoDateToUtc(intervention.endDate);
        if (startUtc !== null && endUtc !== null && endUtc < startUtc) {
          entryErrors.endDate = "End date cannot be before start date.";
        }
        const requiresNocCode = requiresNocForCode(intervention.code);
        if (requiresNocCode) {
          if (!intervention.interventionNocVersion) {
            entryErrors.interventionNocVersion = "Select a NOC version for this intervention.";
          }
          if (!intervention.interventionNoc) {
            entryErrors.interventionNoc = "Select a NOC code for this intervention.";
          }
        }
        const educationCode = isEducationCode(intervention.code);
        const employerCode = isEmployerCode(intervention.code);
        const wageSubsidyCode = isWageSubsidyCode(intervention.code);
        if (educationCode) {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = "Training institution is required for this intervention code.";
          }
          if (!intervention.itpDetails || !intervention.itpDetails.trim()) {
            entryErrors.itpDetails = "ITP details are required for this intervention code.";
          }
        }
        if (employerCode) {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = "Employer / delivery partner is required for this intervention code.";
          }
          if (wageSubsidyCode && (!intervention.wageSubsidyDetails || !intervention.wageSubsidyDetails.trim())) {
            entryErrors.wageSubsidyDetails = "Wage subsidy details are required for this intervention code.";
          }
        }
        if (!educationCode && !employerCode && intervention.deliveryMode !== "in_house") {
          if (!intervention.institution || !intervention.institution.trim()) {
            entryErrors.institution = "Delivery partner is required when using external delivery.";
          }
        }
        if (Object.keys(entryErrors).length) {
          interventionErrors[intervention.id] = entryErrors;
        }
        const lines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const lineErrors = {};
        lines.forEach(line => {
          const detailErrors = {};
          if (!line.type) detailErrors.type = "Select a cost item.";
          const amount = parseCurrencyInput(line.amount);
          if (line.amount === "" || amount === null || !Number.isFinite(amount) || amount < 0) {
            detailErrors.amount = "Enter a valid amount in dollars.";
          }
          const recurrenceMode = getRecurrenceModeForType(line.type);
          const recurrenceRequired = recurrenceMode === RECURRENCE_MODE_REQUIRED;
          const recurrenceEnabled = Boolean(line.recurrence?.enabled);
          if ((recurrenceRequired || recurrenceEnabled) && !isRecurrenceScheduleComplete(line)) {
            detailErrors.recurrence = "Complete the installments schedule.";
          }
          if (Object.keys(detailErrors).length) {
            lineErrors[line.id] = detailErrors;
          }
        });
        if (Object.keys(lineErrors).length) {
          costLineErrors[intervention.id] = lineErrors;
        }
      });
      if (Object.keys(interventionErrors).length) {
        errors.interventions = interventionErrors;
      }
      if (Object.keys(costLineErrors).length) {
        errors.costLines = costLineErrors;
      }
      return errors;
    },
    [form.actionPlanId, form.rationale, proposedInterventions, getRecurrenceModeForType]
  );

  const buildProposalPayload = useCallback(
    statusValue => {
      const proposedPayload = serializeProposedInterventions(
        isRevisionMode ? proposedInterventions.slice(0, 1) : proposedInterventions
      );
      const primary = primaryIntervention;
      const primaryStartDate = primary?.startDate || "";
      const primaryEndDate = primary?.endDate || "";
      const interventionDuration = calculateDurationDays(primaryStartDate, primaryEndDate);
      const primaryCost = Number.isFinite(interventionTotals.get(primary?.id)) ? interventionTotals.get(primary?.id) : 0;
      const normalizedOtherFunding = normalizeOtherFundingDetails(
        {
          involved: form.otherFundingInvolved,
          sources: form.otherFundingSources,
          nwacCoverage: form.otherFundingNwacCoverage,
          notes: form.otherFundingNotes,
        }
      );
      return {
        code: primary?.code || null,
        title: resolveInterventionLabel(primary?.code) || "Draft intervention",
        status: statusValue,
        startDate: primaryStartDate || null,
        endDate: primaryEndDate || null,
        durationDays: interventionDuration !== null ? String(interventionDuration) : null,
        cost: primaryCost,
        notes: form.rationale || "",
        noc: primary?.interventionNoc || null,
        nocVersion: primary?.interventionNocVersion || null,
        metadata: {
          ...(isRevisionMode && revisionContext
            ? {
                revision: {
                  kind: revisionContext.kind || "approved_intervention",
                  sourceInterventionId: revisionContext.sourceInterventionId,
                  sourceActionPlanId: revisionContext.sourceActionPlanId || null,
                  sourceStatus: revisionContext.sourceStatus || null,
                  sourceTitle: revisionContext.sourceTitle || null,
                  openedAt: revisionContext.openedAt || null,
                },
              }
            : {}),
          proposedInterventions: proposedPayload.length ? proposedPayload : null,
          rationale: form.rationale || "",
          barriers: Array.isArray(form.barriers) ? form.barriers.map(item => item.value || item) : [],
          otherFundingDetails: normalizedOtherFunding,
          childcareNeed: form.childcareNeed || "",
          childcareFunding: form.childcareFunding || "",
          review: {
            eiStatus: form.eiVerificationStatus || "",
            eiNotes: form.eiVerificationNotes || "",
            decision: form.decisionOutcome || "",
            decisionNotes: form.decisionNotes || "",
            eiDocumentId: form.eiVerificationDocumentId || null,
          },
        },
      };
    },
    [
      form,
      isRevisionMode,
      primaryIntervention,
      proposedInterventions,
      revisionContext,
      serializeProposedInterventions,
      interventionTotals,
      resolveInterventionLabel,
    ]
  );

  const findEditableDraft = useCallback(() => {
    const plans = caseData?.actionPlans || [];
    if (selectedDraftId) {
      const match = plans.flatMap(plan => plan.interventions || []).find(item => String(item.id) === String(selectedDraftId));
      if (match) return match;
    }
    const match = plans
      .flatMap(plan => plan.interventions || [])
      .find(item => ["draft", "changes_requested"].includes(String(item?.status || "").toLowerCase()));
    return match || null;
  }, [caseData, selectedDraftId]);

  const handleSave = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setError(null);
        setSuccessMessage("");
      }
      if (!isEditable) {
        const message = "This proposal is read-only and cannot be updated.";
        if (!silent) {
          setError(message);
        }
        return { ok: false, error: new Error(message) };
      }
      if (!form.actionPlanId) {
        const message = "Select an Action Plan before saving.";
        if (!silent) {
          setError(message);
        }
        return { ok: false, error: new Error(message) };
      }
      const targetStatus = isSubmittedStatus ? "submitted" : "draft";
      const payload = buildProposalPayload(targetStatus);
      setIsSubmitting(true);
      try {
        const submittedTargetId =
          isSubmittedStatus && activeInterventionIdValue
            ? Number(activeInterventionIdValue)
            : null;
        const existingDraft = findEditableDraft();
        const actionPlanId = Number(form.actionPlanId);
        if (
          Number.isInteger(submittedTargetId) &&
          submittedTargetId > 0 &&
          typeof updateInterventionRecord === "function"
        ) {
          const updated = await updateInterventionRecord(actionPlanId, submittedTargetId, payload);
          setSelectedDraftId(updated?.id || submittedTargetId);
          setHydratedDraftId(updated?.id || submittedTargetId);
          setHydratedDraftUpdatedAt(updated?.updatedAt || updated?.createdAt || null);
        } else if (existingDraft && typeof updateInterventionRecord === "function") {
          const updated = await updateInterventionRecord(actionPlanId, existingDraft.id, payload);
          setSelectedDraftId(updated?.id || existingDraft.id);
          setHydratedDraftId(updated?.id || existingDraft.id);
          setHydratedDraftUpdatedAt(updated?.updatedAt || updated?.createdAt || null);
        } else if (typeof createIntervention === "function") {
          const created = await createIntervention(actionPlanId, payload);
          setSelectedDraftId(created?.id || null);
          setHydratedDraftId(created?.id || null);
          setHydratedDraftUpdatedAt(created?.updatedAt || created?.createdAt || null);
          if (typeof setSelectedInterventionId === "function") {
            setSelectedInterventionId(created?.id || null);
          }
        }
        setCurrentInterventionStatus(targetStatus);
        if (!silent) {
          setSuccessMessage(targetStatus === "submitted" ? "Changes saved." : "Progress saved.");
        }
        initialFormRef.current = form;
        return { ok: true };
      } catch (err) {
        const message = err?.message || "Failed to save progress.";
        if (!silent) {
          setError(message);
        }
        return { ok: false, error: err || new Error(message) };
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      buildProposalPayload,
      createIntervention,
      findEditableDraft,
      form,
      activeInterventionIdValue,
      isEditable,
      isSubmittedStatus,
      setSelectedInterventionId,
      updateInterventionRecord,
    ]
  );

  const validateStep = useCallback(
    stepId => {
      const errors = validateProposal();
      if (stepId === "plan") return !errors.actionPlanId;
      if (stepId === "framing") {
        const interventionErrors = errors.interventions || {};
        if (interventionErrors._global) return false;
        return !Object.values(interventionErrors).some(
          entry => entry && (entry.code || entry.startDate || entry.endDate)
        );
      }
      if (stepId === "rationale") return !errors.rationale;
      if (stepId === "cost") return !errors.costLines || Object.keys(errors.costLines).length === 0;
      return true;
    },
    [validateProposal]
  );

  const handleSubmitProposal = useCallback(
    async event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setError(null);
      setSuccessMessage("");
      if (!isEditable) {
        setError("This proposal is read-only and cannot be submitted.");
        return;
      }
      if (!form.actionPlanId) {
        setError("Select an Action Plan before submitting the proposal.");
        return;
      }
      const invalidSteps = REQUIRED_STEP_IDS.filter(stepId => !validateStep(stepId));
      if (invalidSteps.length > 0) {
        setAttemptedSteps(prev => ({ ...prev, [invalidSteps[0]]: true }));
        setCurrentStep(invalidSteps[0]);
        setError("Complete required fields before submitting.");
        return;
      }
      setIsSubmitting(true);
      try {
        const payload = buildProposalPayload("submitted");
        const existingDraft = findEditableDraft();
        const actionPlanId = Number(form.actionPlanId);
        const saved = existingDraft && typeof updateInterventionRecord === "function"
          ? await updateInterventionRecord(actionPlanId, existingDraft.id, payload)
          : await createIntervention(actionPlanId, payload);
        if (saved?.id) {
          setSelectedDraftId(saved.id);
          setHydratedDraftId(saved.id);
          setHydratedDraftUpdatedAt(saved.updatedAt || saved.createdAt || null);
          if (typeof setSelectedInterventionId === "function") {
            setSelectedInterventionId(saved.id);
          }
        }
        setCurrentInterventionStatus("submitted");
        setSuccessMessage("Proposal submitted for approval.");
      } catch (err) {
        setError(err?.message || "Failed to submit proposal.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      buildProposalPayload,
      createIntervention,
      findEditableDraft,
      form.actionPlanId,
      isEditable,
      setSelectedInterventionId,
      updateInterventionRecord,
      validateStep,
    ]
  );

  const uploadEiVerificationIfSelected = useCallback(
    async ({ interventionId } = {}) => {
      if (isFormLocked) return true;
      if (!eiVerificationFile) return true;
      if (!form.eiVerificationStatus) {
        setEiVerificationUploadError("Select an eligibility value to upload the document.");
        return false;
      }
      if (!applicantUserId) {
        setEiVerificationUploadError("Unable to determine the applicant for this upload.");
        return false;
      }
      if (!interventionId) {
        setEiVerificationUploadError("Save progress to create the intervention record before uploading EI verification.");
        return false;
      }
      setEiVerificationUploading(true);
      setEiVerificationUploadError(null);
      setEiVerificationUploadSuccess(null);
      try {
        const formData = new FormData();
        formData.append("file", eiVerificationFile);
        formData.append("label", "EI Verification");
        formData.append("documentType", "ei_verification");
        if (caseId) formData.append("caseId", caseId);
        formData.append("interventionId", interventionId);
        const response = await apiFetch(`/api/applicants/${applicantUserId}/documents/upload`, {
          method: "POST",
          body: formData,
        });
        if (!response || !response.ok) {
          let payload = null;
          try {
            payload = await response.json();
          } catch (_) {
            payload = null;
          }
          const errorCode = payload?.error || null;
          if (errorCode === "unsupported_file_type") {
            throw new Error("That file type is not allowed. Please upload a PDF, Word (.doc or .docx), JPG, PNG, BMP, or TIFF file.");
          }
          if (errorCode === "file_too_large") {
            throw new Error("The file is too large to upload.");
          }
          if (errorCode === "application_required_for_document") {
            throw new Error("Save progress to link an application before uploading this document.");
          }
          if (errorCode === "invalid_document_type") {
            throw new Error("The EI Verification document type is not available.");
          }
          throw new Error(payload?.message || "Failed to upload EI verification document.");
        }
        const payload = await response.json().catch(() => ({}));
        const documentId = payload?.document?.id || null;
        if (documentId) {
          setForm(prev => ({ ...prev, eiVerificationDocumentId: documentId }));
        }
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
          window.dispatchEvent(
            new CustomEvent("iset:supporting-documents:refresh", { detail: { applicantUserId } })
          );
        }
        const uploadedName = eiVerificationFile?.name || "document";
        setEiVerificationUploadSuccess(`Uploaded ${uploadedName}.`);
        setEiVerificationFile(null);
        setEiVerificationFileError(null);
        return true;
      } catch (err) {
        setEiVerificationUploadError(err?.message || "Failed to upload EI verification document.");
        return false;
      } finally {
        setEiVerificationUploading(false);
      }
    },
    [apiFetch, applicantUserId, caseId, eiVerificationFile, form.eiVerificationStatus, isFormLocked]
  );

  const addCaseNote = useCallback(
    async (title, body) => {
      if (!caseId) return;
      const noteBody = `${title}\n${body}`.trim();
      await apiFetch(`/api/cases/${caseId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("case-notes-refresh", { detail: { caseId } }));
      }
    },
    [apiFetch, caseId]
  );

  const linkEiDocumentToInterventions = useCallback(
    async (documentId, interventionIds) => {
      if (!documentId || !Array.isArray(interventionIds) || interventionIds.length === 0) return;
      await apiFetch(`/api/documents/${documentId}/link-interventions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionIds }),
      });
    },
    [apiFetch]
  );

  const buildApprovedInterventionPayload = useCallback(
    (intervention, { approvedStatus = "approved", potId = null, postingContext = null } = {}) => {
      const totalCost = interventionTotals.get(intervention.id) || 0;
      const durationDays = calculateDurationDays(intervention.startDate, intervention.endDate);
      const approvedCostLines = Array.isArray(intervention.costLines)
        ? intervention.costLines.filter(hasApprovedFundingAmount).map(serializeCostLine)
        : [];
      return {
        code: intervention.code || null,
        title: resolveInterventionLabel(intervention.code) || "Intervention",
        status: approvedStatus,
        startDate: intervention.startDate || null,
        endDate: intervention.endDate || null,
        durationDays: durationDays !== null ? String(durationDays) : null,
        cost: totalCost,
        notes: form.rationale || "",
        noc: intervention.interventionNoc || null,
        nocVersion: intervention.interventionNocVersion || null,
        potId: potId || null,
        postingContext: postingContext || null,
        metadata: {
          snapshot: {
            code: intervention.code || null,
            startDate: intervention.startDate || null,
            endDate: intervention.endDate || null,
            deliveryMode: intervention.deliveryMode,
            institution: intervention.institution || "",
            programName: intervention.programName || "",
            itpDetails: intervention.itpDetails || "",
            wageSubsidyDetails: intervention.wageSubsidyDetails || "",
            nocVersion: intervention.interventionNocVersion || "",
            nocCode: intervention.interventionNoc || "",
            costLines: approvedCostLines,
          },
          costLines: approvedCostLines,
          rationale: form.rationale || "",
          barriers: Array.isArray(form.barriers) ? form.barriers.map(item => item.value || item) : [],
          otherFundingDetails: normalizeOtherFundingDetails(
            {
              involved: form.otherFundingInvolved,
              sources: form.otherFundingSources,
              nwacCoverage: form.otherFundingNwacCoverage,
              notes: form.otherFundingNotes,
            }
          ),
          childcareNeed: form.childcareNeed || "",
          childcareFunding: form.childcareFunding || "",
          review: {
            eiStatus: form.eiVerificationStatus || "",
            decision: "approved",
            eiDocumentId: form.eiVerificationDocumentId || null,
          },
        },
      };
    },
    [form, interventionTotals, resolveInterventionLabel, serializeCostLine]
  );

  const resetProposalState = useCallback(
    () => {
      const keysToClear = [];
      if (caseId) {
        if (activeInterventionIdValue) {
          keysToClear.push(`${caseId}:${activeInterventionIdValue}`);
        }
        keysToClear.push(`${caseId}:draft`);
      }
      if (typeof clearInterventionWizardDraft === "function") {
        keysToClear.forEach(key => clearInterventionWizardDraft(key));
      }
      if (typeof clearInterventionWizardStep === "function") {
        keysToClear.forEach(key => clearInterventionWizardStep(key));
      }

      setSelectedDraftId(null);
      setHydratedDraftId(null);
      setHydratedDraftUpdatedAt(null);
      setCurrentInterventionStatus(null);
      setRevisionContext(null);
      if (typeof setSelectedInterventionId === "function") {
        setSelectedInterventionId(null);
      }

      const nextForm = { ...defaultFormState };
      setForm(nextForm);
      initialFormRef.current = nextForm;
      setCurrentStep(BASE_STEP_IDS[0]);
      setAttemptedSteps({});
      setDecisionBlockerVisible(false);
      setDecisionBlockerReasons([]);
      setDecisionBlockerTargetStep(null);
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      setEiVerificationUploadError(null);
      setEiVerificationUploadSuccess(null);
    },
    [
      activeInterventionIdValue,
      caseId,
      clearInterventionWizardDraft,
      clearInterventionWizardStep,
      setRevisionContext,
      setSelectedInterventionId,
    ]
  );

  const resolvedApprovalPotId = useMemo(() => {
    const draftPotId = String(actionPlanFundingDraft.budgetPot || "").trim();
    if (draftPotId) return draftPotId;
    return selectedPlanBudgetPot || "";
  }, [actionPlanFundingDraft.budgetPot, selectedPlanBudgetPot]);

  const resolvedApprovalPostingContext = useMemo(() => {
    const draftPostingContext = String(actionPlanFundingDraft.postingContext || "").trim().toLowerCase();
    if (draftPostingContext) return draftPostingContext;
    return selectedPlanPostingContext || "external";
  }, [actionPlanFundingDraft.postingContext, selectedPlanPostingContext]);

  const ensureActionPlanFundingReadyForApproval = useCallback(async () => {
    if (!needsActionPlanFundingSetup || !selectedPlan?.id) {
      return { ok: true };
    }
    const validationErrors = validateActionPlanFundingDraft(actionPlanFundingDraft);
    if (Object.keys(validationErrors).length) {
      setActionPlanFundingErrors(validationErrors);
      return { ok: false };
    }

    const nextFundingStream = normalizeFundingStream(actionPlanFundingDraft.fundingStream);
    const nextBudgetPot = String(actionPlanFundingDraft.budgetPot || "").trim();
    const nextPostingContext =
      String(actionPlanFundingDraft.postingContext || "").trim().toLowerCase() || "external";
    const selectedFundingStream = normalizeFundingStream(selectedPlanFundingStream);
    const selectedBudgetPot = String(selectedPlanBudgetPot || "").trim();
    const selectedPosting = String(selectedPlanPostingContext || "external").trim().toLowerCase() || "external";

    if (
      nextFundingStream === selectedFundingStream &&
      nextBudgetPot === selectedBudgetPot &&
      nextPostingContext === selectedPosting
    ) {
      setActionPlanFundingErrors({});
      return { ok: true };
    }

    setActionPlanFundingSaving(true);
    try {
      await updateActionPlan(selectedPlan.id, {
        name: selectedPlan.title || `Action Plan ${selectedPlan.id}`,
        startDate: selectedPlan.startDate || null,
        reviewDate: selectedPlan.endDate || null,
        summary: selectedPlan.summary || null,
        fundingStream: nextFundingStream || null,
        budgetPot: nextBudgetPot || null,
        postingContext: nextPostingContext || "external",
      });
      setActionPlanFundingErrors({});
      await refresh().catch(() => {});
      return { ok: true };
    } catch (err) {
      const nextErrors = {};
      if (err?.code === "funding_stream_required") {
        nextErrors.fundingStream = err?.message || "Funding stream is required.";
      } else if (err?.code === "budget_pot_not_found") {
        nextErrors.budgetPot = err?.message || "Budget pot not found.";
      } else if (
        ["missing_internal_gl_code", "missing_external_gl_code", "posting_context_not_permitted"].includes(err?.code)
      ) {
        nextErrors.postingContext = err?.message || "Check Paid from selection.";
      }
      if (Object.keys(nextErrors).length) {
        setActionPlanFundingErrors(nextErrors);
      }
      setError(err?.message || "Failed to update action plan funding settings.");
      return { ok: false, error: err };
    } finally {
      setActionPlanFundingSaving(false);
    }
  }, [
    actionPlanFundingDraft,
    needsActionPlanFundingSetup,
    refresh,
    selectedPlan,
    selectedPlanBudgetPot,
    selectedPlanFundingStream,
    selectedPlanPostingContext,
    updateActionPlan,
    validateActionPlanFundingDraft,
  ]);

  const getDecisionBlockingIssues = useCallback(
    ({ requireActiveIntervention = true } = {}) => {
      const outcome = String(form.decisionOutcome || "").trim().toLowerCase();
      const reasons = [];
      let targetStep = null;
      if (!outcome) {
        reasons.push("Select a decision outcome in the decision step.");
        targetStep = "decision";
      }
      if (outcome === "approved") {
        if (!form.eiVerificationStatus) {
          reasons.push("Set EI eligibility for approval.");
          targetStep = targetStep || "decision";
        }
        if (!form.eiVerificationDocumentId && !eiVerificationFile) {
          reasons.push("Upload an EI verification document to approve.");
          targetStep = targetStep || "decision";
        }
        if (hasPlanFundingMismatch) {
          reasons.push(`Action Plan funding stream must match EI eligibility (${requiredFundingStream}).`);
          targetStep = targetStep || "decision";
        }
        if (needsActionPlanFundingSetup) {
          const fundingErrors = validateActionPlanFundingDraft(actionPlanFundingDraft);
          if (fundingErrors.fundingStream) {
            reasons.push(fundingErrors.fundingStream);
            targetStep = targetStep || "decision";
          }
          if (fundingErrors.budgetPot) {
            reasons.push("Select a budget pot for the parent Action Plan.");
            targetStep = targetStep || "decision";
          }
          if (fundingErrors.postingContext) {
            reasons.push("Select where the parent Action Plan budget pot is paid from.");
            targetStep = targetStep || "decision";
          }
        }
      }
      if (outcome === "changes_requested" && !form.decisionNotes.trim()) {
        reasons.push("Request changes requires a note.");
        targetStep = targetStep || "decision";
      }
      if (outcome === "rejected" && !form.decisionNotes.trim()) {
        reasons.push("Rejection requires a note.");
        targetStep = targetStep || "decision";
      }
      if (requireActiveIntervention && !activeInterventionIdValue) {
        reasons.push("Select a submitted proposal before submitting a decision.");
        targetStep = targetStep || "decision";
      }
      if (!Number(form.actionPlanId)) {
        reasons.push("Action Plan is required.");
        targetStep = targetStep || "plan";
      }
      return { reasons, targetStep };
    },
    [
      activeInterventionIdValue,
      eiVerificationFile,
      form.actionPlanId,
      form.decisionNotes,
      form.decisionOutcome,
      form.eiVerificationDocumentId,
      form.eiVerificationStatus,
      actionPlanFundingDraft,
      hasPlanFundingMismatch,
      needsActionPlanFundingSetup,
      requiredFundingStream,
      validateActionPlanFundingDraft,
    ]
  );

  const handleSubmitDecision = useCallback(
    async event => {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setError(null);
      setSuccessMessage("");
      setAttemptedSteps(prev => ({ ...prev, decision: true }));
      if (!canDecideSubmittedProposal) {
        setError("Only approver roles can record a decision on a submitted proposal.");
        return { ok: false };
      }
      if (!isEditable) {
        setError("This proposal is read-only and cannot be updated.");
        return { ok: false };
      }
      if (!isSubmittedStatus) {
        setError("Only submitted proposals can be decided.");
        return { ok: false };
      }
      const outcome = form.decisionOutcome;
      const { reasons, targetStep } = getDecisionBlockingIssues({ requireActiveIntervention: true });
      if (reasons.length) {
        if (needsActionPlanFundingSetup) {
          setActionPlanFundingErrors(validateActionPlanFundingDraft(actionPlanFundingDraft));
        }
        setDecisionBlockerReasons(reasons);
        setDecisionBlockerTargetStep(targetStep);
        setDecisionBlockerVisible(true);
        return { ok: false };
      }
      const actionPlanId = Number(form.actionPlanId);
      setIsSubmitting(true);
      try {
        if (outcome === "approved") {
          const actionPlanFundingResult = await ensureActionPlanFundingReadyForApproval();
          if (!actionPlanFundingResult?.ok) {
            setIsSubmitting(false);
            return { ok: false };
          }
          const approvalPotId = resolvedApprovalPotId || null;
          const approvalPostingContext = resolvedApprovalPostingContext || "external";
          const uploadTargetInterventionId =
            isRevisionMode && revisionSourceInterventionId
              ? revisionSourceInterventionId
              : activeInterventionIdValue;
          const uploadOk = await uploadEiVerificationIfSelected({ interventionId: uploadTargetInterventionId });
          if (!uploadOk) {
            setIsSubmitting(false);
            return { ok: false };
          }
          const interventionsToCreate = proposedInterventions.length
            ? (isRevisionMode ? proposedInterventions.slice(0, 1) : proposedInterventions)
            : [];
          if (!interventionsToCreate.length) {
            setError("Add at least one proposed intervention before approving.");
            return { ok: false };
          }
          if (isRevisionMode && revisionSourceInterventionId) {
            const [primary] = interventionsToCreate;
            const sourceActionPlanId = Number(revisionSourceActionPlanId || form.actionPlanId);
            const primaryPayload = buildApprovedInterventionPayload(primary, {
              approvedStatus: revisionSourceStatus || "approved",
              potId: approvalPotId,
              postingContext: approvalPostingContext,
            });
            const updated = await updateInterventionRecord(
              sourceActionPlanId,
              Number(revisionSourceInterventionId),
              {
                ...primaryPayload,
                revisionAppliedFromInterventionId: Number(activeInterventionIdValue),
              }
            );
            if (form.eiVerificationDocumentId) {
              await linkEiDocumentToInterventions(form.eiVerificationDocumentId, [
                updated?.id || Number(revisionSourceInterventionId),
              ]);
            }
            let cleanupError = null;
            if (
              typeof deleteInterventionRecord === "function" &&
              activeInterventionIdValue &&
              String(activeInterventionIdValue) !== String(revisionSourceInterventionId)
            ) {
              try {
                await deleteInterventionRecord(Number(activeInterventionIdValue));
              } catch (err) {
                cleanupError = err;
              }
            }
            setCurrentInterventionStatus(revisionSourceStatus || "approved");
            resetProposalState();
            setCompletionNote({
              type: cleanupError ? "info" : "success",
              header: cleanupError ? "Revision applied with follow-up needed" : "Revision workflow complete",
              body: cleanupError
                ? `The approved revision was applied to ${revisionSourceTitle}, but the temporary revision draft could not be cleaned up automatically. ${cleanupError.message || "Delete it from the interventions table if needed."}`
                : `The approved revision was applied to ${revisionSourceTitle}.`,
            });
          } else {
            const [primary, ...rest] = interventionsToCreate;
            const primaryPayload = buildApprovedInterventionPayload(primary, {
              potId: approvalPotId,
              postingContext: approvalPostingContext,
            });
            const updated = await updateInterventionRecord(actionPlanId, Number(activeInterventionIdValue), primaryPayload);
            const created = [];
            for (const intervention of rest) {
              const payload = buildApprovedInterventionPayload(intervention, {
                potId: approvalPotId,
                postingContext: approvalPostingContext,
              });
              const row = await createIntervention(actionPlanId, payload);
              if (row?.id) created.push(row.id);
            }
            const allIds = [updated?.id || Number(activeInterventionIdValue), ...created].filter(Boolean);
            if (form.eiVerificationDocumentId) {
              await linkEiDocumentToInterventions(form.eiVerificationDocumentId, allIds);
            }
            setCurrentInterventionStatus("approved");
            setSuccessMessage("Interventions approved and created.");
            resetProposalState();
            setCompletionNote({
              type: "success",
              header: "Intervention workflow complete",
              body: "Approved interventions were created. Start a new proposal from the Interventions table when you are ready.",
            });
          }
        } else {
          const payload = buildProposalPayload(outcome);
          const updated = await updateInterventionRecord(actionPlanId, Number(activeInterventionIdValue), payload);
          setCurrentInterventionStatus(outcome);
          if (outcome === "changes_requested") {
            await addCaseNote("Intervention proposal — Request changes", form.decisionNotes.trim());
          }
          if (outcome === "rejected") {
            await addCaseNote("Intervention proposal — Rejected", form.decisionNotes.trim());
          }
          setSuccessMessage(updated ? "Decision submitted." : "Decision submitted.");
          if (outcome === "rejected") {
            resetProposalState();
            setCompletionNote({
              type: "info",
              header: isRevisionMode ? "Revision closed" : "Proposal closed",
              body: isRevisionMode
                ? `The revision was rejected and ${revisionSourceTitle} was left unchanged.`
                : "The proposal was rejected and closed. Start a new proposal from the Interventions table when needed.",
            });
          }
        }
        return { ok: true };
      } catch (err) {
        setError(err?.message || "Failed to submit decision.");
        return { ok: false, error: err };
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeInterventionIdValue,
      addCaseNote,
      buildApprovedInterventionPayload,
      buildProposalPayload,
      canDecideSubmittedProposal,
      createIntervention,
      deleteInterventionRecord,
      ensureActionPlanFundingReadyForApproval,
      form,
      isEditable,
      isRevisionMode,
      isSubmittedStatus,
      linkEiDocumentToInterventions,
      proposedInterventions,
      resolvedApprovalPotId,
      resolvedApprovalPostingContext,
      resetProposalState,
      revisionSourceActionPlanId,
      revisionSourceInterventionId,
      revisionSourceStatus,
      revisionSourceTitle,
      updateInterventionRecord,
      uploadEiVerificationIfSelected,
      validateActionPlanFundingDraft,
      needsActionPlanFundingSetup,
      actionPlanFundingDraft,
      getDecisionBlockingIssues,
    ]
  );

  const handleEiVerificationFileChange = useCallback(event => {
    const input = event?.target;
    const file = input?.files?.[0] || null;
    if (input) {
      input.value = "";
    }
    setEiVerificationUploadError(null);
    setEiVerificationUploadSuccess(null);
    if (!file) {
      setEiVerificationFile(null);
      setEiVerificationFileError(null);
      return;
    }
    if (!ELIGIBILITY_ALLOWED_MIME_TYPES.includes(file.type)) {
      setEiVerificationFile(null);
      setEiVerificationFileError("Only PDF, Word (.doc or .docx), JPG, PNG, BMP, or TIFF files are allowed.");
      return;
    }
    if (file.size > ELIGIBILITY_MAX_BYTES) {
      setEiVerificationFile(null);
      setEiVerificationFileError("File is too large (max 6 MB).");
      return;
    }
    setEiVerificationFile(file);
    setEiVerificationFileError(null);
  }, []);

  const validationErrors = useMemo(() => validateProposal(), [validateProposal]);
  const showPlanErrors = Boolean(attemptedSteps.plan);
  const showFramingErrors = Boolean(attemptedSteps.framing);
  const showRationaleErrors = Boolean(attemptedSteps.rationale);
  const showCostErrors = Boolean(attemptedSteps.cost);
  const showDecisionErrors = Boolean(attemptedSteps.decision);

  const institutionApprovalLetters = useMemo(
    () =>
      buildInstitutionApprovalLetters({
        interventions: proposedInterventions,
        applicantName: participantLegalName || applicantSalutationName || "Client",
        decisionDate: formatDate(new Date()),
        caseManagerName: currentUserName || "",
        caseManagerEmail: currentUserEmail || "",
        caseManagerPhone: "",
        isRevision: isRevisionMode,
      }),
    [applicantSalutationName, currentUserEmail, currentUserName, isRevisionMode, participantLegalName, proposedInterventions]
  );
  const coFunderApprovalLetters = useMemo(
    () =>
      buildCoFunderApprovalLetters({
        fundingSources: normalizeOtherFundingSources(form.otherFundingSources),
        nwacCoverage: form.otherFundingNwacCoverage,
        notes: form.otherFundingNotes,
        interventions: proposedInterventions,
        applicantName: participantLegalName || applicantSalutationName || "Client",
        trackingReference,
        decisionDate: formatDate(new Date()),
        caseManagerName: currentUserName || "",
        caseManagerEmail: currentUserEmail || "",
        caseManagerPhone: "",
        isRevision: isRevisionMode,
      }),
    [
      applicantSalutationName,
      currentUserEmail,
      currentUserName,
      form.otherFundingNotes,
      form.otherFundingNwacCoverage,
      form.otherFundingSources,
      isRevisionMode,
      participantLegalName,
      proposedInterventions,
      trackingReference,
    ]
  );
  const loanProviderApprovalLetters = useMemo(
    () =>
      buildLoanProviderApprovalLetters({
        interventions: proposedInterventions,
        applicantName: participantLegalName || applicantSalutationName || "Client",
        trackingReference,
        decisionDate: formatDate(new Date()),
        caseManagerName: currentUserName || "",
        caseManagerEmail: currentUserEmail || "",
        caseManagerPhone: "",
        isRevision: isRevisionMode,
      }),
    [
      applicantSalutationName,
      currentUserEmail,
      currentUserName,
      isRevisionMode,
      participantLegalName,
      proposedInterventions,
      trackingReference,
    ]
  );
  const buildApprovedClientLetterBody = useCallback(() => {
    const recipient = String(applicantSalutationName || "").trim() || "Client";
    const interventions = Array.isArray(proposedInterventions) ? proposedInterventions : [];
    const primary = interventions[0] || null;
    const requestPhrase = (() => {
      if (interventions.length > 1) return "to receive support for the approved interventions in your plan";
      const program = String(primary?.programName || "").trim();
      const institution = String(primary?.institution || "").trim();
      if (program && institution) return `to pursue ${program} at ${institution}`;
      if (program) return `to pursue ${program}`;
      if (institution) return `to receive support for training at ${institution}`;
      return "to receive Indigenous Skills and Employment Training (ISET) support";
    })();
    const costLines = interventions.flatMap(intervention =>
      (Array.isArray(intervention?.costLines) ? intervention.costLines : []).map(line => ({ intervention, line }))
    );
    const fundingLines = costLines
      .map(({ intervention, line }) => {
        const amount = parseCurrencyToNumber(line?.amount);
        if (!(amount > 0)) return "";
        const label = formatCostTypeForLetter(line?.type);
        const payee = line?.payee && typeof line.payee === "object" ? line.payee : {};
        const payeeType = String(payee.type || deriveDefaultPayeeTypeForCostLine(line?.type) || "").trim();
        const explicitPayeeName = String(payee.name || "").trim();
        const fallbackPayeeName = deriveDefaultPayeeNameForCostLine(payeeType, intervention, participantLegalName || "");
        const payeeName = explicitPayeeName || fallbackPayeeName;
        const payeeTypeKey = normalizePayeeTypeKey(payeeType);
        const payeePhrase = (() => {
          if (payeeName) return payeeName;
          if (payeeTypeKey === "participantclient" || payeeTypeKey === "client") return "you";
          const target = PAYEE_TYPE_DETAIL_TARGET_BY_KEY[payeeTypeKey] || "";
          return target ? `the ${target}` : "the approved payee";
        })();
        const payableDate = formatInterventionDates(intervention?.startDate, intervention?.endDate);
        const dateClause = payableDate && payableDate !== "—" ? ` for ${payableDate}` : "";
        return `- ${label}: $${Number(amount).toFixed(2)} payable to ${payeePhrase}${dateClause}.`;
      })
      .filter(Boolean);
    const fundingParagraph = fundingLines.length
      ? [
          isRevisionMode ? "The revised approved funding is:" : "The approved funding is:",
          ...fundingLines,
        ].join("\n")
      : isRevisionMode
        ? "The approved funding for your eligible supports under this intervention has been updated."
        : "Funding has been approved for your eligible supports under this intervention.";
    return [
      isRevisionMode ? "Funding Revision Letter" : "Letter of Approval",
      `Date: ${formatDate(new Date())}`,
      "",
      `Dear ${recipient},`,
      "",
      isRevisionMode
        ? `I’m writing with an update about your ISET support. After reviewing the requested changes to your approved intervention, I’m pleased to confirm that the funding for your intervention has been changed as follows. This revised approval will continue to support you ${requestPhrase}.`
        : `I’m pleased to let you know that the Native Women's Association of Canada (NWAC), through its Indigenous Skills and Employment Training (ISET) Program, has approved funding to support you ${requestPhrase}.`,
      "",
      fundingParagraph,
      "",
      isRevisionMode
        ? "I have attached a red-line revised Client Funding Agreement for your review, along with a Banking Details form. When you have a moment, please review and complete any required attachments so we can keep your funding moving without delay."
        : "I have attached the Client Funding Agreement for your review, along with a Banking Details form. When you have a moment, please review and complete the attachments so we can move ahead with your funding deposit.",
      "",
      "If you have any questions, please reach out to me directly. I look forward to continuing to support you through your ISET intervention.",
      "",
      "Sincerely,",
      DEFAULT_ORG_NAME,
    ].join("\n");
  }, [applicantSalutationName, isRevisionMode, participantLegalName, proposedInterventions]);
  const buildDeniedClientLetterBody = useCallback(() => {
    const recipient = String(applicantSalutationName || "").trim() || "Client";
    const reason = buildApplicantFacingReasonSentence(form.decisionNotes, "Our review indicates that");
    return [
      "Letter of Denial",
      `Date: ${formatDate(new Date())}`,
      "",
      `Dear ${recipient},`,
      "",
      "I am writing to let you know that after review of your intervention proposal under the Native Women's Association of Canada (NWAC) Indigenous Skills and Employment Training (ISET) Program, your request is not approved at this time.",
      reason || "Please contact your case manager if you would like to discuss next steps.",
      "",
      "If you have any questions, please do not hesitate to contact me directly.",
      "",
      "Sincerely,",
      DEFAULT_ORG_NAME,
    ].join("\n\n");
  }, [applicantSalutationName, form.decisionNotes]);
  const canGenerateLetterDrafts = (isApprovedDecisionOutcome || isRejectedDecisionOutcome) && !sendingLetter;
  const generateLetterPackDrafts = useCallback(() => {
    if (isApprovedDecisionOutcome) {
      setClientLetterBody(buildApprovedClientLetterBody());
      setApprovalLetterPackGenerated(true);
      return;
    }
    if (isRejectedDecisionOutcome) {
      setClientLetterBody(buildDeniedClientLetterBody());
      setApprovalLetterPackGenerated(true);
    }
  }, [
    buildApprovedClientLetterBody,
    buildDeniedClientLetterBody,
    isApprovedDecisionOutcome,
    isRejectedDecisionOutcome,
  ]);
  const downloadLetterAsText = useCallback((fileName, body) => {
    if (!body || typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || `letter-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);
  const activeLetterWorkflowId = isApprovedDecisionOutcome
    ? letterWorkflows.approval
    : isRejectedDecisionOutcome
      ? letterWorkflows.denial
      : null;
  const handleSendDecisionLetter = useCallback(async ({ interventionId: requestedInterventionId } = {}) => {
    if (!caseId || !activeLetterWorkflowId) {
      setSendingLetterError("Letter workflow is not configured yet.");
      return { ok: false };
    }
      setSendingLetter(true);
      setSendingLetterError(null);
      try {
      const subject = isApprovedDecisionOutcome
        ? (isRevisionMode ? "Funding Revision Approval" : "Letter of Approval")
        : "Letter of Denial";
      const body = String(clientLetterBody || "").trim()
        || (isApprovedDecisionOutcome
          ? (isRevisionMode
            ? "Please review your funding revision letter in the portal."
            : "Please review your approval letter in the portal.")
          : "Please review your decision letter in the portal.");
      const payload = {
        subject,
        body,
        urgent: false,
        toDisplayName: participantLegalName || applicantSalutationName || "Applicant",
        fromDisplayName: currentUserName || "Case Worker",
        attachments: [{ workflow_id: activeLetterWorkflowId }],
      };
      if (applicationId) {
        payload.applicationId = applicationId;
      }
      const parsedInterventionId = Number.parseInt(requestedInterventionId, 10);
      if (Number.isInteger(parsedInterventionId) && parsedInterventionId > 0) {
        payload.interventionId = parsedInterventionId;
      }
      const response = await apiFetch(`/api/cases/${caseId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let detail = "";
        try {
          const data = await response.json();
          if (data && typeof data === "object") {
            if (data.error === "funding_forms_workflows_missing" && Array.isArray(data.missing) && data.missing.length) {
              detail = `Required funding-form workflows are missing: ${data.missing.join(", ")}.`;
            } else {
              detail = data.message || data.error || "";
            }
          }
        } catch (_) {
          detail = await response.text().catch(() => "");
        }
        throw new Error(detail || "Failed to send the decision letter.");
      }
      return { ok: true };
    } catch (err) {
      setSendingLetterError(err?.message || "Failed to send the decision letter.");
      return { ok: false, error: err };
    } finally {
      setSendingLetter(false);
    }
  }, [
    activeLetterWorkflowId,
    applicantSalutationName,
    apiFetch,
    applicationId,
    caseId,
    clientLetterBody,
    currentUserName,
    isApprovedDecisionOutcome,
    isRevisionMode,
    participantLegalName,
  ]);
  const executeCommunicationSubmit = useCallback(async () => {
    const decisionResult = await handleSubmitDecision();
    if (!decisionResult?.ok) return;
    await handleSendDecisionLetter({
      interventionId:
        isRevisionMode && revisionSourceInterventionId
          ? revisionSourceInterventionId
          : activeInterventionIdValue,
    });
  }, [activeInterventionIdValue, handleSendDecisionLetter, handleSubmitDecision, isRevisionMode, revisionSourceInterventionId]);
  const handleSubmitCommunication = useCallback(async () => {
    if (isApprovedDecisionOutcome) {
      setShowSendApprovalLetterConfirmModal(true);
      return;
    }
    await executeCommunicationSubmit();
  }, [executeCommunicationSubmit, isApprovedDecisionOutcome]);
  const handleConfirmSendApprovalLetter = useCallback(async () => {
    if (sendingLetter) return;
    setShowSendApprovalLetterConfirmModal(false);
    await executeCommunicationSubmit();
  }, [executeCommunicationSubmit, sendingLetter]);
  useEffect(() => {
    if (!showCommunicationStep) {
      setApprovalLetterPackGenerated(false);
      setApprovalLetterPackTabId("client");
      setClientLetterBody("");
      setSendingLetterError(null);
    }
  }, [showCommunicationStep]);

  const handleStartAnotherProposal = useCallback(() => {
    setCompletionNote(null);
    setSuccessMessage("");
    setError(null);
  }, []);

  const headerDescription = completionNote
    ? "This intervention workflow is complete."
    : isSubmittedStatus && isEditable && isRevisionMode && !canDecideSubmittedProposal
      ? `Update the submitted revision for ${revisionSourceTitle}. Record of decision is limited to approver roles.`
      : isSubmittedStatus && isEditable && !canDecideSubmittedProposal
        ? "Update the submitted proposal. Record of decision is limited to approver roles."
    : isSubmittedStatus && isEditable && isRevisionMode
      ? `Review the submitted revision for ${revisionSourceTitle}, verify EI status, and record the decision.`
      : isSubmittedStatus && isEditable
        ? "Review the submitted proposal, verify EI status, and record the decision."
        : isEditable && isRevisionMode
          ? `Revise ${revisionSourceTitle}. The approved intervention stays unchanged until this revision is approved.`
          : isEditable
            ? "Propose new interventions for this client. Save progress to finish later. Only one draft proposal can exist at a time."
            : statusValue && isRevisionMode
              ? `Viewing the revision for ${revisionSourceTitle} in read-only mode.`
              : statusValue
                ? "Viewing this proposal in read-only mode."
    : "Select a draft or submitted proposal from the Interventions table to view it here.";

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Proposed interventions", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const planStepContent = (
    <SpaceBetween size="m">
      {isRevisionMode && (
        <Alert type="info">
          This draft revises {revisionSourceTitle}. The approved intervention remains the current record until this revision is approved.
        </Alert>
      )}
      {!planOptions.length ? (
        <Alert type="info">
          No active or draft action plans are available. Create an action plan before proposing interventions.
        </Alert>
      ) : (
        <FormField
          label="Action Plan"
          description={isRevisionMode ? "Choose the action plan this revision belongs to." : "Choose the action plan this proposal belongs to."}
          errorText={showPlanErrors && !form.actionPlanId ? "Action Plan is required." : undefined}
        >
          <Select
            selectedOption={planOptions.find(option => option.value === form.actionPlanId) || null}
            onChange={({ detail }) => {
              const value = detail?.selectedOption?.value || "";
              handleChange("actionPlanId", value);
              if (value) {
                const numericValue = Number(value);
                if (typeof setSelectedActionPlanId === "function") {
                  setSelectedActionPlanId(Number.isFinite(numericValue) ? numericValue : value);
                }
              }
            }}
            options={planOptions}
            placeholder={planOptions.length ? "Select plan" : "No plans available"}
            disabled={isFormLocked || !planOptions.length}
          />
        </FormField>
      )}
      {hasBlockingSubmitted && !isSubmittedStatus && (
        <Alert type="warning">
          A submitted proposal is pending approval. Resolve it before starting a new proposal.
        </Alert>
      )}
      {hasBlockingDraft && !isDraftStatus && !isChangesRequestedStatus && (
        <Alert type="warning">
          A draft proposal already exists. Resume it from the interventions table.
        </Alert>
      )}
    </SpaceBetween>
  );

  const framingErrors = showFramingErrors ? validationErrors.interventions || {} : {};
  const framingGlobalError = showFramingErrors ? framingErrors._global : null;

  const framingStepContent = (
    <SpaceBetween size="l">
      {isRevisionMode && (
        <Alert type="info">
          This revision updates a single approved intervention. Adding or removing interventions is not available in this flow.
        </Alert>
      )}
      <Table
        key={`proposed-interventions-${proposedInterventionsTableVersion}`}
        stripedRows
        variant="embedded"
        trackBy="id"
        items={proposedInterventions}
        resizableColumns
        columnDefinitions={[
          {
            id: "intervention",
            header: "Intervention",
            cell: item => {
              const entryErrors = framingErrors[item.id] || {};
              return (
                <SpaceBetween size="xxs">
                  <Link
                    onFollow={event => {
                      event.preventDefault();
                      openViewInterventionModal(item.id);
                    }}
                  >
                    {resolveInterventionLabel(item.code) || "—"}
                  </Link>
                  {showFramingErrors && entryErrors.code && (
                    <Box color="text-status-error" fontSize="body-s">
                      {entryErrors.code}
                    </Box>
                  )}
                </SpaceBetween>
              );
            },
          },
          {
            id: "dates",
            header: "Dates",
            minWidth: 140,
            cell: item => {
              const entryErrors = framingErrors[item.id] || {};
              const dateError = entryErrors.startDate || entryErrors.endDate;
              return (
                <SpaceBetween size="xxs">
                  <Box>{formatInterventionDates(item.startDate, item.endDate)}</Box>
                  {showFramingErrors && dateError && (
                    <Box color="text-status-error" fontSize="body-s">
                      {dateError}
                    </Box>
                  )}
                </SpaceBetween>
              );
            },
          },
          {
            id: "actions",
            header: "Actions",
            minWidth: 90,
            width: 90,
            cell: item => (
              <Button
                variant="inline-icon"
                iconName="remove"
                ariaLabel="Delete intervention"
                onClick={() => setInterventionDeleteId(item.id)}
                disabled={isFormLocked || isRevisionMode}
              />
            ),
          },
        ]}
        header={
          <Header
            variant="h3"
            actions={
              <Button onClick={openAddInterventionModal} disabled={isFormLocked || isRevisionMode}>
                Add intervention
              </Button>
            }
          >
            Proposed interventions
          </Header>
        }
        empty={<Box textAlign="center">No proposed interventions.</Box>}
      />
      {framingGlobalError && (
        <Box color="text-status-error" fontSize="body-s">
          {framingGlobalError}
        </Box>
      )}
    </SpaceBetween>
  );

  const rationaleStepContent = (
    <SpaceBetween size="m">
      <FormField
        label="Rationale and goals"
        description="Explain why new interventions are needed, referencing outcomes of the last assessment/intervention, remaining gaps, and expected employment results."
        errorText={showRationaleErrors && (!form.rationale || !form.rationale.trim()) ? "Rationale is required." : undefined}
        constraintText={`${form.rationale.split(/\s+/).filter(Boolean).length}/${RATIONALE_WORD_LIMIT} words maximum`}
      >
        <Textarea
          value={form.rationale}
          rows={4}
          onChange={({ detail }) => handleChange("rationale", detail.value)}
          placeholder="Summarize why these interventions are needed and expected outcomes."
          disabled={isFormLocked}
        />
      </FormField>
      <FormField label="Barriers to employment (optional)">
        <Multiselect
          options={BARRIER_OPTIONS}
          selectedOptions={form.barriers}
          onChange={({ detail }) => handleChange("barriers", detail.selectedOptions || [])}
          placeholder="Select barriers"
          disabled={isFormLocked}
        />
      </FormField>
    </SpaceBetween>
  );

  const otherFundingSourceItems = useMemo(
    () => normalizeOtherFundingSources(form.otherFundingSources, { keepEmpty: true }),
    [form.otherFundingSources]
  );

  const otherFundingSourceTableColumns = useMemo(
    () => [
      {
        id: "name",
        header: "Funder name",
        minWidth: 180,
        cell: item => item.name || "—",
      },
      {
        id: "type",
        header: "Funder type",
        minWidth: 140,
        cell: item => resolveOtherFunderTypeLabel(item.type),
      },
      {
        id: "coverage",
        header: "What this funder covers",
        minWidth: 260,
        cell: item => item.coverage || "—",
      },
      {
        id: "actions",
        header: "Actions",
        width: 92,
        minWidth: 92,
        cell: item => (
          <SpaceBetween direction="horizontal" size="xxs">
            <Button
              variant="inline-icon"
              iconName="edit"
              ariaLabel={`Edit ${item.name || "other funder"}`}
              onClick={() => openEditOtherFundingSourceModal(item.id)}
              disabled={isFormLocked}
            />
            <Button
              variant="inline-icon"
              iconName="remove"
              ariaLabel={`Delete ${item.name || "other funder"}`}
              onClick={() => removeOtherFundingSource(item.id)}
              disabled={isFormLocked}
            />
          </SpaceBetween>
        ),
      },
    ],
    [isFormLocked, openEditOtherFundingSourceModal, removeOtherFundingSource]
  );

  const otherFundingStepContent = (
    <SpaceBetween size="m">
      <FormField
        label="Other funding involved?"
        description="Identify whether other funding is part of this request."
      >
        <Select
          selectedOption={
            OTHER_FUNDING_INVOLVED_OPTIONS.find(option => option.value === form.otherFundingInvolved) || null
          }
          onChange={({ detail }) => {
            const nextValue = detail.selectedOption?.value || "";
            if (nextValue !== "yes") {
              resetOtherFundingSourceModal();
            }
            updateOtherFundingFields(prev => {
              const resetValues = nextValue === "yes"
                ? {}
                : {
                    otherFundingSources: [],
                    otherFundingNwacCoverage: "",
                  };
              return {
                ...prev,
                otherFundingInvolved: nextValue,
                ...resetValues,
              };
            });
          }}
          options={OTHER_FUNDING_INVOLVED_OPTIONS}
          placeholder="Select"
          disabled={isFormLocked}
        />
      </FormField>
      {form.otherFundingInvolved === "yes" && (
        <SpaceBetween size="m">
          <Table
            stripedRows
            variant="embedded"
            trackBy="id"
            items={otherFundingSourceItems}
            columnDefinitions={otherFundingSourceTableColumns}
            resizableColumns
            header={
              <Header
                variant="h3"
                actions={
                  <Button onClick={openAddOtherFundingSourceModal} disabled={isFormLocked}>
                    Add other funder
                  </Button>
                }
              >
                Other funders
              </Header>
            }
            empty={
              <Alert type="info">
                Add each non-NWAC funder so coordination is clear.
              </Alert>
            }
          />
          <FormField
            label="What NWAC funding will cover"
            description="Describe the NWAC-funded supports to avoid overlap."
          >
            <Textarea
              value={form.otherFundingNwacCoverage || ""}
              onChange={({ detail }) => updateOtherFundingFields({ otherFundingNwacCoverage: detail.value })}
              rows={3}
              disabled={isFormLocked}
            />
          </FormField>
        </SpaceBetween>
      )}
      <FormField label="Additional notes (optional)">
        <Textarea
          value={form.otherFundingNotes || ""}
          onChange={({ detail }) => updateOtherFundingFields({ otherFundingNotes: detail.value })}
          rows={3}
          disabled={isFormLocked}
        />
      </FormField>
    </SpaceBetween>
  );

  const childcareStepContent = (
    <SpaceBetween size="m">
      <FormField label="Childcare need" description="Indicate if childcare is required to participate in the interventions.">
        <Select
          selectedOption={
            form.childcareNeed
              ? { value: form.childcareNeed, label: form.childcareNeed === "yes" ? "Yes" : "No" }
              : null
          }
          onChange={({ detail }) => handleChange("childcareNeed", detail.selectedOption?.value || "")}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
          placeholder="Select"
          readOnly={isFormLocked}
        />
      </FormField>
      <FormField label="Childcare funding details (optional)">
        <Textarea
          value={form.childcareFunding || ""}
          onChange={({ detail }) => handleChange("childcareFunding", detail.value)}
          rows={3}
          disabled={isFormLocked || form.childcareNeed !== "yes"}
        />
      </FormField>
    </SpaceBetween>
  );

  const costErrors = showCostErrors ? validationErrors.costLines || {} : {};
  const overallCostDisplay = formatCurrencyDisplay(overallCostTotal) || "$ 0.00";

  const costStepContent = (
    <SpaceBetween size="l">
      <Box fontWeight="bold">Total proposed cost: {overallCostDisplay}</Box>
      {proposedInterventions.map(intervention => {
        const costLines = Array.isArray(intervention.costLines) ? intervention.costLines : [];
        const interventionTotal = interventionTotals.get(intervention.id) || 0;
        const interventionTotalDisplay = formatCurrencyDisplay(interventionTotal) || "$ 0.00";
        const costItemOptions = buildCostItemOptions(intervention);
        const interventionLabel = resolveInterventionLabel(intervention.code) || "Intervention";
        return (
          <SpaceBetween key={intervention.id} size="s">
            <Header
              variant="h3"
              actions={
                <Button
                  onClick={() => openAddCostLineModal(intervention.id)}
                  disabled={isFormLocked || costItemOptions.length === 0}
                >
                  Add cost item
                </Button>
              }
            >
              {interventionLabel}
            </Header>
            <Table
              stripedRows
              variant="embedded"
              trackBy="id"
              items={costLines}
              resizableColumns
              columnDefinitions={[
                {
                  id: "type",
                  header: "Cost item",
                  cell: item => {
                    const lineErrors = costErrors[intervention.id]?.[item.id] || {};
                    const label = paymentTypeLabelLookup.get(item.type) || item.type || "—";
                    return (
                      <SpaceBetween size="xxs">
                        <Link
                          onFollow={event => {
                            event.preventDefault();
                            openCostLineModal(intervention.id, item.id);
                          }}
                        >
                          {label}
                        </Link>
                        {showCostErrors && lineErrors.type && (
                          <Box color="text-status-error" fontSize="body-s">
                            {lineErrors.type}
                          </Box>
                        )}
                      </SpaceBetween>
                    );
                  },
                },
                {
                  id: "amount",
                  header: "Amount",
                  cell: item => {
                    const lineErrors = costErrors[intervention.id]?.[item.id] || {};
                    const displayValue = inlineAmountEditingId === item.id
                      ? sanitizeCurrencyInput(item.amount)
                      : getCurrencyInputDisplayValue(parseCurrencyInput(item.amount) ?? "", false);
                    return (
                      <SpaceBetween size="xxs">
                        <Input
                          inputMode="decimal"
                          value={displayValue}
                          onFocus={() => {
                            if (!isFormLocked) setInlineAmountEditingId(item.id);
                          }}
                          onChange={({ detail }) => handleInlineAmountChange(intervention.id, item.id, detail.value)}
                          onBlur={() => handleInlineAmountBlur(item.id)}
                          placeholder="0.00"
                          readOnly={isFormLocked}
                        />
                        {showCostErrors && lineErrors.amount && (
                          <Box color="text-status-error" fontSize="body-s">
                            {lineErrors.amount}
                          </Box>
                        )}
                      </SpaceBetween>
                    );
                  },
                },
                {
                  id: "details",
                  header: "Details",
                  cell: item => {
                    const lineErrors = costErrors[intervention.id]?.[item.id] || {};
                    const details = getCostLineDetailsText(item, intervention);
                    return (
                      <SpaceBetween size="xxs">
                        <Box>{details.text}</Box>
                        {details.notesText && (
                          <Box fontStyle="italic">{details.notesText}</Box>
                        )}
                        {showCostErrors && lineErrors.recurrence && (
                          <Box color="text-status-error" fontSize="body-s">
                            {lineErrors.recurrence}
                          </Box>
                        )}
                      </SpaceBetween>
                    );
                  },
                },
                {
                  id: "actions",
                  header: "",
                  minWidth: 64,
                  width: 64,
                  cell: item => (
                    isFormLocked ? null : (
                      <Button
                        variant="inline-icon"
                        iconName="remove"
                        ariaLabel="Delete cost item"
                        onClick={() => removeCostLine(intervention.id, item.id)}
                      />
                    )
                  ),
                },
              ]}
              empty={<Box padding={{ vertical: "s" }}>Intervention has no cost items.</Box>}
              footer={
                <Box textAlign="right" fontWeight="bold">
                  TOTAL: {interventionTotalDisplay}
                </Box>
              }
            />
          </SpaceBetween>
        );
      })}
    </SpaceBetween>
  );

  const docsStepContent = (
    <SpaceBetween size="m">
      <Alert type="info">No checklist items are required yet.</Alert>
    </SpaceBetween>
  );

  const reviewOtherFundingInvolved =
    form.otherFundingInvolved === "yes"
      ? "Yes"
      : form.otherFundingInvolved === "no"
        ? "No"
        : form.otherFundingInvolved === "unknown"
          ? "Unknown"
          : "";
  const reviewOtherFundingSources = normalizeOtherFundingSources(form.otherFundingSources);
  const reviewOtherFundingNotes = String(form.otherFundingNotes || "").trim();
  const reviewOtherFundingNwacCoverage = String(form.otherFundingNwacCoverage || "").trim();

  const reviewStepContent = (
    <SpaceBetween size="m">
      <ColumnLayout columns={2} variant="text-grid">
        <Box>
          <Header variant="h4">Rationale</Header>
          <div>{form.rationale || "—"}</div>
          <div>Barriers: {form.barriers.length ? form.barriers.map(item => item.label || item.value).join(", ") : "None"}</div>
        </Box>
        <Box>
          <Header variant="h4">Other funding</Header>
          {reviewOtherFundingInvolved ? (
            <div>Other funding involved: {reviewOtherFundingInvolved}</div>
          ) : null}
          {reviewOtherFundingSources.length ? (
            <SpaceBetween size="xxs">
              {reviewOtherFundingSources.map((source, index) => (
                <div key={source.id || `${source.name}-${index}`}>
                  {resolveOtherFunderTypeLabel(source.type)}: {source.name || "Unnamed funder"}
                  {source.coverage ? ` — ${source.coverage}` : ""}
                </div>
              ))}
            </SpaceBetween>
          ) : null}
          {reviewOtherFundingNwacCoverage ? (
            <div>NWAC funding covers: {reviewOtherFundingNwacCoverage}</div>
          ) : null}
          {reviewOtherFundingNotes ? (
            <div>Notes: {reviewOtherFundingNotes}</div>
          ) : null}
          {!reviewOtherFundingInvolved &&
            !reviewOtherFundingSources.length &&
            !reviewOtherFundingNwacCoverage &&
            !reviewOtherFundingNotes && <div>—</div>}
        </Box>
        <Box>
          <Header variant="h4">Proposed interventions</Header>
          {proposedInterventions.length === 0 ? (
            <div>—</div>
          ) : (
            <SpaceBetween size="s">
              {proposedInterventions.map(intervention => (
                <Box key={intervention.id}>
                  <Box fontWeight="bold">{resolveInterventionLabel(intervention.code) || "Intervention"}</Box>
                  {intervention.startDate ? <div>Start: {intervention.startDate}</div> : null}
                  {intervention.endDate ? <div>End: {intervention.endDate}</div> : null}
                  {intervention.institution ? <div>Provider: {intervention.institution}</div> : null}
                </Box>
              ))}
            </SpaceBetween>
          )}
        </Box>
        <Box>
          <Header variant="h4">Costs</Header>
          <div>Overall proposed cost: {overallCostDisplay}</div>
        </Box>
      </ColumnLayout>
    </SpaceBetween>
  );

  const decisionStepContent = (
    <SpaceBetween size="m">
      <FormField
        label="Decision"
        description="Record the approval decision for this proposal."
        errorText={showDecisionErrors && !form.decisionOutcome ? "Decision is required." : undefined}
      >
        <Select
          selectedOption={DECISION_OPTIONS.find(option => option.value === form.decisionOutcome) || null}
          onChange={({ detail }) => handleChange("decisionOutcome", detail.selectedOption?.value || "")}
          options={DECISION_OPTIONS}
          placeholder="Select decision"
          readOnly={isDecisionReadOnly}
        />
      </FormField>
      {(form.decisionOutcome === "changes_requested" || form.decisionOutcome === "rejected") && (
        <FormField
          label={form.decisionOutcome === "changes_requested" ? "Request changes note" : "Rejection reason"}
          errorText={
            showDecisionErrors && !form.decisionNotes.trim()
              ? "A note is required."
              : undefined
          }
        >
          <Textarea
            value={form.decisionNotes}
            onChange={({ detail }) => handleChange("decisionNotes", detail.value)}
            rows={3}
            placeholder="Provide context for this decision."
            disabled={isDecisionReadOnly}
          />
        </FormField>
      )}
      {form.decisionOutcome === "approved" && (
        <SpaceBetween size="s">
          <FormField
            label="EI eligibility"
            description="Select the participant’s current EI eligibility."
            errorText={
              showDecisionErrors && !form.eiVerificationStatus ? "EI eligibility is required." : undefined
            }
          >
            <Select
              selectedOption={ESDC_OPTIONS.find(option => option.value === form.eiVerificationStatus) || null}
              onChange={({ detail }) => handleChange("eiVerificationStatus", detail.selectedOption?.value || "")}
              options={ESDC_OPTIONS}
              placeholder="Select eligibility"
              readOnly={isDecisionReadOnly || !canManageEiEligibility}
              disabled={isDecisionReadOnly || !canManageEiEligibility}
            />
          </FormField>
          {hasPlanFundingMismatch && (
            <Alert type="warning">
              EI eligibility indicates {requiredFundingStream} funding, but the parent Action Plan is currently set to{" "}
              {selectedPlanFundingStream || "no funding stream"}.
              Update the Action Plan funding settings below before approving.
            </Alert>
          )}
          {needsActionPlanFundingSetup && selectedPlan && (
            <SpaceBetween size="s">
              <Alert type="info">
                This approval needs funding settings on the parent Action Plan. The values below will update{" "}
                <strong>{selectedPlan.title || `Action Plan ${selectedPlan.id}`}</strong> when you submit the decision.
              </Alert>
              <ColumnLayout columns={3} variant="text-grid">
                <FormField
                  label="Funding stream"
                  description="Select the funding stream for the parent Action Plan."
                  errorText={showDecisionErrors ? actionPlanFundingErrors.fundingStream : undefined}
                >
                  <Select
                    selectedOption={selectedActionPlanFundingStreamOption}
                    options={actionPlanFundingStreamOptions}
                    onChange={({ detail }) => {
                      const nextFundingStream = detail.selectedOption?.value || "";
                      setActionPlanFundingErrors(prev => {
                        const next = { ...prev };
                        delete next.fundingStream;
                        delete next.budgetPot;
                        return next;
                      });
                      setActionPlanFundingDraft(current => ({
                        ...current,
                        fundingStream: nextFundingStream,
                        budgetPot: "",
                        postingContext:
                          nextFundingStream && (current.postingContext || (isAssessor ? "external" : "external")),
                      }));
                    }}
                    placeholder={fundingStreamsLoading ? "Loading funding streams" : "Select funding stream"}
                    statusType={fundingStreamsLoading ? "loading" : "finished"}
                    empty={fundingStreamsLoading ? undefined : "No funding streams available"}
                    disabled={isFormLocked || actionPlanFundingSaving}
                  />
                </FormField>
                <FormField
                  label="Budget pot"
                  description="Select the budget pot for the parent Action Plan."
                  errorText={showDecisionErrors ? actionPlanFundingErrors.budgetPot : undefined}
                >
                  <Select
                    selectedOption={selectedActionPlanBudgetPotOption}
                    options={actionPlanBudgetPotOptions}
                    onChange={({ detail }) => {
                      const nextPot = detail.selectedOption?.value || "";
                      setActionPlanFundingErrors(prev => {
                        const next = { ...prev };
                        delete next.budgetPot;
                        return next;
                      });
                      setActionPlanFundingDraft(current => ({
                        ...current,
                        budgetPot: nextPot,
                        postingContext:
                          nextPot && (current.postingContext || (isAssessor ? "external" : "external")),
                      }));
                    }}
                    filteringType="auto"
                    onLoadItems={({ detail }) => {
                      if (detail?.filteringText !== undefined) {
                        loadActionPlanBudgetPotOptions(detail.filteringText);
                      }
                    }}
                    placeholder={
                      !actionPlanFundingDraft.fundingStream
                        ? "Select funding stream first"
                        : actionPlanBudgetPotLoading
                        ? "Loading budget pots"
                        : "Select budget pot"
                    }
                    statusType={actionPlanBudgetPotLoading ? "loading" : "finished"}
                    empty={actionPlanBudgetPotLoading ? undefined : "No budget pots found"}
                    disabled={isFormLocked || actionPlanFundingSaving || !actionPlanFundingDraft.fundingStream}
                  />
                </FormField>
                <FormField
                  label="Paid from"
                  description="Select whether this budget pot is charged externally or internally."
                  errorText={showDecisionErrors ? actionPlanFundingErrors.postingContext : undefined}
                >
                  {isAssessor ? (
                    <Input value="External (region/PTMA)" readOnly disabled={!actionPlanFundingDraft.budgetPot} />
                  ) : (
                    <Select
                      selectedOption={selectedActionPlanPostingContextOption}
                      options={POSTING_CONTEXT_OPTIONS}
                      onChange={({ detail }) => {
                        setActionPlanFundingErrors(prev => {
                          const next = { ...prev };
                          delete next.postingContext;
                          return next;
                        });
                        setActionPlanFundingDraft(current => ({
                          ...current,
                          postingContext: detail.selectedOption?.value || "external",
                        }));
                      }}
                      placeholder="Select"
                      disabled={isFormLocked || actionPlanFundingSaving || !actionPlanFundingDraft.budgetPot}
                    />
                  )}
                </FormField>
              </ColumnLayout>
              <Box variant="small" color="text-body-secondary">
                Approval will save these funding settings to the parent Action Plan and then continue with intervention approval.
              </Box>
            </SpaceBetween>
          )}
          <FormField
            label="EI Verification document"
            errorText={
              eiVerificationFileError ||
              (showDecisionErrors && !form.eiVerificationDocumentId && !eiVerificationFile
                ? "EI verification document is required."
                : undefined)
            }
            stretch
          >
            <Box variant="small" color="text-body-secondary">
              Max size 6 MB. Allowed types: PDF, Word (.doc, .docx), JPG, PNG, BMP, TIFF.
            </Box>
            <SpaceBetween size="xs" direction="horizontal">
              <Button
                onClick={() => eiVerificationFileInputRef.current && eiVerificationFileInputRef.current.click()}
                disabled={isDecisionReadOnly || eiVerificationUploading}
              >
                Choose file
              </Button>
              <Box>{eiVerificationFile ? eiVerificationFile.name : "No file selected"}</Box>
            </SpaceBetween>
            {form.eiVerificationDocumentId && (
              <Box variant="small" color="text-body-secondary">
                EI verification document already uploaded.
              </Box>
            )}
          </FormField>
          {eiVerificationUploadError && (
            <Alert type="error" statusIconAriaLabel="Error" dismissible onDismiss={() => setEiVerificationUploadError(null)}>
              {eiVerificationUploadError}
            </Alert>
          )}
          {eiVerificationUploadSuccess && (
            <Alert type="success" statusIconAriaLabel="Success" dismissible onDismiss={() => setEiVerificationUploadSuccess(null)}>
              {eiVerificationUploadSuccess}
            </Alert>
          )}
        </SpaceBetween>
      )}
      <input
        type="file"
        ref={eiVerificationFileInputRef}
        style={{ display: "none" }}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
        onChange={handleEiVerificationFileChange}
      />
    </SpaceBetween>
  );

  const renderReadOnlyLetters = (letters, emptyMessage, options = {}) => {
    if (options.requireDraftGeneration && !approvalLetterPackGenerated) {
      return (
        <Alert type="info" statusIconAriaLabel="Info">
          Click <strong>Generate drafts</strong> to create the decision letter pack.
        </Alert>
      );
    }
    if (!Array.isArray(letters) || !letters.length) {
      return (
        <Alert type="info" statusIconAriaLabel="Info">
          {emptyMessage}
        </Alert>
      );
    }
    return (
      <SpaceBetween size="l">
        {letters.map(letter => (
          <Box key={letter.id || letter.title}>
            <Header
              variant="h4"
              actions={
                <Button
                  onClick={() => downloadLetterAsText(letter.fileName, letter.body)}
                  iconName="download"
                >
                  Download
                </Button>
              }
            >
              {letter.title}
            </Header>
            <Textarea
              value={letter.body || ""}
              readOnly
              rows={14}
            />
          </Box>
        ))}
      </SpaceBetween>
    );
  };

  const communicationStepContent = (
    <SpaceBetween size="m">
      <Box>
        <Header
          variant="h3"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                onClick={generateLetterPackDrafts}
                disabled={!canGenerateLetterDrafts || letterWorkflowsLoading}
                loading={false}
                iconAlign="left"
                iconName="gen-ai"
              >
                {isApprovedDecisionOutcome ? "Generate drafts" : "Generate draft"}
              </Button>
            </SpaceBetween>
          }
        >
          {isApprovedDecisionOutcome
            ? (isRevisionMode ? "Funding revision letters" : "Approval letters")
            : "Denial letter"}
        </Header>
        {letterWorkflowsError && (
          <Alert type="error" statusIconAriaLabel="Error" dismissible onDismiss={() => setLetterWorkflowsError(null)}>
            {letterWorkflowsError}
          </Alert>
        )}
        {sendingLetterError && (
          <Alert type="error" statusIconAriaLabel="Error" dismissible onDismiss={() => setSendingLetterError(null)}>
            {sendingLetterError}
          </Alert>
        )}
        {!showCommunicationStep ? (
          <Alert type="info" statusIconAriaLabel="Info">
            Decision letters are available for approved or rejected decisions.
          </Alert>
        ) : isApprovedDecisionOutcome ? (
          <SpaceBetween size="m">
            <Box>
              {isRevisionMode
                ? "Edit the client funding revision letter, then review the red-line revised Client Funding Agreement and the institution, loan-provider, and other-funder letters before downloading them."
                : "Edit the client approval letter, then review the institution, loan-provider, and other-funder letters in the tabs before downloading them."}
            </Box>
            <Tabs
              activeTabId={approvalLetterPackTabId}
              onChange={({ detail }) => setApprovalLetterPackTabId(detail.activeTabId)}
              tabs={[
                {
                  id: "client",
                  label: "Client letter",
                  content: (
                    <Textarea
                      value={clientLetterBody}
                      onChange={({ detail }) => setClientLetterBody(detail.value || "")}
                      rows={18}
                    />
                  ),
                },
                {
                  id: "institution",
                  label: "Institution letter",
                  content: renderReadOnlyLetters(
                    institutionApprovalLetters,
                    "No institution-directed funding was identified from intervention delivery details and cost lines.",
                    { requireDraftGeneration: true }
                  ),
                },
                {
                  id: "loan-provider",
                  label: "Loan provider letters",
                  content: renderReadOnlyLetters(
                    loanProviderApprovalLetters,
                    "No student loan repayment lines were identified in the approved cost items.",
                    { requireDraftGeneration: true }
                  ),
                },
                {
                  id: "other-funding",
                  label: "Letters to other funders",
                  content: renderReadOnlyLetters(
                    coFunderApprovalLetters,
                    "No other funding sources were provided in the Other funding sources step.",
                    { requireDraftGeneration: true }
                  ),
                },
              ]}
            />
          </SpaceBetween>
        ) : (
          <Textarea
            value={clientLetterBody}
            onChange={({ detail }) => setClientLetterBody(detail.value || "")}
            rows={18}
          />
        )}
      </Box>
    </SpaceBetween>
  );

  const sendApprovalLetterConfirmModal = (
    <Modal
      visible={showSendApprovalLetterConfirmModal}
      onDismiss={() => {
        if (sendingLetter) return;
        setShowSendApprovalLetterConfirmModal(false);
      }}
      header={isRevisionMode ? "Send client funding revision letter?" : "Send client approval letter?"}
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            onClick={handleConfirmSendApprovalLetter}
            loading={sendingLetter}
            disabled={sendingLetter}
          >
            {isRevisionMode ? "Send client funding revision letter" : "Send client approval letter"}
          </Button>
          <Button
            variant="normal"
            onClick={() => setShowSendApprovalLetterConfirmModal(false)}
            disabled={sendingLetter}
          >
            Cancel
          </Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Box>
          {isRevisionMode
            ? "This will send the client funding revision letter with the red-line revised Client Funding Agreement and EFT & Wire Transfer Direct Debit form attached."
            : "This will send the client approval letter with the Client Funding Agreement and EFT & Wire Transfer Direct Debit form attached."}
        </Box>
        <Box>
          Institution letters and letters to other funders are not sent automatically by the
          system and should be sent manually.
        </Box>
      </SpaceBetween>
    </Modal>
  );

  const decisionBlockerModal = (
    <Modal
      visible={decisionBlockerVisible}
      onDismiss={() => setDecisionBlockerVisible(false)}
      header="Cannot submit decision"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          {decisionBlockerTargetStep && (
            <Button
              variant="primary"
              onClick={() => {
                setDecisionBlockerVisible(false);
                setCurrentStep(decisionBlockerTargetStep);
              }}
            >
              Go to step
            </Button>
          )}
          <Button variant="normal" onClick={() => setDecisionBlockerVisible(false)}>Close</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        {decisionBlockerReasons.map(reason => (
          <Box key={reason}>{reason}</Box>
        ))}
      </SpaceBetween>
    </Modal>
  );

  const otherFundingSourceModalDraft = otherFundingSourceModal.draft
    ? buildEmptyOtherFundingSource(otherFundingSourceModal.draft)
    : null;
  const otherFundingSourceModalDirty =
    otherFundingSourceModal.mode === "edit"
      ? JSON.stringify(otherFundingSourceModalDraft || {}) !==
        JSON.stringify(otherFundingSourceModal.original || {})
      : true;

  const otherFundingSourceModalContent = (
    <Modal
      visible={otherFundingSourceModal.visible}
      onDismiss={resetOtherFundingSourceModal}
      header={otherFundingSourceModal.mode === "add" ? "Add other funder" : "Edit other funder"}
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            onClick={saveOtherFundingSourceModal}
            disabled={isFormLocked || (otherFundingSourceModal.mode === "edit" && !otherFundingSourceModalDirty)}
          >
            {otherFundingSourceModal.mode === "add" ? "Add funder" : "Save changes"}
          </Button>
          <Button variant="link" onClick={resetOtherFundingSourceModal}>Cancel</Button>
        </SpaceBetween>
      }
    >
      {otherFundingSourceModalDraft && (
        <SpaceBetween size="s">
          <FormField label="Funder name" errorText={otherFundingSourceModalErrors.name}>
            <Input
              value={otherFundingSourceModalDraft.name || ""}
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ name: detail.value });
                setOtherFundingSourceModalErrors(prev => {
                  const next = { ...prev };
                  delete next.name;
                  return next;
                });
              }}
              readOnly={isFormLocked}
            />
          </FormField>
          <FormField label="Funder type">
            <Select
              selectedOption={
                OTHER_FUNDER_TYPE_OPTIONS.find(option => option.value === otherFundingSourceModalDraft.type) ||
                OTHER_FUNDER_TYPE_OPTIONS.find(option => option.value === "other") ||
                OTHER_FUNDER_TYPE_OPTIONS[0]
              }
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ type: detail.selectedOption?.value || "other" });
              }}
              options={OTHER_FUNDER_TYPE_OPTIONS}
              placeholder="Select funder type"
              readOnly={isFormLocked}
            />
          </FormField>
          <FormField
            label="What this funder covers"
            errorText={otherFundingSourceModalErrors.coverage}
          >
            <Textarea
              value={otherFundingSourceModalDraft.coverage || ""}
              rows={4}
              onChange={({ detail }) => {
                updateOtherFundingSourceModalDraft({ coverage: detail.value });
                setOtherFundingSourceModalErrors(prev => {
                  const next = { ...prev };
                  delete next.coverage;
                  return next;
                });
              }}
              readOnly={isFormLocked}
            />
          </FormField>
        </SpaceBetween>
      )}
    </Modal>
  );

  const interventionModalDraft = interventionModal.draft || null;
  const interventionModalMode = interventionModal.mode;
  const interventionModalEditable = interventionModalMode === "add" || interventionModalMode === "edit";
  const interventionModalDirty =
    interventionModalMode === "edit"
      ? JSON.stringify(interventionModalDraft || {}) !== JSON.stringify(interventionModal.original || {})
      : true;
  const interventionCodeLabel = interventionModalDraft
    ? resolveInterventionLabel(interventionModalDraft.code) || interventionModalDraft.code || ""
    : "";
  const interventionModalEducationCode = interventionModalDraft
    ? isEducationCode(interventionModalDraft.code)
    : false;
  const interventionModalEmployerCode = interventionModalDraft
    ? isEmployerCode(interventionModalDraft.code)
    : false;
  const interventionModalWageSubsidyCode = interventionModalDraft
    ? isWageSubsidyCode(interventionModalDraft.code)
    : false;
  const interventionModalNeedsNoc = interventionModalDraft
    ? requiresNocForCode(interventionModalDraft.code)
    : false;
  const interventionModalRequiresExternal = interventionModalDraft
    ? requiresExternalPartnerForCode(interventionModalDraft.code)
    : false;
  const interventionModalDeliveryMode =
    interventionModalDraft?.deliveryMode === "in_house" ? "in_house" : "partner";

  const interventionModalContent = (
    <Modal
      visible={interventionModal.visible}
      onDismiss={resetInterventionModal}
      header={interventionModalMode === "add" ? "Add intervention" : "Intervention details"}
      footer={
        interventionModalMode === "view" ? (
          <SpaceBetween direction="horizontal" size="xs">
            {!isFormLocked && (
              <Button variant="primary" onClick={startInterventionEdit}>Edit</Button>
            )}
            {!isFormLocked && (
              <Button
                variant="normal"
                onClick={() => {
                  if (!interventionModal.interventionId) return;
                  setInterventionDeleteId(interventionModal.interventionId);
                  resetInterventionModal();
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="link" onClick={resetInterventionModal}>Close</Button>
          </SpaceBetween>
        ) : (
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={saveInterventionModal}
              disabled={isFormLocked || (interventionModalMode === "edit" && !interventionModalDirty)}
            >
              {interventionModalMode === "add" ? "Add intervention" : "Save changes"}
            </Button>
            <Button variant="link" onClick={interventionModalMode === "add" ? resetInterventionModal : cancelInterventionEdit}>
              Cancel
            </Button>
          </SpaceBetween>
        )
      }
    >
      {interventionModalDraft && (
        <SpaceBetween size="s">
          <FormField
            label="Intervention code"
            description={
              interventionModalMode !== "add"
                ? "To change the code, delete this intervention and add a new one."
                : undefined
            }
            errorText={interventionModalErrors.code}
          >
            {interventionModalMode === "add" ? (
              <Select
                selectedOption={codeOptions.find(option => String(option.value) === String(interventionModalDraft.code)) || null}
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ code: detail.selectedOption?.value || "" });
                  setInterventionModalErrors({});
                }}
                options={codeOptions}
                placeholder={interventionCodesLoading ? "Loading intervention codes" : "Select intervention"}
                statusType={interventionCodesLoading ? "loading" : "finished"}
                readOnly={isFormLocked}
              />
            ) : (
              <Input value={interventionCodeLabel} readOnly />
            )}
          </FormField>
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
            <FormField label="Start date" errorText={interventionModalErrors.startDate}>
              <DatePicker
                value={interventionModalDraft.startDate || ""}
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ startDate: detail.value });
                  setInterventionModalErrors(prev => {
                    const next = { ...prev };
                    delete next.startDate;
                    delete next.endDate;
                    return next;
                  });
                }}
                readOnly={!interventionModalEditable || isFormLocked}
              />
            </FormField>
            <FormField label="End date" errorText={interventionModalErrors.endDate}>
              <DatePicker
                value={interventionModalDraft.endDate || ""}
                onChange={({ detail }) => {
                  updateInterventionModalDraft({ endDate: detail.value });
                  setInterventionModalErrors(prev => {
                    const next = { ...prev };
                    delete next.endDate;
                    return next;
                  });
                }}
                readOnly={!interventionModalEditable || isFormLocked}
              />
            </FormField>
          </Grid>
          {!interventionModalRequiresExternal && (
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Delivery mode" description="Choose how this will run.">
                <Select
                  selectedOption={
                    interventionModalDeliveryMode === "in_house"
                      ? { value: "in_house", label: "In-house (no external partner)" }
                      : { value: "partner", label: "External delivery partner" }
                  }
                  onChange={({ detail }) => {
                    updateInterventionModalDraft({ deliveryMode: detail.selectedOption?.value || "partner" });
                    setInterventionModalErrors(prev => {
                      const next = { ...prev };
                      delete next.institution;
                      return next;
                    });
                  }}
                  options={[
                    { value: "partner", label: "External delivery partner" },
                    { value: "in_house", label: "In-house (no external partner)" },
                  ]}
                  disabled={!interventionModalEditable || isFormLocked}
                />
              </FormField>
              {interventionModalDeliveryMode === "partner" ? (
                <FormField
                  label="Delivery partner / provider"
                  description="The training provider or employer."
                  errorText={interventionModalErrors.institution}
                >
                  <Input
                    value={interventionModalDraft.institution}
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({ institution: detail.value });
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.institution;
                        return next;
                      });
                    }}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
              ) : (
                <Box />
              )}
            </ColumnLayout>
          )}
          {interventionModalEducationCode && (
            <SpaceBetween size="s">
              <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="Institution"
                  description="Training provider or school delivering the program."
                  errorText={interventionModalErrors.institution}
                >
                  <Input
                    value={interventionModalDraft.institution}
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({ institution: detail.value });
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.institution;
                        return next;
                      });
                    }}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
                <FormField label="Program name (optional)" description="Course, credential, or stream name.">
                  <Input
                    value={interventionModalDraft.programName}
                    onChange={({ detail }) => updateInterventionModalDraft({ programName: detail.value })}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
              </ColumnLayout>
              <FormField
                label="In-Training Plan (ITP) details"
                description="Outline curriculum, milestones, supports, materials, and how this leads to the employment goal."
                errorText={interventionModalErrors.itpDetails}
              >
                <Textarea
                  value={interventionModalDraft.itpDetails || ""}
                  rows={3}
                  onChange={({ detail }) => {
                    updateInterventionModalDraft({ itpDetails: detail.value });
                    setInterventionModalErrors(prev => {
                      const next = { ...prev };
                      delete next.itpDetails;
                      return next;
                    });
                  }}
                  readOnly={!interventionModalEditable || isFormLocked}
                />
              </FormField>
            </SpaceBetween>
          )}
          {interventionModalEmployerCode && (
            <SpaceBetween size="s">
              <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="Employer / delivery partner"
                  description="Employer or host organization providing the placement."
                  errorText={interventionModalErrors.institution}
                >
                  <Input
                    value={interventionModalDraft.institution}
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({ institution: detail.value });
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.institution;
                        return next;
                      });
                    }}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
                <FormField label="Program name (optional)" description="Job title, role, or program name.">
                  <Input
                    value={interventionModalDraft.programName}
                    onChange={({ detail }) => updateInterventionModalDraft({ programName: detail.value })}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
              </ColumnLayout>
              {interventionModalWageSubsidyCode && (
                <FormField
                  label="Wage subsidy details"
                  errorText={interventionModalErrors.wageSubsidyDetails}
                >
                  <Textarea
                    value={interventionModalDraft.wageSubsidyDetails || ""}
                    rows={3}
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({ wageSubsidyDetails: detail.value });
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.wageSubsidyDetails;
                        return next;
                      });
                    }}
                    readOnly={!interventionModalEditable || isFormLocked}
                  />
                </FormField>
              )}
            </SpaceBetween>
          )}
          {interventionModalNeedsNoc && (
            <ColumnLayout columns={2} variant="text-grid">
                <FormField
                  label="NOC version"
                  description="Select the NOC version used for this job/placement."
                  errorText={interventionModalErrors.interventionNocVersion}
                >
                  <Select
                    selectedOption={
                      nocVersionOptions.find(option => option.value === interventionModalDraft.interventionNocVersion) ||
                      null
                    }
                    onChange={({ detail }) => {
                      updateInterventionModalDraft({
                        interventionNocVersion: detail.selectedOption?.value || "",
                        interventionNoc: "",
                      });
                      setNocSuggestions([]);
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.interventionNocVersion;
                        delete next.interventionNoc;
                        return next;
                      });
                    }}
                    options={nocVersionOptions}
                    placeholder={nocVersionsLoading ? "Loading NOC versions..." : "Select NOC version"}
                    statusType={nocVersionsLoading ? "loading" : "finished"}
                    filteringType="auto"
                    disabled={!interventionModalEditable || isFormLocked || nocVersionsLoading}
                  />
                </FormField>
                <FormField
                  label="NOC code"
                  description="Search by code or title; aligns to the job/placement."
                  errorText={interventionModalErrors.interventionNoc}
                >
                  <Autosuggest
                    value={interventionModalDraft.interventionNoc || ""}
                    onChange={({ detail }) => {
                      const inputValue = detail.value || "";
                      updateInterventionModalDraft({ interventionNoc: inputValue });
                      if (inputValue.length >= 2 && interventionModalDraft.interventionNocVersion) {
                        fetchNocSuggestions(inputValue, interventionModalDraft.interventionNocVersion);
                      } else {
                        setNocSuggestions([]);
                      }
                      setInterventionModalErrors(prev => {
                        const next = { ...prev };
                        delete next.interventionNoc;
                        return next;
                      });
                    }}
                    onSelect={({ detail }) => updateInterventionModalDraft({ interventionNoc: detail.value || "" })}
                    onLoadItems={({ detail }) => {
                      if (detail.filteringText && interventionModalDraft.interventionNocVersion) {
                        fetchNocSuggestions(detail.filteringText, interventionModalDraft.interventionNocVersion);
                      }
                    }}
                    options={nocSuggestions}
                    statusType={nocSuggestionsLoading ? "loading" : "finished"}
                    expandToViewport
                    placeholder={
                      interventionModalDraft.interventionNocVersion
                        ? "Type to search NOC code"
                        : "Select a NOC version first"
                    }
                    empty="No NOC codes found."
                    disabled={
                      !interventionModalEditable ||
                      isFormLocked ||
                      !interventionModalDraft.interventionNocVersion
                    }
                    enteredTextLabel={value => `Use "${value}"`}
                  />
                </FormField>
            </ColumnLayout>
          )}
        </SpaceBetween>
      )}
    </Modal>
  );

  const interventionToDelete = interventionDeleteId
    ? proposedInterventions.find(item => idsMatch(item.id, interventionDeleteId))
    : null;
  const interventionDeleteModal = (
    <Modal
      visible={Boolean(interventionDeleteId)}
      onDismiss={() => setInterventionDeleteId(null)}
      header="Delete intervention?"
      footer={
        <SpaceBetween direction="horizontal" size="xs">
          <Button
            variant="primary"
            onClick={confirmInterventionDelete}
            disabled={isFormLocked || isRevisionMode}
          >
            Delete intervention
          </Button>
          <Button variant="normal" onClick={() => setInterventionDeleteId(null)}>Cancel</Button>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="s">
        <Alert type="warning" statusIconAriaLabel="Warning">
          Deleting this intervention will remove all cost items linked to it.
        </Alert>
        <Box>
          {interventionToDelete
            ? `Delete ${resolveInterventionLabel(interventionToDelete.code) || "this intervention"}?`
            : "Delete this intervention?"}
        </Box>
      </SpaceBetween>
    </Modal>
  );

  const costLineDraft = costLineModal.draft || null;
  const costLineMode = costLineModal.mode;
  const isCostLineEditable = costLineMode === "add" || costLineMode === "edit";
  const costLineIntervention = costLineModal.interventionId
    ? proposedInterventions.find(item => idsMatch(item.id, costLineModal.interventionId))
    : null;
  const costLineTypeOptions = costLineIntervention ? buildCostItemOptions(costLineIntervention) : [];
  const costLineTypeLabel = costLineDraft
    ? paymentTypeLabelLookup.get(costLineDraft.type) || costLineDraft.type || ""
    : "";
  const costLineRecurrenceMode = getRecurrenceModeForType(costLineDraft?.type);
  const costLineRecurrenceRequired = costLineRecurrenceMode === RECURRENCE_MODE_REQUIRED;
  const costLineRecurrenceDisabled = costLineRecurrenceMode === RECURRENCE_MODE_NOT_ALLOWED;
  const costLineRecurrenceEnabled = costLineRecurrenceDisabled
    ? false
    : costLineRecurrenceRequired || Boolean(costLineDraft?.recurrence?.enabled);
  const costLineAmountDisplay = costLineDraft
    ? getCurrencyInputDisplayValue(
        sanitizeCurrencyInput(costLineDraft.amount),
        isCostLineEditable ? costLineAmountFocused : false,
      )
    : "";
  const costLineAmountPerPeriodDisplay = costLineDraft
    ? getCurrencyInputDisplayValue(
        sanitizeCurrencyInput(costLineDraft.recurrence?.amountPerPeriod),
        isCostLineEditable ? costLineAmountPerPeriodFocused : false,
      )
    : "";
  const costLineRecurrenceStart =
    costLineDraft?.recurrence?.startDate || costLineIntervention?.startDate || "";
  const costLineRecurrenceEnd =
    costLineDraft?.recurrence?.endDate || costLineIntervention?.endDate || "";
  const costLinePayeeType = String(costLineDraft?.payee?.type || "").trim();
  const costLineIsStudentLoanRepayment =
    normalizePaymentTypeCode(costLineDraft?.type) === "StudentLoanRepayment" ||
    normalizePayeeTypeKey(costLinePayeeType) === "studentloanservicer";
  const isParticipantPayeeType = costLinePayeeType === PAYEE_TYPE_PARTICIPANT_CLIENT;
  const lockParticipantPayeeName = isParticipantPayeeType && Boolean(participantLegalName);
  const costLinePayeeNamePlaceholder = isParticipantPayeeType
    ? participantLegalName
      ? "Auto-filled from participant legal name"
      : "Participant legal name unavailable - enter full legal name"
    : costLineIsStudentLoanRepayment
      ? "Enter loan provider or servicer name"
    : "Enter payee name";

  const costLineModalContent = (
    <Modal
      visible={costLineModal.visible}
      onDismiss={resetCostLineModal}
      header={costLineMode === "add" ? "Add cost item" : "Cost item details"}
      footer={
        costLineMode === "view" ? (
          <SpaceBetween direction="horizontal" size="xs">
            {!isFormLocked && (
              <Button variant="primary" onClick={() => setCostLineModal(prev => ({ ...prev, mode: "edit" }))}>Edit</Button>
            )}
            {!isFormLocked && (
              <Button
                variant="normal"
                onClick={() => {
                  if (!costLineModal.interventionId || !costLineModal.lineId) return;
                  removeCostLine(costLineModal.interventionId, costLineModal.lineId);
                  resetCostLineModal();
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="link" onClick={resetCostLineModal}>Close</Button>
          </SpaceBetween>
        ) : (
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="primary"
              onClick={commitCostLine}
              disabled={isFormLocked}
            >
              {costLineMode === "add" ? "Add cost item" : "Save changes"}
            </Button>
            <Button variant="link" onClick={resetCostLineModal}>Cancel</Button>
          </SpaceBetween>
        )
      }
    >
      {costLineDraft && (
        <SpaceBetween size="m">
          <FormField label="Cost item" errorText={costLineModalErrors.type}>
            {costLineMode === "add" ? (
              <Select
                selectedOption={
                  costLineDraft.type
                    ? { value: costLineDraft.type, label: paymentTypeLabelLookup.get(costLineDraft.type) || costLineDraft.type }
                    : null
                }
                onChange={({ detail }) => updateCostLineType(detail.selectedOption?.value || "")}
                options={costLineTypeOptions}
                placeholder="Select cost item"
                readOnly={isFormLocked}
              />
            ) : (
              <Input value={costLineTypeLabel} readOnly />
            )}
          </FormField>
          <FormField label="Total amount" errorText={costLineModalErrors.amount}>
            <Input
              inputMode="decimal"
              value={costLineAmountDisplay}
              onChange={({ detail }) => updateCostLineAmount(detail.value)}
              onFocus={() => setCostLineAmountFocused(true)}
              onBlur={blurCostLineAmount}
              placeholder="0.00"
              readOnly={!isCostLineEditable || isFormLocked}
            />
          </FormField>
          <FormField label="Payee type">
            <Select
              selectedOption={findOptionByValue(configuredPayeeTypeOptions, costLineDraft.payee?.type)}
              onChange={({ detail }) => updateCostLinePayeeType(detail.selectedOption?.value || "")}
              options={configuredPayeeTypeOptions}
              placeholder="Select payee type"
              readOnly={!isCostLineEditable || isFormLocked}
            />
          </FormField>
          <FormField label={costLineIsStudentLoanRepayment ? "Loan provider / servicer name" : "Payee name"}>
            <Input
              value={costLineDraft.payee?.name || ""}
              onChange={({ detail }) =>
                updateCostLineDraft({
                  payee: {
                    ...(costLineDraft.payee || {}),
                    name: detail.value,
                  },
                })
              }
              placeholder={costLinePayeeNamePlaceholder}
              readOnly={!isCostLineEditable || isFormLocked || lockParticipantPayeeName}
            />
          </FormField>
          {costLinePayeeType && !isParticipantPayeeType && (
            <FormField label={costLineIsStudentLoanRepayment ? "Loan account number (optional)" : "Payee reference (optional)"}>
              <Input
                value={costLineDraft.payee?.reference || ""}
                onChange={({ detail }) =>
                  updateCostLineDraft({
                    payee: {
                      ...(costLineDraft.payee || {}),
                      reference: detail.value,
                    },
                  })
                }
                placeholder={costLineIsStudentLoanRepayment ? "Enter loan account number" : "Vendor/account reference"}
                readOnly={!isCostLineEditable || isFormLocked}
              />
            </FormField>
          )}
          <FormField label="Installments (monthly)" errorText={costLineModalErrors.recurrence}>
            <Checkbox
              checked={costLineRecurrenceEnabled}
              onChange={({ detail }) => toggleCostLineRecurrence(detail.checked)}
              disabled={
                !isCostLineEditable ||
                costLineRecurrenceRequired ||
                costLineRecurrenceDisabled ||
                isFormLocked
              }
            >
              Enable installments
            </Checkbox>
          </FormField>
          {costLineRecurrenceEnabled && (
            <SpaceBetween size="s">
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField label="Start date">
                  <DatePicker
                    value={costLineRecurrenceStart}
                    onChange={({ detail }) => updateCostLineRecurrenceStart(detail.value)}
                    readOnly={!isCostLineEditable || isFormLocked}
                  />
                </FormField>
                <FormField label="End date (optional)">
                  <DatePicker
                    value={costLineRecurrenceEnd}
                    onChange={({ detail }) => updateCostLineRecurrenceEnd(detail.value)}
                    readOnly={!isCostLineEditable || isFormLocked}
                  />
                </FormField>
              </Grid>
              <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                <FormField label="Number of installments">
                  <Input
                    inputMode="numeric"
                    value={costLineDraft.recurrence?.occurrences || ""}
                    onChange={({ detail }) => updateCostLineOccurrences(detail.value)}
                    readOnly={!isCostLineEditable || isFormLocked}
                  />
                </FormField>
                <FormField label="Amount per month">
                  <Input
                    inputMode="decimal"
                    value={costLineAmountPerPeriodDisplay}
                    onChange={({ detail }) => updateCostLineAmountPerPeriod(detail.value)}
                    onFocus={() => setCostLineAmountPerPeriodFocused(true)}
                    onBlur={blurCostLineAmountPerPeriod}
                    readOnly={!isCostLineEditable || isFormLocked}
                  />
                </FormField>
              </Grid>
            </SpaceBetween>
          )}
          <FormField label="Notes (optional)">
            <Textarea
              value={costLineDraft.notes || ""}
              rows={3}
              onChange={({ detail }) => updateCostLineDraft({ notes: detail.value })}
              readOnly={!isCostLineEditable || isFormLocked}
            />
          </FormField>
        </SpaceBetween>
      )}
    </Modal>
  );

  const steps = activeStepIds
    .map(stepId => ({
      id: stepId,
      title:
        stepId === COMMUNICATION_STEP_ID
          ? isApprovedDecisionOutcome
            ? (isRevisionMode ? "Funding revision letters" : "Approval letters")
            : "Denial letter"
          : STEP_LABELS[stepId],
      content: {
        plan: planStepContent,
        framing: framingStepContent,
        rationale: rationaleStepContent,
        otherFunding: otherFundingStepContent,
        childcare: childcareStepContent,
        cost: costStepContent,
        docs: docsStepContent,
        review: reviewStepContent,
        decision: decisionStepContent,
        communication: communicationStepContent,
      }[stepId],
      isOptional: false,
    }))
    .filter(Boolean);

  const activeStepIndex = Math.max(activeStepIds.indexOf(currentStep), 0);
  const isCommunicationStep = currentStep === COMMUNICATION_STEP_ID;
  const wizardSubmitLabel = isCommunicationStep
    ? isApprovedDecisionOutcome
      ? (isRevisionMode ? "Send Client Funding Revision Letter" : "Send Client Approval letter")
      : "Send Client Denial letter"
    : isSubmittedStatus
      ? canDecideSubmittedProposal
        ? "Submit Decision"
        : "Save changes"
      : "Submit for approval";
  const wizardSubmitHandler = isCommunicationStep
    ? handleSubmitCommunication
    : isSubmittedStatus
      ? canDecideSubmittedProposal
        ? handleSubmitDecision
        : handleSave
      : handleSubmitProposal;
  const wizardIsWorking = isSubmitting || eiVerificationUploading;

  return (
    <BoardItem header={
      <Header
        variant="h2"
        info={infoLink}
        actions={
          <SpaceBetween direction="horizontal" size="s">
            <Badge color={statusBadgeColor}>{statusLabel}</Badge>
            {isEditable && !completionNote && (!isSubmittedStatus || !canDecideSubmittedProposal) && (
              <Button variant="primary" disabled={!isDirty} onClick={handleSave}>
                {isSubmittedStatus ? "Save Changes" : "Save Progress"}
              </Button>
            )}
          </SpaceBetween>
        }
      >
        {isRevisionMode ? "Revise approved intervention" : "Propose new intervention"}
      </Header>
    } i18nStrings={boardItemI18nStrings} settings={
      <ButtonDropdown
        items={[{ id: "remove", text: "Remove" }]}
        ariaLabel="Board item settings"
        variant="icon"
        onItemClick={() => actions && actions.removeItem && actions.removeItem()}
      />
    }>
      <div id="intervention-assessment-widget">
        <Box variant="small" margin={{ bottom: "s" }}>
          {headerDescription}
        </Box>
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)} statusIconAriaLabel="Error">
            {error}
          </Alert>
        )}
        {successMessage && !completionNote && (
          <Alert type="success" dismissible onDismiss={() => setSuccessMessage("")} statusIconAriaLabel="Success">
            {successMessage}
          </Alert>
        )}
        {completionNote ? (
          <Alert
            type={completionNote.type || "success"}
            header={completionNote.header}
            statusIconAriaLabel={completionNote.type === "info" ? "Info" : "Success"}
            action={<Button onClick={handleStartAnotherProposal}>Start new proposal</Button>}
          >
            {completionNote.body}
          </Alert>
        ) : (
          <Wizard
            className={isPlanStepBlocked || isFramingStepBlocked ? styles.blockNext : undefined}
            activeStepIndex={activeStepIndex}
            isLoadingNextStep={wizardIsWorking}
            onNavigate={async ({ detail }) => {
              const requestedStepIndex = detail?.requestedStepIndex;
              if (requestedStepIndex < 0 || requestedStepIndex >= activeStepIds.length) return;
              const requestedStepId = activeStepIds[requestedStepIndex];
              const currentIdx = activeStepIds.indexOf(currentStep);
              const movingForward = requestedStepIndex > currentIdx;
              if (movingForward && isPlanStepBlocked) {
                setAttemptedSteps(prev => ({ ...prev, plan: true }));
                setError("Create an action plan before proposing interventions.");
                return;
              }
              if (movingForward && isFramingStepBlocked) {
                setAttemptedSteps(prev => ({ ...prev, framing: true }));
                setError("Add at least one proposed intervention before continuing.");
                return;
              }
              if (movingForward && currentStep === "decision" && requestedStepId === COMMUNICATION_STEP_ID) {
                const { reasons, targetStep } = getDecisionBlockingIssues({ requireActiveIntervention: true });
                if (reasons.length) {
                  if (needsActionPlanFundingSetup) {
                    setActionPlanFundingErrors(validateActionPlanFundingDraft(actionPlanFundingDraft));
                  }
                  setDecisionBlockerReasons(reasons);
                  setDecisionBlockerTargetStep(targetStep);
                  setDecisionBlockerVisible(true);
                  return;
                }
              }
              if (movingForward) {
                setAttemptedSteps(prev => ({ ...prev, [currentStep]: true }));
                if (!validateStep(currentStep)) {
                  setError("Complete required fields before continuing.");
                  return;
                }
              }
              if (
                requestedStepIndex !== currentIdx &&
                !isSubmittedStatus &&
                isEditable &&
                isDirty &&
                !isSubmitting &&
                canAutoSave
              ) {
                const saveResult = await handleSave({ silent: true });
                if (!saveResult?.ok) {
                  setError(saveResult?.error?.message || "Failed to save progress.");
                  return;
                }
              }
              setError(null);
              setCurrentStep(requestedStepId);
            }}
            onSubmit={isEditable && !wizardIsWorking ? wizardSubmitHandler : undefined}
            submitButtonText={isEditable ? (wizardIsWorking ? "Working" : wizardSubmitLabel) : "Read only"}
            cancelButtonText={isEditable ? "Cancel" : undefined}
            nextButtonText="Next"
            previousButtonText="Previous"
            steps={steps}
          />
        )}
        {sendApprovalLetterConfirmModal}
        {decisionBlockerModal}
        {otherFundingSourceModalContent}
        {interventionModalContent}
        {interventionDeleteModal}
        {costLineModalContent}
      </div>
    </BoardItem>
  );
};

export default InterventionAssessmentWidget;
