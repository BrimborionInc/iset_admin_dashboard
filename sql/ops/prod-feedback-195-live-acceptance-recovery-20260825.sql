-- Emergency recovery for the 2026-08-25 feedback #195 live-acceptance note.
-- Do not execute unless the appended note is proven factually incorrect.

START TRANSACTION;

DELETE FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 195
   AND admin_feedback_note.author_staff_profile_id IS NULL
   AND admin_feedback_note.author_name = 'Codex'
   AND admin_feedback_note.author_email IS NULL
   AND admin_feedback_note.note_text = 'Codex live acceptance correction 2026-08-25: The earlier release closeout was premature because source, unit, readiness, and deployment checks did not reproduce the reporter journey. PROD ALB evidence later showed the first post-release attempt from the already-open browser session still sent the legacy PUT /api/cases/279 and received 422. The currently served PROD bundle was then independently exercised with every API call intercepted: Participant Details sent only PATCH /api/cases/279/participant-details with participantDetails.postalCode, sent no legacy whole-case PUT, displayed success, and rehydrated the saved value after reload. Bill subsequently completed the real authenticated PROD journey for Maria Gordon, case 279 / application 218, and confirmed that the postcode could be edited successfully in the Participant Details widget. This user verification is the actual basis for retaining status resolved.';

COMMIT;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 195
 ORDER BY admin_feedback_note.id;
