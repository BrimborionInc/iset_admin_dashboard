const {
  collectNocLookupPairs,
  mapIlmpBarrierCodes,
  normaliseIlmpBarrierCode,
} = require('../ilmpValidationMappings');

describe('ilmpValidationMappings', () => {
  test('maps current intake barrier keys and labels to ILMP codes', () => {
    expect(normaliseIlmpBarrierCode('funding')).toBe('8');
    expect(normaliseIlmpBarrierCode('Economic')).toBe('8');
    expect(normaliseIlmpBarrierCode('lack-of-job-opportunities')).toBe('10');
    expect(normaliseIlmpBarrierCode('lack_of_job-opportunities')).toBe('10');
    expect(normaliseIlmpBarrierCode('location')).toBe('5');
    expect(normaliseIlmpBarrierCode('Other barrier not listed above')).toBe('12');
    expect(normaliseIlmpBarrierCode('Other: no local program seat')).toBe('12');
    expect(normaliseIlmpBarrierCode('physical-or-mental-health')).toBe('11');
  });

  test('returns unique barrier codes in source order', () => {
    expect(mapIlmpBarrierCodes(['funding', 'Economic', 'other', 'Other: detail'])).toEqual(['8', '12']);
  });

  test('collects valid NOC lookup pairs across action plan and intervention field shapes', () => {
    const pairs = collectNocLookupPairs([
      {
        prev_employment_noc: '42-201',
        prev_employment_noc_version: '2021',
        resultNoc: '41300',
        resultNocVersion: '2021',
        interventions: [
          { related_noc: '33109', related_noc_version: '2021' },
          { noc: '42201', nocVersion: '2021' },
          { relatedNoc: '1234', relatedNocVersion: '2016' },
          { relatedNoc: '99999', relatedNocVersion: '2020' },
        ],
      },
    ]);

    expect(Array.from(pairs).sort()).toEqual([
      '2016:1234',
      '2021:33109',
      '2021:41300',
      '2021:42201',
    ]);
  });
});
