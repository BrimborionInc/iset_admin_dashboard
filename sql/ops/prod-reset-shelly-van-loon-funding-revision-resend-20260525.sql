-- Controlled PROD reset so Shelly Van Loon's funding revision packet can be resent from the corrected workflow.
-- Scope:
--   - Cancel only the bad 2026-05-22 signing requests linked to message 384.
--   - Put CFA v2/version 12 back to draft so the normal send flow can attach it again.
--   - Remove only the approval-letter-follow-up sent marker from intervention/proposal metadata.
--   - Add feedback notes to #120 and #122.
--
-- This does not delete messages, documents, interventions, applications, or client records.

SET @case_id := 85;
SET @intervention_id := 57;
SET @bad_message_id := 384;
SET @bad_letter_request_id := 40;
SET @bad_eft_request_id := 41;
SET @bad_cfa_request_id := 42;
SET @cfa_version_id := 12;
SET @proposal_id := 143;
SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

SELECT COUNT(*)
  INTO @bad_request_count
  FROM signing_request sr
  JOIN message_signing_request msr
    ON msr.signing_request_id = sr.id
 WHERE sr.id IN (@bad_letter_request_id, @bad_eft_request_id, @bad_cfa_request_id)
   AND sr.case_id = @case_id
   AND msr.message_id = @bad_message_id
   AND sr.signed_at IS NULL
   AND sr.status IN ('pending', 'viewed');

SELECT COUNT(*)
  INTO @stale_letter_count
  FROM signing_request
 WHERE id = @bad_letter_request_id
   AND workflow_id = 46
   AND JSON_UNQUOTE(JSON_EXTRACT(resolved_schema_json, '$.steps[0].components[0].html.en')) LIKE '%$3550.00%'
   AND JSON_UNQUOTE(JSON_EXTRACT(resolved_schema_json, '$.steps[0].components[0].html.en')) LIKE '%$200.00/month%';

SELECT COUNT(*)
  INTO @cfa_request_count
  FROM signing_request
 WHERE id = @bad_cfa_request_id
   AND workflow_id = 45
   AND JSON_UNQUOTE(JSON_EXTRACT(resolved_schema_json, '$.meta.cfaVersionId')) = CAST(@cfa_version_id AS CHAR)
   AND JSON_UNQUOTE(JSON_EXTRACT(resolved_schema_json, '$.meta.cfaVersionNumber')) = '2'
   AND signed_at IS NULL;

SELECT COUNT(*)
  INTO @cfa_version_count
  FROM cfa_version v
  JOIN cfa_series s
    ON s.id = v.series_id
 WHERE v.id = @cfa_version_id
   AND s.case_id = @case_id
   AND v.version_number = 2
   AND v.status = 'sent'
   AND v.signed_at IS NULL;

SELECT COUNT(*)
  INTO @follow_up_count
  FROM iset_case_intervention
 WHERE id = @intervention_id
   AND case_id = @case_id
   AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.approvalLetterFollowUp.messageId')) = CAST(@bad_message_id AS CHAR);

CREATE TEMPORARY TABLE shelly_van_loon_reset_guard (
  ok INT NOT NULL
) ENGINE=MEMORY;

INSERT INTO shelly_van_loon_reset_guard (ok)
SELECT CASE
  WHEN @bad_request_count = 3
   AND @stale_letter_count = 1
   AND @cfa_request_count = 1
   AND @cfa_version_count = 1
   AND @follow_up_count = 1
  THEN 1
  ELSE NULL
END;

UPDATE signing_request
   SET status = 'cancelled',
       updated_at = @note_at
 WHERE id IN (@bad_letter_request_id, @bad_eft_request_id, @bad_cfa_request_id)
   AND case_id = @case_id
   AND signed_at IS NULL
   AND status IN ('pending', 'viewed');

UPDATE cfa_version
   SET status = 'draft',
       sent_at = NULL,
       sent_by_staff_profile_id = NULL
 WHERE id = @cfa_version_id
   AND status = 'sent'
   AND signed_at IS NULL;

UPDATE iset_case_intervention
   SET metadata_json = JSON_REMOVE(metadata_json, '$.approvalLetterFollowUp', '$.approval_letter_follow_up'),
       updated_at = @note_at
 WHERE id = @intervention_id
   AND case_id = @case_id;

UPDATE iset_intervention_proposal
   SET metadata_json = JSON_REMOVE(metadata_json, '$.approvalLetterFollowUp', '$.approval_letter_follow_up'),
       updated_at = @note_at
 WHERE id = @proposal_id
   AND case_id = @case_id;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT report_id, NULL, @actor_name, @actor_email, note_text, @note_at
  FROM (
    SELECT 120 AS report_id,
           CONCAT(
             'Codex recovery 2026-05-25: Per Bill request, reset Shelly Van Loon case 85 so Emilie can resend the corrected funding-revision packet through the normal workflow. ',
             'Cancelled unsigned signing requests 40/41/42 from bad message 384, put CFA v2/version 12 back to draft, and removed the sent/completed approvalLetterFollowUp marker from intervention 57/proposal 143. ',
             'The PROD code fix is already live, so the next Send client funding revision letter action should create a corrected funding revision letter from the reviewed secure-message body and attach CFA v2/EFT signing requests again. Keep report #120 in_progress until Emilie sends and the new client-facing packet is checked.'
           ) AS note_text
    UNION ALL
    SELECT 122 AS report_id,
           CONCAT(
             'Codex recovery 2026-05-25: Reset Shelly Van Loon case 85 for controlled resend instead of advising a generic secure message. ',
             'Cancelled unsigned signing requests 40/41/42 from bad message 384, put CFA v2/version 12 back to draft, and reopened the intervention funding-revision follow-up by removing approvalLetterFollowUp from intervention 57/proposal 143. ',
             'Emilie should now use Case Workspace > Interventions > Prepare funding revision letter > Generate drafts > Send client funding revision letter. Close this report only after the new packet is verified.'
           ) AS note_text
  ) AS notes
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note existing
    WHERE existing.report_id = notes.report_id
      AND existing.note_text LIKE 'Codex recovery 2026-05-25: Reset Shelly Van Loon case 85%'
 );

COMMIT;

SELECT id, workflow_id, workflow_name, status, signed_at, updated_at
  FROM signing_request
 WHERE id IN (@bad_letter_request_id, @bad_eft_request_id, @bad_cfa_request_id)
 ORDER BY id;

SELECT v.id, v.version_number, v.status, v.sent_at, v.signed_at
  FROM cfa_version v
 WHERE v.id = @cfa_version_id;

SELECT id,
       JSON_EXTRACT(metadata_json, '$.approvalLetterFollowUp') AS intervention_follow_up
  FROM iset_case_intervention
 WHERE id = @intervention_id;

SELECT id,
       JSON_EXTRACT(metadata_json, '$.approvalLetterFollowUp') AS proposal_follow_up
  FROM iset_intervention_proposal
 WHERE id = @proposal_id;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (120, 122)
 ORDER BY id;
