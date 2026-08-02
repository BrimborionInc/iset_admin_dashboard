-- PROD Bugs and Change Requests queue triage for 2026-07-30.
-- Scope: feedback status/history/notes only. No case, application, document,
-- message, assessment, intervention, or other operational data is mutated.
--
-- Live schema and current report states were verified through the PROD SSM SQL
-- helper immediately before this artifact was prepared.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @triage_at := UTC_TIMESTAMP();
SET @note_prefix := 'Codex queue triage 2026-07-30:';

START TRANSACTION;

-- Newly reviewed reports remain open for implementation or deeper diagnosis.
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT r.id, 'submitted', 'triaging', NULL, @actor_name, @actor_email, @triage_at
  FROM admin_feedback_report r
 WHERE r.id IN (168, 169, 170, 171, 172, 174, 175)
   AND r.status = 'submitted'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = r.id
        AND h.previous_status = 'submitted'
        AND h.new_status = 'triaging'
        AND h.changed_by_email = @actor_email
   );

UPDATE admin_feedback_report
   SET status = 'triaging',
       updated_at = @triage_at
 WHERE id IN (168, 169, 170, 171, 172, 174, 175)
   AND status = 'submitted';

-- #176 is an exact duplicate of #175 for Case 160 / Application 90.
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT r.id, 'submitted', 'closed', NULL, @actor_name, @actor_email, @triage_at
  FROM admin_feedback_report r
 WHERE r.id = 176
   AND r.status = 'submitted'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = r.id
        AND h.previous_status = 'submitted'
        AND h.new_status = 'closed'
        AND h.changed_by_email = @actor_email
   );

UPDATE admin_feedback_report
   SET status = 'closed',
       updated_at = @triage_at
 WHERE id = 176
   AND status = 'submitted';

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 96, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Rechecked the open queue. This remains blocked on the NWAC/Bill decision naming the additional non-school/non-employment document types and their conditional upload rules. No safe implementation can be inferred from the current report, so keep in_progress and outside the low-hanging engineering batch.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 96 AND status = 'in_progress')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 96 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 97, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Rechecked the open queue. This remains blocked on the business wording/document-type decision for First Nations and Inuit identity evidence. No wording or configuration should be guessed; keep in_progress and outside the low-hanging engineering batch.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 97 AND status = 'in_progress')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 97 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 123, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Rechecked the open queue. Appeals is still a policy and workflow design project, not a quick fix. Eligibility, SLA, ownership, outcomes, permissions, notifications, artifacts, audit history, and reporting treatment remain unresolved. Keep triaging and out of the low-hanging batch.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 123 AND status = 'triaging')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 123 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 154, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' The wrong-recipient secure message remains contained and the withdrawal safeguards remain deployed. The open work is privacy/business-owner incident follow-up, not an unimplemented low-hanging code fix. Keep in_progress until that follow-up is explicitly complete.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 154 AND status = 'in_progress')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 154 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 163, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Current evidence still shows three Emma McLeod secure-message notification emails accepted by SES without a PATH queue or handoff error. Lowest-effort next step is recipient support: search Gmail Inbox, Spam, Promotions, and All Mail for iset@nwac.ca and the PATH subject. Keep triaging because provider acceptance does not prove inbox placement and downstream bounce/suppression evidence is unavailable.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 163 AND status = 'triaging')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 163 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 165, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' The guarded July 27 Solana Henderson fiscal-period repair is complete: prior and renewal plans/interventions were separated and the orphaned returned revision was archived. Keep in_progress only for Amanda''s authenticated Case 41 UI recheck; if the repaired plan/intervention layout is visible and usable, this report can be resolved without more engineering.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 165 AND status = 'in_progress')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 165 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 166, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Signed Financial Overview v1 is restored, unnecessary v2 is withdrawn, and the preservation guard is deployed. Keep in_progress for the remaining authenticated Supporting Documents visibility recheck; this is verification work, not a new implementation item.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 166 AND status = 'in_progress')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 166 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 168, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Confirmed the same dual-role edit-lock defect as #170. Case 193 / Application 127 / workflow 42 is correctly returned_to_submitter; Regional Manager staff profile 995581 is both workflow submitter and RM reviewer. The frontend nevertheless requires a Regional Manager draft to have no workflow row before it enables assessment editing. Fix the submitter-aware edit gate and cover RM-as-submitter returned_to_submitter behavior. No case/application data changed.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 168)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 168 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 169, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Confirmed accidental-denial recovery is required for Case 109 / Application 27 / workflow 11. The stored Decision Maker note asks for tuition, mileage, and other-cost corrections, but the workflow is final_decision_recorded with nwac_decision=denied and the application is rejected. This clusters with #175/#176. Recovery must be a separately reviewed guarded data operation; prevention should add a final high-consequence decision confirmation and stop disagreement from feeling like a safe request-changes shortcut. No case/application data changed.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 169)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 169 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 170, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Confirmed the same dual-role edit-lock defect as #168. Case 157 / Application 85 / workflow 43 is returned_to_submitter; Regional Manager staff profile 55 is both submitter and RM reviewer. The UI blocks editing because the Regional Manager draft gate requires no workflow row. Treat #168 and #170 as one small frontend fix with two regression fixtures. No case/application data changed.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 170)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 170 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 171, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Confirmed a repeat-application document-generation defect, not missing staff evidence. Case 76 / Application 123 has a complete assessment and extensive application-linked evidence, but no active application-linked case_assessment, application_form, or financial_overview. The submission path preserves any version-managed Financial Overview found at case scope; Case 76 has an older case-level signed overview from the previous funding episode, so the new application skips generation and then fails the application-scoped required-category check. Make preservation application-aware and add a repeat-application regression test. No case/application/document data changed.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 171)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 171 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 172, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Confirmed a correction-workflow gap for historical entry. Case 30 has manual-backload Action Plan 146 and completed Intervention 316 created immediately before the report; the intervention has no intervention_cost, budget_amount, approved_amount, or actual_amount. Current deletion rules reject completed interventions, leaving staff unable to correct this accidental entry. A narrow guarded support repair is likely quick after explicit approval; the product fix should allow a safe audited correction path for recent dependency-free manual backloads. No case/intervention data changed.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 172)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 172 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 173, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Prevention hotfix and guarded Case 12 repair are already deployed. This is not low-hanging backlog work now: keep in_progress until staff review and send the corrected CFA, then recheck the resulting signing/document chain before resolving.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 173 AND status = 'in_progress')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 173 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 174, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Treat as a high-priority recurring data-loss investigation, not low-hanging UI polish. Application 187 / Case 248 was updated after the report and currently stores three proposed interventions but only one tuition cost line; the legacy ITP and wage payloads are empty. Kelly reports this is the second assessment whose financial portion disappeared overnight. Preserve the current row and investigate save/hydration/version-conflict history before changing code or asking staff to re-enter more data. No case/application/assessment data changed.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 174)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 174 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 175, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Confirmed accidental-denial recovery is required for Case 160 / Application 90 / workflow 26. The stored Decision Maker note asks Danielle to adjust living allowance and remove transportation, but the workflow is final_decision_recorded with nwac_decision=denied and the application is rejected. #176 is an exact duplicate and is closed against this report. Recovery must be separately reviewed and guarded; prevention belongs with #169 as one final-decision confirmation/UX fix. No case/application data changed.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 175)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 175 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 176, NULL, @actor_name, @actor_email,
       CONCAT(@note_prefix, ' Closed as an exact duplicate of bug #175: same reporter, Case 160 / Application 90, accidental denied state, and requested pricing corrections. Track the guarded recovery and prevention work on #175; no case/application data changed.'),
       @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 176)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 176 AND note_text LIKE CONCAT(@note_prefix, '%')
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (96,97,123,154,163,165,166,168,169,170,171,172,173,174,175,176)
 ORDER BY id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (168,169,170,171,172,174,175,176)
 ORDER BY report_id, changed_at DESC, id DESC;

SELECT report_id, author_name, author_email, created_at, LEFT(note_text, 220) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (96,97,123,154,163,165,166,168,169,170,171,172,173,174,175,176)
   AND note_text LIKE CONCAT(@note_prefix, '%')
 ORDER BY report_id, created_at DESC, id DESC;
