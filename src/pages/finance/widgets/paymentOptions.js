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
  { value: "Client", label: "Client" },
  { value: "Vendor", label: "Vendor" },
  { value: "Institution", label: "Training institution" },
  { value: "Employer", label: "Employer" },
  { value: "Other", label: "Other" },
];

export const findOptionByValue = (options, value) =>
  options.find(option => option.value === value) || null;
