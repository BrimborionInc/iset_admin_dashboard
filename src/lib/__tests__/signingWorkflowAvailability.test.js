import {
  isSupportedSecureMessageWorkflow,
  normalizeSigningWorkflowRecord,
  signingWorkflowAcceptsInterventionScope,
  selectExactFundingActionPlans,
  selectLatestSupportedSigningWorkflow,
} from '../signingWorkflowAvailability';

const workflow = overrides => ({
  id: 1,
  name: 'General consent',
  status: 'active',
  workflow_type: 'consent-no-prefill',
  document_type: 'general_consent',
  updated_at: '2026-08-25T12:00:00.000Z',
  ...overrides,
});

describe('signing workflow availability contract', () => {
  test.each([
    ['generic no-prefill consent', {}, true],
    ['generic CM-prefill consent', { workflow_type: 'consent-cm-prefill' }, true],
    ['case-insensitive active status', { status: ' ACTIVE ' }, true],
    ['missing positive workflow id', { id: null }, false],
    ['draft workflow', { status: 'draft' }, false],
    ['inactive workflow', { status: 'inactive' }, false],
    ['unsupported workflow mode', { workflow_type: 'approval-no-prefill' }, false],
    ['noncanonical workflow mode case', { workflow_type: 'CONSENT-NO-PREFILL' }, false],
    ['canonical funding agreement', { document_type: 'funding_agreement', workflow_type: 'consent-cm-prefill' }, true],
    ['no-prefill funding agreement', { document_type: 'funding_agreement' }, false],
    ['canonical financial overview', { document_type: 'financial_overview', workflow_type: 'consent-cm-prefill' }, true],
    ['no-prefill financial overview', { document_type: 'financial_overview' }, false],
    ['canonical attendance form', { document_type: 'attendance_form', workflow_type: 'consent-cm-prefill' }, true],
    ['no-prefill attendance form', { document_type: 'attendance_form' }, false],
    ['EFT no-prefill', { document_type: 'eft_form' }, true],
    ['EFT CM-prefill', { document_type: 'eft_form', workflow_type: 'consent-cm-prefill' }, true],
    ['approval letter', { document_type: 'assessment_approval_letter' }, true],
    ['denial letter', { document_type: 'assessment_denial_letter' }, true],
    ['funding alias', { document_type: 'client_funding_agreement', workflow_type: 'consent-cm-prefill' }, false],
    ['EFT alias', { document_type: 'eft_or_wire_transfer_form' }, false],
    ['EFT direct-deposit alias', { document_type: 'eft_or_wire_transfer_direct_deposit_form' }, false],
    ['funding punctuation variant', { document_type: 'funding-agreement', workflow_type: 'consent-cm-prefill' }, false],
    ['versioned funding type', { document_type: 'funding_agreement_v2', workflow_type: 'consent-cm-prefill' }, false],
    ['signed funding type', { name: 'Signed funding alias', document_type: 'signed_funding_agreement', workflow_type: 'consent-cm-prefill' }, false],
    ['legacy client funding type', { name: 'Legacy funding alias', document_type: 'legacy_client_funding_agreement', workflow_type: 'consent-cm-prefill' }, false],
    ['financial overview suffix alias', { document_type: 'financial_overview_form', workflow_type: 'consent-cm-prefill' }, false],
    ['attendance report alias', { document_type: 'attendance_report', workflow_type: 'consent-cm-prefill' }, false],
    ['EFT case variant', { document_type: 'EFT_form' }, false],
    ['signed EFT type', { name: 'Signed bank form', document_type: 'signed_eft_form' }, false],
    ['approval-letter punctuation variant', { document_type: 'assessment-approval-letter' }, false],
    ['approval letter alias', { document_type: 'approval_letter' }, false],
    ['denial letter alias', { document_type: 'denial_letter' }, false],
    ['versioned assessment decision letter', { document_type: 'assessment_decision_letter_v2' }, false],
    ['signed decision letter alias', { document_type: 'signed_decision_letter' }, false],
    ['name-only funding agreement', { name: 'Client Funding Agreement', document_type: null, workflow_type: 'consent-cm-prefill' }, false],
    ['name-only financial overview', { name: 'Financial Overview', document_type: null, workflow_type: 'consent-cm-prefill' }, false],
    ['name-only attendance report', { name: 'Monthly Attendance Report', document_type: null, workflow_type: 'consent-cm-prefill' }, false],
    ['name-only EFT', { name: 'EFT or Wire Transfer Form', document_type: null }, false],
    ['name-only electronic funds transfer', { name: 'Electronic Funds Transfer Form', document_type: null }, false],
    ['name-only approval letter', { name: 'Letter of Approval', document_type: null }, false],
    ['name-only denial letter', { name: 'Letter of Denial', document_type: null }, false],
    ['name-only decision letter', { name: 'Decision Letter', document_type: null }, false],
    ['funding name with generic type', { name: 'Client Funding Agreement', document_type: 'general_consent' }, false],
    ['approval-letter name with generic type', { name: 'Letter of Approval', document_type: 'general_consent' }, false],
    ['denial-letter name with generic type', { name: 'Letter of Denial', document_type: 'general_consent' }, false],
    ['decision-letter name with generic type', { name: 'Decision Letter', document_type: 'general_consent' }, false],
    ['financial name with generic type', { name: 'Financial Overview', document_type: 'general_consent', workflow_type: 'consent-cm-prefill' }, false],
    ['attendance name with generic type', { name: 'Attendance Form', document_type: 'general_consent', workflow_type: 'consent-cm-prefill' }, false],
    ['EFT name with generic type', { name: 'EFT Form', document_type: 'general_consent' }, false],
    ['funding name paired with EFT type', { name: 'Client Funding Agreement', document_type: 'eft_form' }, false],
    ['approval name paired with denial type', { name: 'Letter of Approval', document_type: 'assessment_denial_letter' }, false],
    ['financial name paired with funding type', { name: 'Financial Overview', document_type: 'funding_agreement', workflow_type: 'consent-cm-prefill' }, false],
    ['matching funding name and canonical type', { name: 'Client Funding Agreement', document_type: 'funding_agreement', workflow_type: 'consent-cm-prefill' }, true],
    ['generic decision-letter name cannot stand in for approval', { name: 'Decision Letter', document_type: 'assessment_approval_letter' }, false],
    ['MOU co-funding agreement remains a distinct generic form', { name: 'MOU/Co-Funding Agreement Letter', document_type: 'mou_co_funding_agreement_letter' }, true],
    ['CFA name cannot fall through to generic consent', { name: 'CFA', document_type: 'general_consent' }, false],
    ['CFA type alias is noncanonical', { name: 'Client Funding Agreement', document_type: 'cfa_form', workflow_type: 'consent-cm-prefill' }, false],
    ['generic consent without document type', { name: 'Release of information', document_type: null }, true],
    ['generic institution approval letter', { name: 'Institution Approval Letter', document_type: 'institution_approval_letter' }, true],
    ['generic band funding decision letter', { name: 'Band Funding Decision Letter', document_type: 'band_funding_decision' }, true],
    ['generic band decision-letter document type', { name: 'Band Funding Decision Letter', document_type: 'band_funding_decision_letter' }, true],
  ])('%s', (_label, overrides, expected) => {
    expect(isSupportedSecureMessageWorkflow(workflow(overrides))).toBe(expected);
  });

  test('mirrors the proven TEST and PROD consent catalogue including only the exact legacy EFT exception', () => {
    const catalogue = [
      [41, 'FORM 7 - Consent for use of Image, Video and Audio', 'draft', 'consent-no-prefill', 'media_consent', false],
      [42, 'FORM 6 - Authorisation for release of ISET client information', 'draft', 'consent-no-prefill', 'iset_client_info_release', false],
      [43, 'EFT & Wire Transfer Direct Debit', 'draft', 'consent-no-prefill', 'EFT_form', true],
      [44, 'Client Acknowledgement of Funding Source', 'active', 'consent-no-prefill', 'client_acknowledgement', true],
      [45, 'Client Funding Agreement', 'active', 'consent-cm-prefill', 'funding_agreement', true],
      [46, 'Letter of Approval', 'active', 'consent-cm-prefill', 'assessment_approval_letter', true],
      [47, 'Letter of Denial', 'active', 'consent-cm-prefill', 'assessment_denial_letter', true],
      [49, 'EI Consent Form', 'active', 'consent-no-prefill', 'ei_consent', true],
      [50, 'Indigenous Declaration', 'active', 'consent-no-prefill', 'indigenous_declaration', true],
      [51, 'Conflict of Interest Form', 'active', 'consent-no-prefill', 'conflict_of_interest', true],
      [52, 'Financial Overview', 'active', 'consent-cm-prefill', 'financial_overview', true],
      [54, 'Client Monthly Attendance Report', 'active', 'consent-cm-prefill', 'attendance_form', true],
    ];

    catalogue.forEach(([id, name, status, workflowType, documentType, expected]) => {
      const row = workflow({
        id,
        name,
        status,
        workflow_type: workflowType,
        document_type: documentType,
      });
      expect(isSupportedSecureMessageWorkflow(row)).toBe(expected);
    });

    const legacyEftRow = workflow({
      id: 43,
      name: 'EFT & Wire Transfer Direct Debit',
      status: 'draft',
      workflow_type: 'consent-no-prefill',
      document_type: 'EFT_form',
    });
    expect(normalizeSigningWorkflowRecord(legacyEftRow).documentType).toBe('EFT_form');
    expect(signingWorkflowAcceptsInterventionScope(legacyEftRow)).toBe(true);

    [
      { id: 143, name: 'EFT & Wire Transfer Direct Debit', status: 'draft' },
      { id: 43, name: 'Different EFT Form', status: 'draft' },
      { id: 43, name: 'EFT & Wire Transfer Direct Debit', status: 'inactive' },
    ].forEach(overrides => {
      expect(isSupportedSecureMessageWorkflow(workflow({
        workflow_type: 'consent-no-prefill',
        document_type: 'EFT_form',
        ...overrides,
      }))).toBe(false);
    });
  });

  test('intervention scope follows managed semantics rather than raw document-type casing', () => {
    expect(signingWorkflowAcceptsInterventionScope(workflow({
      id: 43,
      name: 'EFT & Wire Transfer Direct Debit',
      status: 'draft',
      workflow_type: 'consent-no-prefill',
      document_type: 'EFT_form',
    }))).toBe(true);
    expect(signingWorkflowAcceptsInterventionScope(workflow({
      id: 49,
      name: 'EI Consent Form',
      document_type: 'ei_consent',
    }))).toBe(false);
  });

  test('normalizes API field aliases without normalizing catalogue identity', () => {
    expect(normalizeSigningWorkflowRecord({
      id: '45',
      name: ' Approval ',
      workflow_status: ' ACTIVE ',
      workflowType: ' consent-no-prefill ',
      documentType: ' assessment_approval_letter ',
      updatedAt: '2026-08-25T11:00:00.000Z',
    })).toMatchObject({
      id: 45,
      name: 'Approval',
      status: 'active',
      type: 'consent-no-prefill',
      workflowType: 'consent-no-prefill',
      documentType: 'assessment_approval_letter',
      updatedAtMillis: Date.parse('2026-08-25T11:00:00.000Z'),
    });
  });

  test('selects by updated_at descending before using id descending', () => {
    const selected = selectLatestSupportedSigningWorkflow([
      workflow({ id: 90, document_type: 'assessment_approval_letter', updated_at: '2026-08-24T12:00:00.000Z' }),
      workflow({ id: 40, document_type: 'assessment_approval_letter', updated_at: '2026-08-25T12:00:00.000Z' }),
      workflow({ id: 41, document_type: 'assessment_approval_letter', updated_at: '2026-08-25T12:00:00.000Z' }),
      workflow({ id: 99, status: 'draft', document_type: 'assessment_approval_letter', updated_at: '2026-08-26T12:00:00.000Z' }),
    ], 'assessment_approval_letter');

    expect(selected).toMatchObject({ id: 41, documentType: 'assessment_approval_letter' });
  });

  test('selects only open, non-archived Action Plans owned by the exact application', () => {
    expect(selectExactFundingActionPlans([
      { id: 3, applicationId: null, title: 'Legacy plan', status: 'active' },
      { id: 184, applicationId: 123, title: 'Current plan', status: 'active' },
      { id: 185, application_id: 123, name: 'Draft plan', status: 'draft' },
      { id: 186, applicationId: 123, title: 'Closed plan', status: 'closed' },
      { id: 187, applicationId: 123, title: 'Archived plan', status: 'draft', archivedAt: '2026-08-25' },
      { id: 900, applicationId: 999, title: 'Sibling plan', status: 'active' },
    ], 123)).toEqual([
      { id: 184, label: 'Current plan', status: 'active' },
      { id: 185, label: 'Draft plan', status: 'draft' },
    ]);
  });
});
