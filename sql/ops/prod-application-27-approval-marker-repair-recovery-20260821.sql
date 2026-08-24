-- Exact one-record PROD recovery for the application 27 approval-marker
-- repair. Run only before any later case/application activity and only if the
-- guarded post-apply state below remains exact.

CREATE TEMPORARY TABLE tmp_application_27_marker_recovery_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;

SET @application_27_approval_sent_at := '2026-08-11T15:08:14.000Z';
SET @application_27_context_before_sha256 := '83342e03e54a138b2b3bc921574f91158aa8917561702e987b8e6a77b4d6eb30';
SET @application_27_context_after_sha256 := 'eb277b1fe642cc53c05fe335082decf1ee7e4fce2be68c0106af366d3b8eb937';
SET @application_27_marker_apply_at := NULL;

START TRANSACTION;

SELECT application_lock.application_id,
       application_lock.acquired_at,
       application_lock.expires_at
  FROM application_lock
 WHERE application_lock.application_id = 27
 FOR UPDATE;

SELECT iset_application.id,
       iset_application.case_id,
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       iset_application.row_version,
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.id = 27
   AND iset_application.case_id = 109
 FOR UPDATE;

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
 WHERE iset_case.id = 109
 FOR UPDATE;

SELECT iset_case.updated_at
  INTO @application_27_marker_apply_at
  FROM iset_case
 WHERE iset_case.id = 109
   AND SHA2(CAST(iset_case.case_context_json AS CHAR), 256) =
       @application_27_context_after_sha256
 FOR UPDATE;

INSERT INTO tmp_application_27_marker_recovery_guard (guard_key)
VALUES ('recovery_preconditions_match');

INSERT INTO tmp_application_27_marker_recovery_guard (guard_key)
SELECT 'recovery_preconditions_match'
 WHERE NOT (
       @application_27_marker_apply_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
           FROM application_lock
          WHERE application_lock.application_id = 27
       )
       AND EXISTS (
         SELECT 1
           FROM iset_case
          WHERE iset_case.id = 109
            AND iset_case.status = 'initiated'
            AND iset_case.lifecycle_status = 'initiated'
            AND iset_case.updated_at = @application_27_marker_apply_at
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
            AND iset_application.client_id = 91
            AND iset_application.status = 'approved'
            AND iset_application.lifecycle_status = 'decision_recorded'
            AND iset_application.decision_outcome = 'approved'
            AND iset_application.awaiting_reason = 'none'
            AND iset_application.closure_reason IS NULL
            AND iset_application.row_version = 82
            AND iset_application.updated_at = @application_27_marker_apply_at
       )
     );

UPDATE iset_case
   SET case_context_json = JSON_REMOVE(
         iset_case.case_context_json,
         '$.applicationDecisionLetters."27".decisionLetterSent'
       ),
       updated_at = '2026-08-11 15:08:12'
 WHERE iset_case.id = 109
   AND iset_case.updated_at = @application_27_marker_apply_at
   AND JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27".decisionLetterSent.approval'
         )
       ) = @application_27_approval_sent_at
   AND SHA2(CAST(iset_case.case_context_json AS CHAR), 256) =
       @application_27_context_after_sha256;

SET @application_27_marker_recovery_case_rows := ROW_COUNT();

UPDATE iset_application
   SET row_version = 81,
       updated_at = '2026-08-11 23:52:14'
 WHERE iset_application.id = 27
   AND iset_application.case_id = 109
   AND iset_application.status = 'approved'
   AND iset_application.lifecycle_status = 'decision_recorded'
   AND iset_application.decision_outcome = 'approved'
   AND iset_application.row_version = 82
   AND iset_application.updated_at = @application_27_marker_apply_at;

SET @application_27_marker_recovery_application_rows := ROW_COUNT();

INSERT INTO tmp_application_27_marker_recovery_guard (guard_key)
VALUES ('recovery_rows_match');

INSERT INTO tmp_application_27_marker_recovery_guard (guard_key)
SELECT 'recovery_rows_match'
 WHERE NOT (
       @application_27_marker_recovery_case_rows = 1
       AND @application_27_marker_recovery_application_rows = 1
       AND EXISTS (
         SELECT 1
           FROM iset_case
          WHERE iset_case.id = 109
            AND iset_case.updated_at = '2026-08-11 15:08:12'
            AND JSON_EXTRACT(
                  iset_case.case_context_json,
                  '$.applicationDecisionLetters."27".decisionLetterSent'
                ) IS NULL
            AND SHA2(CAST(iset_case.case_context_json AS CHAR), 256) =
                @application_27_context_before_sha256
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
            AND iset_application.row_version = 81
            AND iset_application.updated_at = '2026-08-11 23:52:14'
       )
     );

COMMIT;

SELECT iset_case.id,
       JSON_TYPE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27".decisionLetterSent'
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

DROP TEMPORARY TABLE tmp_application_27_marker_recovery_guard;
