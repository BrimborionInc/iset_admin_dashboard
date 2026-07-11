function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function approvalClientLinkError(code, message, details = null) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 409;
  if (details) error.details = details;
  return error;
}

function assertCanonicalApprovalClientLink({
  caseId,
  applicationId,
  applicationCaseId,
  applicationClientId,
  existingCaseClientId = null,
} = {}) {
  const normalizedCaseId = positiveInteger(caseId);
  const normalizedApplicationId = positiveInteger(applicationId);
  const normalizedApplicationCaseId = positiveInteger(applicationCaseId);
  const canonicalClientId = positiveInteger(applicationClientId);
  const currentClientId = positiveInteger(existingCaseClientId);

  if (!normalizedCaseId || !normalizedApplicationId || normalizedApplicationCaseId !== normalizedCaseId) {
    throw approvalClientLinkError(
      'approval_application_case_mismatch',
      'The application does not belong to the case being approved.'
    );
  }
  if (!canonicalClientId) {
    throw approvalClientLinkError(
      'approval_application_client_missing',
      'The application has no canonical client owner and requires identity review.'
    );
  }
  if (currentClientId && currentClientId !== canonicalClientId) {
    throw approvalClientLinkError(
      'approval_client_ownership_conflict',
      'The case and application resolve to different clients and require identity review.',
      {
        caseClientId: currentClientId,
        applicationClientId: canonicalClientId,
      }
    );
  }
  return canonicalClientId;
}

async function linkCanonicalApprovalClient(connection, {
  caseId,
  applicationId,
  existingCaseClientId = null,
} = {}) {
  const [[applicationRow]] = await connection.query(
    `SELECT id, case_id, client_id
       FROM iset_application
      WHERE id = ?
      LIMIT 1 FOR UPDATE`,
    [applicationId]
  );
  const targetClientId = assertCanonicalApprovalClientLink({
    caseId,
    applicationId,
    applicationCaseId: applicationRow?.case_id,
    applicationClientId: applicationRow?.client_id,
    existingCaseClientId,
  });

  const [[canonicalClient]] = await connection.query(
    'SELECT id FROM client WHERE id = ? LIMIT 1 FOR UPDATE',
    [targetClientId]
  );
  if (!canonicalClient) {
    throw approvalClientLinkError(
      'approval_application_client_not_found',
      'The application client owner no longer exists and requires identity review.'
    );
  }
  await connection.query(
    'UPDATE iset_case SET client_id = ?, updated_at = NOW() WHERE id = ?',
    [targetClientId, caseId]
  );
  return targetClientId;
}

module.exports = {
  assertCanonicalApprovalClientLink,
  linkCanonicalApprovalClient,
};
