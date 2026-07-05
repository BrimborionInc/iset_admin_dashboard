const {
  pool,
  startInterventionReviewWorkflow,
  generateAndStoreRevisionAssessmentPdf,
  fetchInterventionWithCase,
  REVIEW_WORKFLOW_TYPES,
} = require('/opt/nwac/admin-dashboard/isetadminserver.js');

const TARGET = Object.freeze({
  feedbackId: 148,
  caseId: 16,
  actionPlanId: 71,
  sourceInterventionId: 154,
  revisionInterventionId: 198,
  proposalId: 320,
  actorStaffProfileId: 55,
});

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function normaliseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function documentInfo(row) {
  const metadata = parseJson(row.metadata, {}) || {};
  return {
    id: normaliseNumber(row.id),
    label: row.label || null,
    status: row.status || null,
    filePath: row.file_path || null,
    documentCategory: row.document_category || null,
    documentType: metadata.document_type || metadata.documentType || row.document_category || null,
    versionNumber: normaliseNumber(metadata.assessment_version_number ?? metadata.versionNumber ?? metadata.version_number),
    previousVersionNumber: normaliseNumber(
      metadata.assessment_previous_version_number ?? metadata.previousVersionNumber ?? metadata.previous_version_number
    ),
    assessmentVariant: metadata.assessment_variant || metadata.variant || null,
    assessmentSource: metadata.assessment_source || null,
    interventionId: normaliseNumber(metadata.intervention_id),
    sourceInterventionId: normaliseNumber(metadata.source_intervention_id),
    hasSnapshot: Boolean(metadata.assessment_snapshot && typeof metadata.assessment_snapshot === 'object'),
  };
}

(async function repairFeedback148() {
  const result = {
    target: TARGET,
    workflow: null,
    pdf: null,
    generatedDocuments: [],
  };
  const repairedAt = new Date().toISOString();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[feedback]] = await connection.query(
      `SELECT id, status, submitted_by_email, page_url
         FROM admin_feedback_report
        WHERE id = ?
        LIMIT 1
        FOR UPDATE`,
      [TARGET.feedbackId]
    );
    if (!feedback) fail('feedback report not found');
    if (feedback.status !== 'in_progress') fail('feedback report status changed', feedback);
    if (feedback.submitted_by_email !== 'emarion@nwac.ca') fail('feedback submitter mismatch', feedback);
    if (!String(feedback.page_url || '').endsWith('/cases/16')) fail('feedback page mismatch', feedback);

    const [[actor]] = await connection.query(
      `SELECT id, display_name, primary_role
         FROM staff_profiles
        WHERE id = ?
        LIMIT 1`,
      [TARGET.actorStaffProfileId]
    );
    if (!actor) fail('actor staff profile not found');
    if (actor.primary_role !== 'Regional Manager') fail('actor role mismatch', actor);

    const [[revision]] = await connection.query(
      `SELECT
         ci.id AS intervention_id,
         ci.case_id,
         ci.action_plan_id,
         ci.status AS intervention_status,
         ci.delivery_status,
         ci.created_by_staff_profile_id,
         ci.updated_at AS intervention_updated_at,
         p.id AS proposal_id,
         p.proposal_kind,
         p.review_status,
         p.source_intervention_id,
         p.submitted_by_staff_profile_id,
         p.submitted_at AS proposal_submitted_at
       FROM iset_case_intervention ci
       JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
      WHERE ci.id = ?
      LIMIT 1
      FOR UPDATE`,
      [TARGET.revisionInterventionId]
    );
    if (!revision) fail('revision intervention/proposal not found');
    if (Number(revision.case_id) !== TARGET.caseId) fail('revision case mismatch', revision);
    if (Number(revision.action_plan_id) !== TARGET.actionPlanId) fail('revision action plan mismatch', revision);
    if (revision.intervention_status !== 'submitted') fail('revision intervention status changed', revision);
    if (Number(revision.created_by_staff_profile_id) !== TARGET.actorStaffProfileId) fail('revision creator mismatch', revision);
    if (Number(revision.proposal_id) !== TARGET.proposalId) fail('proposal mismatch', revision);
    if (revision.proposal_kind !== 'revision') fail('proposal kind mismatch', revision);
    if (revision.review_status !== 'submitted') fail('proposal review status changed', revision);
    if (Number(revision.source_intervention_id) !== TARGET.sourceInterventionId) fail('proposal source mismatch', revision);
    if (Number(revision.submitted_by_staff_profile_id) !== TARGET.actorStaffProfileId) fail('proposal submitter mismatch', revision);

    const [[source]] = await connection.query(
      `SELECT id, case_id, action_plan_id, status
         FROM iset_case_intervention
        WHERE id = ?
        LIMIT 1`,
      [TARGET.sourceInterventionId]
    );
    if (!source) fail('source intervention not found');
    if (Number(source.case_id) !== TARGET.caseId) fail('source case mismatch', source);
    if (Number(source.action_plan_id) !== TARGET.actionPlanId) fail('source action plan mismatch', source);
    if (source.status !== 'approved') fail('source status changed', source);

    const [workflowRows] = await connection.query(
      `SELECT id, workflow_type, subject_key, current_stage, current_owner_role
         FROM iset_review_workflow
        WHERE archived_at IS NULL
          AND (case_id = ? OR intervention_id IN (?, ?) OR proposal_id = ?)
        FOR UPDATE`,
      [TARGET.caseId, TARGET.revisionInterventionId, TARGET.sourceInterventionId, TARGET.proposalId]
    );
    if (workflowRows.length) fail('unexpected existing workflow rows', workflowRows);

    const [beforeDocs] = await connection.query(
      `SELECT id, label, status, file_path, document_category, metadata
         FROM iset_document
        WHERE case_id = ?
          AND document_category IN ('case_assessment', 'case_assessment_approved', 'case_assessment_redline')
        ORDER BY id
        FOR UPDATE`,
      [TARGET.caseId]
    );
    const beforeDocInfo = beforeDocs.map(documentInfo);
    const submittedV1 = beforeDocInfo.find(
      doc => doc.documentType === 'case_assessment' && doc.versionNumber === 1 && doc.status === 'active' && doc.hasSnapshot
    );
    if (!submittedV1) fail('active submitted v1 assessment with snapshot not found', beforeDocInfo);

    const existingRevisionDocs = beforeDocInfo.filter(
      doc =>
        doc.status === 'active' &&
        (doc.documentType === 'case_assessment' || doc.documentType === 'case_assessment_redline') &&
        (doc.versionNumber >= 2 || doc.interventionId === TARGET.revisionInterventionId)
    );
    if (existingRevisionDocs.length) fail('revision assessment docs already exist', existingRevisionDocs);

    const workflow = await startInterventionReviewWorkflow(connection, {
      workflowType: REVIEW_WORKFLOW_TYPES.InterventionRevision,
      caseId: TARGET.caseId,
      actionPlanId: TARGET.actionPlanId,
      interventionId: TARGET.revisionInterventionId,
      proposalId: TARGET.proposalId,
      actorStaffProfileId: TARGET.actorStaffProfileId,
      actorRole: 'Regional Manager',
      metadata: {
        source: 'prod_feedback_148_repair',
        feedbackReportId: TARGET.feedbackId,
        repairedAt,
        reason: 'Backfill missing RM review workflow for a revision submitted before RM submit-start was enabled for intervention revisions.',
      },
    });
    if (!workflow || workflow.current_stage !== 'rm_review' || workflow.current_owner_role !== 'Regional Manager') {
      fail('workflow did not start in RM review', workflow || {});
    }
    result.workflow = {
      id: workflow.id,
      workflowType: workflow.workflow_type,
      subjectKey: workflow.subject_key,
      currentStage: workflow.current_stage,
      currentOwnerRole: workflow.current_owner_role,
    };

    const revisionRow = await fetchInterventionWithCase(TARGET.revisionInterventionId, connection, { forUpdate: true });
    const sourceRow = await fetchInterventionWithCase(TARGET.sourceInterventionId, connection);
    if (!revisionRow || !sourceRow) fail('failed to reload intervention rows for pdf generation');

    const pdf = await generateAndStoreRevisionAssessmentPdf({
      caseId: TARGET.caseId,
      sourceInterventionRow: sourceRow,
      revisionInterventionRow: revisionRow,
      actorUserId: null,
      submittedSignature: {
        signerName: actor.display_name || 'Emilie Marion',
        signedAt: toIso(revision.proposal_submitted_at || revision.intervention_updated_at) || repairedAt,
      },
      connection,
    });
    if (!pdf || Number(pdf.versionNumber) !== 2 || Number(pdf.previousVersionNumber) !== 1) {
      fail('unexpected pdf generation result', pdf || {});
    }
    result.pdf = pdf;

    const [afterDocs] = await connection.query(
      `SELECT id, label, status, file_path, document_category, metadata
         FROM iset_document
        WHERE case_id = ?
          AND document_category IN ('case_assessment', 'case_assessment_redline')
        ORDER BY id
        FOR UPDATE`,
      [TARGET.caseId]
    );
    const afterDocInfo = afterDocs.map(documentInfo);
    const submittedV2 = afterDocInfo.find(
      doc =>
        doc.status === 'active' &&
        doc.documentType === 'case_assessment' &&
        doc.versionNumber === 2 &&
        doc.interventionId === TARGET.revisionInterventionId &&
        doc.sourceInterventionId === TARGET.sourceInterventionId &&
        doc.hasSnapshot
    );
    const redlineV2 = afterDocInfo.find(
      doc =>
        doc.status === 'active' &&
        doc.documentType === 'case_assessment_redline' &&
        doc.versionNumber === 2 &&
        doc.previousVersionNumber === 1 &&
        doc.interventionId === TARGET.revisionInterventionId &&
        doc.sourceInterventionId === TARGET.sourceInterventionId &&
        doc.hasSnapshot
    );
    if (!submittedV2 || !redlineV2) fail('generated v2 submitted/redline docs not found', afterDocInfo);
    result.generatedDocuments = [submittedV2, redlineV2];

    await connection.commit();
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}
    console.error(JSON.stringify({ ok: false, error: error.message, details: error.details || null }, null, 2));
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
})();
