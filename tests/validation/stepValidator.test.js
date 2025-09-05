import { validateStep, summarizeIssues } from '../../src/validation/stepValidator';

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
    // Duplicate key
    expect(issues.some(i => i.message.includes('Duplicate data key'))).toBe(true);
    // Missing EN label for first input (both blank counts as missing accessible label)
    expect(issues.some(i => i.category==='accessibility')).toBe(true);
    // Option duplicates
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
});
