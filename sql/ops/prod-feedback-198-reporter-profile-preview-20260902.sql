-- Read-only PROD staff-profile lookup for feedback #198 submitter profile 60.

SELECT staff_profiles.id,
       staff_profiles.email,
       staff_profiles.name,
       staff_profiles.display_name,
       staff_profiles.primary_role,
       staff_profiles.status
  FROM staff_profiles
 WHERE staff_profiles.id = 60;
