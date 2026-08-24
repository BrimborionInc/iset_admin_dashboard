const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.resolve(__dirname, '../../../isetadminserver.js'),
  'utf8'
);
const assessmentWidgetSource = fs.readFileSync(
  path.resolve(__dirname, '../../widgets/CoordinatorAssessmentWidget.js'),
  'utf8'
);
const caseWorkspaceContextSource = fs.readFileSync(
  path.resolve(__dirname, '../../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx'),
  'utf8'
);

function sourceSlice(startMarker, endMarker) {
  const start = serverSource.indexOf(startMarker);
  const end = serverSource.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

function asyncFunctionSource(name) {
  const startMarker = `async function ${name}`;
  const start = serverSource.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf('\nasync function ', start + startMarker.length);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe('core repeat-application workflow isolation', () => {
  test('ILMP invalidation supports exact Action Plan and application owners', () => {
    const submissionInvalidator = asyncFunctionSource('markEsdcParticipantSubmissionNeedsReview');
    const planInvalidator = asyncFunctionSource('markIlmpNeedsReviewForActionPlan');
    const applicationInvalidator = asyncFunctionSource('markIlmpNeedsReviewForApplication');

    expect(submissionInvalidator).toContain('const numericActionPlanId = normalisePositiveInteger(actionPlanId)');
    expect(submissionInvalidator).toContain('const numericApplicationId = normalisePositiveInteger(applicationId)');
    expect(submissionInvalidator).toContain("throw new Error('ilmp_invalidation_scope_required')");
    expect(submissionInvalidator).toContain('eps.action_plan_id = ?');
    expect(submissionInvalidator).toContain('eps.application_id = ?');
    expect(planInvalidator).toContain('actionPlanId: numericActionPlanId');
    expect(planInvalidator).toContain('setInterventionComplianceForActionPlan(');
    expect(applicationInvalidator).toContain('applicationId: numericApplicationId');
    expect(applicationInvalidator).toContain('setInterventionComplianceForApplication(');
  });

  test('source edits invalidate validation without erasing submitted ILMP evidence', () => {
    const submissionInvalidator = sourceSlice(
      'async function markEsdcParticipantSubmissionNeedsReview',
      "const { ILMP_PARTICIPANT_RULES, PROVINCE_CODES }"
    );
    const planCompliance = asyncFunctionSource('setInterventionComplianceForActionPlan');
    const applicationCompliance = asyncFunctionSource('setInterventionComplianceForApplication');

    expect(submissionInvalidator).not.toContain("submission_status = 'pending'");
    expect(submissionInvalidator).not.toContain('payload_snapshot = NULL');
    expect(submissionInvalidator).not.toContain('payload_storage_key = NULL');
    expect(submissionInvalidator).not.toContain('submitted_at = NULL');
    expect(submissionInvalidator).not.toContain('try {');
    expect(planCompliance).not.toContain('catch (err)');
    expect(applicationCompliance).not.toContain('catch (err)');
  });

  test('plan and intervention writers never use the case-wide ILMP invalidator', () => {
    const workflowRoutes = sourceSlice(
      "app.post('/api/cases/:id/action-plans'",
      "app.get('/api/cases/:id'"
    );

    expect(workflowRoutes).not.toContain('await markIlmpNeedsReviewForCase(');
    expect(workflowRoutes).toContain('await markIlmpNeedsReviewForActionPlan(');
    expect(workflowRoutes).toContain('await markIlmpNeedsReviewForActionPlans(');
    expect(serverSource).not.toContain('async function markIlmpNeedsReviewForCase');
  });

  test('selected-application assessment edits invalidate only that application', () => {
    const assessmentRoute = sourceSlice(
      "app.put('/api/cases/:id'",
      '// --- Event timeline endpoints'
    );

    expect(assessmentRoute).toContain('await markIlmpNeedsReviewForApplication(');
    expect(assessmentRoute).not.toContain(
      'await markEsdcParticipantSubmissionNeedsReview(conn, caseId, { resetSnapshot: true, resetSubmissionStatus: true });'
    );
  });

  test('application queue producers enumerate every application on an assigned case', () => {
    for (const name of [
      'countProgramAdminNewSubmissions',
      'fetchApplicationSlaRowsForAssignedStaff',
      'fetchAllAssignedApplicationSlaRows',
      'countAssessorAwaitingApplicantResponse',
    ]) {
      const functionSource = asyncFunctionSource(name);
      expect(functionSource).toContain('FROM iset_application a');
      expect(functionSource).toContain('JOIN iset_case c ON c.id = a.case_id');
      expect(functionSource).not.toContain('buildCasePrimaryApplicationJoinSql');
    }
  });

  test('EI and closure queues enumerate exact applications, while intervention queues follow plan lineage', () => {
    for (const [route, nextRoute] of [
      ['/api/dashboard/ei-eligibility-items', '/api/dashboard/awaiting-approval-items'],
      ['/api/dashboard/marked-for-closure-items', '/api/dashboard/intervention-approval-items'],
    ]) {
      const routeSource = sourceSlice(`app.get('${route}'`, `app.get('${nextRoute}'`);
      expect(routeSource).toContain('FROM iset_application a');
      expect(routeSource).toContain('JOIN iset_case c ON c.id = a.case_id');
      expect(routeSource).not.toContain('buildCasePrimaryApplicationJoinSql');
    }

    const milestoneRoute = sourceSlice(
      "app.get('/api/dashboard/intervention-milestone-items'",
      "app.get('/api/dashboard/payment-proof-due-items'"
    );
    expect(milestoneRoute).toContain('ON ap.id = ci.action_plan_id');
    expect(milestoneRoute).toContain('ON a.id = ap.application_id');
    expect(milestoneRoute).not.toContain('buildCasePrimaryApplicationJoinSql');

    const paymentRoute = sourceSlice(
      "app.get('/api/dashboard/payment-proof-due-items'",
      "app.get('/api/dashboard/metrics'"
    );
    expect(paymentRoute).toContain('ON ap.id = ci.action_plan_id');
    expect(paymentRoute).toContain('ON a.id = ap.application_id');
    expect(paymentRoute).toContain('resolvePaymentPacketApplicationScope(packet.lines)');
    expect(paymentRoute).not.toContain('buildCasePrimaryApplicationJoinSql');
    expect(paymentRoute).toContain('applicationId: line?.applicationId || null');
  });

  test('role application buckets count applications rather than long-lived cases', () => {
    for (const name of [
      'countRegionalAssignedToRegion',
      'countRegionalNeedsReassignment',
      'countRegionalAwaitingApplicantInfo',
      'countAssessorAssignedToMe',
    ]) {
      const functionSource = asyncFunctionSource(name);
      expect(functionSource).toContain('COUNT(DISTINCT a.id)');
      expect(functionSource).toContain('JOIN iset_application a ON c.id = a.case_id');
    }
  });

  test('assessment recall cannot archive signing-owned or version-managed Financial Overviews', () => {
    const recallArchive = asyncFunctionSource('archiveRecalledAssessmentDocuments');

    expect(recallArchive).toContain('d.signing_request_id IS NULL');
    expect(recallArchive).toContain("JSON_EXTRACT(d.metadata, '$.funding_overview_version_id') IS NULL");
    expect(recallArchive).toContain('FROM funding_overview_version_documents vd');
    expect(recallArchive).toContain('vd.document_id = d.id');
  });

  test('denying one application defers case closure until aggregate state is derived', () => {
    const assessmentRoute = sourceSlice(
      "app.put('/api/cases/:id'",
      '// --- Event timeline endpoints'
    );
    const recompute = asyncFunctionSource('recomputeCaseStatus');

    expect(assessmentWidgetSource).toContain(
      "const nextCaseStatus = isOutcomeApproved ? 'initiated' : (isOutcomePushBack ? 'intake' : null);"
    );
    expect(assessmentWidgetSource).toContain('...(nextCaseStatus ? { status: nextCaseStatus } : {})');
    expect(assessmentRoute).toContain('deferTerminalCaseTransitionToApplicationAggregate');
    expect(assessmentRoute).toContain("Object.prototype.hasOwnProperty.call(body, 'applicationStatus')");
    expect(assessmentRoute).toContain('allowAggregateCaseReopen = true');
    expect(assessmentRoute).toContain(
      'allowReopenFinal: allowAggregateCaseReopen || staffApplicationReopenRequested'
    );
    expect(assessmentRoute).not.toContain('allowReopenFinal: Boolean(applicationStatusToPersist)');
    expect(recompute).toContain('REPORTING_ARTIFACT_METADATA_SOURCES');
    expect(recompute).toContain("JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source'))");
    expect(recompute.indexOf('} else if (openApplications > 0) {')).toBeGreaterThanOrEqual(0);
    expect(recompute.indexOf('} else if (openApplications > 0) {')).toBeLessThan(
      recompute.indexOf('} else if (closedPlans > 0) {')
    );
  });

  test('ILMP ensure and validation preserve existing submission evidence', () => {
    const ensureSubmission = asyncFunctionSource('ensureEsdcParticipantSubmissionRecord');
    const prepareSubmission = asyncFunctionSource('prepareEsdcParticipantSubmission');
    const loadContext = asyncFunctionSource('loadEsdcParticipantSubmissionContext');
    const mutableEvidenceGuard = sourceSlice(
      'function assertEsdcParticipantSubmissionCanRegenerateEvidence',
      'async function loadEsdcParticipantSubmissionContext'
    );

    expect(ensureSubmission).not.toContain('ON DUPLICATE KEY UPDATE');
    expect(ensureSubmission).not.toContain("submission_status = 'pending'");
    expect(ensureSubmission).not.toContain('payload_snapshot = NULL');
    expect(ensureSubmission).toContain("err?.code === 'ER_DUP_ENTRY'");
    expect(prepareSubmission).toContain('requireMutableEvidence: true');
    expect(loadContext).toContain('assertEsdcParticipantSubmissionCanRegenerateEvidence(submissionRow)');
    expect(mutableEvidenceGuard).toContain('esdc_submission_requeue_required');
    expect(loadContext).toContain('esdc_submission_case_scope_mismatch');
    expect(loadContext).toContain('esdc_action_plan_case_scope_mismatch');
    expect(loadContext).toContain('resolveUniqueApplicationIdForCase(conn, caseRow.id)');
    expect(loadContext).not.toContain('resolvePrimaryApplicationIdForCase(conn, caseRow.id)');
  });

  test('manual ILMP validation and preparation require exact or uniquely inferable application scope', () => {
    for (const endpoint of ['validate-ilmp', 'prepare-ilmp']) {
      const route = sourceSlice(
        `app.post('/api/cases/:id/${endpoint}'`,
        endpoint === 'validate-ilmp'
          ? "app.post('/api/cases/:id/ready-to-close'"
          : "app.get('/api/cases/:id/action-plan/context'"
      );
      expect(route).toContain(
        'requestedApplicationId || await resolveUniqueApplicationIdForCase(pool, caseId)'
      );
      expect(route).toContain('const submissionId = await ensureEsdcParticipantSubmissionRecord(');
      expect(route).not.toContain('findEsdcSubmissionIdForApplication(pool, caseId, targetApplicationId)');
      expect(route).not.toContain("buildCasePrimaryApplicationJoinSql('c', 'a')");
    }
  });

  test('grouped ILMP batches fail closed instead of borrowing another application context', () => {
    const groupedPayload = asyncFunctionSource('buildGroupedIlmpClientPayload');

    expect(groupedPayload).toContain('const batchOwnership = classifyIlmpBatchOwnership(contexts)');
    expect(groupedPayload).toContain('if (!batchOwnership.compatible)');
    expect(groupedPayload).toContain('action plans owned by different cases or applications');
    expect(groupedPayload.indexOf('classifyIlmpBatchOwnership(contexts)')).toBeLessThan(
      groupedPayload.indexOf('const combinedPlansRaw')
    );
  });

  test('decision-letter message owns sent-state persistence and returns the new row version', () => {
    const decisionPersistence = asyncFunctionSource('recordApplicationDecisionLetterSent');
    const messageHandler = sourceSlice(
      'const handlePostCaseSecureMessage = async (req, res) => {',
      "app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);"
    );

    expect(decisionPersistence).toContain('row_version = row_version + 1');
    expect(decisionPersistence).toContain('applicationRowVersion:');
    expect(messageHandler).toContain('expectedApplicationRowVersionNumber');
    expect(messageHandler).toContain('await recordApplicationDecisionLetterSent({');
    expect(messageHandler.indexOf('await recordApplicationDecisionLetterSent({')).toBeLessThan(
      messageHandler.indexOf('await commitCaseMessageWriteTransaction({')
    );
    expect(messageHandler).toContain('decisionLetterPersistence: decisionLetterPersistenceResult');
    expect(assessmentWidgetSource).toContain(
      'payload.expectedApplicationRowVersion = saved.updatedRowVersion'
    );
    expect(assessmentWidgetSource).toContain('if (letterResult.applicationCompleted)');
  });

  test('Application Workspace documents follow exact document or Action Plan ownership', () => {
    const documentRoute = sourceSlice(
      "app.get('/api/applicants/:id/documents'",
      "app.get('/api/cases/:id/documents'"
    );

    expect(documentRoute).toContain('(d.application_id = ? OR ap.application_id = ? OR (');
    expect(documentRoute).toContain("whereClauses.push('(d.application_id = ? OR ap.application_id = ?)')");
    expect(documentRoute).not.toContain("buildCasePrimaryApplicationIdSql('ac')} = ?");
  });

  test('reminders derive one coherent case, application, plan and intervention scope', () => {
    const resolver = asyncFunctionSource('resolveReminderTargetScope');
    const reminderCreate = sourceSlice(
      "app.post('/api/reminders'",
      "app.put('/api/reminders/:reminderId'"
    );

    expect(resolver).toContain('reminder_intervention_action_plan_scope_mismatch');
    expect(resolver).toContain('reminder_action_plan_application_scope_mismatch');
    expect(resolver).toContain('reminder_application_case_scope_mismatch');
    expect(resolver).toContain('resolvedApplicationId = planApplicationId');
    expect(reminderCreate).toContain('const targetResolution = await resolveReminderTargetScope');
    expect(reminderCreate).toContain('const reminderScope = targetResolution.scope');
    expect(caseWorkspaceContextSource).toContain(
      'applicationId: plan.applicationId ?? plan.application_id ?? null'
    );
  });

  test('secure-message reply and attachment actions keep the message application authoritative', () => {
    const accessResolver = asyncFunctionSource('resolveCaseSecureMessageAccess');
    const messageHandler = sourceSlice(
      'const handlePostCaseSecureMessage = async (req, res) => {',
      "app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);"
    );

    expect(accessResolver).toContain('applicationId: messageApplicationId');
    expect(accessResolver).toContain('message_application_scope_mismatch');
    expect(messageHandler).toContain('reply_message_application_scope_mismatch');
    expect(messageHandler).toContain(
      'lockedReplyTargetMessage = await lockAndValidateCaseMessageReplyTarget({'
    );
    expect(messageHandler).toContain('await applyCaseMessageReplyTargetStatus({');
    expect(messageHandler).toContain('replyTarget: lockedReplyTargetMessage');
    expect(messageHandler).toContain('reply_to_message_id: requestedReplyToId || null');
  });

  test('document and reminder notifications carry exact lineage without primary-app fallback', () => {
    const documentEvent = asyncFunctionSource('emitDocumentUploadedEvent');
    const reminderEvent = sourceSlice(
      'const emitReminderEvent = async',
      'const updateReminderMetadata = async'
    );

    expect(documentEvent).toContain('application_id: normalizedApplicationId');
    expect(documentEvent).toContain('action_plan_id: normalisePositiveInteger(actionPlanId)');
    expect(documentEvent).toContain('if (normalizedApplicationId)');
    expect(reminderEvent).toContain('application_id: reminder.applicationId || null');
    expect(reminderEvent).toContain('action_plan_id: reminder.actionPlanId || null');
    expect(reminderEvent).toContain('trackingId: null');
  });
});
