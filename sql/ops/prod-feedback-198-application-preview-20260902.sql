-- Read-only PROD state preview for feedback #198.
-- The report context identifies application 233; this statement proves its
-- owning case and current application lifecycle before related-table reads.

SELECT iset_application.id,
       iset_application.case_id,
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       iset_application.awaiting_reason,
       iset_application.closure_reason,
       iset_application.row_version,
       iset_application.has_open_escalation,
       iset_application.current_escalation_id,
       iset_application.docs_requested_active,
       iset_application.docs_requested_at,
       iset_application.docs_requested_cleared_at,
       iset_application.docs_requested_source,
       iset_application.created_at,
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.id = 233;
