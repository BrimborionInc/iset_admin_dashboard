#!/usr/bin/env node
/*
  Inserts a new version of the 'input' component template with expanded defaults,
  a richer prop_schema (covering all relevant GOV.UK govukInput options), and a
  clean pass-through export_njk_template that calls the official macro.

  Usage:
    node scripts/upgrade_input_template_v2.js

  Notes:
  - Reads DB connection from .env (DB_HOST, DB_USER, DB_PASS, DB_NAME).
  - Clones label/description/has_options from the latest active version.
  - Sets status='active'. Older versions remain as-is.
*/

const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// Load env from project .env
const dotenvPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
  console.log('Loaded .env from', dotenvPath);
} else {
  require('dotenv').config();
  console.log('Loaded .env from process cwd');
}

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

function j(v) { return JSON.stringify(v); }

async function main() {
  const pool = await mysql.createPool(dbConfig);
  try {
    // Fetch latest active input template
    const [rows] = await pool.query(
      `SELECT id, template_key, version, type, label, description, default_props, prop_schema, export_njk_template, status, has_options, option_schema
         FROM component_template
        WHERE template_key = 'input' AND status = 'active'
        ORDER BY version DESC
        LIMIT 1`
    );
    if (!rows.length) {
      throw new Error("No active 'input' template found to clone");
    }
    const base = rows[0];
    const nextVersion = Number(base.version || 0) + 1;

    // Expanded default props covering govukInput API
    const default_props = {
      id: 'input-1',
      name: 'input-1',
      type: 'text',
      label: { text: 'Label', classes: '' },
      hint: { text: '' },
      errorMessage: { text: '' },
      classes: '', // e.g. 'govuk-input--width-10'
      formGroup: { classes: '' },
      autocomplete: '',
      inputmode: '', // e.g. 'numeric', 'email', 'tel'
      spellcheck: null, // set true/false to enable; null/undefined to omit
      pattern: '',
      prefix: {}, // { text|html, classes }
      suffix: {}, // { text|html, classes }
      describedBy: '', // extra ids appended to aria-describedby
      attributes: [], // array of { attribute, value }
      disabled: false,
      value: ''
    };

    // Editable schema for Admin UI (paths must exist in defaults)
    const prop_schema = [
      { key: 'name', label: 'Field name', path: 'name', type: 'string', required: true },
      { key: 'id', label: 'ID', path: 'id', type: 'string' },
      { key: 'type', label: 'Input type', path: 'type', type: 'enum', options: ['text', 'email', 'number', 'password', 'tel', 'url', 'search'] },
      { key: 'label.text', label: 'Label', path: 'label.text', type: 'string', required: true },
      { key: 'label.classes', label: 'Label classes', path: 'label.classes', type: 'string' },
      { key: 'hint.text', label: 'Hint', path: 'hint.text', type: 'string' },
      { key: 'errorMessage.text', label: 'Error message', path: 'errorMessage.text', type: 'string' },
      { key: 'classes', label: 'Input classes', path: 'classes', type: 'string' },
      { key: 'formGroup.classes', label: 'Form group classes', path: 'formGroup.classes', type: 'string' },
      { key: 'autocomplete', label: 'Autocomplete', path: 'autocomplete', type: 'string' },
      { key: 'inputmode', label: 'Input mode', path: 'inputmode', type: 'enum', options: ['text', 'numeric', 'decimal', 'email', 'tel', 'search', 'url', 'none'] },
      { key: 'spellcheck', label: 'Spellcheck', path: 'spellcheck', type: 'boolean' },
      { key: 'pattern', label: 'Pattern (regex)', path: 'pattern', type: 'string' },
      { key: 'prefix.text', label: 'Prefix text', path: 'prefix.text', type: 'string' },
      { key: 'prefix.html', label: 'Prefix HTML', path: 'prefix.html', type: 'string' },
      { key: 'prefix.classes', label: 'Prefix classes', path: 'prefix.classes', type: 'string' },
      { key: 'suffix.text', label: 'Suffix text', path: 'suffix.text', type: 'string' },
      { key: 'suffix.html', label: 'Suffix HTML', path: 'suffix.html', type: 'string' },
      { key: 'suffix.classes', label: 'Suffix classes', path: 'suffix.classes', type: 'string' },
      { key: 'describedBy', label: 'Additional describedBy', path: 'describedBy', type: 'string' },
      { key: 'attributes', label: 'Additional attributes', path: 'attributes', type: 'attributes' },
      { key: 'disabled', label: 'Disabled', path: 'disabled', type: 'boolean' },
      { key: 'value', label: 'Default value', path: 'value', type: 'string' }
    ];

    // NJK macro passthrough
    const export_njk_template = `
{% from "govuk/components/input/macro.njk" import govukInput %}
{{ govukInput(props) }}
`.trim();

    // Insert new version
    const [ins] = await pool.query(
      `INSERT INTO component_template
        (template_key, version, type, label, description, default_props, prop_schema, export_njk_template, status, has_options, option_schema)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'input',
        nextVersion,
        base.type || 'input',
        base.label || 'Text input',
        base.description || 'Single-line text input (GOV.UK govukInput)',
        j(default_props),
        j(prop_schema),
        export_njk_template,
        'active',
        0,
        null
      ]
    );

    console.log(`Inserted input template v${nextVersion} with id=${ins.insertId}`);

    // Sanity render via server parity-audit endpoint is optional; here we only print completion.
    await pool.end();
  } catch (e) {
    console.error('Upgrade failed:', e.message || e);
    process.exitCode = 1;
  }
}

main();
