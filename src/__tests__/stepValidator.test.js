import { validateStep, summarizeIssues } from '../validation/stepValidator';

// simple helpers (mirroring earlier internal usage) for constructing test components
function makeComponent({ id='c', template_key='input', props={} }={}) { return { id, template_key, props }; }
function makeStep(components=[]) { return { name:'Test', status:'active', components }; }

describe('validateStep', () => {
  test('detects duplicate keys and missing labels', () => {
    const step = {
      name: 'Test Step',
      status: 'active',
      components: [
        { template_key: 'input', props: { name: 'a', label: { text: { en: '', fr: '' } } } },
        { template_key: 'input', props: { name: 'a', label: { text: { en: 'Label EN', fr: '' } } } },
        { template_key: 'radio', props: { name: 'b', items: [ { value: 'x', text: { en: 'X' } }, { value: 'x', text: { en: 'X2' } }, { value: 'y', text: '' } ] } }
      ]
    };
    const issues = validateStep(step);
    expect(issues.some(i => i.message.includes('Duplicate data key'))).toBe(true);
    expect(issues.some(i => i.category==='accessibility')).toBe(true);
    expect(issues.some(i => i.category==='options' && i.message.includes('Duplicate option values'))).toBe(true);
  });

  test('summarizeIssues counts severities', () => {
    const issues = [
      { severity:'error' },
      { severity:'warning' },
      { severity:'info' },
      { severity:'error' }
    ];
    expect(summarizeIssues(issues)).toEqual({ error:2, warning:1, info:1 });
  });

    test('detects case mismatch between rule literal and option value', () => {
      const step = makeStep([
        makeComponent({
          id:'eligibility-age', template_key:'radio', props:{
            name:'eligibility-age',
            items:[{text:'Yes', value:'yes'},{text:'No', value:'No'}],
            validation:{
              rules:[{
                id:'age-rule',
                type:'predicate',
                when:{ '==':[ { var:'eligibility-age'}, 'no' ] }
              }]
            }
          }} )
      ]);
      const issues = validateStep(step);
      expect(issues.some(i=>/case mismatch/.test(i.message))).toBe(true);
    });

    test('detects unmatched literal when no option value exists', () => {
      const step = makeStep([
        makeComponent({
          id:'eligibility-status', template_key:'radio', props:{
            name:'eligibility-status',
            items:[{text:'Active', value:'active'},{text:'Pending', value:'pending'}],
            validation:{
              rules:[{
                id:'status-rule',
                type:'predicate',
                when:{ '==':[ { var:'eligibility-status'}, 'archived' ] }
              }]
            }
          }} )
      ]);
      const issues = validateStep(step);
      expect(issues.some(i=>/no option with that value exists/.test(i.message))).toBe(true);
    });

    test('flags conditional visibility authoring issues before publish', () => {
      const step = makeStep([
        makeComponent({
          id: 'support-copy',
          template_key: 'paragraph',
          props: {
            name: 'support-copy',
            text: { en: 'Copy', fr: 'Texte' },
            conditions: {
              all: [
                { ref: 'requested-supports', op: 'containsAny', value: '' },
                { ref: 'missing-field', op: 'unknown-op' }
              ]
            }
          }
        }),
        makeComponent({
          id: 'requested-supports',
          template_key: 'checkboxes',
          props: {
            name: 'requested-supports',
            fieldset: { legend: { text: { en: 'Supports', fr: 'Soutiens' } } },
            items: [{ text: { en: 'Living', fr: 'Allocation' }, value: 'living' }]
          }
        }),
        makeComponent({
          id: 'unsupported-target',
          template_key: 'select',
          props: {
            name: 'unsupported-target',
            label: { text: { en: 'Target', fr: 'Cible' } },
            conditions: { all: [{ ref: 'requested-supports', op: 'contains', value: 'living' }] }
          }
        })
      ]);

      const issues = validateStep(step);
      expect(issues.some(i => i.message.includes('requires a comparison value'))).toBe(true);
      expect(issues.some(i => i.message.includes("unsupported operator 'unknown-op'"))).toBe(true);
      expect(issues.some(i => i.message.includes("references 'missing-field'"))).toBe(true);
      expect(issues.some(i => i.message.includes('runtime does not currently honor'))).toBe(true);
    });

    test('accepts shared alias refs such as storageKey without false missing-ref warnings', () => {
      const step = makeStep([
        {
          id: 'support-selector',
          storageKey: 'requested.supports',
          template_key: 'checkboxes',
          props: {
            fieldset: { legend: { text: { en: 'Supports', fr: 'Soutiens' } } },
            items: [{ text: { en: 'Living', fr: 'Allocation' }, value: 'living' }]
          }
        },
        makeComponent({
          id: 'support-copy',
          template_key: 'paragraph',
          props: {
            text: { en: 'Copy', fr: 'Texte' },
            conditions: { all: [{ ref: 'requested.supports', op: 'contains', value: 'living' }] }
          }
        })
      ]);

      const issues = validateStep(step);
      expect(issues.some(i => i.message.includes("references 'requested.supports'"))).toBe(false);
    });
});
