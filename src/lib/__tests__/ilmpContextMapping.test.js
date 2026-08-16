const {
  chooseIlmpApplicationId,
  mergeIlmpAnswers,
} = require('../ilmpContextMapping');

describe('ilmpContextMapping', () => {
  test('uses exact submission or Action Plan ownership and rejects conflicts', () => {
    expect(
      chooseIlmpApplicationId({
        submissionApplicationId: null,
        actionPlanApplicationId: 12,
        uniqueCaseApplicationId: 44,
      })
    ).toBe(12);

    expect(() =>
      chooseIlmpApplicationId({
        submissionApplicationId: 7,
        actionPlanApplicationId: 12,
        uniqueCaseApplicationId: 44,
      })
    ).toThrow(expect.objectContaining({ code: 'ilmp_application_scope_mismatch' }));

    expect(
      chooseIlmpApplicationId({
        submissionApplicationId: null,
        actionPlanApplicationId: null,
        uniqueCaseApplicationId: '44',
      })
    ).toBe(44);
  });

  test('uses seeded case-context application answers when application payload answers are missing', () => {
    const answers = mergeIlmpAnswers({
      caseContext: {
        applicationAnswers: {
          'has-disability': '0',
          'address-street-address': '16 Edward Street',
        },
      },
      applicationPayload: {
        source: 'ingested',
      },
    });

    expect(answers['has-disability']).toBe('0');
    expect(answers['address-street-address']).toBe('16 Edward Street');
  });

  test('lets application payload answers override seeded case-context answers', () => {
    const answers = mergeIlmpAnswers({
      caseContext: {
        applicationAnswers: {
          'has-disability': '0',
          'address-street-address': 'Old address',
        },
      },
      applicationPayload: {
        answers: {
          'has-disability': '1',
        },
      },
    });

    expect(answers['has-disability']).toBe('1');
    expect(answers['address-street-address']).toBe('Old address');
  });
});
