-- PROD feedback queue triage notes/status updates for 2026-05-21.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @triage_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'closed', updated_at = @triage_at
 WHERE id = 92 AND status = 'in_progress';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 92, 'in_progress', 'closed', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 92 AND status = 'closed')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 92 AND previous_status = 'in_progress' AND new_status = 'closed' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 92, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: prior note says the secure-message attachment-opening issue could not be reproduced and Amanda reported the symptom cleared. No recurrence evidence found in the feedback queue, so closing as non-reproducible/cleared rather than marking as a delivered code fix.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 92 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'resolved', updated_at = @triage_at
 WHERE id = 94 AND status = 'in_progress';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 94, 'in_progress', 'resolved', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 94 AND status = 'resolved')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 94 AND previous_status = 'in_progress' AND new_status = 'resolved' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 94, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: PROD now has the May 14 intake financial-information update. The live publish/workflow.schema.intake row was updated 2026-05-14 and Household Income plus base Household Expenses are present without Living allowance gating. Marking resolved in PROD.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 94 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'resolved', updated_at = @triage_at
 WHERE id = 95 AND status = 'in_progress';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 95, 'in_progress', 'resolved', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 95 AND status = 'resolved')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 95 AND previous_status = 'in_progress' AND new_status = 'resolved' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 95, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Financial Overview signing is now in PROD from release 20260514-prod-dev-alignment. Live PROD workflow 52 is active with document_type financial_overview and the funding_overview series/version/document tables are present. Marking resolved in PROD.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 95 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'planned', updated_at = @triage_at
 WHERE id = 101 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 101, 'submitted', 'planned', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 101 AND status = 'planned')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 101 AND previous_status = 'submitted' AND new_status = 'planned' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 101, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Case 90 has action plan 27 active with future effective date 2026-09-01 and intervention 36 still draft. ILMP validation is correctly blocking future-dated reporting and no reportable intervention, but the workflow leaves staff in an awkward state after approval. Plan an application/casework fix to prevent or clearly guide future-start activation and ensure approved intervention state is created/visible before ILMP validation.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 101 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'planned', updated_at = @triage_at
 WHERE id = 102 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 102, 'submitted', 'planned', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 102 AND status = 'planned')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 102 AND previous_status = 'submitted' AND new_status = 'planned' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 102, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Case 88 validation is blocked by barrier values stored from the Participant Details UI, e.g. funding/other. The UI options do not line up cleanly with the ILMP validator code lookup, so this is a product mapping/validation issue rather than a staff-only question. Plan a fix to map stored barrier option values to ESDC codes and improve the validation guidance.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 102 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'triaging', updated_at = @triage_at
 WHERE id = 103 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 103, 'submitted', 'triaging', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 103 AND status = 'triaging')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 103 AND previous_status = 'submitted' AND new_status = 'triaging' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 103, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Case 127 was covered by the 20260520 denied-reporting PROD backfill. It now has closed reporting-only action plan 46, Actions leading to denial, with completed Employment Counselling and Career Research and Exploration interventions. Do not resolve yet: the older archived auto-assessment plan still has a pending/blocked ESDC participant submission, so verify the UI/queue no longer points staff at that stale blocked row or plan a cleanup.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 103 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'planned', updated_at = @triage_at
 WHERE id = 104 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 104, 'submitted', 'planned', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 104 AND status = 'planned')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 104 AND previous_status = 'submitted' AND new_status = 'planned' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 104, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Case 73 / intervention 6 stores related NOC 2021:42201, and that NOC code is active in the PROD noc_code table. The current validation row still says the related NOC is invalid, so this is a confirmed validation or stale-validation bug. Canonical NOC-validation item; report 106 is the same pattern on another case.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 104 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'triaging', updated_at = @triage_at
 WHERE id = 105 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 105, 'submitted', 'triaging', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 105 AND status = 'triaging')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 105 AND previous_status = 'submitted' AND new_status = 'triaging' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 105, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Shayleen McNabb is still present as case 94 / application 12; the application is withdrawn with closed lifecycle and closure_reason withdrawn, while the case row remains pending_approval/intake. No action plans/interventions exist, which is expected for a withdrawal rather than a denial. Needs product/queue review for discoverability of withdrawn applications and whether the parent case lifecycle should be synchronized or shown more clearly.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 105 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'closed', updated_at = @triage_at
 WHERE id = 106 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 106, 'submitted', 'closed', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 106 AND status = 'closed')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 106 AND previous_status = 'submitted' AND new_status = 'closed' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 106, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Duplicate of report 104. Case 49 / intervention 26 stores related NOC 2021:33109, and that NOC code is active in PROD, but the validation row still reports it as invalid. Closing this duplicate and keeping report 104 as the canonical NOC validation fix.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 106 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

UPDATE admin_feedback_report
   SET status = 'closed', updated_at = @triage_at
 WHERE id = 107 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 107, 'submitted', 'closed', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 107 AND status = 'closed')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 107 AND previous_status = 'submitted' AND new_status = 'closed' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 107, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Duplicate/specific instance of report 99, Decision screen improvements. The desired workflow change is that approvers should not be forced straight into the approval/denial letter-writing step after recording a decision. Closing this duplicate so report 99 remains the canonical in-progress decision-screen UX item.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 107 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 108, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: This was already marked resolved after the 20260520 PROD release. Live PROD has notification template 11, Closure warning, linked to document_request_closure_due/applicant. No further action unless Amanda still cannot access the template after refresh/sign-in.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 108 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 109, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-21: Resolved by PROD release 20260520-prod-denial-reporting. The release restored client-side sorting for shared Work Queue Items tables, including NWAC All Cases and metric-result rows.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 109 AND note_text LIKE 'Codex triage 2026-05-21:%'
 );

COMMIT;
