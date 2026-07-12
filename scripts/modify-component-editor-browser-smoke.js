#!/usr/bin/env node
/*
 * DEV browser smoke for the Modify Intake Step editor.
 *
 * This loads the real local React bundle with deterministic mocked API data so
 * the complex editor chrome, server-rendered working area, property side panel,
 * save error handling, step metadata preservation, and request settling can be
 * tested without requiring a reusable Cognito smoke token.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_FRONTEND_BASE = 'http://localhost:3001';
const DEFAULT_SCREENSHOT_DIR = path.join(process.cwd(), 'tmp', 'modify-component-smoke');
const LOCAL_CHROME_LIBRARY_PATH = '/home/bill/.local/chrome-deps/extract/usr/lib/x86_64-linux-gnu';
const CONSOLE_SNIPPET_LIMIT = 1500;
const STEP_ID = 132;

function parseArgs(argv) {
  const args = {
    frontendBase: process.env.MODIFY_COMPONENT_SMOKE_FRONTEND_BASE || DEFAULT_FRONTEND_BASE,
    screenshotDir: process.env.MODIFY_COMPONENT_SMOKE_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--frontend-base') {
      args.frontendBase = argv[index + 1] || args.frontendBase;
      index += 1;
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[index + 1] || args.screenshotDir;
      index += 1;
    } else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/modify-component-editor-browser-smoke.js [options]',
        '',
        'Options:',
        '  --frontend-base URL     React app origin. Default: http://localhost:3001',
        '  --screenshot-dir DIR    Directory for browser screenshots.',
      ].join('\n'));
      process.exit(0);
    }
  }
  args.frontendBase = String(args.frontendBase || DEFAULT_FRONTEND_BASE).replace(/\/+$/, '');
  return args;
}

function findChromeExecutable() {
  return [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/home/bill/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
  ].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

function ensureLocalChromeLibraryPath() {
  if (!fs.existsSync(LOCAL_CHROME_LIBRARY_PATH)) return;
  const current = process.env.LD_LIBRARY_PATH || '';
  const entries = current.split(':').filter(Boolean);
  if (!entries.includes(LOCAL_CHROME_LIBRARY_PATH)) {
    process.env.LD_LIBRARY_PATH = [LOCAL_CHROME_LIBRARY_PATH, ...entries].join(':');
  }
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fakeJwt() {
  const now = Math.floor(Date.now() / 1000);
  return [
    base64UrlEncode({ alg: 'none', typ: 'JWT' }),
    base64UrlEncode({
      sub: 'modify-component-smoke-admin-sub',
      email: 'modify.component.smoke@example.invalid',
      name: 'Modify Component Smoke Admin',
      role: 'System Administrator',
      'cognito:groups': ['System_Administrator'],
      iat: now,
      exp: now + 3600,
    }),
    'signature',
  ].join('.');
}

function jsonResponse(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function htmlResponse(body, status = 200) {
  return {
    status,
    contentType: 'text/html',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body,
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textOf(value, lang = 'en') {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => textOf(item, lang)).join(', ');
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return textOf(value.text, lang);
    if (Object.prototype.hasOwnProperty.call(value, lang)) return textOf(value[lang], lang);
    if (Object.prototype.hasOwnProperty.call(value, 'en')) return textOf(value.en, lang);
    if (Object.prototype.hasOwnProperty.call(value, 'fr')) return textOf(value.fr, lang);
  }
  return '';
}

const componentTemplates = [
  {
    id: 1001,
    type: 'text-block',
    template_key: 'text-block',
    label: 'Text',
    description: 'Static text block for headings or body copy.',
    status: 'active',
    version: 1,
    default_props: {
      text: { en: 'Example text', fr: 'Exemple de texte' },
      html: '',
      classes: 'govuk-body',
    },
    prop_schema: [
      { key: 'text', path: 'text', type: 'textarea', label: 'Text' },
      { key: 'html', path: 'html', type: 'textarea', label: 'HTML (override)' },
      { key: 'classes', path: 'classes', type: 'select', label: 'Classes', options: [
        { label: 'Body', value: 'govuk-body' },
        { label: 'Heading L', value: 'govuk-heading-l' },
        { label: 'Heading M', value: 'govuk-heading-m' },
      ] },
    ],
    has_options: false,
    option_schema: null,
  },
  {
    id: 1002,
    type: 'input',
    template_key: 'input',
    label: 'Text Input',
    description: 'Single-line text input.',
    status: 'active',
    version: 1,
    default_props: {
      name: 'example-input',
      id: '',
      label: { text: 'Your input', classes: 'govuk-label--m' },
      hint: { text: 'Enter the requested value.' },
      type: 'text',
      autocomplete: '',
      inputmode: '',
      pattern: '',
      spellcheck: true,
      value: '',
      classes: 'govuk-input',
      formGroup: { classes: '' },
    },
    prop_schema: [
      { key: 'name', path: 'name', type: 'text', label: 'Data Key' },
      { key: 'label.text', path: 'label.text', type: 'text', label: 'Label Text' },
      { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label Classes', options: [
        { label: 'Medium', value: 'govuk-label--m' },
        { label: 'Large', value: 'govuk-label--l' },
        { label: 'Visually Hidden', value: 'govuk-visually-hidden' },
      ] },
      { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint Text' },
      { key: 'type', path: 'type', type: 'select', label: 'Input Type', options: [
        { label: 'text', value: 'text' },
        { label: 'email', value: 'email' },
        { label: 'tel', value: 'tel' },
      ] },
      { key: 'autocomplete', path: 'autocomplete', type: 'text', label: 'Autocomplete' },
      { key: 'spellcheck', path: 'spellcheck', type: 'select', label: 'Spellcheck?', options: [
        { label: 'True', value: true },
        { label: 'False', value: false },
      ] },
      { key: 'value', path: 'value', type: 'textarea', label: 'Default Value' },
      { key: 'classes', path: 'classes', type: 'select', label: 'CSS Classes', options: [
        { label: 'Default', value: 'govuk-input' },
        { label: 'Width 20', value: 'govuk-input govuk-input--width-20' },
      ] },
    ],
    has_options: false,
    option_schema: null,
  },
  {
    id: 1003,
    type: 'radio',
    template_key: 'radio',
    label: 'Radio Group',
    description: 'Single-choice radio group.',
    status: 'active',
    version: 1,
    default_props: {
      name: 'example-radio',
      fieldset: { legend: { text: 'Choose an option', isPageHeading: false, classes: 'govuk-fieldset__legend--l' } },
      hint: { text: 'You can only choose one.' },
      classes: 'govuk-radios',
      formGroup: { classes: '' },
      disabled: false,
      items: [
        { text: 'Option 1', value: '1' },
        { text: 'Option 2', value: '2' },
      ],
    },
    prop_schema: [
      { key: 'legendText', path: 'fieldset.legend.text', type: 'text', label: 'Legend Text' },
      { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
      { key: 'name', path: 'name', type: 'text', label: 'Data Key' },
      { key: 'classes', path: 'classes', type: 'select', label: 'Container Classes', options: [
        { label: 'Default', value: 'govuk-radios' },
        { label: 'Inline', value: 'govuk-radios--inline' },
      ] },
      { key: 'options', path: 'items', type: 'optionList', label: 'Options' },
    ],
    has_options: true,
    option_schema: ['text', 'value', 'hint'],
  },
  {
    id: 1004,
    type: 'file-upload',
    template_key: 'file-upload',
    label: 'File Upload',
    description: 'Upload one or more supporting documents.',
    status: 'active',
    version: 1,
    default_props: {
      name: 'uploaded-file',
      id: '',
      label: { text: { en: 'Upload a file', fr: 'Televersez un fichier' }, classes: 'govuk-label--m' },
      hint: { text: { en: 'PDF, JPG, or PNG.', fr: 'PDF, JPG ou PNG.' } },
      multiple: false,
      maxSizeMb: 10,
      accept: '.pdf,.jpg,.jpeg,.png',
      showMimeList: false,
      showMaxSize: false,
      documentLabel: '',
      documentType: '',
      classes: '',
      formGroup: { classes: '' },
      disabled: false,
    },
    prop_schema: [
      { key: 'name', path: 'name', type: 'text', label: 'Data Key' },
      { key: 'label.text', path: 'label.text', type: 'text', label: 'Label Text' },
      { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint Text' },
      { key: 'accept', path: 'accept', type: 'text', label: 'Accept (MIME list)' },
      { key: 'documentType', path: 'documentType', type: 'text', label: 'Document Type (metadata)' },
    ],
    has_options: false,
    option_schema: null,
  },
  {
    id: 1005,
    type: 'date-input',
    template_key: 'date-input',
    label: 'Date Input',
    description: 'Collect day, month, and year.',
    status: 'active',
    version: 1,
    default_props: {
      name: 'example-date',
      fieldset: { legend: { text: 'Enter the date', isPageHeading: false, classes: 'govuk-fieldset__legend--l' } },
      hint: { text: 'For example, 27 3 2007' },
      items: [
        { name: 'day', classes: 'govuk-input--width-2' },
        { name: 'month', classes: 'govuk-input--width-2' },
        { name: 'year', classes: 'govuk-input--width-4' },
      ],
      formGroup: { classes: '' },
      classes: '',
      autocompletePreset: '',
      disabled: false,
    },
    prop_schema: [
      { key: 'legendText', path: 'fieldset.legend.text', type: 'text', label: 'Legend Text' },
      { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
      { key: 'name', path: 'name', type: 'text', label: 'Data Key' },
      { key: 'autocompletePreset', path: 'autocompletePreset', type: 'select', label: 'Autocomplete Preset', options: [
        { label: 'None', value: '' },
        { label: 'Date of Birth', value: 'dob' },
      ] },
    ],
    has_options: false,
    option_schema: null,
  },
];

const templateById = new Map(componentTemplates.map(template => [template.id, template]));

const stepDetail = {
  id: STEP_ID,
  name: 'Authorization for Release of ISET Client Information',
  status: 'active',
  ui_meta: { board: { reviewed: true } },
  components: [
    {
      id: 4001,
      position: 1,
      templateId: 1001,
      templateKey: 'text-block',
      templateVersion: 1,
      props: {
        text: {
          en: 'Release of ISET client information',
          fr: 'Autorisation de divulgation des renseignements du client ISET',
        },
        classes: 'govuk-heading-l',
      },
    },
    {
      id: 4002,
      position: 2,
      templateId: 1001,
      templateKey: 'text-block',
      templateVersion: 1,
      props: {
        text: {
          en: 'I give my consent to my educational institution or my employer to release information to the Indigenous Skills and Employment Training program provider.',
          fr: 'Je consens a ce que mon etablissement ou mon employeur communique des renseignements au fournisseur du programme ISET.',
        },
        classes: 'govuk-body',
      },
    },
    {
      id: 4003,
      position: 3,
      templateId: 1002,
      templateKey: 'input',
      templateVersion: 1,
      props: {
        name: 'legal-name',
        id: 'legal-name',
        label: { text: { en: 'Legal name', fr: 'Nom legal' }, classes: 'govuk-label--m' },
        hint: { text: { en: 'Use the name on the application record.', fr: 'Utilisez le nom inscrit au dossier.' } },
        type: 'text',
        autocomplete: 'name',
        spellcheck: false,
        value: '',
        classes: 'govuk-input',
        formGroup: { classes: '' },
      },
    },
    {
      id: 4004,
      position: 4,
      templateId: 1003,
      templateKey: 'radio',
      templateVersion: 1,
      props: {
        name: 'release-consent',
        fieldset: { legend: { text: { en: 'Do you authorize this release?', fr: 'Autorisez-vous cette divulgation?' }, isPageHeading: false, classes: 'govuk-fieldset__legend--m' } },
        hint: { text: { en: 'Choose one option.', fr: 'Choisissez une option.' } },
        classes: 'govuk-radios',
        formGroup: { classes: '' },
        disabled: false,
        items: [
          { text: { en: 'Yes', fr: 'Oui' }, value: 'yes' },
          { text: { en: 'No', fr: 'Non' }, value: 'no' },
        ],
      },
    },
    {
      id: 4005,
      position: 5,
      templateId: 1005,
      templateKey: 'date-input',
      templateVersion: 1,
      props: {
        name: 'release-date',
        fieldset: { legend: { text: { en: 'Date signed', fr: 'Date de signature' }, isPageHeading: false, classes: 'govuk-fieldset__legend--m' } },
        hint: { text: { en: 'For example, 10 6 2026', fr: 'Par exemple, 10 6 2026' } },
        items: [
          { name: 'day', classes: 'govuk-input--width-2' },
          { name: 'month', classes: 'govuk-input--width-2' },
          { name: 'year', classes: 'govuk-input--width-4' },
        ],
        formGroup: { classes: '' },
        classes: '',
        autocompletePreset: '',
        disabled: false,
      },
    },
  ],
};

function renderTextBlock(props) {
  const body = escapeHtml(textOf(props.html || props.text));
  const classes = props.classes || 'govuk-body';
  if (String(classes).includes('govuk-heading-')) return `<h2 class="${escapeHtml(classes)}">${body}</h2>`;
  return `<p class="${escapeHtml(classes)}">${body}</p>`;
}

function renderInput(props) {
  const id = props.id || props.name || 'input';
  const label = textOf(props.label);
  const hint = textOf(props.hint);
  return [
    '<div class="govuk-form-group">',
    label ? `<label class="govuk-label ${escapeHtml(props.label?.classes || '')}" for="${escapeHtml(id)}">${escapeHtml(label)}</label>` : '',
    hint ? `<div class="govuk-hint">${escapeHtml(hint)}</div>` : '',
    `<input class="${escapeHtml(props.classes || 'govuk-input')}" id="${escapeHtml(id)}" name="${escapeHtml(props.name || id)}" type="${escapeHtml(props.type || 'text')}" value="${escapeHtml(props.value || '')}">`,
    '</div>',
  ].join('');
}

function renderRadio(props) {
  const name = props.name || 'radio';
  const legend = textOf(props.fieldset?.legend?.text || props.label);
  const hint = textOf(props.hint);
  const items = Array.isArray(props.items) ? props.items : [];
  return [
    '<div class="govuk-form-group">',
    '<fieldset class="govuk-fieldset">',
    legend ? `<legend class="govuk-fieldset__legend ${escapeHtml(props.fieldset?.legend?.classes || '')}">${escapeHtml(legend)}</legend>` : '',
    hint ? `<div class="govuk-hint">${escapeHtml(hint)}</div>` : '',
    '<div class="govuk-radios">',
    ...items.map((item, index) => {
      const id = `${name}-${index}`;
      return [
        '<div class="govuk-radios__item">',
        `<input class="govuk-radios__input" id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="radio" value="${escapeHtml(item.value || index)}">`,
        `<label class="govuk-label govuk-radios__label" for="${escapeHtml(id)}">${escapeHtml(textOf(item.text) || item.value || '')}</label>`,
        '</div>',
      ].join('');
    }),
    '</div></fieldset></div>',
  ].join('');
}

function renderDateInput(props) {
  const name = props.name || 'date';
  const legend = textOf(props.fieldset?.legend?.text);
  const hint = textOf(props.hint);
  return [
    '<div class="govuk-form-group">',
    '<fieldset class="govuk-fieldset" role="group">',
    legend ? `<legend class="govuk-fieldset__legend ${escapeHtml(props.fieldset?.legend?.classes || '')}">${escapeHtml(legend)}</legend>` : '',
    hint ? `<div class="govuk-hint">${escapeHtml(hint)}</div>` : '',
    '<div class="govuk-date-input">',
    ...['day', 'month', 'year'].map((part) => [
      '<div class="govuk-date-input__item">',
      `<label class="govuk-label govuk-date-input__label" for="${escapeHtml(`${name}-${part}`)}">${part}</label>`,
      `<input class="govuk-input govuk-date-input__input govuk-input--width-${part === 'year' ? '4' : '2'}" id="${escapeHtml(`${name}-${part}`)}" name="${escapeHtml(`${name}-${part}`)}" type="text">`,
      '</div>',
    ].join('')),
    '</div></fieldset></div>',
  ].join('');
}

function renderFileUpload(props) {
  const id = props.id || props.name || 'file';
  return [
    '<div class="govuk-form-group">',
    `<label class="govuk-label ${escapeHtml(props.label?.classes || '')}" for="${escapeHtml(id)}">${escapeHtml(textOf(props.label) || 'Upload a file')}</label>`,
    textOf(props.hint) ? `<div class="govuk-hint">${escapeHtml(textOf(props.hint))}</div>` : '',
    `<input class="govuk-file-upload" id="${escapeHtml(id)}" name="${escapeHtml(props.name || id)}" type="file">`,
    '</div>',
  ].join('');
}

function renderComponent(requestBody) {
  const parsed = requestBody ? JSON.parse(requestBody) : {};
  const template = parsed.templateId ? templateById.get(Number(parsed.templateId)) : null;
  const key = String(parsed.templateKey || template?.template_key || '').toLowerCase();
  const props = parsed.props || {};
  if (key === 'text-block') return renderTextBlock(props);
  if (key === 'input') return renderInput(props);
  if (key === 'radio') return renderRadio(props);
  if (key === 'date-input') return renderDateInput(props);
  if (key === 'file-upload') return renderFileUpload(props);
  return `<p class="govuk-body">${escapeHtml(key || 'component')}</p>`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function countCalls(apiCalls, pathPattern, method = null) {
  return apiCalls.filter(call => {
    const methodMatches = !method || call.method === method;
    if (pathPattern instanceof RegExp) return methodMatches && pathPattern.test(call.path);
    return methodMatches && call.path === pathPattern;
  }).length;
}

function endpointSnapshot(apiCalls) {
  return {
    stepDetail: countCalls(apiCalls, `/api/steps/${STEP_ID}`, 'GET'),
    stepGroups: countCalls(apiCalls, '/api/step-groups', 'GET'),
    templates: countCalls(apiCalls, '/api/component-templates', 'GET'),
    renderComponent: countCalls(apiCalls, '/api/render/component', 'POST'),
    workflows: countCalls(apiCalls, '/api/workflows', 'GET'),
    saves: countCalls(apiCalls, `/api/steps/${STEP_ID}`, 'PUT'),
  };
}

async function waitForBodyText(page, text, timeoutMs = 12000) {
  await page.waitForFunction(
    expected => (document.body?.innerText || '').includes(expected),
    { timeout: timeoutMs },
    text
  );
}

async function clickButtonByText(page, text) {
  return page.evaluate((label) => {
    const button = Array.from(document.querySelectorAll('button'))
      .find(candidate => candidate.textContent.trim().includes(label));
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }, text);
}

async function clickWorkingAreaCard(page, text) {
  const point = await page.evaluate((label) => {
    const cards = Array.from(document.querySelectorAll('.stage-card, [class*="stage-card"]'));
    let target = cards.find(card => (card.textContent || '').includes(label));
    if (!target) {
      const textNode = Array.from(document.querySelectorAll('label, legend, h1, h2, h3, p, div, span'))
        .find(node => (node.textContent || '').includes(label));
      target = textNode?.closest?.('.stage-card') || textNode?.closest?.('[class*="stage-card"]') || textNode;
    }
    if (!target && cards.length >= 3) target = cards[2];
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: rect.left + Math.min(Math.max(rect.width / 2, 12), rect.width - 12),
      y: rect.top + Math.min(Math.max(rect.height / 2, 12), rect.height - 12),
    };
  }, text);
  if (!point) return false;
  await page.mouse.click(point.x, point.y);
  return true;
}

async function clickLibraryButton(page, text) {
  return page.evaluate((label) => {
    const libraryHeader = Array.from(document.querySelectorAll('h2,h3,h4'))
      .find(node => node.textContent.trim() === 'Library');
    let root = libraryHeader?.parentElement || document.body;
    for (let index = 0; index < 4 && root?.parentElement; index += 1) root = root.parentElement;
    const button = Array.from(root.querySelectorAll('button'))
      .find(candidate => candidate.textContent.trim().includes(label));
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }, text);
}

async function installApiStubs(page, apiCalls, saveState) {
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) {
      request.continue();
      return;
    }

    apiCalls.push({
      method: request.method(),
      path: url.pathname,
      search: url.search,
      postData: request.postData() || null,
    });

    if (request.method() === 'OPTIONS') {
      request.respond({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'authorization,x-access-token,content-type',
        },
      });
      return;
    }

    const pathname = url.pathname;
    if (pathname === '/api/auth/me') {
      request.respond(jsonResponse({
        auth: {
          sub: 'modify-component-smoke-admin-sub',
          email: 'modify.component.smoke@example.invalid',
          name: 'Modify Component Smoke Admin',
          role: 'System Administrator',
          groups: ['System_Administrator'],
          staffProfileId: 1,
          regionIds: [1],
        },
        profile: {
          id: 1,
          email: 'modify.component.smoke@example.invalid',
          name: 'Modify Component Smoke Admin',
          role: 'System Administrator',
          region_id: 1,
          region_ids: [1],
        },
      }));
      return;
    }

    if (pathname === `/api/steps/${STEP_ID}` && request.method() === 'GET') {
      request.respond(jsonResponse(stepDetail));
      return;
    }

    if (pathname === '/api/step-groups' && request.method() === 'GET') {
      request.respond(jsonResponse({
        groups: [
          { id: 'iset', label: 'ISET Intake', status: 'active' },
          { id: 'nunavut-legal-aid', label: 'Nunavut Legal Aid Demo', status: 'active' },
        ],
      }));
      return;
    }

    if (pathname === `/api/steps/${STEP_ID}` && request.method() === 'PUT') {
      saveState.putBodies.push(request.postData() || '');
      saveState.putCount += 1;
      if (saveState.putCount === 1) {
        request.respond(jsonResponse({
          error: "Duplicate Data Key 'legal-name' at component index 5 (also used earlier)",
        }, 400));
        return;
      }
      request.respond(jsonResponse({ id: STEP_ID, message: 'Step updated' }));
      return;
    }

    if (pathname === '/api/component-templates' && request.method() === 'GET') {
      request.respond(jsonResponse({
        count: componentTemplates.length,
        templates: componentTemplates,
      }));
      return;
    }

    if (pathname === '/api/render/component' && request.method() === 'POST') {
      try {
        request.respond(htmlResponse(renderComponent(request.postData())));
      } catch (error) {
        request.respond(jsonResponse({ error: error.message }, 500));
      }
      return;
    }

    if (pathname === '/api/workflows') {
      request.respond(jsonResponse([
        { id: 21, name: 'ISET Application Workflow', status: 'active' },
      ]));
      return;
    }

    if (pathname === '/api/workflows/21') {
      request.respond(jsonResponse({
        id: 21,
        name: 'ISET Application Workflow',
        steps: [
          { id: 201, name: 'Applicant details', is_start: true, components: stepDetail.components.slice(2, 4) },
        ],
        routes: [],
      }));
      return;
    }

    if (pathname === '/api/access-control/matrix') {
      request.respond(jsonResponse({ default: 'allow', routes: {} }));
      return;
    }
    if (pathname === '/api/me/tutorial-progress') {
      request.respond(jsonResponse({ completed: [] }));
      return;
    }
    if (pathname === '/api/me/notifications') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/me/staff-messages/counts') {
      request.respond(jsonResponse({ unread: 0, total: 0 }));
      return;
    }
    if (pathname === '/api/admin/contact-messages') {
      request.respond(jsonResponse({ items: [], total: 0 }));
      return;
    }
    if (pathname === '/api/me/staff-profiles') {
      request.respond(jsonResponse({ items: [], profiles: [] }));
      return;
    }
    if (pathname === '/api/service-announcement/current') {
      request.respond(jsonResponse({ announcement: null }));
      return;
    }
    if (pathname === '/api/config/runtime/demo-navigation') {
      request.respond(jsonResponse({ enabled: false }));
      return;
    }

    request.respond(jsonResponse({ items: [], rows: [], total: 0, count: 0 }));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  ensureLocalChromeLibraryPath();

  const executablePath = findChromeExecutable();
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 1440, height: 940, deviceScaleFactor: 1 });

  const failures = [];
  const apiCalls = [];
  const saveState = { putCount: 0, putBodies: [] };

  page.on('pageerror', error => failures.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => {
    const text = message.text();
    if (/ResizeObserver loop/i.test(text)) return;
    if (/Failed to load resource: the server responded with a status of 400/i.test(text)) return;
    if (/\[InlineEdit\]|ReferenceError|TypeError|Unhandled|Failed to load|failed with status|CORS|ERR_FAILED|Unauthorized|Cannot update a component|Encountered two children with the same key/i.test(text)) {
      failures.push({ type: 'console', level: message.type(), text: text.slice(0, CONSOLE_SNIPPET_LIMIT) });
    }
  });
  page.on('requestfailed', request => {
    const url = request.url();
    if (url.includes('/api/')) {
      failures.push({
        type: 'requestfailed',
        method: request.method(),
        url,
        failure: request.failure()?.errorText || null,
      });
    }
  });
  page.on('response', response => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    if (url.includes(`/api/steps/${STEP_ID}`) && response.request().method() === 'PUT' && response.status() === 400) return;
    if (response.status() >= 400) failures.push({ type: 'api', status: response.status(), url });
  });

  await installApiStubs(page, apiCalls, saveState);

  const session = {
    idToken: fakeJwt(),
    accessToken: fakeJwt(),
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
  await page.evaluateOnNewDocument((authSession, frontendBase) => {
    window.__API_BASE__ = frontendBase;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
  }, session, args.frontendBase);

  await page.goto(`${args.frontendBase}/modify-component/${STEP_ID}`, { waitUntil: 'domcontentloaded' });
  await waitForBodyText(page, 'Modify Intake Step');
  await waitForBodyText(page, stepDetail.name);
  await waitForBodyText(page, 'Working Area');
  await waitForBodyText(page, 'Legal name');
  await page.waitForFunction(() => !(document.body?.innerText || '').includes('Rendering...'), { timeout: 15000 }).catch(() => undefined);

  const afterInitialRender = endpointSnapshot(apiCalls);
  await delay(1300);
  const afterInitialIdle = endpointSnapshot(apiCalls);
  if (JSON.stringify(afterInitialRender) !== JSON.stringify(afterInitialIdle)) {
    failures.push({
      type: 'assertion',
      message: 'Editor API calls did not settle after initial render',
      afterInitialRender,
      afterInitialIdle,
      apiCalls,
    });
  }

  const initialAssertions = await page.evaluate((expectedName) => {
    const text = document.body?.innerText || '';
    const h1 = Array.from(document.querySelectorAll('h1')).find(node => node.textContent.includes('Modify Intake Step'));
    const innerHeadings = Array.from(document.querySelectorAll('h2,h3'))
      .map(node => node.textContent.trim())
      .filter(Boolean);
    const libraryHeading = innerHeadings.find(label => label === 'Library');
    const librarySearch = Array.from(document.querySelectorAll('input'))
      .find(input => input.placeholder === 'Search components');
    const stageCards = Array.from(document.querySelectorAll('.stage-card'));
    const selectedStepHeading = innerHeadings.find(label => label.includes(expectedName));
    const saveButton = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent.trim().includes('Save Changes'));
    const actionButtons = Array.from(document.querySelectorAll('button'))
      .filter(button => ['Cancel', 'Undo', 'Redo', 'Save as New', 'Delete', 'Validate', 'Save Changes'].some(label => button.textContent.trim().includes(label)));
    const actionRects = actionButtons.map(button => button.getBoundingClientRect()).filter(rect => rect.width && rect.height);
    return {
      hasRouteTitle: Boolean(h1),
      hasStepNameInEditorHeader: Boolean(selectedStepHeading),
      hasLibraryHeading: Boolean(libraryHeading),
      hasLibrarySearch: Boolean(librarySearch),
      hasWorkingCards: stageCards.length >= 5,
      hasPropertiesPanel: text.includes('Intake Step Properties'),
      hasComponentPropertiesBeforeSelection: text.includes('Component Properties'),
      saveInitiallyDisabled: Boolean(saveButton?.disabled),
      actionTopSpread: actionRects.length ? Math.max(...actionRects.map(rect => rect.top)) - Math.min(...actionRects.map(rect => rect.top)) : null,
      textSample: text.slice(0, 2200),
    };
  }, stepDetail.name);
  if (!initialAssertions.hasRouteTitle || !initialAssertions.hasStepNameInEditorHeader || !initialAssertions.hasLibraryHeading || !initialAssertions.hasLibrarySearch || !initialAssertions.hasWorkingCards || !initialAssertions.hasPropertiesPanel) {
    failures.push({ type: 'assertion', message: 'Modify Intake Step editor did not render the expected core regions', initialAssertions });
  }
  if (!initialAssertions.saveInitiallyDisabled) {
    failures.push({ type: 'assertion', message: 'Save Changes should be disabled before edits', initialAssertions });
  }
  if (initialAssertions.actionTopSpread != null && initialAssertions.actionTopSpread > 44) {
    failures.push({ type: 'assertion', message: 'Editor action row wrapped too aggressively at desktop viewport', initialAssertions });
  }

  await page.evaluate(() => {
    const input = Array.from(document.querySelectorAll('input')).find(candidate => candidate.placeholder === 'Search components');
    input?.focus();
  });
  await page.keyboard.type('file');
  await waitForBodyText(page, 'File Upload');
  const searchAssertions = await page.evaluate(() => {
    const libraryHeader = Array.from(document.querySelectorAll('h2,h3,h4'))
      .find(node => node.textContent.trim() === 'Library');
    let root = libraryHeader?.parentElement || document.body;
    for (let index = 0; index < 4 && root?.parentElement; index += 1) root = root.parentElement;
    const text = root.textContent || '';
    return {
      hasFileUpload: text.includes('File Upload'),
      hidesRadioGroup: !text.includes('Radio Group'),
      libraryText: text.slice(0, 1000),
    };
  });
  if (!searchAssertions.hasFileUpload || !searchAssertions.hidesRadioGroup) {
    failures.push({ type: 'assertion', message: 'Library search did not filter component choices', searchAssertions });
  }
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');

  const selectedLegalName = await clickWorkingAreaCard(page, 'Legal name');
  if (!selectedLegalName) {
    failures.push({ type: 'assertion', message: 'Could not select the Legal name component in the working area' });
  } else {
    await waitForBodyText(page, 'Component Properties');
    await waitForBodyText(page, 'Data Key');
  }
  const afterSelect = endpointSnapshot(apiCalls);
  await delay(1300);
  const afterSelectIdle = endpointSnapshot(apiCalls);
  if (JSON.stringify(afterSelect) !== JSON.stringify(afterSelectIdle)) {
    failures.push({
      type: 'assertion',
      message: 'Editor API calls did not settle after component selection',
      afterSelect,
      afterSelectIdle,
      apiCalls,
    });
  }

  const clickedAddInput = await clickLibraryButton(page, 'Text Input');
  if (!clickedAddInput) {
    failures.push({ type: 'assertion', message: 'Could not add Text Input from the component library' });
  } else {
    await waitForBodyText(page, 'Your input');
    await page.waitForFunction(
      () => (document.querySelector('.stage')?.innerText || '').includes('Your input'),
      { timeout: 12000 }
    ).catch(error => {
      failures.push({ type: 'assertion', message: error.message, expected: 'New library component rendered in the working area' });
    });
  }

  const afterAdd = await page.evaluate(() => {
    const saveButton = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent.trim().includes('Save Changes'));
    const cards = Array.from(document.querySelectorAll('.stage-card'));
    return {
      saveEnabled: Boolean(saveButton && !saveButton.disabled),
      cardCount: cards.length,
      textSample: (document.body?.innerText || '').slice(0, 2200),
    };
  });
  if (!afterAdd.saveEnabled || afterAdd.cardCount < 6) {
    failures.push({ type: 'assertion', message: 'Adding a library component did not dirty the editor as expected', afterAdd });
  }

  const clickedSaveError = await clickButtonByText(page, 'Save Changes');
  if (!clickedSaveError) {
    failures.push({ type: 'assertion', message: 'Could not click Save Changes for failed save assertion' });
  } else {
    await waitForBodyText(page, "Duplicate Data Key 'legal-name'", 12000).catch(error => {
      failures.push({ type: 'assertion', message: error.message, expected: 'Backend save validation message surfaced in alert' });
    });
  }

  const clickedSaveSuccess = await clickButtonByText(page, 'Save Changes');
  if (!clickedSaveSuccess) {
    failures.push({ type: 'assertion', message: 'Could not click Save Changes for successful save assertion' });
  } else {
    await waitForBodyText(page, 'Saved changes.', 12000).catch(error => {
      failures.push({ type: 'assertion', message: error.message, expected: 'Successful save alert' });
    });
  }

  if (saveState.putCount !== 2) {
    failures.push({ type: 'assertion', message: 'Expected exactly two PUT saves: one failed validation response and one success', saveState });
  }
  const parsedSaveBodies = saveState.putBodies.map(body => {
    try { return JSON.parse(body); } catch { return null; }
  });
  const lastSave = parsedSaveBodies[parsedSaveBodies.length - 1];
  if (!lastSave || !Array.isArray(lastSave.components) || lastSave.components.length < 6) {
    failures.push({ type: 'assertion', message: 'Save payload did not include the expected component list', parsedSaveBodies });
  }
  if (lastSave && !Object.prototype.hasOwnProperty.call(lastSave, 'ui_meta')) {
    failures.push({ type: 'assertion', message: 'Save payload should preserve step metadata for group assignment support', lastSave });
  }
  if (lastSave && JSON.stringify(lastSave.ui_meta || null) !== JSON.stringify(stepDetail.ui_meta)) {
    failures.push({ type: 'assertion', message: 'Save payload changed existing step metadata during ordinary component save', expected: stepDetail.ui_meta, actual: lastSave.ui_meta });
  }
  if (lastSave && JSON.stringify(lastSave).includes('__workflowFields')) {
    failures.push({ type: 'assertion', message: 'Editor-only workflow field snapshots leaked into save payload', lastSave });
  }

  const clickedValidate = await clickButtonByText(page, 'Validate');
  if (!clickedValidate) {
    failures.push({ type: 'assertion', message: 'Could not click Validate' });
  } else {
    await waitForBodyText(page, 'Validation Results', 12000).catch(error => {
      failures.push({ type: 'assertion', message: error.message, expected: 'Validation Results panel' });
    });
  }

  const screenshot = path.join(args.screenshotDir, 'modify-component-132-editor.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();

  const result = {
    pass: failures.length === 0,
    screenshots: [screenshot],
    initialAssertions,
    searchAssertions,
    afterAdd,
    apiSnapshot: endpointSnapshot(apiCalls),
    saveAttempts: saveState.putCount,
    putPayloadSummaries: parsedSaveBodies.map(body => body ? {
      name: body.name,
      status: body.status,
      componentCount: Array.isArray(body.components) ? body.components.length : null,
      hasUiMeta: Object.prototype.hasOwnProperty.call(body, 'ui_meta'),
      containsWorkflowFields: JSON.stringify(body).includes('__workflowFields'),
    } : null),
  };
  if (failures.length) {
    console.error(JSON.stringify({ ...result, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
