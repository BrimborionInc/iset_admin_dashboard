-- Guarded PROD one-off staff-profile label repair for MMVI ISET Coordinator.
-- Requested by Bill after NWAC email on 2026-06-12.
-- Cognito password reset is performed separately with AdminResetUserPassword.

START TRANSACTION;

SELECT id,
       cognito_sub,
       email,
       name,
       display_name,
       primary_role,
       status,
       region_id
  FROM staff_profiles
 WHERE id = 60
   AND email = 'iset@mmvi.ca'
   AND cognito_sub = 'dc0dd558-f0b1-7019-7a16-b3b1772c72dd'
 FOR UPDATE;

UPDATE staff_profiles
   SET name = 'Judy Cook',
       display_name = 'Judy Cook'
 WHERE id = 60
   AND email = 'iset@mmvi.ca'
   AND cognito_sub = 'dc0dd558-f0b1-7019-7a16-b3b1772c72dd'
   AND primary_role = 'ISET Coordinator'
   AND region_id = 3
   AND name = 'Deb Sinclair'
   AND display_name = 'Deb Sinclair';

SELECT ROW_COUNT() AS updated_rows;

SELECT id,
       cognito_sub,
       email,
       name,
       display_name,
       primary_role,
       status,
       region_id,
       updated_at
  FROM staff_profiles
 WHERE id = 60
   AND email = 'iset@mmvi.ca'
   AND cognito_sub = 'dc0dd558-f0b1-7019-7a16-b3b1772c72dd';

COMMIT;
