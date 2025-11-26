const OPTION_LABELS = {
  "labour-force-status": {
    unemployed: "Unemployed",
    underemployed: "Underemployed",
    "employed-full-time": "Employed full-time",
    "employed-part-time": "Employed part-time",
    "self-employed": "Self-employed",
    student: "Student",
    other: "Other",
  },
  "highest-education": {
    no_formal_education: "No formal education",
    grade_7_8: "Grade 7-8",
    grade_9_10: "Grade 9-10",
    grade_11_12: "Grade 11-12",
    secondary_school_diploma_or_ged: "Secondary School Diploma or GED",
    post_secondary_training: "Some post-secondary training",
    apprenticeship_trades: "Apprenticeship / trades certificate or diploma",
    cegep: "CEGEP or other non-university certificate / diploma",
    college: "College or other non-university certificate / diploma",
    university_certificate: "University certificate or diploma",
    bachelors_degree: "Bachelor's degree",
    masters_degree: "Master's degree",
    doctorate: "Doctorate",
  },
  barriers: {
    education: "Education",
    funding: "Funding",
    "lack-of-job-opportunities": "Lack of job opportunities",
    location: "Location",
    childcare: "Childcare",
    other: "Other",
  },
  "local-area-priorities": {
    literacy: "Literacy",
    numeracy: "Numeracy",
    trades: "Skilled trades",
    entrepreneurship: "Entrepreneurship",
    other: "Other",
  },
  "social-assistance": {
    yes: "Yes",
    no: "No",
    true: "Yes",
    false: "No",
    1: "Yes",
    0: "No",
  },
};

const normaliseKey = value => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number" || typeof value === "boolean") return String(value).toLowerCase();
  return null;
};

export const formatOptionValue = (mapKey, rawValue) => {
  if (rawValue === null || typeof rawValue === "undefined" || rawValue === "") return null;
  const map = OPTION_LABELS[mapKey];
  if (!map) {
    return typeof rawValue === "string" && rawValue.trim().length ? rawValue : String(rawValue);
  }
  if (Array.isArray(rawValue)) {
    return rawValue
      .map(item => formatOptionValue(mapKey, item))
      .filter(Boolean)
      .join(", ");
  }
  const lookupKey = normaliseKey(rawValue);
  if (lookupKey && Object.prototype.hasOwnProperty.call(map, lookupKey)) {
    return map[lookupKey];
  }
  if (typeof rawValue === "string" && rawValue.trim().length) {
    return rawValue;
  }
  return String(rawValue);
};

export const formatBarriers = values => {
  if (!values) return null;
  if (Array.isArray(values)) {
    const formatted = values
      .map(value => formatOptionValue("barriers", value))
      .filter(Boolean);
    return formatted.length ? formatted.join(", ") : null;
  }
  return formatOptionValue("barriers", values);
};

export const formatLabourForceStatus = value =>
  formatOptionValue("labour-force-status", value);

export const formatEducationLevel = value =>
  formatOptionValue("highest-education", value);

export const formatLocalPriorities = values => {
  if (!values) return null;
  if (Array.isArray(values)) {
    const formatted = values
      .map(value => formatOptionValue("local-area-priorities", value))
      .filter(Boolean);
    return formatted.length ? formatted.join(", ") : null;
  }
  return formatOptionValue("local-area-priorities", values);
};
