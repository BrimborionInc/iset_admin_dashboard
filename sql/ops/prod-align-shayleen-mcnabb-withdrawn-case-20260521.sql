-- Align Shayleen McNabb's already-withdrawn application with the case lifecycle.
-- Scope: case 94 / application 12 only. No action plans or interventions are created.

SET @case_id := 94;
SET @application_id := 12;
SET @repair_at := NOW();

START TRANSACTION;

SELECT COUNT(*) INTO @eligible
  FROM iset_case c
  JOIN iset_application a ON a.id = @application_id AND a.case_id = c.id
 WHERE c.id = @case_id
   AND LOWER(COALESCE(a.status, '')) = 'withdrawn'
   AND LOWER(COALESCE(a.lifecycle_status, '')) = 'closed'
   AND LOWER(COALESCE(a.closure_reason, '')) = 'withdrawn'
   AND NOT EXISTS (
     SELECT 1 FROM iset_case_action_plan ap WHERE ap.case_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1 FROM iset_case_intervention ci WHERE ci.case_id = c.id
   )
   AND NOT EXISTS (
     SELECT 1
       FROM iset_case_task t
      WHERE t.case_id = c.id
        AND LOWER(COALESCE(t.status, '')) IN ('open', 'in_progress', 'in-progress', 'inprogress')
   )
   AND NOT EXISTS (
     SELECT 1
       FROM iset_application_escalation e
      WHERE e.application_id = a.id
        AND LOWER(COALESCE(e.state, '')) NOT IN ('resolved', 'closed', 'cancelled')
   )
   AND NOT EXISTS (
     SELECT 1
       FROM iset_application other_app
      WHERE other_app.case_id = c.id
        AND other_app.id <> a.id
        AND NOT (
          LOWER(COALESCE(other_app.status, '')) IN ('approved', 'completed', 'complete', 'rejected', 'declined', 'denied', 'withdrawn', 'cancelled', 'closed', 'archived')
          OR LOWER(COALESCE(other_app.lifecycle_status, '')) IN ('closed', 'archived')
        )
   );

UPDATE iset_case
   SET status = 'closed',
       lifecycle_status = 'closed',
       closure_reason = 'withdrawn',
       closed_at = COALESCE(closed_at, @repair_at),
       updated_at = @repair_at
 WHERE id = @case_id
   AND @eligible = 1;

SET @case_rows := ROW_COUNT();

UPDATE iset_case_reminder
   SET status = 'completed',
       completed_at = COALESCE(completed_at, @repair_at),
       deleted_at = COALESCE(deleted_at, @repair_at),
       updated_at = @repair_at
 WHERE @case_rows = 1
   AND case_id = @case_id
   AND status = 'open'
   AND deleted_at IS NULL
   AND title IN (
     'Application to be closed if she doesn''t get back to us.',
     'Wants to withdraw, how do I record that?'
   );

SET @reminder_rows := ROW_COUNT();

INSERT INTO iset_case_note
  (case_id, author_staff_profile_id, author_user_id, body, is_internal, is_pinned, follow_up_at, created_at, updated_at)
SELECT @case_id, NULL, NULL,
       'Codex data repair 2026-05-21: application 12 was already marked withdrawn/closed, so the case lifecycle was aligned to closed/withdrawn and stale withdrawal follow-up reminders were completed. No denial-reporting interventions were created because a withdrawal is not a denial.',
       1, 0, NULL, @repair_at, @repair_at
 WHERE @case_rows = 1
   AND NOT EXISTS (
     SELECT 1
       FROM iset_case_note
      WHERE case_id = @case_id
        AND body LIKE 'Codex data repair 2026-05-21:%'
   );

SELECT @eligible AS eligible, @case_rows AS case_rows_updated, @reminder_rows AS reminders_completed;

COMMIT;
