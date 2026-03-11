export const PAYMENT_TYPE_OPTIONS = [
  { value: "LivingAllowance", label: "Living allowance" },
  { value: "TuitionFeesDirect", label: "Tuition fees (direct)" },
  { value: "TuitionFeesReimbursement", label: "Tuition fees (reimbursement)" },
  { value: "SpecializedEquipmentAdvance", label: "Specialized equipment (advance)" },
  { value: "SpecializedEquipmentReimbursement", label: "Specialized equipment (reimbursement)" },
  { value: "WageSubsidyEmployer", label: "Targeted wage subsidy (employer)" },
  { value: "Childcare", label: "Childcare" },
  { value: "Transportation", label: "Transportation" },
  { value: "BooksMaterialsDirect", label: "Books and materials (direct)" },
  { value: "BooksMaterialsReimbursement", label: "Books and materials (reimbursement)" },
  { value: "JCPProjectCost", label: "JCP project cost" },
  { value: "SEBSupport", label: "SEB support" },
  { value: "OtherEligibleCost", label: "Other eligible cost" },
];

export const PAYEE_TYPE_OPTIONS = [
  {
    value: "ParticipantClient",
    label: "Participant (Client)",
    description:
      "Payment made directly to the client (e.g., living allowance or reimbursement).",
  },
  {
    value: "AccreditedEducationalTrainingInstitution",
    label: "Accredited Educational / Training Institution",
    description:
      "College, university, or approved training institution delivering the program.",
  },
  {
    value: "EmployerWageSubsidyPartner",
    label: "Employer (Wage Subsidy Partner)",
    description:
      "Employer participating in a wage subsidy or work placement arrangement.",
  },
  {
    value: "ChildcareProvider",
    label: "Childcare Provider",
    description:
      "Licensed or eligible childcare provider supporting the client during training.",
  },
  {
    value: "CommunityNonProfitOrganization",
    label: "Community / Non-Profit Organization",
    description:
      "Community or non-profit organization delivering a project or training activity.",
  },
  {
    value: "TrainingRelatedSupplier",
    label: "Training-Related Supplier (Books, Equipment, Materials)",
    description:
      "Supplier providing required books, materials, equipment, or certification fees.",
  },
  {
    value: "ProfessionalBusinessServicesProvider",
    label: "Professional / Business Services Provider",
    description:
      "Professional service supporting a self-employment activity (e.g., accounting or business training).",
  },
];

export const findOptionByValue = (options, value) => {
  const match = options.find(option => option.value === value);
  if (match) return match;
  if (value === null || typeof value === "undefined" || value === "") return null;
  // Keep legacy/stored values visible even when not present in current options.
  return { value: String(value), label: String(value) };
};
