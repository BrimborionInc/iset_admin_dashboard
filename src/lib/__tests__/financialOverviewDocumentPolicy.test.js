const {
  archiveReplaceableAssessmentFinancialOverviews,
  hasVersionManagedFinancialOverview,
  shouldPreserveAssessmentFinancialOverview,
} = require('../financialOverviewDocumentPolicy');
const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.join(process.cwd(), 'isetadminserver.js'),
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
  test('assessment submission automatically preserves a version-managed overview', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([[{ has_version: 1 }]]),
    };

    await expect(
      shouldPreserveAssessmentFinancialOverview(connection, {
        caseId: 172,
        explicitlyPreserve: false,
      })
    ).resolves.toBe(true);

    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM funding_overview_series s'),
      [172]
    );
  });

  test('explicit preservation does not depend on a database lookup', async () => {
    const connection = { query: jest.fn() };

    await expect(
      shouldPreserveAssessmentFinancialOverview(connection, {
        caseId: 172,
        explicitlyPreserve: true,
      })
    ).resolves.toBe(true);

    expect(connection.query).not.toHaveBeenCalled();
  });

  test('legacy assessment overview generation remains available when no version exists', async () => {
    const connection = {
      query: jest.fn().mockResolvedValue([[]]),
    };

    await expect(
      hasVersionManagedFinancialOverview(connection, { caseId: 172 })
    ).resolves.toBe(false);
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
    expect(sql).toContain("d.document_category = 'financial_overview'");
    expect(sql).toContain('d.signing_request_id IS NULL');
    expect(sql).toContain("JSON_EXTRACT(d.metadata, '$.funding_overview_version_id') IS NULL");
    expect(sql).toContain('FROM funding_overview_version_documents vd');
    expect(sql).toContain('vd.document_id = d.id');
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
  });
});
