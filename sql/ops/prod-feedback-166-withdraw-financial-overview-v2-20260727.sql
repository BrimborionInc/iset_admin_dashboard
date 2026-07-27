-- PROD reviewed support repair for feedback #166 / Case 172.
--
-- Approved scope:
-- - withdraw the July 24 Financial Overview v2 request from the participant;
-- - cancel signing request 136 and mark version 18 withdrawn;
-- - archive only the unsigned v2 clean/redline documents;
-- - withdraw/redact message 1924 from both mailboxes and its send event;
-- - cancel the two automatic reminders created with that request;
-- - leave signed v1 document 5539 active and leave the application's
--   docs-requested state intact because Rent Assist evidence is still required.
--
-- The original message body is deliberately not copied into this artifact.
-- Message redaction is recoverable only from an approved database restore/audit
-- source; the version, request, documents, mailbox rows, and reminders can be
-- restored by reversing their status fields if business direction changes.

START TRANSACTION;

SET @feedback_report_id := 166;
SET @case_id := 172;
SET @application_id := 103;
SET @participant_user_id := 180;
SET @sender_user_id := 120;
SET @sender_staff_profile_id := 60;
SET @message_id := 1924;
SET @signing_request_id := 136;
SET @version_id := 18;
SET @signed_v1_document_id := 5539;
SET @clean_v2_document_id := 7687;
SET @redline_v2_document_id := 7688;
SET @send_event_id := '407345d9-2598-4031-9f54-d9816f2399b4';
SET @reminder_id_one := 190;
SET @reminder_id_two := 191;
SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @now := NOW();
SET @expected_subject_sha256 := SHA2('Re: ISET Application', 256);
SET @expected_body_sha256 := '2c414b7b83eb217bc5a95440f848b2763d6febb98d978f99c50b898396a460cc';
SET @withdrawn_subject := 'Message withdrawn';
SET @withdrawn_body := 'This secure message and its signing request have been withdrawn. No action is required.';
SET @withdrawn_event_subject := '[withdrawn] Message withdrawn';

SET @message_guard_count := (
  SELECT COUNT(*)
    FROM messages m
    JOIN message_signing_request msr
      ON msr.message_id = m.id
     AND msr.signing_request_id = @signing_request_id
   WHERE m.id = @message_id
     AND m.case_id = @case_id
     AND m.application_id = @application_id
     AND m.sender_actor_type = 'staff_profile'
     AND m.sender_user_id = @sender_user_id
     AND m.sender_staff_profile_id = @sender_staff_profile_id
     AND m.recipient_actor_type = 'applicant_user'
     AND m.recipient_user_id = @participant_user_id
     AND m.status = 'read'
     AND m.deleted = 0
     AND SHA2(m.subject, 256) = @expected_subject_sha256
     AND SHA2(m.body, 256) = @expected_body_sha256
);

SET @mailbox_guard_count := (
  SELECT COUNT(*)
    FROM message_item
   WHERE message_id = @message_id
     AND purged_at IS NULL
     AND (
       (owner_user_id = @sender_user_id AND folder = 'sent')
       OR
       (owner_user_id = @participant_user_id AND folder = 'inbox')
     )
);

SET @request_guard_count := (
  SELECT COUNT(*)
    FROM signing_request
   WHERE id = @signing_request_id
     AND case_id = @case_id
     AND participant_user_id = @participant_user_id
     AND created_by_user_id = @sender_user_id
     AND status = 'viewed'
     AND signed_at IS NULL
     AND checklist_doc_type = 'financial_overview'
     AND JSON_UNQUOTE(JSON_EXTRACT(resolved_schema_json, '$.meta.fundingOverviewVersionId')) = CAST(@version_id AS CHAR)
);

SET @version_guard_count := (
  SELECT COUNT(*)
    FROM funding_overview_version
   WHERE id = @version_id
     AND series_id = 6
     AND version_number = 2
     AND status = 'sent'
     AND supersedes_version_id = 7
     AND signed_at IS NULL
     AND signed_by_participant_id IS NULL
);

SET @v2_document_guard_count := (
  SELECT COUNT(*)
    FROM funding_overview_version_documents vd
    JOIN iset_document d
      ON d.id = vd.document_id
   WHERE vd.funding_overview_version_id = @version_id
     AND (
       (vd.document_type = 'clean' AND d.id = @clean_v2_document_id)
       OR
       (vd.document_type = 'redline' AND d.id = @redline_v2_document_id)
     )
     AND d.case_id = @case_id
     AND d.application_id = @application_id
     AND d.status = 'active'
     AND d.document_category = 'financial_overview'
);

SET @signed_v1_guard_count := (
  SELECT COUNT(*)
    FROM iset_document d
    JOIN funding_overview_version_documents vd
      ON vd.document_id = d.id
     AND vd.funding_overview_version_id = 7
     AND vd.document_type = 'signed'
    JOIN funding_overview_version v
      ON v.id = vd.funding_overview_version_id
     AND v.status = 'signed'
   WHERE d.id = @signed_v1_document_id
     AND d.case_id = @case_id
     AND d.application_id = @application_id
     AND d.status = 'active'
);

SET @event_guard_count := (
  SELECT COUNT(*)
    FROM iset_event_entry
   WHERE id = @send_event_id
     AND event_type = 'staff_secure_message_sent'
     AND subject_type = 'case'
     AND subject_id = CAST(@case_id AS CHAR)
     AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.message_id')) = CAST(@message_id AS CHAR)
     AND SHA2(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.message_subject')), 256) = @expected_subject_sha256
);

SET @reminder_guard_count := (
  SELECT COUNT(*)
    FROM iset_case_reminder
   WHERE id IN (@reminder_id_one, @reminder_id_two)
     AND case_id = @case_id
     AND application_id = @application_id
     AND status = 'open'
     AND deleted_at IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'docs_requested'
     AND created_at = '2026-07-24 15:39:56'
);

SET @application_guard_count := (
  SELECT COUNT(*)
    FROM iset_application
   WHERE id = @application_id
     AND case_id = @case_id
     AND status = 'docs_requested'
     AND docs_requested_active = 1
     AND docs_requested_source = 'secure_message'
);

SET @feedback_guard_count := (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE id = @feedback_report_id
     AND submitted_by_email = 'emarion@nwac.ca'
     AND summary = 'Financial Overview'
     AND status = 'in_progress'
);

SET @all_guards_ready := (
  @message_guard_count = 1
  AND @mailbox_guard_count = 2
  AND @request_guard_count = 1
  AND @version_guard_count = 1
  AND @v2_document_guard_count = 2
  AND @signed_v1_guard_count = 1
  AND @event_guard_count = 1
  AND @reminder_guard_count = 2
  AND @application_guard_count = 1
  AND @feedback_guard_count = 1
);

CREATE TEMPORARY TABLE tmp_feedback_166_v2_guard (
  guard_name VARCHAR(64) PRIMARY KEY
) ENGINE=Memory;

INSERT INTO tmp_feedback_166_v2_guard (guard_name) VALUES ('ready');

-- Deliberately fail if any exact expected row has drifted.
INSERT INTO tmp_feedback_166_v2_guard (guard_name)
SELECT 'ready'
WHERE @all_guards_ready <> 1;

UPDATE funding_overview_version
   SET status = 'withdrawn'
 WHERE id = @version_id
   AND status = 'sent'
   AND @all_guards_ready = 1;

UPDATE signing_request
   SET status = 'cancelled',
       updated_at = @now
 WHERE id = @signing_request_id
   AND status = 'viewed'
   AND @all_guards_ready = 1;

UPDATE iset_document
   SET status = 'archived',
       updated_at = @now
 WHERE id IN (@clean_v2_document_id, @redline_v2_document_id)
   AND status = 'active'
   AND @all_guards_ready = 1;

UPDATE messages
   SET subject = @withdrawn_subject,
       body = @withdrawn_body,
       status = 'archived',
       deleted = 1
 WHERE id = @message_id
   AND @all_guards_ready = 1;

UPDATE message_item
   SET folder_before_deleted = CASE
         WHEN folder IN ('inbox', 'sent') THEN folder
         ELSE folder_before_deleted
       END,
       folder = 'deleted',
       deleted_at = COALESCE(deleted_at, @now),
       purged_at = NULL,
       updated_at = @now
 WHERE message_id = @message_id
   AND owner_user_id IN (@sender_user_id, @participant_user_id)
   AND @all_guards_ready = 1;

UPDATE iset_event_entry
   SET payload_json = JSON_SET(payload_json, '$.message_subject', @withdrawn_event_subject)
 WHERE id = @send_event_id
   AND @all_guards_ready = 1;

UPDATE iset_case_reminder
   SET status = 'cancelled',
       deleted_at = @now,
       updated_at = @now
 WHERE id IN (@reminder_id_one, @reminder_id_two)
   AND status = 'open'
   AND deleted_at IS NULL
   AND @all_guards_ready = 1;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT
  @feedback_report_id,
  NULL,
  @actor_name,
  @actor_email,
  'Codex support repair 2026-07-27, approved by Bill after reporter confirmation: Withdrew Financial Overview v2 for Case 172. Signing request 136 is cancelled; funding overview version 18 is withdrawn; unsigned v2 documents 7687 and 7688 are archived; message 1924 is redacted/withdrawn from both sender and participant mailbox views; and its two automatic docs-requested reminders are cancelled. Signed v1 document 5539 remains active. The application remains in docs-requested state because Rent Assist supporting documentation is still required. Report remains in_progress pending deployment and targeted verification of the prevention fix.',
  @now
WHERE @all_guards_ready = 1
  AND NOT EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = @feedback_report_id
       AND note_text LIKE 'Codex support repair 2026-07-27, approved by Bill after reporter confirmation: Withdrew Financial Overview v2%'
  );

COMMIT;

SELECT
  @message_guard_count AS message_guard_count,
  @mailbox_guard_count AS mailbox_guard_count,
  @request_guard_count AS request_guard_count,
  @version_guard_count AS version_guard_count,
  @v2_document_guard_count AS v2_document_guard_count,
  @signed_v1_guard_count AS signed_v1_guard_count,
  @event_guard_count AS event_guard_count,
  @reminder_guard_count AS reminder_guard_count,
  @application_guard_count AS application_guard_count,
  @feedback_guard_count AS feedback_guard_count,
  @all_guards_ready AS all_guards_ready;

SELECT id, status, signed_at, updated_at
  FROM signing_request
 WHERE id = @signing_request_id;

SELECT id, version_number, status, signed_at
  FROM funding_overview_version
 WHERE id IN (7, @version_id)
 ORDER BY version_number;

SELECT id, status, file_name, case_id, application_id, updated_at
  FROM iset_document
 WHERE id IN (@signed_v1_document_id, @clean_v2_document_id, @redline_v2_document_id)
 ORDER BY id;

SELECT id, subject, status, deleted
  FROM messages
 WHERE id = @message_id;

SELECT id, owner_user_id, folder, folder_before_deleted, deleted_at, purged_at
  FROM message_item
 WHERE message_id = @message_id
 ORDER BY owner_user_id;

SELECT id, event_type, JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.message_subject')) AS message_subject
  FROM iset_event_entry
 WHERE id = @send_event_id;

SELECT id, status, deleted_at
  FROM iset_case_reminder
 WHERE id IN (@reminder_id_one, @reminder_id_two)
 ORDER BY id;

SELECT id, status, docs_requested_active, docs_requested_source, row_version
  FROM iset_application
 WHERE id = @application_id;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = @feedback_report_id
 ORDER BY id DESC
 LIMIT 3;
