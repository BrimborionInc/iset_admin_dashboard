const { buildWorkflowSchema } = require('./normalizeWorkflow');

function makePool() {
  const workflowRows = [[{ id: 21, name: 'ISET Intake', status: 'active', workflow_type: 'main-intake' }]];
  const stepRows = [[
    { step_id: 90, step_name: 'Demographics', is_start: 1 },
    { step_id: 93, step_name: 'Employment Goals and Barriers', is_start: 0 },
    { step_id: 145, step_name: 'Financial Supports Requested (No Childcare)', is_start: 0 },
    { step_id: 94, step_name: 'Financial Supports Requested', is_start: 0 },
  ]];
  const routeRows = [[
    { workflow_id: 21, source_step_id: 90, mode: 'linear', field_key: null, default_next_step_id: 93 },
    { workflow_id: 21, source_step_id: 93, mode: 'by_option', field_key: 'dependent-children', default_next_step_id: 94 },
  ]];
  const routeOptionRows = [[
    { workflow_id: 21, source_step_id: 93, option_value: '0', next_step_id: 145 },
  ]];
  const componentRowsByStep = new Map([
    [90, [[
      {
        position: 1,
        template_id: 1001,
        template_version: 1,
        tpl_type: 'radio',
        template_key: 'radio',
        default_props: JSON.stringify({
          id: 'example-radio',
          name: 'dependent-children',
          items: [
            { text: { en: 'Yes', fr: 'Oui' }, value: 'yes' },
            { text: { en: 'No', fr: 'Non' }, value: 'no' },
          ],
          label: { text: { en: 'Do you currently have dependent children?', fr: 'Avez-vous des enfants à charge?' } },
          validation: { required: true },
        }),
        props_overrides: JSON.stringify({ normalize: 'yn-01' }),
      },
    ]]],
    [93, [[
      {
        position: 1,
        template_id: 2001,
        template_version: 1,
        tpl_type: 'character-count',
        template_key: 'character-count',
        default_props: JSON.stringify({
          id: 'example-character-count',
          name: 'long-term-goal',
          label: { text: { en: 'What training or employment goal would you like the NWAC ISET Program to support?', fr: 'Quel objectif souhaitez-vous?' } },
          rows: 5,
          maxlength: 500,
          repeatable: {
            group: 'example-goals',
            index: 1,
            minItems: 1,
            maxItems: 3,
            addLabel: { en: 'Add another goal', fr: 'Ajouter un autre objectif' },
            removeLabel: { en: 'Remove this goal', fr: 'Supprimer cet objectif' },
          },
        }),
        props_overrides: JSON.stringify({}),
      },
      {
        position: 2,
        template_id: 2002,
        template_version: 1,
        tpl_type: 'checkbox',
        template_key: 'checkbox',
        default_props: JSON.stringify({
          id: 'example-checkboxes',
          name: 'barriers',
          items: [
            { text: { en: 'Funding', fr: 'Financement' }, value: 'funding' },
            { text: { en: 'Other', fr: 'Autre' }, value: 'other', conditionalChildId: 'other-barrier' },
          ],
          label: { text: { en: 'What challenges or circumstances are currently affecting your training or employment goals?', fr: 'Quels défis?' } },
        }),
        props_overrides: JSON.stringify({}),
      },
      {
        position: 3,
        template_id: 2003,
        template_version: 1,
        tpl_type: 'input',
        template_key: 'input',
        default_props: JSON.stringify({
          id: 'example-input',
          name: 'other-barrier',
          type: 'text',
          label: { text: { en: 'Other challenge (please specify)', fr: 'Autre défi' } },
          dateBounds: { monthField: 'reporting-month' },
        }),
        props_overrides: JSON.stringify({}),
      },
      {
        position: 4,
        template_id: 2004,
        template_version: 1,
        tpl_type: 'radio',
        template_key: 'radio',
        default_props: JSON.stringify({
          id: 'example-radio',
          name: 'target-program',
          items: [
            { text: { en: 'Skills Development', fr: 'Développement des compétences' }, value: 'skills_development' },
            { text: { en: 'Targeted Wage Subsidy', fr: 'Subvention salariale' }, value: 'tws' },
          ],
          label: { text: { en: 'What program or support are you considering?', fr: 'Quel programme vous intéresse?' } },
        }),
        props_overrides: JSON.stringify({}),
      },
    ]]],
    [145, [[
      {
        position: 1,
        template_id: 3001,
        template_version: 1,
        tpl_type: 'checkbox',
        template_key: 'checkbox',
        default_props: JSON.stringify({
          id: 'example-checkboxes',
          name: 'requested-supports',
          items: [
            { text: { en: 'Tuition', fr: 'Frais de scolarité' }, value: 'tuition' },
            { text: { en: 'Living allowance', fr: 'Allocation de subsistance' }, value: 'living' },
          ],
          label: { text: { en: 'Which NWAC ISET Program supports are you requesting at this time?', fr: 'Quels soutiens demandez-vous ?' } },
        }),
        props_overrides: JSON.stringify({}),
      },
    ]]],
    [94, [[
      {
        position: 1,
        template_id: 4001,
        template_version: 1,
        tpl_type: 'checkbox',
        template_key: 'checkbox',
        default_props: JSON.stringify({
          id: 'example-checkboxes',
          name: 'requested-supports',
          items: [
            { text: { en: 'Tuition', fr: 'Frais de scolarité' }, value: 'tuition' },
            { text: { en: 'Childcare', fr: 'Garde d’enfants' }, value: 'childcare' },
          ],
          label: { text: { en: 'Which NWAC ISET Program supports are you requesting at this time?', fr: 'Quels soutiens demandez-vous ?' } },
        }),
        props_overrides: JSON.stringify({}),
      },
    ]]],
  ]);

  return {
    query: jest.fn(async (sql, params = []) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.includes('FROM iset_intake.workflow WHERE id = ?')) return workflowRows;
      if (normalized.includes('FROM iset_intake.workflow_step ws')) return stepRows;
      if (normalized.includes('FROM iset_intake.workflow_route WHERE workflow_id = ?')) return routeRows;
      if (normalized.includes('FROM iset_intake.workflow_route_option WHERE workflow_id = ?')) return routeOptionRows;
      if (normalized.includes('FROM iset_intake.step_component sc')) return componentRowsByStep.get(params[0]) || [[]];
      throw new Error(`Unexpected SQL in test: ${normalized}`);
    }),
  };
}

function makeContentOnlyPool() {
  const workflowRows = [[{ id: 22, name: 'Content Workflow', status: 'active', workflow_type: 'main-intake' }]];
  const stepRows = [[
    { step_id: 501, step_name: 'Instructions', is_start: 1 },
  ]];
  const routeRows = [[]];
  const routeOptionRows = [[]];
  const componentRowsByStep = new Map([
    [501, [[
      {
        position: 1,
        template_id: 5001,
        template_version: 1,
        tpl_type: 'paragraph',
        template_key: 'text-block',
        default_props: JSON.stringify({
          text: { en: 'Read this before you continue.', fr: 'Lisez ceci avant de continuer.' },
        }),
        props_overrides: JSON.stringify({}),
      },
      {
        position: 2,
        template_id: 5002,
        template_version: 1,
        tpl_type: 'inset-text',
        template_key: 'inset-text',
        default_props: JSON.stringify({
          hint: { text: { en: 'Inset text from hint fallback.', fr: 'Texte encadre depuis le conseil.' } },
        }),
        props_overrides: JSON.stringify({}),
      },
      {
        position: 3,
        template_id: 5003,
        template_version: 1,
        tpl_type: 'warning-text',
        template_key: 'warning-text',
        default_props: JSON.stringify({
          label: { text: { en: 'Warning text from label fallback.', fr: 'Avertissement depuis le libelle.' } },
        }),
        props_overrides: JSON.stringify({}),
      },
    ]]],
  ]);

  return {
    query: jest.fn(async (sql, params = []) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.includes('FROM iset_intake.workflow WHERE id = ?')) return workflowRows;
      if (normalized.includes('FROM iset_intake.workflow_step ws')) return stepRows;
      if (normalized.includes('FROM iset_intake.workflow_route WHERE workflow_id = ?')) return routeRows;
      if (normalized.includes('FROM iset_intake.workflow_route_option WHERE workflow_id = ?')) return routeOptionRows;
      if (normalized.includes('FROM iset_intake.step_component sc')) return componentRowsByStep.get(params[0]) || [[]];
      throw new Error(`Unexpected SQL in test: ${normalized}`);
    }),
  };
}

describe('buildWorkflowSchema branching source keys', () => {
  test('does not reuse the route field key as storageKey for every component on a branched step', async () => {
    const pool = makePool();
    const result = await buildWorkflowSchema({ pool, workflowId: 21 });
    const employmentStep = result.steps.find((step) => step.title?.en === 'Employment Goals and Barriers');

    expect(employmentStep).toBeTruthy();
    expect(employmentStep.defaultNextStepId).toBe('financial-supports-requested');
    expect(employmentStep.branching).toEqual([
      {
        condition: { '==': [{ var: 'dependent-children' }, '0'] },
        nextStepId: 'financial-supports-requested-no-childcare',
      },
    ]);

    const storageKeys = employmentStep.components.map((component) => component.storageKey).filter(Boolean);
    expect(storageKeys).toEqual(expect.arrayContaining(['long-term-goal', 'barriers', 'target-program']));
    expect(storageKeys).not.toContain('dependent-children');

    const longTermGoal = employmentStep.components.find((component) => component.storageKey === 'long-term-goal');
    const barriers = employmentStep.components.find((component) => component.storageKey === 'barriers');
    const targetProgram = employmentStep.components.find((component) => component.storageKey === 'target-program');
    const otherBarrier = barriers.options
      .find(option => option.value === 'other')
      ?.children?.find(component => component.storageKey === 'other-barrier');

    expect(longTermGoal.type).toBe('character-count');
    expect(longTermGoal.repeatable).toEqual({
      group: 'example-goals',
      index: 1,
      minItems: 1,
      maxItems: 3,
      addLabel: { en: 'Add another goal', fr: 'Ajouter un autre objectif' },
      removeLabel: { en: 'Remove this goal', fr: 'Supprimer cet objectif' },
    });
    expect(barriers.type).toBe('checkboxes');
    expect(targetProgram.type).toBe('radio');
    expect(otherBarrier.dateBounds).toEqual({ monthField: 'reporting-month' });
  });
});

describe('buildWorkflowSchema content-only fallbacks', () => {
  test('normalizes text-only components without requiring labels', async () => {
    const pool = makeContentOnlyPool();
    const result = await buildWorkflowSchema({ pool, workflowId: 22 });
    const instructionStep = result.steps.find((step) => step.title?.en === 'Instructions');

    expect(instructionStep).toBeTruthy();
    expect(instructionStep.components).toHaveLength(3);

    const paragraph = instructionStep.components.find((component) => component.type === 'paragraph');
    const insetText = instructionStep.components.find((component) => component.type === 'inset-text');
    const warningText = instructionStep.components.find((component) => component.type === 'warning-text');

    expect(paragraph.text).toEqual({
      en: 'Read this before you continue.',
      fr: 'Lisez ceci avant de continuer.',
    });
    expect(insetText.text).toEqual({
      en: 'Inset text from hint fallback.',
      fr: 'Texte encadre depuis le conseil.',
    });
    expect(warningText.text).toEqual({
      en: 'Warning text from label fallback.',
      fr: 'Avertissement depuis le libelle.',
    });
  });
});
