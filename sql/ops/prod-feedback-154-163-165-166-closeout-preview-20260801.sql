-- Read-only preview for guarded PROD feedback closeout on 2026-08-01.
-- Verified target: AWS account 468278742295, iset_intake on ip-172-16-0-77,
-- current account app_admin@%, authenticated through the current PROD app host.

SELECT id, report_type, severity, status, summary, page_url, updated_at
  FROM admin_feedback_report
 WHERE id IN (154, 163, 165, 166)
 ORDER BY id;

SELECT COUNT(*) AS qualifying_report_rows
  FROM admin_feedback_report
 WHERE (id = 154 AND report_type = 'bug' AND status = 'in_progress' AND summary = 'Deleted secure message')
    OR (id = 163 AND report_type = 'bug' AND status = 'triaging' AND summary = 'Email not received')
    OR (id = 165 AND report_type = 'bug' AND status = 'in_progress' AND summary = 'Action Plan')
    OR (id = 166 AND report_type = 'bug' AND status = 'in_progress' AND summary = 'Financial Overview');

SELECT COUNT(*) AS required_latest_evidence_notes
  FROM admin_feedback_note
 WHERE (id = 488 AND report_id = 154 AND author_email = 'codex@openai.com')
    OR (id = 489 AND report_id = 163 AND author_email = 'codex@openai.com')
    OR (id = 490 AND report_id = 165 AND author_email = 'codex@openai.com')
    OR (id = 491 AND report_id = 166 AND author_email = 'codex@openai.com');

SELECT COUNT(*) AS existing_queue_closeout_notes
  FROM admin_feedback_note
 WHERE report_id IN (154, 163, 165, 166)
   AND author_email = 'codex@openai.com'
   AND note_text LIKE 'Codex queue closeout 2026-08-01:%';

SELECT id, report_id, author_name, author_email, created_at,
       LEFT(note_text, 1000) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (154, 163, 165, 166)
 ORDER BY report_id, created_at DESC, id DESC;
