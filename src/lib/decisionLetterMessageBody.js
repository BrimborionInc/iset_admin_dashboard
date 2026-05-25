function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTextBlock(lines) {
  const cleaned = lines.map(line => String(line || '').trim()).filter(Boolean);
  if (!cleaned.length) return '';
  if (cleaned.every(line => /^[-*]\s+/.test(line))) {
    return `<ul class="govuk-list govuk-list--bullet">${cleaned
      .map(line => `<li>${escapeHtml(line.replace(/^[-*]\s+/, '').trim())}</li>`)
      .join('')}</ul>`;
  }
  const firstBulletIndex = cleaned.findIndex(line => /^[-*]\s+/.test(line));
  if (firstBulletIndex > -1) {
    const before = cleaned.slice(0, firstBulletIndex);
    const bulletLines = cleaned.slice(firstBulletIndex).filter(line => /^[-*]\s+/.test(line));
    const after = cleaned.slice(firstBulletIndex).filter(line => !/^[-*]\s+/.test(line));
    return [
      before.length ? `<p class="govuk-body">${before.map(escapeHtml).join('<br>')}</p>` : '',
      bulletLines.length
        ? `<ul class="govuk-list govuk-list--bullet">${bulletLines
            .map(line => `<li>${escapeHtml(line.replace(/^[-*]\s+/, '').trim())}</li>`)
            .join('')}</ul>`
        : '',
      after.length ? `<p class="govuk-body">${after.map(escapeHtml).join('<br>')}</p>` : '',
    ].filter(Boolean).join('\n');
  }
  return `<p class="govuk-body">${cleaned.map(escapeHtml).join('<br>')}</p>`;
}

function renderDecisionLetterMessageBodyHtml(body) {
  const rawLines = String(body || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const blocks = [];
  let current = [];
  rawLines.forEach(line => {
    if (line.trim()) {
      current.push(line);
      return;
    }
    if (current.length) {
      blocks.push(current);
      current = [];
    }
  });
  if (current.length) blocks.push(current);

  const html = blocks
    .map((block, index) => {
      const cleaned = block.map(line => String(line || '').trim()).filter(Boolean);
      if (!cleaned.length) return '';
      if (
        index === 0 &&
        cleaned.length === 1 &&
        cleaned[0].length <= 120 &&
        !/[.:]$/.test(cleaned[0])
      ) {
        return `<h2 class="govuk-heading-m">${escapeHtml(cleaned[0])}</h2>`;
      }
      return renderTextBlock(cleaned);
    })
    .filter(Boolean)
    .join('\n');

  return html || '<p class="govuk-body">No letter content provided.</p>';
}

function buildDecisionLetterSchemaFromMessageBody(schema, body, meta = {}) {
  const html = renderDecisionLetterMessageBodyHtml(body);
  const baseStep = Array.isArray(schema?.steps) && schema.steps.length ? schema.steps[0] : {};
  return {
    ...(schema || {}),
    meta: {
      ...(schema?.meta || {}),
      ...meta,
      decisionLetterSource: 'secure_message_body',
    },
    steps: [
      {
        ...baseStep,
        components: [
          {
            id: 'secure-message-decision-letter-body',
            type: 'paragraph',
            class: 'govuk-body',
            classes: 'govuk-body',
            html: { en: html, fr: html },
            text: { en: '', fr: '' },
          },
        ],
      },
    ],
  };
}

module.exports = {
  buildDecisionLetterSchemaFromMessageBody,
  renderDecisionLetterMessageBodyHtml,
};
