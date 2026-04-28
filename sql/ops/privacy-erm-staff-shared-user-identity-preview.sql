-- Read-only preflight for staff_profiles/shared user identity cleanup.
--
-- Purpose:
--   Find rows that would have depended on email fallback when code maps an
--   existing shared user row to a staff profile. Runtime code should resolve
--   that mapping by Cognito subject only.

SELECT 'staff_profiles_total' AS metric, COUNT(*) AS value
  FROM staff_profiles;

SELECT 'staff_profiles_missing_cognito_sub' AS metric, COUNT(*) AS value
  FROM staff_profiles
 WHERE NULLIF(TRIM(cognito_sub), '') IS NULL;

SELECT 'staff_profiles_missing_email' AS metric, COUNT(*) AS value
  FROM staff_profiles
 WHERE NULLIF(TRIM(email), '') IS NULL;

SELECT 'staff_profile_duplicate_cognito_sub_groups' AS metric, COUNT(*) AS value
  FROM (
        SELECT cognito_sub
          FROM staff_profiles
         WHERE NULLIF(TRIM(cognito_sub), '') IS NOT NULL
         GROUP BY cognito_sub
        HAVING COUNT(*) > 1
       ) duplicate_subs;

SELECT 'staff_profile_duplicate_email_groups' AS metric, COUNT(*) AS value
  FROM (
        SELECT LOWER(CONVERT(TRIM(email) USING utf8mb4) COLLATE utf8mb4_unicode_ci) AS normalized_email
          FROM staff_profiles
         WHERE NULLIF(TRIM(email), '') IS NOT NULL
         GROUP BY normalized_email
        HAVING COUNT(*) > 1
       ) duplicate_emails;

SELECT 'staff_profiles_matching_user_by_cognito_sub' AS metric, COUNT(*) AS value
  FROM staff_profiles sp
  JOIN user u
    ON NULLIF(TRIM(sp.cognito_sub), '') IS NOT NULL
   AND CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci =
       CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci;

SELECT 'staff_profiles_matching_user_by_email' AS metric, COUNT(*) AS value
  FROM staff_profiles sp
  JOIN user u
    ON NULLIF(TRIM(sp.email), '') IS NOT NULL
   AND LOWER(CONVERT(TRIM(u.email) USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
       LOWER(CONVERT(TRIM(sp.email) USING utf8mb4) COLLATE utf8mb4_unicode_ci);

SELECT 'staff_email_overlap_missing_or_mismatched_user_sub' AS metric, COUNT(*) AS value
  FROM staff_profiles sp
  JOIN user u
    ON NULLIF(TRIM(sp.email), '') IS NOT NULL
   AND LOWER(CONVERT(TRIM(u.email) USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
       LOWER(CONVERT(TRIM(sp.email) USING utf8mb4) COLLATE utf8mb4_unicode_ci)
 WHERE NULLIF(TRIM(sp.cognito_sub), '') IS NULL
    OR NULLIF(TRIM(u.cognito_sub), '') IS NULL
    OR CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci <>
       CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci;

SELECT sp.id AS staff_profile_id,
       sp.email AS staff_email,
       sp.cognito_sub AS staff_cognito_sub,
       u.id AS user_id,
       u.email AS user_email,
       u.cognito_sub AS user_cognito_sub
  FROM staff_profiles sp
  JOIN user u
    ON NULLIF(TRIM(sp.email), '') IS NOT NULL
   AND LOWER(CONVERT(TRIM(u.email) USING utf8mb4) COLLATE utf8mb4_unicode_ci) =
       LOWER(CONVERT(TRIM(sp.email) USING utf8mb4) COLLATE utf8mb4_unicode_ci)
 WHERE NULLIF(TRIM(sp.cognito_sub), '') IS NULL
    OR NULLIF(TRIM(u.cognito_sub), '') IS NULL
    OR CONVERT(u.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci <>
       CONVERT(sp.cognito_sub USING utf8mb4) COLLATE utf8mb4_unicode_ci
 ORDER BY sp.id, u.id
 LIMIT 100;
