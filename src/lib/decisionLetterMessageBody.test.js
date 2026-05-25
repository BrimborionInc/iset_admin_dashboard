const {
  buildDecisionLetterSchemaFromMessageBody,
  renderDecisionLetterMessageBodyHtml,
} = require('./decisionLetterMessageBody');

describe('decisionLetterMessageBody', () => {
  test('renders reviewed funding revision body with current amounts and bullets', () => {
    const body = [
      'Funding Revision Letter',
      '',
      'Date: 2026-05-25',
      '',
      'Dear Shelly Van Loon,',
      '',
      'The revised approved funding is:',
      '- Tuition fees: $3350.00 payable to Athabasca University.',
      '- Living allowance: $8700.00 payable to Shelly Van Loon.',
      '- Tuition fees (reimbursement): $112.00 payable to Shelly Van Loon.',
      '',
      'Sincerely,',
      'NWAC ISET Program',
    ].join('\n');

    const html = renderDecisionLetterMessageBodyHtml(body);

    expect(html).toContain('Funding Revision Letter');
    expect(html).toContain('$3350.00');
    expect(html).toContain('$8700.00');
    expect(html).toContain('$112.00');
    expect(html).not.toContain('$3550.00');
    expect(html).not.toContain('$200.00/month');
    expect(html).toContain('<ul class="govuk-list govuk-list--bullet">');
  });

  test('builds a schema from the message body instead of leaving stale template tokens', () => {
    const staleSchema = {
      meta: { workflow: { id: 46 } },
      steps: [
        {
          stepId: 'nwac-iset-program',
          components: [
            {
              id: 'text-block',
              type: 'paragraph',
              html: {
                en: '<p>{{decision_intro}}</p>{{{decision_reason_html}}}',
                fr: '<p>{{decision_intro}}</p>{{{decision_reason_html}}}',
              },
            },
          ],
        },
      ],
    };

    const schema = buildDecisionLetterSchemaFromMessageBody(staleSchema, 'Funding Revision Letter\n\nUpdated amount: $12162.00', {
      interventionId: 57,
    });

    expect(schema.meta.decisionLetterSource).toBe('secure_message_body');
    expect(schema.meta.interventionId).toBe(57);
    expect(schema.steps).toHaveLength(1);
    expect(schema.steps[0].components).toHaveLength(1);
    expect(schema.steps[0].components[0].html.en).toContain('$12162.00');
    expect(schema.steps[0].components[0].html.en).not.toContain('{{decision_intro}}');
    expect(schema.steps[0].components[0].html.en).not.toContain('{{{decision_reason_html}}}');
  });
});
