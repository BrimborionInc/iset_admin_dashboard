import { buildConditionComponentLookup } from '../intakeConditionalVisibility';
import {
  buildManualValidationData,
  collectHiddenConditionalManualKeys,
  findFirstRenderableManualStepIndex,
  findNextRenderableManualStepIndex,
  findStepIndexByField,
  stepHasRenderableManualContent,
} from '../manualIntakeRuntime';

describe('manualIntakeRuntime', () => {
  test('uses runtime checkbox-array operators for manual step visibility', () => {
    const steps = [
      {
        stepId: 'step-1',
        components: [
          {
            id: 'requested-supports',
            storageKey: 'requested-supports',
            type: 'checkboxes',
            options: [
              { value: 'living', text: { en: 'Living' } },
              { value: 'transportation', text: { en: 'Transportation' } },
            ],
          },
        ],
      },
      {
        stepId: 'step-2',
        components: [
          {
            id: 'living-follow-up',
            storageKey: 'living-follow-up',
            type: 'input',
            conditions: {
              all: [{ ref: 'requested-supports', op: 'containsAny', value: 'living,transportation' }],
            },
          },
        ],
      },
    ];

    const componentLookup = buildConditionComponentLookup(steps);
    expect(stepHasRenderableManualContent(steps[1], { 'requested-supports': ['living'] }, componentLookup)).toBe(true);
    expect(stepHasRenderableManualContent(steps[1], { 'requested-supports': ['childcare'] }, componentLookup)).toBe(false);

    const hidden = collectHiddenConditionalManualKeys(
      steps,
      { 'requested-supports': ['childcare'], 'living-follow-up': 'stale' },
      componentLookup
    );
    expect(hidden.has('living-follow-up')).toBe(true);
  });

  test('skips non-renderable manual steps when finding the next step', () => {
    const steps = [
      {
        stepId: 'step-1',
        nextStepId: 'step-2',
        components: [{ id: 'first-name', storageKey: 'first-name', type: 'input' }],
      },
      {
        stepId: 'step-2',
        nextStepId: 'step-3',
        components: [{ id: 'support-proof', storageKey: 'support-proof', type: 'file-upload' }],
      },
      {
        stepId: 'step-3',
        nextStepId: 'step-4',
        components: [
          {
            id: 'living-follow-up',
            storageKey: 'living-follow-up',
            type: 'input',
            conditions: { all: [{ ref: 'requested-supports', op: 'contains', value: 'living' }] },
          },
        ],
      },
      {
        stepId: 'step-4',
        components: [{ id: 'final-copy', storageKey: 'final-copy', type: 'paragraph', text: { en: 'Done' } }],
      },
    ];

    const componentLookup = buildConditionComponentLookup(steps);
    const answers = { 'requested-supports': ['books'] };

    expect(findNextRenderableManualStepIndex(0, answers, steps, componentLookup)).toBe(3);
    expect(findFirstRenderableManualStepIndex(steps, answers, componentLookup)).toBe(0);
  });

  test('builds validation aliases and finds nested field ownership', () => {
    const steps = [
      {
        stepId: 'step-1',
        components: [
          {
            id: 'applicant-first-name',
            storageKey: 'applicant.first_name',
            type: 'input',
            props: { name: 'first-name' },
          },
        ],
      },
      {
        stepId: 'step-2',
        components: [
          {
            id: 'supports-other',
            storageKey: 'supports-other',
            type: 'checkboxes',
            options: [
              {
                value: 'other',
                text: { en: 'Other' },
                children: [
                  {
                    id: 'other-support-details',
                    storageKey: 'other-support-details',
                    type: 'input',
                    props: { name: 'other-support-details' },
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const validationData = buildManualValidationData(steps[0], { 'applicant.first_name': 'Ada' });
    expect(validationData['applicant.first_name']).toBe('Ada');
    expect(validationData['applicant-first-name']).toBe('Ada');
    expect(validationData['first-name']).toBe('Ada');
    expect(findStepIndexByField('other-support-details', steps)).toBe(1);
  });
});
