export const normalizeTemplateSentence = value => {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
};

const applyCommonCorrections = value =>
  String(value || "")
    .replace(/\bineligble\b/gi, "ineligible")
    .replace(/\beligble\b/gi, "eligible")
    .replace(/\belligible\b/gi, "eligible")
    .replace(/\bineligibility\b/gi, "ineligibility")
    .replace(/\blong term\b/gi, "long-term")
    .replace(/\bfull time\b/gi, "full-time")
    .replace(/\bpart time\b/gi, "part-time")
    .replace(/\bself employed\b/gi, "self-employed");

const lowerCaseLeadWord = value => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^[A-Z][a-z]/.test(trimmed)) {
    return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
  }
  return trimmed;
};

export const normalizeApplicantFacingNote = value => {
  let normalized = applyCommonCorrections(value).trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  normalized = normalized
    .replace(/^(reason|notes?)\s*[:\-]\s*/i, "")
    .replace(
      /^(person|client|applicant)\s+is\s+(ineligible|not eligible)\s+(?:on\s+the\s+grounds\s+that|because)\s+/i,
      ""
    )
    .replace(/^(it|this application|the application)\s+is\s+(ineligible|not eligible)\s+(?:because|as)\s+/i, "")
    .replace(/^(ineligible|not eligible)\s+(?:because|on\s+the\s+grounds\s+that)\s+/i, "")
    .replace(/^(person|client|applicant)\s+is\s+/i, "you are ")
    .replace(/^(person|client|applicant)\s+has\s+/i, "you have ")
    .replace(/^(person|client|applicant)\s+was\s+/i, "you were ")
    .replace(/^(person|client|applicant)\s+were\s+/i, "you were ")
    .replace(/^(person|client|applicant)\s+remain(s)?\s+/i, "you remain ")
    .replace(/^(person|client|applicant)\s+do(es)?\s+not\s+/i, "you do not ")
    .replace(/^(person|client|applicant)\s+cannot\s+/i, "you cannot ")
    .replace(/\bthey are\b/gi, "you are")
    .replace(/\bthey have\b/gi, "you have")
    .replace(/\bthey were\b/gi, "you were")
    .replace(/\bthey remain\b/gi, "you remain")
    .replace(/\bthey do not\b/gi, "you do not")
    .replace(/\bshe is\b/gi, "you are")
    .replace(/\bhe is\b/gi, "you are")
    .replace(/\bshe has\b/gi, "you have")
    .replace(/\bhe has\b/gi, "you have")
    .replace(/\bshe was\b/gi, "you were")
    .replace(/\bhe was\b/gi, "you were")
    .replace(/\bshe remains\b/gi, "you remain")
    .replace(/\bhe remains\b/gi, "you remain")
    .replace(/\bshe does not\b/gi, "you do not")
    .replace(/\bhe does not\b/gi, "you do not")
    .replace(/\bher\b/gi, "your")
    .replace(/\bhis\b/gi, "your")
    .replace(/\btheir\b/gi, "your")
    .replace(/\bhim\b/gi, "you")
    .replace(/\bthem\b/gi, "you");

  if (/^[a-z0-9][a-z0-9\s/&-]+ missing$/i.test(normalized) && !/\b(is|are|was|were)\b/i.test(normalized)) {
    normalized = normalized.replace(/\bmissing$/i, "is missing");
  }
  if (/^[a-z0-9][a-z0-9\s/&-]+ insufficient$/i.test(normalized) && !/\b(is|are|was|were)\b/i.test(normalized)) {
    normalized = normalized.replace(/\binsufficient$/i, "is insufficient");
  }

  return normalizeTemplateSentence(normalized);
};

export const buildApplicantFacingReasonSentence = (
  value,
  leadIn = "Our file review indicates that"
) => {
  const normalized = normalizeApplicantFacingNote(value);
  if (!normalized) return "";
  const withoutTerminalPunctuation = normalized.replace(/[.!?]+$/, "").trim();
  if (!withoutTerminalPunctuation) return "";
  return `${leadIn} ${lowerCaseLeadWord(withoutTerminalPunctuation)}.`;
};
