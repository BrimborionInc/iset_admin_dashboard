-- TEST identity neutralisation and overlay for a production-like restore.
--
-- Run only after canonical cleanup migrations have completed on the restored
-- PROD-like TEST database, and before TEST admin/portal PM2 processes are
-- restarted.
--
-- Why this is separate from test-prod-like-restore-postload.sql:
-- the cleanup migrations use restored PROD Cognito subjects to backfill typed
-- staff/applicant actor references. Clearing subjects too early would destroy
-- that evidence.

SET @bill_email := 'bill@sillery.co.uk';
SET @bill_sub := '9c7d9588-b0f1-7068-5a02-1af164ff57d0';
SET @program_admin_email := 'program.admin@awentech.ca';
SET @program_admin_sub := '2ccdb5f8-b001-707f-1bc1-8afe452e63b5';

-- Imported applicant/public identities are not valid in the TEST applicant
-- Cognito pool. Keep row IDs and historical FKs, but remove environment-bound
-- login bindings.
UPDATE `user`
   SET cognito_sub = NULL,
       email_verified = 0,
       last_login_at = NULL
 WHERE cognito_sub IS NOT NULL
    OR email_verified <> 0
    OR last_login_at IS NOT NULL;

UPDATE client
   SET applicant_cognito_sub = NULL,
       applicant_cognito_username = NULL,
       applicant_account_status = NULL,
       applicant_invited_at = NULL,
       applicant_invited_by_staff_profile_id = NULL,
       applicant_activated_at = NULL
 WHERE applicant_cognito_sub IS NOT NULL
    OR applicant_cognito_username IS NOT NULL
    OR applicant_account_status IS NOT NULL
    OR applicant_invited_at IS NOT NULL
    OR applicant_invited_by_staff_profile_id IS NOT NULL
    OR applicant_activated_at IS NOT NULL;

-- staff_profiles.cognito_sub is NOT NULL and unique, so disable imported PROD
-- staff pool bindings with deterministic TEST-local placeholders instead of
-- NULL.
UPDATE staff_profiles
   SET cognito_sub = CONCAT('test-disabled-staff-', id),
       last_login_at = NULL
 WHERE cognito_sub NOT LIKE 'test-disabled-staff-%'
    OR last_login_at IS NOT NULL;

-- Rebind Bill's TEST System Administrator profile.
SET @bill_staff_id := (
  SELECT MIN(id)
    FROM staff_profiles
   WHERE LOWER(email) = @bill_email
);

INSERT INTO staff_profiles
  (cognito_sub, email, name, display_name, primary_role, status, region_id)
SELECT @bill_sub, @bill_email, 'Bill Sillery', 'Bill Sillery', 'System Administrator', 'active', NULL
 WHERE @bill_staff_id IS NULL;

SET @bill_staff_id := (
  SELECT MIN(id)
    FROM staff_profiles
   WHERE LOWER(email) = @bill_email
);

UPDATE staff_profiles
   SET cognito_sub = @bill_sub,
       name = 'Bill Sillery',
       display_name = 'Bill Sillery',
       primary_role = 'System Administrator',
       status = 'active',
       region_id = NULL,
       last_login_at = NULL
 WHERE id = @bill_staff_id;

UPDATE staff_profiles
   SET cognito_sub = CONCAT('test-disabled-staff-duplicate-', id),
       status = 'inactive'
 WHERE LOWER(email) = @bill_email
   AND id <> @bill_staff_id;

-- Rebind the TEST NWAC Administrator overlay requested for UAT.
SET @program_admin_staff_id := (
  SELECT MIN(id)
    FROM staff_profiles
   WHERE LOWER(email) = @program_admin_email
);

INSERT INTO staff_profiles
  (cognito_sub, email, name, display_name, primary_role, status, region_id)
SELECT @program_admin_sub, @program_admin_email, 'Program Admin', 'Program Admin', 'NWAC Administrator', 'active', NULL
 WHERE @program_admin_staff_id IS NULL;

SET @program_admin_staff_id := (
  SELECT MIN(id)
    FROM staff_profiles
   WHERE LOWER(email) = @program_admin_email
);

UPDATE staff_profiles
   SET cognito_sub = @program_admin_sub,
       name = 'Program Admin',
       display_name = 'Program Admin',
       primary_role = 'NWAC Administrator',
       status = 'active',
       region_id = NULL,
       last_login_at = NULL
 WHERE id = @program_admin_staff_id;

UPDATE staff_profiles
   SET cognito_sub = CONCAT('test-disabled-staff-duplicate-', id),
       status = 'inactive'
 WHERE LOWER(email) = @program_admin_email
   AND id <> @program_admin_staff_id;

DELETE FROM staff_region
 WHERE staff_profile_id IN (@bill_staff_id, @program_admin_staff_id);

-- Ensure staff-local user rows exist for paths that still need a shared
-- user-table actor row, without making every imported PROD user login-capable.
SET @bill_user_id := (
  SELECT id
    FROM `user`
   WHERE LOWER(email) = @bill_email
   ORDER BY id
   LIMIT 1
);

INSERT INTO `user`
  (name, email, cognito_sub, email_verified, suspended, preferred_language)
SELECT 'Bill Sillery', @bill_email, @bill_sub, 1, 0, 'en'
 WHERE @bill_user_id IS NULL;

UPDATE `user`
   SET name = 'Bill Sillery',
       cognito_sub = @bill_sub,
       email_verified = 1,
       suspended = 0,
       deleted_at = NULL,
       last_login_at = NULL,
       preferred_language = COALESCE(NULLIF(preferred_language, ''), 'en')
 WHERE LOWER(email) = @bill_email;

SET @program_admin_user_id := (
  SELECT id
    FROM `user`
   WHERE LOWER(email) = @program_admin_email
   ORDER BY id
   LIMIT 1
);

INSERT INTO `user`
  (name, email, cognito_sub, email_verified, suspended, preferred_language)
SELECT 'Program Admin', @program_admin_email, @program_admin_sub, 1, 0, 'en'
 WHERE @program_admin_user_id IS NULL;

UPDATE `user`
   SET name = 'Program Admin',
       cognito_sub = @program_admin_sub,
       email_verified = 1,
       suspended = 0,
       deleted_at = NULL,
       last_login_at = NULL,
       preferred_language = COALESCE(NULLIF(preferred_language, ''), 'en')
 WHERE LOWER(email) = @program_admin_email;

-- Verification output for the operator log.
SELECT
  'test_identity_overlay_staff' AS check_name,
  id,
  email,
  cognito_sub,
  primary_role,
  status,
  region_id
FROM staff_profiles
WHERE LOWER(email) IN (@bill_email, @program_admin_email)
ORDER BY email, id;

SELECT
  'test_identity_overlay_user' AS check_name,
  id,
  email,
  cognito_sub,
  email_verified,
  suspended
FROM `user`
WHERE LOWER(email) IN (@bill_email, @program_admin_email)
ORDER BY email, id;

SELECT
  'remaining_imported_identity_bindings' AS check_name,
  (SELECT COUNT(*) FROM `user` WHERE cognito_sub IS NOT NULL AND cognito_sub NOT IN (@bill_sub, @program_admin_sub)) AS non_overlay_user_subs,
  (SELECT COUNT(*) FROM client WHERE applicant_cognito_sub IS NOT NULL OR applicant_cognito_username IS NOT NULL) AS client_applicant_bindings,
  (SELECT COUNT(*) FROM staff_profiles WHERE cognito_sub NOT LIKE 'test-disabled-staff-%' AND cognito_sub NOT IN (@bill_sub, @program_admin_sub)) AS non_overlay_staff_subs;
