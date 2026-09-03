-- Metadata-only continuation: locks, plans, interventions, and ESDC batching.
SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();
SHOW CREATE TABLE application_lock;
SHOW CREATE TABLE iset_case_action_plan;
SHOW CREATE TABLE iset_case_intervention;
SHOW CREATE TABLE esdc_participant_submission;
