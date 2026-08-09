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
    `SELECT 1
       FROM iset_document
      WHERE application_id = ?
        AND document_category = ?
        AND status = 'active'
      LIMIT 1`,
    [normalizedApplicationId, normalizedDocumentCategory]
  );

  return Boolean(row);
}

function financialOverviewIntegrityError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseDocumentMetadata(value) {
  if (value == null || value === '') return {};
  let parsed = value;
  if (Buffer.isBuffer(parsed)) parsed = parsed.toString('utf8');
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (_error) {
      throw financialOverviewIntegrityError('financial_overview_metadata_invalid');
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw financialOverviewIntegrityError('financial_overview_metadata_invalid');
  }
  return parsed;
}

function normalizeMetadataVersionId(value) {
  if (Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9][0-9]*$/u.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}

async function hasVersionManagedFinancialOverview(connection, { caseId, applicationId } = {}) {
  const normalizedCaseId = normalisePositiveInteger(caseId);
  const normalizedApplicationId = normalisePositiveInteger(applicationId);
  if (!connection || !normalizedCaseId || !normalizedApplicationId) return false;

  const [documentRows] = await connection.query(
    `SELECT \`d\`.\`id\`, \`d\`.\`metadata\`
       FROM \`iset_document\` AS \`d\`
      WHERE \`d\`.\`case_id\` = ?
        AND \`d\`.\`application_id\` = ?
        AND \`d\`.\`document_category\` = 'financial_overview'
        AND \`d\`.\`status\` = 'active'`,
    [normalizedCaseId, normalizedApplicationId]
  );
  if (!documentRows?.length) return false;

  const documentIds = documentRows.map(row => normalizeMetadataVersionId(row.id));
  if (documentIds.some(id => !id) || new Set(documentIds).size !== documentIds.length) {
    throw financialOverviewIntegrityError('financial_overview_document_scope_invalid');
  }
  const metadataVersionIds = new Map();
  for (const row of documentRows) {
    const metadata = parseDocumentMetadata(row.metadata);
    if (!Object.prototype.hasOwnProperty.call(metadata, 'funding_overview_version_id')) continue;
    const versionId = normalizeMetadataVersionId(metadata.funding_overview_version_id);
    if (!versionId) throw financialOverviewIntegrityError('financial_overview_metadata_version_invalid');
    metadataVersionIds.set(Number(row.id), versionId);
  }

  const [linkRows] = await connection.query(
    `SELECT \`vd\`.\`document_id\`, \`vd\`.\`funding_overview_version_id\`
       FROM \`funding_overview_version_documents\` AS \`vd\`
      WHERE \`vd\`.\`document_id\` IN (${documentIds.map(() => '?').join(', ')})`,
    documentIds
  );
  const linkedVersionIds = new Map();
  for (const row of linkRows || []) {
    const documentId = normalizeMetadataVersionId(row.document_id);
    const versionId = normalizeMetadataVersionId(row.funding_overview_version_id);
    if (!documentId || !versionId || !documentIds.includes(documentId)) {
      throw financialOverviewIntegrityError('financial_overview_version_link_invalid');
    }
    const existing = linkedVersionIds.get(documentId);
    if (existing && existing !== versionId) {
      throw financialOverviewIntegrityError('financial_overview_version_link_conflict');
    }
    linkedVersionIds.set(documentId, versionId);
  }

  const claimedVersionIds = new Set();
  for (const documentId of documentIds) {
    const metadataVersionId = metadataVersionIds.get(documentId) || null;
    const linkedVersionId = linkedVersionIds.get(documentId) || null;
    if (metadataVersionId && linkedVersionId && metadataVersionId !== linkedVersionId) {
      throw financialOverviewIntegrityError('financial_overview_version_claim_conflict');
    }
    if (metadataVersionId || linkedVersionId) claimedVersionIds.add(metadataVersionId || linkedVersionId);
  }
  if (!claimedVersionIds.size) return false;

  const versionIds = Array.from(claimedVersionIds);
  const [versionRows] = await connection.query(
    `SELECT \`v\`.\`id\`
       FROM \`funding_overview_version\` AS \`v\`
       JOIN \`funding_overview_series\` AS \`s\`
         ON \`s\`.\`id\` = \`v\`.\`series_id\`
      WHERE \`v\`.\`id\` IN (${versionIds.map(() => '?').join(', ')})
        AND \`s\`.\`case_id\` = ?`,
    [...versionIds, normalizedCaseId]
  );
  const validatedVersionIds = new Set(
    (versionRows || []).map(row => normalizeMetadataVersionId(row.id)).filter(Boolean)
  );
  if (validatedVersionIds.size !== claimedVersionIds.size || versionIds.some(id => !validatedVersionIds.has(id))) {
    throw financialOverviewIntegrityError('financial_overview_version_scope_invalid');
  }

  return true;
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
    `UPDATE \`iset_document\` AS \`d\`
        SET \`d\`.\`status\` = 'archived',
            \`d\`.\`updated_at\` = NOW()
      WHERE \`d\`.\`application_id\` = ?
        AND \`d\`.\`document_category\` = 'financial_overview'
        AND \`d\`.\`status\` = 'active'
        AND \`d\`.\`signing_request_id\` IS NULL
        AND JSON_EXTRACT(\`d\`.\`metadata\`, '$.funding_overview_version_id') IS NULL
        AND NOT EXISTS (
          SELECT 1
            FROM \`funding_overview_version_documents\` AS \`vd\`
           WHERE \`vd\`.\`document_id\` = \`d\`.\`id\`
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
