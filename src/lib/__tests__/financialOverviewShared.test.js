const {
  buildFinancialOverviewEditableSchema,
  buildFinancialOverviewInitialValues,
  mergeFinancialOverviewCaseContext,
  sanitizeFinancialOverviewSubmissionPayload,
} = require('../../../../shared/financialOverview');

describe('shared Financial Overview helpers', () => {
  test('builds blank and prefilled initial values', () => {
    const sourceAnswers = {
      'income-employment': '1200.00',
      'expenses-rent': '850',
      'requested-supports': ['childcare'],
      'loan-grant-details': 'Provincial student loan',
    };

    expect(buildFinancialOverviewInitialValues(sourceAnswers, 'blank')).toEqual({});
    expect(buildFinancialOverviewInitialValues(sourceAnswers, 'prefill')).toEqual({
      'income-employment': '1200.00',
      'expenses-rent': '850',
    });

    const schema = buildFinancialOverviewEditableSchema({
      mode: 'prefill',
      initialValues: sourceAnswers,
    });
    expect(schema.steps.map(step => step.stepId)).toEqual([
      'financial-overview-income',
      'financial-overview-expenses',
      'financial-overview-signature',
    ]);
    expect(schema.initialValues['income-employment']).toBe('1200.00');
    expect(schema.initialValues['requested-supports']).toBeUndefined();
    expect(schema.initialValues['loan-grant-details']).toBeUndefined();
    const componentIds = schema.steps.flatMap(step =>
      (step.components || []).map(component => component.storageKey || component.id)
    );
    const incomeEmployment = schema.steps
      .flatMap(step => step.components || [])
      .find(component => component.storageKey === 'income-employment');
    const rent = schema.steps
      .flatMap(step => step.components || [])
      .find(component => component.storageKey === 'expenses-rent');
    expect(incomeEmployment.label.en).toBe('Employment income');
    expect(incomeEmployment.hint.en).toContain('regular wages');
    expect(incomeEmployment.prefix.text).toBe('$');
    expect(incomeEmployment.suffix.text.en).toBe('per month');
    expect(rent.label.en).toBe('Rent/Mortgage');
    expect(rent.hint.en).toContain('Do not include home repairs');
    expect(componentIds).not.toContain('requested-supports');
    expect(componentIds).not.toContain('top-up-amount');
    expect(componentIds).not.toContain('childcare-fuding-status');
    expect(schema.meta.financialOverviewEditable).toBe(true);
  });

  test('sanitizes submitted values and merges them into case context', () => {
    const submitted = sanitizeFinancialOverviewSubmissionPayload({
      'income-employment': '1,500.00',
      'requested-supports': ['childcare', 'transportation'],
      'expenses-transport': ['bus_pass'],
      'client-sig': { signed: true, name: 'Applicant One' },
      unrelated: 'ignore me',
    });

    expect(submitted).toEqual({
      'income-employment': '1,500.00',
    });

    const merged = mergeFinancialOverviewCaseContext(
      {
        applicationAnswers: {
          'income-employment': '900',
          'first-name': 'Applicant',
          'requested-supports': ['transportation'],
        },
        requestedSupports: ['transportation'],
      },
      submitted
    );

    expect(merged.incomeEmployment).toBe('1,500.00');
    expect(merged.socialAssistance).toBeUndefined();
    expect(merged.requestedSupports).toEqual(['transportation']);
    expect(merged.applicationAnswers['income-employment']).toBe('1,500.00');
    expect(merged.applicationAnswers['first-name']).toBe('Applicant');
    expect(merged.applicationAnswers['requested-supports']).toEqual(['transportation']);
    expect(merged.applicationAnswers.unrelated).toBeUndefined();
  });
});
