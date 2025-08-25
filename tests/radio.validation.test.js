// Simple runtime test (manual) to invoke validation utility for radio component.
// Run with: node tests/radio.validation.test.js (ensure server dependencies installed)
const path = require('path');
const fs = require('fs');
const Ajv = require('ajv');
const schemaPath = path.join(__dirname, '..', 'src', 'component-lib', 'schemas', 'radio.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const good = {
  name: 'example-radio',
  fieldset: { legend: { text: 'Pick', isPageHeading: false, classes: '' } },
  hint: { text: 'Hint here' },
  classes: '',
  formGroup: { classes: '' },
  disabled: false,
  required: false,
  items: [ { text: 'One', value: '1', hint: 'Help' } ]
};

const bad = { name: '', fieldset: { legend: { text: '', isPageHeading: 'no', classes: 5 } }, items: [] };

console.log('GOOD valid?', validate(good), validate.errors || null);
validate(bad);
console.log('BAD valid?', validate.errors);
