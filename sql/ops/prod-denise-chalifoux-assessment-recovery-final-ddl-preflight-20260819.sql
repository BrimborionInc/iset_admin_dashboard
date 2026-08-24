-- Final metadata-only preflight for fields receiving enumerated recovery values.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW FULL COLUMNS FROM iset_application WHERE Field IN (
  'status', 'lifecycle_status', 'decision_outcome', 'awaiting_reason',
  'closure_reason', 'row_version', 'updated_at'
);

SHOW FULL COLUMNS FROM iset_case WHERE Field IN (
  'status', 'lifecycle_status', 'closure_reason', 'closed_at',
  'case_context_json', 'updated_at'
);

SHOW FULL COLUMNS FROM iset_application_assessment WHERE Field IN (
  'nwac_review', 'nwac_reason', 'updated_at'
);

SHOW FULL COLUMNS FROM iset_review_workflow WHERE Field IN (
  'current_stage', 'current_owner_role', 'current_owner_staff_profile_id',
  'rm_reviewed_by_staff_profile_id', 'rm_reviewed_at', 'rm_review_note',
  'nwac_decided_by_staff_profile_id', 'nwac_decided_at', 'nwac_decision',
  'nwac_decision_note', 'metadata_json', 'archived_at', 'updated_at'
);

SHOW FULL COLUMNS FROM iset_case_action_plan WHERE Field IN (
  'status', 'archived_at', 'updated_at'
);

SHOW FULL COLUMNS FROM iset_case_intervention WHERE Field IN (
  'status', 'delivery_status', 'updated_at'
);

SHOW FULL COLUMNS FROM iset_document WHERE Field IN (
  'status', 'updated_at'
);

SHOW FULL COLUMNS FROM iset_review_workflow_event;
SHOW FULL COLUMNS FROM iset_case_event;
SHOW FULL COLUMNS FROM iset_case_note;
SHOW FULL COLUMNS FROM application_lock;

SHOW PROCEDURE STATUS
 WHERE Db = 'iset_intake'
   AND Name = 'prod_denise_chalifoux_assessment_recovery_20260819';
