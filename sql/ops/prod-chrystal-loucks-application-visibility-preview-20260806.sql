-- PROD read-only visibility check for Chrystal Loucks' applications and
-- Danielle Burdett's live staff profile.
--
-- Live schema evidence captured 2026-08-06 from PROD iset_intake:
-- - client c: id, first_name, last_name
-- - iset_application a: id, client_id, case_id, status, lifecycle_status,
--   created_at
-- - iset_case k: id, client_id, assigned_staff_profile_id,
--   open_intervention_count, total_intervention_count, updated_at
-- - staff_profiles sp: id, email, name, display_name, primary_role, status,
--   region_id
--
-- Join proof:
-- - a.client_id -> c.id (fk_iset_application_client_id)
-- - a.case_id -> k.id (fk_iset_application_case_id)
-- - k.client_id -> c.id (fk_iset_case_client_id)
-- - k.assigned_staff_profile_id -> sp.id (fk_iset_case_assigned_staff_profile)

SELECT
  c.id AS client_id,
  c.first_name,
  c.last_name,
  k.id AS case_id,
  k.assigned_staff_profile_id,
  k.open_intervention_count,
  k.total_intervention_count,
  k.updated_at AS case_updated_at,
  sp.email AS assigned_staff_email,
  sp.display_name AS assigned_staff_display_name,
  sp.primary_role AS assigned_staff_role,
  sp.status AS assigned_staff_status,
  sp.region_id AS assigned_staff_region_id,
  a.id AS application_id,
  a.status AS application_status,
  a.lifecycle_status AS application_lifecycle_status,
  a.created_at AS application_created_at
FROM client AS c
JOIN iset_application AS a
  ON a.client_id = c.id
JOIN iset_case AS k
  ON k.id = a.case_id
 AND k.client_id = c.id
LEFT JOIN staff_profiles AS sp
  ON sp.id = k.assigned_staff_profile_id
WHERE c.first_name = 'Chrystal'
  AND c.last_name = 'Loucks'
ORDER BY a.created_at, a.id;

SELECT
  sp.id AS staff_profile_id,
  sp.email,
  sp.name,
  sp.display_name,
  sp.primary_role,
  sp.status,
  sp.region_id
FROM staff_profiles AS sp
WHERE sp.email = 'dburdett@iaaw.ca'
ORDER BY sp.id;
