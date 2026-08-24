const { assertEnumValueReady, assertRuntimeTableReady } = require('./schemaReadiness');

const STAFF_PROFILE_RUNTIME_COLUMNS = Object.freeze([
  'id',
  'cognito_sub',
  'email',
  'primary_role',
  'region_id',
]);

const DOCUMENT_LIFECYCLE_RUNTIME_COLUMNS = Object.freeze([
  'id',
  'document_id',
  'original_document_id',
  'current_state',
  'lifecycle_generation',
  'deleted_at',
  'deleted_by_staff_profile_id',
  'delete_reason',
  'client_id',
  'case_id',
  'application_id',
  'action_plan_id',
  'source_snapshot',
  'document_category',
  'checksum_sha256',
  'size_bytes',
  'created_at',
  'updated_at',
]);

const DOCUMENT_LIFECYCLE_EVENT_RUNTIME_COLUMNS = Object.freeze([
  'id',
  'lifecycle_id',
  'operation_id',
  'lifecycle_generation',
  'event_type',
  'from_state',
  'to_state',
  'actor_staff_profile_id',
  'actor_role_snapshot',
  'actor_name_snapshot',
  'actor_email_snapshot',
  'reason',
  'details_json',
  'created_at',
]);

const ADMIN_RUNTIME_SCHEMA_REQUIREMENTS = Object.freeze([
  ['staff_profiles', STAFF_PROFILE_RUNTIME_COLUMNS],
  ['iset_runtime_config', ['scope', 'k', 'v', 'updated_at']],
  ['iset_application_version', ['id', 'application_id', 'version', 'payload_json']],
  ['message_item', ['message_id', 'owner_user_id', 'folder', 'purged_at']],
  ['staff_tutorial_progress', ['staff_profile_id', 'tutorial_id', 'status']],
  ['admin_ai_guidance_entry', ['slug', 'guidance_text']],
  ['admin_ai_guidance_example', ['guidance_slug', 'question_text', 'answer_text']],
  ['client_file_import_run', ['request_hash', 'status', 'result_json']],
  ['client_file_import_identity_claim', ['identity_key', 'client_id']],
  ['iset_event_entry', ['id', 'notification_delivery_mode']],
  ['iset_event_delivery', ['event_id', 'channel', 'audience_key', 'status']],
  ['iset_case_reminder', ['id', 'lifecycle_generation']],
  ['iset_reminder_lifecycle_event', ['reminder_id', 'lifecycle_generation', 'event_type', 'status']],
  ['iset_document_lifecycle', DOCUMENT_LIFECYCLE_RUNTIME_COLUMNS],
  ['iset_document_lifecycle_event', DOCUMENT_LIFECYCLE_EVENT_RUNTIME_COLUMNS],
  ['ptma', ['id', 'type', 'iset_full_name']],
  ['payment_submission_attempt', ['payment_packet_id', 'submission_key', 'status', 'lease_expires_at']],
]);

const ADMIN_RUNTIME_ENUM_REQUIREMENTS = Object.freeze([
  ['esdc_participant_submission_history', 'event_type', 'prepared'],
]);

async function assertAdminRuntimeSchemaReady(connection) {
  for (const [table, columns] of ADMIN_RUNTIME_SCHEMA_REQUIREMENTS) {
    await assertRuntimeTableReady(connection, table, columns);
  }
  for (const [table, column, value] of ADMIN_RUNTIME_ENUM_REQUIREMENTS) {
    await assertEnumValueReady(connection, table, column, value);
  }
  return true;
}

module.exports = {
  ADMIN_RUNTIME_ENUM_REQUIREMENTS,
  ADMIN_RUNTIME_SCHEMA_REQUIREMENTS,
  DOCUMENT_LIFECYCLE_EVENT_RUNTIME_COLUMNS,
  DOCUMENT_LIFECYCLE_RUNTIME_COLUMNS,
  STAFF_PROFILE_RUNTIME_COLUMNS,
  assertAdminRuntimeSchemaReady,
};
