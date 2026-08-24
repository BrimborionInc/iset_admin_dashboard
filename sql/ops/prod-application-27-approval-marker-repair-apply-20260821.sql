-- Guarded one-record PROD repair for the historical application 27 approval
-- letter send. This mirrors recordApplicationDecisionLetterSent for an
-- approved application: add the application-scoped sent marker, update the
-- case timestamp, and increment the application row_version/timestamp.
--
-- No status, lifecycle, decision, message, signing request, document,
-- notification, provider, schema, or configuration field is changed.

CREATE TEMPORARY TABLE tmp_application_27_marker_repair_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

SET @application_27_approval_sent_at := '2026-08-11T15:08:14.000Z';
SET @application_27_context_before_sha256 := '83342e03e54a138b2b3bc921574f91158aa8917561702e987b8e6a77b4d6eb30';
SET @application_27_context_after_sha256 := 'eb277b1fe642cc53c05fe335082decf1ee7e4fce2be68c0106af366d3b8eb937';
SET @application_27_marker_repair_at := CURRENT_TIMESTAMP;

START TRANSACTION;

-- Lock the absent application-lock key first so a browser editor cannot
-- acquire the application while the repair transaction is open.
SELECT application_lock.application_id,
       application_lock.acquired_at,
       application_lock.expires_at
  FROM application_lock
 WHERE application_lock.application_id = 27
 FOR UPDATE;

SELECT iset_application.id,
       iset_application.case_id,
       iset_application.client_id,
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       iset_application.awaiting_reason,
       iset_application.closure_reason,
       iset_application.row_version,
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.id = 27
   AND iset_application.case_id = 109
 FOR UPDATE;

SELECT iset_case.id,
       iset_case.status,
       iset_case.lifecycle_status,
       SHA2(CAST(iset_case.case_context_json AS CHAR), 256),
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 109
 FOR UPDATE;

INSERT INTO tmp_application_27_marker_repair_guard (guard_key)
VALUES ('preconditions_match');

-- A duplicate primary-key error aborts the non-force mysql batch and the open
-- transaction rolls back if any exact application, context, lock, send,
-- signing, or durable-document precondition has drifted.
INSERT INTO tmp_application_27_marker_repair_guard (guard_key)
SELECT 'preconditions_match'
 WHERE NOT (
       NOT EXISTS (
         SELECT 1
           FROM application_lock
          WHERE application_lock.application_id = 27
       )
       AND EXISTS (
         SELECT 1
           FROM iset_application
          WHERE iset_application.id = 27
            AND iset_application.case_id = 109
            AND iset_application.client_id = 91
            AND iset_application.status = 'approved'
            AND iset_application.lifecycle_status = 'decision_recorded'
            AND iset_application.decision_outcome = 'approved'
            AND iset_application.awaiting_reason = 'none'
            AND iset_application.closure_reason IS NULL
            AND iset_application.row_version = 81
            AND iset_application.updated_at = '2026-08-11 23:52:14'
       )
       AND NOT EXISTS (
         SELECT 1
           FROM iset_application
          WHERE iset_application.case_id = 109
            AND iset_application.id <> 27
       )
       AND EXISTS (
         SELECT 1
           FROM iset_case
          WHERE iset_case.id = 109
            AND iset_case.status = 'initiated'
            AND iset_case.lifecycle_status = 'initiated'
            AND iset_case.updated_at = '2026-08-11 15:08:12'
            AND JSON_TYPE(iset_case.case_context_json) = 'OBJECT'
            AND JSON_TYPE(
                  JSON_EXTRACT(
                    iset_case.case_context_json,
                    '$.applicationDecisionLetters."27"'
                  )
                ) = 'OBJECT'
            AND JSON_EXTRACT(
                  iset_case.case_context_json,
                  '$.applicationDecisionLetters."27".decisionLetterSent'
                ) IS NULL
            AND JSON_EXTRACT(
                  iset_case.case_context_json,
                  '$.decisionLetterSent'
                ) IS NULL
            AND SHA2(CAST(iset_case.case_context_json AS CHAR), 256) =
                @application_27_context_before_sha256
            AND SHA2(
                  CAST(
                    JSON_SET(
                      iset_case.case_context_json,
                      '$.applicationDecisionLetters."27".decisionLetterSent',
                      JSON_OBJECT('approval', @application_27_approval_sent_at)
                    ) AS CHAR
                  ),
                  256
                ) = @application_27_context_after_sha256
       )
       AND EXISTS (
         SELECT 1
           FROM messages
          WHERE messages.id = 2640
            AND messages.sender_actor_type = 'staff_profile'
            AND messages.sender_staff_profile_id = 60
            AND messages.recipient_actor_type = 'applicant_user'
            AND messages.recipient_user_id = 100
            AND messages.case_id = 109
            AND messages.application_id = 27
            AND messages.subject = 'Letter of Approval'
            AND messages.status = 'replied'
            AND messages.deleted = 0
            AND messages.created_at = '2026-08-11 15:08:12'
       )
       AND EXISTS (
         SELECT 1
           FROM signing_request
          WHERE signing_request.id = 187
            AND signing_request.workflow_name = 'Letter of Approval'
            AND signing_request.case_id = 109
            AND signing_request.status = 'signed'
            AND signing_request.signed_at = '2026-08-11 23:53:32'
            AND signing_request.checklist_doc_type = 'assessment_approval_letter'
            AND signing_request.created_at = '2026-08-11 15:08:12'
       )
       AND EXISTS (
         SELECT 1
           FROM signing_request
          WHERE signing_request.id = 188
            AND signing_request.workflow_name = 'Client Funding Agreement'
            AND signing_request.case_id = 109
            AND signing_request.status = 'signed'
            AND signing_request.signed_at = '2026-08-11 23:43:21'
            AND signing_request.checklist_doc_type = 'funding_agreement'
            AND signing_request.created_at = '2026-08-11 15:08:12'
       )
       AND EXISTS (
         SELECT 1
           FROM signing_request
          WHERE signing_request.id = 189
            AND signing_request.workflow_name = 'EFT & Wire Transfer Direct Debit'
            AND signing_request.case_id = 109
            AND signing_request.status = 'signed'
            AND signing_request.signed_at = '2026-08-11 23:52:13'
            AND signing_request.checklist_doc_type = 'EFT_form'
            AND signing_request.created_at = '2026-08-11 15:08:12'
       )
       AND EXISTS (
         SELECT 1
           FROM message_signing_request
          WHERE message_signing_request.message_id = 2640
            AND message_signing_request.signing_request_id = 187
       )
       AND EXISTS (
         SELECT 1
           FROM message_signing_request
          WHERE message_signing_request.message_id = 2640
            AND message_signing_request.signing_request_id = 188
       )
       AND EXISTS (
         SELECT 1
           FROM message_signing_request
          WHERE message_signing_request.message_id = 2640
            AND message_signing_request.signing_request_id = 189
       )
       AND NOT EXISTS (
         SELECT 1
           FROM message_signing_request
          WHERE message_signing_request.message_id = 2640
            AND message_signing_request.signing_request_id NOT IN (187, 188, 189)
       )
       AND EXISTS (
         SELECT 1
           FROM iset_document
          WHERE iset_document.id = 10383
            AND iset_document.application_id = 27
            AND iset_document.case_id = 109
            AND iset_document.origin_message_id IS NULL
            AND iset_document.signing_request_id IS NULL
            AND iset_document.source = 'system_generated'
            AND iset_document.status = 'active'
            AND iset_document.document_category = 'assessment_approval_letter'
            AND iset_document.created_at = '2026-08-11 15:08:14'
       )
       AND EXISTS (
         SELECT 1
           FROM iset_document
          WHERE iset_document.id = 10632
            AND iset_document.application_id = 27
            AND iset_document.case_id = 109
            AND iset_document.origin_message_id = 2640
            AND iset_document.signing_request_id = 188
            AND iset_document.source = 'system_generated'
            AND iset_document.status = 'active'
            AND iset_document.document_category = 'funding_agreement'
       )
       AND EXISTS (
         SELECT 1
           FROM iset_document
          WHERE iset_document.id = 10633
            AND iset_document.application_id = 27
            AND iset_document.case_id = 109
            AND iset_document.origin_message_id = 2640
            AND iset_document.signing_request_id = 189
            AND iset_document.source = 'system_generated'
            AND iset_document.status = 'active'
            AND iset_document.document_category = 'EFT_form'
       )
       AND EXISTS (
         SELECT 1
           FROM iset_document
          WHERE iset_document.id = 10634
            AND iset_document.application_id = 27
            AND iset_document.case_id = 109
            AND iset_document.source = 'application_submission'
            AND iset_document.status = 'active'
            AND iset_document.document_category = 'voided_cheque'
       )
       AND EXISTS (
         SELECT 1
           FROM iset_document
          WHERE iset_document.id = 10635
            AND iset_document.application_id = 27
            AND iset_document.case_id = 109
            AND iset_document.origin_message_id = 2640
            AND iset_document.signing_request_id = 187
            AND iset_document.source = 'system_generated'
            AND iset_document.status = 'active'
            AND iset_document.document_category = 'assessment_approval_letter'
       )
     );

UPDATE iset_case
   SET case_context_json = JSON_SET(
         iset_case.case_context_json,
         '$.applicationDecisionLetters."27".decisionLetterSent',
         JSON_OBJECT('approval', @application_27_approval_sent_at)
       ),
       updated_at = @application_27_marker_repair_at
 WHERE iset_case.id = 109
   AND iset_case.updated_at = '2026-08-11 15:08:12'
   AND JSON_EXTRACT(
         iset_case.case_context_json,
         '$.applicationDecisionLetters."27".decisionLetterSent'
       ) IS NULL
   AND SHA2(CAST(iset_case.case_context_json AS CHAR), 256) =
       @application_27_context_before_sha256;

SET @application_27_marker_case_rows := ROW_COUNT();

UPDATE iset_application
   SET row_version = iset_application.row_version + 1,
       updated_at = @application_27_marker_repair_at
 WHERE iset_application.id = 27
   AND iset_application.case_id = 109
   AND iset_application.status = 'approved'
   AND iset_application.lifecycle_status = 'decision_recorded'
   AND iset_application.decision_outcome = 'approved'
   AND iset_application.row_version = 81
   AND iset_application.updated_at = '2026-08-11 23:52:14';

SET @application_27_marker_application_rows := ROW_COUNT();

INSERT INTO tmp_application_27_marker_repair_guard (guard_key)
VALUES ('repair_rows_match');

INSERT INTO tmp_application_27_marker_repair_guard (guard_key)
SELECT 'repair_rows_match'
 WHERE NOT (
       @application_27_marker_case_rows = 1
       AND @application_27_marker_application_rows = 1
       AND EXISTS (
         SELECT 1
           FROM iset_case
          WHERE iset_case.id = 109
            AND iset_case.updated_at = @application_27_marker_repair_at
            AND JSON_UNQUOTE(
                  JSON_EXTRACT(
                    iset_case.case_context_json,
                    '$.applicationDecisionLetters."27".decisionLetterSent.approval'
                  )
                ) = @application_27_approval_sent_at
            AND SHA2(CAST(iset_case.case_context_json AS CHAR), 256) =
                @application_27_context_after_sha256
            AND SHA2(
                  CAST(
                    JSON_REMOVE(
                      iset_case.case_context_json,
                      '$.applicationDecisionLetters."27".decisionLetterSent'
                    ) AS CHAR
                  ),
                  256
                ) = @application_27_context_before_sha256
       )
       AND EXISTS (
         SELECT 1
           FROM iset_application
          WHERE iset_application.id = 27
            AND iset_application.case_id = 109
            AND iset_application.status = 'approved'
            AND iset_application.lifecycle_status = 'decision_recorded'
            AND iset_application.decision_outcome = 'approved'
            AND iset_application.awaiting_reason = 'none'
            AND iset_application.closure_reason IS NULL
            AND iset_application.row_version = 82
            AND iset_application.updated_at = @application_27_marker_repair_at
       )
     );

COMMIT;

SELECT iset_case.id,
       JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27".decisionLetterSent.approval'
         )
       ),
       SHA2(CAST(iset_case.case_context_json AS CHAR), 256),
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 109;

SELECT iset_application.id,
       iset_application.case_id,
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       iset_application.row_version,
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.id = 27
   AND iset_application.case_id = 109;

DROP TEMPORARY TABLE tmp_application_27_marker_repair_guard;
