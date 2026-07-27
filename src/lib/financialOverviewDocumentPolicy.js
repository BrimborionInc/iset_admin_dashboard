function normalisePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function hasVersionManagedFinancialOverview(connection, { caseId } = {}) {
  const normalizedCaseId = normalisePositiveInteger(caseId);
  if (!connection || !normalizedCaseId) return false;

  const [[row]] = await connection.query(
    `SELECT 1 AS has_version
       FROM funding_overview_series s
       JOIN funding_overview_version v
         ON v.series_id = s.id
      WHERE s.case_id = ?
      LIMIT 1`,
    [normalizedCaseId]
  );

  return Number(row?.has_version || 0) === 1;
}

async function shouldPreserveAssessmentFinancialOverview(connection, {
  caseId,
  explicitlyPreserve = false,
} = {}) {
  if (explicitlyPreserve) return true;
  return hasVersionManagedFinancialOverview(connection, { caseId });
}

async function archiveReplaceableAssessmentFinancialOverviews(connection, {
  applicationId,
} = {}) {
  const normalizedApplicationId = normalisePositiveInteger(applicationId);
  if (!connection || !normalizedApplicationId) return 0;

  const [result] = await connection.query(
    `UPDATE iset_document d
        SET d.status = 'archived',
            d.updated_at = NOW()
      WHERE d.application_id = ?
        AND d.document_category = 'financial_overview'
        AND d.status = 'active'
        AND d.signing_request_id IS NULL
        AND JSON_EXTRACT(d.metadata, '$.funding_overview_version_id') IS NULL
        AND NOT EXISTS (
          SELECT 1
            FROM funding_overview_version_documents vd
           WHERE vd.document_id = d.id
        )`,
    [normalizedApplicationId]
  );

  return Number(result?.affectedRows || 0);
}

module.exports = {
  archiveReplaceableAssessmentFinancialOverviews,
  hasVersionManagedFinancialOverview,
  shouldPreserveAssessmentFinancialOverview,
};
