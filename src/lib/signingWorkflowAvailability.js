const SUPPORTED_SECURE_MESSAGE_WORKFLOW_TYPES = new Set([
  'consent-no-prefill',
  'consent-cm-prefill',
]);

const CM_PREFILL_DOCUMENT_TYPES = new Set([
  'funding_agreement',
  'financial_overview',
  'attendance_form',
]);

const CANONICAL_RESERVED_DOCUMENT_TYPES = new Set([
  'assessment_approval_letter',
  'assessment_denial_letter',
  ...CM_PREFILL_DOCUMENT_TYPES,
  'eft_form',
]);

const APPROVAL_LETTER_IDENTITY_KEYS = new Set([
  'approval_letter',
  'letter_of_approval',
  'application_approval_letter',
  'assessment_approval_letter',
]);
const DENIAL_LETTER_IDENTITY_KEYS = new Set([
  'denial_letter',
  'letter_of_denial',
  'application_denial_letter',
  'assessment_denial_letter',
]);
const DECISION_LETTER_IDENTITY_KEYS = new Set([
  'decision_letter',
  'application_decision_letter',
  'assessment_decision_letter',
]);

const LEGACY_EFT_WORKFLOW_ID = 43;
const LEGACY_EFT_WORKFLOW_NAME = 'EFT & Wire Transfer Direct Debit';
const LEGACY_EFT_DOCUMENT_TYPE = 'EFT_form';

const normalizeIdentityKey = value => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const resolveManagedDecisionLetterKind = (value, { allowEmbeddedAssessment = false } = {}) => {
  const key = normalizeIdentityKey(value);
  if (!key) return null;
  if (
    APPROVAL_LETTER_IDENTITY_KEYS.has(key) ||
    (allowEmbeddedAssessment && /(?:^|_)assessment_approval_letter(?:_|$)/.test(key))
  ) {
    return 'assessment_approval_letter';
  }
  if (
    DENIAL_LETTER_IDENTITY_KEYS.has(key) ||
    (allowEmbeddedAssessment && /(?:^|_)assessment_denial_letter(?:_|$)/.test(key))
  ) {
    return 'assessment_denial_letter';
  }
  if (
    DECISION_LETTER_IDENTITY_KEYS.has(key) ||
    (
      allowEmbeddedAssessment &&
      (
        /(?:^|_)(?:assessment|application)_decision_letter(?:_|$)/.test(key) ||
        /^(?:signed_|legacy_|versioned_)?decision_letter(?:_|$)/.test(key)
      )
    )
  ) {
    return 'decision_letter';
  }
  return null;
};

const resolveManagedDocumentTypeKind = value => {
  const key = normalizeIdentityKey(value);
  if (!key) return null;
  const tokens = key.split('_');
  const isDistinctMouOrCoFundingAgreement = (
    tokens.includes('mou') ||
    key.includes('co_funding_agreement')
  );
  if (
    !isDistinctMouOrCoFundingAgreement &&
    (
      /(?:^|_)funding_agreement(?:_|$)/.test(key) ||
      /(?:^|_)client_funding_agreement(?:_|$)/.test(key)
    )
  ) {
    return 'funding_agreement';
  }
  if (/(?:^|_)eft(?:_|$)/.test(key) || /(?:^|_)electronic_funds?_transfer(?:_|$)/.test(key)) {
    return 'eft_form';
  }
  if (/(?:^|_)financial_overview(?:_|$)/.test(key)) return 'financial_overview';
  if (
    /(?:^|_)attendance_(?:report|form)(?:_|$)/.test(key) ||
    /(?:^|_)(?:client_)?monthly_attendance_(?:report|form)(?:_|$)/.test(key)
  ) {
    return 'attendance_form';
  }
  return resolveManagedDecisionLetterKind(key, { allowEmbeddedAssessment: true });
};

const resolveManagedWorkflowNameKind = value => {
  const key = normalizeIdentityKey(value);
  if (!key) return null;
  const tokens = key.split('_');
  const identifiesClientFundingAgreement = (
    tokens.includes('cfa') ||
    /(?:^|_)client_funding_agreement(?:_|$)/.test(key) ||
    (
      /(?:^|_)funding_agreement(?:_|$)/.test(key) &&
      !tokens.includes('mou') &&
      !key.includes('co_funding_agreement')
    )
  );
  if (identifiesClientFundingAgreement) return 'funding_agreement';
  if (
    tokens.includes('eft') ||
    (key.includes('electronic') && key.includes('fund') && key.includes('transfer'))
  ) {
    return 'eft_form';
  }
  if (key.includes('financial') && key.includes('overview')) return 'financial_overview';
  if (
    key.includes('attendance') &&
    (key.includes('report') || key.includes('form'))
  ) {
    return 'attendance_form';
  }
  return resolveManagedDecisionLetterKind(key);
};

const toNumberOrNull = value => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toUpdatedAtMillis = value => {
  if (value === null || typeof value === 'undefined' || value === '') {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

export const normalizeSigningWorkflowRecord = (workflow = {}) => {
  const id = Number(workflow?.id);
  const workflowType = String(
    workflow?.type ?? workflow?.workflow_type ?? workflow?.workflowType ?? ''
  ).trim();
  const documentType = String(
    workflow?.documentType ?? workflow?.document_type ?? ''
  ).trim();
  const updatedAt = workflow?.updatedAt ?? workflow?.updated_at ?? null;
  return {
    ...workflow,
    id,
    name: String(workflow?.name ?? '').trim() || (Number.isInteger(id) ? `Workflow ${id}` : 'Workflow'),
    status: String(
      workflow?.status ?? workflow?.workflow_status ?? workflow?.workflowStatus ?? ''
    ).trim().toLowerCase(),
    type: workflowType,
    workflowType,
    documentType,
    updatedAt,
    updatedAtMillis: toUpdatedAtMillis(updatedAt),
  };
};

export const isExactLegacyEftSigningWorkflow = workflow => {
  const normalized = normalizeSigningWorkflowRecord(workflow);
  // Mirrors the server's proven TEST/PROD compatibility tuple. Do not widen
  // this to other draft workflows or normalize away the stored `EFT_form`.
  return (
    normalized.id === LEGACY_EFT_WORKFLOW_ID &&
    normalized.name === LEGACY_EFT_WORKFLOW_NAME &&
    (normalized.status === 'active' || normalized.status === 'draft') &&
    normalized.workflowType === 'consent-no-prefill' &&
    normalized.documentType === LEGACY_EFT_DOCUMENT_TYPE
  );
};

export const resolveSecureMessageManagedWorkflowKind = workflow => {
  const normalized = normalizeSigningWorkflowRecord(workflow);
  const documentKind = resolveManagedDocumentTypeKind(normalized.documentType);
  const nameKind = resolveManagedWorkflowNameKind(normalized.name);
  return documentKind || nameKind || null;
};

export const isSupportedSecureMessageWorkflow = workflow => {
  const normalized = normalizeSigningWorkflowRecord(workflow);
  const exactLegacyEftWorkflow = isExactLegacyEftSigningWorkflow(normalized);
  const rawDocumentType = normalized.documentType;
  const documentKind = resolveManagedDocumentTypeKind(rawDocumentType);
  const nameKind = resolveManagedWorkflowNameKind(normalized.name);
  const managedKind = documentKind || nameKind;
  const managedKindConflict = Boolean(documentKind && nameKind && documentKind !== nameKind);

  if (!Number.isInteger(normalized.id) || normalized.id < 1) return false;
  if (normalized.status !== 'active' && !exactLegacyEftWorkflow) return false;
  if (!SUPPORTED_SECURE_MESSAGE_WORKFLOW_TYPES.has(normalized.workflowType)) return false;

  // Managed forms need their exact catalogue identity. Names and historical
  // aliases are recognition signals only; they are never persistence identity.
  if (
    managedKind &&
    !exactLegacyEftWorkflow &&
    (
      managedKindConflict ||
      (nameKind && documentKind !== nameKind) ||
      !CANONICAL_RESERVED_DOCUMENT_TYPES.has(managedKind) ||
      rawDocumentType !== managedKind
    )
  ) {
    return false;
  }
  if (
    CM_PREFILL_DOCUMENT_TYPES.has(rawDocumentType) &&
    normalized.workflowType !== 'consent-cm-prefill'
  ) {
    return false;
  }
  return true;
};

const INTERVENTION_SCOPE_MANAGED_KINDS = new Set([
  'assessment_approval_letter',
  'attendance_form',
  'funding_agreement',
  'eft_form',
]);

export const signingWorkflowAcceptsInterventionScope = workflow => (
  isSupportedSecureMessageWorkflow(workflow) &&
  INTERVENTION_SCOPE_MANAGED_KINDS.has(resolveSecureMessageManagedWorkflowKind(workflow))
);

export const selectLatestSupportedSigningWorkflow = (workflows, exactDocumentType) => {
  const documentType = String(exactDocumentType ?? '').trim();
  if (!documentType) return null;
  return (Array.isArray(workflows) ? workflows : [])
    .map(normalizeSigningWorkflowRecord)
    .filter(workflow => (
      Number.isInteger(workflow.id) &&
      workflow.id > 0 &&
      workflow.documentType === documentType &&
      isSupportedSecureMessageWorkflow(workflow)
    ))
    .sort((left, right) => (
      right.updatedAtMillis - left.updatedAtMillis || right.id - left.id
    ))[0] || null;
};

export const selectExactFundingActionPlans = (actionPlans, applicationId) => {
  const resolvedApplicationId = toNumberOrNull(applicationId);
  if (!Number.isInteger(resolvedApplicationId) || resolvedApplicationId < 1) return [];
  return (Array.isArray(actionPlans) ? actionPlans : [])
    .filter(plan => {
      const planId = toNumberOrNull(plan?.id);
      const planApplicationId = toNumberOrNull(plan?.applicationId ?? plan?.application_id);
      const status = String(plan?.status || '').trim().toLowerCase();
      const archivedAt = plan?.archivedAt ?? plan?.archived_at ?? null;
      return (
        Number.isInteger(planId) &&
        planId > 0 &&
        planApplicationId === resolvedApplicationId &&
        !archivedAt &&
        (status === 'draft' || status === 'active')
      );
    })
    .map(plan => ({
      id: toNumberOrNull(plan.id),
      label: plan.title || plan.name || `Action Plan ${plan.id}`,
      status: String(plan.status || '').trim().toLowerCase(),
    }))
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === 'active' ? -1 : 1;
      return Number(right.id) - Number(left.id);
    });
};
