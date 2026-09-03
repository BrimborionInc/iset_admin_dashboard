-- Metadata-only continuation: core application, case, assessment, and workflow.
SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();
SHOW CREATE TABLE iset_application;
SHOW CREATE TABLE iset_case;
SHOW CREATE TABLE iset_application_assessment;
SHOW CREATE TABLE iset_review_workflow;
