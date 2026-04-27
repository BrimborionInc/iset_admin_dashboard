export function normalizePositiveId(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

export function resolveAssignedStaffProfileId(row) {
  if (!row || typeof row !== 'object') {
    return normalizePositiveId(row);
  }
  return (
    normalizePositiveId(row.assignedStaffProfileId) ||
    normalizePositiveId(row.assigned_staff_profile_id) ||
    normalizePositiveId(row.staffProfileId) ||
    normalizePositiveId(row.staff_profile_id) ||
    normalizePositiveId(row.assigned_to_staff_profile_id) ||
    normalizePositiveId(row.assignedToStaffProfileId) ||
    normalizePositiveId(row.assigned_user_id) ||
    normalizePositiveId(row.assignedUserId) ||
    normalizePositiveId(row.assigned_to_user_id) ||
    normalizePositiveId(row.assignedToUserId) ||
    null
  );
}

export function hasAssignedStaffProfile(row) {
  return resolveAssignedStaffProfileId(row) !== null;
}

export function buildAssignedStaffProfileAliases(row) {
  const assignedStaffProfileId = resolveAssignedStaffProfileId(row);
  return {
    assigned_staff_profile_id: assignedStaffProfileId,
    assignedStaffProfileId: assignedStaffProfileId,
    assigned_user_id: assignedStaffProfileId,
    assignedUserId: assignedStaffProfileId,
  };
}
