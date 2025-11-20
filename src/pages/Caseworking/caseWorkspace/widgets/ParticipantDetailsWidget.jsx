import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Autosuggest,
  Box,
  Button,
  ColumnLayout,
  CopyToClipboard,
  DatePicker,
  FormField,
  Header,
  ExpandableSection,
  Input,
  Select,
  Textarea,
  SpaceBetween,
  Tabs,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import { apiFetch } from "../../../../auth/apiClient.js";

const genderOptions = [
  { value: "", label: "Not set" },
  // ESDC expected values: male, female, unspecified
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unspecified", label: "Unspecified" },
];

const cleanSin = (raw = "") => {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits || "";
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

const ParticipantDetailsWidget = ({ actions = {}, metadata = {} }) => {
  const { caseData, saveCaseContext } = useCaseWorkspace();
  const caseContext = caseData?.caseContext || {};
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
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
    preferredLanguage: "",
    visibleMinority: "",
    maritalStatus: "",
    dependentChildren: "",
    agesOfChildren: "",
    eiStatus: "",
    hasDisability: "",
    disabilitySupport: "",
    disabilityDescription: "",
    homeCommunity: "",
  });
  const [bandSearchOptions, setBandSearchOptions] = useState({ home: [] });
  const [bandSearchLoading, setBandSearchLoading] = useState({ home: false });

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
    const answers =
      caseContext.applicationAnswers ||
      caseContext.applicationPayload?.answers ||
      {};
    const readAnswer = key => {
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
    const normaliseYesNo = value => {
      if (value === null || typeof value === "undefined") return "";
      const trimmed = String(value).trim().toLowerCase();
      if (["yes", "y", "true", "1"].includes(trimmed)) return "yes";
      if (["no", "n", "false", "0"].includes(trimmed)) return "no";
      return String(value);
    };
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
      registrationNumber:
        caseContext.registrationNumber || readAnswer("registration-number") || personal.registration_number || "",
      preferredLanguage: caseContext.preferredLanguage || readAnswer("preferred-language") || "",
      visibleMinority: caseContext.visibleMinority || normaliseYesNo(readAnswer("visible-minority")) || "",
      maritalStatus: caseContext.maritalStatus || readAnswer("marital-status") || "",
      dependentChildren: caseContext.dependentChildren || readAnswer("dependent-children") || "",
      agesOfChildren: caseContext.agesOfChildren || readAnswer("ages-of-children") || "",
      eiStatus: caseContext.eiStatus || readAnswer("ei_status") || "",
      hasDisability: caseContext.hasDisability || normaliseYesNo(readAnswer("has-disability")) || "",
      disabilitySupport: caseContext.disabilitySupport || readAnswer("disability-support") || "",
      disabilityDescription: caseContext.disabilityDescription || readAnswer("disability-description") || "",
      homeCommunity:
        caseContext.homeCommunity ||
        readAnswer("home-community") ||
        readAnswer("home-comminuty") ||
        personal.home_community ||
        personal.homeCommunity ||
        "",
    });
  }, [caseContext]);

  const selectedGender = useMemo(
    () => genderOptions.find(opt => opt.value === (form.gender || "")) || genderOptions[0],
    [form.gender]
  );
  const selectedProvince = useMemo(
    () => provinceOptions.find(opt => opt.value === (form.addressProvince || "")) || null,
    [form.addressProvince]
  );

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const cleanedSin = cleanSin(form.sin || "");
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
        preferredLanguage: form.preferredLanguage || null,
        visibleMinority: form.visibleMinority || null,
        maritalStatus: form.maritalStatus || null,
        dependentChildren: form.dependentChildren || null,
        agesOfChildren: form.agesOfChildren || null,
        eiStatus: form.eiStatus || null,
        hasDisability: form.hasDisability || null,
        disabilitySupport: form.disabilitySupport || null,
        disabilityDescription: form.disabilityDescription || null,
        homeCommunity: form.homeCommunity || null,
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
          "preferred-language": form.preferredLanguage || null,
          "visible-minority": form.visibleMinority || null,
          "marital-status": form.maritalStatus || null,
          "dependent-children": form.dependentChildren || null,
          "ages-of-children": form.agesOfChildren || null,
          "ei_status": form.eiStatus || null,
          "has-disability": form.hasDisability || null,
          "disability-support": form.disabilitySupport || null,
          "disability-description": form.disabilityDescription || null,
          "home-community": form.homeCommunity || null,
          "home-comminuty": form.homeCommunity || null,
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

  const handleCancel = () => {
    const personal = caseContext.applicationPersonal || {};
    const address =
      caseContext.address ||
      personal.address ||
      personal.home_address ||
      personal.homeAddress ||
      {};
    setForm({
      firstName: caseContext.firstName || personal.first_name || personal.firstName || "",
      lastName: caseContext.lastName || personal.last_name || personal.lastName || "",
      preferredName: caseContext.preferredName || personal.preferred_name || personal.preferredName || "",
      middleNames: caseContext.middleNames || personal.middle_names || personal.middleNames || "",
      gender: caseContext.gender || personal.gender || "",
      genderIdentity: caseContext.genderIdentity || personal.gender_identity || personal.genderIdentity || "",
      sex: caseContext.sex || personal.sex || "",
      sin: caseContext.sin || personal.sin || "",
      dateOfBirth: caseContext.dateOfBirth || personal.date_of_birth || personal.dateOfBirth || "",
      addressLine1: address.line1 || address.address1 || address.address_line_1 || "",
      addressLine2: address.line2 || address.address2 || address.address_line_2 || "",
      addressCity: address.city || "",
      addressProvince: address.province || "",
      postalCode: address.postalCode || address.postal_code || "",
    });
    setEditing(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={
            metadata.description ??
            "Refer to the application form for the original submission. Caseworkers must keep these details current based on participant updates. Handle this sensitive personal data carefully and avoid duplicating it elsewhere."
          }
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
          {metadata.title ?? "Participant details"}
        </Header>
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert type="success" dismissible onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
        <SpaceBetween size="l">
          <ExpandableSection
            headerText="Participant identity"
            headerDescription="Core biographical details provided by the participant."
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
                <Input
                  value={form.genderIdentity}
                  onChange={({ detail }) => setForm(current => ({ ...current, genderIdentity: detail.value }))}
                  readOnly={!editing}
                  placeholder="Gender identity"
                />
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
            headerText="Contact details"
            headerDescription="Primary and alternate contact methods provided by the participant."
            defaultExpanded
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
                            selectedOption={
                              provinceOptions.find(opt => opt.value === form.mailingProvince) || null
                            }
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
            headerText="Indigenous identity"
            headerDescription="Self-identified nation/affiliation and registration details."
            defaultExpanded={false}
          >
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Legal Indigenous identity">
                <Input
                  value={form.indigenousIdentity}
                  onChange={({ detail }) => setForm(current => ({ ...current, indigenousIdentity: detail.value }))}
                  readOnly={!editing}
                  placeholder="e.g., first_nations_status"
                />
              </FormField>
              <FormField label="Nation / community affiliation" description="As provided at intake.">
                <Input
                  value={form.indigenousAffiliation}
                  onChange={({ detail }) => setForm(current => ({ ...current, indigenousAffiliation: detail.value }))}
                  readOnly={!editing}
                  placeholder="Affiliation"
                />
              </FormField>
              <FormField label="Home community">
                {editing ? (
                  <Autosuggest
                    value={form.homeCommunity || ""}
                    options={bandSearchOptions.home || []}
                    loadingText="Searching communities..."
                    statusType={bandSearchLoading.home ? "loading" : "finished"}
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
              <FormField label="Registration number">
                <Input
                  value={form.registrationNumber}
                  onChange={({ detail }) => setForm(current => ({ ...current, registrationNumber: detail.value }))}
                  readOnly={!editing}
                  placeholder="Registration #"
                />
              </FormField>
              <FormField label="Visible minority">
                <Input
                  value={form.visibleMinority}
                  onChange={({ detail }) => setForm(current => ({ ...current, visibleMinority: detail.value }))}
                  readOnly={!editing}
                  placeholder="Yes/No"
                />
              </FormField>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection
            headerText="Household & language"
            headerDescription="Household composition, language preference, EI status."
            defaultExpanded={false}
          >
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Preferred language">
                <Input
                  value={form.preferredLanguage}
                  onChange={({ detail }) => setForm(current => ({ ...current, preferredLanguage: detail.value }))}
                  readOnly={!editing}
                  placeholder="e.g., en / fr"
                />
              </FormField>
              <FormField label="Marital status">
                <Input
                  value={form.maritalStatus}
                  onChange={({ detail }) => setForm(current => ({ ...current, maritalStatus: detail.value }))}
                  readOnly={!editing}
                  placeholder="Marital status"
                />
              </FormField>
              <FormField label="Dependent children">
                <Input
                  value={form.dependentChildren}
                  onChange={({ detail }) => setForm(current => ({ ...current, dependentChildren: detail.value }))}
                  readOnly={!editing}
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
              <FormField label="EI status">
                <Input
                  value={form.eiStatus}
                  onChange={({ detail }) => setForm(current => ({ ...current, eiStatus: detail.value }))}
                  readOnly={!editing}
                  placeholder="EI status"
                />
              </FormField>
            </ColumnLayout>
          </ExpandableSection>

          <ExpandableSection
            headerText="Disability"
            headerDescription="Self-reported disability details and supports requested."
            defaultExpanded={false}
          >
            <ColumnLayout columns={2} variant="text-grid">
              <FormField label="Has disability">
                <Input
                  value={form.hasDisability}
                  onChange={({ detail }) => setForm(current => ({ ...current, hasDisability: detail.value }))}
                  readOnly={!editing}
                  placeholder="Yes/No"
                />
              </FormField>
              <FormField label="Disability support requested">
                <Input
                  value={form.disabilitySupport}
                  onChange={({ detail }) => setForm(current => ({ ...current, disabilitySupport: detail.value }))}
                  readOnly={!editing}
                  placeholder="Support requested"
                />
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
            </ColumnLayout>
          </ExpandableSection>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default ParticipantDetailsWidget;
