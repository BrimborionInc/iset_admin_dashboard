// Central constants for workflow normalization & publishing
// Keep this list in sync with portal renderer registry keys (ISET-intake/src/renderer/renderers.js)
// Aliases included for safety.
const SUPPORTED_COMPONENT_TYPES = new Set([
  'radio',
  'panel',
  'input',
  'text',
  'email',
  'phone',
  'password',
  'password-input',
  'number',
  'textarea',
  'select',
  'checkbox',
  'checkboxes',
  'date',
  'date-input',
  'label',
  'paragraph',
  'inset-text',
  'warning-text',
  'details',
  'accordion',
  'character-count',
  'file-upload',
  'summary-list',
  'signature-ack',
]);

module.exports = { SUPPORTED_COMPONENT_TYPES };
