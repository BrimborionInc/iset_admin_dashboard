const {
  chooseIlmpApplicationId,
  mergeIlmpAnswers,
} = require('../ilmpContextMapping');

describe('ilmpContextMapping', () => {
  test('chooses the most specific application id available for ILMP context', () => {
    expect(
      chooseIlmpApplicationId({
        submissionApplicationId: null,
        actionPlanApplicationId: 12,
        legacyCaseApplicationId: 99,
        primaryApplicationId: 44,
      })
    ).toBe(12);

    expect(
      chooseIlmpApplicationId({
        submissionApplicationId: 7,
        actionPlanApplicationId: 12,
        legacyCaseApplicationId: 99,
        primaryApplicationId: 44,
      })
    ).toBe(7);

    expect(
      chooseIlmpApplicationId({
        submissionApplicationId: null,
        actionPlanApplicationId: null,
        legacyCaseApplicationId: null,
        primaryApplicationId: '44',
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
