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

describe('radio component schema', () => {
  test('accepts a complete radio definition', () => {
    expect(validate(good)).toBe(true);
    expect(validate.errors).toBeNull();
  });

  test('rejects empty and incorrectly typed required fields', () => {
    expect(validate(bad)).toBe(false);
    const paths = (validate.errors || []).map(error => `${error.instancePath}:${error.keyword}`);
    expect(paths).toEqual(expect.arrayContaining([
      '/name:minLength',
      '/fieldset/legend/text:minLength',
      '/fieldset/legend/isPageHeading:type',
      '/fieldset/legend/classes:type',
      '/items:minItems',
    ]));
  });
});
