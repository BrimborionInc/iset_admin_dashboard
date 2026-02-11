import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Autosuggest,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  CopyToClipboard,
  DatePicker,
  FormField,
  Header,
  Hotspot,
  ExpandableSection,
  Input,
  Link,
  Multiselect,
  Badge,
  Select,
  Table,
  Textarea,
  SpaceBetween,
  Tabs,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import { apiFetch } from "../../../../auth/apiClient.js";

const genderOptions = [
  { value: "", label: "Not set" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const yesNoOptions = [
  { value: "", label: "Not set" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const normalizeYesNo = value => {
  if (value === null || typeof value === "undefined") return "";
  const trimmed = String(value).trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(trimmed)) return "yes";
  if (["no", "n", "false", "0"].includes(trimmed)) return "no";
  return trimmed || "";
};

const genderIdentityOptions = [
  { value: "", label: "Not set" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

const legalIndigenousIdentityOptions = [
  { value: "", label: "Not set" },
  { value: "first_nations_status", label: "First Nations (Status)" },
  { value: "first_nations_non_status", label: "First Nations (Non-Status)" },
  { value: "inuit", label: "Inuit" },
  { value: "metis", label: "Metis" },
];

const languageSpokenOptions = [
  { value: "", label: "Not set" },
  { value: "1", label: "Indigenous language(s) only" },
  { value: "2", label: "English only" },
  { value: "3", label: "French only" },
  { value: "4", label: "Indigenous language(s) and English" },
  { value: "5", label: "Indigenous language(s) and French" },
  { value: "6", label: "English and French" },
  { value: "7", label: "Indigenous language(s), English and French" },
  { value: "8", label: "None of the above" },
];

const maritalStatusOptions = [
  { value: "", label: "Not set" },
  { value: "married", label: "Married or equivalent" },
  { value: "single", label: "Single" },
  { value: "separated", label: "Separated" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
];

const barrierOptions = [
  { value: "education", label: "Education" },
  { value: "funding", label: "Funding" },
  { value: "lack-of-job-opportunities", label: "Lack of job opportunities" },
  { value: "location", label: "Location" },
  { value: "other", label: "Other" },
];

const supportOptions = [
  { value: "tuition", label: "Tuition" },
  { value: "books", label: "Books or program materials" },
  { value: "living", label: "Living allowance" },
  { value: "transportation", label: "Transportation" },
  { value: "childcare", label: "Childcare" },
  { value: "other", label: "Other" },
];

const childcareFundingOptions = [
  { value: "no-funding-received", label: "No funding received" },
  { value: "ei-crf", label: "EI/CRF" },
  { value: "provincial-funding-subsidy", label: "Provincial funding/subsidy" },
  { value: "fnicci", label: "FNICCI" },
  { value: "daycare-not-available", label: "Daycare not available" },
  { value: "assisted-by-family", label: "Assisted by family" },
];

const expensesTransportOptions = [
  { value: "buss_pass", label: "Bus pass" },
  { value: "parking", label: "Parking (at the school)" },
  { value: "mileage", label: "Mileage (home to school)" },
];

const amountFieldMap = {
  "income-employment": "incomeEmployment",
  "income-spousal": "incomeSpousal",
  "income-social-assist": "incomeSocialAssist",
  "income-child-support": "incomeChildSupport",
  "income-child-benefit": "incomeChildBenefit",
  "income-jordans": "incomeJordans",
  "income-band-funding": "incomeBandFunding",
  "income-alimony": "incomeAlimony",
  "income-other-description": "incomeOtherAmount",
  "expenses-rent": "expensesRent",
  "expenses-groceries": "expensesGroceries",
  "expenses-electricity": "expensesElectricity",
  "expenses-heating": "expensesHeating",
  "expenses-water": "expensesWater",
  "expenses-sewerage": "expensesSewerage",
  "expenses-garbage": "expensesGarbage",
  "expenses_bus_pass": "expensesBusPass",
  "expenses-parking": "expensesParking",
  "expenses-other-total": "expensesOtherTotal",
};

const labourForceStatusOptions = [
  { value: "", label: "Not set" },
  { value: "unemployed", label: "Unemployed" },
  { value: "underemployed", label: "Underemployed" },
  { value: "employed-full-time", label: "Employed full-time" },
  { value: "employed-part-time", label: "Employed part-time" },
  { value: "self-employed", label: "Self-employed" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
];

const highestEducationOptions = [
  { value: "", label: "Not set" },
  { value: "no_formal_education", label: "No formal education" },
  { value: "grade_7_8", label: "Up to Grade 7-8" },
  { value: "grade_9_10", label: "Grade 9-10" },
  { value: "grade_11_12", label: "Grade 11-12" },
  { value: "secondary_school_diploma_or_ged", label: "Secondary School Diploma or GED" },
  { value: "post_secondary_training", label: "Some post-secondary training" },
  { value: "apprenticeship_trades", label: "Apprenticeship / trades certificate or diploma" },
  { value: "cegep", label: "CEGEP or other non-university certificate / diploma" },
  { value: "college", label: "College or other non-university certificate / diploma" },
  { value: "university_certificate", label: "University certificate or diploma" },
  { value: "bachelors_degree", label: "Bachelor's degree" },
  { value: "masters_degree", label: "Master's degree" },
  { value: "doctorate", label: "Doctorate" },
];

const educationLocationOptions = [
  { value: "", label: "Not set" },
  { value: "ab", label: "Alberta" },
  { value: "bc", label: "British Columbia" },
  { value: "mb", label: "Manitoba" },
  { value: "nb", label: "New Brunswick" },
  { value: "nl", label: "Newfoundland and Labrador" },
  { value: "ns", label: "Nova Scotia" },
  { value: "nt", label: "Northwest Territories" },
  { value: "nu", label: "Nunavut" },
  { value: "on", label: "Ontario" },
  { value: "pe", label: "Prince Edward Island" },
  { value: "qc", label: "Quebec" },
  { value: "sk", label: "Saskatchewan" },
  { value: "yt", label: "Yukon Territory" },
  { value: "other", label: "Other" },
];

const targetProgramOptions = [
  { value: "", label: "Not set" },
  { value: "skills_development", label: "Skills Development (Education)" },
  { value: "tws", label: "Targeted Wage Subsidy" },
  { value: "jcp", label: "Job Creation Partnership" },
  { value: "group", label: "Group Training" },
  { value: "self_support", label: "Self-employment supports" },
  { value: "not_yet", label: "Not yet" },
];


const cleanSin = (raw = "") => {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits || "";
};

const REGISTRATION_KEYS = [
  "sfn-registration-number",
  "nsfn-registration-number",
  "metis-registration-number",
  "inuit-registration-number",
  "registration-number",
];

const makeAnswerReader = answers => key => {
  if (!answers || typeof answers !== "object") return "";
  const value = answers[key];
  if (value === null || typeof value === "undefined") return "";
  if (typeof value === "object") {
    if (value?.value) return String(value.value);
    if (value?.text) return String(value.text);
    return "";
  }
  return String(value);
};

const getRegistrationValueFromSources = (answers, caseContext, personal) => {
  const readAnswer = makeAnswerReader(answers);
  const candidates = [
    caseContext?.registrationNumber,
    personal?.registration_number,
    personal?.registrationNumber,
    ...REGISTRATION_KEYS.map(key => readAnswer(key)),
  ];
  const found = candidates.find(val => val !== undefined && val !== null && String(val).trim() !== "");
  return found ? String(found) : "";
};

const getRegistrationTargetKey = answers => {
  const readAnswer = makeAnswerReader(answers);
  for (const key of REGISTRATION_KEYS) {
    const val = readAnswer(key);
    if (val && String(val).trim() !== "") return key;
  }
  return "sfn-registration-number";
};

const formatCurrency = amount => {
  if (amount === null || typeof amount === "undefined" || amount === "") return "$0";
  const num = Number(amount);
  if (Number.isNaN(num)) return "$0";
  return num.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 0 });
};

const isValidSin = digits => {
  if (!/^\d{9}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

const provinceOptions = [
  "NL",
  "NS",
  "NB",
  "PE",
  "QC",
  "ON",
  "MB",
  "SK",
  "AB",
  "BC",
  "NT",
  "YT",
  "NU",
  "US",
  "OT",
].map(code => ({ value: code, label: code }));

const NOC_VERSION_OPTIONS = [
  { value: "2021", label: "2021" },
  { value: "2016", label: "2016" },
];

const ParticipantDetailsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    saveCaseContext,
    nocVersions: contextNocVersions,
    nocVersionsLoading: contextNocVersionsLoading,
    loadNocVersions: loadContextNocVersions,
    searchNocCodes,
  } = useCaseWorkspace();
  const caseContext = caseData?.caseContext || {};
  const answers =
    caseContext.applicationAnswers ||
    caseContext.applicationPayload?.answers ||
    {};
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocSuggestionsLoading, setNocSuggestionsLoading] = useState(false);
  const [programNocSuggestions, setProgramNocSuggestions] = useState([]);
  const [programNocSuggestionsLoading, setProgramNocSuggestionsLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const errorAlertRef = React.useRef(null);
  const successAlertRef = React.useRef(null);
  const initialFormRef = React.useRef(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    preferredName: "",
    middleNames: "",
    gender: "",
    genderIdentity: "",
    sex: "",
    pronouns: "",
    sin: "",
    dateOfBirth: "",
    addressLine1: "",
    addressLine2: "",
    addressCity: "",
    addressProvince: "",
    postalCode: "",
    emailPrimary: "",
    phonePrimary: "",
    phoneAlt: "",
    mailingLine1: "",
    mailingLine2: "",
    mailingCity: "",
    mailingProvince: "",
    mailingPostal: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelationship: "",
    indigenousIdentity: "",
    indigenousAffiliation: "",
    registrationNumber: "",
    languageSpoken: "",
    visibleMinority: "",
    maritalStatus: "",
    spouseName: "",
    dependentChildren: "",
    agesOfChildren: "",
    hasDisability: "",
    disabilityDescription: "",
    homeCommunity: "",
    householdComposition: "",
    socialAssistance: "",
    topUpAmount: "",
    disabilitySupport: "",
    disabilitySupportDetails: "",
    labourForceStatus: "",
    highestEducation: "",
    educationYear: "",
    educationLocation: "",
    targetProgram: "",
    employerName: "",
    employmentNocVersion: "",
    employmentNoc: "",
    programEmployer: "",
    programNocVersion: "",
    programNoc: "",
    programTrainingProvider: "",
    employmentGoals: "",
    employmentBarriers: [],
    otherBarrier: "",
    requestedSupports: [],
    childcareFunding: [],
    otherRequestedSupport: "",
    employmentGoalNarrative: "",
    shortTermGoal: "",
    incomeOther: "",
    expensesTransport: [],
    expensesOtherList: "",
    loanGrant: "",
    loanGrantDetails: "",
    expensesTransportMileage: "",
    incomeEmployment: "",
    incomeSpousal: "",
    incomeSocialAssist: "",
    incomeChildSupport: "",
    incomeChildBenefit: "",
    incomeJordans: "",
    incomeBandFunding: "",
    incomeAlimony: "",
    incomeOtherAmount: "",
    expensesRent: "",
    expensesGroceries: "",
    expensesElectricity: "",
    expensesHeating: "",
    expensesWater: "",
    expensesSewerage: "",
    expensesGarbage: "",
    expensesBusPass: "",
    expensesParking: "",
    expensesOtherTotal: "",
  });
  const [bandSearchOptions, setBandSearchOptions] = useState({ home: [] });
  const [bandSearchLoading, setBandSearchLoading] = useState({ home: false });

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Participant details", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const searchIndigenousBands = useCallback(
    async (query, key = "home") => {
      const targetKey = key || "home";
      const trimmed = (query || "").trim();
      if (trimmed.length < 2) {
        setBandSearchOptions(prev => ({ ...prev, [targetKey]: [] }));
        return;
      }
      setBandSearchLoading(prev => ({ ...prev, [targetKey]: true }));
      try {
        const res = await apiFetch(`/api/reference/indigenous-bands?query=${encodeURIComponent(trimmed)}`, {
          method: "GET",
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json().catch(() => []);
        const options = Array.isArray(data)
          ? data
              .map(item => ({
                value: item.bandName || "",
                label: item.bandNumber ? `${item.bandName} (${item.bandNumber})` : item.bandName || "",
                description: item.type ? `Type: ${item.type}` : undefined,
              }))
              .filter(opt => opt.value)
          : [];
        setBandSearchOptions(prev => ({ ...prev, [targetKey]: options }));
      } catch (err) {
        console.error("Failed to search indigenous bands", err?.message || err);
      } finally {
        setBandSearchLoading(prev => ({ ...prev, [targetKey]: false }));
      }
    },
    []
  );

  useEffect(() => {
    const personal = caseContext.applicationPersonal || {};
    const readAnswer = makeAnswerReader(answers);
    const address = caseContext.address || personal.address || personal.home_address || personal.homeAddress || {};
    const mailingAddress = caseContext.mailingAddress || {};
    const addressFromAnswers = {
      line1: readAnswer("address-street-address"),
      line2: readAnswer("address-mailing-address"),
      city: readAnswer("address-city"),
      province: readAnswer("address-province")?.toUpperCase?.() || "",
      postalCode: readAnswer("address-postcode"),
    };
    const derivedDob =
      caseContext.dateOfBirth ||
      personal.date_of_birth ||
      personal.dateOfBirth ||
      readAnswer("dob") ||
      "";
    const derivedGender =
      caseContext.gender ||
      personal.gender ||
      readAnswer("gender") ||
      readAnswer("biological_sex") ||
      readAnswer("gender_identity") ||
      readAnswer("gender-identity") ||
      "";
    const derivedGenderIdentity =
      caseContext.genderIdentity ||
      personal.gender_identity ||
      personal.genderIdentity ||
      readAnswer("gender_identity") ||
      readAnswer("gender-identity") ||
      "";
    const derivedPronouns =
      caseContext.pronouns ||
      personal.pronouns ||
      readAnswer("pronouns") ||
      "";
    const derivedSex = caseContext.sex || personal.sex || readAnswer("sex") || readAnswer("biological_sex") || "";
    const derivedSin =
      caseContext.sin ||
      personal.sin ||
      readAnswer("social_insurance_number") ||
      readAnswer("social-insurance-number") ||
      readAnswer("sin") ||
      "";
    setForm({
      firstName: caseContext.firstName || personal.first_name || personal.firstName || readAnswer("first-name") || "",
      lastName: caseContext.lastName || personal.last_name || personal.lastName || readAnswer("last-name") || "",
      preferredName:
        caseContext.preferredName ||
        personal.preferred_name ||
        personal.preferredName ||
        readAnswer("preferred-name") ||
        "",
      middleNames: caseContext.middleNames || personal.middle_names || personal.middleNames || readAnswer("middle-names") || "",
      gender: derivedGender,
      genderIdentity: derivedGenderIdentity,
      pronouns: derivedPronouns,
      sex: derivedSex,
      sin: derivedSin,
      dateOfBirth: derivedDob,
      addressLine1: address.line1 || address.address1 || address.address_line_1 || addressFromAnswers.line1 || "",
      addressLine2: address.line2 || address.address2 || address.address_line_2 || addressFromAnswers.line2 || "",
      addressCity: address.city || addressFromAnswers.city || "",
      addressProvince: address.province || addressFromAnswers.province || "",
      postalCode: address.postalCode || address.postal_code || addressFromAnswers.postalCode || "",
      mailingLine1: mailingAddress.line1 || addressFromAnswers.line2 || "",
      mailingLine2: mailingAddress.line2 || "",
      mailingCity: mailingAddress.city || "",
      mailingProvince: mailingAddress.province || "",
      mailingPostal: mailingAddress.postalCode || "",
      emailPrimary: caseContext.emailPrimary || personal.email || readAnswer("contact-email-address") || "",
      phonePrimary: caseContext.phonePrimary || personal.phone || readAnswer("telephone-day") || "",
      phoneAlt: caseContext.phoneAlt || personal.phone_alt || readAnswer("telephone-alt") || "",
      emergencyName: caseContext.emergencyName || readAnswer("emergency-contact-name") || "",
      emergencyPhone: caseContext.emergencyPhone || readAnswer("emergency-contact-telephone") || "",
      emergencyRelationship: caseContext.emergencyRelationship || readAnswer("emergency-contact-relationship") || "",
      indigenousIdentity:
        caseContext.indigenousIdentity ||
        readAnswer("legal-indigenous-identity") ||
        personal.legal_indigenous_identity ||
        "",
      indigenousAffiliation:
        caseContext.indigenousAffiliation ||
        readAnswer("indigenous-affiliation-declaration") ||
        personal.indigenous_affiliation ||
        "",
      registrationNumber: getRegistrationValueFromSources(answers, caseContext, personal),
      languageSpoken:
        caseContext.languageSpoken ||
        caseContext.preferredLanguage ||
        readAnswer("language-spoken") ||
        readAnswer("preferred-language") ||
        "",
      visibleMinority:
        normalizeYesNo(caseContext.visibleMinority) || normalizeYesNo(readAnswer("visible-minority")) || "",
      maritalStatus: caseContext.maritalStatus || readAnswer("marital-status") || "",
      spouseName: caseContext.spouseName || readAnswer("spouses-name") || "",
      dependentChildren: caseContext.dependentChildren || readAnswer("dependent-children") || "",
      agesOfChildren: caseContext.agesOfChildren || readAnswer("ages-of-children") || "",
      hasDisability:
        normalizeYesNo(caseContext.hasDisability) || normalizeYesNo(readAnswer("has-disability")) || "",
      disabilityDescription: caseContext.disabilityDescription || readAnswer("disability-description") || "",
      homeCommunity:
        caseContext.homeCommunity ||
        readAnswer("home-community") ||
        readAnswer("home-comminuty") ||
        personal.home_community ||
        personal.homeCommunity ||
        "",
      householdComposition: caseContext.householdComposition || readAnswer("household-composition") || "",
      socialAssistance: normalizeYesNo(caseContext.socialAssistance) || normalizeYesNo(readAnswer("social-assistance")) || "",
      topUpAmount: caseContext.topUpAmount || readAnswer("top-up-amount") || "",
      disabilitySupport:
        normalizeYesNo(caseContext.disabilitySupport) || normalizeYesNo(readAnswer("disability-support")) || "",
      disabilitySupportDetails: caseContext.disabilitySupportDetails || readAnswer("disability-support_yes_follow") || "",
      labourForceStatus: caseContext.employmentStatus || readAnswer("labour-force-status") || "",
      highestEducation:
        caseContext.educationLevel ||
        readAnswer("action-plan-result-education-level") ||
        readAnswer("highest-education") ||
        readAnswer("education-level") ||
        readAnswer("education-highest-level") ||
        "",
      educationYear: caseContext.educationYear || readAnswer("education-year") || "",
      educationLocation: caseContext.educationProvince || readAnswer("education-location") || "",
      targetProgram: caseContext.targetProgram || readAnswer("target-program") || "",
      employerName: caseContext.employerName || "",
      employmentNocVersion: caseContext.employmentNocVersion || "",
      employmentNoc: caseContext.employmentNoc || "",
      programEmployer: caseContext.programEmployer || "",
      programNocVersion: caseContext.programNocVersion || "",
      programNoc: caseContext.programNoc || "",
      programTrainingProvider: caseContext.programTrainingProvider || "",
      employmentGoals: caseContext.employmentGoals || readAnswer("employment-goals") || "",
      employmentBarriers:
        Array.isArray(caseContext.employmentBarriers)
          ? caseContext.employmentBarriers
          : Array.isArray(readAnswer("barriers"))
          ? readAnswer("barriers")
          : [],
      otherBarrier: readAnswer("other-barrier") || "",
      requestedSupports:
        Array.isArray(caseContext.requestedSupports)
          ? caseContext.requestedSupports
          : Array.isArray(readAnswer("requested-supports"))
          ? readAnswer("requested-supports")
          : [],
      childcareFunding:
        Array.isArray(caseContext.childcareFunding) && caseContext.childcareFunding.length
          ? caseContext.childcareFunding
          : Array.isArray(readAnswer("childcare-fuding-status"))
          ? readAnswer("childcare-fuding-status")
          : [],
      otherRequestedSupport: readAnswer("other-requested-support") || "",
      employmentGoalNarrative: caseContext.longTermGoal || readAnswer("long-term-goal") || "",
      shortTermGoal: caseContext.shortTermGoal || readAnswer("short-term-goal") || "",
      incomeOther: caseContext.incomeOther ?? readAnswer("income-other") ?? "",
      expensesTransport:
        Array.isArray(caseContext.expensesTransport) && caseContext.expensesTransport.length
          ? caseContext.expensesTransport
          : Array.isArray(readAnswer("expenses-transport"))
          ? readAnswer("expenses-transport")
          : Array.isArray(readAnswer("expenses_transport"))
          ? readAnswer("expenses_transport")
          : [],
      expensesOtherList: caseContext.expensesOtherList ?? readAnswer("expenses-other-list") ?? "",
      loanGrant: normalizeYesNo(caseContext.loanGrant) || normalizeYesNo(readAnswer("loan-grant")) || "",
      loanGrantDetails: caseContext.loanGrantDetails ?? readAnswer("loan-grant-details") ?? "",
      expensesTransportMileage:
        caseContext.expensesTransportMileage ?? readAnswer("expenses_transport_mileage") ?? "",
      incomeEmployment: caseContext.incomeEmployment ?? readAnswer("income-employment") ?? "",
      incomeSpousal: caseContext.incomeSpousal ?? readAnswer("income-spousal") ?? "",
      incomeSocialAssist: caseContext.incomeSocialAssist ?? readAnswer("income-social-assist") ?? "",
      incomeChildSupport: caseContext.incomeChildSupport ?? readAnswer("income-child-support") ?? "",
      incomeChildBenefit: caseContext.incomeChildBenefit ?? readAnswer("income-child-benefit") ?? "",
      incomeJordans: caseContext.incomeJordans ?? readAnswer("income-jordans") ?? "",
      incomeBandFunding: caseContext.incomeBandFunding ?? readAnswer("income-band-funding") ?? "",
      incomeAlimony: caseContext.incomeAlimony ?? readAnswer("income-alimony") ?? "",
      incomeOtherAmount: caseContext.incomeOtherAmount ?? readAnswer("income-other-description") ?? "",
      expensesRent: caseContext.expensesRent ?? readAnswer("expenses-rent") ?? "",
      expensesGroceries: caseContext.expensesGroceries ?? readAnswer("expenses-groceries") ?? "",
      expensesElectricity: caseContext.expensesElectricity ?? readAnswer("expenses-electricity") ?? "",
      expensesHeating: caseContext.expensesHeating ?? readAnswer("expenses-heating") ?? "",
      expensesWater: caseContext.expensesWater ?? readAnswer("expenses-water") ?? "",
      expensesSewerage: caseContext.expensesSewerage ?? readAnswer("expenses-sewerage") ?? "",
      expensesGarbage: caseContext.expensesGarbage ?? readAnswer("expenses-garbage") ?? "",
      expensesBusPass: caseContext.expensesBusPass ?? readAnswer("expenses_bus_pass") ?? "",
      expensesParking: caseContext.expensesParking ?? readAnswer("expenses-parking") ?? "",
      expensesOtherTotal: caseContext.expensesOtherTotal ?? readAnswer("expenses-other-total") ?? "",
    });
    initialFormRef.current = {
      firstName: caseContext.firstName || personal.first_name || personal.firstName || readAnswer("first-name") || "",
      lastName: caseContext.lastName || personal.last_name || personal.lastName || readAnswer("last-name") || "",
      preferredName:
        caseContext.preferredName ||
        personal.preferred_name ||
        personal.preferredName ||
        readAnswer("preferred-name") ||
        "",
      middleNames:
        caseContext.middleNames || personal.middle_names || personal.middleNames || readAnswer("middle-names") || "",
      gender: derivedGender,
      genderIdentity: derivedGenderIdentity,
      pronouns: derivedPronouns,
      sex: derivedSex,
      sin: derivedSin,
      dateOfBirth: derivedDob,
      addressLine1: address.line1 || address.address1 || address.address_line_1 || addressFromAnswers.line1 || "",
      addressLine2: address.line2 || address.address2 || address.address_line_2 || addressFromAnswers.line2 || "",
      addressCity: address.city || addressFromAnswers.city || "",
      addressProvince: address.province || addressFromAnswers.province || "",
      postalCode: address.postalCode || address.postal_code || addressFromAnswers.postalCode || "",
      mailingLine1: mailingAddress.line1 || addressFromAnswers.line2 || "",
      mailingLine2: mailingAddress.line2 || "",
      mailingCity: mailingAddress.city || "",
      mailingProvince: mailingAddress.province || "",
      mailingPostal: mailingAddress.postalCode || "",
      emailPrimary: caseContext.emailPrimary || personal.email || readAnswer("contact-email-address") || "",
      phonePrimary: caseContext.phonePrimary || personal.phone || readAnswer("telephone-day") || "",
      phoneAlt: caseContext.phoneAlt || personal.phone_alt || readAnswer("telephone-alt") || "",
      emergencyName: caseContext.emergencyName || readAnswer("emergency-contact-name") || "",
      emergencyPhone: caseContext.emergencyPhone || readAnswer("emergency-contact-telephone") || "",
      emergencyRelationship: caseContext.emergencyRelationship || readAnswer("emergency-contact-relationship") || "",
      indigenousIdentity:
        caseContext.indigenousIdentity ||
        readAnswer("legal-indigenous-identity") ||
        personal.legal_indigenous_identity ||
        "",
      indigenousAffiliation:
        caseContext.indigenousAffiliation ||
        readAnswer("indigenous-affiliation-declaration") ||
        personal.indigenous_affiliation ||
        "",
      registrationNumber: getRegistrationValueFromSources(answers, caseContext, personal),
      languageSpoken:
        caseContext.languageSpoken ||
        caseContext.preferredLanguage ||
        readAnswer("language-spoken") ||
        readAnswer("preferred-language") ||
        "",
      visibleMinority:
        normalizeYesNo(caseContext.visibleMinority) || normalizeYesNo(readAnswer("visible-minority")) || "",
      maritalStatus: caseContext.maritalStatus || readAnswer("marital-status") || "",
      spouseName: caseContext.spouseName || readAnswer("spouses-name") || "",
      dependentChildren: caseContext.dependentChildren || readAnswer("dependent-children") || "",
      agesOfChildren: caseContext.agesOfChildren || readAnswer("ages-of-children") || "",
      hasDisability:
        normalizeYesNo(caseContext.hasDisability) || normalizeYesNo(readAnswer("has-disability")) || "",
      disabilityDescription: caseContext.disabilityDescription || readAnswer("disability-description") || "",
      homeCommunity:
        caseContext.homeCommunity ||
        readAnswer("home-community") ||
        readAnswer("home-comminuty") ||
        personal.home_community ||
        personal.homeCommunity ||
        "",
      householdComposition: caseContext.householdComposition || readAnswer("household-composition") || "",
      socialAssistance: normalizeYesNo(caseContext.socialAssistance) || normalizeYesNo(readAnswer("social-assistance")) || "",
      topUpAmount: caseContext.topUpAmount || readAnswer("top-up-amount") || "",
      disabilitySupport:
        normalizeYesNo(caseContext.disabilitySupport) || normalizeYesNo(readAnswer("disability-support")) || "",
      disabilitySupportDetails: caseContext.disabilitySupportDetails || readAnswer("disability-support_yes_follow") || "",
      labourForceStatus: caseContext.employmentStatus || readAnswer("labour-force-status") || "",
      highestEducation:
        caseContext.educationLevel ||
        readAnswer("action-plan-result-education-level") ||
        readAnswer("highest-education") ||
        readAnswer("education-level") ||
        readAnswer("education-highest-level") ||
        "",
      educationYear: caseContext.educationYear || readAnswer("education-year") || "",
      educationLocation: caseContext.educationProvince || readAnswer("education-location") || "",
      targetProgram: caseContext.targetProgram || readAnswer("target-program") || "",
      employerName: caseContext.employerName || "",
      employmentNocVersion: caseContext.employmentNocVersion || "",
      employmentNoc: caseContext.employmentNoc || "",
      programEmployer: caseContext.programEmployer || "",
      programNocVersion: caseContext.programNocVersion || "",
      programNoc: caseContext.programNoc || "",
      programTrainingProvider: caseContext.programTrainingProvider || "",
      employmentGoals: caseContext.employmentGoals || readAnswer("employment-goals") || "",
      employmentBarriers:
        Array.isArray(caseContext.employmentBarriers)
          ? caseContext.employmentBarriers
          : Array.isArray(readAnswer("barriers"))
          ? readAnswer("barriers")
          : [],
      otherBarrier: readAnswer("other-barrier") || "",
      requestedSupports:
        Array.isArray(caseContext.requestedSupports)
          ? caseContext.requestedSupports
          : Array.isArray(readAnswer("requested-supports"))
          ? readAnswer("requested-supports")
          : [],
      childcareFunding:
        Array.isArray(caseContext.childcareFunding) && caseContext.childcareFunding.length
          ? caseContext.childcareFunding
          : Array.isArray(readAnswer("childcare-fuding-status"))
          ? readAnswer("childcare-fuding-status")
          : [],
      otherRequestedSupport: readAnswer("other-requested-support") || "",
      employmentGoalNarrative: caseContext.longTermGoal || readAnswer("long-term-goal") || "",
      shortTermGoal: caseContext.shortTermGoal || readAnswer("short-term-goal") || "",
      incomeOther: caseContext.incomeOther ?? readAnswer("income-other") ?? "",
      expensesTransport:
        Array.isArray(caseContext.expensesTransport) && caseContext.expensesTransport.length
          ? caseContext.expensesTransport
          : Array.isArray(readAnswer("expenses-transport"))
          ? readAnswer("expenses-transport")
          : Array.isArray(readAnswer("expenses_transport"))
          ? readAnswer("expenses_transport")
          : [],
      expensesOtherList: caseContext.expensesOtherList ?? readAnswer("expenses-other-list") ?? "",
      loanGrant: normalizeYesNo(caseContext.loanGrant) || normalizeYesNo(readAnswer("loan-grant")) || "",
      loanGrantDetails: caseContext.loanGrantDetails ?? readAnswer("loan-grant-details") ?? "",
      expensesTransportMileage:
        caseContext.expensesTransportMileage ?? readAnswer("expenses_transport_mileage") ?? "",
      incomeEmployment: caseContext.incomeEmployment ?? readAnswer("income-employment") ?? "",
      incomeSpousal: caseContext.incomeSpousal ?? readAnswer("income-spousal") ?? "",
      incomeSocialAssist: caseContext.incomeSocialAssist ?? readAnswer("income-social-assist") ?? "",
      incomeChildSupport: caseContext.incomeChildSupport ?? readAnswer("income-child-support") ?? "",
      incomeChildBenefit: caseContext.incomeChildBenefit ?? readAnswer("income-child-benefit") ?? "",
      incomeJordans: caseContext.incomeJordans ?? readAnswer("income-jordans") ?? "",
      incomeBandFunding: caseContext.incomeBandFunding ?? readAnswer("income-band-funding") ?? "",
      incomeAlimony: caseContext.incomeAlimony ?? readAnswer("income-alimony") ?? "",
      incomeOtherAmount: caseContext.incomeOtherAmount ?? readAnswer("income-other-description") ?? "",
      expensesRent: caseContext.expensesRent ?? readAnswer("expenses-rent") ?? "",
      expensesGroceries: caseContext.expensesGroceries ?? readAnswer("expenses-groceries") ?? "",
      expensesElectricity: caseContext.expensesElectricity ?? readAnswer("expenses-electricity") ?? "",
      expensesHeating: caseContext.expensesHeating ?? readAnswer("expenses-heating") ?? "",
      expensesWater: caseContext.expensesWater ?? readAnswer("expenses-water") ?? "",
      expensesSewerage: caseContext.expensesSewerage ?? readAnswer("expenses-sewerage") ?? "",
      expensesGarbage: caseContext.expensesGarbage ?? readAnswer("expenses-garbage") ?? "",
      expensesBusPass: caseContext.expensesBusPass ?? readAnswer("expenses_bus_pass") ?? "",
      expensesParking: caseContext.expensesParking ?? readAnswer("expenses-parking") ?? "",
      expensesOtherTotal: caseContext.expensesOtherTotal ?? readAnswer("expenses-other-total") ?? "",
    };
  }, [caseContext]);

  // Clear employment details if status no longer warrants them
  useEffect(() => {
    const status = form.labourForceStatus || "";
    const requiresEmployment =
      status === "employed-full-time" || status === "employed-part-time" || status === "self-employed";
    if (!requiresEmployment) {
      setForm(current => ({
        ...current,
        employerName: "",
        employmentNocVersion: "",
        employmentNoc: "",
      }));
    }
  }, [form.labourForceStatus]);

  const fetchNocSuggestions = useCallback(
    async query => {
      if (!query || query.length < 2) {
        setNocSuggestions([]);
        return;
      }
      try {
        setNocSuggestionsLoading(true);
        const results = await searchNocCodes({
          query,
          version: form.employmentNocVersion || undefined,
        });
        const options = Array.isArray(results)
          ? results
              .filter(item => item.code && item.title)
              .map(item => ({
                value: String(item.code),
                label: `${item.code} — ${item.title}`,
                description: item.title,
              }))
          : [];
        setNocSuggestions(options);
      } catch (err) {
        console.error("Failed to load NOC codes", err?.message || err);
        setNocSuggestions([]);
      } finally {
        setNocSuggestionsLoading(false);
      }
    },
    [form.employmentNocVersion, searchNocCodes]
  );

  const fetchProgramNocSuggestions = useCallback(
    async query => {
      if (!query || query.length < 2) {
        setProgramNocSuggestions([]);
        return;
      }
      try {
        setProgramNocSuggestionsLoading(true);
        const results = await searchNocCodes({
          query,
          version: form.programNocVersion || undefined,
        });
        const options = Array.isArray(results)
          ? results
              .filter(item => item.code && item.title)
              .map(item => ({
                value: String(item.code),
                label: `${item.code} — ${item.title}`,
                description: item.title,
              }))
          : [];
        setProgramNocSuggestions(options);
      } catch (err) {
        console.error("Failed to load NOC codes", err?.message || err);
        setProgramNocSuggestions([]);
      } finally {
        setProgramNocSuggestionsLoading(false);
      }
    },
    [form.programNocVersion, searchNocCodes]
  );

  useEffect(() => {
    if (!form.employmentNocVersion) {
      setNocSuggestions([]);
    }
  }, [form.employmentNocVersion]);

  useEffect(() => {
    if (!form.programNocVersion) {
      setProgramNocSuggestions([]);
    }
  }, [form.programNocVersion]);

  const selectedGender = useMemo(
    () => genderOptions.find(opt => opt.value === (form.gender || "")) || genderOptions[0],
    [form.gender]
  );
  const selectedProvince = useMemo(
    () => provinceOptions.find(opt => opt.value === (form.addressProvince || "")) || null,
    [form.addressProvince]
  );
  const selectedMailingProvince = useMemo(
    () => provinceOptions.find(opt => opt.value === (form.mailingProvince || "")) || null,
    [form.mailingProvince]
  );
  const selectedLanguageSpoken = useMemo(
    () => languageSpokenOptions.find(opt => opt.value === (form.languageSpoken || "")) || languageSpokenOptions[0],
    [form.languageSpoken]
  );
  // Back-compat guard for prior "preferred language" reference
  const selectedPreferredLanguage = selectedLanguageSpoken;
  const selectedVisibleMinority = useMemo(
    () => yesNoOptions.find(opt => opt.value === (form.visibleMinority || "")) || yesNoOptions[0],
    [form.visibleMinority]
  );
  const selectedSocialAssistance = useMemo(
    () => yesNoOptions.find(opt => opt.value === (form.socialAssistance || "")) || yesNoOptions[0],
    [form.socialAssistance]
  );
  const selectedDisabilitySupport = useMemo(
    () => yesNoOptions.find(opt => opt.value === (form.disabilitySupport || "")) || yesNoOptions[0],
    [form.disabilitySupport]
  );
  const selectedHasDisability = useMemo(
    () => yesNoOptions.find(opt => opt.value === (form.hasDisability || "")) || yesNoOptions[0],
    [form.hasDisability]
  );
  const selectedMaritalStatus = useMemo(
    () => maritalStatusOptions.find(opt => opt.value === (form.maritalStatus || "")) || maritalStatusOptions[0],
    [form.maritalStatus]
  );
  const selectedLabourForceStatus = useMemo(
    () => labourForceStatusOptions.find(opt => opt.value === (form.labourForceStatus || "")) || labourForceStatusOptions[0],
    [form.labourForceStatus]
  );
  const selectedHighestEducation = useMemo(
    () => highestEducationOptions.find(opt => opt.value === (form.highestEducation || "")) || highestEducationOptions[0],
    [form.highestEducation]
  );
  const selectedEducationLocation = useMemo(
    () =>
      educationLocationOptions.find(opt => opt.value === (form.educationLocation || "")) || educationLocationOptions[0],
    [form.educationLocation]
  );
  const selectedTargetProgram = useMemo(
    () => targetProgramOptions.find(opt => opt.value === (form.targetProgram || "")) || targetProgramOptions[0],
    [form.targetProgram]
  );
  const nocVersionOptions = NOC_VERSION_OPTIONS;
  const showEmploymentDetails = useMemo(() => {
    const status = form.labourForceStatus || "";
    return ["employed-full-time", "employed-part-time", "self-employed"].includes(status);
  }, [form.labourForceStatus]);
  const programRequiresEmployer = useMemo(
    () => ["tws", "jcp"].includes(form.targetProgram),
    [form.targetProgram]
  );
  const programRequiresTrainingProvider = useMemo(
    () => ["skills_development", "group"].includes(form.targetProgram),
    [form.targetProgram]
  );
  const readAnswer = useMemo(() => makeAnswerReader(answers), [answers]);

  const incomeEntries = useMemo(
    () => [
      { key: "income-employment", label: "Employment income" },
      { key: "income-spousal", label: "Spousal income" },
      { key: "income-social-assist", label: "Social assistance" },
      { key: "income-child-support", label: "Child support" },
      { key: "income-child-benefit", label: "Canada Child Benefit" },
      { key: "income-band-funding", label: "Band funding" },
      { key: "income-alimony", label: "Alimony / spousal support" },
      { key: "income-jordans", label: "Jordan's Principle" },
      { key: "income-other-description", label: "Other income (amount)" },
    ],
    []
  );

  const expenseEntries = useMemo(
    () => [
      { key: "expenses-rent", label: "Rent / Mortgage" },
      { key: "expenses-groceries", label: "Groceries" },
      { key: "expenses-electricity", label: "Electricity/Hydro" },
      { key: "expenses-heating", label: "Home Heating" },
      { key: "expenses-water", label: "Water" },
      { key: "expenses-sewerage", label: "Sewer / Wastewater" },
      { key: "expenses-garbage", label: "Waste Management" },
      { key: "expenses_bus_pass", label: "Bus pass" },
      { key: "expenses-parking", label: "Parking charges" },
      { key: "expenses-other-total", label: "Other expenses total" },
    ],
    []
  );

  const getAmountValue = useCallback(
    key => {
      const formKey = amountFieldMap[key];
      const formValue = formKey ? form[formKey] : "";
      if (formValue !== undefined && formValue !== null && formValue !== "") {
        return formValue;
      }
      const answerValue = readAnswer(key);
      if (answerValue !== undefined && answerValue !== null && answerValue !== "") {
        return answerValue;
      }
      return formValue ?? "";
    },
    [form, readAnswer]
  );

  const incomeTotals = useMemo(() => {
    let total = 0;
    const rows = incomeEntries.map(entry => {
      const raw = getAmountValue(entry.key);
      const num = raw !== "" && raw !== null ? Number(raw) || 0 : 0;
      total += num;
      return { ...entry, amount: num };
    });
    return { rows, total };
  }, [incomeEntries, getAmountValue]);

  const expenseTotals = useMemo(() => {
    let total = 0;
    const rows = expenseEntries.map(entry => {
      const raw = getAmountValue(entry.key);
      const num = raw !== "" && raw !== null ? Number(raw) || 0 : 0;
      total += num;
      return { ...entry, amount: num };
    });
    return { rows, total };
  }, [expenseEntries, getAmountValue]);

  const incomeTableItems = useMemo(
    () => [...incomeTotals.rows, { key: "total-income", label: "Total monthly income", amount: incomeTotals.total, isTotal: true }],
    [incomeTotals]
  );
  const expenseTableItems = useMemo(
    () => [...expenseTotals.rows, { key: "total-expense", label: "Total monthly expenses", amount: expenseTotals.total, isTotal: true }],
    [expenseTotals]
  );
  const loanGrantValue = useMemo(
    () => normalizeYesNo(form.loanGrant) || normalizeYesNo(readAnswer("loan-grant")) || "",
    [form.loanGrant, readAnswer]
  );
  const loanGrantDetailsValue = useMemo(
    () => form.loanGrantDetails ?? readAnswer("loan-grant-details") ?? "",
    [form.loanGrantDetails, readAnswer]
  );
  const mileageValue = useMemo(
    () => form.expensesTransportMileage ?? readAnswer("expenses_transport_mileage") ?? "",
    [form.expensesTransportMileage, readAnswer]
  );

  // Clear program employer/NOC if program no longer requires it
  useEffect(() => {
    if (!programRequiresEmployer) {
      setForm(current => ({
        ...current,
        programEmployer: "",
        programNocVersion: "",
        programNoc: "",
      }));
    }
  }, [programRequiresEmployer]);

  useEffect(() => {
    if (!programRequiresTrainingProvider) {
      setForm(current => ({
        ...current,
        programTrainingProvider: "",
      }));
    }
  }, [programRequiresTrainingProvider]);

  useEffect(() => {
    const supports = form.requestedSupports || [];
    if (!supports.includes("childcare")) {
      setForm(current => ({ ...current, childcareFunding: [] }));
    }
    if (!supports.includes("other")) {
      setForm(current => ({ ...current, otherRequestedSupport: "" }));
    }
  }, [form.requestedSupports]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const cleanedSin = cleanSin(form.sin || "");
    const normalizedVisibleMinority = normalizeYesNo(form.visibleMinority);
    const normalizedHasDisability = normalizeYesNo(form.hasDisability);
    const normalizedSocialAssistance = normalizeYesNo(form.socialAssistance);
    const normalizedDisabilitySupport = normalizeYesNo(form.disabilitySupport);
    const normalizedLoanGrant = normalizeYesNo(form.loanGrant);
    if (cleanedSin && cleanedSin.length !== 9) {
      setError("Social Insurance Number must be 9 digits.");
      return;
    }
    if (cleanedSin && !isValidSin(cleanedSin)) {
      setError("Social Insurance Number checksum is invalid.");
      return;
    }
    setSaving(true);
    try {
      const nextContext = {
        ...caseContext,
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        preferredName: form.preferredName || null,
        middleNames: form.middleNames || null,
        gender: form.gender || null,
        genderIdentity: form.genderIdentity || null,
        pronouns: form.pronouns || null,
        sex: form.sex || null,
        sin: cleanedSin || null,
        dateOfBirth: form.dateOfBirth || null,
        address: {
          line1: form.addressLine1 || null,
          line2: form.addressLine2 || null,
          city: form.addressCity || null,
          province: form.addressProvince || null,
          postalCode: form.postalCode || null,
        },
        mailingAddress: {
          line1: form.mailingLine1 || null,
          line2: form.mailingLine2 || null,
          city: form.mailingCity || null,
          province: form.mailingProvince || null,
          postalCode: form.mailingPostal || null,
        },
        emailPrimary: form.emailPrimary || null,
        phonePrimary: form.phonePrimary || null,
        phoneAlt: form.phoneAlt || null,
        indigenousIdentity: form.indigenousIdentity || null,
        indigenousAffiliation: form.indigenousAffiliation || null,
        registrationNumber: form.registrationNumber || null,
        languageSpoken: form.languageSpoken || null,
        preferredLanguage: form.languageSpoken || null,
        visibleMinority: normalizedVisibleMinority || null,
        maritalStatus: form.maritalStatus || null,
        spouseName: form.spouseName || null,
        dependentChildren: form.dependentChildren || null,
        agesOfChildren: form.agesOfChildren || null,
        hasDisability: normalizedHasDisability || null,
        disabilityDescription: form.disabilityDescription || null,
        homeCommunity: form.homeCommunity || null,
        householdComposition: form.householdComposition || null,
        socialAssistance: normalizedSocialAssistance || null,
        topUpAmount: form.topUpAmount || null,
        disabilitySupport: normalizedDisabilitySupport || null,
        disabilitySupportDetails: form.disabilitySupportDetails || null,
        employmentStatus: form.labourForceStatus || null,
        educationLevel: form.highestEducation || null,
        educationYear: form.educationYear || null,
        educationProvince: form.educationLocation || null,
        targetProgram: form.targetProgram || null,
        employerName: form.employerName || null,
        employmentNocVersion: form.employmentNocVersion || null,
        employmentNoc: form.employmentNoc || null,
        programEmployer: form.programEmployer || null,
        programNocVersion: form.programNocVersion || null,
        programNoc: form.programNoc || null,
        programTrainingProvider: form.programTrainingProvider || null,
        employmentGoals: form.employmentGoals || null,
        employmentBarriers: Array.isArray(form.employmentBarriers) ? form.employmentBarriers : [],
        requestedSupports: Array.isArray(form.requestedSupports) ? form.requestedSupports : [],
        childcareFunding:
          Array.isArray(form.childcareFunding) && form.childcareFunding.length ? form.childcareFunding : null,
        otherBarrier: form.otherBarrier || null,
        otherRequestedSupport: form.otherRequestedSupport || null,
        longTermGoal: form.employmentGoalNarrative || null,
        shortTermGoal: form.shortTermGoal || null,
        incomeOther: form.incomeOther || null,
        expensesTransport:
          Array.isArray(form.expensesTransport) && form.expensesTransport.length ? form.expensesTransport : null,
        expensesOtherList: form.expensesOtherList || null,
        loanGrant: normalizedLoanGrant || null,
        loanGrantDetails: form.loanGrantDetails || null,
        expensesTransportMileage: form.expensesTransportMileage || null,
        incomeEmployment: form.incomeEmployment || null,
        incomeSpousal: form.incomeSpousal || null,
        incomeSocialAssist: form.incomeSocialAssist || null,
        incomeChildSupport: form.incomeChildSupport || null,
        incomeChildBenefit: form.incomeChildBenefit || null,
        incomeJordans: form.incomeJordans || null,
        incomeBandFunding: form.incomeBandFunding || null,
        incomeAlimony: form.incomeAlimony || null,
        incomeOtherAmount: form.incomeOtherAmount || null,
        expensesRent: form.expensesRent || null,
        expensesGroceries: form.expensesGroceries || null,
        expensesElectricity: form.expensesElectricity || null,
        expensesHeating: form.expensesHeating || null,
        expensesWater: form.expensesWater || null,
        expensesSewerage: form.expensesSewerage || null,
        expensesGarbage: form.expensesGarbage || null,
        expensesBusPass: form.expensesBusPass || null,
        expensesParking: form.expensesParking || null,
        expensesOtherTotal: form.expensesOtherTotal || null,
        applicationPersonal: {
          ...(caseContext.applicationPersonal || {}),
          first_name: form.firstName || null,
          last_name: form.lastName || null,
          preferred_name: form.preferredName || null,
          middle_names: form.middleNames || null,
          gender: form.gender || null,
          gender_identity: form.genderIdentity || null,
          pronouns: form.pronouns || null,
          sex: form.sex || null,
          sin: cleanedSin || null,
          date_of_birth: form.dateOfBirth || null,
          email: form.emailPrimary || null,
          phone: form.phonePrimary || null,
          phone_alt: form.phoneAlt || null,
          home_community: form.homeCommunity || null,
          address: {
            line1: form.addressLine1 || null,
            line2: form.addressLine2 || null,
            city: form.addressCity || null,
            province: form.addressProvince || null,
            postalCode: form.postalCode || null,
          },
          mailing_address: {
            line1: form.mailingLine1 || null,
            line2: form.mailingLine2 || null,
            city: form.mailingCity || null,
            province: form.mailingProvince || null,
            postalCode: form.mailingPostal || null,
          },
        },
        applicationAnswers: {
          ...(caseContext.applicationAnswers || {}),
          "first-name": form.firstName || null,
          "last-name": form.lastName || null,
          "preferred-name": form.preferredName || null,
          "middle-names": form.middleNames || null,
          "gender": form.gender || null,
          "gender_identity": form.genderIdentity || null,
          "pronouns": form.pronouns || null,
          "sex": form.sex || null,
          "dob": form.dateOfBirth || null,
          "social-insurance-number": cleanedSin || null,
          "address-street-address": form.addressLine1 || null,
          "address-mailing-address": form.addressLine2 || null,
          "address-city": form.addressCity || null,
          "address-province": form.addressProvince || null,
          "address-postcode": form.postalCode || null,
          "mailing-address-street": form.mailingLine1 || null,
          "mailing-address-line2": form.mailingLine2 || null,
          "mailing-address-city": form.mailingCity || null,
          "mailing-address-province": form.mailingProvince || null,
          "mailing-address-postcode": form.mailingPostal || null,
          "contact-email-address": form.emailPrimary || null,
          "telephone-day": form.phonePrimary || null,
          "telephone-alt": form.phoneAlt || null,
          "emergency-contact-name": form.emergencyName || null,
          "emergency-contact-telephone": form.emergencyPhone || null,
          "emergency-contact-relationship": form.emergencyRelationship || null,
          "legal-indigenous-identity": form.indigenousIdentity || null,
          "indigenous-affiliation-declaration": form.indigenousAffiliation || null,
          "registration-number": form.registrationNumber || null,
          [getRegistrationTargetKey(caseContext.applicationAnswers || caseContext.applicationPayload?.answers || {})]:
            form.registrationNumber || null,
          "language-spoken": form.languageSpoken || null,
          "preferred-language": form.languageSpoken || null,
          "visible-minority": normalizedVisibleMinority || null,
          "marital-status": form.maritalStatus || null,
          "spouses-name": form.spouseName || null,
          "dependent-children": form.dependentChildren || null,
          "ages-of-children": form.agesOfChildren || null,
          "has-disability": normalizedHasDisability || null,
          "disability-description": form.disabilityDescription || null,
          "home-community": form.homeCommunity || null,
          "home-comminuty": form.homeCommunity || null,
          "household-composition": form.householdComposition || null,
          "social-assistance": normalizedSocialAssistance || null,
          "top-up-amount": form.topUpAmount || null,
          "disability-support": normalizedDisabilitySupport || null,
          "disability-support_yes_follow": form.disabilitySupportDetails || null,
          "labour-force-status": form.labourForceStatus || null,
          "highest-education": form.highestEducation || null,
          "education-year": form.educationYear || null,
          "education-location": form.educationLocation || null,
          "target-program": form.targetProgram || null,
          "program-employer": form.programEmployer || null,
          "program-noc-version": form.programNocVersion || null,
          "program-noc": form.programNoc || null,
          "program-training-provider": form.programTrainingProvider || null,
          "employment-goals": form.employmentGoals || null,
          "barriers": Array.isArray(form.employmentBarriers) ? form.employmentBarriers : null,
          "other-barrier": form.otherBarrier || null,
          "requested-supports": Array.isArray(form.requestedSupports) ? form.requestedSupports : null,
          "childcare-fuding-status":
            Array.isArray(form.childcareFunding) && form.childcareFunding.length ? form.childcareFunding : null,
          "other-requested-support": form.otherRequestedSupport || null,
          "long-term-goal": form.employmentGoalNarrative || null,
          "short-term-goal": form.shortTermGoal || null,
          "income-other": form.incomeOther || null,
          "expenses-other-list": form.expensesOtherList || null,
          "expenses-transport": Array.isArray(form.expensesTransport) ? form.expensesTransport : null,
          "expenses_transport_mileage": form.expensesTransportMileage || null,
          "loan-grant": normalizedLoanGrant || null,
          "loan-grant-details": form.loanGrantDetails || null,
          "income-employment": form.incomeEmployment || null,
          "income-spousal": form.incomeSpousal || null,
          "income-social-assist": form.incomeSocialAssist || null,
          "income-child-support": form.incomeChildSupport || null,
          "income-child-benefit": form.incomeChildBenefit || null,
          "income-jordans": form.incomeJordans || null,
          "income-band-funding": form.incomeBandFunding || null,
          "income-alimony": form.incomeAlimony || null,
          "income-other-description": form.incomeOtherAmount || null,
          "expenses-rent": form.expensesRent || null,
          "expenses-groceries": form.expensesGroceries || null,
          "expenses-electricity": form.expensesElectricity || null,
          "expenses-heating": form.expensesHeating || null,
          "expenses-water": form.expensesWater || null,
          "expenses-sewerage": form.expensesSewerage || null,
          "expenses-garbage": form.expensesGarbage || null,
          "expenses_bus_pass": form.expensesBusPass || null,
          "expenses-parking": form.expensesParking || null,
          "expenses-other-total": form.expensesOtherTotal || null,
        },
      };
      await saveCaseContext(nextContext);
      setSuccess("Participant details saved.");
      setEditing(false);
    } catch (err) {
      setError(err?.message || "Failed to save participant details.");
    } finally {
      setSaving(false);
    }
  };

  // Ensure alerts are visible after save attempts.
  useEffect(() => {
    const scrollTarget = error ? errorAlertRef.current : success ? successAlertRef.current : null;
    if (scrollTarget && typeof scrollTarget.scrollIntoView === "function") {
      scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error, success]);

  const handleCancel = () => {
    if (initialFormRef.current) {
      setForm({ ...initialFormRef.current });
    }
    setEditing(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="These details are a snapshot for this case. Update them here when the participant’s situation changes so the case stays accurate."
          actions={
            editing ? (
              <SpaceBetween size="xs" direction="horizontal">
                <Button onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} loading={saving}>
                  Save
                </Button>
              </SpaceBetween>
            ) : (
              <Button onClick={() => setEditing(true)}>Edit</Button>
            )
          }
        >
          <Hotspot hotspotId="case-workspace-participant-details" direction="right" />
          {metadata.title ?? "Participant details"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Participant details settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {error && (
          <div ref={errorAlertRef}>
            <Alert
              type="error"
              dismissible
              onDismiss={() => setError(null)}
            >
              {error}
            </Alert>
          </div>
        )}
        {success && (
          <div ref={successAlertRef}>
            <Alert
              type="success"
              dismissible
              onDismiss={() => setSuccess(null)}
            >
              {success}
            </Alert>
          </div>
        )}
        <SpaceBetween size="l">
          <ExpandableSection
            headerText="Participant identity"
            headerDescription="Case-specific participant details. Keep this snapshot current for this case."
            defaultExpanded
          >
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="First name" description="As shown on ID documents">
                <Input
                  value={form.firstName}
                  onChange={({ detail }) => setForm(current => ({ ...current, firstName: detail.value }))}
                  readOnly={!editing}
                  placeholder="First name"
                />
              </FormField>
              <FormField label="Middle name(s)" description="As shown on ID documents">
                <Input
                  value={form.middleNames}
                  onChange={({ detail }) => setForm(current => ({ ...current, middleNames: detail.value }))}
                  readOnly={!editing}
                  placeholder="Middle names"
                />
              </FormField>
              <FormField label="Last name" description="As shown on ID documents">
                <Input
                  value={form.lastName}
                  onChange={({ detail }) => setForm(current => ({ ...current, lastName: detail.value }))}
                  readOnly={!editing}
                  placeholder="Last name"
                />
              </FormField>
              <FormField label="Preferred name" description="Name the client prefers to be called.">
                <Input
                  value={form.preferredName}
                  onChange={({ detail }) => setForm(current => ({ ...current, preferredName: detail.value }))}
                  readOnly={!editing}
                  placeholder="Preferred name"
                />
              </FormField>
              <FormField label="Date of Birth" description="YYYY-MM-DD">
                {editing ? (
                  <DatePicker
                    value={form.dateOfBirth || ""}
                    onChange={({ detail }) => setForm(current => ({ ...current, dateOfBirth: detail.value }))}
                    placeholder="YYYY-MM-DD"
                  />
                ) : (
                  <Input value={form.dateOfBirth || "Not set"} readOnly />
                )}
              </FormField>
              <FormField label="Social Insurance Number" description="9 digits. Stored with the case.">
                <Input
                  value={
                    form.sin
                      ? form.sin.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3}).*/, '$1 $2 $3').trim()
                      : ""
                  }
                  onChange={({ detail }) => setForm(current => ({ ...current, sin: detail.value }))}
                  readOnly={!editing}
                  inputMode="numeric"
                  placeholder="Optional"
                />
              </FormField>
              <FormField label="Pronouns" description="If provided by the participant.">
                <Input
                  value={form.pronouns}
                  onChange={({ detail }) => setForm(current => ({ ...current, pronouns: detail.value }))}
                  readOnly={!editing}
                  placeholder="e.g., she/her, they/them"
                />
              </FormField>
              <FormField label="Gender identity" description="The gender identified with.">
                {editing ? (
                  <Select
                    options={genderIdentityOptions}
                    selectedOption={genderIdentityOptions.find(option => option.value === form.genderIdentity) || genderIdentityOptions[0]}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, genderIdentity: detail.selectedOption?.value || "" }))
                    }
                    placeholder="Select gender identity"
                  />
                ) : (
                  <Input
                    value={
                      (genderIdentityOptions.find(option => option.value === form.genderIdentity) || genderIdentityOptions[0])
                        .label
                    }
                    readOnly
                  />
                )}
              </FormField>
              <FormField label="Biological Sex" description="As recorded on the birth certificate">
                {editing ? (
                  <Select
                    options={genderOptions}
                    selectedOption={selectedGender}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, gender: detail.selectedOption?.value || "" }))
                    }
                    placeholder="Select gender"
                  />
                ) : (
                  <Input value={selectedGender?.label || "Not set"} readOnly />
                )}
              </FormField>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection
            headerText="Indigenous identity"
            headerDescription="Legal Indigenous identity, community affiliation, home community, and registration details."
            defaultExpanded={false}
          >
            <ColumnLayout columns={3} variant="text-grid">
              <FormField
                label="Legal Indigenous identity"
                description="Status/registration category as documented (e.g., First Nations status, Inuit, Métis)."
              >
                {editing ? (
                  <Select
                    options={legalIndigenousIdentityOptions}
                    selectedOption={
                      legalIndigenousIdentityOptions.find(option => option.value === form.indigenousIdentity) ||
                      legalIndigenousIdentityOptions[0]
                    }
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, indigenousIdentity: detail.selectedOption?.value || "" }))
                    }
                    placeholder="Select identity"
                  />
                ) : (
                  <Input
                    value={
                      (legalIndigenousIdentityOptions.find(option => option.value === form.indigenousIdentity) ||
                        legalIndigenousIdentityOptions[0]).label
                    }
                    readOnly
                  />
                )}
              </FormField>
              <FormField
                label="Nation / community affiliation"
                description="Recorded affiliation or treaty area name from intake."
              >
                <Input
                  value={form.indigenousAffiliation}
                  onChange={({ detail }) => setForm(current => ({ ...current, indigenousAffiliation: detail.value }))}
                  readOnly={!editing}
                  placeholder="Affiliation"
                />
              </FormField>
              <FormField
                label="Home community"
                description="Community search with band name/number where applicable. Type at least 2 characters to search."
              >
                {editing ? (
                  <Autosuggest
                    value={form.homeCommunity || ""}
                    options={bandSearchOptions.home || []}
                    loadingText="Searching communities..."
                    statusType={bandSearchLoading.home ? "loading" : "finished"}
                    expandToViewport
                    empty={bandSearchLoading.home ? "Searching communities..." : "No matches"}
                    placeholder="Search communities"
                    onChange={({ detail }) => {
                      const next = detail.value || "";
                      setForm(current => ({ ...current, homeCommunity: next }));
                      if ((next || "").trim().length >= 2) {
                        searchIndigenousBands(next, "home");
                      } else {
                        setBandSearchOptions(prev => ({ ...prev, home: [] }));
                      }
                    }}
                    onSelect={({ detail }) => {
                      setForm(current => ({ ...current, homeCommunity: detail.value || "" }));
                    }}
                  />
                ) : (
                  <Input value={form.homeCommunity || "Not set"} readOnly />
                )}
              </FormField>
              <FormField
                label="Registration number"
                description="Status/treaty registration number, if provided."
              >
                <Input
                  value={form.registrationNumber}
                  onChange={({ detail }) => setForm(current => ({ ...current, registrationNumber: detail.value }))}
                  readOnly={!editing}
                  placeholder="Registration #"
                />
              </FormField>
              <FormField
                label="Visible minority"
                description="Yes/No as captured at intake."
              >
                {editing ? (
                  <Select
                    options={yesNoOptions}
                    selectedOption={selectedVisibleMinority}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, visibleMinority: detail.selectedOption?.value || "" }))
                    }
                  />
                ) : (
                  <Input value={selectedVisibleMinority?.label || "Not set"} readOnly />
                )}
              </FormField>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection
            headerText="Contact details"
            headerDescription="Primary and alternate contact methods provided by the participant."
        >
            <Tabs
              tabs={[
                {
                  id: "main-contact",
                  label: "Main details",
                  content: (
                    <ColumnLayout columns={3} variant="text-grid">
                      <FormField label="Email">
                        {editing ? (
                          <Input
                            value={form.emailPrimary}
                            onChange={({ detail }) => setForm(current => ({ ...current, emailPrimary: detail.value }))}
                            readOnly={!editing}
                            placeholder=""
                          />
                        ) : (
                          <CopyToClipboard
                            copyButtonAriaLabel="Copy email"
                            copyErrorText="Email failed to copy"
                            copySuccessText="Email copied"
                            textToCopy={form.emailPrimary || ""}
                            content={form.emailPrimary || "Not set"}
                            variant="inline"
                          />
                        )}
                      </FormField>
                      <FormField label="Phone">
                        <Input
                          value={form.phonePrimary}
                          onChange={({ detail }) => setForm(current => ({ ...current, phonePrimary: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Alternate phone">
                        <Input
                          value={form.phoneAlt}
                          onChange={({ detail }) => setForm(current => ({ ...current, phoneAlt: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Street address">
                        <Input
                          value={form.addressLine1}
                          onChange={({ detail }) => setForm(current => ({ ...current, addressLine1: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Address line 2">
                        <Input
                          value={form.addressLine2}
                          onChange={({ detail }) => setForm(current => ({ ...current, addressLine2: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="City">
                        <Input
                          value={form.addressCity}
                          onChange={({ detail }) => setForm(current => ({ ...current, addressCity: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Province / Region">
                        {editing ? (
                          <Select
                            options={provinceOptions}
                            selectedOption={selectedProvince}
                            onChange={({ detail }) =>
                              setForm(current => ({ ...current, addressProvince: detail.selectedOption?.value || "" }))
                            }
                            placeholder=""
                          />
                        ) : (
                          <Input value={selectedProvince?.label || form.addressProvince || "Not set"} readOnly />
                        )}
                      </FormField>
                      <FormField label="Postal code">
                        <Input
                          value={form.postalCode}
                          onChange={({ detail }) => setForm(current => ({ ...current, postalCode: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                    </ColumnLayout>
                  ),
                },
                {
                  id: "alt-contact",
                  label: "Alternative details",
                  content: (
                    <ColumnLayout columns={3} variant="text-grid">
                      <FormField label="Email">
                        {editing ? (
                          <Input
                            value={form.emailPrimary}
                            onChange={({ detail }) => setForm(current => ({ ...current, emailPrimary: detail.value }))}
                            readOnly={!editing}
                            placeholder=""
                          />
                        ) : (
                          <CopyToClipboard
                            copyButtonAriaLabel="Copy email"
                            copyErrorText="Email failed to copy"
                            copySuccessText="Email copied"
                            textToCopy={form.emailPrimary || ""}
                            content={form.emailPrimary || "Not set"}
                            variant="inline"
                          />
                        )}
                      </FormField>
                      <FormField label="Phone">
                        <Input
                          value={form.phoneAlt || form.phonePrimary}
                          onChange={({ detail }) => setForm(current => ({ ...current, phoneAlt: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Mailing street">
                        <Input
                          value={form.mailingLine1}
                          onChange={({ detail }) => setForm(current => ({ ...current, mailingLine1: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Mailing address line 2">
                        <Input
                          value={form.mailingLine2}
                          onChange={({ detail }) => setForm(current => ({ ...current, mailingLine2: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Mailing city">
                        <Input
                          value={form.mailingCity}
                          onChange={({ detail }) => setForm(current => ({ ...current, mailingCity: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Mailing province / region">
                        {editing ? (
                          <Select
                            options={provinceOptions}
                            selectedOption={selectedMailingProvince}
                            onChange={({ detail }) =>
                              setForm(current => ({ ...current, mailingProvince: detail.selectedOption?.value || "" }))
                            }
                            placeholder=""
                          />
                        ) : (
                          <Input value={form.mailingProvince || "Not set"} readOnly />
                        )}
                      </FormField>
                      <FormField label="Mailing postal code">
                        <Input
                          value={form.mailingPostal}
                          onChange={({ detail }) => setForm(current => ({ ...current, mailingPostal: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                    </ColumnLayout>
                  ),
                },
                {
                  id: "emergency-contact",
                  label: "Emergency contact",
                  content: (
                    <ColumnLayout columns={3} variant="text-grid">
                      <FormField label="Contact name">
                        <Input
                          value={form.emergencyName}
                          onChange={({ detail }) => setForm(current => ({ ...current, emergencyName: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Relationship">
                        <Input
                          value={form.emergencyRelationship}
                          onChange={({ detail }) => setForm(current => ({ ...current, emergencyRelationship: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                      <FormField label="Phone">
                        <Input
                          value={form.emergencyPhone}
                          onChange={({ detail }) => setForm(current => ({ ...current, emergencyPhone: detail.value }))}
                          readOnly={!editing}
                          placeholder=""
                        />
                      </FormField>
                    </ColumnLayout>
                  ),
                },
              ]}
            />
          </ExpandableSection>

          <ExpandableSection
            headerText="Demographics & household"
            headerDescription="Demographic and household snapshot from the application; keep current for this case."
            defaultExpanded={false}
          >
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Language spoken" description="Aligns to ESDC ILMP languageSpoken codes.">
                {editing ? (
                  <Select
                    options={languageSpokenOptions}
                    selectedOption={selectedLanguageSpoken}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, languageSpoken: detail.selectedOption?.value || "" }))
                    }
                  />
                ) : (
                  <Input value={selectedLanguageSpoken?.label || "Not set"} readOnly />
                )}
              </FormField>
              <FormField label="Visible minority">
                {editing ? (
                  <Select
                    options={yesNoOptions}
                    selectedOption={selectedVisibleMinority}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, visibleMinority: detail.selectedOption?.value || "" }))
                    }
                  />
                ) : (
                  <Input value={selectedVisibleMinority?.label || "Not set"} readOnly />
                )}
              </FormField>
              <FormField label="Marital status">
                {editing ? (
                  <Select
                    options={maritalStatusOptions}
                    selectedOption={selectedMaritalStatus}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, maritalStatus: detail.selectedOption?.value || "" }))
                    }
                  />
                ) : (
                  <Input value={selectedMaritalStatus?.label || "Not set"} readOnly />
                )}
              </FormField>
              <FormField label="Spouse / partner name">
                <Input
                  value={form.spouseName}
                  onChange={({ detail }) => setForm(current => ({ ...current, spouseName: detail.value }))}
                  readOnly={!editing}
                  placeholder=""
                />
              </FormField>
              <FormField label="Dependent children">
                <Input
                  value={form.dependentChildren}
                  onChange={({ detail }) => setForm(current => ({ ...current, dependentChildren: detail.value }))}
                  readOnly={!editing}
                  inputMode="numeric"
                  placeholder="Count"
                />
              </FormField>
              <FormField label="Ages of children">
                <Input
                  value={form.agesOfChildren}
                  onChange={({ detail }) => setForm(current => ({ ...current, agesOfChildren: detail.value }))}
                  readOnly={!editing}
                  placeholder="Comma separated"
                />
              </FormField>
              <FormField label="Household composition">
                <Textarea
                  value={form.householdComposition}
                  onChange={({ detail }) => setForm(current => ({ ...current, householdComposition: detail.value }))}
                  readOnly={!editing}
                  rows={2}
                  placeholder="Household members and relationships"
                />
              </FormField>
              <FormField label="Receiving social assistance">
                {editing ? (
                  <Select
                    options={yesNoOptions}
                    selectedOption={selectedSocialAssistance}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, socialAssistance: detail.selectedOption?.value || "" }))
                    }
                  />
                ) : (
                  <Input value={selectedSocialAssistance?.label || "Not set"} readOnly />
                )}
              </FormField>
              <FormField label="Top-up amount">
                <Input
                  value={form.topUpAmount}
                  onChange={({ detail }) => setForm(current => ({ ...current, topUpAmount: detail.value }))}
                  readOnly={!editing}
                  inputMode="decimal"
                  placeholder="e.g., 100.00"
                />
              </FormField>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection
            headerText="Education & employment"
            headerDescription="Current labour force status and academic history from the application."
            defaultExpanded={false}
          >
            <Tabs
              tabs={[
                {
                  id: "employment-status",
                  label: "Employment status",
                  content: (
                    <ColumnLayout columns={3} variant="text-grid">
                      <FormField label="Labour force status">
                        {editing ? (
                          <Select
                            options={labourForceStatusOptions}
                            selectedOption={selectedLabourForceStatus}
                            onChange={({ detail }) =>
                              setForm(current => ({ ...current, labourForceStatus: detail.selectedOption?.value || "" }))
                            }
                          />
                        ) : (
                          <Input value={selectedLabourForceStatus?.label || "Not set"} readOnly />
                        )}
                      </FormField>
                      {showEmploymentDetails ? (
                        <>
                          <FormField label="Current employer">
                            <Input
                              value={form.employerName}
                              onChange={({ detail }) =>
                                setForm(current => ({ ...current, employerName: detail.value }))
                              }
                              readOnly={!editing}
                              placeholder="Employer name"
                            />
                          </FormField>
                          <FormField label="NOC Version">
                            {editing ? (
                              <Select
                                options={nocVersionOptions}
                                selectedOption={
                                  nocVersionOptions.find(opt => opt.value === (form.employmentNocVersion || "")) || null
                                }
                                onChange={({ detail }) =>
                                  setForm(current => ({
                                    ...current,
                                    employmentNocVersion: detail.selectedOption?.value || "",
                                    employmentNoc: "",
                                  }))
                                }
                                placeholder="Select NOC version"
                                statusType="finished"
                                filteringType="none"
                              />
                            ) : (
                              <Input value={form.employmentNocVersion || "Not set"} readOnly />
                            )}
                          </FormField>
                          <FormField label="NOC code">
                            {editing ? (
                              <Autosuggest
                                value={form.employmentNoc || ""}
                                onChange={({ detail }) => {
                                  const inputValue = detail.value || "";
                                  setForm(current => ({ ...current, employmentNoc: inputValue }));
                                  if (inputValue.length >= 2) {
                                    fetchNocSuggestions(inputValue);
                                  } else {
                                    setNocSuggestions([]);
                                  }
                                }}
                                onSelect={({ detail }) =>
                                  setForm(current => ({ ...current, employmentNoc: detail.value || "" }))
                                }
                                onLoadItems={({ detail }) => {
                                  if (detail.filteringText) {
                                    fetchNocSuggestions(detail.filteringText);
                                  }
                                }}
                                options={nocSuggestions}
                                statusType={nocSuggestionsLoading ? "loading" : "finished"}
                                expandToViewport
                                placeholder={
                                  form.employmentNocVersion
                                    ? "Type to search NOC code"
                                    : "Select a NOC version first"
                                }
                                empty={form.employmentNocVersion ? "No NOC codes found." : "Select a NOC version first."}
                                disabled={!form.employmentNocVersion}
                                enteredTextLabel={value => `Use \"${value}\"`}
                                filteringType="manual"
                                loadingText="Searching NOC codes"
                              />
                            ) : (
                              <Input value={form.employmentNoc || "Not set"} readOnly />
                            )}
                          </FormField>
                        </>
                      ) : (
                        <Box color="text-body-secondary" variant="p">
                          Employment details are not required for this status.
                        </Box>
                      )}
                    </ColumnLayout>
                  ),
                },
                {
                  id: "education-history",
                  label: "Education history",
                  content: (
                    <ColumnLayout columns={3} variant="text-grid">
                      <FormField label="Highest education completed">
                        {editing ? (
                          <Select
                            options={highestEducationOptions}
                            selectedOption={selectedHighestEducation}
                            onChange={({ detail }) =>
                              setForm(current => ({ ...current, highestEducation: detail.selectedOption?.value || "" }))
                            }
                          />
                        ) : (
                          <Input value={selectedHighestEducation?.label || "Not set"} readOnly />
                        )}
                      </FormField>
                      <FormField label="Year completed">
                        <Input
                          value={form.educationYear}
                          onChange={({ detail }) => setForm(current => ({ ...current, educationYear: detail.value }))}
                          readOnly={!editing}
                          placeholder="YYYY or range"
                        />
                      </FormField>
                      <FormField label="Where completed">
                        {editing ? (
                          <Select
                            options={educationLocationOptions}
                            selectedOption={selectedEducationLocation}
                            onChange={({ detail }) =>
                              setForm(current => ({ ...current, educationLocation: detail.selectedOption?.value || "" }))
                            }
                          />
                        ) : (
                          <Input value={selectedEducationLocation?.label || "Not set"} readOnly />
                        )}
                      </FormField>
                    </ColumnLayout>
                  ),
                },
                {
                  id: "program-alignment",
                  label: "Program alignment",
                  content: (
                    <ColumnLayout columns={3} variant="text-grid">
                      <FormField label="Identified program">
                        {editing ? (
                          <Select
                            options={targetProgramOptions}
                            selectedOption={selectedTargetProgram}
                            onChange={({ detail }) =>
                              setForm(current => ({ ...current, targetProgram: detail.selectedOption?.value || "" }))
                            }
                          />
                        ) : (
                          <Input value={selectedTargetProgram?.label || "Not set"} readOnly />
                        )}
                      </FormField>
                      {programRequiresTrainingProvider && (
                        <FormField label="Training / Education Provider">
                          <Input
                            value={form.programTrainingProvider}
                            onChange={({ detail }) =>
                              setForm(current => ({ ...current, programTrainingProvider: detail.value }))
                            }
                            readOnly={!editing}
                            placeholder="Provider name"
                          />
                        </FormField>
                      )}
                      {programRequiresEmployer && (
                        <>
                          <FormField label="Employer">
                            <Input
                              value={form.programEmployer}
                      onChange={({ detail }) => setForm(current => ({ ...current, programEmployer: detail.value }))}
                      readOnly={!editing}
                      placeholder="Employer name"
                    />
                  </FormField>
                  <FormField label="NOC Version">
                    {editing ? (
                      <Select
                        options={nocVersionOptions}
                        selectedOption={
                          nocVersionOptions.find(opt => opt.value === (form.programNocVersion || "")) || null
                        }
                        onChange={({ detail }) =>
                          setForm(current => ({
                            ...current,
                            programNocVersion: detail.selectedOption?.value || "",
                            programNoc: "",
                          }))
                        }
                        placeholder="Select NOC version"
                        statusType="finished"
                        filteringType="none"
                              />
                            ) : (
                              <Input value={form.employmentNocVersion || "Not set"} readOnly />
                            )}
                          </FormField>
                          <FormField label="NOC code">
                            {editing ? (
                      <Autosuggest
                        value={form.programNoc || ""}
                        onChange={({ detail }) => {
                          const inputValue = detail.value || "";
                          setForm(current => ({ ...current, programNoc: inputValue }));
                          if (inputValue.length >= 2) {
                            fetchProgramNocSuggestions(inputValue);
                          } else {
                            setProgramNocSuggestions([]);
                          }
                        }}
                        onSelect={({ detail }) =>
                          setForm(current => ({ ...current, programNoc: detail.value || "" }))
                        }
                        onLoadItems={({ detail }) => {
                          if (detail.filteringText) {
                            fetchProgramNocSuggestions(detail.filteringText);
                          }
                        }}
                        options={programNocSuggestions}
                        statusType={programNocSuggestionsLoading ? "loading" : "finished"}
                        expandToViewport
                        placeholder={
                          form.programNocVersion ? "Type to search NOC code" : "Select a NOC version first"
                        }
                        empty={form.programNocVersion ? "No NOC codes found." : "Select a NOC version first."}
                        disabled={!form.programNocVersion}
                        enteredTextLabel={value => `Use \"${value}\"`}
                        filteringType="manual"
                        loadingText="Searching NOC codes"
                      />
                    ) : (
                      <Input value={form.programNoc || "Not set"} readOnly />
                    )}
                  </FormField>
                </>
              )}
                    </ColumnLayout>
                  ),
                },
              ]}
            />
          </ExpandableSection>

          <ExpandableSection
            headerText="Disability"
            headerDescription="Self-reported disability details."
            defaultExpanded={false}
          >
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Has disability">
                {editing ? (
                  <Select
                    options={yesNoOptions}
                    selectedOption={selectedHasDisability}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, hasDisability: detail.selectedOption?.value || "" }))
                    }
                  />
                ) : (
                  <Input value={selectedHasDisability?.label || "Not set"} readOnly />
                )}
              </FormField>
              <FormField label="Disability description">
                <Textarea
                  value={form.disabilityDescription}
                  onChange={({ detail }) => setForm(current => ({ ...current, disabilityDescription: detail.value }))}
                  readOnly={!editing}
                  rows={3}
                  placeholder="Description"
                />
              </FormField>
              <FormField label="Requesting disability support">
                {editing ? (
                  <Select
                    options={yesNoOptions}
                    selectedOption={selectedDisabilitySupport}
                    onChange={({ detail }) =>
                      setForm(current => ({ ...current, disabilitySupport: detail.selectedOption?.value || "" }))
                    }
                  />
                ) : (
                  <Input value={selectedDisabilitySupport?.label || "Not set"} readOnly />
                )}
              </FormField>
              <FormField label="Disability support request">
                <Textarea
                  value={form.disabilitySupportDetails}
                  onChange={({ detail }) => setForm(current => ({ ...current, disabilitySupportDetails: detail.value }))}
                  readOnly={!editing}
                  rows={3}
                  placeholder="Details of support requested"
                />
              </FormField>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection
            headerText="Employment goals & barriers"
            headerDescription="Self-identified goals and obstacles."
            defaultExpanded={false}
          >
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Employment goals">
                <Textarea
                  value={form.employmentGoals}
                  onChange={({ detail }) => setForm(current => ({ ...current, employmentGoals: detail.value }))}
                  readOnly={!editing}
                  rows={3}
                  placeholder="Describe goals"
                />
              </FormField>
              <FormField label="Barriers">
                {editing ? (
                  <Multiselect
                    options={barrierOptions}
                    selectedOptions={barrierOptions.filter(opt => (form.employmentBarriers || []).includes(opt.value))}
                    onChange={({ detail }) =>
                      setForm(current => ({
                        ...current,
                        employmentBarriers: detail.selectedOptions.map(opt => opt.value),
                      }))
                    }
                    placeholder="Select barriers"
                  />
                ) : (form.employmentBarriers || []).length ? (
                  <SpaceBetween direction="horizontal" size="xs">
                    {(form.employmentBarriers || []).map(val => {
                      const label = barrierOptions.find(opt => opt.value === val)?.label || val;
                      return (
                        <Badge key={val} color="blue">
                          {label}
                        </Badge>
                      );
                    })}
                  </SpaceBetween>
                ) : (
                  <Box color="text-body-secondary">Not provided</Box>
                )}
              </FormField>
              <FormField label="Other barrier">
                {editing ? (
                  <Textarea
                    value={form.otherBarrier}
                    onChange={({ detail }) => setForm(current => ({ ...current, otherBarrier: detail.value }))}
                    readOnly={!editing}
                    rows={2}
                    placeholder="Details if 'Other' selected"
                  />
                ) : form.otherBarrier ? (
                  <Textarea value={form.otherBarrier} readOnly rows={2} />
                ) : (
                  <Box color="text-body-secondary">Not provided</Box>
                )}
              </FormField>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection
            headerText="Supports requested"
            headerDescription="Funding supports requested by the applicant."
            defaultExpanded={false}
          >
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Supports requested">
                {editing ? (
                  <Multiselect
                    options={supportOptions}
                    selectedOptions={supportOptions.filter(opt => (form.requestedSupports || []).includes(opt.value))}
                    onChange={({ detail }) =>
                      setForm(current => ({
                        ...current,
                        requestedSupports: detail.selectedOptions.map(opt => opt.value),
                      }))
                    }
                    placeholder="Select supports"
                  />
                ) : (
                  (form.requestedSupports || []).length ? (
                    <SpaceBetween direction="horizontal" size="xs">
                      {(form.requestedSupports || []).map(val => {
                        const label = supportOptions.find(opt => opt.value === val)?.label || val;
                        return (
                          <Badge key={val} color="blue">
                            {label}
                          </Badge>
                        );
                      })}
                    </SpaceBetween>
                  ) : (
                    <Box color="text-body-secondary">Not provided</Box>
                  )
                )}
              </FormField>
              <FormField label="Current childcare support status">
                {form.requestedSupports?.includes("childcare") ? (
                  editing ? (
                    <Multiselect
                      options={childcareFundingOptions}
                      selectedOptions={childcareFundingOptions.filter(opt =>
                        (form.childcareFunding || []).includes(opt.value)
                      )}
                      onChange={({ detail }) =>
                        setForm(current => ({
                          ...current,
                          childcareFunding: detail.selectedOptions.map(opt => opt.value),
                        }))
                      }
                      placeholder="Select status"
                    />
                  ) : (form.childcareFunding || []).length ? (
                    <SpaceBetween direction="horizontal" size="xs">
                      {(form.childcareFunding || []).map(val => {
                        const label = childcareFundingOptions.find(opt => opt.value === val)?.label || val;
                        return (
                          <Badge key={val} color="blue">
                            {label}
                          </Badge>
                        );
                      })}
                    </SpaceBetween>
                  ) : (
                    <Box color="text-body-secondary">Not provided</Box>
                  )
                ) : (
                  <Box color="text-body-secondary">Not provided</Box>
                )}
              </FormField>
              <FormField label="Other support detail">
                {form.requestedSupports?.includes("other") ? (
                  <Textarea
                    value={form.otherRequestedSupport}
                    onChange={({ detail }) => setForm(current => ({ ...current, otherRequestedSupport: detail.value }))}
                    readOnly={!editing}
                    rows={2}
                    placeholder="Describe other support"
                  />
                ) : (
                  <Box color="text-body-secondary">Not provided</Box>
                )}
              </FormField>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection
            headerText="Household finances"
            headerDescription="Monthly household cash flow snapshot."
            defaultExpanded={false}
          >
            <SpaceBetween size="l">
              <ColumnLayout columns={2} variant="text-grid">
                <SpaceBetween size="xxs">
                  <Header variant="h3" description="Monthly household cash flow snapshot.">
                    Household income
                  </Header>
                  <Table
                    variant="embedded"
                    stripedRows
                    resizableColumns={false}
                    items={incomeTableItems}
                    columnDefinitions={[
                      {
                        id: "label",
                        header: "Category",
                        cell: item => (
                          <Box fontWeight={item.isTotal ? "bold" : "normal"}>{item.label}</Box>
                        ),
                      },
                      {
                        id: "amount",
                        header: "Amount",
                        cell: item => {
                          if (editing && !item.isTotal) {
                            const formKey = amountFieldMap[item.key];
                            return (
                              <Input
                                value={formKey ? form[formKey] || "" : ""}
                                onChange={({ detail }) =>
                                  setForm(current => ({
                                    ...current,
                                    [formKey]: detail.value,
                                  }))
                                }
                                inputMode="decimal"
                                placeholder="$0"
                              />
                            );
                          }
                          return <Box fontWeight={item.isTotal ? "bold" : "normal"}>{formatCurrency(item.amount)}</Box>;
                        },
                      },
                    ]}
                    trackBy="key"
                    header={null}
                  />
                </SpaceBetween>
                <SpaceBetween size="xxs">
                  <Header variant="h3" description="Monthly household cash flow snapshot.">
                    Household expenses
                  </Header>
                  <Table
                    variant="embedded"
                    stripedRows
                    resizableColumns={false}
                    items={expenseTableItems}
                    columnDefinitions={[
                      {
                        id: "label",
                        header: "Category",
                        cell: item => (
                          <Box fontWeight={item.isTotal ? "bold" : "normal"}>{item.label}</Box>
                        ),
                      },
                      {
                        id: "amount",
                        header: "Amount",
                        cell: item => {
                          if (editing && !item.isTotal) {
                            const formKey = amountFieldMap[item.key];
                            return (
                              <Input
                                value={formKey ? form[formKey] || "" : ""}
                                onChange={({ detail }) =>
                                  setForm(current => ({
                                    ...current,
                                    [formKey]: detail.value,
                                  }))
                                }
                                inputMode="decimal"
                                placeholder="$0"
                              />
                            );
                          }
                          return <Box fontWeight={item.isTotal ? "bold" : "normal"}>{formatCurrency(item.amount)}</Box>;
                        },
                      },
                    ]}
                    trackBy="key"
                    header={null}
                  />
                </SpaceBetween>
              </ColumnLayout>

              <ColumnLayout columns={2} variant="text-grid">
                <FormField label="Other income source(s)">
                  {editing ? (
                    <Textarea
                      value={form.incomeOther}
                      onChange={({ detail }) => setForm(current => ({ ...current, incomeOther: detail.value }))}
                      rows={2}
                      placeholder="Other income details"
                    />
                  ) : form.incomeOther ? (
                    <Box>{form.incomeOther}</Box>
                  ) : (
                    <Box color="text-body-secondary">Not provided</Box>
                  )}
                </FormField>
                <FormField label="Transport expense categories">
                  {editing ? (
                    <Multiselect
                      options={expensesTransportOptions}
                      selectedOptions={expensesTransportOptions.filter(opt =>
                        (form.expensesTransport || []).includes(opt.value)
                      )}
                      onChange={({ detail }) =>
                        setForm(current => ({
                          ...current,
                          expensesTransport: detail.selectedOptions.map(opt => opt.value),
                        }))
                      }
                      placeholder="Select categories"
                    />
                  ) : (form.expensesTransport || []).length ? (
                    <SpaceBetween direction="horizontal" size="xs">
                      {(form.expensesTransport || []).map(val => {
                        const label = expensesTransportOptions.find(opt => opt.value === val)?.label || val;
                        return (
                          <Badge key={val} color="blue">
                            {label}
                          </Badge>
                        );
                      })}
                    </SpaceBetween>
                  ) : (
                    <Box color="text-body-secondary">Not provided</Box>
                  )}
                </FormField>
                <FormField label="Mileage (home to school)">
                  {editing ? (
                    <Input
                      value={form.expensesTransportMileage}
                      onChange={({ detail }) => setForm(current => ({ ...current, expensesTransportMileage: detail.value }))}
                      inputMode="numeric"
                      placeholder="km per month"
                    />
                  ) : mileageValue
                    ? <Box>{`${mileageValue} km per month`}</Box>
                    : <Box color="text-body-secondary">Not provided</Box>}
                </FormField>
                <FormField label="Student loans or grants?">
                  {editing ? (
                    <Select
                      options={yesNoOptions}
                      selectedOption={yesNoOptions.find(opt => opt.value === (form.loanGrant || "")) || yesNoOptions[0]}
                      onChange={({ detail }) => setForm(current => ({ ...current, loanGrant: detail.selectedOption?.value || "" }))}
                      placeholder="Select"
                    />
                  ) : loanGrantValue
                    ? <Box>{loanGrantValue === "yes" ? "Yes" : "No"}</Box>
                    : <Box color="text-body-secondary">Not provided</Box>}
                </FormField>
                <FormField label="Other expenses (list)">
                  {editing ? (
                    <Textarea
                      value={form.expensesOtherList}
                      onChange={({ detail }) => setForm(current => ({ ...current, expensesOtherList: detail.value }))}
                      rows={2}
                      placeholder="Other expense notes"
                    />
                  ) : form.expensesOtherList ? <Box>{form.expensesOtherList}</Box> : <Box color="text-body-secondary">Not provided</Box>}
                </FormField>
                <FormField label="Student loan/grant details">
                  {editing ? (
                    <Textarea
                      value={form.loanGrantDetails}
                      onChange={({ detail }) => setForm(current => ({ ...current, loanGrantDetails: detail.value }))}
                      rows={2}
                      placeholder="Details"
                    />
                  ) : loanGrantDetailsValue
                    ? <Box>{loanGrantDetailsValue}</Box>
                    : <Box color="text-body-secondary">Not provided</Box>}
                </FormField>
              </ColumnLayout>
            </SpaceBetween>
          </ExpandableSection>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default ParticipantDetailsWidget;
