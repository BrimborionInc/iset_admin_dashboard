#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    mode: 'dry-run',
    caseId: 102,
    applicationId: 20,
    expectedLatestVersion: 2,
    expectedReference: 'ISET-20260414-E15794',
    signerName: 'Danielle Burdett',
    signedAt: '2026-06-15T16:07:28.000Z',
    actorUserId: null
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };
    if (arg === '--apply') {
      args.mode = 'apply';
    } else if (arg === '--dry-run') {
      args.mode = 'dry-run';
    } else if (arg === '--case-id') {
      args.caseId = Number.parseInt(next(), 10);
    } else if (arg === '--application-id') {
      args.applicationId = Number.parseInt(next(), 10);
    } else if (arg === '--expected-latest-version') {
      args.expectedLatestVersion = Number.parseInt(next(), 10);
    } else if (arg === '--expected-reference') {
      args.expectedReference = next();
    } else if (arg === '--signer-name') {
      args.signerName = next();
    } else if (arg === '--signed-at') {
      args.signedAt = next();
    } else if (arg === '--actor-user-id') {
      const parsed = Number.parseInt(next(), 10);
      args.actorUserId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['dry-run', 'apply'].includes(args.mode)) throw new Error('mode must be dry-run or apply');
  if (!Number.isInteger(args.caseId) || args.caseId <= 0) throw new Error('invalid case id');
  if (!Number.isInteger(args.applicationId) || args.applicationId <= 0) throw new Error('invalid application id');
  if (!Number.isInteger(args.expectedLatestVersion) || args.expectedLatestVersion < 1) {
    throw new Error('invalid expected latest version');
  }
  if (!args.expectedReference) throw new Error('expected reference is required');
  if (!args.signerName) throw new Error('signer name is required');
  if (!args.signedAt || Number.isNaN(new Date(args.signedAt).getTime())) throw new Error('invalid signed-at timestamp');
  return args;
}

function stripServerStartup(source) {
  let next = source;
  next = next.replace(
    /app\.listen\(port,\s*'0\.0\.0\.0',\s*\(\)\s*=>\s*\{[\s\S]*?\n\}\);\n/,
    "console.log('[repair] skipped app.listen while loading server helpers');\n"
  );
  next = next.replace(
    /\(async \(\) => \{\s*try \{\s*await runStartupSharedSchemaMigrations\(pool,\s*\{ logger: console \}\);\s*\} catch \(err\) \{\s*console\.error\('\[migrations\] Runner unexpected error:', err\.message\);\s*\}\s*\}\)\(\);\n/,
    "console.log('[repair] skipped startup migration runner');\n"
  );
  next = next.replace(
    /^\s*sync[A-Za-z0-9_]*FromFile\(\);\n/gm,
    "console.log('[repair] skipped startup template sync');\n"
  );
  return next;
}

function repairSource() { /*
;(async function runFeedback142AssessmentRepair() {
  const args = global.__PATH_REPAIR_ARGS__;
  const result = {
    mode: args.mode,
    caseId: args.caseId,
    applicationId: args.applicationId,
    expectedLatestVersion: args.expectedLatestVersion,
    generated: []
  };

  const parseArray = value => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    }
    return [];
  };
  const parseObject = (value, fallback) => {
    if (value && typeof value === 'object') return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
      } catch (_) {
        return fallback;
      }
    }
    return fallback;
  };
  const normalizeDocumentCaseRow = row => {
    if (!row) return row;
    row.assessment_employment_barriers = parseArray(row.assessment_employment_barriers);
    row.assessment_local_area_priorities = parseArray(row.assessment_local_area_priorities);
    row.assessment_itp = parseObject(row.assessment_itp, { tuition: '', books: '', materials: '', living: '', childcare: '', otherLabel: '', otherAmount: '', details: '' });
    row.assessment_wage = parseObject(row.assessment_wage, { wages: '', mercs: '', nonwages: '', other1Label: '', other1Amount: '', other2Label: '', other2Amount: '', subsidyDetails: '' });
    [
      'assessment_employment_barriers_other_details',
      'assessment_intervention_related_noc',
      'assessment_intervention_related_noc_version',
      'assessment_intervention_label',
      'assessment_intervention_pot_code',
      'assessment_intervention_pot_name',
      'assessment_posting_context',
      'case_context_json',
      'assessment_childcare_funding_details',
      'assessment_action_plan_result_code',
      'assessment_conflict_declaration_choice',
      'assessment_conflict_declaration_details'
    ].forEach(key => {
      if (typeof row[key] === 'string') {
        const trimmed = row[key].trim();
        row[key] = trimmed || null;
      } else if (row[key] === undefined) {
        row[key] = null;
      }
    });
    ['assessment_intervention_code', 'assessment_intervention_outcome_code', 'assessment_intervention_duration_days', 'assessment_intervention_cost_total', 'assessment_intervention_pot_id'].forEach(key => {
      if (row[key] !== null && row[key] !== undefined) {
        const value = Number(row[key]);
        row[key] = Number.isNaN(value) ? String(row[key]) : String(value);
      }
    });
    if (row.assessment_childcare_need !== null && row.assessment_childcare_need !== undefined) {
      const need = Number(row.assessment_childcare_need);
      row.assessment_childcare_need = Number.isNaN(need) ? null : (need === 1 ? 'yes' : need === 0 ? 'no' : null);
    }
    return row;
  };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[guardRow]] = await conn.query(
      `SELECT c.id AS case_id,
              c.case_number,
              c.client_id,
              c.assigned_staff_profile_id,
              a.id AS application_id,
              a.status AS application_status,
              a.lifecycle_status AS application_lifecycle_status,
              a.row_version AS application_row_version,
              aa.updated_at AS assessment_updated_at
         FROM iset_case c
         JOIN iset_application a ON a.case_id = c.id
         JOIN iset_application_assessment aa ON aa.application_id = a.id
        WHERE c.id = ? AND a.id = ?
        FOR UPDATE`,
      [args.caseId, args.applicationId]
    );
    if (!guardRow) throw new Error('target case/application assessment row not found');
    if (guardRow.case_number !== args.expectedReference) {
      throw new Error(`reference guard failed: expected ${args.expectedReference}, got ${guardRow.case_number}`);
    }
    if (guardRow.application_status !== 'pending_approval' || guardRow.application_lifecycle_status !== 'pending_decision') {
      throw new Error(`status guard failed: ${guardRow.application_status}/${guardRow.application_lifecycle_status}`);
    }

    const latestSubmittedDoc = await fetchLatestAssessmentDocumentInfo({
      applicationId: args.applicationId,
      caseId: args.caseId,
      documentTypes: ['case_assessment'],
      connection: conn
    });
    const latestVersionedDoc = await fetchLatestAssessmentDocumentInfo({
      applicationId: args.applicationId,
      caseId: args.caseId,
      documentTypes: ['case_assessment', 'case_assessment_approved'],
      connection: conn
    });
    if (!latestSubmittedDoc || !latestVersionedDoc) throw new Error('existing assessment documents not found');
    if (latestVersionedDoc.versionNumber !== args.expectedLatestVersion) {
      throw new Error(`version guard failed: expected latest v${args.expectedLatestVersion}, got v${latestVersionedDoc.versionNumber}`);
    }
    if (latestSubmittedDoc.versionNumber !== args.expectedLatestVersion) {
      throw new Error(`submitted-version guard failed: expected v${args.expectedLatestVersion}, got v${latestSubmittedDoc.versionNumber}`);
    }
    if (!hasAssessmentSnapshotContent(latestSubmittedDoc.snapshot)) {
      throw new Error('latest submitted snapshot is missing');
    }

    const [[documentCaseRowRaw]] = await conn.query(
      `SELECT c.status,
              c.lifecycle_status AS case_lifecycle_status,
              c.closure_reason AS case_closure_reason,
              a.id AS application_id,
              c.client_id,
              c.case_context_json,
              a.status AS application_status,
              a.lifecycle_status AS application_lifecycle_status,
              a.decision_outcome AS application_decision_outcome,
              a.awaiting_reason AS application_awaiting_reason,
              a.closure_reason AS application_closure_reason,
              a.docs_requested_active AS docs_requested_active,
              a.docs_requested_at AS docs_requested_at,
              a.docs_requested_cleared_at AS docs_requested_cleared_at,
              a.docs_requested_source AS docs_requested_source,
              COALESCE(s.user_id, JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.user_id'))) AS applicant_user_id,
              COALESCE(s.reference_number, JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number'))) AS tracking_id,
              a.row_version AS application_row_version,
              ca.date_of_assessment AS assessment_date_of_assessment,
              ca.overview AS case_summary,
              ca.employment_goals AS assessment_employment_goals,
              ca.previous_iset AS assessment_previous_iset,
              ca.previous_iset_details AS assessment_previous_iset_details,
              ca.employment_barriers AS assessment_employment_barriers,
              ca.employment_barriers_other_details AS assessment_employment_barriers_other_details,
              ca.local_area_priorities AS assessment_local_area_priorities,
              ca.other_funding_details AS assessment_other_funding_details,
              ca.esdc_eligibility AS assessment_esdc_eligibility,
              ca.intervention_start_date AS assessment_intervention_start_date,
              ca.intervention_end_date AS assessment_intervention_end_date,
              ca.institution AS assessment_institution,
              ca.program_name AS assessment_program_name,
              ca.itp_payload AS assessment_itp,
              ca.wage_payload AS assessment_wage,
              ca.recommendation AS assessment_recommendation,
              ca.justification AS assessment_justification,
              ca.nwac_review AS assessment_nwac_review,
              ca.nwac_reason AS assessment_nwac_reason,
              ca.intervention_code AS assessment_intervention_code,
              ic.label AS assessment_intervention_label,
              ca.intervention_outcome_code AS assessment_intervention_outcome_code,
              ca.intervention_duration_days AS assessment_intervention_duration_days,
              ca.intervention_cost_total AS assessment_intervention_cost_total,
              ca.intervention_related_noc AS assessment_intervention_related_noc,
              ca.intervention_related_noc_version AS assessment_intervention_related_noc_version,
              ca.proposed_interventions AS assessment_proposed_interventions,
              ca.intervention_budget_pot_id AS assessment_intervention_pot_id,
              bp.code AS assessment_intervention_pot_code,
              bp.name AS assessment_intervention_pot_name,
              ca.posting_context AS assessment_posting_context,
              ca.childcare_need AS assessment_childcare_need,
              ca.childcare_funding_details AS assessment_childcare_funding_details,
              ca.action_plan_result_code AS assessment_action_plan_result_code,
              ca.action_plan_result_date AS assessment_action_plan_result_date,
              CASE WHEN cd2.id IS NULL THEN 0 ELSE 1 END AS assessment_conflict_declaration_signed,
              cd2.signed_at AS assessment_conflict_declaration_signed_at,
              cd2.staff_profile_id AS assessment_conflict_declaration_signed_by,
              cd2.declaration_choice AS assessment_conflict_declaration_choice,
              cd2.conflict_details AS assessment_conflict_declaration_details
         FROM iset_case c
         JOIN iset_application a ON a.case_id = c.id AND a.id = ?
         LEFT JOIN iset_application_submission s ON s.id = a.submission_id
         LEFT JOIN iset_application_assessment ca ON ca.application_id = a.id
         LEFT JOIN esdc_intervention_code ic ON ic.code = ca.intervention_code
         LEFT JOIN budget_pot bp ON bp.id = ca.intervention_budget_pot_id
         LEFT JOIN iset_case_conflict_declaration cd2
           ON cd2.case_id = c.id
          AND cd2.staff_profile_id = c.assigned_staff_profile_id
          AND cd2.revoked_at IS NULL
        WHERE c.id = ?`,
      [args.applicationId, args.caseId]
    );
    const documentCaseRow = normalizeDocumentCaseRow(documentCaseRowRaw);
    if (!documentCaseRow?.application_id) throw new Error('document row application missing');
    const caseContext = safeJsonParse(documentCaseRow.case_context_json, null);
    const applicantContext = await fetchAssessmentApplicantContext({
      applicationId: documentCaseRow.application_id,
      applicantUserId: documentCaseRow.applicant_user_id
    });
    const referenceNumber = applicantContext.trackingId || documentCaseRow.tracking_id || args.expectedReference;
    if (referenceNumber !== args.expectedReference) {
      throw new Error(`tracking guard failed: expected ${args.expectedReference}, got ${referenceNumber}`);
    }

    const nextVersion = latestVersionedDoc.versionNumber + 1;
    const currentSnapshot = await buildAssessmentPdfSnapshot({
      caseRow: documentCaseRow,
      applicantName: applicantContext.applicantName,
      referenceNumber,
      caseContext
    });
    if (!hasAssessmentSnapshotContent(currentSnapshot)) throw new Error('current assessment snapshot is empty');

    const currentJustification = String(currentSnapshot.recommendation_justification || '').trim();
    const previousJustification = String(latestSubmittedDoc.snapshot.recommendation_justification || '').trim();
    if (!currentJustification || currentJustification === previousJustification) {
      throw new Error('snapshot guard failed: current justification is empty or unchanged from v2');
    }

    result.latestSubmittedDocumentId = latestSubmittedDoc.id;
    result.latestSubmittedVersion = latestSubmittedDoc.versionNumber;
    result.nextVersion = nextVersion;
    result.currentAssessmentUpdatedAt = guardRow.assessment_updated_at;
    result.currentJustificationPreview = currentJustification.slice(0, 220);

    if (args.mode === 'dry-run') {
      await conn.rollback();
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const submittedSignature = {
      signerName: args.signerName,
      signedAt: args.signedAt
    };
    const submittedBuffer = await generateAssessmentPdfBuffer({
      caseRow: documentCaseRow,
      applicantName: applicantContext.applicantName,
      referenceNumber,
      caseContext,
      recommendationSignature: submittedSignature,
      approvalSignature: null,
      includeAgreementSection: false,
      versionNumber: nextVersion,
      variant: 'submitted'
    });
    const submittedDocId = await storeAssessmentPdfDocument({
      applicationId: documentCaseRow.application_id,
      caseId: args.caseId,
      clientId: documentCaseRow.client_id,
      applicantUserId: applicantContext.applicantUserId,
      actorUserId: args.actorUserId,
      trackingId: referenceNumber,
      pdfBuffer: submittedBuffer,
      documentType: 'case_assessment',
      label: `Case manager assessment v${nextVersion}`,
      fileNamePrefix: 'case-manager-assessment',
      versionNumber: nextVersion,
      variant: 'submitted',
      snapshot: currentSnapshot,
      archivePreviousActive: false,
      replaceExistingVersion: true,
      connection: conn
    });
    if (!submittedDocId) throw new Error('failed to insert submitted assessment document');
    result.generated.push({ documentType: 'case_assessment', id: submittedDocId, version: nextVersion });

    const redlineBuffer = await generateAssessmentPdfBuffer({
      caseRow: documentCaseRow,
      applicantName: applicantContext.applicantName,
      referenceNumber,
      caseContext,
      recommendationSignature: submittedSignature,
      approvalSignature: null,
      includeAgreementSection: false,
      versionNumber: nextVersion,
      variant: 'redline',
      previousVersionNumber: latestSubmittedDoc.versionNumber,
      redlineBaseSnapshot: latestSubmittedDoc.snapshot
    });
    const redlineDocId = await storeAssessmentPdfDocument({
      applicationId: documentCaseRow.application_id,
      caseId: args.caseId,
      clientId: documentCaseRow.client_id,
      applicantUserId: applicantContext.applicantUserId,
      actorUserId: args.actorUserId,
      trackingId: referenceNumber,
      pdfBuffer: redlineBuffer,
      documentType: 'case_assessment_redline',
      label: `Case manager assessment redline v${nextVersion}`,
      fileNamePrefix: 'case-manager-assessment-redline',
      versionNumber: nextVersion,
      variant: 'redline',
      previousVersionNumber: latestSubmittedDoc.versionNumber,
      snapshot: currentSnapshot,
      archivePreviousActive: false,
      replaceExistingVersion: true,
      connection: conn
    });
    if (!redlineDocId) throw new Error('failed to insert redline assessment document');
    result.generated.push({ documentType: 'case_assessment_redline', id: redlineDocId, version: nextVersion });

    await conn.query(
      `INSERT INTO iset_case_event
         (case_id, event_type, summary, payload_json, occurred_at, source_system)
       VALUES (?, 'data_repair', ?, CAST(? AS JSON), NOW(3), 'codex')`,
      [
        args.caseId,
        `Generated missing Case manager assessment v${nextVersion} documents for feedback #142.`,
        JSON.stringify({
          runId: 'feedback-142-assessment-v3-20260615',
          feedbackReportId: 142,
          applicationId: args.applicationId,
          generatedDocumentIds: result.generated,
          sourceAssessmentUpdatedAt: guardRow.assessment_updated_at,
          reason: 'Danielle saved post-submission assessment edits on 2026-06-15; Supporting Documents did not regenerate a new assessment packet.'
        })
      ]
    );

    await conn.query(
      `INSERT INTO admin_feedback_note
         (report_id, author_staff_profile_id, author_name, author_email, note_text)
       VALUES (142, NULL, 'Codex', 'codex@openai.com', ?)`,
      [
        `Codex repair 2026-06-15: Generated missing Case manager assessment v${nextVersion} and redline v${nextVersion} for case 102 / application 20 from Danielle Burdett's saved 2026-06-15 assessment row. New document ids: ${submittedDocId} (case_assessment) and ${redlineDocId} (case_assessment_redline). Workflow status was not changed; this is a targeted document repair only.`
      ]
    );
    await conn.query(
      `UPDATE admin_feedback_report
          SET status = 'in_progress'
        WHERE id = 142 AND status IN ('submitted', 'triaging')`
    );
    await conn.query(
      `INSERT INTO admin_feedback_status_history
         (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email)
       VALUES (142, 'triaging', 'in_progress', NULL, 'Codex', 'codex@openai.com')`
    );

    await conn.commit();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
})().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('[repair] failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
*/ }

const repairBody = repairSource.toString().match(/\/\*([\s\S]*)\*\//)[1];

async function main() {
  const args = parseArgs(process.argv);
  process.env.ENABLE_DB_DIAG = 'false';
  global.__PATH_REPAIR_ARGS__ = args;

  const serverRoot = process.env.ADMIN_ROOT || path.resolve(__dirname, '..');
  const serverPath = path.resolve(serverRoot, 'isetadminserver.js');
  const source = stripServerStartup(fs.readFileSync(serverPath, 'utf8')) + '\n' + repairBody;
  eval(source);
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
