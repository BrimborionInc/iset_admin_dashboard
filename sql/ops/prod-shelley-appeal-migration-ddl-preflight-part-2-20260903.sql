-- Metadata-only continuation: workflow audit, case audit, and document tables.
SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();
SHOW CREATE TABLE iset_review_workflow_event;
SHOW CREATE TABLE iset_case_note;
SHOW CREATE TABLE iset_case_event;
SHOW CREATE TABLE iset_document;
