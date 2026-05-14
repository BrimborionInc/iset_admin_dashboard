#!/usr/bin/env node

/**
 * Static route-scope smoke for privacy-sensitive endpoints.
 *
 * This is intentionally narrow: it checks that high-risk routes still call the
 * scope guards that prevent raw object IDs or storage keys from becoming access
 * authority. It complements, but does not replace, live authorization tests.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ADMIN_SERVER = path.join(REPO_ROOT, 'isetadminserver.js');
const PORTAL_SERVER = path.resolve(REPO_ROOT, '../ISET-intake/server.js');
const COORDINATOR_ASSESSMENT_WIDGET = path.join(REPO_ROOT, 'src/widgets/CoordinatorAssessmentWidget.js');

const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');

function usage() {
  console.log([
    'Usage: node scripts/privacy-route-scope-smoke.js [--json]',
    '',
    'Checks that privacy-sensitive admin/public routes still contain their expected scope guards.',
  ].join('\n'));
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const sources = {
  admin: readSource(ADMIN_SERVER),
  portal: readSource(PORTAL_SERVER),
  coordinator: readSource(COORDINATOR_ASSESSMENT_WIDGET),
};

function extractWindow(source, anchor, { before = 200, after = 5000 } = {}) {
  const index = source.indexOf(anchor);
  if (index < 0) return null;
  return source.slice(Math.max(0, index - before), Math.min(source.length, index + after));
}

function containsAll(snippet, patterns) {
  const missing = [];
  for (const pattern of patterns) {
    if (pattern instanceof RegExp) {
      if (!pattern.test(snippet)) missing.push(String(pattern));
    } else if (!snippet.includes(pattern)) {
      missing.push(pattern);
    }
  }
  return missing;
}

function containsForbidden(snippet, patterns = []) {
  const found = [];
  for (const pattern of patterns) {
    if (pattern instanceof RegExp) {
      if (pattern.test(snippet)) found.push(String(pattern));
    } else if (snippet.includes(pattern)) {
      found.push(pattern);
    }
  }
  return found;
}

const checks = [
  {
    name: 'admin allocation evidence upload requires finance role and pending ownership',
    source: 'admin',
    anchor: "app.post('/api/allocations/evidence/upload'",
    patterns: [
      'requireFinanceRole(req, res)',
      'resolveFinanceRouteActorUserId(req)',
      'generateKey(`allocations/${actorUserId}`',
      'persistFinanceEvidencePendingUpload',
    ],
  },
  {
    name: 'admin allocation evidence delete rejects raw key deletes',
    source: 'admin',
    anchor: "app.post('/api/allocations/evidence/delete'",
    patterns: [
      'requireFinanceRole(req, res)',
      'ensureFinanceEvidenceObjectAccess',
      'finance_evidence_in_use',
      'DELETE FROM pending_uploads',
    ],
  },
  {
    name: 'admin allocation evidence presign requires DB or owned pending scope',
    source: 'admin',
    anchor: "app.post('/api/allocations/evidence/presign-download'",
    patterns: [
      'requireFinanceRole(req, res)',
      'ensureFinanceEvidenceObjectAccess',
      'presignGet',
    ],
  },
  {
    name: 'admin document presign validates document/payment scope',
    source: 'admin',
    anchor: "app.get('/api/documents/:id/presign-download'",
    patterns: [
      'validateDocumentAccess(req, doc)',
      'validatePaymentPacketDocumentAccess',
      'presignGet',
    ],
  },
  {
    name: 'admin applicant document list requires scoped applicant context',
    source: 'admin',
    anchor: "app.get('/api/applicants/:id/documents'",
    patterns: [
      'validateApplicantDocumentContextAccess',
      'requireScopedContext: true',
    ],
  },
  {
    name: 'admin case document list validates case access',
    source: 'admin',
    anchor: "app.get('/api/cases/:id/documents'",
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
    ],
  },
  {
    name: 'admin message attachments validate message and case scope before presign/adoption',
    source: 'admin',
    anchor: "app.get('/api/admin/messages/:id/attachments'",
    patterns: [
      'resolveCaseSecureMessageAccess',
      'attachment_case_scope_mismatch',
      'attachment_client_scope_mismatch',
      'presignGet',
    ],
    after: 12000,
  },
  {
    name: 'admin case event feed validates case access',
    source: 'admin',
    anchor: "app.get('/api/cases/:case_id/events'",
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
      'getCaseEvents',
    ],
  },
  {
    name: 'admin case watch list/create/delete validates case access',
    source: 'admin',
    anchor: "app.get('/api/me/case-watches'",
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
      "app.post('/api/cases/:caseId/watch'",
      "app.delete('/api/cases/:caseId/watch'",
    ],
    after: 16000,
  },
  {
    name: 'admin application detail validates application case scope',
    source: 'admin',
    anchor: "app.get('/api/applications/:id'",
    patterns: [
      'enforceApplicationVisibility(req, applicationId)',
      'sendApplicationVisibilityFailure',
    ],
  },
  {
    name: 'admin application version reads validate application case scope',
    source: 'admin',
    anchor: "app.get('/api/applications/:id/versions'",
    patterns: [
      'enforceApplicationVisibility(req, applicationId, connection)',
      'sendApplicationVisibilityFailure',
    ],
    after: 9000,
  },
  {
    name: 'admin application version save validates scope before lock/write',
    source: 'admin',
    anchor: "app.post('/api/applications/:id/versions'",
    patterns: [
      'enforceApplicationVisibility(req, applicationId, connection)',
      'enforceApplicationLock',
      'readApplicationPayload',
    ],
  },
  {
    name: 'admin application version restore validates scope before lock/write',
    source: 'admin',
    anchor: "app.post('/api/applications/:id/versions/:versionId/restore'",
    patterns: [
      'enforceApplicationVisibility(req, applicationId, connection)',
      'enforceApplicationLock',
      'readApplicationPayload',
    ],
  },
  {
    name: 'admin application locks validate application case scope',
    source: 'admin',
    anchor: "app.post('/api/locks/application/:id'",
    patterns: [
      'enforceApplicationVisibility(req, applicationId, connection)',
      "app.delete('/api/locks/application/:id'",
      'sendApplicationVisibilityFailure',
    ],
    after: 9000,
  },
  {
    name: 'admin escalations validate application and case scope',
    source: 'admin',
    anchor: "app.post('/api/escalations'",
    patterns: [
      'enforceApplicationVisibility(req, applicationId, conn)',
      "app.post('/api/escalations/:id/respond'",
      'enforceApplicationVisibility(req, escRow.application_id, conn)',
      'validateCaseAccessForCaseRow(req',
      'hasGlobalEscalationScope',
      'c.portfolio_region_id',
    ],
    after: 26000,
  },
  {
    name: 'admin case detail validates case access',
    source: 'admin',
    anchor: "app.get('/api/cases/:id'",
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
    ],
  },
  {
    name: 'admin case save validates case access',
    source: 'admin',
    anchor: "app.put('/api/cases/:id'",
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
      'enforceApplicationLock',
    ],
    after: 14000,
  },
  {
    name: 'admin legacy case assignment validates case access and assignment permission',
    source: 'admin',
    anchor: "app.patch('/api/cases/:id/assign'",
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
      'ensureCanAssignCase(identity, targetStaff)',
    ],
  },
  {
    name: 'admin post case assignment validates case access and assignment permission',
    source: 'admin',
    anchor: 'async function handleAssignmentRequest',
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
      'ensureCanAssignCase(identity, targetStaff)',
    ],
  },
  {
    name: 'admin case conflict actions validate case access',
    source: 'admin',
    anchor: "app.post('/api/cases/:id/conflicts/revoke'",
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
      "app.post('/api/cases/:id/conflicts/resolve'",
    ],
    after: 7000,
  },
  {
    name: 'admin ILMP and ready-to-close case mutations validate case access',
    source: 'admin',
    anchor: "app.post('/api/cases/:id/validate-ilmp'",
    patterns: [
      'validateCaseAccessByCaseId(req, caseId)',
      "app.post('/api/cases/:id/ready-to-close'",
      "app.post('/api/cases/:id/prepare-ilmp'",
    ],
    after: 9000,
  },
  {
    name: 'admin component template authoring requires step editor role',
    source: 'admin',
    anchor: "app.get('/api/component-templates'",
    patterns: [
      'ensureStepEditor(req, res)',
      "app.put('/api/component-templates/:id'",
      'ensureStepEditor(req, res)',
    ],
    after: 9000,
  },
  {
    name: 'admin component render endpoint requires step editor role',
    source: 'admin',
    anchor: "app.post('/api/render/component'",
    patterns: [
      'ensureStepEditor(req, res)',
    ],
  },
  {
    name: 'admin component parity-sample endpoint requires step editor role',
    source: 'admin',
    anchor: "app.get('/api/audit/parity-sample'",
    patterns: [
      'ensureStepEditor(req, res)',
    ],
  },
  {
    name: 'admin component parity-all endpoint requires step editor role',
    source: 'admin',
    anchor: "app.get('/api/audit/parity-all'",
    patterns: [
      'ensureStepEditor(req, res)',
    ],
  },
  {
    name: 'admin component parity-portal endpoint requires step editor role',
    source: 'admin',
    anchor: "app.get('/api/audit/parity-portal'",
    patterns: [
      'ensureStepEditor(req, res)',
    ],
  },
  {
    name: 'admin component template audit endpoint requires step editor role',
    source: 'admin',
    anchor: "app.get('/api/audit/component-templates'",
    patterns: [
      'ensureStepEditor(req, res)',
    ],
  },
  {
    name: 'admin workflow detail and mutations require step editor role',
    source: 'admin',
    anchor: "app.get('/api/workflows/:id'",
    patterns: [
      'ensureStepEditor(req, res)',
      "app.post('/api/workflows'",
      "app.put('/api/workflows/:id'",
      "app.delete('/api/workflows/:id'",
      "app.get('/api/workflows/:id/preview'",
      "app.get('/api/workflows/:id/validate'",
    ],
    after: 13000,
  },
  {
    name: 'query editor server export lists only the active environment database',
    source: 'admin',
    anchor: 'async function queryEditorListExportDatabases',
    patterns: [
      'queryEditorResolveAllowedExportDatabaseName',
      'QUERY_EDITOR_EXPORT_EXCLUDED_SCHEMAS',
      'WHERE schema_name = ?',
    ],
  },
  {
    name: 'query editor server export rejects non-active database selection',
    source: 'admin',
    anchor: 'async function queryEditorBuildExportMetadata',
    patterns: [
      'database_not_allowed',
      'Server export is limited to the active PATH database',
    ],
  },
  {
    name: 'query editor export routes require sysadmin and validated selection',
    source: 'admin',
    anchor: "app.get('/api/admin/query-editor/export-metadata'",
    patterns: [
      'sysAdminOnly(req)',
      'queryEditorBuildExportMetadata(req.query?.database',
      "app.post('/api/admin/query-editor/export'",
      'queryEditorValidateExportSelection',
      'queryEditorRunServerExport',
    ],
    after: 5000,
  },
  {
    name: 'generated consent PDF validates application visibility',
    source: 'admin',
    anchor: "app.post('/api/consent-letter/pdf'",
    patterns: [
      'requireGeneratedPdfApplicationAccess(req, res, applicationId)',
      'scopedApplicationId',
    ],
  },
  {
    name: 'generated authorization PDF validates application visibility',
    source: 'admin',
    anchor: "app.post('/api/authorization-release/pdf'",
    patterns: [
      'requireGeneratedPdfApplicationAccess(req, res, applicationId)',
      'scopedApplicationId',
    ],
  },
  {
    name: 'generated client acknowledgement PDF validates application visibility',
    source: 'admin',
    anchor: "app.post('/api/client-acknowledgement/pdf'",
    patterns: [
      'requireGeneratedPdfApplicationAccess(req, res, applicationId)',
      'scopedApplicationId',
    ],
  },
  {
    name: 'generated Indigenous declaration PDF validates application visibility',
    source: 'admin',
    anchor: "app.post('/api/indigenous-declaration/pdf'",
    patterns: [
      'requireGeneratedPdfApplicationAccess(req, res, applicationId)',
      'scopedApplicationId',
    ],
  },
  {
    name: 'generated conflict declaration PDF validates application visibility',
    source: 'admin',
    anchor: "app.post('/api/conflict-declaration/pdf'",
    patterns: [
      'requireGeneratedPdfApplicationAccess(req, res, applicationId)',
      'scopedApplicationId',
    ],
  },
  {
    name: 'legacy blockstep routes require unsafe debug gate',
    source: 'admin',
    anchor: "app.get('/api/blocksteps/:id'",
    patterns: [
      'requireUnsafeAdminDebugAccess',
      "app.get('/api/blocksteps', requireUnsafeAdminDebugAccess",
      "app.post('/api/blocksteps', requireUnsafeAdminDebugAccess",
      "app.put('/api/blocksteps/:id', requireUnsafeAdminDebugAccess",
      "app.delete('/api/blocksteps/:id', requireUnsafeAdminDebugAccess",
    ],
    after: 5000,
  },
  {
    name: 'legacy static Nunjucks generator requires unsafe debug gate',
    source: 'admin',
    anchor: "app.post('/api/generate-static-njk-template'",
    patterns: [
      'requireUnsafeAdminDebugAccess',
    ],
  },
  {
    name: 'legacy raw Nunjucks renderer requires unsafe debug gate',
    source: 'admin',
    anchor: "app.post('/api/render-njk'",
    patterns: [
      'requireUnsafeAdminDebugAccess',
    ],
  },
  {
    name: 'admin feedback attachment URLs are generated from report detail rows only',
    source: 'admin',
    anchor: 'async function loadAdminFeedbackReportDetail',
    patterns: [
      'FROM admin_feedback_attachment',
      'WHERE report_id = ?',
      'presignObjectStoreDownloadUrl(row.storageKey)',
    ],
    after: 6500,
  },
  {
    name: 'admin feedback report detail requires System Administrator',
    source: 'admin',
    anchor: "app.get('/api/admin/feedback-reports/:id'",
    patterns: [
      "inferUserRole(req) !== 'System Administrator'",
      'loadAdminFeedbackReportDetail(reportId)',
    ],
  },
  {
    name: 'admin AI chat blocks sensitive content before external model call',
    source: 'admin',
    anchor: "app.post('/api/ai/chat'",
    patterns: [
      'adminAiMessagesContainSensitiveContent(safeMessages)',
      'detectAdminAiExternalSensitiveContent(JSON.stringify(chatContext)',
      "error: 'sensitive_ai_content'",
      "axios.post('https://openrouter.ai/api/v1/chat/completions'",
    ],
  },
  {
    name: 'admin AI dummy draft generator requires unsafe debug gate and sensitive guidance block',
    source: 'admin',
    anchor: "app.post('/api/ai/create-dummy-draft'",
    patterns: [
      "app.post('/api/ai/create-dummy-draft', requireUnsafeAdminDebugAccess",
      'detectAdminAiExternalSensitiveContent(additionalRequestDetails)',
    ],
  },
  {
    name: 'admin legacy dummy draft generator requires unsafe debug gate',
    source: 'admin',
    anchor: "app.post('/api/create-dummy-draft'",
    patterns: [
      "app.post('/api/create-dummy-draft', requireUnsafeAdminDebugAccess",
    ],
  },
  {
    name: 'admin AI dummy case payments generator requires unsafe debug gate and sensitive guidance block',
    source: 'admin',
    anchor: "app.post('/api/ai/create-dummy-case-payments'",
    patterns: [
      "app.post('/api/ai/create-dummy-case-payments', requireUnsafeAdminDebugAccess",
      'detectAdminAiExternalSensitiveContent(additionalRequestDetails)',
    ],
  },
  {
    name: 'admin denial letter drafts use local templates instead of external AI',
    source: 'coordinator',
    anchor: 'if (isDenialDraft && denialTemplateDraft)',
    patterns: [
      "letter_title: 'Letter of Denial'",
      "decision_label: 'Denied'",
      'return;',
    ],
    after: 2500,
  },
  {
    name: 'admin denial letter draft modal no longer presents external AI drafting',
    source: 'coordinator',
    anchor: 'header="Denial reason for draft"',
    patterns: [
      'iconName="edit"',
      'Draft letter',
    ],
  },
  {
    name: 'notification templates require System or NWAC administrator access',
    source: 'admin',
    anchor: "app.get('/api/templates'",
    patterns: [
      'requireNotificationConfigAccess(req, res)',
      "app.get('/api/templates/:templateId'",
      "app.post('/api/templates/:templateId'",
      "app.delete('/api/templates/:templateId'",
    ],
    after: 8000,
  },
  {
    name: 'notification settings and sender config require System or NWAC administrator access',
    source: 'admin',
    anchor: "app.get('/api/config/notifications/email-settings'",
    patterns: [
      'requireNotificationConfigAccess(req, res)',
      "app.patch('/api/config/notifications/email-settings'",
      "app.get('/api/notifications'",
      "app.post('/api/notifications'",
      "app.delete('/api/notifications/:id'",
    ],
    after: 6500,
  },
  {
    name: 'legacy generic shared-user list endpoint is retired',
    source: 'admin',
    anchor: "app.get('/api/users', async (_req, res)",
    patterns: [
      "error: 'retired_endpoint'",
      'Use /api/admin/users for staff administration',
    ],
  },
  {
    name: 'legacy generic shared-user detail endpoint is retired',
    source: 'admin',
    anchor: "app.get('/api/users/:id'",
    patterns: [
      "error: 'retired_endpoint'",
      'Use scoped staff/applicant account APIs instead of shared-user lookup.',
    ],
  },
  {
    name: 'public AI support scans prompt and history for sensitive data before model call',
    source: 'portal',
    anchor: "app.post('/api/ai-support'",
    patterns: [
      'const history = sanitizeAiSupportHistory(req.body?.history)',
      'detectSensitiveAiSupportPrompt(prompt, history)',
      "return res.status(400).json({ error: 'sensitive_prompt'",
      "fetch('https://openrouter.ai/api/v1/chat/completions'",
    ],
    after: 5200,
  },
  {
    name: 'public document presign is owned by current applicant user',
    source: 'portal',
    anchor: "app.get('/api/documents/:id/presign-download'",
    patterns: [
      'row.user_id !== userId',
      'presignGet',
    ],
  },
  {
    name: 'public message detail validates applicant message access',
    source: 'portal',
    anchor: "app.get('/api/messages/:id'",
    patterns: [
      'resolveApplicantMessageAccess',
      'applicantMessageParticipantPredicate',
      'mi.owner_user_id = ?',
    ],
  },
  {
    name: 'public message read/delete/replied mutations validate applicant message access',
    source: 'portal',
    anchor: "app.put('/api/messages/:id/read'",
    patterns: [
      'resolveApplicantMessageAccess',
      "app.delete('/api/messages/:id'",
      "app.put('/api/messages/:id/replied'",
    ],
    after: 22000,
  },
  {
    name: 'public message sends derive scoped outbound target',
    source: 'portal',
    anchor: "app.post('/api/messages/reply-with-attachments'",
    patterns: [
      'resolveApplicantOutboundMessageTarget',
      'resolveClientIdForMessageScope',
      'consumePendingUpload',
    ],
  },
  {
    name: 'public staff profile resolution from shared user is sub-only',
    source: 'portal',
    anchor: 'async function resolveStaffProfileIdForUserId',
    patterns: [
      'SELECT cognito_sub FROM user WHERE id = ? LIMIT 1',
      'SELECT id FROM staff_profiles WHERE cognito_sub = ? ORDER BY id ASC LIMIT 1',
    ],
    forbidden: [
      'SELECT id FROM staff_profiles WHERE LOWER(email) = LOWER(?)',
    ],
    after: 1600,
  },
  {
    name: 'public secure-message display names do not staff-map by email',
    source: 'portal',
    anchor: 'async function resolveSecureMessageUserDisplayName',
    patterns: [
      'SELECT name, email, cognito_sub FROM user WHERE id = ? LIMIT 1',
      'SELECT display_name, name FROM staff_profiles WHERE cognito_sub = ? LIMIT 1',
    ],
    forbidden: [
      'SELECT display_name, name FROM staff_profiles WHERE LOWER(email) = LOWER(?) LIMIT 1',
    ],
    after: 2600,
  },
  {
    name: 'public signing creator display lookup is sub-only',
    source: 'portal',
    anchor: 'async function resolveCaseManagerSignatureNameForSignedCfa',
    patterns: [
      'SELECT name, email, cognito_sub FROM user WHERE id = ? LIMIT 1',
      'SELECT display_name, name FROM staff_profiles WHERE cognito_sub = ? LIMIT 1',
    ],
    forbidden: [
      'SELECT display_name, name FROM staff_profiles WHERE LOWER(email) = LOWER(?) LIMIT 1',
    ],
    after: 3200,
  },
  {
    name: 'admin staff profile resolution from shared user is sub-only',
    source: 'admin',
    anchor: 'async function findStaffProfileIdByUserId',
    patterns: [
      'SELECT cognito_sub FROM user WHERE id = ? LIMIT 1',
      'SELECT id FROM staff_profiles WHERE cognito_sub = ? LIMIT 1',
    ],
    forbidden: [
      'SELECT id FROM staff_profiles WHERE LOWER(email) = LOWER(?)',
    ],
    after: 1600,
  },
  {
    name: 'admin funding agreement creator display lookup is sub-only',
    source: 'admin',
    anchor: 'async function resolveFundingAgreementCaseManager',
    patterns: [
      'SELECT email, name, cognito_sub',
      'WHERE cognito_sub = ?',
    ],
    forbidden: [
      'WHERE LOWER(email) = LOWER(?)',
    ],
    after: 4200,
  },
  {
    name: 'public signing request detail/sign limited to participant user',
    source: 'portal',
    anchor: "app.get('/api/signing-requests/:id'",
    patterns: [
      'row.participant_user_id !== Number(userId)',
      "app.post('/api/signing-requests/:id/sign'",
      'row.participant_user_id !== Number(userId)',
    ],
    after: 9000,
  },
  {
    name: 'admin signing request detail/sign limited to participant user',
    source: 'admin',
    anchor: "app.get('/api/signing-requests/:id'",
    patterns: [
      'row.participant_user_id !== userId',
      "app.post('/api/signing-requests/:id/sign'",
      'row.participant_user_id !== userId',
    ],
    after: 10000,
  },
];

function runChecks() {
  return checks.map(check => {
    const source = sources[check.source];
    const snippet = extractWindow(source, check.anchor, { after: check.after || 5000 });
    if (!snippet) {
      return {
        name: check.name,
        pass: false,
        missing: [`anchor not found: ${check.anchor}`],
      };
    }
    const missing = containsAll(snippet, check.patterns);
    const forbidden = containsForbidden(snippet, check.forbidden);
    return {
      name: check.name,
      pass: missing.length === 0 && forbidden.length === 0,
      missing,
      forbidden,
    };
  });
}

const results = runChecks();
const failed = results.filter(result => !result.pass);

if (jsonMode) {
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
} else {
  for (const result of results) {
    const prefix = result.pass ? 'PASS' : 'FAIL';
    console.log(`${prefix} ${result.name}`);
    if (!result.pass) {
      result.missing.forEach(item => console.log(`  missing: ${item}`));
      result.forbidden.forEach(item => console.log(`  forbidden: ${item}`));
    }
  }
  console.log(failed.length === 0 ? 'Privacy route-scope smoke passed.' : 'Privacy route-scope smoke failed.');
}

process.exit(failed.length ? 1 : 0);
