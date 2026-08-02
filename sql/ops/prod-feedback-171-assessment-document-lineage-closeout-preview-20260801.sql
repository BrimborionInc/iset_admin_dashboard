-- Read-only preview for feedback #171 PROD closeout.
-- Verified PROD schema: iset_intake on ip-172-16-0-77 as app_admin@%.

SELECT id, report_type, severity, status, summary, page_url, updated_at
  FROM admin_feedback_report
 WHERE id = 171;

SELECT COUNT(*) AS qualifying_report_rows
  FROM admin_feedback_report
 WHERE id = 171
   AND report_type = 'bug'
   AND status = 'planned'
   AND summary = 'Assessment Required'
   AND page_url = 'https://nwac-console.awentech.ca/application-case/76';

SELECT COUNT(*) AS required_prerelease_notes
  FROM admin_feedback_note
 WHERE report_id = 171
   AND id = 508
   AND author_email = 'codex@openai.com'
   AND note_text LIKE 'Codex implementation and qualification update 2026-07-31:%';

SELECT id, report_id, previous_status, new_status,
       changed_by_name, changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 171
 ORDER BY id DESC
 LIMIT 8;

SELECT id, report_id, author_name, author_email, created_at,
       LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 171
 ORDER BY id DESC
 LIMIT 8;
