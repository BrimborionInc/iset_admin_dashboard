const {
  extractIntacctRestCollection,
  extractIntacctRestObjectId,
  extractIntacctRestResult,
} = require('../intacctRestEnvelope');

describe('Sage Intacct REST success envelopes', () => {
  test('reads documented collection and object results', () => {
    expect(extractIntacctRestCollection({
      'ia::result': [{ key: '145', id: 'A12' }],
      'ia::meta': { totalCount: 1, start: 1, pageSize: 100 },
    })).toEqual([{ key: '145', id: 'A12' }]);
    expect(extractIntacctRestObjectId({
      'ia::result': { key: '12090', id: 'VENDOR-12090' },
      'ia::meta': { totalCount: 1, totalSuccess: 1, totalError: 0 },
    })).toBe('VENDOR-12090');
  });

  test('uses a Sage key when the object has no separate id', () => {
    expect(extractIntacctRestObjectId({
      'ia::result': { key: '12958' },
      'ia::meta': { totalCount: 1, totalSuccess: 1, totalError: 0 },
    })).toBe('12958');
  });

  test('fails closed on result errors or a missing external id', () => {
    expect(() => extractIntacctRestResult({
      'ia::result': { key: '132' },
      'ia::meta': { totalCount: 1, totalSuccess: 0, totalError: 1 },
    })).toThrow(expect.objectContaining({ code: 'intacct_rest_result_contains_errors' }));
    expect(() => extractIntacctRestObjectId({
      'ia::result': { href: '/objects/accounts-payable/bill/unknown' },
      'ia::meta': { totalError: 0 },
    })).toThrow(expect.objectContaining({ code: 'intacct_rest_external_id_missing' }));
  });

  test('permits the old data envelope only behind an explicit local transition flag', () => {
    expect(() => extractIntacctRestCollection({ data: [] })).toThrow(
      expect.objectContaining({ code: 'intacct_rest_invalid_success_response' })
    );
    expect(extractIntacctRestCollection({ data: [] }, { allowLegacyData: true })).toEqual([]);
    expect(extractIntacctRestObjectId(
      { data: { id: 'LOCAL-1' } },
      { allowLegacyData: true }
    )).toBe('LOCAL-1');
  });
});
