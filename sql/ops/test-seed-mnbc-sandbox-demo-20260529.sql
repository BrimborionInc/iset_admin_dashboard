-- Seed TEST with a compact Metis Nation of British Columbia sandbox demo.
-- Idempotent for rows marked with source = test_mnbc_sandbox_demo_20260529.

START TRANSACTION;

SET @demo_source := 'test_mnbc_sandbox_demo_20260529';
SET @program_email := 'program.admin@awentech.ca';
SET @program_user_id := (SELECT id FROM user WHERE email = @program_email LIMIT 1);
SET @program_staff_profile_id := (SELECT id FROM staff_profiles WHERE email = @program_email LIMIT 1);
SET @bc_region_id := (SELECT region_id FROM canada_region WHERE code = 'BC' LIMIT 1);
SET @crf_pot_id := (SELECT id FROM budget_pot WHERE code = 'MNBC-ISET-CRF' LIMIT 1);
SET @ei_pot_id := (SELECT id FROM budget_pot WHERE code = 'MNBC-ISET-EI' LIMIT 1);

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_required_ids;
CREATE TEMPORARY TABLE tmp_mnbc_required_ids (
  program_user_id INT NOT NULL,
  program_staff_profile_id BIGINT UNSIGNED NOT NULL,
  bc_region_id TINYINT UNSIGNED NOT NULL,
  crf_pot_id BIGINT UNSIGNED NOT NULL,
  ei_pot_id BIGINT UNSIGNED NOT NULL
);
INSERT INTO tmp_mnbc_required_ids
VALUES (@program_user_id, @program_staff_profile_id, @bc_region_id, @crf_pot_id, @ei_pot_id);

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_email;
CREATE TEMPORARY TABLE tmp_mnbc_demo_email (
  email VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL PRIMARY KEY
);
INSERT INTO tmp_mnbc_demo_email (email)
VALUES
  ('demo-mnbc-avery@awentech.ca'),
  ('demo-mnbc-brielle@awentech.ca'),
  ('demo-mnbc-clara@awentech.ca'),
  ('demo-mnbc-dani@awentech.ca'),
  ('demo-mnbc-eva@awentech.ca'),
  ('demo-mnbc-farah@awentech.ca');

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_users;
CREATE TEMPORARY TABLE tmp_mnbc_demo_users AS
SELECT u.id
  FROM user u
  JOIN tmp_mnbc_demo_email e ON e.email = u.email;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_users_recipient;
CREATE TEMPORARY TABLE tmp_mnbc_demo_users_recipient AS
SELECT id
  FROM tmp_mnbc_demo_users;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_clients;
CREATE TEMPORARY TABLE tmp_mnbc_demo_clients AS
SELECT c.id
  FROM client c
  LEFT JOIN tmp_mnbc_demo_email e ON e.email = c.applicant_account_email
 WHERE e.email IS NOT NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(c.address_json, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_cases;
CREATE TEMPORARY TABLE tmp_mnbc_demo_cases AS
SELECT c.id
  FROM iset_case c
  LEFT JOIN tmp_mnbc_demo_clients dc ON dc.id = c.client_id
 WHERE dc.id IS NOT NULL
    OR c.case_number LIKE 'MNBC-DEMO-%'
    OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_submissions;
CREATE TEMPORARY TABLE tmp_mnbc_demo_submissions AS
SELECT s.id
  FROM iset_application_submission s
  LEFT JOIN tmp_mnbc_demo_users du ON du.id = s.user_id
 WHERE du.id IS NOT NULL
    OR s.reference_number LIKE 'MNBC-DEMO-20260529-%'
    OR JSON_UNQUOTE(JSON_EXTRACT(s.intake_payload, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_applications;
CREATE TEMPORARY TABLE tmp_mnbc_demo_applications AS
SELECT a.id
  FROM iset_application a
  LEFT JOIN tmp_mnbc_demo_submissions ds ON ds.id = a.submission_id
  LEFT JOIN tmp_mnbc_demo_cases dc ON dc.id = a.case_id
  LEFT JOIN tmp_mnbc_demo_clients dcl ON dcl.id = a.client_id
 WHERE ds.id IS NOT NULL
    OR dc.id IS NOT NULL
    OR dcl.id IS NOT NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_action_plans;
CREATE TEMPORARY TABLE tmp_mnbc_demo_action_plans AS
SELECT ap.id
  FROM iset_case_action_plan ap
  LEFT JOIN tmp_mnbc_demo_cases dc ON dc.id = ap.case_id
 WHERE dc.id IS NOT NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_esdc_submissions;
CREATE TEMPORARY TABLE tmp_mnbc_demo_esdc_submissions AS
SELECT eps.id
  FROM esdc_participant_submission eps
  LEFT JOIN tmp_mnbc_demo_cases dc ON dc.id = eps.case_id
  LEFT JOIN tmp_mnbc_demo_action_plans dap ON dap.id = eps.action_plan_id
 WHERE dc.id IS NOT NULL
    OR dap.id IS NOT NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(eps.readiness_summary, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_interventions;
CREATE TEMPORARY TABLE tmp_mnbc_demo_interventions AS
SELECT ci.id
  FROM iset_case_intervention ci
  LEFT JOIN tmp_mnbc_demo_cases dc ON dc.id = ci.case_id
  LEFT JOIN tmp_mnbc_demo_action_plans dap ON dap.id = ci.action_plan_id
 WHERE dc.id IS NOT NULL
    OR dap.id IS NOT NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_payment_packets;
CREATE TEMPORARY TABLE tmp_mnbc_demo_payment_packets AS
SELECT pp.id
  FROM payment_packet pp
  LEFT JOIN tmp_mnbc_demo_cases dc ON dc.id = pp.case_id
  LEFT JOIN tmp_mnbc_demo_clients dcl ON dcl.id = pp.client_id
  LEFT JOIN tmp_mnbc_demo_interventions di ON di.id = pp.intervention_id
 WHERE dc.id IS NOT NULL
    OR dcl.id IS NOT NULL
    OR di.id IS NOT NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(pp.metadata, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_payment_lines;
CREATE TEMPORARY TABLE tmp_mnbc_demo_payment_lines AS
SELECT ppl.id
  FROM payment_packet_line ppl
  JOIN tmp_mnbc_demo_payment_packets pp ON pp.id = ppl.payment_packet_id;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_finance_transactions;
CREATE TEMPORARY TABLE tmp_mnbc_demo_finance_transactions AS
SELECT ft.id
  FROM finance_transaction ft
  LEFT JOIN tmp_mnbc_demo_cases dc ON dc.id = ft.case_id
  LEFT JOIN tmp_mnbc_demo_interventions di ON di.id = ft.case_intervention_id
 WHERE dc.id IS NOT NULL
    OR di.id IS NOT NULL
    OR JSON_UNQUOTE(JSON_EXTRACT(ft.metadata, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_documents;
CREATE TEMPORARY TABLE tmp_mnbc_demo_documents AS
SELECT d.id
  FROM iset_document d
  LEFT JOIN tmp_mnbc_demo_cases dc ON dc.id = d.case_id
  LEFT JOIN tmp_mnbc_demo_applications da ON da.id = d.application_id
  LEFT JOIN tmp_mnbc_demo_clients dcl ON dcl.id = d.client_id
 WHERE dc.id IS NOT NULL
    OR da.id IS NOT NULL
    OR dcl.id IS NOT NULL
    OR d.file_path LIKE 'mnbc-sandbox-demo/%'
    OR JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.source')) = @demo_source;

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_messages;
CREATE TEMPORARY TABLE tmp_mnbc_demo_messages AS
SELECT m.id
  FROM messages m
  LEFT JOIN tmp_mnbc_demo_cases dc ON dc.id = m.case_id
  LEFT JOIN tmp_mnbc_demo_applications da ON da.id = m.application_id
  LEFT JOIN tmp_mnbc_demo_users su ON su.id = m.sender_user_id
  LEFT JOIN tmp_mnbc_demo_users_recipient ru ON ru.id = m.recipient_user_id
 WHERE dc.id IS NOT NULL
    OR da.id IS NOT NULL
    OR su.id IS NOT NULL
    OR ru.id IS NOT NULL
    OR m.subject LIKE 'MNBC-DEMO-%';

DELETE ma
  FROM message_attachment ma
  JOIN tmp_mnbc_demo_messages dm ON dm.id = ma.message_id;
DELETE mi
  FROM message_item mi
  JOIN tmp_mnbc_demo_messages dm ON dm.id = mi.message_id;
DELETE pld
  FROM payment_line_transaction pld
  JOIN tmp_mnbc_demo_payment_lines dl ON dl.id = pld.payment_packet_line_id;
DELETE pld
  FROM payment_line_transaction pld
  JOIN tmp_mnbc_demo_finance_transactions dft ON dft.id = pld.finance_transaction_id;
DELETE ppd
  FROM payment_packet_document ppd
  JOIN tmp_mnbc_demo_payment_packets dp ON dp.id = ppd.payment_packet_id;
DELETE pfe
  FROM payment_followup_event pfe
  JOIN tmp_mnbc_demo_payment_packets dp ON dp.id = pfe.payment_packet_id;
DELETE pse
  FROM payment_status_event pse
  JOIN tmp_mnbc_demo_payment_packets dp ON dp.id = pse.payment_packet_id;
DELETE FROM payment_override
 WHERE payment_packet_id IN (SELECT id FROM tmp_mnbc_demo_payment_packets);
DELETE FROM payment_batch_line
 WHERE payment_packet_line_id IN (SELECT id FROM tmp_mnbc_demo_payment_lines);
DELETE FROM payment_packet_line
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_payment_lines);
DELETE FROM payment_packet
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_payment_packets);
DELETE FROM finance_transaction
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_finance_transactions);
DELETE di
  FROM iset_document_intervention di
  JOIN tmp_mnbc_demo_documents dd ON dd.id = di.document_id;
DELETE FROM iset_document
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_documents);
DELETE FROM messages
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_messages);
DELETE FROM esdc_participant_submission_history
 WHERE participant_submission_id IN (SELECT id FROM tmp_mnbc_demo_esdc_submissions);
DELETE FROM esdc_participant_submission
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_esdc_submissions);
DELETE FROM iset_case_event
 WHERE case_id IN (SELECT id FROM tmp_mnbc_demo_cases)
   AND (source_system = @demo_source OR event_type LIKE 'mnbc_demo_%');
DELETE FROM iset_case_task
 WHERE case_id IN (SELECT id FROM tmp_mnbc_demo_cases);
DELETE FROM iset_case_note
 WHERE case_id IN (SELECT id FROM tmp_mnbc_demo_cases);
DELETE FROM iset_case_intervention
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_interventions);
DELETE FROM iset_case_action_plan
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_action_plans);
DELETE FROM iset_application_assessment
 WHERE application_id IN (SELECT id FROM tmp_mnbc_demo_applications)
    OR case_id IN (SELECT id FROM tmp_mnbc_demo_cases);
DELETE FROM iset_case_assessment
 WHERE case_id IN (SELECT id FROM tmp_mnbc_demo_cases);
DELETE FROM iset_application_version
 WHERE application_id IN (SELECT id FROM tmp_mnbc_demo_applications);
DELETE FROM iset_application
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_applications);
DELETE FROM iset_application_submission
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_submissions);
DELETE FROM iset_case
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_cases);
DELETE FROM client
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_clients);
DELETE FROM user
 WHERE id IN (SELECT id FROM tmp_mnbc_demo_users);

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_person;
CREATE TEMPORARY TABLE tmp_mnbc_demo_person (
  scenario_no INT NOT NULL PRIMARY KEY,
  email VARCHAR(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
  first_name VARCHAR(128) NOT NULL,
  last_name VARCHAR(128) NOT NULL,
  dob DATE NOT NULL,
  gender VARCHAR(32) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  street VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  home_community VARCHAR(128) NOT NULL,
  support_summary VARCHAR(255) NOT NULL,
  requested_supports VARCHAR(255) NOT NULL,
  application_status VARCHAR(32) NOT NULL,
  application_lifecycle_status VARCHAR(32) NOT NULL,
  decision_outcome VARCHAR(32) NULL,
  awaiting_reason VARCHAR(32) NOT NULL,
  docs_requested_active TINYINT(1) NOT NULL,
  case_status VARCHAR(32) NOT NULL,
  case_lifecycle_status VARCHAR(32) NOT NULL,
  case_stage VARCHAR(64) NOT NULL,
  case_sub_stage VARCHAR(64) NOT NULL,
  priority VARCHAR(32) NOT NULL,
  risk_rating VARCHAR(32) NOT NULL,
  submitted_days_ago INT NOT NULL,
  due_days INT NOT NULL,
  budget_pot_id BIGINT UNSIGNED NULL,
  funding_stream VARCHAR(16) NULL,
  intervention_code TINYINT UNSIGNED NULL,
  intervention_title VARCHAR(255) NULL,
  intervention_status VARCHAR(32) NULL,
  delivery_status VARCHAR(32) NULL,
  requested_amount DECIMAL(14,2) NULL,
  payment_type VARCHAR(64) NULL,
  payee_type VARCHAR(64) NULL,
  payee_name VARCHAR(255) NULL,
  institution VARCHAR(255) NULL,
  program_name VARCHAR(255) NULL,
  employment_goal VARCHAR(255) NOT NULL
);

INSERT INTO tmp_mnbc_demo_person (
  scenario_no, email, first_name, last_name, dob, gender, phone, street, city,
  postal_code, home_community, support_summary, requested_supports,
  application_status, application_lifecycle_status, decision_outcome, awaiting_reason,
  docs_requested_active, case_status, case_lifecycle_status, case_stage, case_sub_stage,
  priority, risk_rating, submitted_days_ago, due_days, budget_pot_id, funding_stream,
  intervention_code, intervention_title, intervention_status, delivery_status,
  requested_amount, payment_type, payee_type, payee_name, institution, program_name,
  employment_goal
)
VALUES
  (1, 'demo-mnbc-avery@awentech.ca', 'Avery', 'Dumont', '1998-04-12', 'Woman', '250-555-0101',
   '1180 Blanshard Street', 'Victoria', 'V8W 2H2', 'Victoria',
   'New intake for career exploration and employment planning.',
   'Career counselling; employment plan',
   'submitted', 'submitted', NULL, 'none', 0,
   'intake', 'intake', 'application_intake', 'new_submission',
   'normal', 'low', 1, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
   'Employment readiness planning', 'Clarify a path into client-service employment.'),
  (2, 'demo-mnbc-brielle@awentech.ca', 'Brielle', 'Sinclair', '1991-09-03', 'Woman', '250-555-0102',
   '510 Victoria Street', 'Kamloops', 'V2C 2B2', 'Kamloops',
   'Assessment in progress for short skills upgrading.',
   'Academic upgrading; transportation',
   'in_review', 'in_review', NULL, 'none', 0,
   'intake', 'intake', 'assessment', 'eligibility_review',
   'normal', 'medium', 4, 2, @crf_pot_id, 'CRF', 5, 'Academic upgrading readiness',
   NULL, NULL, 2500.00, 'OtherEligibleCost', 'ParticipantClient', NULL,
   'Thompson Rivers Continuing Studies', 'Workplace Essential Skills',
   'Complete upgrading needed for office administration training.'),
  (3, 'demo-mnbc-clara@awentech.ca', 'Clara', 'Morin', '1987-12-21', 'Woman', '250-555-0103',
   '1420 5th Avenue', 'Prince George', 'V2L 3L8', 'Prince George',
   'Documents requested before assessment can continue.',
   'Training plan; proof of BC residence',
   'docs_requested', 'awaiting_applicant', NULL, 'documents', 1,
   'intake', 'intake', 'assessment', 'applicant_follow_up',
   'normal', 'medium', 7, 5, @crf_pot_id, 'CRF', 4, 'Essential skills review',
   NULL, NULL, 1800.00, 'OtherEligibleCost', 'ParticipantClient', NULL,
   'College of New Caledonia', 'Essential Skills Refresher',
   'Build digital and workplace skills for a return-to-work plan.'),
  (4, 'demo-mnbc-dani@awentech.ca', 'Dani', 'Larocque', '1995-06-18', 'Non-binary', '250-555-0104',
   '330 Bernard Avenue', 'Kelowna', 'V1Y 6N5', 'Kelowna',
   'Assessment complete and waiting on NWAC decision.',
   'Certificate training; books and supplies',
   'pending_approval', 'pending_decision', NULL, 'none', 0,
   'intake', 'intake', 'assessment', 'pending_decision',
   'high', 'medium', 10, 1, @crf_pot_id, 'CRF', 5, 'Certificate training readiness',
   NULL, NULL, 4200.00, 'TuitionFeesDirect', 'AccreditedEducationalTrainingInstitution',
   'Okanagan Skills Centre', 'Okanagan Skills Centre', 'Administrative Assistant Certificate',
   'Start a short certificate that leads to office administration employment.'),
  (5, 'demo-mnbc-eva@awentech.ca', 'Eva', 'Belcourt', '1983-02-07', 'Woman', '604-555-0105',
   '900 West Georgia Street', 'Vancouver', 'V6C 2W6', 'Vancouver',
   'Approved CRF file with an active action plan and intervention.',
   'Tuition; books and supplies',
   'approved', 'decision_recorded', 'approved', 'none', 0,
   'active', 'active', 'case_management', 'active_plan',
   'normal', 'low', 18, 14, @crf_pot_id, 'CRF', 5, 'Academic upgrading support',
   'in_progress', 'in_progress', 6200.00, 'TuitionFeesDirect',
   'AccreditedEducationalTrainingInstitution', 'Vancouver Community Skills Centre',
   'Vancouver Community Skills Centre', 'Bookkeeping Foundations',
   'Complete bookkeeping foundations and move into entry-level finance work.'),
  (6, 'demo-mnbc-farah@awentech.ca', 'Farah', 'Boucher', '1990-11-29', 'Woman', '604-555-0106',
   '13450 102 Avenue', 'Surrey', 'V3T 5X3', 'Surrey',
   'Approved EI file with a submitted living allowance payment packet.',
   'Living allowance; job search supports',
   'approved', 'decision_recorded', 'approved', 'none', 0,
   'active', 'active', 'case_management', 'finance_handoff',
   'high', 'medium', 21, 1, @ei_pot_id, 'EI', 15, 'Job search preparation supports',
   'approved', 'planned', 1250.00, 'LivingAllowance', 'ParticipantClient', NULL,
   'MNBC Employment Services', 'Job Search Launch Plan',
   'Stabilize job search activity while applying for administrative assistant roles.');

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_context;
CREATE TEMPORARY TABLE tmp_mnbc_demo_context (
  scenario_no INT NOT NULL PRIMARY KEY,
  application_answers JSON NOT NULL,
  application_personal JSON NOT NULL,
  case_context_patch JSON NOT NULL
);

INSERT INTO tmp_mnbc_demo_context (
  scenario_no,
  application_answers,
  application_personal,
  case_context_patch
)
SELECT
  p.scenario_no,
  JSON_OBJECT(
    'first-name', p.first_name,
    'middle-names',
      CASE p.scenario_no
        WHEN 1 THEN 'Louise'
        WHEN 2 THEN 'Marie'
        WHEN 3 THEN 'Anne'
        WHEN 4 THEN 'Rae'
        WHEN 5 THEN 'Christine'
        ELSE 'Nadine'
      END,
    'last-name', p.last_name,
    'preferred-name', p.first_name,
    'dob', DATE_FORMAT(p.dob, '%Y-%m-%d'),
    'date-of-birth', DATE_FORMAT(p.dob, '%Y-%m-%d'),
    'gender', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
    'gender_identity', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
    'gender-identity', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
    'pronouns', CASE WHEN p.scenario_no = 4 THEN 'they/them' ELSE 'she/her' END,
    'sex', 'female',
    'biological_sex', 'female',
    'social-insurance-number', NULL,
    'legal-indigenous-identity', 'metis',
    'indigenous-affiliation-declaration', 'Metis Nation of British Columbia',
    'registration-number', CONCAT('MNBC-DEMO-METIS-', LPAD(p.scenario_no, 4, '0')),
    'metis-registration-number', CONCAT('MNBC-DEMO-METIS-', LPAD(p.scenario_no, 4, '0')),
    'home-community', p.home_community,
    'home-comminuty', p.home_community,
    'address-street-address', p.street,
    'address-city', p.city,
    'address-province', 'BC',
    'address-postcode', p.postal_code,
    'address-mailing-address', p.street,
    'contact-email-address', p.email,
    'telephone-day', p.phone,
    'telephone-alt',
      CASE WHEN p.city IN ('Vancouver', 'Surrey') THEN '604-555-0200' ELSE '250-555-0200' END,
    'emergency-contact-name', 'Sandbox Emergency Contact',
    'emergency-contact-relationship', 'Family contact',
    'emergency-contact-telephone',
      CASE WHEN p.city IN ('Vancouver', 'Surrey') THEN '604-555-0300' ELSE '250-555-0300' END,
    'language-spoken', '2',
    'preferred-language', '2',
    'visible-minority', 'no',
    'marital-status', 'single',
    'dependent-children', 'no',
    'ages-of-children', NULL,
    'has-disability', 'no',
    'disability-description', NULL,
    'household-composition', 'Single adult household',
    'social-assistance', 'no',
    'top-up-amount', NULL,
    'disability-support', 'no',
    'disability-support_yes_follow', NULL,
    'labour-force-status',
      CASE p.scenario_no
        WHEN 2 THEN 'underemployed'
        WHEN 4 THEN 'student'
        WHEN 5 THEN 'student'
        ELSE 'unemployed'
      END,
    'highest-education',
      CASE p.scenario_no
        WHEN 4 THEN 'post_secondary_training'
        WHEN 5 THEN 'college'
        ELSE 'secondary_school_diploma_or_ged'
      END,
    'education-year',
      CASE p.scenario_no
        WHEN 1 THEN '2016'
        WHEN 2 THEN '2011'
        WHEN 3 THEN '2005'
        WHEN 4 THEN '2014'
        WHEN 5 THEN '2001'
        ELSE '2009'
      END,
    'education-location', 'bc',
    'target-program',
      CASE WHEN p.scenario_no IN (2, 3, 4, 5) THEN 'skills_development' ELSE 'not_yet' END,
    'employment-goals', p.employment_goal,
    'long-term-goal', p.employment_goal,
    'short-term-goal', p.support_summary,
    'barriers',
      CASE p.scenario_no
        WHEN 1 THEN JSON_ARRAY('lack-of-job-opportunities', 'funding')
        WHEN 2 THEN JSON_ARRAY('education', 'location')
        WHEN 3 THEN JSON_ARRAY('education', 'funding')
        WHEN 4 THEN JSON_ARRAY('education', 'funding')
        WHEN 5 THEN JSON_ARRAY('education')
        ELSE JSON_ARRAY('lack-of-job-opportunities', 'funding')
      END,
    'requested-supports',
      CASE p.scenario_no
        WHEN 1 THEN JSON_ARRAY('other')
        WHEN 2 THEN JSON_ARRAY('transportation', 'other')
        WHEN 3 THEN JSON_ARRAY('tuition', 'other')
        WHEN 4 THEN JSON_ARRAY('tuition', 'books')
        WHEN 5 THEN JSON_ARRAY('tuition', 'books')
        ELSE JSON_ARRAY('living', 'transportation')
      END,
    'other-requested-support', p.requested_supports,
    'childcare-fuding-status', JSON_ARRAY(),
    'income-employment', CASE WHEN p.scenario_no = 2 THEN '1200' ELSE '0' END,
    'income-spousal', '0',
    'income-social-assist', '0',
    'income-child-support', '0',
    'income-child-benefit', '0',
    'income-jordans', '0',
    'income-band-funding', '0',
    'income-alimony', '0',
    'income-other-description', '0',
    'expenses-rent', CASE WHEN p.city IN ('Vancouver', 'Surrey') THEN '1650' ELSE '1250' END,
    'expenses-groceries', '450',
    'expenses-electricity', '90',
    'expenses-heating', '75',
    'expenses-water', '40',
    'expenses-sewerage', '35',
    'expenses-garbage', '30',
    'expenses_bus_pass', CASE WHEN p.scenario_no IN (2, 6) THEN '110' ELSE '0' END,
    'expenses-parking', '0',
    'expenses-other-total', '120',
    'expenses-transport',
      CASE WHEN p.scenario_no IN (2, 6) THEN JSON_ARRAY('buss_pass') ELSE JSON_ARRAY() END,
    'loan-grant', 'no',
    'loan-grant-details', NULL,
    'indigenous_declaration', JSON_OBJECT('signed', TRUE, 'signedAt', '2026-05-29T12:00:00Z'),
    'consent', JSON_OBJECT('signed', TRUE, 'signedAt', '2026-05-29T12:00:00Z'),
    'auth_froici_sign', JSON_OBJECT('signed', TRUE, 'signedAt', '2026-05-29T12:00:00Z'),
    'sig_caofs', JSON_OBJECT('signed', TRUE, 'signedAt', '2026-05-29T12:00:00Z'),
    'conflict_of_interest', 'no',
    'conflict_applicant_signature', JSON_OBJECT('signed', TRUE, 'signedAt', '2026-05-29T12:00:00Z'),
    'legal_submission_sig', JSON_OBJECT('signed', TRUE, 'signedAt', '2026-05-29T12:00:00Z')
  ) AS application_answers,
  JSON_OBJECT(
    'first_name', p.first_name,
    'middle_names',
      CASE p.scenario_no
        WHEN 1 THEN 'Louise'
        WHEN 2 THEN 'Marie'
        WHEN 3 THEN 'Anne'
        WHEN 4 THEN 'Rae'
        WHEN 5 THEN 'Christine'
        ELSE 'Nadine'
      END,
    'last_name', p.last_name,
    'preferred_name', p.first_name,
    'date_of_birth', DATE_FORMAT(p.dob, '%Y-%m-%d'),
    'gender', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
    'gender_identity', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
    'pronouns', CASE WHEN p.scenario_no = 4 THEN 'they/them' ELSE 'she/her' END,
    'sex', 'female',
    'sin', NULL,
    'email', p.email,
    'phone', p.phone,
    'phone_alt', CASE WHEN p.city IN ('Vancouver', 'Surrey') THEN '604-555-0200' ELSE '250-555-0200' END,
    'legal_indigenous_identity', 'metis',
    'indigenous_affiliation', 'Metis Nation of British Columbia',
    'registration_number', CONCAT('MNBC-DEMO-METIS-', LPAD(p.scenario_no, 4, '0')),
    'home_community', p.home_community,
    'preferred_language', '2',
    'address', JSON_OBJECT(
      'line1', p.street,
      'line2', NULL,
      'city', p.city,
      'province', 'BC',
      'postalCode', p.postal_code
    ),
    'mailing_address', JSON_OBJECT(
      'line1', p.street,
      'line2', NULL,
      'city', p.city,
      'province', 'BC',
      'postalCode', p.postal_code
    )
  ) AS application_personal,
  JSON_OBJECT(
    'firstName', p.first_name,
    'middleNames',
      CASE p.scenario_no
        WHEN 1 THEN 'Louise'
        WHEN 2 THEN 'Marie'
        WHEN 3 THEN 'Anne'
        WHEN 4 THEN 'Rae'
        WHEN 5 THEN 'Christine'
        ELSE 'Nadine'
      END,
    'lastName', p.last_name,
    'preferredName', p.first_name,
    'dateOfBirth', DATE_FORMAT(p.dob, '%Y-%m-%d'),
    'gender', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
    'genderIdentity', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
    'pronouns', CASE WHEN p.scenario_no = 4 THEN 'they/them' ELSE 'she/her' END,
    'sex', 'female',
    'sexOther', NULL,
    'sin', NULL,
    'address', JSON_OBJECT(
      'line1', p.street,
      'line2', NULL,
      'city', p.city,
      'province', 'BC',
      'postalCode', p.postal_code
    ),
    'mailingAddress', JSON_OBJECT(
      'line1', p.street,
      'line2', NULL,
      'city', p.city,
      'province', 'BC',
      'postalCode', p.postal_code
    ),
    'emailPrimary', p.email,
    'phonePrimary', p.phone,
    'phoneAlt', CASE WHEN p.city IN ('Vancouver', 'Surrey') THEN '604-555-0200' ELSE '250-555-0200' END,
    'emergencyName', 'Sandbox Emergency Contact',
    'emergencyPhone', CASE WHEN p.city IN ('Vancouver', 'Surrey') THEN '604-555-0300' ELSE '250-555-0300' END,
    'emergencyRelationship', 'Family contact',
    'indigenousIdentity', 'metis',
    'indigenousAffiliation', 'Metis Nation of British Columbia',
    'registrationNumber', CONCAT('MNBC-DEMO-METIS-', LPAD(p.scenario_no, 4, '0')),
    'languageSpoken', '2',
    'preferredLanguage', '2',
    'visibleMinority', 'no',
    'maritalStatus', 'single',
    'dependentChildren', 'no',
    'agesOfChildren', NULL,
    'hasDisability', 'no',
    'homeCommunity', p.home_community,
    'householdComposition', 'Single adult household',
    'socialAssistance', 'no',
    'disabilitySupport', 'no',
    'employmentStatus',
      CASE p.scenario_no
        WHEN 2 THEN 'underemployed'
        WHEN 4 THEN 'student'
        WHEN 5 THEN 'student'
        ELSE 'unemployed'
      END,
    'educationLevel',
      CASE p.scenario_no
        WHEN 4 THEN 'post_secondary_training'
        WHEN 5 THEN 'college'
        ELSE 'secondary_school_diploma_or_ged'
      END,
    'educationYear',
      CASE p.scenario_no
        WHEN 1 THEN '2016'
        WHEN 2 THEN '2011'
        WHEN 3 THEN '2005'
        WHEN 4 THEN '2014'
        WHEN 5 THEN '2001'
        ELSE '2009'
      END,
    'educationProvince', 'bc',
    'targetProgram',
      CASE WHEN p.scenario_no IN (2, 3, 4, 5) THEN 'skills_development' ELSE 'not_yet' END,
    'employmentGoals', p.employment_goal,
    'employmentBarriers',
      CASE p.scenario_no
        WHEN 1 THEN JSON_ARRAY('lack-of-job-opportunities', 'funding')
        WHEN 2 THEN JSON_ARRAY('education', 'location')
        WHEN 3 THEN JSON_ARRAY('education', 'funding')
        WHEN 4 THEN JSON_ARRAY('education', 'funding')
        WHEN 5 THEN JSON_ARRAY('education')
        ELSE JSON_ARRAY('lack-of-job-opportunities', 'funding')
      END,
    'requestedSupports',
      CASE p.scenario_no
        WHEN 1 THEN JSON_ARRAY('other')
        WHEN 2 THEN JSON_ARRAY('transportation', 'other')
        WHEN 3 THEN JSON_ARRAY('tuition', 'other')
        WHEN 4 THEN JSON_ARRAY('tuition', 'books')
        WHEN 5 THEN JSON_ARRAY('tuition', 'books')
        ELSE JSON_ARRAY('living', 'transportation')
      END,
    'childcareFunding', JSON_ARRAY(),
    'otherRequestedSupport', p.requested_supports,
    'longTermGoal', p.employment_goal,
    'shortTermGoal', p.support_summary,
    'incomeEmployment', CASE WHEN p.scenario_no = 2 THEN '1200' ELSE '0' END,
    'incomeSpousal', '0',
    'incomeSocialAssist', '0',
    'incomeChildSupport', '0',
    'incomeChildBenefit', '0',
    'incomeJordans', '0',
    'incomeBandFunding', '0',
    'incomeAlimony', '0',
    'incomeOtherAmount', '0',
    'expensesRent', CASE WHEN p.city IN ('Vancouver', 'Surrey') THEN '1650' ELSE '1250' END,
    'expensesGroceries', '450',
    'expensesElectricity', '90',
    'expensesHeating', '75',
    'expensesWater', '40',
    'expensesSewerage', '35',
    'expensesGarbage', '30',
    'expensesBusPass', CASE WHEN p.scenario_no IN (2, 6) THEN '110' ELSE '0' END,
    'expensesParking', '0',
    'expensesOtherTotal', '120',
    'expensesTransport',
      CASE WHEN p.scenario_no IN (2, 6) THEN JSON_ARRAY('buss_pass') ELSE JSON_ARRAY() END,
    'loanGrant', 'no',
    'applicationPersonal', JSON_OBJECT(
      'first_name', p.first_name,
      'middle_names',
        CASE p.scenario_no
          WHEN 1 THEN 'Louise'
          WHEN 2 THEN 'Marie'
          WHEN 3 THEN 'Anne'
          WHEN 4 THEN 'Rae'
          WHEN 5 THEN 'Christine'
          ELSE 'Nadine'
        END,
      'last_name', p.last_name,
      'preferred_name', p.first_name,
      'date_of_birth', DATE_FORMAT(p.dob, '%Y-%m-%d'),
      'gender', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
      'gender_identity', CASE WHEN p.scenario_no = 4 THEN 'other' ELSE 'female' END,
      'pronouns', CASE WHEN p.scenario_no = 4 THEN 'they/them' ELSE 'she/her' END,
      'sex', 'female',
      'email', p.email,
      'phone', p.phone,
      'phone_alt', CASE WHEN p.city IN ('Vancouver', 'Surrey') THEN '604-555-0200' ELSE '250-555-0200' END,
      'home_community', p.home_community,
      'address', JSON_OBJECT(
        'line1', p.street,
        'line2', NULL,
        'city', p.city,
        'province', 'BC',
        'postalCode', p.postal_code
      )
    ),
    'applicationAnswers', JSON_OBJECT(
      'first-name', p.first_name,
      'last-name', p.last_name,
      'dob', DATE_FORMAT(p.dob, '%Y-%m-%d'),
      'contact-email-address', p.email
    )
  ) AS case_context_patch
FROM tmp_mnbc_demo_person p;

INSERT INTO user (
  name, email, cognito_sub, email_verified, suspended, phone_number, date_of_birth,
  gender, street, city, state, postal_code, country, preferred_language,
  notification_preferences, ptma_id
)
SELECT
  CONCAT(p.first_name, ' ', p.last_name),
  p.email,
  NULL,
  0,
  0,
  p.phone,
  p.dob,
  p.gender,
  p.street,
  p.city,
  'BC',
  p.postal_code,
  'Canada',
  'en',
  JSON_OBJECT(
    'email', FALSE,
    'sms', FALSE,
    'demoNoSend', TRUE,
    'note', 'Synthetic MNBC sandbox applicant without a Cognito account'
  ),
  NULL
FROM tmp_mnbc_demo_person p
ORDER BY p.scenario_no;

INSERT INTO client (
  dob, gender, aboriginal_group, last_name, first_name, initials, address_json,
  applicant_cognito_sub, applicant_cognito_username, applicant_account_status,
  applicant_account_email, applicant_invited_at, applicant_invited_by_staff_profile_id,
  applicant_activated_at
)
SELECT
  p.dob,
  p.gender,
  'Metis',
  p.last_name,
  p.first_name,
  CONCAT(LEFT(p.first_name, 1), LEFT(p.last_name, 1)),
  JSON_OBJECT(
    'source', @demo_source,
    'line1', p.street,
    'city', p.city,
    'province', 'BC',
    'provinceName', 'British Columbia',
    'postalCode', p.postal_code,
    'country', 'Canada',
    'homeCommunity', p.home_community,
    'indigenousIdentity', 'Metis',
    'demoTenant', 'Metis Nation of British Columbia'
  ),
  NULL,
  NULL,
  NULL,
  p.email,
  NULL,
  NULL,
  NULL
FROM tmp_mnbc_demo_person p
ORDER BY p.scenario_no;

INSERT INTO iset_application_submission (
  user_id, workflow_id, reference_number, status, submitted_at, intake_payload,
  schema_snapshot, history, doc_refs, locale, source_ip, user_agent, checksum_sha256
)
SELECT
  u.id,
  'iset-v1',
  CONCAT('MNBC-DEMO-20260529-', LPAD(p.scenario_no, 3, '0')),
  'ingested',
  DATE_SUB(NOW(), INTERVAL p.submitted_days_ago DAY),
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'answers', ctx.application_answers,
    'tenant', 'Metis Nation of British Columbia',
    'first-name', p.first_name,
    'last-name', p.last_name,
    'date-of-birth', DATE_FORMAT(p.dob, '%Y-%m-%d'),
    'gender', p.gender,
    'contact-email-address', p.email,
    'telephone-day', p.phone,
    'address-line1', p.street,
    'address-city', p.city,
    'address-province', 'BC',
    'address-postal-code', p.postal_code,
    'home-community', p.home_community,
    'indigenous-identity', 'Metis',
    'legal-indigenous-identity', 'Metis',
    'province-of-residence', 'BC',
    'requested-supports-summary', p.requested_supports,
    'employment-goal', p.employment_goal,
    'publicPortalAccount', 'not_created',
    'notifications', 'disabled_for_synthetic_awentech_demo_address'
  ),
  JSON_OBJECT(
    'source', @demo_source,
    'workflow', 'iset-v1',
    'note', 'Synthetic sandbox seed; not a real portal submission'
  ),
  JSON_ARRAY(
    JSON_OBJECT(
      'at', DATE_FORMAT(DATE_SUB(NOW(), INTERVAL p.submitted_days_ago DAY), '%Y-%m-%dT%H:%i:%sZ'),
      'event', 'synthetic_submission_seeded',
      'source', @demo_source
    )
  ),
  JSON_ARRAY(),
  'en',
  '127.0.0.1',
  'MNBC sandbox seed',
  SHA2(CONCAT(@demo_source, ':', p.email), 256)
FROM tmp_mnbc_demo_person p
JOIN tmp_mnbc_demo_context ctx ON ctx.scenario_no = p.scenario_no
JOIN user u ON u.email = p.email
ORDER BY p.scenario_no;

INSERT INTO iset_case (
  case_number, client_id, assigned_staff_profile_id, status, lifecycle_status,
  stage, sub_stage, priority, opened_at, next_action_due_at, case_context_json,
  risk_rating, portfolio_region_id, created_by_staff_profile_id,
  updated_by_staff_profile_id
)
SELECT
  CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0')),
  c.id,
  @program_staff_profile_id,
  p.case_status,
  p.case_lifecycle_status,
  p.case_stage,
  p.case_sub_stage,
  p.priority,
  DATE_SUB(NOW(), INTERVAL p.submitted_days_ago DAY),
  DATE_ADD(NOW(), INTERVAL p.due_days DAY),
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'demoTenant', 'Metis Nation of British Columbia',
    'applicantEmail', p.email,
    'assignedStaffEmail', @program_email,
    'indigenousIdentity', 'Metis',
    'province', 'BC',
    'homeCommunity', p.home_community,
    'supportSummary', p.support_summary,
    'publicPortalAccount', 'not_created',
    'notifications', 'disabled_for_synthetic_awentech_demo_address',
    'ptma', JSON_OBJECT('used', FALSE, 'reason', 'Legacy dormant model')
  ),
  p.risk_rating,
  @bc_region_id,
  @program_staff_profile_id,
  @program_staff_profile_id
FROM tmp_mnbc_demo_person p
JOIN client c ON c.applicant_account_email = p.email
ORDER BY p.scenario_no;

UPDATE iset_case c
JOIN tmp_mnbc_demo_person p
  ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN tmp_mnbc_demo_context ctx
  ON ctx.scenario_no = p.scenario_no
   SET c.case_context_json = JSON_SET(
         JSON_MERGE_PATCH(COALESCE(c.case_context_json, JSON_OBJECT()), ctx.case_context_patch),
         '$.applicationAnswers', ctx.application_answers,
         '$.applicationPersonal', ctx.application_personal
       ),
       c.updated_at = NOW();

INSERT INTO iset_application (
  submission_id, client_id, case_id, payload_json, status, lifecycle_status,
  decision_outcome, awaiting_reason, version, docs_requested_active,
  docs_requested_at, docs_requested_cleared_at, docs_requested_source
)
SELECT
  s.id,
  c.id,
  ic.id,
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'answers', ctx.application_answers,
    'applicationPersonal', ctx.application_personal,
    'personal', ctx.application_personal,
    'tenant', 'Metis Nation of British Columbia',
    'applicant', JSON_OBJECT(
      'firstName', p.first_name,
      'lastName', p.last_name,
      'email', p.email,
      'phone', p.phone,
      'indigenousIdentity', 'Metis',
      'province', 'BC',
      'homeCommunity', p.home_community
    ),
    'requestedSupports', p.requested_supports,
    'employmentGoal', p.employment_goal,
    'supportSummary', p.support_summary,
    'budgetPotId', p.budget_pot_id,
    'fundingStream', p.funding_stream,
    'publicPortalAccount', 'not_created'
  ),
  p.application_status,
  p.application_lifecycle_status,
  p.decision_outcome,
  p.awaiting_reason,
  1,
  p.docs_requested_active,
  CASE WHEN p.docs_requested_active = 1 THEN DATE_SUB(NOW(), INTERVAL 2 DAY) ELSE NULL END,
  NULL,
  CASE WHEN p.docs_requested_active = 1 THEN 'manual' ELSE NULL END
FROM tmp_mnbc_demo_person p
JOIN tmp_mnbc_demo_context ctx ON ctx.scenario_no = p.scenario_no
JOIN user u ON u.email = p.email
JOIN iset_application_submission s
  ON s.user_id = u.id
 AND s.reference_number = CONCAT('MNBC-DEMO-20260529-', LPAD(p.scenario_no, 3, '0'))
JOIN client c ON c.applicant_account_email = p.email
JOIN iset_case ic ON ic.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
ORDER BY p.scenario_no;

INSERT INTO iset_application_version (
  application_id, version, payload_json, change_summary,
  created_by_staff_profile_id, created_by_user_id, created_by_name
)
SELECT
  a.id,
  1,
  a.payload_json,
  'Seeded MNBC sandbox demo baseline.',
  @program_staff_profile_id,
  @program_user_id,
  'Program Admin'
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
WHERE c.case_number LIKE 'MNBC-DEMO-%'
ORDER BY c.case_number;

INSERT INTO iset_application_assessment (
  application_id, case_id, date_of_assessment, overview, employment_goals,
  previous_iset, previous_iset_details, employment_barriers, local_area_priorities,
  other_funding_details, esdc_eligibility, intervention_start_date,
  intervention_end_date, intervention_budget_pot_id, posting_context,
  intervention_code, intervention_duration_days, intervention_cost_total,
  childcare_need, childcare_funding_details, institution, program_name,
  recommendation, justification, nwac_review, nwac_reason,
  employment_barriers_other_details, proposed_interventions
)
SELECT
  a.id,
  c.id,
  DATE_SUB(CURRENT_DATE(), INTERVAL GREATEST(p.submitted_days_ago - 2, 0) DAY),
  p.support_summary,
  p.employment_goal,
  0,
  NULL,
  JSON_ARRAY('Education', 'Lack of Transportation', 'Economic'),
  JSON_ARRAY('Off Reserve', 'Non-Targeted'),
  'No other confirmed funding recorded for the sandbox scenario.',
  CASE WHEN p.funding_stream = 'EI' THEN 'EI Active Claim' ELSE 'CRF' END,
  CASE WHEN p.intervention_code IS NULL THEN NULL ELSE DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) END,
  CASE WHEN p.intervention_code IS NULL THEN NULL ELSE DATE_ADD(CURRENT_DATE(), INTERVAL 67 DAY) END,
  p.budget_pot_id,
  CASE WHEN p.budget_pot_id IS NULL THEN NULL ELSE 'external' END,
  p.intervention_code,
  CASE WHEN p.intervention_code IS NULL THEN NULL ELSE 60 END,
  CASE WHEN p.requested_amount IS NULL THEN NULL ELSE CAST(p.requested_amount AS UNSIGNED) END,
  0,
  NULL,
  p.institution,
  p.program_name,
  CASE WHEN p.scenario_no >= 4 THEN 'recommend' ELSE NULL END,
  CASE
    WHEN p.scenario_no = 2 THEN 'Assessment started; eligibility and support details are being confirmed.'
    WHEN p.scenario_no = 3 THEN 'Waiting on requested documentation before the funding recommendation can be finalized.'
    WHEN p.scenario_no = 4 THEN 'Coordinator recommends funding based on eligible training costs and employment goal alignment.'
    WHEN p.scenario_no IN (5, 6) THEN 'Funding approved for the sandbox scenario and ready for case management follow-through.'
    ELSE NULL
  END,
  CASE WHEN p.scenario_no IN (5, 6) THEN 'agree' ELSE NULL END,
  NULL,
  NULL,
  CASE
    WHEN p.intervention_code IS NULL THEN JSON_ARRAY()
    ELSE JSON_ARRAY(JSON_OBJECT(
      'id', CONCAT('demo-mnbc-', p.scenario_no, '-intervention'),
      'code', CAST(p.intervention_code AS CHAR),
      'title', p.intervention_title,
      'fundingStream', p.funding_stream,
      'budgetPotId', p.budget_pot_id,
      'postingContext', 'external',
      'startDate', DATE_FORMAT(DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY), '%Y-%m-%d'),
      'endDate', DATE_FORMAT(DATE_ADD(CURRENT_DATE(), INTERVAL 67 DAY), '%Y-%m-%d'),
      'costLines', JSON_ARRAY(JSON_OBJECT(
        'type', p.payment_type,
        'amount', p.requested_amount,
        'payeeType', p.payee_type,
        'payeeName', COALESCE(p.payee_name, CONCAT(p.first_name, ' ', p.last_name)),
        'description', p.intervention_title
      ))
    ))
  END
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_application a ON a.case_id = c.id
WHERE p.scenario_no >= 2
ORDER BY p.scenario_no;

INSERT INTO iset_case_assessment (
  case_id, date_of_assessment, overview, employment_goals, previous_iset,
  previous_iset_details, employment_barriers, local_area_priorities,
  other_funding_details, esdc_eligibility, intervention_start_date,
  intervention_end_date, intervention_budget_pot_id, posting_context,
  intervention_code, intervention_duration_days, intervention_cost_total,
  childcare_need, childcare_funding_details, institution, program_name,
  recommendation, justification, nwac_review, nwac_reason,
  employment_barriers_other_details, proposed_interventions
)
SELECT
  aa.case_id, aa.date_of_assessment, aa.overview, aa.employment_goals,
  aa.previous_iset, aa.previous_iset_details, aa.employment_barriers,
  aa.local_area_priorities, aa.other_funding_details, aa.esdc_eligibility,
  aa.intervention_start_date, aa.intervention_end_date,
  aa.intervention_budget_pot_id, aa.posting_context, aa.intervention_code,
  aa.intervention_duration_days, aa.intervention_cost_total,
  aa.childcare_need, aa.childcare_funding_details, aa.institution,
  aa.program_name, aa.recommendation, aa.justification, aa.nwac_review,
  aa.nwac_reason, aa.employment_barriers_other_details,
  aa.proposed_interventions
FROM iset_application_assessment aa
JOIN iset_case c ON c.id = aa.case_id
WHERE c.case_number LIKE 'MNBC-DEMO-%';

INSERT INTO iset_case_action_plan (
  case_id, application_id, name, status, agreement_number, budget_pot,
  funding_stream, version, owner_staff_profile_id, owner_user_id,
  effective_date, review_date, activated_at, result_code, EIClaimant,
  prev_employment, notes, metadata_json, esdc_action_plan_json
)
SELECT
  c.id,
  a.id,
  CONCAT(p.first_name, ' ', p.last_name, ' - ', p.funding_stream, ' action plan'),
  'active',
  CONCAT('MNBC-DEMO-AP-', LPAD(p.scenario_no, 4, '0')),
  CAST(p.budget_pot_id AS CHAR),
  p.funding_stream,
  1,
  @program_staff_profile_id,
  @program_user_id,
  CASE WHEN p.scenario_no = 5 THEN DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY) ELSE DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) END,
  CASE WHEN p.scenario_no = 5 THEN DATE_ADD(CURRENT_DATE(), INTERVAL 80 DAY) ELSE DATE_ADD(CURRENT_DATE(), INTERVAL 67 DAY) END,
  NOW(),
  NULL,
  CASE WHEN p.funding_stream = 'EI' THEN 1 ELSE 3 END,
  2,
  p.support_summary,
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'scenario', p.scenario_no,
    'postingContext', 'external',
    'budgetPotId', p.budget_pot_id,
    'budgetPotCode', CASE WHEN p.funding_stream = 'EI' THEN 'MNBC-ISET-EI' ELSE 'MNBC-ISET-CRF' END,
    'fundingStream', p.funding_stream,
    'assignedStaffEmail', @program_email
  ),
  JSON_OBJECT(
    'postingContext', 'external',
    'fundingStream', p.funding_stream,
    'budgetPotId', p.budget_pot_id
  )
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_application a ON a.case_id = c.id
WHERE p.scenario_no IN (5, 6)
ORDER BY p.scenario_no;

INSERT INTO esdc_participant_submission (
  case_id, action_plan_id, application_id, readiness_status, readiness_summary,
  warnings, blocking_issues, last_validated_at, submission_status, payload_snapshot
)
SELECT
  c.id,
  ap.id,
  a.id,
  'needs_review',
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'scenario', p.scenario_no,
    'summary', 'Sandbox ILMP participant row seeded for queue demonstration.'
  ),
  JSON_ARRAY(
    'Review seeded participant data before generating an ILMP export; supporting documents are intentionally not attached.'
  ),
  NULL,
  NOW(),
  'pending',
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'caseNumber', c.case_number,
    'participantName', CONCAT(p.first_name, ' ', p.last_name),
    'actionPlanAgreementNumber', ap.agreement_number,
    'generatedFor', 'sandbox_demo'
  )
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_application a ON a.case_id = c.id
JOIN iset_case_action_plan ap ON ap.case_id = c.id
WHERE p.scenario_no = 5;

INSERT INTO esdc_participant_submission_history (
  participant_submission_id, event_type, actor_user_id, event_details, occurred_at
)
SELECT
  eps.id,
  'validated',
  @program_user_id,
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'message', 'Seeded participant submission queued for sandbox ILMP review.'
  ),
  NOW()
FROM esdc_participant_submission eps
JOIN iset_case c ON c.id = eps.case_id
WHERE c.case_number = 'MNBC-DEMO-0005';

INSERT INTO iset_case_intervention (
  case_id, action_plan_id, intervention_code, related_noc_version, related_noc,
  status, delivery_status, start_date, end_date, duration_days,
  intervention_cost, budget_amount, approved_amount, actual_amount,
  outcome_code, notes, metadata_json, esdc_intervention_json,
  created_by_staff_profile_id, reviewed_by_staff_profile_id, reviewed_at,
  review_notes, eligibility_result, funding_stream_decision, required_docs_flags
)
SELECT
  c.id,
  ap.id,
  p.intervention_code,
  NULL,
  NULL,
  p.intervention_status,
  p.delivery_status,
  CASE WHEN p.scenario_no = 5 THEN DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY) ELSE DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY) END,
  CASE WHEN p.scenario_no = 5 THEN DATE_ADD(CURRENT_DATE(), INTERVAL 80 DAY) ELSE DATE_ADD(CURRENT_DATE(), INTERVAL 67 DAY) END,
  CASE WHEN p.scenario_no = 5 THEN 90 ELSE 60 END,
  p.requested_amount,
  p.requested_amount,
  p.requested_amount,
  CASE WHEN p.scenario_no = 5 THEN 3000.00 ELSE NULL END,
  NULL,
  p.intervention_title,
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'scenario', p.scenario_no,
    'title', p.intervention_title,
    'fundingStream', p.funding_stream,
    'budgetPotId', p.budget_pot_id,
    'postingContext', 'external',
    'paymentTypes', JSON_ARRAY(JSON_OBJECT(
      'type', p.payment_type,
      'amount', p.requested_amount,
      'payeeType', p.payee_type,
      'payeeName', COALESCE(p.payee_name, CONCAT(p.first_name, ' ', p.last_name))
    ))
  ),
  JSON_OBJECT(
    'interventionCode', p.intervention_code,
    'interventionDuration', CASE WHEN p.scenario_no = 5 THEN 90 ELSE 60 END,
    'interventionCost', p.requested_amount
  ),
  @program_staff_profile_id,
  @program_staff_profile_id,
  NOW(),
  'Seeded approved sandbox intervention.',
  'eligible',
  p.funding_stream,
  JSON_OBJECT(
    'FundingAgreement', TRUE,
    'CaseManagerAssessment', TRUE,
    'EIVerification', CASE WHEN p.funding_stream = 'EI' THEN TRUE ELSE FALSE END
  )
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_case_action_plan ap ON ap.case_id = c.id
WHERE p.scenario_no IN (5, 6)
ORDER BY p.scenario_no;

INSERT INTO finance_transaction (
  case_id, case_intervention_id, budget_pot_id, posting_context,
  gl_project_code_used, amount, currency, status, transaction_date, posted_at,
  description, evidence_ref, metadata, created_by_user_id, created_at, updated_at
)
SELECT
  c.id,
  ci.id,
  p.budget_pot_id,
  'external',
  bp.gl_project_code_external,
  3000.00,
  'CAD',
  'posted',
  DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY),
  NOW(),
  'MNBC sandbox recorded tuition disbursement for Eva Belcourt.',
  CONCAT('mnbc-demo:', c.case_number, ':posted-tuition'),
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'scenario', p.scenario_no,
    'budgetPotCode', bp.code,
    'fundingStream', p.funding_stream,
    'postingContext', 'external',
    'demoLedgerState', 'recorded_actual'
  ),
  @program_user_id,
  NOW(),
  NOW()
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_case_intervention ci ON ci.case_id = c.id
JOIN budget_pot bp ON bp.id = p.budget_pot_id
WHERE p.scenario_no = 5;

INSERT INTO finance_transaction (
  case_id, case_intervention_id, budget_pot_id, posting_context,
  gl_project_code_used, amount, currency, status, transaction_date,
  description, evidence_ref, metadata, created_by_user_id, created_at, updated_at
)
SELECT
  c.id,
  ci.id,
  p.budget_pot_id,
  'external',
  bp.gl_project_code_external,
  3200.00,
  'CAD',
  'submitted',
  CURRENT_DATE(),
  'MNBC sandbox committed tuition balance for Eva Belcourt.',
  CONCAT('mnbc-demo:', c.case_number, ':committed-tuition-balance'),
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'scenario', p.scenario_no,
    'budgetPotCode', bp.code,
    'fundingStream', p.funding_stream,
    'postingContext', 'external',
    'demoLedgerState', 'committed_balance'
  ),
  @program_user_id,
  NOW(),
  NOW()
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_case_intervention ci ON ci.case_id = c.id
JOIN budget_pot bp ON bp.id = p.budget_pot_id
WHERE p.scenario_no = 5;

INSERT INTO payment_packet (
  case_id, client_id, intervention_id, reporting_unit, status, follow_up_status,
  requester_user_id, submitted_at, due_by, notes_internal, risk_flags, metadata
)
SELECT
  c.id,
  cl.id,
  ci.id,
  'BC',
  'submitted',
  'sent_to_finance',
  @program_user_id,
  NOW(),
  DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
  'Submitted sandbox payment packet for finance handoff demonstration. No email notification was sent.',
  JSON_ARRAY(),
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'scenario', p.scenario_no,
    'postingContext', 'external',
    'assignedStaffEmail', @program_email,
    'note', 'Submitted in seed data only; no email was sent from this sandbox packet'
  )
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN client cl ON cl.applicant_account_email = p.email
JOIN iset_case_intervention ci ON ci.case_id = c.id
WHERE p.scenario_no = 6;

INSERT INTO payment_packet_line (
  payment_packet_id, intervention_id, payment_type, payee_type, payee_name,
  payee_reference, amount, currency, service_period_start, service_period_end,
  invoice_reference_number, requested_payment_date, budget_pot_id, funding_stream,
  status, follow_up_status, metadata
)
SELECT
  pp.id,
  ci.id,
  p.payment_type,
  p.payee_type,
  CONCAT(p.first_name, ' ', p.last_name),
  CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0')),
  p.requested_amount,
  'CAD',
  DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
  DATE_ADD(CURRENT_DATE(), INTERVAL 37 DAY),
  CONCAT('MNBC-DEMO-LA-', LPAD(p.scenario_no, 4, '0')),
  DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
  p.budget_pot_id,
  p.funding_stream,
  'submitted',
  'sent_to_finance',
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'scenario', p.scenario_no,
    'postingContext', 'external',
    'supportSummary', p.support_summary
  )
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_case_intervention ci ON ci.case_id = c.id
JOIN payment_packet pp ON pp.intervention_id = ci.id
WHERE p.scenario_no = 6;

INSERT INTO finance_transaction (
  case_id, case_intervention_id, budget_pot_id, posting_context,
  gl_project_code_used, amount, currency, status, transaction_date,
  description, evidence_ref, metadata, created_by_user_id, created_at, updated_at
)
SELECT
  c.id,
  ci.id,
  p.budget_pot_id,
  'external',
  bp.gl_project_code_external,
  ppl.amount,
  ppl.currency,
  'submitted',
  CURRENT_DATE(),
  'MNBC sandbox submitted EI living allowance payment packet.',
  CONCAT('payment_packet:', pp.id),
  JSON_OBJECT(
    'source', @demo_source,
    'demo', TRUE,
    'scenario', p.scenario_no,
    'budgetPotCode', bp.code,
    'fundingStream', p.funding_stream,
    'postingContext', 'external',
    'paymentPacketId', CAST(pp.id AS CHAR),
    'paymentLineId', CAST(ppl.id AS CHAR),
    'demoLedgerState', 'submitted_payment_packet'
  ),
  @program_user_id,
  NOW(),
  NOW()
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_case_intervention ci ON ci.case_id = c.id
JOIN payment_packet pp ON pp.intervention_id = ci.id
JOIN payment_packet_line ppl ON ppl.payment_packet_id = pp.id
JOIN budget_pot bp ON bp.id = p.budget_pot_id
WHERE p.scenario_no = 6;

INSERT INTO payment_line_transaction (payment_packet_line_id, finance_transaction_id, created_at)
SELECT
  ppl.id,
  ft.id,
  NOW()
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
JOIN iset_case_intervention ci ON ci.case_id = c.id
JOIN payment_packet pp ON pp.intervention_id = ci.id
JOIN payment_packet_line ppl ON ppl.payment_packet_id = pp.id
JOIN finance_transaction ft
  ON ft.case_intervention_id = ci.id
 AND ft.evidence_ref = CONCAT('payment_packet:', pp.id)
WHERE p.scenario_no = 6;

INSERT INTO payment_status_event (
  payment_packet_id, payment_packet_line_id, from_status, to_status,
  actor_user_id, notes, metadata
)
SELECT
  pp.id,
  NULL,
  NULL,
  'submitted',
  @program_user_id,
  'Submitted sandbox payment packet seeded for finance handoff demonstration; no email was sent.',
  JSON_OBJECT('source', @demo_source, 'demo', TRUE)
FROM payment_packet pp
JOIN iset_case c ON c.id = pp.case_id
WHERE c.case_number = 'MNBC-DEMO-0006';

INSERT INTO payment_followup_event (
  payment_packet_id, payment_packet_line_id, from_status, to_status,
  actor_user_id, note, due_at, metadata, created_at
)
SELECT
  pp.id,
  NULL,
  'not_required',
  'sent_to_finance',
  @program_user_id,
  'Sandbox finance handoff recorded without sending email.',
  DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
  JSON_OBJECT('source', @demo_source, 'demo', TRUE),
  NOW()
FROM payment_packet pp
JOIN iset_case c ON c.id = pp.case_id
WHERE c.case_number = 'MNBC-DEMO-0006'
UNION ALL
SELECT
  pp.id,
  ppl.id,
  'not_required',
  'sent_to_finance',
  @program_user_id,
  'Sandbox finance handoff recorded without sending email.',
  DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
  JSON_OBJECT('source', @demo_source, 'demo', TRUE),
  NOW()
FROM payment_packet pp
JOIN payment_packet_line ppl ON ppl.payment_packet_id = pp.id
JOIN iset_case c ON c.id = pp.case_id
WHERE c.case_number = 'MNBC-DEMO-0006';

INSERT INTO messages (
  sender_actor_type, sender_user_id, sender_staff_profile_id,
  recipient_actor_type, recipient_user_id, recipient_staff_profile_id,
  case_id, application_id, subject, body, status, urgent, deleted, created_at
)
SELECT
  'staff_profile',
  @program_user_id,
  @program_staff_profile_id,
  'applicant_user',
  u.id,
  NULL,
  c.id,
  a.id,
  'MNBC-DEMO-0003: Document request',
  'Please upload proof of BC residence and the updated training outline when available. This is a sandbox message and no email notification was sent.',
  'unread',
  1,
  0,
  DATE_SUB(NOW(), INTERVAL 2 DAY)
FROM tmp_mnbc_demo_person p
JOIN user u ON u.email = p.email
JOIN iset_case c ON c.case_number = 'MNBC-DEMO-0003'
JOIN iset_application a ON a.case_id = c.id
WHERE p.scenario_no = 3;

INSERT INTO messages (
  sender_actor_type, sender_user_id, sender_staff_profile_id,
  recipient_actor_type, recipient_user_id, recipient_staff_profile_id,
  case_id, application_id, subject, body, status, urgent, deleted, created_at
)
SELECT
  'applicant_user',
  u.id,
  NULL,
  'staff_profile',
  @program_user_id,
  @program_staff_profile_id,
  c.id,
  a.id,
  'MNBC-DEMO-0002: Applicant update',
  'I can attend the weekday skills program and can provide transit receipts if needed. This is a sandbox message and no email notification was sent.',
  'unread',
  0,
  0,
  DATE_SUB(NOW(), INTERVAL 1 DAY)
FROM tmp_mnbc_demo_person p
JOIN user u ON u.email = p.email
JOIN iset_case c ON c.case_number = 'MNBC-DEMO-0002'
JOIN iset_application a ON a.case_id = c.id
WHERE p.scenario_no = 2;

INSERT INTO message_item (message_id, owner_user_id, folder, folder_before_deleted, read_at, deleted_at, purged_at)
SELECT m.id, u.id, 'inbox', NULL, NULL, NULL, NULL
  FROM messages m
  JOIN user u ON u.email = 'demo-mnbc-clara@awentech.ca'
 WHERE m.subject = 'MNBC-DEMO-0003: Document request'
UNION ALL
SELECT m.id, @program_user_id, 'sent', NULL, NULL, NULL, NULL
  FROM messages m
 WHERE m.subject = 'MNBC-DEMO-0003: Document request'
UNION ALL
SELECT m.id, @program_user_id, 'inbox', NULL, NULL, NULL, NULL
  FROM messages m
 WHERE m.subject = 'MNBC-DEMO-0002: Applicant update'
UNION ALL
SELECT m.id, u.id, 'sent', NULL, NULL, NULL, NULL
  FROM messages m
  JOIN user u ON u.email = 'demo-mnbc-brielle@awentech.ca'
 WHERE m.subject = 'MNBC-DEMO-0002: Applicant update';

INSERT INTO iset_case_task (
  case_id, title, description, status, category, priority,
  assigned_to_staff_profile_id, assigned_to_user_id, due_at,
  created_by_staff_profile_id, created_by_user_id,
  updated_by_staff_profile_id, updated_by_user_id
)
SELECT c.id, 'Review new intake', 'Confirm applicant details and move the application into assessment.', 'open',
       'Application intake', 'normal', @program_staff_profile_id, @program_user_id,
       DATE_ADD(NOW(), INTERVAL 3 DAY), @program_staff_profile_id, @program_user_id,
       @program_staff_profile_id, @program_user_id
  FROM iset_case c WHERE c.case_number = 'MNBC-DEMO-0001'
UNION ALL
SELECT c.id, 'Follow up on requested documents', 'Applicant has been asked for BC residence evidence and a training outline.', 'open',
       'Document follow-up', 'high', @program_staff_profile_id, @program_user_id,
       DATE_ADD(NOW(), INTERVAL 5 DAY), @program_staff_profile_id, @program_user_id,
       @program_staff_profile_id, @program_user_id
  FROM iset_case c WHERE c.case_number = 'MNBC-DEMO-0003'
UNION ALL
SELECT c.id, 'Record NWAC decision', 'Review the coordinator recommendation and record the funding decision.', 'open',
       'Approval review', 'high', @program_staff_profile_id, @program_user_id,
       DATE_ADD(NOW(), INTERVAL 1 DAY), @program_staff_profile_id, @program_user_id,
       @program_staff_profile_id, @program_user_id
  FROM iset_case c WHERE c.case_number = 'MNBC-DEMO-0004'
UNION ALL
SELECT c.id, 'Attach EI evidence before finance handoff', 'Draft payment packet is waiting for EI verification or supporting evidence.', 'open',
       'Payment evidence', 'high', @program_staff_profile_id, @program_user_id,
       DATE_ADD(NOW(), INTERVAL 1 DAY), @program_staff_profile_id, @program_user_id,
       @program_staff_profile_id, @program_user_id
  FROM iset_case c WHERE c.case_number = 'MNBC-DEMO-0006';

INSERT INTO iset_case_note (
  case_id, author_staff_profile_id, author_user_id, body, is_internal, is_pinned, follow_up_at
)
SELECT c.id, @program_staff_profile_id, @program_user_id,
       'Sandbox note: action plan is active and the CRF intervention is underway. Use this file to demonstrate case-management follow-through.',
       1, 0, DATE_ADD(NOW(), INTERVAL 14 DAY)
  FROM iset_case c WHERE c.case_number = 'MNBC-DEMO-0005'
UNION ALL
SELECT c.id, @program_staff_profile_id, @program_user_id,
       'Sandbox note: payment packet is deliberately left in draft so staff can practice evidence review and finance handoff.',
       1, 1, DATE_ADD(NOW(), INTERVAL 7 DAY)
  FROM iset_case c WHERE c.case_number = 'MNBC-DEMO-0006';

INSERT INTO iset_case_event (
  case_id, event_type, summary, payload_json, occurred_at,
  actor_staff_profile_id, actor_user_id, source_system
)
SELECT
  c.id,
  'mnbc_demo_application_received',
  CONCAT('Sandbox application received for ', p.first_name, ' ', p.last_name),
  JSON_OBJECT('source', @demo_source, 'scenario', p.scenario_no, 'applicationStatus', p.application_status),
  DATE_SUB(NOW(3), INTERVAL p.submitted_days_ago DAY),
  @program_staff_profile_id,
  @program_user_id,
  @demo_source
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
;

INSERT INTO iset_case_event (
  case_id, event_type, summary, payload_json, occurred_at,
  actor_staff_profile_id, actor_user_id, source_system
)
SELECT
  c.id,
  'mnbc_demo_assessment_started',
  CONCAT('Sandbox assessment context seeded for ', p.first_name, ' ', p.last_name),
  JSON_OBJECT('source', @demo_source, 'scenario', p.scenario_no, 'fundingStream', p.funding_stream),
  DATE_SUB(NOW(3), INTERVAL GREATEST(p.submitted_days_ago - 1, 0) DAY),
  @program_staff_profile_id,
  @program_user_id,
  @demo_source
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = CONCAT('MNBC-DEMO-', LPAD(p.scenario_no, 4, '0'))
WHERE p.scenario_no >= 2;

INSERT INTO iset_case_event (
  case_id, event_type, summary, payload_json, occurred_at,
  actor_staff_profile_id, actor_user_id, source_system
)
SELECT
  c.id,
  'mnbc_demo_document_request_set',
  'Sandbox document request set for applicant follow-up',
  JSON_OBJECT('source', @demo_source, 'scenario', p.scenario_no, 'docsRequestedActive', TRUE),
  DATE_SUB(NOW(3), INTERVAL 2 DAY),
  @program_staff_profile_id,
  @program_user_id,
  @demo_source
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = 'MNBC-DEMO-0003'
WHERE p.scenario_no = 3;

INSERT INTO iset_case_event (
  case_id, event_type, summary, payload_json, occurred_at,
  actor_staff_profile_id, actor_user_id, source_system
)
SELECT
  c.id,
  'mnbc_demo_decision_pending',
  'Sandbox application is pending NWAC decision',
  JSON_OBJECT('source', @demo_source, 'scenario', p.scenario_no),
  DATE_SUB(NOW(3), INTERVAL 1 DAY),
  @program_staff_profile_id,
  @program_user_id,
  @demo_source
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = 'MNBC-DEMO-0004'
WHERE p.scenario_no = 4;

INSERT INTO iset_case_event (
  case_id, event_type, summary, payload_json, occurred_at,
  actor_staff_profile_id, actor_user_id, source_system
)
SELECT
  c.id,
  'mnbc_demo_action_plan_active',
  'Sandbox action plan and intervention are active',
  JSON_OBJECT('source', @demo_source, 'scenario', p.scenario_no, 'fundingStream', p.funding_stream),
  NOW(3),
  @program_staff_profile_id,
  @program_user_id,
  @demo_source
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = 'MNBC-DEMO-0005'
WHERE p.scenario_no = 5;

INSERT INTO iset_case_event (
  case_id, event_type, summary, payload_json, occurred_at,
  actor_staff_profile_id, actor_user_id, source_system
)
SELECT
  c.id,
  'mnbc_demo_payment_packet_submitted',
  'Sandbox payment packet submitted for finance handoff',
  JSON_OBJECT('source', @demo_source, 'scenario', p.scenario_no, 'fundingStream', p.funding_stream),
  NOW(3),
  @program_staff_profile_id,
  @program_user_id,
  @demo_source
FROM tmp_mnbc_demo_person p
JOIN iset_case c ON c.case_number = 'MNBC-DEMO-0006'
WHERE p.scenario_no = 6;

UPDATE iset_case c
LEFT JOIN (
  SELECT
    case_id,
    SUM(CASE WHEN deleted_at IS NULL AND status <> 'completed' THEN 1 ELSE 0 END) AS open_task_count,
    SUM(CASE WHEN deleted_at IS NULL AND status <> 'completed' AND due_at < NOW() THEN 1 ELSE 0 END) AS overdue_task_count
  FROM iset_case_task
  GROUP BY case_id
) tc ON tc.case_id = c.id
LEFT JOIN (
  SELECT
    case_id,
    COUNT(*) AS total_intervention_count,
    SUM(CASE WHEN status NOT IN ('completed', 'cancelled', 'rejected') THEN 1 ELSE 0 END) AS open_intervention_count
  FROM iset_case_intervention
  GROUP BY case_id
) ic ON ic.case_id = c.id
   SET c.open_task_count = COALESCE(tc.open_task_count, 0),
       c.overdue_task_count = COALESCE(tc.overdue_task_count, 0),
       c.total_intervention_count = COALESCE(ic.total_intervention_count, 0),
       c.open_intervention_count = COALESCE(ic.open_intervention_count, 0),
       c.updated_by_staff_profile_id = @program_staff_profile_id,
       c.updated_at = NOW()
 WHERE c.case_number LIKE 'MNBC-DEMO-%';

DROP TEMPORARY TABLE IF EXISTS tmp_mnbc_demo_budget_rollup;
CREATE TEMPORARY TABLE tmp_mnbc_demo_budget_rollup AS
SELECT
  bp.id,
  COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(ft.status, ''))) = 'submitted' THEN ft.amount ELSE 0 END), 0) AS committed_amount,
  COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(ft.status, ''))) = 'posted' THEN ft.amount ELSE 0 END), 0) AS actual_amount
FROM budget_pot bp
LEFT JOIN finance_transaction ft ON ft.budget_pot_id = bp.id
WHERE bp.code IN ('MNBC-ISET-CRF', 'MNBC-ISET-EI')
GROUP BY bp.id;

UPDATE budget_pot bp
JOIN tmp_mnbc_demo_budget_rollup r ON r.id = bp.id
   SET bp.committed_amount = r.committed_amount,
       bp.actual_amount = r.actual_amount,
       bp.updated_at = NOW()
WHERE bp.code IN ('MNBC-ISET-CRF', 'MNBC-ISET-EI');

UPDATE budget_pot parent
JOIN (
  SELECT
    child.parent_id,
    COALESCE(SUM(child.committed_amount), 0) AS committed_amount,
    COALESCE(SUM(child.actual_amount), 0) AS actual_amount
  FROM budget_pot child
  WHERE child.code IN ('MNBC-ISET-CRF', 'MNBC-ISET-EI')
  GROUP BY child.parent_id
) rollup ON rollup.parent_id = parent.id
   SET parent.committed_amount = rollup.committed_amount,
       parent.actual_amount = rollup.actual_amount,
       parent.updated_at = NOW()
WHERE parent.code = 'MNBC-ISET';

COMMIT;

SELECT
  'mnbc_demo_seed_summary' AS check_name,
  (SELECT COUNT(*) FROM user WHERE email LIKE 'demo-mnbc-%@awentech.ca') AS demo_users,
  (SELECT COUNT(*) FROM client WHERE applicant_account_email LIKE 'demo-mnbc-%@awentech.ca') AS demo_clients,
  (SELECT COUNT(*) FROM iset_case WHERE case_number LIKE 'MNBC-DEMO-%') AS demo_cases,
  (SELECT COUNT(*) FROM iset_application_submission WHERE reference_number LIKE 'MNBC-DEMO-20260529-%') AS demo_submissions,
  (SELECT COUNT(*) FROM iset_application a JOIN iset_case c ON c.id = a.case_id WHERE c.case_number LIKE 'MNBC-DEMO-%') AS demo_applications,
  (SELECT COUNT(*) FROM iset_case_action_plan ap JOIN iset_case c ON c.id = ap.case_id WHERE c.case_number LIKE 'MNBC-DEMO-%') AS demo_action_plans,
  (SELECT COUNT(*) FROM iset_case_intervention ci JOIN iset_case c ON c.id = ci.case_id WHERE c.case_number LIKE 'MNBC-DEMO-%') AS demo_interventions,
  (SELECT COUNT(*) FROM payment_packet pp JOIN iset_case c ON c.id = pp.case_id WHERE c.case_number LIKE 'MNBC-DEMO-%') AS demo_payment_packets,
  (SELECT COUNT(*) FROM finance_transaction ft JOIN iset_case c ON c.id = ft.case_id WHERE c.case_number LIKE 'MNBC-DEMO-%') AS demo_finance_transactions,
  (SELECT COUNT(*) FROM esdc_participant_submission eps JOIN iset_case c ON c.id = eps.case_id WHERE c.case_number LIKE 'MNBC-DEMO-%') AS demo_esdc_participant_submissions,
  (SELECT COUNT(*) FROM messages WHERE subject LIKE 'MNBC-DEMO-%') AS demo_messages,
  (SELECT COUNT(*) FROM iset_case_task t JOIN iset_case c ON c.id = t.case_id WHERE c.case_number LIKE 'MNBC-DEMO-%') AS demo_tasks;

SELECT
  c.case_number,
  CONCAT(cl.first_name, ' ', cl.last_name) AS applicant,
  cl.aboriginal_group,
  JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.province')) AS province,
  u.email,
  u.cognito_sub,
  c.assigned_staff_profile_id,
  a.status AS application_status,
  a.lifecycle_status AS application_lifecycle_status,
  a.decision_outcome,
  c.status AS case_status,
  c.lifecycle_status AS case_lifecycle_status,
  c.open_task_count,
  c.open_intervention_count
FROM iset_case c
JOIN client cl ON cl.id = c.client_id
JOIN iset_application a ON a.case_id = c.id
JOIN user u ON u.email = cl.applicant_account_email
WHERE c.case_number LIKE 'MNBC-DEMO-%'
ORDER BY c.case_number;
