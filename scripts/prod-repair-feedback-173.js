#!/usr/bin/env node

const CASE_ID = 12;
const CLIENT_ID = 12;
const APPLICATION_ID = 95;
const ASSESSMENT_ID = 492;
const HISTORICAL_PLAN_ID = 36;
const HISTORICAL_INTERVENTION_IDS = [65, 119, 120];
const INCORRECT_CFA_SERIES_ID = 38;
const INCORRECT_CFA_VERSION_ID = 33;
const INCORRECT_UNSIGNED_DOCUMENT_ID = 8452;
const INCORRECT_SIGNED_DOCUMENT_ID = 8527;
const INCORRECT_SIGNING_REQUEST_ID = 148;
const CASE_MANAGER_STAFF_PROFILE_ID = 55;

const args = new Set(process.argv.slice(2));
const mode = args.has('--apply') ? 'apply' : args.has('--rollback') ? 'rollback' : 'preview';
const confirmationArg = process.argv.find(value => value.startsWith('--confirm='));
const confirmation = confirmationArg ? confirmationArg.slice('--confirm='.length) : '';

if (mode === 'apply' && confirmation !== 'PROD-FEEDBACK-173-CASE-12') {
  throw new Error('Apply requires --confirm=PROD-FEEDBACK-173-CASE-12');
}
if (mode === 'rollback' && confirmation !== 'ROLLBACK-PROD-FEEDBACK-173-CASE-12') {
  throw new Error('Rollback requires --confirm=ROLLBACK-PROD-FEEDBACK-173-CASE-12');
}

process.env.PATH_REPAIR_EXPORTS = '1';
process.env.ENABLE_DB_DIAG = 'false';

const {
  pool,
  createCfaVersionForPlan,
  ensureAutoPlanAndInterventionFromAssessment,
} = require('../isetadminserver');

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(`feedback_173_guard_failed:${message}`);
}

function sortedIds(rows) {
  return rows.map(row => Number(row.id)).sort((a, b) => a - b);
}

async function loadState(connection, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : '';
  const [[environment]] = await connection.query(
    'SELECT DATABASE() AS db, @@hostname AS host, @@port AS port, CURRENT_USER() AS mysql_user'
  );
  const [[caseRow]] = await connection.query(
    `SELECT id, client_id, assigned_staff_profile_id, status, lifecycle_status,
            case_context_json, open_intervention_count, total_intervention_count
       FROM iset_case
      WHERE id = ?${lock}`,
    [CASE_ID]
  );
  const [[applicationRow]] = await connection.query(
    `SELECT id, client_id, case_id, status, lifecycle_status, decision_outcome,
            awaiting_reason, closure_reason, row_version
       FROM iset_application
      WHERE id = ?${lock}`,
    [APPLICATION_ID]
  );
  const [[assessmentRow]] = await connection.query(
    `SELECT id, application_id, case_id, intervention_cost_total, recommendation,
            nwac_review, proposed_interventions
       FROM iset_application_assessment
      WHERE id = ?${lock}`,
    [ASSESSMENT_ID]
  );
  const [planRows] = await connection.query(
    `SELECT id, case_id, application_id, name, status, metadata_json
       FROM iset_case_action_plan
      WHERE case_id = ?
      ORDER BY id${lock}`,
    [CASE_ID]
  );
  const [interventionRows] = await connection.query(
    `SELECT id, case_id, action_plan_id, intervention_code, status, delivery_status,
            intervention_cost, metadata_json
       FROM iset_case_intervention
      WHERE case_id = ?
      ORDER BY id${lock}`,
    [CASE_ID]
  );
  const [cfaRows] = await connection.query(
    `SELECT s.case_id, s.template_key,
            v.id, v.series_id, v.version_number, v.status, v.supersedes_version_id,
            v.sent_at, v.signed_at, v.signed_by_participant_id, v.metadata_json
       FROM cfa_series s
       JOIN cfa_version v ON v.series_id = s.id
      WHERE s.case_id = ?
      ORDER BY v.version_number, v.id${lock}`,
    [CASE_ID]
  );
  const [cfaDocumentRows] = await connection.query(
    `SELECT cvd.cfa_version_id, cvd.document_type, cvd.document_id,
            d.case_id, d.application_id, d.signing_request_id, d.status
       FROM cfa_series s
       JOIN cfa_version v ON v.series_id = s.id
       JOIN cfa_version_documents cvd ON cvd.cfa_version_id = v.id
       JOIN iset_document d ON d.id = cvd.document_id
      WHERE s.case_id = ?
      ORDER BY v.version_number, cvd.document_type${lock}`,
    [CASE_ID]
  );
  const [incidentDocumentRows] = await connection.query(
    `SELECT id, case_id, application_id, signing_request_id, document_category,
            status, metadata
       FROM iset_document
      WHERE id IN (?, ?)
      ORDER BY id${lock}`,
    [INCORRECT_UNSIGNED_DOCUMENT_ID, INCORRECT_SIGNED_DOCUMENT_ID]
  );
  const [signingRows] = await connection.query(
    `SELECT id, case_id, participant_user_id, status, signed_at, checklist_doc_type,
            resolved_schema_json
       FROM signing_request
      WHERE case_id = ?
      ORDER BY id${lock}`,
    [CASE_ID]
  );
  const [esdcSubmissionRows] = await connection.query(
    `SELECT id, case_id, action_plan_id, application_id, readiness_status,
            submission_status, submitted_at, payload_snapshot
       FROM esdc_participant_submission
      WHERE case_id = ?
      ORDER BY id${lock}`,
    [CASE_ID]
  );
  const [[caseManager]] = await connection.query(
    `SELECT id, display_name, name, email
       FROM staff_profiles
      WHERE id = ?${lock}`,
    [CASE_MANAGER_STAFF_PROFILE_ID]
  );
  return {
    environment,
    caseRow,
    applicationRow,
    assessmentRow,
    planRows,
    interventionRows,
    cfaRows,
    cfaDocumentRows,
    incidentDocumentRows,
    signingRows,
    esdcSubmissionRows,
    caseManager,
  };
}

function validateBaseState(state) {
  assertCondition(state.environment?.db === 'iset_intake', 'unexpected_database');
  assertCondition(Number(state.caseRow?.id) === CASE_ID, 'case_missing');
  assertCondition(Number(state.caseRow?.client_id) === CLIENT_ID, 'case_client_mismatch');
  assertCondition(
    Number(state.caseRow?.assigned_staff_profile_id) === CASE_MANAGER_STAFF_PROFILE_ID,
    'case_manager_mismatch'
  );
  assertCondition(Number(state.applicationRow?.id) === APPLICATION_ID, 'application_missing');
  assertCondition(Number(state.applicationRow?.case_id) === CASE_ID, 'application_case_mismatch');
  assertCondition(Number(state.applicationRow?.client_id) === CLIENT_ID, 'application_client_mismatch');
  assertCondition(state.applicationRow?.decision_outcome === 'approved', 'application_not_approved');
  assertCondition(Number(state.assessmentRow?.id) === ASSESSMENT_ID, 'assessment_missing');
  assertCondition(Number(state.assessmentRow?.application_id) === APPLICATION_ID, 'assessment_application_mismatch');
  assertCondition(Number(state.assessmentRow?.case_id) === CASE_ID, 'assessment_case_mismatch');
  assertCondition(state.assessmentRow?.recommendation === 'recommend', 'assessment_recommendation_mismatch');
  assertCondition(state.assessmentRow?.nwac_review === 'agree', 'assessment_decision_mismatch');
  assertCondition(Number(state.assessmentRow?.intervention_cost_total) === 827, 'assessment_total_mismatch');
  const proposed = parseJson(state.assessmentRow?.proposed_interventions, []);
  assertCondition(Array.isArray(proposed) && proposed.length === 3, 'assessment_intervention_count_mismatch');

  const historicalPlan = state.planRows.find(row => Number(row.id) === HISTORICAL_PLAN_ID);
  assertCondition(historicalPlan, 'historical_plan_missing');
  assertCondition(historicalPlan.application_id == null, 'historical_plan_application_changed');
  assertCondition(historicalPlan.status === 'active', 'historical_plan_status_changed');
  assertCondition(
    parseJson(historicalPlan.metadata_json, {})?.source === 'manual_backload',
    'historical_plan_source_changed'
  );
  const historicalInterventions = state.interventionRows.filter(
    row => Number(row.action_plan_id) === HISTORICAL_PLAN_ID
  );
  assertCondition(
    JSON.stringify(sortedIds(historicalInterventions)) === JSON.stringify(HISTORICAL_INTERVENTION_IDS),
    'historical_interventions_changed'
  );
  assertCondition(
    historicalInterventions.every(row => row.status === 'completed' && row.delivery_status === 'completed'),
    'historical_intervention_status_changed'
  );
  assertCondition(Number(state.caseManager?.id) === CASE_MANAGER_STAFF_PROFILE_ID, 'case_manager_profile_missing');
}

function findApplicationPlan(state) {
  const rows = state.planRows.filter(
    row => Number(row.application_id) === APPLICATION_ID && row.status !== 'archived'
  );
  assertCondition(rows.length <= 1, 'multiple_application_plans');
  return rows[0] || null;
}

function validateApplicationPlan(state, plan) {
  assertCondition(plan, 'application_plan_missing');
  assertCondition(plan.status === 'draft', 'application_plan_not_draft');
  assertCondition(parseJson(plan.metadata_json, {})?.source === 'auto_assessment', 'application_plan_source_mismatch');
  const interventions = state.interventionRows.filter(
    row => Number(row.action_plan_id) === Number(plan.id)
  );
  assertCondition(interventions.length === 3, 'application_plan_intervention_count_mismatch');
  assertCondition(
    interventions.every(row => row.status === 'approved' && row.delivery_status === 'planned'),
    'application_plan_intervention_status_mismatch'
  );
  const proposed = parseJson(state.assessmentRow?.proposed_interventions, []);
  const proposedCodes = proposed
    .map(row => String(row?.code ?? row?.interventionCode ?? row?.intervention_code ?? '').trim())
    .filter(Boolean)
    .sort();
  const interventionCodes = interventions
    .map(row => String(row.intervention_code || '').trim())
    .filter(Boolean)
    .sort();
  assertCondition(
    JSON.stringify(interventionCodes) === JSON.stringify(proposedCodes),
    'application_plan_intervention_codes_mismatch'
  );
  const interventionTotal = interventions.reduce(
    (sum, row) => sum + (Number(row.intervention_cost) || 0),
    0
  );
  assertCondition(Math.abs(interventionTotal - 826.74) < 0.005, 'application_plan_intervention_total_mismatch');
  const esdcRows = state.esdcSubmissionRows.filter(
    row => Number(row.action_plan_id) === Number(plan.id)
  );
  assertCondition(esdcRows.length === 1, 'application_plan_esdc_submission_count_mismatch');
  assertCondition(
    Number(esdcRows[0].case_id) === CASE_ID &&
      Number(esdcRows[0].application_id) === APPLICATION_ID &&
      esdcRows[0].readiness_status === 'needs_review' &&
      esdcRows[0].submission_status === 'pending' &&
      !esdcRows[0].submitted_at &&
      !esdcRows[0].payload_snapshot,
    'application_plan_esdc_submission_scope_mismatch'
  );
  return interventions;
}

function findApplicationCfa(state, planId) {
  const matches = state.cfaRows.filter(row => {
    const snapshot = parseJson(row.metadata_json, {});
    return Number(snapshot?.plan?.id) === Number(planId);
  });
  assertCondition(matches.length <= 1, 'multiple_application_cfa_versions');
  return matches[0] || null;
}

function validateIncorrectAgreement(state) {
  const incorrectVersion = state.cfaRows.find(row => Number(row.id) === INCORRECT_CFA_VERSION_ID);
  assertCondition(incorrectVersion, 'incorrect_cfa_version_missing');
  assertCondition(Number(incorrectVersion.series_id) === INCORRECT_CFA_SERIES_ID, 'incorrect_cfa_series_changed');
  assertCondition(Number(incorrectVersion.case_id) === CASE_ID, 'incorrect_cfa_case_changed');
  assertCondition(incorrectVersion.template_key === 'ISET_CFA_STANDARD', 'incorrect_cfa_template_changed');
  assertCondition(Number(incorrectVersion.version_number) === 1, 'incorrect_cfa_version_number_changed');
  assertCondition(['sent', 'signed', 'withdrawn'].includes(incorrectVersion.status), 'incorrect_cfa_status_unexpected');
  const snapshot = parseJson(incorrectVersion.metadata_json, {});
  assertCondition(
    JSON.stringify((snapshot?.interventions || []).map(row => Number(row.id)).sort((a, b) => a - b)) ===
      JSON.stringify(HISTORICAL_INTERVENTION_IDS),
    'incorrect_cfa_snapshot_changed'
  );
  const incorrectSigning = state.signingRows.find(row => Number(row.id) === INCORRECT_SIGNING_REQUEST_ID);
  assertCondition(incorrectSigning?.status === 'signed', 'incorrect_cfa_signing_request_not_signed');
  assertCondition(incorrectSigning?.checklist_doc_type === 'funding_agreement', 'incorrect_signing_type_changed');
  const signingMeta = parseJson(incorrectSigning.resolved_schema_json, {})?.meta || {};
  assertCondition(Number(signingMeta.cfaVersionId) === INCORRECT_CFA_VERSION_ID, 'incorrect_signing_version_mismatch');
  const incidentDocumentIds = sortedIds(state.incidentDocumentRows);
  assertCondition(
    JSON.stringify(incidentDocumentIds) ===
      JSON.stringify([INCORRECT_UNSIGNED_DOCUMENT_ID, INCORRECT_SIGNED_DOCUMENT_ID]),
    'incorrect_cfa_documents_missing'
  );
  assertCondition(
    state.incidentDocumentRows.every(
      row => Number(row.case_id) === CASE_ID && Number(row.application_id) === APPLICATION_ID
    ),
    'incorrect_cfa_document_scope_mismatch'
  );
  const signedDocument = state.incidentDocumentRows.find(
    row => Number(row.id) === INCORRECT_SIGNED_DOCUMENT_ID
  );
  assertCondition(
    Number(signedDocument?.signing_request_id) === INCORRECT_SIGNING_REQUEST_ID,
    'incorrect_signed_document_request_mismatch'
  );
  const linkedIncorrectDocuments = state.cfaDocumentRows.filter(
    row => Number(row.cfa_version_id) === INCORRECT_CFA_VERSION_ID && row.document_type === 'clean'
  );
  assertCondition(linkedIncorrectDocuments.length === 1, 'incorrect_cfa_clean_link_count_mismatch');
  assertCondition(
    [INCORRECT_UNSIGNED_DOCUMENT_ID, INCORRECT_SIGNED_DOCUMENT_ID].includes(
      Number(linkedIncorrectDocuments[0].document_id)
    ),
    'incorrect_cfa_clean_link_mismatch'
  );
}

async function createOrReuseApplicationPlan() {
  let connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const state = await loadState(connection, { forUpdate: true });
    validateBaseState(state);
    validateIncorrectAgreement(state);
    const existingPlan = findApplicationPlan(state);
    if (existingPlan) {
      validateApplicationPlan(state, existingPlan);
      await connection.commit();
      return { planId: Number(existingPlan.id), interventionIds: null, reused: true };
    }
    assertCondition(state.applicationRow.status === 'completed', 'application_status_changed_before_apply');
    assertCondition(state.applicationRow.lifecycle_status === 'closed', 'application_lifecycle_changed_before_apply');
    const result = await ensureAutoPlanAndInterventionFromAssessment(connection, {
      caseId: CASE_ID,
      applicationId: APPLICATION_ID,
      caseRow: state.caseRow,
      approvalUserId: null,
      budgetPotId: null,
    });
    assertCondition(result?.createdPlan && result?.createdIntervention, 'application_plan_not_created');
    assertCondition(Array.isArray(result.interventionIds) && result.interventionIds.length === 3, 'new_intervention_count_mismatch');
    await connection.commit();
    return {
      planId: Number(result.planId),
      interventionIds: result.interventionIds.map(Number),
      reused: false,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

async function createOrReuseCorrectedCfa(planId) {
  const state = await loadState(pool);
  const existing = findApplicationCfa(state, planId);
  if (existing) {
    return { cfaVersionId: Number(existing.id), reused: true };
  }
  const caseManagerName =
    String(state.caseManager?.display_name || state.caseManager?.name || state.caseManager?.email || '').trim();
  assertCondition(caseManagerName, 'case_manager_name_missing');
  const created = await createCfaVersionForPlan({
    caseId: CASE_ID,
    actionPlanId: planId,
    changeReason: 'CORRECTION_AFTER_SEND',
    changeSummary: 'Corrected application funding agreement after invalid historical-plan carryover',
    actorUserId: null,
    staffProfileId: CASE_MANAGER_STAFF_PROFILE_ID,
    caseManagerName,
  });
  assertCondition(created?.cfaVersionId && !created?.skipped, 'corrected_cfa_not_created');
  return { cfaVersionId: Number(created.cfaVersionId), reused: false };
}

async function finalizeRecovery({ planId, cfaVersionId }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const state = await loadState(connection, { forUpdate: true });
    validateBaseState(state);
    validateIncorrectAgreement(state);
    const applicationPlan = findApplicationPlan(state);
    assertCondition(Number(applicationPlan?.id) === Number(planId), 'created_plan_scope_mismatch');
    validateApplicationPlan(state, applicationPlan);
    const correctedVersion = findApplicationCfa(state, planId);
    assertCondition(Number(correctedVersion?.id) === Number(cfaVersionId), 'corrected_cfa_scope_mismatch');
    assertCondition(correctedVersion.status === 'draft', 'corrected_cfa_not_draft');

    await connection.query(
      `UPDATE cfa_version
          SET status = 'withdrawn',
              signed_at = COALESCE(signed_at, (
                SELECT signed_at FROM signing_request WHERE id = ?
              )),
              signed_by_participant_id = COALESCE(signed_by_participant_id, (
                SELECT participant_user_id FROM signing_request WHERE id = ?
              ))
        WHERE id = ?
          AND status IN ('sent', 'signed', 'withdrawn')`,
      [INCORRECT_SIGNING_REQUEST_ID, INCORRECT_SIGNING_REQUEST_ID, INCORRECT_CFA_VERSION_ID]
    );
    await connection.query(
      `UPDATE cfa_version_documents
          SET document_id = ?,
              created_at = CURRENT_TIMESTAMP
        WHERE cfa_version_id = ?
          AND document_type = 'clean'
          AND document_id IN (?, ?)`,
      [
        INCORRECT_SIGNED_DOCUMENT_ID,
        INCORRECT_CFA_VERSION_ID,
        INCORRECT_UNSIGNED_DOCUMENT_ID,
        INCORRECT_SIGNED_DOCUMENT_ID,
      ]
    );
    await connection.query(
      `UPDATE iset_document
          SET status = 'archived',
              updated_at = CURRENT_TIMESTAMP
        WHERE id IN (?, ?)
          AND case_id = ?
          AND application_id = ?`,
      [
        INCORRECT_UNSIGNED_DOCUMENT_ID,
        INCORRECT_SIGNED_DOCUMENT_ID,
        CASE_ID,
        APPLICATION_ID,
      ]
    );
    await connection.query(
      `UPDATE iset_application
          SET status = 'approved',
              lifecycle_status = 'active',
              decision_outcome = 'approved',
              awaiting_reason = 'none',
              closure_reason = NULL,
              row_version = row_version + 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND case_id = ?
          AND client_id = ?
          AND status = 'completed'
          AND lifecycle_status = 'closed'
          AND decision_outcome = 'approved'`,
      [APPLICATION_ID, CASE_ID, CLIENT_ID]
    );
    await connection.query(
      `UPDATE iset_case c
          SET open_intervention_count = (
                SELECT COUNT(*)
                  FROM iset_case_intervention i
                 WHERE i.case_id = c.id
                   AND i.delivery_status IN ('planned', 'in_progress', 'suspended')
              ),
              total_intervention_count = (
                SELECT COUNT(*)
                  FROM iset_case_intervention i
                 WHERE i.case_id = c.id
                   AND i.delivery_status IN ('planned', 'in_progress', 'suspended', 'completed', 'cancelled')
              ),
              updated_at = CURRENT_TIMESTAMP
        WHERE c.id = ?`,
      [CASE_ID]
    );
    await connection.commit();
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

async function rollbackRecovery() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const state = await loadState(connection, { forUpdate: true });
    validateBaseState(state);
    validateIncorrectAgreement(state);
    const applicationPlan = findApplicationPlan(state);
    assertCondition(applicationPlan, 'repair_application_plan_missing');
    const correctedVersion = findApplicationCfa(state, applicationPlan.id);
    assertCondition(correctedVersion?.status === 'draft', 'corrected_cfa_no_longer_rollback_safe');
    const correctedSigning = state.signingRows.find(row => {
      const meta = parseJson(row.resolved_schema_json, {})?.meta || {};
      return Number(meta.cfaVersionId) === Number(correctedVersion.id);
    });
    assertCondition(!correctedSigning, 'corrected_cfa_already_sent');

    await connection.query(
      `UPDATE iset_case_intervention
          SET status = 'cancelled',
              delivery_status = 'cancelled',
              updated_at = CURRENT_TIMESTAMP
        WHERE action_plan_id = ?
          AND case_id = ?`,
      [applicationPlan.id, CASE_ID]
    );
    await connection.query(
      `UPDATE iset_case_action_plan
          SET status = 'archived',
              archived_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND case_id = ?
          AND application_id = ?`,
      [applicationPlan.id, CASE_ID, APPLICATION_ID]
    );
    await connection.query(
      `DELETE FROM esdc_participant_submission
        WHERE case_id = ?
          AND action_plan_id = ?
          AND application_id = ?
          AND readiness_status = 'needs_review'
          AND submission_status = 'pending'
          AND submitted_at IS NULL
          AND payload_snapshot IS NULL`,
      [CASE_ID, applicationPlan.id, APPLICATION_ID]
    );
    await connection.query(
      `UPDATE cfa_version
          SET status = 'withdrawn'
        WHERE id = ?
          AND status = 'draft'`,
      [correctedVersion.id]
    );
    await connection.query(
      `UPDATE iset_document d
       JOIN cfa_version_documents cvd ON cvd.document_id = d.id
          SET d.status = 'archived',
              d.updated_at = CURRENT_TIMESTAMP
        WHERE cvd.cfa_version_id = ?
          AND d.case_id = ?`,
      [correctedVersion.id, CASE_ID]
    );
    await connection.query(
      `UPDATE cfa_version
          SET status = 'signed'
        WHERE id = ?
          AND status = 'withdrawn'
          AND signed_at IS NOT NULL`,
      [INCORRECT_CFA_VERSION_ID]
    );
    await connection.query(
      `UPDATE iset_document
          SET status = 'active',
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND case_id = ?
          AND application_id = ?`,
      [INCORRECT_SIGNED_DOCUMENT_ID, CASE_ID, APPLICATION_ID]
    );
    await connection.query(
      `UPDATE iset_application
          SET status = 'completed',
              lifecycle_status = 'closed',
              decision_outcome = 'approved',
              awaiting_reason = 'none',
              row_version = row_version + 1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND case_id = ?
          AND status = 'approved'
          AND lifecycle_status = 'active'`,
      [APPLICATION_ID, CASE_ID]
    );
    await connection.query(
      `UPDATE iset_case c
          SET open_intervention_count = (
                SELECT COUNT(*)
                  FROM iset_case_intervention i
                 WHERE i.case_id = c.id
                   AND i.delivery_status IN ('planned', 'in_progress', 'suspended')
              ),
              total_intervention_count = (
                SELECT COUNT(*)
                  FROM iset_case_intervention i
                 WHERE i.case_id = c.id
                   AND i.delivery_status IN ('planned', 'in_progress', 'suspended', 'completed', 'cancelled')
              ),
              updated_at = CURRENT_TIMESTAMP
        WHERE c.id = ?`,
      [CASE_ID]
    );
    await connection.commit();
    return {
      planId: Number(applicationPlan.id),
      cfaVersionId: Number(correctedVersion.id),
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

function summarizeState(state) {
  return {
    environment: state.environment,
    case: state.caseRow,
    application: state.applicationRow,
    assessment: {
      ...state.assessmentRow,
      proposed_interventions: parseJson(state.assessmentRow?.proposed_interventions, []),
    },
    plans: state.planRows,
    interventions: state.interventionRows,
    cfaVersions: state.cfaRows,
    cfaDocuments: state.cfaDocumentRows,
    incidentDocuments: state.incidentDocumentRows,
    signingRequests: state.signingRows.map(row => ({
      ...row,
      resolved_schema_json: parseJson(row.resolved_schema_json, null),
    })),
    esdcSubmissions: state.esdcSubmissionRows,
    caseManager: state.caseManager,
  };
}

async function main() {
  const initialState = await loadState(pool);
  validateBaseState(initialState);
  validateIncorrectAgreement(initialState);
  if (mode === 'preview') {
    process.stdout.write(`${JSON.stringify({ mode, state: summarizeState(initialState) }, null, 2)}\n`);
    return;
  }
  if (mode === 'rollback') {
    const result = await rollbackRecovery();
    const finalState = await loadState(pool);
    validateBaseState(finalState);
    validateIncorrectAgreement(finalState);
    assertCondition(finalState.applicationRow.status === 'completed', 'rollback_application_not_completed');
    assertCondition(finalState.applicationRow.lifecycle_status === 'closed', 'rollback_application_not_closed');
    assertCondition(!findApplicationPlan(finalState), 'rollback_application_plan_still_current');
    assertCondition(
      !finalState.esdcSubmissionRows.some(row => Number(row.action_plan_id) === Number(result.planId)),
      'rollback_esdc_submission_not_removed'
    );
    const rolledBackVersion = finalState.cfaRows.find(row => Number(row.id) === Number(result.cfaVersionId));
    assertCondition(rolledBackVersion?.status === 'withdrawn', 'rollback_corrected_cfa_not_withdrawn');
    const restoredIncorrectVersion = finalState.cfaRows.find(
      row => Number(row.id) === INCORRECT_CFA_VERSION_ID
    );
    assertCondition(restoredIncorrectVersion?.status === 'signed', 'rollback_incorrect_cfa_not_restored');
    const restoredSignedDocument = finalState.cfaDocumentRows.find(
      row => Number(row.cfa_version_id) === INCORRECT_CFA_VERSION_ID &&
        row.document_type === 'clean'
    );
    assertCondition(
      Number(restoredSignedDocument?.document_id) === INCORRECT_SIGNED_DOCUMENT_ID &&
        restoredSignedDocument?.status === 'active',
      'rollback_signed_evidence_not_restored'
    );
    process.stdout.write(`${JSON.stringify({ mode, result, state: summarizeState(finalState) }, null, 2)}\n`);
    return;
  }

  const plan = await createOrReuseApplicationPlan();
  const cfa = await createOrReuseCorrectedCfa(plan.planId);
  await finalizeRecovery({ planId: plan.planId, cfaVersionId: cfa.cfaVersionId });
  const finalState = await loadState(pool);
  const finalPlan = findApplicationPlan(finalState);
  const finalInterventions = validateApplicationPlan(finalState, finalPlan);
  const finalCfa = findApplicationCfa(finalState, finalPlan?.id);
  assertCondition(finalState.applicationRow.status === 'approved', 'application_not_reopened');
  assertCondition(finalState.applicationRow.lifecycle_status === 'active', 'application_lifecycle_not_reopened');
  assertCondition(finalPlan?.status === 'draft', 'corrected_plan_not_draft');
  assertCondition(finalCfa?.status === 'draft', 'corrected_cfa_not_draft_after_repair');
  const correctedSnapshot = parseJson(finalCfa?.metadata_json, {});
  assertCondition(
    Number(correctedSnapshot?.case?.applicationId) === APPLICATION_ID,
    'corrected_cfa_application_mismatch'
  );
  assertCondition(
    JSON.stringify(
      (correctedSnapshot?.interventions || []).map(row => Number(row.id)).sort((a, b) => a - b)
    ) === JSON.stringify(sortedIds(finalInterventions)),
    'corrected_cfa_interventions_mismatch'
  );
  const correctedCfaDocuments = finalState.cfaDocumentRows.filter(
    row => Number(row.cfa_version_id) === Number(finalCfa.id)
  );
  assertCondition(
    correctedCfaDocuments.some(
      row => row.document_type === 'clean' && row.status === 'active' &&
        Number(row.application_id) === APPLICATION_ID
    ),
    'corrected_cfa_clean_document_missing'
  );
  const incorrectFinalVersion = finalState.cfaRows.find(
    row => Number(row.id) === INCORRECT_CFA_VERSION_ID
  );
  assertCondition(
    incorrectFinalVersion?.status === 'withdrawn',
    'incorrect_cfa_not_withdrawn'
  );
  assertCondition(incorrectFinalVersion?.signed_at, 'incorrect_cfa_signed_at_missing');
  assertCondition(
    Number(incorrectFinalVersion?.signed_by_participant_id) ===
      Number(finalState.signingRows.find(row => Number(row.id) === INCORRECT_SIGNING_REQUEST_ID)?.participant_user_id),
    'incorrect_cfa_participant_mismatch'
  );
  const linkedIncorrectDocument = finalState.cfaDocumentRows.find(
    row => Number(row.cfa_version_id) === INCORRECT_CFA_VERSION_ID &&
      row.document_type === 'clean'
  );
  assertCondition(
    Number(linkedIncorrectDocument?.document_id) === INCORRECT_SIGNED_DOCUMENT_ID &&
      linkedIncorrectDocument?.status === 'archived',
    'incorrect_signed_evidence_not_preserved'
  );
  process.stdout.write(`${JSON.stringify({
    mode,
    result: {
      plan,
      cfa,
      applicationStatus: finalState.applicationRow.status,
      applicationLifecycleStatus: finalState.applicationRow.lifecycle_status,
    },
    state: summarizeState(finalState),
  }, null, 2)}\n`);
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  });
