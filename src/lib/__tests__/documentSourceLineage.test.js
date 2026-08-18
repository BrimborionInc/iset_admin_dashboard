const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.resolve(__dirname, '../../../isetadminserver.js'),
  'utf8'
);

function loadSourceLineageGuard({ applicationCaseId = null } = {}) {
  const start = serverSource.indexOf('const STAFF_REASSIGNABLE_DOCUMENT_SOURCES');
  const end = serverSource.indexOf('\nasync function resolveActionPlanIdForInterventions', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const implementation = serverSource.slice(start, end);
  const resolveCaseIdFromApplicationId = jest.fn().mockResolvedValue(applicationCaseId);
  const factory = new Function(
    'normalisePositiveInteger',
    'normaliseString',
    'resolveCaseIdFromApplicationId',
    'pool',
    `${implementation}\nreturn preserveDocumentSourceLineage;`
  );
  return {
    preserve: factory(
      value => {
        const numeric = Number(value);
        return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
      },
      value => {
        if (value === null || typeof value === 'undefined') return null;
        return typeof value === 'string' && value.trim() ? value.trim() : null;
      },
      resolveCaseIdFromApplicationId,
      {}
    ),
    resolveCaseIdFromApplicationId,
  };
}

describe('supporting-document source lineage', () => {
  test.each([
    ['application_submission', null],
    ['secure_message_attachment', 81],
    ['system_generated', null],
    ['unrecognised_source', null],
    [null, null],
  ])('%s details preserve existing case and application ownership', async (source, originMessageId) => {
    const { preserve } = loadSourceLineageGuard({ applicationCaseId: 44 });

    await expect(preserve({
      documentRow: {
        source,
        origin_message_id: originMessageId,
        case_id: 44,
        application_id: 55,
      },
      caseId: null,
      applicationId: null,
    })).resolves.toEqual({ caseId: 44, applicationId: 55 });
  });

  test.each([
    ['application_submission', null],
    ['secure_message_attachment', 81],
    ['system_generated', null],
    ['unrecognised_source', null],
    [null, null],
  ])('%s cannot be moved to a sibling application', async (source, originMessageId) => {
    const { preserve } = loadSourceLineageGuard();

    await expect(preserve({
      documentRow: {
        source,
        origin_message_id: originMessageId,
        case_id: 44,
        application_id: 55,
      },
      caseId: 44,
      applicationId: 56,
    })).rejects.toMatchObject({
      code: 'document_application_lineage_immutable',
      status: 409,
    });
  });

  test.each(['manual_upload', 'legacy_intake_upload'])(
    '%s can be reorganized after the destination ownership checks pass',
    async source => {
      const { preserve } = loadSourceLineageGuard();

      await expect(preserve({
        documentRow: { source, case_id: 44, application_id: 55 },
        caseId: 45,
        applicationId: 56,
      })).resolves.toEqual({ caseId: 45, applicationId: 56 });
    }
  );
});
