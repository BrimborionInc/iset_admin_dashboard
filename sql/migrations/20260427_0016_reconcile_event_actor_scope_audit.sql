UPDATE privacy_erm_event_actor_scope_hardening_audit a
JOIN iset_event_entry e ON e.id = a.event_id
   SET a.actor_staff_profile_id = e.actor_staff_profile_id,
       a.actor_applicant_user_id = e.actor_applicant_user_id,
       a.missing_required_typed_actor = CASE
         WHEN e.actor_type = 'staff' AND e.actor_staff_profile_id IS NULL THEN 1
         WHEN e.actor_type = 'applicant' AND e.actor_applicant_user_id IS NULL THEN 1
         ELSE 0
       END,
       a.dual_typed_actor = CASE
         WHEN e.actor_staff_profile_id IS NOT NULL AND e.actor_applicant_user_id IS NOT NULL THEN 1
         ELSE 0
       END
 WHERE a.missing_required_typed_actor = 1
    OR a.dual_typed_actor = 1
    OR NOT (a.actor_staff_profile_id <=> e.actor_staff_profile_id)
    OR NOT (a.actor_applicant_user_id <=> e.actor_applicant_user_id);

SET @remaining_event_actor_scope_audit_blockers = (
  SELECT COUNT(*)
    FROM privacy_erm_event_actor_scope_hardening_audit
   WHERE missing_required_typed_actor = 1
      OR dual_typed_actor = 1
);

SET @sql = IF(@remaining_event_actor_scope_audit_blockers > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''event actor scope audit blockers remain after reconciliation''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
