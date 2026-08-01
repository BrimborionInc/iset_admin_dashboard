function normalisePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const ASSESSMENT_PRESERVABLE_DOCUMENT_CATEGORIES = new Set([
  'application_form',
  'financial_overview',
]);

async function hasActiveApplicationDocument(connection, {
  applicationId,
  documentCategory,
} = {}) {
  const normalizedApplicationId = normalisePositiveInteger(applicationId);
  const normalizedDocumentCategory = typeof documentCategory === 'string'
    ? documentCategory.trim().toLowerCase()
    : '';
  if (
    !connection ||
    !normalizedApplicationId ||
    !ASSESSMENT_PRESERVABLE_DOCUMENT_CATEGORIES.has(normalizedDocumentCategory)
  ) {
    return false;
  }

  const [[row]] = await connection.query(
    `SELECT 1 AS has_document
       FROM iset_document
      WHERE application_id = ?
        AND document_category = ?
        AND status = 'active'
      LIMIT 1`,
    [normalizedApplicationId, normalizedDocumentCategory]
  );

  return Number(row?.has_document || 0) === 1;
}

async function hasVersionManagedFinancialOverview(connection, { caseId, applicationId } = {}) {
  const normalizedCaseId = normalisePositiveInteger(caseId);
  const normalizedApplicationId = normalisePositiveInteger(applicationId);
  if (!connection || !normalizedCaseId || !normalizedApplicationId) return false;

  const [[row]] = await connection.query(
    `SELECT 1 AS has_version
       FROM iset_document d
       LEFT JOIN funding_overview_version_documents vd
         ON vd.document_id = d.id
       JOIN funding_overview_version v
         ON v.id = COALESCE(
           vd.funding_overview_version_id,
           CAST(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.funding_overview_version_id')) AS UNSIGNED)
         )
       JOIN funding_overview_series s
         ON s.id = v.series_id
      WHERE s.case_id = ?
        AND d.application_id = ?
        AND d.document_category = 'financial_overview'
        AND d.status = 'active'
      LIMIT 1`,
    [normalizedCaseId, normalizedApplicationId]
  );

  return Number(row?.has_version || 0) === 1;
}

async function shouldPreserveAssessmentFinancialOverview(connection, {
  caseId,
  applicationId,
  explicitlyPreserve = false,
} = {}) {
  if (explicitlyPreserve) {
    return hasActiveApplicationDocument(connection, {
      applicationId,
      documentCategory: 'financial_overview',
    });
  }
  return hasVersionManagedFinancialOverview(connection, { caseId, applicationId });
}

async function shouldPreserveAssessmentApplicationForm(connection, {
  applicationId,
  explicitlyPreserve = false,
} = {}) {
  if (!explicitlyPreserve) return false;
  return hasActiveApplicationDocument(connection, {
    applicationId,
    documentCategory: 'application_form',
  });
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
  hasActiveApplicationDocument,
  hasVersionManagedFinancialOverview,
  shouldPreserveAssessmentApplicationForm,
  shouldPreserveAssessmentFinancialOverview,
};
