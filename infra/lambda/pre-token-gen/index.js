// Pre Token Generation Lambda: inject stable role hints into tokens.
// Trigger: Cognito User Pool Pre Token Generation (Token Generation event)
exports.handler = async (event) => {
  const groups = event?.request?.groupConfiguration?.groupsToOverride || event?.request?.groupConfiguration?.groupsToAdd || [];
  const role = Array.isArray(groups) && groups.length ? String(groups[0]) : undefined;

  event.response = event.response || {};
  event.response.claimsOverrideDetails = Object.assign({}, event.response.claimsOverrideDetails, {
    claimsToAddOrOverride: Object.assign({}, (event.response.claimsOverrideDetails && event.response.claimsOverrideDetails.claimsToAddOrOverride) || {},
      Object.assign({},
        role ? { role } : {}
      )
    )
  });

  return event;
};
