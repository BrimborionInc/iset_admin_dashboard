-- Resolve PROD feedback #137 after code/deployed-source and live readiness recheck.
-- Scope: admin_feedback_* tables only. No client/case/application/action-plan data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @resolved_at := NOW();
SET @previous_status_137 := NULL;

START TRANSACTION;

SELECT status
  INTO @previous_status_137
  FROM admin_feedback_report
 WHERE id = 137
   AND summary = 'ILMP manual backloaded action plans do not reliably inherit participant/application facts'
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @resolved_at
 WHERE id = 137
   AND @previous_status_137 IS NOT NULL
   AND @previous_status_137 <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 137, @previous_status_137, 'resolved', NULL, @actor_name, @actor_email, @resolved_at
 WHERE @previous_status_137 IS NOT NULL
   AND @previous_status_137 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 137
        AND previous_status = @previous_status_137
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 137, NULL, @actor_name, @actor_email,
       'Codex resolution 2026-06-14: Code status and live target recheck confirm report #137 is resolved. Prevention code is deployed in PROD: Add Existing Action Plan now captures required Appendix A action-plan reporting facts before save; the backend create route enforces the same education/social-assistance/EI/previous-employment/barrier fields; historical action-plan and intervention saves seed blank Participant Details from structured backload ILMP data without overwriting staff-entered values. Focused local verification passed: CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/lib/__tests__/backloadParticipantDetailsSeeding.test.js src/lib/__tests__/ilmpActionPlanBarrierContext.test.js src/lib/__tests__/actionPlanStartEducationRequirement.test.js. PROD deployed-source check on i-034c7daa416ec6865 found seedParticipantDetailsFromBackloadActionPlan, seedParticipantDetailsFromBackloadIntervention, education_level_required, barrier_to_employment_required, and the Existing Action Plan modal fields. The original Shayleen McNabb target is now clean: case ISET-20260410-78062A / action plan 53 has BarrierToEmployment [7,8], EIClaimant 2, previous NOC 41301 / 2021, and esdc_participant_submission 115 is readiness_status ready with last_validated_at 2026-06-12 21:00:35. Root Participant Details barriers may remain blank, but validation/export correctly use action-plan barrier codes for this backloaded plan. No case/action-plan/client rows were mutated by this resolution step.',
       @resolved_at
 WHERE @previous_status_137 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 137
        AND note_text LIKE 'Codex resolution 2026-06-14: Code status and live target recheck confirm report #137 is resolved%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 137;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 137
 ORDER BY id DESC
 LIMIT 3;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 137
 ORDER BY id DESC
 LIMIT 3;
