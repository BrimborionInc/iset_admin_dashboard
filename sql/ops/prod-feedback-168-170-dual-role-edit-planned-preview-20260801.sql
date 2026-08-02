-- Read-only preview for marking feedback #168 and #170 planned after DEV qualification.

SELECT id, report_type, severity, status, summary, page_url, updated_at
  FROM admin_feedback_report
 WHERE id IN (168, 170)
 ORDER BY id;

SELECT COUNT(*) AS qualifying_report_rows
  FROM admin_feedback_report
 WHERE (id = 168 AND report_type = 'bug' AND status = 'triaging' AND summary = 'Stepanie Ewasiuk File')
    OR (id = 170 AND report_type = 'bug' AND status = 'triaging' AND summary = 'Not able to edit assessment after Admin requested changes');

SELECT COUNT(*) AS required_triage_notes
  FROM admin_feedback_note
 WHERE (id = 492 AND report_id = 168 AND author_email = 'codex@openai.com')
    OR (id = 494 AND report_id = 170 AND author_email = 'codex@openai.com');

SELECT COUNT(*) AS existing_qualification_notes
  FROM admin_feedback_note
 WHERE report_id IN (168, 170)
   AND author_email = 'codex@openai.com'
   AND note_text LIKE 'Codex implementation and qualification update 2026-08-01:%';

SELECT id, report_id, author_name, author_email, created_at,
       LEFT(note_text, 1200) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (168, 170)
 ORDER BY report_id, created_at DESC, id DESC;
