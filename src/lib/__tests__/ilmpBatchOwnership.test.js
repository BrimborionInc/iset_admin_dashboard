const { classifyIlmpBatchOwnership } = require('../ilmpBatchOwnership');

const context = (caseId, applicationId) => ({
  caseRow: { id: caseId },
  applicationId,
});

describe('ILMP grouped-batch ownership', () => {
  test('allows several plans only when they share the exact case and application', () => {
    expect(
      classifyIlmpBatchOwnership([context(10, 21), context(10, 21)])
    ).toMatchObject({ compatible: true });
  });

  test.each([
    [[context(10, 21), context(10, 22)], 'different applications'],
    [[context(10, 21), context(11, 21)], 'different cases'],
    [[context(10, null), context(10, 21)], 'mixed legacy and exact application scope'],
    [[context(null, null)], 'missing case scope'],
    [[], 'empty client group'],
  ])('fails closed for %s (%s)', contexts => {
    expect(classifyIlmpBatchOwnership(contexts)).toMatchObject({ compatible: false });
  });
});
