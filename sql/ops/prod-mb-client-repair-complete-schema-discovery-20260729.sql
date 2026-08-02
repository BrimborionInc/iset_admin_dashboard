-- Complete live DDL discovery for every table referenced by the Manitoba
-- repair preflight, control, apply, verification, or recovery artifacts.
-- This file contains metadata/DDL reads only.

SHOW CREATE TABLE client;
SHOW CREATE TABLE user;
SHOW CREATE TABLE iset_case;
SHOW CREATE TABLE iset_application;
SHOW CREATE TABLE application_lock;
SHOW CREATE TABLE client_applicant_account_event;
SHOW CREATE TABLE iset_client_merge_audit;
SHOW CREATE TABLE iset_case_merge_audit;
SHOW CREATE TABLE iset_case_event;
SHOW CREATE TABLE client_file_import_identity_claim;
SHOW CREATE TABLE client_file_import_run;
SHOW CREATE TABLE staff_profiles;
SHOW CREATE TABLE canada_region;
SHOW CREATE TABLE iset_runtime_config;
SHOW CREATE TABLE input_json_state;
SHOW CREATE TABLE iset_event_entry;
SHOW CREATE TABLE iset_internal_notification;
