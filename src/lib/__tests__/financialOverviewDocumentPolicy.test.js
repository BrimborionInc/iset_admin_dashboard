const {
  archiveReplaceableAssessmentFinancialOverviews,
  hasActiveApplicationDocument,
  hasVersionManagedFinancialOverview,
  shouldPreserveAssessmentApplicationForm,
  shouldPreserveAssessmentFinancialOverview,
} = require('../financialOverviewDocumentPolicy');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.join(process.cwd(), 'isetadminserver.js'),
  'utf8'
);
const assessmentWidgetSource = fs.readFileSync(
  path.join(process.cwd(), 'src/widgets/CoordinatorAssessmentWidget.js'),
  'utf8'
);

function extractFunction(name, nextName) {
  const start = serverSource.indexOf(`async function ${name}(`);
  const end = serverSource.indexOf(`async function ${nextName}(`, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe('Financial Overview document policy', () => {
  test('assessment submission preserves a version-managed overview linked to the current application', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[{ id: 501, metadata: null }]])
        .mockResolvedValueOnce([[{ document_id: 501, funding_overview_version_id: 601 }]])
        .mockResolvedValueOnce([[{ id: 601 }]]),
    };

    await expect(
      shouldPreserveAssessmentFinancialOverview(connection, {
        caseId: 172,
        applicationId: 103,
        explicitlyPreserve: false,
      })
    ).resolves.toBe(true);

    expect(connection.query).toHaveBeenCalledTimes(3);
    const [documentSql, documentParams] = connection.query.mock.calls[0];
    const [linkSql, linkParams] = connection.query.mock.calls[1];
    const [versionSql, versionParams] = connection.query.mock.calls[2];
    expect(documentParams).toEqual([172, 103]);
    expect(documentSql).toContain('FROM `iset_document` AS `d`');
    expect(documentSql).toContain('`d`.`application_id` = ?');
    expect(documentSql).not.toContain('JOIN');
    expect(linkSql).toContain('FROM `funding_overview_version_documents` AS `vd`');
    expect(linkParams).toEqual([501]);
    expect(versionSql).toContain('JOIN `funding_overview_series` AS `s`');
    expect(versionSql).toContain('ON `s`.`id` = `v`.`series_id`');
    expect(versionParams).toEqual([601, 172]);
    expect(versionSql).not.toContain('JSON_EXTRACT');
  });

  test('metadata-only compatibility resolves a scoped positive version id before the FK-backed case check', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 502, metadata: JSON.stringify({ funding_overview_version_id: '602' }) },
        ]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ id: 602 }]]),
    };

    await expect(
      hasVersionManagedFinancialOverview(connection, { caseId: 172, applicationId: 103 })
    ).resolves.toBe(true);

    expect(connection.query.mock.calls[2][1]).toEqual([602, 172]);
  });

  test.each([
    ['malformed JSON', '{not-json', 'financial_overview_metadata_invalid'],
    ['non-positive metadata version', { funding_overview_version_id: 0 }, 'financial_overview_metadata_version_invalid'],
    ['partially numeric metadata version', { funding_overview_version_id: '602oops' }, 'financial_overview_metadata_version_invalid'],
  ])('%s fails closed before relationship queries', async (_label, metadata, code) => {
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[{ id: 502, metadata }]]),
    };

    await expect(
      hasVersionManagedFinancialOverview(connection, { caseId: 172, applicationId: 103 })
    ).rejects.toMatchObject({ code });
    expect(connection.query).toHaveBeenCalledTimes(1);
  });

  test('conflicting link and metadata version ids fail closed before the version lookup', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 502, metadata: { funding_overview_version_id: 602 } },
        ]])
        .mockResolvedValueOnce([[
          { document_id: 502, funding_overview_version_id: 603 },
        ]]),
    };

    await expect(
      hasVersionManagedFinancialOverview(connection, { caseId: 172, applicationId: 103 })
    ).rejects.toMatchObject({ code: 'financial_overview_version_claim_conflict' });
    expect(connection.query).toHaveBeenCalledTimes(2);
  });

  test('a version claim outside the exact case fails closed', async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce([[
          { id: 502, metadata: { funding_overview_version_id: 602 } },
        ]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]),
    };

    await expect(
      hasVersionManagedFinancialOverview(connection, { caseId: 172, applicationId: 103 })
    ).rejects.toMatchObject({ code: 'financial_overview_version_scope_invalid' });
  });

  test('explicit Financial Overview preservation requires an active current-application document', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([[{ has_document: 1 }]]),
    };

    await expect(
      shouldPreserveAssessmentFinancialOverview(connection, {
        caseId: 172,
        applicationId: 103,
        explicitlyPreserve: true,
      })
    ).resolves.toBe(true);

    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM iset_document'),
      [103, 'financial_overview']
    );
  });

  test('explicit Application Form preservation requires an active current-application document', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([[{ has_document: 1 }]]),
    };

    await expect(
      shouldPreserveAssessmentApplicationForm(connection, {
        applicationId: 103,
        explicitlyPreserve: true,
      })
    ).resolves.toBe(true);

    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining('application_id = ?'),
      [103, 'application_form']
    );
  });

  test('case-level documents cannot be preserved for an application submission', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([[]]),
    };

    await expect(
      hasActiveApplicationDocument(connection, {
        applicationId: 104,
        documentCategory: 'application_form',
      })
    ).resolves.toBe(false);

    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining('application_id = ?'),
      [104, 'application_form']
    );
  });

  test('an older application version does not suppress overview generation for the current application', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([[]]),
    };

    await expect(
      hasVersionManagedFinancialOverview(connection, { caseId: 172, applicationId: 104 })
    ).resolves.toBe(false);

    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining('`d`.`application_id` = ?'),
      [172, 104]
    );
  });

  test('automatic preservation fails closed when the current application is unknown', async () => {
    const connection = { query: jest.fn() };

    await expect(
      hasVersionManagedFinancialOverview(connection, { caseId: 172 })
    ).resolves.toBe(false);

    expect(connection.query).not.toHaveBeenCalled();
  });

  test('replacement archives only legacy assessment-generated overviews', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([{ affectedRows: 2 }]),
    };

    await expect(
      archiveReplaceableAssessmentFinancialOverviews(connection, {
        applicationId: 103,
      })
    ).resolves.toBe(2);

    const [sql, params] = connection.query.mock.calls[0];
    expect(params).toEqual([103]);
    expect(sql).toContain("`d`.`document_category` = 'financial_overview'");
    expect(sql).toContain('`d`.`signing_request_id` IS NULL');
    expect(sql).toContain("JSON_EXTRACT(`d`.`metadata`, '$.funding_overview_version_id') IS NULL");
    expect(sql).toContain('FROM `funding_overview_version_documents` AS `vd`');
    expect(sql).toContain('`vd`.`document_id` = `d`.`id`');
  });

  test('assessment generation is wired to the preservation policy without changing application-form replacement', () => {
    const applicationFormStore = extractFunction(
      'storeApplicationFormPdfDocument',
      'storeFinancialOverviewPdfDocument'
    );
    const financialOverviewStore = extractFunction(
      'storeFinancialOverviewPdfDocument',
      'storeFundingOverviewPdfDocument'
    );

    expect(applicationFormStore).toContain("documentType = 'application_form'");
    expect(applicationFormStore).toContain('UPDATE iset_document');
    expect(applicationFormStore).not.toContain('archiveReplaceableAssessmentFinancialOverviews');
    expect(financialOverviewStore).toContain('archiveReplaceableAssessmentFinancialOverviews');
    expect(serverSource.match(/shouldPreserveAssessmentFinancialOverview\(/g)).toHaveLength(2);
    expect(serverSource.match(/shouldPreserveAssessmentApplicationForm\(/g)).toHaveLength(2);
    expect(serverSource).toContain('applicationId: documentCaseRow.application_id');
    expect(serverSource).toContain('applicationId: caseRow?.application_id');
    expect(assessmentWidgetSource).toContain('return rowApplicationId === Number(applicationId);');
    expect(assessmentWidgetSource).not.toContain('if (rowApplicationId) return rowApplicationId === Number(applicationId);');
  });
});
