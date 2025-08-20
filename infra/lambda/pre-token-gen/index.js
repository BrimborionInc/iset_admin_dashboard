// Pre Token Generation Lambda: inject role and region_id into tokens
// Trigger: Cognito User Pool Pre Token Generation (Token Generation event)
exports.handler = async (event) => {
  const groups = event?.request?.groupConfiguration?.groupsToOverride || event?.request?.groupConfiguration?.groupsToAdd || [];
  const role = Array.isArray(groups) && groups.length ? String(groups[0]) : undefined;

  const attrs = event?.request?.userAttributes || {};
  const regionId = attrs['custom:region_id'] != null ? String(attrs['custom:region_id']) : undefined;
  const userId = attrs['custom:user_id'] != null ? String(attrs['custom:user_id']) : undefined;

  event.response = event.response || {};
  event.response.claimsOverrideDetails = Object.assign({}, event.response.claimsOverrideDetails, {
    claimsToAddOrOverride: Object.assign({}, (event.response.claimsOverrideDetails && event.response.claimsOverrideDetails.claimsToAddOrOverride) || {},
      Object.assign({},
        role ? { role } : {},
        regionId ? { region_id: regionId } : {},
        userId ? { user_id: userId } : {}
      )
    )
  });

  return event;
};
