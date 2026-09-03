-- Read-only PROD discovery for Shelley Stacey's appeal request.
-- Live target identity was proved before this artifact was run.
-- Live PROD SHOW CREATE TABLE client was captured in this task before execution.

SELECT
  client.id,
  client.first_name,
  client.last_name,
  client.created_at,
  client.updated_at
FROM client
WHERE (client.first_name = 'Jennifer' AND client.last_name = 'Johnson')
   OR (client.first_name = 'Veronica' AND client.last_name = 'Basque')
ORDER BY client.last_name, client.first_name, client.id;

-- Every identifier below was checked against the live PROD DDL for client,
-- iset_case, and iset_application immediately before execution.
SELECT
  client.id,
  client.first_name,
  client.last_name,
  iset_case.id,
  iset_case.case_number,
  iset_case.status,
  iset_case.lifecycle_status,
  iset_case.stage,
  iset_case.sub_stage,
  iset_case.portfolio_region_id,
  iset_case.assigned_staff_profile_id,
  iset_case.opened_at,
  iset_case.closed_at,
  iset_application.id,
  iset_application.submission_id,
  iset_application.status,
  iset_application.lifecycle_status,
  iset_application.decision_outcome,
  iset_application.closure_reason,
  iset_application.version,
  iset_application.created_at,
  iset_application.updated_at
FROM client
JOIN iset_case
  ON iset_case.client_id = client.id
LEFT JOIN iset_application
  ON iset_application.case_id = iset_case.id
 AND iset_application.client_id = client.id
WHERE client.id IN (375, 386)
ORDER BY client.id, iset_case.id, iset_application.id;

-- Live PROD DDL was also captured for iset_application_assessment,
-- iset_review_workflow, iset_review_workflow_event, and iset_case_event.
SELECT
  iset_application_assessment.id,
  iset_application_assessment.application_id,
  iset_application_assessment.case_id,
  iset_application_assessment.date_of_assessment,
  iset_application_assessment.recommendation,
  iset_application_assessment.nwac_review,
  iset_application_assessment.created_at,
  iset_application_assessment.updated_at
FROM iset_application_assessment
WHERE iset_application_assessment.application_id IN (199, 208)
ORDER BY iset_application_assessment.application_id, iset_application_assessment.id;

SELECT
  iset_review_workflow.id,
  iset_review_workflow.workflow_type,
  iset_review_workflow.subject_key,
  iset_review_workflow.case_id,
  iset_review_workflow.application_id,
  iset_review_workflow.current_stage,
  iset_review_workflow.current_owner_role,
  iset_review_workflow.current_owner_staff_profile_id,
  iset_review_workflow.submitted_by_staff_profile_id,
  iset_review_workflow.submitted_at,
  iset_review_workflow.rm_reviewed_by_staff_profile_id,
  iset_review_workflow.rm_reviewed_at,
  iset_review_workflow.nwac_decided_by_staff_profile_id,
  iset_review_workflow.nwac_decided_at,
  iset_review_workflow.nwac_decision,
  iset_review_workflow.archived_at,
  iset_review_workflow.created_at,
  iset_review_workflow.updated_at
FROM iset_review_workflow
WHERE iset_review_workflow.application_id IN (199, 208)
ORDER BY iset_review_workflow.application_id, iset_review_workflow.id;

SELECT
  iset_review_workflow.application_id,
  iset_review_workflow_event.id,
  iset_review_workflow_event.review_workflow_id,
  iset_review_workflow_event.action,
  iset_review_workflow_event.from_stage,
  iset_review_workflow_event.to_stage,
  iset_review_workflow_event.actor_staff_profile_id,
  iset_review_workflow_event.actor_role,
  iset_review_workflow_event.note,
  iset_review_workflow_event.created_at
FROM iset_review_workflow
JOIN iset_review_workflow_event
  ON iset_review_workflow_event.review_workflow_id = iset_review_workflow.id
WHERE iset_review_workflow.application_id IN (199, 208)
ORDER BY iset_review_workflow.application_id,
         iset_review_workflow_event.created_at,
         iset_review_workflow_event.id;

SELECT
  iset_case_event.id,
  iset_case_event.case_id,
  iset_case_event.event_type,
  iset_case_event.summary,
  iset_case_event.occurred_at,
  iset_case_event.actor_staff_profile_id,
  iset_case_event.source_system
FROM iset_case_event
WHERE iset_case_event.case_id IN (258, 269)
ORDER BY iset_case_event.case_id, iset_case_event.occurred_at, iset_case_event.id;

-- Live PROD DDL was captured for the feedback report and note tables before
-- these single-table reads. Report 123 is the existing Appeals Workflow item.
SELECT
  admin_feedback_report.id,
  admin_feedback_report.report_type,
  admin_feedback_report.severity,
  admin_feedback_report.status,
  admin_feedback_report.summary,
  admin_feedback_report.description,
  admin_feedback_report.submitted_by_name,
  admin_feedback_report.submitted_by_email,
  admin_feedback_report.submitted_by_role,
  admin_feedback_report.page_title,
  admin_feedback_report.page_path,
  admin_feedback_report.submitted_at,
  admin_feedback_report.updated_at
FROM admin_feedback_report
WHERE admin_feedback_report.id = 123;

SELECT
  admin_feedback_note.id,
  admin_feedback_note.report_id,
  admin_feedback_note.author_name,
  admin_feedback_note.author_email,
  admin_feedback_note.note_text,
  admin_feedback_note.created_at
FROM admin_feedback_note
WHERE admin_feedback_note.report_id = 123
ORDER BY admin_feedback_note.created_at, admin_feedback_note.id;

-- Live PROD DDL was captured for staff_profiles, iset_document, messages,
-- and message_attachment before these reads.
SELECT
  staff_profiles.id,
  staff_profiles.email,
  staff_profiles.name,
  staff_profiles.display_name,
  staff_profiles.primary_role,
  staff_profiles.status,
  staff_profiles.region_id
FROM staff_profiles
WHERE staff_profiles.id IN (51, 54)
ORDER BY staff_profiles.id;

SELECT
  iset_document.id,
  iset_document.client_id,
  iset_document.application_id,
  iset_document.case_id,
  iset_document.origin_message_id,
  iset_document.signing_request_id,
  iset_document.source,
  iset_document.file_name,
  iset_document.label,
  iset_document.status,
  iset_document.document_category,
  iset_document.visibility,
  iset_document.created_at,
  iset_document.updated_at
FROM iset_document
WHERE iset_document.case_id IN (258, 269)
ORDER BY iset_document.case_id, iset_document.created_at, iset_document.id;

SELECT
  messages.id,
  messages.sender_actor_type,
  messages.sender_user_id,
  messages.sender_staff_profile_id,
  messages.recipient_actor_type,
  messages.recipient_user_id,
  messages.recipient_staff_profile_id,
  messages.case_id,
  messages.application_id,
  messages.subject,
  messages.status,
  messages.created_at,
  messages.deleted,
  messages.urgent
FROM messages
WHERE messages.case_id IN (258, 269)
ORDER BY messages.case_id, messages.created_at, messages.id;

SELECT
  message_attachment.id,
  message_attachment.message_id,
  message_attachment.case_id,
  message_attachment.client_id,
  message_attachment.application_id,
  message_attachment.original_filename,
  message_attachment.uploaded_at,
  message_attachment.user_id
FROM message_attachment
WHERE message_attachment.case_id IN (258, 269)
ORDER BY message_attachment.case_id, message_attachment.uploaded_at, message_attachment.id;
