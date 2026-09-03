-- Metadata-only preflight for the proposed Jennifer Johnson and Veronica
-- Basque appeal migration. Run again immediately before any preview, apply,
-- recovery, or verification statement.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW CREATE TABLE iset_application;
SHOW FULL COLUMNS FROM iset_application;
SHOW CREATE TABLE iset_case;
SHOW FULL COLUMNS FROM iset_case;
SHOW CREATE TABLE iset_application_assessment;
SHOW FULL COLUMNS FROM iset_application_assessment;
SHOW CREATE TABLE iset_review_workflow;
SHOW FULL COLUMNS FROM iset_review_workflow;
SHOW CREATE TABLE iset_review_workflow_event;
SHOW FULL COLUMNS FROM iset_review_workflow_event;
SHOW CREATE TABLE iset_case_note;
SHOW FULL COLUMNS FROM iset_case_note;
SHOW CREATE TABLE iset_case_event;
SHOW FULL COLUMNS FROM iset_case_event;
SHOW CREATE TABLE iset_event_entry;
SHOW FULL COLUMNS FROM iset_event_entry;
SHOW CREATE TABLE application_lock;
SHOW FULL COLUMNS FROM application_lock;
SHOW CREATE TABLE iset_document;
SHOW FULL COLUMNS FROM iset_document;
SHOW CREATE TABLE iset_case_action_plan;
SHOW FULL COLUMNS FROM iset_case_action_plan;
SHOW CREATE TABLE iset_case_intervention;
SHOW FULL COLUMNS FROM iset_case_intervention;
SHOW CREATE TABLE esdc_participant_submission;
SHOW FULL COLUMNS FROM esdc_participant_submission;
SHOW CREATE TABLE funding_overview_series;
SHOW FULL COLUMNS FROM funding_overview_series;
SHOW CREATE TABLE funding_overview_version;
SHOW FULL COLUMNS FROM funding_overview_version;
SHOW CREATE TABLE funding_overview_version_documents;
SHOW FULL COLUMNS FROM funding_overview_version_documents;
SHOW CREATE TABLE signing_request;
SHOW FULL COLUMNS FROM signing_request;
SHOW CREATE TABLE staff_profiles;
SHOW FULL COLUMNS FROM staff_profiles;

SHOW PROCEDURE STATUS
 WHERE Db = 'iset_intake'
   AND Name IN (
     'prod_shelley_appeal_open_20260903',
     'prod_shelley_appeal_recovery_20260903'
   );
