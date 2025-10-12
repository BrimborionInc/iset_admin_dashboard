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
});
