-- PROD feedback queue triage notes/status updates for 2026-05-22.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @triage_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'triaging', updated_at = @triage_at
 WHERE id = 110 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 110, 'submitted', 'triaging', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 110 AND status = 'triaging')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 110 AND previous_status = 'submitted' AND new_status = 'triaging' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 110, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-22: Case 85 has CFA series 10 with v1 sent/signed workflow requests from 2026-05-08 and a new v2 draft created 2026-05-21 after the Occupational Skills intervention update. The v2 clean/redline PDFs are active in Supporting Documents, but no v2 signing_request/message has been created yet. This appears to be an unclear follow-up/send path rather than missing draft generation. Verify whether staff can send the Client Funding Agreement again through secure messaging; likely UX improvement is a direct Send revised CFA action or clearer draft-vs-client-signed wording.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 110 AND note_text LIKE 'Codex triage 2026-05-22:%'
 );

UPDATE admin_feedback_report
   SET status = 'planned', updated_at = @triage_at
 WHERE id = 111 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 111, 'submitted', 'planned', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 111 AND status = 'planned')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 111 AND previous_status = 'submitted' AND new_status = 'planned' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 111, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-22: Kelly Hyde is active ISET Coordinator staff profile 58 and is directly assigned to case 82. The direct /cases/:caseId route matrix allows ISET Coordinators, but the Case Management landing route /iset/cases currently allows only System Administrator, NWAC Administrator, and Regional Manager, while the side nav still exposes a stale /case-management My Case Queue link with no active route. Confirmed access/navigation defect for coordinator case-management entry; plan a route/navigation fix so assigned coordinators can reach their client files without a direct deep link.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 111 AND note_text LIKE 'Codex triage 2026-05-22:%'
 );

UPDATE admin_feedback_report
   SET status = 'planned', updated_at = @triage_at
 WHERE id = 112 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 112, 'submitted', 'planned', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 112 AND status = 'planned')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 112 AND previous_status = 'submitted' AND new_status = 'planned' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 112, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-22: Residence Costs is not present in the PROD costing defaults or payment.intervention.payment_type_map runtime config; JSON searches for Residence/Housing/Rent returned no payment-type match. This is a valid change request. Implementation needs a named payment type/code, recurrence rule, payee/evidence expectations, and inclusion in assessment costing plus downstream payment/evidence config.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 112 AND note_text LIKE 'Codex triage 2026-05-22:%'
 );

UPDATE admin_feedback_report
   SET status = 'planned', updated_at = @triage_at
 WHERE id = 113 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 113, 'submitted', 'planned', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 113 AND status = 'planned')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 113 AND previous_status = 'submitted' AND new_status = 'planned' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 113, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-22: Case 107 / action plan 9 / intervention 15 has an approved proposal compatibility row (proposal 30) and no manual_backload/source=existing marker, so PATH correctly treats it as an approved intervention proposal needing approval-letter follow-up in Pending Completion. Reporter says this was an existing historical caseload entry and should not send an approval letter. Plan a fix/data-repair pattern for historical intervention entries that were entered through the proposal path so they can be marked as backloaded or letter-follow-up-complete without triggering applicant communication.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 113 AND note_text LIKE 'Codex triage 2026-05-22:%'
 );

UPDATE admin_feedback_report
   SET status = 'triaging', updated_at = @triage_at
 WHERE id = 114 AND status = 'submitted';
INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 114, 'submitted', 'triaging', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 114 AND status = 'triaging')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 114 AND previous_status = 'submitted' AND new_status = 'triaging' AND changed_by_name = @actor_name
   );
INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 114, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-22: Case 90 / application 8 already has an active EI Consent Form document (document 235) and the ISET client information release document type is active, but the matching signing workflow for that ISET release form is still draft/inactive. No admin upload error appeared in the current PM2 logs around the report. Keep in triaging until the exact selected document type and visible upload error are confirmed; likely candidates are document-type confusion between EI Consent Form and Authorization for release of ISET client information, or a client/application scope validation message in the upload modal.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 114 AND note_text LIKE 'Codex triage 2026-05-22:%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (110,111,112,113,114)
 ORDER BY id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (110,111,112,113,114)
 ORDER BY report_id, changed_at DESC, id DESC;

SELECT report_id, author_name, created_at, LEFT(note_text, 180) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (110,111,112,113,114)
 ORDER BY report_id, created_at DESC, id DESC;
