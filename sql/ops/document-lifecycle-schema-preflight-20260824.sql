SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW CREATE TABLE `iset_document`;
SHOW CREATE TABLE `staff_profiles`;
SHOW CREATE TABLE `cfa_version_documents`;
SHOW CREATE TABLE `funding_overview_version_documents`;
SHOW CREATE TABLE `iset_case_compliance_check`;
SHOW CREATE TABLE `iset_document_intervention`;
SHOW CREATE TABLE `payment_followup_event`;
SHOW CREATE TABLE `payment_packet_document`;
SHOW CREATE TABLE `payment_packet_line`;
SHOW CREATE TABLE `iset_runtime_config`;

SHOW TABLES LIKE 'iset_document_lifecycle';
SHOW TABLES LIKE 'iset_document_lifecycle_event';
