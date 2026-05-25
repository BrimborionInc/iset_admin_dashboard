-- PROD feedback #118 clarification note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @noted_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 118, NULL, @actor_name, @actor_email,
       'Codex clarification 2026-05-25: Interpreted report #118 as a proposed-intervention revision form issue in case 120 / application 39 / revision proposal draft 178. The live draft is a revision of approved hairstyling intervention 114. The original application assessment records Other funding involved: No, with notes that Band funding was denied and Inspire Grants were pending/not reviewing until August 2026. The current revision draft stores otherFundingDetails as null, and the UI Other funding step has no dollar-amount field; it asks for funder name plus What this funder covers, while the separate Costs step requires dollar amounts on cost lines. Likely meaning: K. Hyde is trying to record outside funding attempts/status where there is no confirmed amount or coverage, and the form copy/validation makes that feel like a dollar/coverage amount is required. Proposed recovery: adjust the Other funding source model/copy so staff can record funder status such as denied, pending, unknown, or no confirmed amount without inventing a dollar amount or coverage description; preserve prior assessment other-funding notes when opening a revision where possible.',
       @noted_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 118
      AND note_text LIKE 'Codex clarification 2026-05-25: Interpreted report #118 as a proposed-intervention revision form issue%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 118;

SELECT report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 118
 ORDER BY created_at DESC, id DESC
 LIMIT 3;
