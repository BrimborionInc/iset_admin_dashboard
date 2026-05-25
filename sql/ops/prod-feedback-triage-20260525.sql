-- PROD feedback queue triage notes/status updates for 2026-05-25.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @triage_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'triaging', updated_at = @triage_at
 WHERE id = 117 AND status = 'submitted';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 117, 'submitted', 'triaging', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 117 AND status = 'triaging')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 117 AND previous_status = 'submitted' AND new_status = 'triaging' AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 117, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-25: Krista Caspick case 9/client 9 is linked to kaaylcee@gmail.com and remains invitation_sent. Staff resent the PATH activation email at 2026-05-25 12:58; Cognito user status was CONFIRMED before/after. Portal audit shows activation-code requests at 2026-05-25 13:07 and earlier attempts returned submitted with Cognito deliveryMedium=EMAIL/deliveryDestination=k***@g***; older 2026-05-19 attempts hit the daily forgot-password limit. This is not yet proven as a PATH code defect. Next step is support/deliverability triage: verify the recipient mailbox/provider, avoid repeated resend attempts that hit the daily limit, and consider an operator-assisted Cognito reset or alternate email only after confirming identity.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 117 AND note_text LIKE 'Codex triage 2026-05-25:%'
 );

UPDATE admin_feedback_report
   SET status = 'triaging', updated_at = @triage_at
 WHERE id = 118 AND status = 'submitted';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 118, 'submitted', 'triaging', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 118 AND status = 'triaging')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 118 AND previous_status = 'submitted' AND new_status = 'triaging' AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 118, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-25: Report came from case 120 / approved application 39 while a revision proposal draft 178 exists. Current code for the Other funding sources step does not expose a dollar amount field, but it does require Funder name and What this funder covers when Other funding involved=yes. The application assessment currently stores Other funding involved: No with notes about Band/Inspire funding. Keep in triaging until the exact screen/field is confirmed; likely fix is to relax or clarify other-funder validation/copy so staff can record a funding source with no known amount/coverage.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 118 AND note_text LIKE 'Codex triage 2026-05-25:%'
 );

UPDATE admin_feedback_report
   SET status = 'closed', updated_at = @triage_at
 WHERE id = 119 AND status = 'submitted';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 119, 'submitted', 'closed', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 119 AND status = 'closed')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 119 AND previous_status = 'submitted' AND new_status = 'closed' AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 119, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-25: Case 81 is an imported/application-less file assigned to Kelly Hyde. Add existing action plan/intervention/documents is intentionally under Case header > Quick actions, not Quick layouts, and current role gating shows historical-entry actions only to System Administrator, Program/NWAC Administrator, and Regional Manager. Kelly is an ISET Coordinator, so the action is hidden by current security design. Closing as support/by-design; if coordinators should be allowed to backload existing files, open a separate role-policy change request.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 119 AND note_text LIKE 'Codex triage 2026-05-25:%'
 );

UPDATE admin_feedback_report
   SET status = 'planned', updated_at = @triage_at
 WHERE id = 120 AND status = 'submitted';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 120, 'submitted', 'planned', NULL, @actor_name, @actor_email, @triage_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 120 AND status = 'planned')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 120 AND previous_status = 'submitted' AND new_status = 'planned' AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 120, NULL, @actor_name, @actor_email,
       'Codex triage 2026-05-25: Confirmed for Shelly Van Loon case 85. CFA v2/version 12 was generated and sent on 2026-05-22 with revised totals (tuition 3350, living allowance 1450/month x6, reimbursement 112; total 12162). However signing request 40 for the Funding Revision Approval / Letter of Approval still contains the old v1 approval-letter text: tuition 3550 and living allowance 200/month. The attached Client Funding Agreement signing request 42 points to CFA v2 redline correctly. Planned fix: make the revision approval letter body regenerate from the revised intervention/CFA snapshot instead of stale original application approval-letter content, then decide whether this case needs a corrected resend.',
       @triage_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 120 AND note_text LIKE 'Codex triage 2026-05-25:%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (117,118,119,120)
 ORDER BY id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (117,118,119,120)
 ORDER BY report_id, changed_at DESC, id DESC;

SELECT report_id, author_name, created_at, LEFT(note_text, 220) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (117,118,119,120)
 ORDER BY report_id, created_at DESC, id DESC;
