import {
  buildConditionComponentLookup,
  componentConditionsSatisfied,
  componentSupportsConditionalVisibility,
  evaluateConditionalVisibilityRules,
  resolveConditionRefValue,
} from '../intakeConditionalVisibility';

describe('intakeConditionalVisibility', () => {
  test('matches portal checkbox-array operators', () => {
    const answers = { 'requested-supports': ['living', 'transportation'] };

    expect(evaluateConditionalVisibilityRules(
      { all: [{ ref: 'requested-supports', op: 'contains', value: 'living' }] },
      answers
    )).toBe(true);

    expect(evaluateConditionalVisibilityRules(
      { all: [{ ref: 'requested-supports', op: 'containsAny', value: 'books,transportation' }] },
      answers
    )).toBe(true);

    expect(evaluateConditionalVisibilityRules(
      { all: [{ ref: 'requested-supports', op: 'containsAll', value: 'living,transportation' }] },
      answers
    )).toBe(true);

    expect(evaluateConditionalVisibilityRules(
      { all: [{ ref: 'requested-supports', op: 'notContainsAny', value: 'books,childcare' }] },
      answers
    )).toBe(true);
  });

  test('resolves refs from workflow component aliases and answer paths', () => {
    const steps = [
      {
        stepId: 'step-1',
        components: [
          { id: 'dependent-children', storageKey: 'dependent-children', type: 'input' },
          { id: 'income-details', props: { name: 'income-details' }, type: 'textarea' },
        ],
      },
    ];
    const lookup = buildConditionComponentLookup(steps);
    const answers = {
      'dependent-children': '0',
      'income-details': 'details',
      applicant: { household: { size: 3 } },
    };

    expect(resolveConditionRefValue('dependent-children', answers, lookup)).toBe('0');
    expect(resolveConditionRefValue('income-details', answers, lookup)).toBe('details');
    expect(resolveConditionRefValue('applicant.household.size', answers, lookup)).toBe(3);
  });

  test('ignores condition checks for unsupported component targets', () => {
    expect(componentSupportsConditionalVisibility('paragraph')).toBe(true);
    expect(componentSupportsConditionalVisibility('select')).toBe(false);

    expect(componentConditionsSatisfied(
      {
        type: 'select',
        conditions: { all: [{ ref: 'requested-supports', op: 'contains', value: 'living' }] },
      },
      { 'requested-supports': [] },
      null
    )).toBe(true);
  });
});
