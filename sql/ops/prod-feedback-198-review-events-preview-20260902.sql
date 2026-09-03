-- Read-only PROD review history for feedback #198.
-- Review workflow 65 was live-proven as the application-assessment workflow
-- for application 233 before this file was prepared.

SELECT iset_review_workflow_event.id,
       iset_review_workflow_event.review_workflow_id,
       iset_review_workflow_event.workflow_type,
       iset_review_workflow_event.subject_key,
       iset_review_workflow_event.action,
       iset_review_workflow_event.from_stage,
       iset_review_workflow_event.to_stage,
       iset_review_workflow_event.actor_staff_profile_id,
       iset_review_workflow_event.actor_role,
       iset_review_workflow_event.note,
       iset_review_workflow_event.payload_json,
       iset_review_workflow_event.created_at
  FROM iset_review_workflow_event
 WHERE iset_review_workflow_event.review_workflow_id = 65
 ORDER BY iset_review_workflow_event.id;
