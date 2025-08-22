const path = require('path');
const { maskName } = require('./src/utils/utils'); // Update the import statement
const nunjucks = require("nunjucks");

// Configure Nunjucks to use GOV.UK Frontend components
nunjucks.configure("node_modules/govuk-frontend/dist/", {
  autoescape: true,
  watch: false,
  noCache: true,
});

// Define the generateGUID function
const generateGUID = () => {
  return Math.random().toString(36).substring(2, 11).toUpperCase();
};

// Use dynamic path based on the environment
const dotenvPath = process.env.NODE_ENV === 'production'
  ? '/home/ec2-user/admin-dashboard/.env'  // Path for production
  : path.resolve(__dirname, '.env');  // Use local .env for development

require('dotenv').config({ path: dotenvPath });

console.log("Loaded .env from:", dotenvPath);  // Debugging log
console.log("CORS Allowed Origin:", process.env.ALLOWED_ORIGIN);

// Set a default value for ALLOWED_ORIGIN in development if not set in .env
if (process.env.NODE_ENV !== 'production' && !process.env.ALLOWED_ORIGIN) {
  // Allow both portal (3000) and admin UI (3001) in dev
  process.env.ALLOWED_ORIGIN = 'http://localhost:3000,http://localhost:3001';
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const cheerio = require('cheerio');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 5001; // Use port from .env

app.use(bodyParser.json({ limit: '1mb' }));

app.use('/api/', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});


const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// --- Authentication (Cognito) - feature flagged ---
try {
  const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
  if (authProvider === 'cognito') {
    const { authnMiddleware } = require('./src/middleware/authn');
    app.use('/api', authnMiddleware());
  }
} catch (e) {
  console.warn('Auth middleware init failed:', e?.message);
}

// Simple auth probe for smoke testing
app.get('/api/auth/me', (req, res) => {
  const enabled = String(process.env.AUTH_PROVIDER || 'none').toLowerCase() === 'cognito';
  if (!enabled) return res.status(200).json({ provider: 'none', auth: null });
  if (!req.auth) return res.status(401).json({ error: 'Unauthenticated' });
  res.json({ provider: 'cognito', auth: req.auth });
});

// --- AI Chat proxy (server-side, avoids exposing API keys in browser) -----
// POST /api/ai/chat
// Body: { messages: [{ role: 'system'|'user'|'assistant', content: string }], model?: string }
// Returns: OpenRouter API response (choices[0].message.content used by UI)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const key = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY;
    if (!key) {
      return res.status(501).json({ error: 'disabled', message: 'AI assistant is disabled. No server API key configured.' });
    }
    const { messages, model } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages_required' });
    }
    // Sanitize payload and cap size
    const safeMessages = messages
      .slice(0, 12)
      .map(m => ({
        role: ['system','user','assistant'].includes(String(m.role).toLowerCase()) ? String(m.role).toLowerCase() : 'user',
        content: String(m.content ?? '').slice(0, 8000)
      }));
    const mdl = typeof model === 'string' && model.trim() ? model : 'mistralai/mistral-7b-instruct';
    const headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.ALLOWED_ORIGIN || 'http://localhost:3001',
      'X-Title': 'Admin Dashboard Assistant',
    };
    const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', { model: mdl, messages: safeMessages }, { headers });
    res.status(200).json(resp.data);
  } catch (e) {
    const status = e?.response?.status || 500;
    const details = e?.response?.data || { message: e.message };
    res.status(status).json({ error: 'proxy_failed', details });
  }
});

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

const pool = mysql.createPool(dbConfig);

// Admin routes (delegated user management) - feature flagged
try {
  const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
  if (authProvider === 'cognito') {
    const adminUsers = require('./src/routes/admin/users');
    app.use('/api/admin', adminUsers);
  }
} catch (e) {
  console.warn('Admin routes init failed:', e?.message);
}

// --- DEV-ONLY DB Inspector (read-only) ------------------------------------
// Enable with ENABLE_DEV_DB_INSPECTOR=true and optional DEV_DB_KEY as a simple shared secret.
// Endpoints:
//   GET    /api/dev/db/tables                      -> list tables in the configured database
//   GET    /api/dev/db/describe?table=NAME         -> describe columns for a table
//   GET    /api/dev/db/sample?table=NAME&limit=100 -> sample rows from a table (default 50)
//   POST   /api/dev/db/query { sql, params? }      -> run a read-only SELECT (LIMIT enforced)
// Security:
// - Only active when ENABLE_DEV_DB_INSPECTOR=true
// - Optional header auth via x-dev-key matching DEV_DB_KEY
// - Strictly read-only: only allows SQL starting with SELECT and blocks dangerous tokens
// - Adds a default LIMIT if none provided
// - Redacts sensitive-looking fields in results (password, token, sin/ssn, secret, etc.)
const ENABLE_DEV_DB_INSPECTOR = process.env.ENABLE_DEV_DB_INSPECTOR === 'true';

function devInspectorGuard(req, res, next) {
  if (!ENABLE_DEV_DB_INSPECTOR) return res.status(404).json({ error: 'Not found' });
  const key = process.env.DEV_DB_KEY || '';
  if (key && req.get('x-dev-key') !== key) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function redactValue(key, val) {
  if (val == null) return val;
  const k = String(key || '').toLowerCase();
  if (/(password|pass|secret|token|sin|ssn|nid|credit|card|cvv)/i.test(k)) return '***';
  if (/email/.test(k)) {
    const s = String(val);
    const at = s.indexOf('@');
    if (at > 1) return `${s[0]}***@${s.slice(at + 1)}`;
    return '***';
  }
  return val;
}

function redactRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = redactValue(k, v);
  return out;
}

function ensureSelectSQL(sql) {
  if (typeof sql !== 'string') return { ok: false, reason: 'SQL must be a string' };
  const s = sql.trim().replace(/;\s*$/g, '');
  const low = s.toLowerCase();
  if (!low.startsWith('select')) return { ok: false, reason: 'Only SELECT statements are allowed' };
  if (/\b(update|delete|insert|drop|alter|truncate|create|grant|revoke|replace)\b/i.test(low)) {
    return { ok: false, reason: 'Only read-only SELECT is permitted' };
  }
  // Disallow INTO OUTFILE and other file ops
  if (/\binto\s+outfile\b|\bload_file\s*\(/i.test(low)) return { ok: false, reason: 'Dangerous SQL token' };
  return { ok: true, sql: s };
}

function appendDefaultLimit(sql) {
  const low = sql.toLowerCase();
  if (/\blimit\s+\d+/i.test(low)) return sql;
  return `${sql} LIMIT 100`;
}

// List tables in current database
app.get('/api/dev/db/tables', devInspectorGuard, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME AS table_name, TABLE_ROWS AS approx_rows
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME`,
      [dbConfig.database]
    );
    res.json({ ok: true, tables: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Describe columns for a table
app.get('/api/dev/db/describe', devInspectorGuard, async (req, res) => {
  const table = req.query.table;
  if (!table) return res.status(400).json({ ok: false, error: 'Missing table' });
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION`,
      [dbConfig.database, table]
    );
    res.json({ ok: true, columns: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Sample rows
app.get('/api/dev/db/sample', devInspectorGuard, async (req, res) => {
  const table = req.query.table;
  const limit = Math.min(parseInt(req.query.limit || '50', 10) || 50, 1000);
  if (!table) return res.status(400).json({ ok: false, error: 'Missing table' });
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` LIMIT ${limit}`);
    res.json({ ok: true, rows: rows.map(redactRow), limit });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Run a parameterized, read-only SELECT
app.post('/api/dev/db/query', devInspectorGuard, async (req, res) => {
  try {
    const { sql, params } = req.body || {};
    const check = ensureSelectSQL(sql);
    if (!check.ok) return res.status(400).json({ ok: false, error: check.reason });
    const finalSQL = appendDefaultLimit(check.sql);
    const [rows] = await pool.query(finalSQL, Array.isArray(params) ? params : []);
    res.json({ ok: true, rows: rows.map(redactRow), sql: finalSQL });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Supported component types in the Public Portal renderer (Milestone 6)
// Keep this list in sync with ISET-intake/src/renderer/renderers.js registry keys
// Aliases are included for safety (e.g., 'checkboxes' and 'checkbox', 'date' and 'date-input').
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
]);

// Discoverable list for the Admin UI
app.get('/api/publish/supported-component-types', (_req, res) => {
  res.json({ supported: Array.from(SUPPORTED_COMPONENT_TYPES).sort() });
});

// --- Nunjucks environment for component preview ---------------------------
// Existing global configuration already set above; we create a local reference.
// We attempt to include GOV.UK frontend macros (path may vary depending on install structure).
// Fallback: rely on previously configured nunjucks instance.
let env;
try {
  // Reconfigure with additional search paths without breaking existing one.
  env = nunjucks.configure([
    path.join(__dirname, 'node_modules/govuk-frontend/dist'),
    path.join(__dirname, 'node_modules/govuk-frontend')
  ], { autoescape: true, noCache: true });
} catch (e) {
  console.warn('Nunjucks reconfigure for preview failed, using existing instance:', e.message);
  env = nunjucks;
}

// Helper: render a single component template to HTML using export_njk_template from DB
async function renderComponentHtml(comp) {
  const templateKey = comp.template_key || comp.templateKey || comp.templateKey || null;
  const type = comp.type || null;
  let rows;
  if (templateKey) {
    [rows] = await pool.query(
      `SELECT export_njk_template FROM iset_intake.component_template
       WHERE status='active' AND template_key=? ORDER BY version DESC LIMIT 1`,
      [templateKey]
    );
  } else if (type) {
    [rows] = await pool.query(
      `SELECT export_njk_template FROM iset_intake.component_template
       WHERE status='active' AND type=? ORDER BY version DESC LIMIT 1`,
      [type]
    );
  } else {
    return '<!-- component missing template reference -->';
  }
  const tpl = rows?.[0]?.export_njk_template;
  if (!tpl) return `<!-- missing template for ${templateKey || type} -->`;
  try {
    return env.renderString(tpl, { props: comp.props || {} });
  } catch (e) {
    console.error('NJK render error:', e);
    return `<!-- render error for ${templateKey || type}: ${e.message} -->`;
  }
}

// Wrap rendered fragments in a standalone GOV.UK HTML document
// Expose local GOV.UK frontend dist (once) so iframe can load assets
if (!app.locals.__govukStaticMounted) {
  const govukDistPath = path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist', 'govuk');
  app.use('/assets/govuk', express.static(govukDistPath));
  app.locals.__govukStaticMounted = true;
}

function wrapGovukDoc(innerHtml) {
  // Inline GOV.UK assets to avoid separate network fetches inside iframe which may 404 or be blocked.
  let css = '';
  let js = '';
  try {
    css = fs.readFileSync(path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist', 'govuk', 'govuk-frontend.min.css'), 'utf8');
  } catch (e) {
    css = '/* failed to inline govuk css: ' + e.message + ' */';
  }
  try {
    js = fs.readFileSync(path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist', 'govuk', 'govuk-frontend.min.js'), 'utf8');
  } catch (e) {
    js = '/* failed to inline govuk js: ' + e.message + ' */';
  }
  return `<!doctype html>
  <html lang="en" class="govuk-template">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Preview</title>
      <style>${css}\nbody { margin:16px; }</style>
    </head>
    <body class="govuk-template__body">
      <script>document.body.className = document.body.className ? document.body.className + ' js-enabled' : 'js-enabled';</script>
      <div class="govuk-width-container">${innerHtml}</div>
      <script>${js}; window.GOVUKFrontend && window.GOVUKFrontend.initAll();</script>
    </body>
  </html>`;
}

// POST /api/preview/step : render array of components to full HTML doc
app.post('/api/preview/step', async (req, res) => {
  try {
    const comps = Array.isArray(req.body?.components) ? req.body.components : [];
    let html = '';
    for (const raw of comps) {
      const comp = { ...raw, props: typeof raw.props === 'object' && raw.props !== null ? raw.props : {} };
      // Normalise possible key naming
      if (!comp.template_key && comp.templateKey) comp.template_key = comp.templateKey;
      html += await renderComponentHtml(comp) + '\n';
    }
    res.status(200).type('text/html').send(wrapGovukDoc(html));
  } catch (err) {
    console.error('POST /api/preview/step failed:', err);
    res.status(500).json({ error: 'Failed to render preview' });
  }
});

// POST /api/render/component
// Body: { templateKey?, version?, templateId?, props: {...} }
// Returns raw HTML rendered via the template's export_njk_template and provided props.
app.post('/api/render/component', async (req, res) => {
  try {
    const { templateKey, version, templateId, props } = req.body || {};
    if (!props) return res.status(400).json({ error: 'props required' });

    let rows;
    if (templateId) {
      [rows] = await pool.query(
        `SELECT export_njk_template
           FROM iset_intake.component_template
          WHERE id = ? AND status = 'active'`,
        [templateId]
      );
    } else if (templateKey) {
      const v = Number.isInteger(version) ? version : 1;
      [rows] = await pool.query(
        `SELECT export_njk_template
           FROM iset_intake.component_template
          WHERE template_key = ? AND version = ? AND status = 'active'`,
        [templateKey, v]
      );
    } else {
      return res.status(400).json({ error: 'templateKey or templateId required' });
    }

    const tpl = rows?.[0]?.export_njk_template;
    if (!tpl) return res.status(404).json({ error: 'Missing or inactive template' });

    let html;
    try {
      html = env.renderString(tpl, { props });
    } catch (e) {
      console.error('Nunjucks render error:', e);
      return res.status(500).json({ error: 'Render failed', details: String(e).slice(0, 200) });
    }
    res.type('html').send(html);
  } catch (err) {
    console.error('POST /api/render/component failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Dev-only: seed a simple content-only Text component template into the template catalog
// Enable by setting ENABLE_DEV_SEED_TEMPLATES=true
app.post('/api/dev/seed-text-template', async (req, res) => {
  try {
    const enabled = String(process.env.ENABLE_DEV_SEED_TEMPLATES || 'false').toLowerCase() === 'true';
    if (!enabled) return res.status(403).json({ error: 'Seeding disabled. Set ENABLE_DEV_SEED_TEMPLATES=true to enable.' });

    // Determine next version for this template_key
    const templateKey = 'text-block'; // avoid collision with input type "text"
    const [[verRow]] = await pool.query(
      `SELECT COALESCE(MAX(version), 0) AS v
         FROM iset_intake.component_template
        WHERE template_key = ?`,
      [templateKey]
    );
    const nextVersion = Number(verRow?.v || 0) + 1;

    const defaultProps = {
      text: 'Example text',
      classes: 'govuk-body'
    };

    // Minimal editor schema for the Step Editor Properties panel
    const propSchema = [
      { label: 'Text', path: 'text', type: 'textarea', required: true },
      {
        label: 'Classes',
        path: 'classes',
        type: 'select',
        options: [
          'govuk-body', 'govuk-body-s', 'govuk-hint', 'govuk-inset-text',
          'govuk-heading-s', 'govuk-heading-m', 'govuk-heading-l', 'govuk-heading-xl',
          'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl'
        ]
      }
    ];

    // Nunjucks template: choose element based on classes
  const exportNunjucks = `
{% set cls = props.classes or 'govuk-body' %}
{% set text = props.text or '' %}
{% if cls and (cls.indexOf('govuk-inset-text') != -1) %}
<div class="govuk-inset-text">{{ text }}</div>
{% elif cls and (cls.indexOf('govuk-heading-xl') != -1) %}
<h1 class="govuk-heading-xl">{{ text }}</h1>
{% elif cls and (cls.indexOf('govuk-heading-l') != -1) %}
<h2 class="govuk-heading-l">{{ text }}</h2>
{% elif cls and (cls.indexOf('govuk-heading-m') != -1) %}
<h3 class="govuk-heading-m">{{ text }}</h3>
{% elif cls and (cls.indexOf('govuk-heading-s') != -1) %}
<h4 class="govuk-heading-s">{{ text }}</h4>
{% else %}
<p class="{{ cls }}">{{ text }}</p>
{% endif %}`;

    await pool.query(
      `INSERT INTO iset_intake.component_template
         (template_key, version, type, label, description, default_props, prop_schema, has_options, option_schema, status, export_njk_template)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        templateKey,
        nextVersion,
        'paragraph', // distinct from input 'text'
        'Text',
        'Static text block (headings or body).',
        JSON.stringify(defaultProps),
        JSON.stringify(propSchema),
        0,
        null,
        'active',
        exportNunjucks
      ]
    );

    res.status(201).json({ ok: true, template_key: templateKey, version: nextVersion });
  } catch (err) {
    console.error('Seed text template failed:', err);
    res.status(500).json({ error: 'Failed to seed text template' });
  }
});

// GET /api/audit/parity-sample?templateKey=radio
// Renders the latest active template and performs basic GOV.UK structure checks.
app.get('/api/audit/parity-sample', async (req, res) => {
  try {
    const { templateKey } = req.query;
    if (!templateKey) return res.status(400).json({ error: 'templateKey required' });
    const [[row]] = await pool.query(
      `SELECT export_njk_template, default_props, type
         FROM iset_intake.component_template
        WHERE template_key = ? AND status='active'
        ORDER BY version DESC
        LIMIT 1`,
      [templateKey]
    );
    if (!row) return res.status(404).json({ error: 'Template not found' });
    const props = (() => { try { return JSON.parse(row.default_props || '{}'); } catch { return {}; } })();
    const html = env.renderString(row.export_njk_template, { props });
    const $ = cheerio.load(html);
    const issues = [];
    // Minimal checks by type
    const t = String(row.type || '').toLowerCase();
    if (t === 'radio' || t === 'radios') {
      if ($('.govuk-radios').length === 0) issues.push('Missing .govuk-radios container');
      if ($('input.govuk-radios__input[type="radio"]').length === 0) issues.push('No radio inputs');
      if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    } else if (t === 'checkbox' || t === 'checkboxes') {
      if ($('.govuk-checkboxes').length === 0) issues.push('Missing .govuk-checkboxes container');
      if ($('input.govuk-checkboxes__input[type="checkbox"]').length === 0) issues.push('No checkbox inputs');
      if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    } else if (t === 'input' || t === 'text') {
      if ($('input.govuk-input').length === 0) issues.push('No govuk input');
      if ($('label.govuk-label').length === 0) issues.push('Missing label');
    } else if (t === 'textarea' || t === 'character-count') {
      if ($('textarea.govuk-textarea').length === 0 && $('.govuk-character-count').length === 0) issues.push('No textarea/character-count');
    } else if (t === 'select') {
      if ($('select.govuk-select').length === 0) issues.push('No govuk select');
    } else if (t === 'date' || t === 'date-input') {
      if ($('.govuk-date-input').length === 0) issues.push('No govuk date-input');
    } else if (t === 'file-upload') {
      if ($('input.govuk-file-upload[type="file"]').length === 0) issues.push('No file upload input');
    }
    res.json({ templateKey, type: t, issues, ok: issues.length === 0, html });
  } catch (err) {
    console.error('GET /api/audit/parity-sample failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: run minimal GOV.UK structure checks by component type
function parityChecks($, type, props) {
  const t = String(type || '').toLowerCase();
  const issues = [];
  // Helper: form-group presence
  const hasFormGroup = $('.govuk-form-group').length > 0;
  const hasErrorGroup = $('.govuk-form-group--error').length > 0;
  const expectOptions = Array.isArray(props?.items) && props.items.length > 0;
  const expectLabel = !!(props?.label?.text || props?.fieldset?.legend?.text || props?.titleText);

  if (t === 'radio' || t === 'radios') {
    if ($('.govuk-radios').length === 0) issues.push('Missing .govuk-radios container');
    if ($('input.govuk-radios__input[type="radio"]').length === 0) issues.push('No radio inputs');
    if ($('fieldset.govuk-fieldset').length === 0) issues.push('Missing fieldset');
    if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    // All radios should share same name
    const names = new Set();
    $('input.govuk-radios__input[type="radio"]').each((_, el) => { const n = $(el).attr('name'); if (n) names.add(n); });
    if (names.size > 1) issues.push('Radio inputs do not share the same name');
    // Label-for association
    $('input.govuk-radios__input[type="radio"]').each((_, el) => {
      const id = $(el).attr('id');
      if (!id) issues.push('Radio input missing id');
      const lab = id ? $(`label.govuk-label[for="${id}"]`) : null;
      if (id && (!lab || lab.length === 0)) issues.push(`Missing label[for=${id}]`);
    });
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'checkbox' || t === 'checkboxes') {
    if ($('.govuk-checkboxes').length === 0) issues.push('Missing .govuk-checkboxes container');
    if ($('input.govuk-checkboxes__input[type="checkbox"]').length === 0) issues.push('No checkbox inputs');
    if ($('fieldset.govuk-fieldset').length === 0) issues.push('Missing fieldset');
    if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    // Label-for association
    $('input.govuk-checkboxes__input[type="checkbox"]').each((_, el) => {
      const id = $(el).attr('id');
      if (!id) issues.push('Checkbox input missing id');
      const lab = id ? $(`label.govuk-label[for="${id}"]`) : null;
      if (id && (!lab || lab.length === 0)) issues.push(`Missing label[for=${id}]`);
    });
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'input' || t === 'text' || t === 'email' || t === 'number' || t === 'password' || t === 'phone' || t === 'password-input') {
    if ($('input.govuk-input').length === 0) issues.push('No govuk input');
    if ($('label.govuk-label').length === 0) issues.push('Missing label');
    const input = $('input.govuk-input').first();
    const id = input.attr('id');
    if (!id) issues.push('Input missing id');
    if (id && $(`label.govuk-label[for="${id}"]`).length === 0) issues.push('Label not associated via for=');
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'textarea' || t === 'character-count') {
    if ($('textarea.govuk-textarea').length === 0 && $('.govuk-character-count').length === 0) issues.push('No textarea/character-count');
    const ta = $('textarea.govuk-textarea').first();
    if (ta && ta.length) {
      const id = ta.attr('id');
      if (!id) issues.push('Textarea missing id');
      if (id && $(`label.govuk-label[for="${id}"]`).length === 0) issues.push('Label not associated via for=');
    }
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'select') {
    if ($('select.govuk-select').length === 0) issues.push('No govuk select');
    const sel = $('select.govuk-select').first();
    const id = sel.attr('id');
    if (!id) issues.push('Select missing id');
    if (id && $(`label.govuk-label[for="${id}"]`).length === 0) issues.push('Label not associated via for=');
    if (expectOptions && $('select.govuk-select option').length === 0) issues.push('No options rendered');
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'date' || t === 'date-input') {
    if ($('.govuk-date-input').length === 0) issues.push('No govuk date-input');
    const base = $('.govuk-date-input');
    if (base.length) {
      const inputs = base.find('input');
      if (inputs.length < 3) issues.push('Date input missing parts');
    }
    if ($('.govuk-fieldset__legend').length === 0) issues.push('Missing fieldset legend');
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'file-upload') {
    if ($('input.govuk-file-upload[type="file"]').length === 0) issues.push('No file upload input');
    const fu = $('input.govuk-file-upload[type="file"]').first();
    const id = fu.attr('id');
    if (!id) issues.push('File upload missing id');
    if (id && $(`label.govuk-label[for="${id}"]`).length === 0) issues.push('Label not associated via for=');
    if (!hasFormGroup) issues.push('Missing .govuk-form-group');
  } else if (t === 'details') {
    if ($('details.govuk-details').length === 0) issues.push('No govuk details');
  } else if (t === 'accordion') {
    if ($('.govuk-accordion').length === 0) issues.push('No govuk accordion');
  } else if (t === 'label' || t === 'paragraph' || t === 'inset-text' || t === 'warning-text' || t === 'panel' || t === 'summary-list') {
    // Content components: best-effort checks
    // No strict checks beyond presence
  }
  return issues;
}

// GET /api/audit/parity-all?limit=50
// Iterate active component templates and report basic parity issues per type
app.get('/api/audit/parity-all', async (req, res) => {
  try {
    const limit = Math.max(0, parseInt(req.query.limit || '0', 10)) || null;
    const [rows] = await pool.query(
      `SELECT template_key, version, type, status, default_props, export_njk_template
         FROM iset_intake.component_template
        WHERE status='active'
        ORDER BY template_key, version DESC`
    );
    const seen = new Set();
    const list = [];
    for (const r of rows) {
      const key = r.template_key;
      if (seen.has(key)) continue; // take highest version per key
      seen.add(key);
      list.push(r);
      if (limit && list.length >= limit) break;
    }
    const results = [];
    for (const r of list) {
      let props = {};
      try { props = typeof r.default_props === 'string' ? JSON.parse(r.default_props) : (r.default_props || {}); } catch {}
      const t = String(r.type || '').toLowerCase();
      // Inject minimal props for structure checks if missing
      if (t === 'radio' || t === 'radios') {
        if (!props.fieldset) props.fieldset = { legend: { text: 'Choose one' } };
        if (!Array.isArray(props.items) || props.items.length === 0) props.items = [{ text: 'Option A', value: 'a' }, { text: 'Option B', value: 'b' }];
      } else if (t === 'checkbox' || t === 'checkboxes') {
        if (!props.fieldset) props.fieldset = { legend: { text: 'Select all that apply' } };
        if (!Array.isArray(props.items) || props.items.length === 0) props.items = [{ text: 'Alpha', value: 'a' }, { text: 'Beta', value: 'b' }];
      } else if (t === 'select') {
        if (!props.label) props.label = { text: 'Pick one' };
        if (!Array.isArray(props.items) || props.items.length === 0) props.items = [{ text: 'One', value: '1' }, { text: 'Two', value: '2' }];
      } else if (t === 'input' || t === 'text' || t === 'email' || t === 'number' || t === 'password' || t === 'phone' || t === 'password-input') {
        if (!props.label) props.label = { text: 'Label' };
      } else if (t === 'textarea' || t === 'character-count') {
        if (!props.label) props.label = { text: 'Label' };
      } else if (t === 'date' || t === 'date-input') {
        if (!props.fieldset) props.fieldset = { legend: { text: 'Date of birth' } };
      } else if (t === 'file-upload') {
        if (!props.label) props.label = { text: 'Upload a file' };
      } else if (t === 'paragraph') {
        if (!props.text) props.text = 'Paragraph text';
      }
      let issues = [];
      let renderError = null;
      try {
        const html = env.renderString(r.export_njk_template || '', { props });
        const $ = cheerio.load(html || '');
        issues = parityChecks($, r.type, props);
      } catch (e) {
        renderError = String(e.message || e).slice(0, 300);
      }
      results.push({
        template_key: r.template_key,
        version: r.version,
        type: r.type,
        ok: !renderError && issues.length === 0,
        issues,
        error: renderError,
      });
    }
    const summary = {
      total: results.length,
      ok: results.filter(x => x.ok).length,
      withIssues: results.filter(x => x.issues && x.issues.length).length,
      withErrors: results.filter(x => x.error).length,
      byType: Object.fromEntries(
        Array.from(new Set(results.map(r => String(r.type || '').toLowerCase())))
          .map(t => [t, {
            total: results.filter(r => String(r.type || '').toLowerCase() === t).length,
            ok: results.filter(r => String(r.type || '').toLowerCase() === t && r.ok).length,
          }])
      )
    };
    res.json({ summary, results });
  } catch (err) {
    console.error('GET /api/audit/parity-all failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/audit/parity-portal?templateKey=radios
// Compare NJK structure with a derived portal component shape for a single template
app.get('/api/audit/parity-portal', async (req, res) => {
  try {
    const { templateKey } = req.query;
    if (!templateKey) return res.status(400).json({ error: 'templateKey required' });
    const [[tpl]] = await pool.query(
      `SELECT template_key, version, type, default_props, export_njk_template
         FROM iset_intake.component_template
        WHERE template_key = ? AND status='active'
        ORDER BY version DESC
        LIMIT 1`,
      [templateKey]
    );
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    const props = (() => { try { return JSON.parse(tpl.default_props || '{}'); } catch { return {}; } })();
    // Render NJK
    let html = '';
    try { html = env.renderString(tpl.export_njk_template || '', { props }); } catch (e) {}
    const $ = cheerio.load(html || '');

    // Derive portal component shape (minimal)
    const tplType = String(tpl.type || '').toLowerCase();
    const normalisedType = (tplType === 'checkbox' ? 'checkboxes' : (tplType === 'radios' ? 'radio' : tplType));
    const labelText = props?.fieldset?.legend?.text ?? props?.label?.text ?? props?.titleText ?? '';
    const hintText = props?.hint?.text ?? props?.text ?? '';
    let options = [];
    if (['radio', 'radios', 'checkbox', 'checkboxes', 'select'].includes(tplType)) {
      const items = Array.isArray(props?.items) ? props.items : [];
      options = items.map(it => ({
        label: it?.text ?? it?.html ?? String(it?.value ?? ''),
        value: typeof it?.value !== 'undefined' ? it.value : (it?.text ?? it?.html ?? '')
      }));
    }
    const portal = {
      type: normalisedType,
      label: labelText,
      hint: hintText,
      optionsCount: options.length,
    };

    // NJK structural capture
    const struct = { container: null, inputsCount: 0, legendText: null };
    if (normalisedType === 'radio') {
      struct.container = $('.govuk-radios').length > 0;
      struct.inputsCount = $('input.govuk-radios__input[type="radio"]').length;
      struct.legendText = $('.govuk-fieldset__legend').first().text().trim() || null;
    } else if (normalisedType === 'checkboxes') {
      struct.container = $('.govuk-checkboxes').length > 0;
      struct.inputsCount = $('input.govuk-checkboxes__input[type="checkbox"]').length;
      struct.legendText = $('.govuk-fieldset__legend').first().text().trim() || null;
    } else if (normalisedType === 'select') {
      struct.container = $('select.govuk-select').length > 0;
      struct.inputsCount = $('select.govuk-select option').length;
      struct.legendText = $('label.govuk-label').first().text().trim() || null;
    } else if (normalisedType === 'input') {
      struct.container = $('input.govuk-input').length > 0;
      struct.inputsCount = $('input.govuk-input').length;
      struct.legendText = $('label.govuk-label').first().text().trim() || null;
    } else if (normalisedType === 'textarea') {
      struct.container = $('textarea.govuk-textarea').length > 0;
      struct.inputsCount = $('textarea.govuk-textarea').length;
      struct.legendText = $('label.govuk-label').first().text().trim() || null;
    } else if (normalisedType === 'date-input') {
      struct.container = $('.govuk-date-input').length > 0;
      struct.inputsCount = $('.govuk-date-input input').length;
      struct.legendText = $('.govuk-fieldset__legend').first().text().trim() || null;
    } else if (normalisedType === 'file-upload') {
      struct.container = $('input.govuk-file-upload[type="file"]').length > 0;
      struct.inputsCount = $('input.govuk-file-upload[type="file"]').length;
      struct.legendText = $('label.govuk-label').first().text().trim() || null;
    }

    // Issues
    const issues = [];
    // Expect a visible label/legend when props include it
    const expectsLabel = !!(props?.fieldset?.legend?.text || props?.label?.text || props?.titleText);
    if (normalisedType === 'radio' || normalisedType === 'checkboxes') {
      if (!struct.container) issues.push('Missing container');
      if (portal.optionsCount && struct.inputsCount && portal.optionsCount !== struct.inputsCount) {
        issues.push(`Input count mismatch: options=${portal.optionsCount} njk=${struct.inputsCount}`);
      }
      if (expectsLabel && (!struct.legendText || !struct.legendText.length)) {
        issues.push('Missing legend text');
      }
      if (portal.label && struct.legendText && struct.legendText.length && !struct.legendText.toLowerCase().includes(String(portal.label).toLowerCase())) {
        issues.push('Legend text does not include label');
      }
    } else if (['input','textarea','select','date-input','file-upload'].includes(normalisedType)) {
      if (!struct.container) issues.push('Missing core container element');
      if (normalisedType === 'select' && expectsLabel && (!struct.legendText || !struct.legendText.length)) {
        issues.push('Missing select label');
      }
      if (normalisedType === 'select' && portal.optionsCount && struct.inputsCount && portal.optionsCount !== struct.inputsCount) {
        issues.push(`Option count mismatch: options=${portal.optionsCount} njk=${struct.inputsCount}`);
      }
    }

    res.json({
      templateKey,
      type: tpl.type,
      portal,
      njk: struct,
      ok: issues.length === 0,
      issues,
    });
  } catch (err) {
    console.error('GET /api/audit/parity-portal failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Utility: resolve simple JSONPath-like strings used in prop_schema, e.g. "label.text", "items[0].value"
function getByPath(obj, path) {
  try {
    if (!path) return undefined;
    const tokens = path
      .replace(/\[(\d+)\]/g, '.$1') // items[0].value -> items.0.value
      .split('.')
      .filter(Boolean);
    return tokens.reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
  } catch {
    return undefined;
  }
}

// GET /api/audit/component-templates
// Optional query: ?limit=nn
app.get('/api/audit/component-templates', async (req, res) => {
  try {
    const limit = Math.max(0, parseInt(req.query.limit || '0', 10)) || null;
    const [rows] = await pool.query(
      `SELECT id, template_key, version, type, status,
              default_props, prop_schema, has_options, option_schema, export_njk_template
         FROM iset_intake.component_template
         ORDER BY template_key, version`
    );
    const slice = limit ? rows.slice(0, limit) : rows;

    const results = [];
    for (const r of slice) {
      const issues = [];
      let renderOk = false;
      let renderError = null;

      let props = {};
      try {
        props = typeof r.default_props === 'string' ? JSON.parse(r.default_props) : (r.default_props || {});
      } catch (e) {
        issues.push({ code: 'DEFAULT_PROPS_INVALID_JSON', detail: String(e).slice(0, 160) });
      }

      // Check prop_schema paths exist in default_props
      let schema = [];
      try {
        schema = typeof r.prop_schema === 'string' ? JSON.parse(r.prop_schema) : (r.prop_schema || []);
      } catch (e) {
        issues.push({ code: 'PROP_SCHEMA_INVALID_JSON', detail: String(e).slice(0, 160) });
      }
      const missingPaths = [];
      if (Array.isArray(schema)) {
        for (const fld of schema) {
          const pth = fld?.path;
          if (pth) {
            const val = getByPath(props, pth);
            if (typeof val === 'undefined') {
              missingPaths.push({ key: fld.key || null, path: pth });
            }
          }
        }
      }
      if (missingPaths.length) {
        issues.push({ code: 'PROP_SCHEMA_PATH_MISSING_IN_DEFAULTS', detail: missingPaths });
      }

      // Option sanity checks
      const itemsVal = getByPath(props, 'items');
      if (r.has_options) {
        if (!Array.isArray(itemsVal) || itemsVal.length === 0) {
          issues.push({ code: 'HAS_OPTIONS_BUT_NO_ITEMS', detail: 'has_options=1 but default_props.items missing/empty' });
        }
      }
      if ((r.type === 'radio' || r.type === 'checkboxes')) {
        const legendText = getByPath(props, 'fieldset.legend.text');
        if (!legendText) {
          issues.push({ code: 'FIELDSET_LEGEND_TEXT_MISSING', detail: 'fieldset.legend.text should exist for radios/checkboxes' });
        }
        if (!Array.isArray(itemsVal) || itemsVal.length === 0) {
          issues.push({ code: 'CHOICE_ITEMS_MISSING', detail: 'radios/checkboxes should define props.items[]' });
        }
      }

      // Render test (only if template present)
      if (!r.export_njk_template || !String(r.export_njk_template).trim()) {
        issues.push({ code: 'MISSING_TEMPLATE', detail: 'export_njk_template empty' });
      } else {
        try {
          // Render using real GOV.UK macros; macro imports live inside export_njk_template text.
          const html = env.renderString(r.export_njk_template, { props });
          if (!html || !html.trim()) {
            renderError = 'Empty HTML output';
          } else {
            renderOk = true;
          }
        } catch (e) {
          renderError = String(e && e.message ? e.message : e).slice(0, 300);
        }
      }
      if (renderError) {
        issues.push({ code: 'RENDER_ERROR', detail: renderError });
      }

      results.push({
        id: r.id,
        template_key: r.template_key,
        version: r.version,
        type: r.type,
        status: r.status,
        ok: issues.length === 0,
        warnings: issues.filter(i => i.code !== 'RENDER_ERROR' && i.code !== 'MISSING_TEMPLATE'),
        errors: issues.filter(i => i.code === 'RENDER_ERROR' || i.code === 'MISSING_TEMPLATE')
      });
    }

    const summary = {
      total: results.length,
      ok: results.filter(r => r.ok).length,
      withErrors: results.filter(r => r.errors.length).length,
      withWarnings: results.filter(r => r.warnings.length).length
    };
    res.json({ summary, results });
  } catch (err) {
    console.error('GET /api/audit/component-templates failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- helpers ---------------------------------------------------------------
function normaliseJson(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

// --- Steps API (DB-only, versioned component templates) --------------------
// List steps for the Workflow Editor's library
app.get('/api/steps', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, status
      FROM iset_intake.step
      ORDER BY name
    `);
    res.status(200).json(rows);
  } catch (err) {
    console.error('GET /api/steps failed:', err);
    res.status(500).json({ error: 'Failed to fetch steps' });
  }
});

// --- Workflow CRUD API -----------------------------------------------------
// Data model recap:
// - workflow(id, name, status)
// - workflow_step(workflow_id, step_id, is_start)
// - workflow_route(workflow_id, source_step_id, mode('linear'|'by_option'), field_key, default_next_step_id)
// - workflow_route_option(workflow_id, source_step_id, option_value, next_step_id)

// Helpers
async function stepsExist(stepIds, conn) {
  if (!Array.isArray(stepIds) || stepIds.length === 0) return true;
  const [rows] = await conn.query(
    `SELECT id FROM iset_intake.step WHERE id IN (${stepIds.map(() => '?').join(',')})`,
    stepIds
  );
  return rows.length === stepIds.length;
}

async function getWorkflowDetails(workflowId) {
  const [[wf]] = await pool.query(
    `SELECT id, name, status, created_at, updated_at
       FROM iset_intake.workflow
      WHERE id = ?`,
    [workflowId]
  );
  if (!wf) return null;

  const [steps] = await pool.query(
    `SELECT ws.step_id AS id, s.name, ws.is_start
       FROM iset_intake.workflow_step ws
       JOIN iset_intake.step s ON s.id = ws.step_id
      WHERE ws.workflow_id = ?
      ORDER BY s.name`,
    [workflowId]
  );

  const [routes] = await pool.query(
    `SELECT workflow_id, source_step_id, mode, field_key, default_next_step_id
       FROM iset_intake.workflow_route
      WHERE workflow_id = ?
      ORDER BY source_step_id`,
    [workflowId]
  );
  const [opts] = await pool.query(
    `SELECT workflow_id, source_step_id, option_value, next_step_id
       FROM iset_intake.workflow_route_option
      WHERE workflow_id = ?
      ORDER BY source_step_id, option_value`,
    [workflowId]
  );
  // Attach options to their route
  const routesOut = routes.map(r => ({ ...r, options: [] }));
  for (const o of opts) {
    const idx = routesOut.findIndex(r => r.source_step_id === o.source_step_id);
    if (idx >= 0) routesOut[idx].options.push({ option_value: o.option_value, next_step_id: o.next_step_id });
  }

  return { ...wf, steps, routes: routesOut };
}

// List workflows
app.get('/api/workflows', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, status, created_at, updated_at
         FROM iset_intake.workflow
        ORDER BY updated_at DESC, id DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('GET /api/workflows failed:', err);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// Get a single workflow with steps and routes
app.get('/api/workflows/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const wf = await getWorkflowDetails(id);
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });
    res.status(200).json(wf);
  } catch (err) {
    console.error('GET /api/workflows/:id failed:', err);
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
});

// Create workflow
// Body: { name: string, status?: 'draft'|'active'|'inactive', steps: number[], start_step_id: number, routes?: [ { source_step_id, mode, field_key?, default_next_step_id?, options?: [{ option_value, next_step_id }] } ] }
app.post('/api/workflows', async (req, res) => {
  const { name, status = 'draft', steps = [], start_step_id = null, routes = [] } = req.body || {};
  if (!name || !Array.isArray(steps) || steps.length === 0 || !start_step_id) {
    return res.status(400).json({ error: 'name, steps[], and start_step_id are required' });
  }
  if (!steps.includes(start_step_id)) {
    return res.status(400).json({ error: 'start_step_id must be included in steps[]' });
  }
  try {
    const newId = await withTx(async (conn) => {
      if (!(await stepsExist(steps, conn))) {
        throw Object.assign(new Error('One or more step IDs are invalid'), { code: 400 });
      }
      const [ins] = await conn.query(
        `INSERT INTO iset_intake.workflow (name, status) VALUES (?, ?)`,
        [name, status]
      );
      const workflowId = ins.insertId;

      // Insert membership and start flag
      const wsValues = steps.map(stepId => [workflowId, stepId, stepId === start_step_id ? 1 : 0]);
      await conn.query(
        `INSERT INTO iset_intake.workflow_step (workflow_id, step_id, is_start) VALUES ?`,
        [wsValues]
      );

      // Insert routes
      if (Array.isArray(routes) && routes.length) {
        // Basic validation
        for (const r of routes) {
          if (!r || !r.source_step_id || !r.mode) {
            throw Object.assign(new Error('Each route requires source_step_id and mode'), { code: 400 });
          }
          if (r.mode === 'by_option' && !r.field_key) {
            throw Object.assign(new Error('by_option routes require field_key'), { code: 400 });
          }
        }
        const routeValues = routes.map(r => [workflowId, r.source_step_id, r.mode, r.field_key || null, r.default_next_step_id || null]);
        await conn.query(
          `INSERT INTO iset_intake.workflow_route (workflow_id, source_step_id, mode, field_key, default_next_step_id)
           VALUES ?`,
          [routeValues]
        );

        // Route options
        const optValues = [];
        for (const r of routes) {
          if (Array.isArray(r.options) && r.options.length) {
            for (const o of r.options) {
              if (!o || !o.option_value || !o.next_step_id) {
                throw Object.assign(new Error('route option requires option_value and next_step_id'), { code: 400 });
              }
              optValues.push([workflowId, r.source_step_id, String(o.option_value), o.next_step_id]);
            }
          }
        }
        if (optValues.length) {
          await conn.query(
            `INSERT INTO iset_intake.workflow_route_option (workflow_id, source_step_id, option_value, next_step_id)
             VALUES ?`,
            [optValues]
          );
        }
      }

      return workflowId;
    });
    res.status(201).json({ id: newId });
  } catch (err) {
    if (err.code === 400) return res.status(400).json({ error: err.message });
    console.error('POST /api/workflows failed:', err);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// Update workflow
// Body: { name?: string, status?: string, steps?: number[], start_step_id?: number, routes?: [...] }
app.put('/api/workflows/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status, steps, start_step_id, routes } = req.body || {};
  try {
    await withTx(async (conn) => {
      // ensure workflow exists
      const [[wf]] = await conn.query(`SELECT id FROM iset_intake.workflow WHERE id = ?`, [id]);
      if (!wf) throw Object.assign(new Error('Workflow not found'), { code: 404 });

      if (name != null || status != null) {
        await conn.query(
          `UPDATE iset_intake.workflow SET
             name = COALESCE(?, name),
             status = COALESCE(?, status)
           WHERE id = ?`,
          [name ?? null, status ?? null, id]
        );
      }

      if (Array.isArray(steps)) {
        if (steps.length === 0) throw Object.assign(new Error('steps[] cannot be empty'), { code: 400 });
        const startId = start_step_id ?? null;
        if (startId && !steps.includes(startId)) {
          throw Object.assign(new Error('start_step_id must be in steps[]'), { code: 400 });
        }
        if (!(await stepsExist(steps, conn))) {
          throw Object.assign(new Error('One or more step IDs are invalid'), { code: 400 });
        }
        await conn.query(`DELETE FROM iset_intake.workflow_step WHERE workflow_id = ?`, [id]);
        const values = steps.map(stepId => [id, stepId, startId ? (stepId === startId ? 1 : 0) : 0]);
        await conn.query(
          `INSERT INTO iset_intake.workflow_step (workflow_id, step_id, is_start) VALUES ?`,
          [values]
        );
      } else if (start_step_id != null) {
        // Only update start flag
        await conn.query(`UPDATE iset_intake.workflow_step SET is_start = 0 WHERE workflow_id = ?`, [id]);
        await conn.query(`UPDATE iset_intake.workflow_step SET is_start = 1 WHERE workflow_id = ? AND step_id = ?`, [id, start_step_id]);
      }

      if (Array.isArray(routes)) {
        // Replace routes
        await conn.query(`DELETE FROM iset_intake.workflow_route_option WHERE workflow_id = ?`, [id]);
        await conn.query(`DELETE FROM iset_intake.workflow_route WHERE workflow_id = ?`, [id]);
        if (routes.length) {
          for (const r of routes) {
            if (!r || !r.source_step_id || !r.mode) {
              throw Object.assign(new Error('Each route requires source_step_id and mode'), { code: 400 });
            }
            if (r.mode === 'by_option' && !r.field_key) {
              throw Object.assign(new Error('by_option routes require field_key'), { code: 400 });
            }
          }
          const routeValues = routes.map(r => [id, r.source_step_id, r.mode, r.field_key || null, r.default_next_step_id || null]);
          await conn.query(
            `INSERT INTO iset_intake.workflow_route (workflow_id, source_step_id, mode, field_key, default_next_step_id)
             VALUES ?`,
            [routeValues]
          );
          const optValues = [];
          for (const r of routes) {
            if (Array.isArray(r.options) && r.options.length) {
              for (const o of r.options) {
                if (!o || !o.option_value || !o.next_step_id) {
                  throw Object.assign(new Error('route option requires option_value and next_step_id'), { code: 400 });
                }
                optValues.push([id, r.source_step_id, String(o.option_value), o.next_step_id]);
              }
            }
          }
          if (optValues.length) {
            await conn.query(
              `INSERT INTO iset_intake.workflow_route_option (workflow_id, source_step_id, option_value, next_step_id)
               VALUES ?`,
              [optValues]
            );
          }
        }
      }
    });
    res.status(200).json({ id, message: 'Workflow updated' });
  } catch (err) {
    if (err.code === 404) return res.status(404).json({ error: 'Workflow not found' });
    if (err.code === 400) return res.status(400).json({ error: err.message });
    console.error('PUT /api/workflows/:id failed:', err);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// Delete workflow (cascade removes children via FK)
app.delete('/api/workflows/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [r] = await pool.query(`DELETE FROM iset_intake.workflow WHERE id = ?`, [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Workflow not found' });
    res.status(200).json({ message: 'Workflow deleted' });
  } catch (err) {
    console.error('DELETE /api/workflows/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// --- Publish workflow to Public Portal (v1: immediate push) -----------------
// This builds a self-contained JSON array of steps (bilingual titles/descriptions only for now),
// supporting linear and single-field option-based routing, and writes it to the portal project.
// Target file (dev): ../ISET-intake/src/intakeFormSchema.json relative to this server file.
app.post('/api/workflows/:id/publish', async (req, res) => {
  const { id } = req.params;
  try {
    // Load workflow basic
    const [[wf]] = await pool.query(`SELECT id, name, status FROM iset_intake.workflow WHERE id = ?`, [id]);
    if (!wf) return res.status(404).json({ error: 'Workflow not found' });

    // Load steps
    const [stepRows] = await pool.query(`
      SELECT s.id AS step_id, s.name AS step_name, ws.is_start
      FROM iset_intake.workflow_step ws
      JOIN iset_intake.step s ON s.id = ws.step_id
      WHERE ws.workflow_id = ?
    `, [id]);

    // Load routes
    const [routeRows] = await pool.query(`
      SELECT workflow_id, source_step_id, mode, field_key, default_next_step_id
      FROM iset_intake.workflow_route WHERE workflow_id = ?
    `, [id]);
    const [optRows] = await pool.query(`
      SELECT workflow_id, source_step_id, option_value, next_step_id
      FROM iset_intake.workflow_route_option WHERE workflow_id = ?
    `, [id]);

    // Build route map per source step
    const bySrc = new Map();
    for (const r of routeRows) bySrc.set(r.source_step_id, { ...r, options: [] });
    for (const o of optRows) {
      const r = bySrc.get(o.source_step_id) || { options: [] };
      r.options = r.options || [];
      r.options.push({ option_value: String(o.option_value), next_step_id: o.next_step_id });
      bySrc.set(o.source_step_id, r);
    }

    // Generate human-readable slugs per step name, unique within the workflow
    const slugCounts = new Map();
    const slugMap = new Map(); // step_id -> slug
    function toSlug(name) {
      const base = String(name || 'step').toLowerCase().normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'step';
      const cnt = (slugCounts.get(base) || 0) + 1;
      slugCounts.set(base, cnt);
      return cnt === 1 ? base : `${base}-${cnt}`;
    }
    for (const s of stepRows) {
      slugMap.set(s.step_id, toSlug(s.step_name));
    }

    // BFS from start to get a stable order (start first)
    const idSet = new Set(stepRows.map(s => s.step_id));
    const start = stepRows.find(s => s.is_start) || stepRows[0] || null;
    const adj = new Map();
    for (const s of stepRows) adj.set(s.step_id, []);
    for (const r of routeRows) {
      if (r.mode === 'linear' && r.default_next_step_id && idSet.has(r.default_next_step_id)) {
        adj.get(r.source_step_id)?.push(r.default_next_step_id);
      } else if (r.mode === 'by_option') {
        const opts = (bySrc.get(r.source_step_id)?.options) || [];
        for (const o of opts) if (idSet.has(o.next_step_id)) adj.get(r.source_step_id)?.push(o.next_step_id);
        if (r.default_next_step_id && idSet.has(r.default_next_step_id)) adj.get(r.source_step_id)?.push(r.default_next_step_id);
      }
    }
    const order = [];
    const seen = new Set();
    if (start) {
      const q = [start.step_id];
      seen.add(start.step_id);
      while (q.length) {
        const u = q.shift();
        order.push(u);
        for (const v of adj.get(u) || []) {
          if (!seen.has(v)) { seen.add(v); q.push(v); }
        }
      }
    }
    // Append any disconnected nodes
    for (const s of stepRows) if (!seen.has(s.step_id)) order.push(s.step_id);

    // Helper: safe JSON parse
    const safeParse = (v, fallback) => {
      if (v == null) return fallback;
      if (typeof v === 'object') return v;
      try { return JSON.parse(v); } catch { return fallback; }
    };
    // Helper: deep merge defaults <- overrides
    const deepMerge = (a, b) => {
      if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
      if (a && typeof a === 'object' && b && typeof b === 'object') {
        const out = { ...a };
        for (const k of Object.keys(b)) {
          out[k] = deepMerge(a[k], b[k]);
        }
        return out;
      }
      return b ?? a;
    };
    // Helper: generate component ID slug unique per step
    const toIdSlug = (label, type, index, used) => {
      const base = (String(label || `${type}-${index+1}`) || 'field').toLowerCase().normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `${type}-${index+1}`;
      let cand = base || `${type}-${index+1}`;
      let i = 2;
      while (used.has(cand)) { cand = `${base}-${i++}`; }
      used.add(cand);
      return cand;
    };
    // Helper: infer normalize rule
    const inferNormalize = (tplType, props, options) => {
      const tRaw = String(tplType || '').toLowerCase();
      const t = (tRaw === 'checkbox' ? 'checkboxes' : (tRaw === 'radios' ? 'radio' : tRaw));
      if (t === 'date' || t === 'date-input') return 'date-iso';
      if (t === 'number') return 'number';
      if (t === 'input') {
        const it = String(props?.type || '').toLowerCase();
        if (it === 'number') return 'number';
        if (it === 'email') return 'trim';
        return 'trim';
      }
      if (t === 'textarea' || t === 'text') return 'trim';
      if ((t === 'radio' || t === 'select') && Array.isArray(options) && options.length) {
        const vals = options.map(o => o.value);
        const allNum = vals.every(v => typeof v === 'number' || (/^-?\d+(?:\.\d+)?$/).test(String(v)));
        if (allNum) return 'number';
        const lc = vals.map(v => String(v).toLowerCase());
        const allYN = lc.every(v => v === 'yes' || v === 'no' || v === 'true' || v === 'false');
        if (allYN) return 'yn-01';
      }
      return 'none';
    };

  // Build portal JSON with components mapped from DB templates
  const usedTemplateIds = new Set();
  const usedTemplateCounts = new Map();
  const usedTemplateMeta = new Map();
    const stepsOut = [];
    const slugify = (s) => (String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')) || '';
    const placeholderNames = new Set(['example-radio', 'first-name', 'last-name', 'input', 'text-input', 'field', 'checkboxes', 'radio']);
    for (const stepId of order) {
      const row = stepRows.find(s => s.step_id === stepId);
      const route = bySrc.get(stepId) || null;
      const stepSlug = slugMap.get(stepId);
      const out = {
        stepId: stepSlug,
        type: 'schema',
        title: { en: row?.step_name || 'Step', fr: row?.step_name || 'Step' },
        description: { en: '', fr: '' },
        components: []
      };

      // Attach routing
      if (route) {
        if (route.mode === 'linear') {
          if (route.default_next_step_id && slugMap.get(route.default_next_step_id)) {
            out.nextStepId = slugMap.get(route.default_next_step_id);
          }
        } else if (route.mode === 'by_option') {
          const rules = [];
          for (const o of (route.options || [])) {
            const tgt = slugMap.get(o.next_step_id);
            if (!tgt) continue;
            rules.push({
              condition: { '==': [ { var: route.field_key || '' }, String(o.option_value) ] },
              nextStepId: tgt
            });
          }
          if (rules.length) out.branching = rules;
          if (route.default_next_step_id && slugMap.get(route.default_next_step_id)) {
            out.defaultNextStepId = slugMap.get(route.default_next_step_id);
          }
        }
      }

      // Load components for this step and map to portal shape
      const [compRows] = await pool.query(
        `SELECT sc.position, ct.id AS template_id, ct.version AS template_version, ct.type AS tpl_type, ct.default_props, sc.props_overrides, ct.template_key
           FROM iset_intake.step_component sc
           JOIN iset_intake.component_template ct ON ct.id = sc.template_id
          WHERE sc.step_id = ?
          ORDER BY sc.position`,
        [stepId]
      );

      const usedIds = new Set();
      for (let i = 0; i < compRows.length; i++) {
        const c = compRows[i];
  const defaults = safeParse(c.default_props, {});
        const overrides = safeParse(c.props_overrides, {});
        const props = deepMerge(defaults || {}, overrides || {});
        const tplType = (c.tpl_type || '').toLowerCase();

  // Track used templates for audit and meta
  usedTemplateIds.add(c.template_id);
  const tKey = c.template_key || 'unknown';
  const tVer = Number(c.template_version) || 0;
  const tType = tplType;
  const k = `${tKey}@${tVer}`;
  const cnt = (usedTemplateCounts.get(k) || 0) + 1;
  usedTemplateCounts.set(k, cnt);
  usedTemplateMeta.set(k, { id: c.template_id, template_key: tKey, version: tVer, type: tType });

        // M6: Validate supported component types; block publish if unsupported
        const candidateTypes = new Set([
          tplType,
          // Common macro-to-portal aliases
          tplType === 'checkbox' ? 'checkboxes' : null,
          tplType === 'radios' ? 'radio' : null,
          tplType === 'date' ? 'date-input' : null,
        ].filter(Boolean));
        const isSupported = Array.from(candidateTypes).some(t => SUPPORTED_COMPONENT_TYPES.has(t));
        if (!isSupported) {
          const reason = `Unsupported component type: '${tplType}' (template_key=${c.template_key || 'n/a'})`;
          const err = new Error(reason);
          err.code = 400;
          err.details = { step: row?.step_name, step_id: stepId, position: i + 1, template_key: c.template_key, type: tplType };
          throw err;
        }

  // Extract label/hint based on GOV.UK macro conventions
  const labelText = props?.fieldset?.legend?.text ?? props?.label?.text ?? props?.titleText ?? '';
  const hintText = props?.hint?.text ?? props?.text ?? '';
        // Helper: flatten bilingual values (supports { en, fr } or plain strings)
        const asLang = (v, lang) => {
          if (v && typeof v === 'object') {
            const val = v[lang] ?? v.en ?? v.fr;
            return typeof val === 'string' ? val : (val == null ? '' : String(val));
          }
          return v == null ? '' : String(v);
        };
        const labelEn = asLang(labelText, 'en');
        const labelFr = asLang(labelText, 'fr') || labelEn;
        const hintEn = asLang(hintText, 'en');
        const hintFr = asLang(hintText, 'fr') || hintEn;

  // Extract options for choice components (handle aliases)
  let options = null;
  if (tplType === 'radio' || tplType === 'radios' || tplType === 'checkbox' || tplType === 'checkboxes' || tplType === 'select') {
          const items = Array.isArray(props?.items) ? props.items : [];
          options = items.map(it => ({
            label: it?.text ?? it?.html ?? String(it?.value ?? ''),
            value: typeof it?.value !== 'undefined' ? it.value : (it?.text ?? it?.html ?? '')
          }));
        }

        // Storage key precedence (first match wins):
        // 1) route.field_key (when routing by option)
        // 2) props.fieldName (aliases: field_name, fieldname)
        // 3) props.name
        // 4) props.id (if not a placeholder like input-1)
        // 5) slugified label
        const labelSlug = slugify(labelText || `${tplType || 'field'}-${i+1}`);
        const routeField = route && route.mode === 'by_option' ? (route.field_key || '').trim() : '';
        const fieldNameProp = (props?.fieldName || props?.field_name || props?.fieldname || '').toString().trim();
        const nameProp = (props?.name || '').toString().trim();
        const idProp = (props?.id || '').toString().trim();
        let chosenKey = '';
        if (routeField) {
          chosenKey = routeField; // enforce alignment with routing var
        } else if (fieldNameProp) {
          chosenKey = fieldNameProp;
        } else if (nameProp) {
          chosenKey = nameProp;
        } else if (idProp && !placeholderNames.has(idProp.toLowerCase())) {
          chosenKey = idProp;
        } else {
          chosenKey = labelSlug;
        }
        // Final guard: if chosenKey somehow resolves to a placeholder, fall back to labelSlug
        if (!chosenKey || placeholderNames.has(chosenKey.toLowerCase())) {
          chosenKey = labelSlug;
        }
        const id = toIdSlug(chosenKey || labelSlug, tplType || 'field', i, usedIds);

        // Special-case: content-only components
        // 1) Text block (paragraph)
        if (tplType === 'paragraph' || c.template_key === 'text-block') {
          // Treat as a simple paragraph with provided text and optional classes
          const paraText = props?.text ?? labelText ?? '';
          const paraHint = '';
          out.components.push({
            id: toIdSlug('paragraph', 'paragraph', i, usedIds),
            type: 'paragraph',
            text: { en: asLang(paraText, 'en'), fr: asLang(paraText, 'fr') },
            class: props?.classes || undefined,
            // paragraphs are not required and have no storage
          });
          continue;
        }
        // 2) Inset text
        if (tplType === 'inset-text') {
          const txt = props?.text ?? hintText ?? labelText ?? '';
          out.components.push({
            id: toIdSlug('inset-text', 'inset-text', i, usedIds),
            type: 'inset-text',
            text: { en: asLang(txt, 'en'), fr: asLang(txt, 'fr') },
          });
          continue;
        }
        // 3) Warning text
        if (tplType === 'warning-text') {
          const txt = props?.text ?? hintText ?? labelText ?? '';
          out.components.push({
            id: toIdSlug('warning-text', 'warning-text', i, usedIds),
            type: 'warning-text',
            text: { en: asLang(txt, 'en'), fr: asLang(txt, 'fr') },
          });
          continue;
        }

        // Map to portal component shape
        // Normalise type for the portal renderer
        const normalisedType = (
          tplType === 'checkbox' ? 'checkboxes' :
          tplType === 'radios' ? 'radio' :
          tplType
        );
  const component = {
          id,
          type: normalisedType,
          label: { en: labelEn || id, fr: labelFr || labelEn || id },
          hint: (hintEn || hintFr) ? { en: hintEn, fr: hintFr } : undefined,
          class: props?.classes || undefined,
          required: !!props?.required,
          // storageKey: prefer chosenKey (aligned with routing if applicable)
          storageKey: chosenKey || id,
        };

        // Carry a few useful extras when present (non-breaking for the portal renderer)
        if (tplType === 'input') {
          if (props?.type) component.inputType = props.type;
          if (props?.autocomplete) component.autocomplete = props.autocomplete;
          if (props?.inputmode || props?.inputMode) component.inputMode = props.inputmode || props.inputMode;
          if (props?.pattern) component.pattern = props.pattern;
          if (typeof props?.spellcheck !== 'undefined') component.spellcheck = !!props.spellcheck;
          if (typeof props?.disabled !== 'undefined') component.disabled = !!props.disabled;
          // Prefix/suffix support from GOV.UK macro
          if (props?.prefix && (props.prefix.text || props.prefix.html)) {
            component.prefix = {
              text: props.prefix.text || props.prefix.html,
              classes: props.prefix.classes || undefined
            };
          }
          if (props?.suffix && (props.suffix.text || props.suffix.html)) {
            component.suffix = {
              text: props.suffix.text || props.suffix.html,
              classes: props.suffix.classes || undefined
            };
          }
          // Allow appending additional describedBy ids
          const describedExtra = props?.describedBy || props?.describedby || '';
          if (describedExtra) component.extraDescribedBy = String(describedExtra);
          // Form group classes passthrough
          if (props?.formGroup && props.formGroup.classes) component.formGroupClass = props.formGroup.classes;
        }
  if (tplType === 'date-input') {
          if (props?.namePrefix) component.namePrefix = props.namePrefix;
          if (Array.isArray(props?.items)) {
            component.dateFields = props.items.map(f => ({ name: f?.name, classes: f?.classes })).filter(f => f.name);
          }
        }
  if (options) {
    // Preserve per-item id if provided in template props.items[].id
    const srcItems = Array.isArray(props?.items) ? props.items : [];
    component.options = options.map((o, idx) => {
      const src = srcItems[idx] || {};
      return src && src.id ? { ...o, id: String(src.id) } : o;
    });
  }
  // Radios/checkboxes: allow explicit name/idPrefix overrides if provided
  if ((tplType === 'radio' || tplType === 'radios' || tplType === 'checkbox' || tplType === 'checkboxes') && props) {
    if (props.name) component.name = String(props.name);
    if (props.idPrefix || props.id_prefix) component.idPrefix = String(props.idPrefix || props.id_prefix);
  }
  // Infer normalize (preserve any earlier explicit)
  const inferred = inferNormalize(tplType, props, options || []);
  component.normalize = component.normalize && component.normalize !== 'none' ? component.normalize : inferred;

        out.components.push(component);
      }

      stepsOut.push(out);
    }

    // M9: Audit used component templates before writing
    try {
      if (usedTemplateIds.size) {
        const ids = Array.from(usedTemplateIds);
        const [tpls] = await pool.query(
          `SELECT id, template_key, version, type, export_njk_template, default_props, status
             FROM iset_intake.component_template
            WHERE id IN (${Array(ids.length).fill('?').join(',')})`,
          ids
        );
        const bad = [];
        for (const r of tpls) {
          if (!r.export_njk_template || !String(r.export_njk_template).trim()) {
            bad.push({ template_key: r.template_key, version: r.version, reason: 'MISSING_TEMPLATE' });
            continue;
          }
          try {
            const p = typeof r.default_props === 'string' ? JSON.parse(r.default_props) : (r.default_props || {});
            env.renderString(r.export_njk_template, { props: p });
          } catch (e) {
            bad.push({ template_key: r.template_key, version: r.version, reason: 'RENDER_ERROR', detail: String(e.message || e).slice(0, 200) });
          }
        }
        if (bad.length) {
          const err = new Error('Template audit failed');
          err.code = 400;
          err.details = { templates: bad };
          throw err;
        }
      }
    } catch (e) {
      throw e;
    }

    // Write to Public Portal file (primary artifact remains a plain array for backward compatibility)
    const portalPath = path.resolve(__dirname, '..', 'ISET-intake', 'src', 'intakeFormSchema.json');
    fs.writeFileSync(portalPath, JSON.stringify(stepsOut, null, 2), 'utf8');

    // Also write a sidecar metadata file with schema versioning and build details (non-breaking)
    // Build template catalog for meta
    const templates = Array.from(usedTemplateCounts.keys()).map(k => ({
      ...(usedTemplateMeta.get(k) || {}),
      count: usedTemplateCounts.get(k) || 0,
    }));
    const meta = {
      schemaVersion: '1.1',
      generatedAt: new Date().toISOString(),
      workflow: { id: wf.id, name: wf.name, status: wf.status },
      counts: {
        steps: stepsOut.length,
        components: stepsOut.reduce((acc, s) => acc + (Array.isArray(s.components) ? s.components.length : 0), 0)
      },
      templates
    };
    const metaPath = path.resolve(__dirname, '..', 'ISET-intake', 'src', 'intakeFormSchema.meta.json');
    try {
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to write workflow schema meta file:', e && e.message ? e.message : e);
    }

    res.status(200).json({ message: 'Published', portalPath, steps: stepsOut.length, metaPath });
  } catch (err) {
    if (err && err.code === 400) {
      const payload = { error: err.message || 'Validation failed' };
      if (err.details) payload.details = err.details;
      return res.status(400).json(payload);
    }
    console.error('Publish failed:', err);
    res.status(500).json({ error: 'Failed to publish workflow' });
  }
});

// --- Component Templates API (for Step Editor library) ---------------------
// Returns the catalogue of reusable component templates (active only by default)
app.get('/api/component-templates', async (req, res) => {
  try {
    const onlyActive = (req.query.status ?? 'active') === 'active';
    const where = onlyActive ? "WHERE status = 'active'" : '';
    const [rows] = await pool.query(`
      SELECT
        id,
        template_key,
        version,
        type,
        label,
        description,
        default_props,
        prop_schema,
        has_options,
        option_schema,
        status
      FROM iset_intake.component_template
      ${where}
      ORDER BY label, template_key, version
    `);
    // When only active templates are requested, return only the highest version per template_key to avoid duplicates
    let filtered = rows;
    if (onlyActive) {
      const byKey = new Map();
      for (const r of rows) {
        const k = r.template_key;
        const prev = byKey.get(k);
        if (!prev || Number(r.version) > Number(prev.version)) byKey.set(k, r);
      }
      filtered = Array.from(byKey.values());
    }
    // parse JSON safely locally (don't rely on other helpers for forward compatibility)
    const parseJson = v => {
      if (v == null) return null;
      if (typeof v === 'object') return v; // already parsed
      try { return JSON.parse(v); } catch { return null; }
    };
    // Sanitize defaults for input-like components to avoid default error state
    const stripClasses = (cls, toRemove) => (String(cls || '')
      .split(/\s+/)
      .filter(c => c && !toRemove.includes(c))
      .join(' '));
    const out = filtered.map(r => {
      const propsRaw = parseJson(r.default_props) ?? {};
      const t = String(r.type || '').toLowerCase();
    if (['input', 'text', 'email', 'number', 'password', 'phone', 'password-input'].includes(t)) {
        try {
          if (propsRaw && typeof propsRaw === 'object') {
            // Remove error classes from formGroup/classes
            if (propsRaw.formGroup && typeof propsRaw.formGroup === 'object') {
              propsRaw.formGroup.classes = stripClasses(propsRaw.formGroup.classes, ['govuk-form-group--error']);
            }
            propsRaw.classes = stripClasses(propsRaw.classes, ['govuk-input--error']);
    // Keep any errorMessage defined by author; UI may choose to show or ignore
            // Alternative defaults requested by authoring UX
            // 1) Label classes -> 'govuk-label--m' if not provided
            if (!propsRaw.label || typeof propsRaw.label !== 'object') {
              propsRaw.label = { text: (propsRaw.label && propsRaw.label.text) || 'Label', classes: 'govuk-label--m' };
            } else if (!propsRaw.label.classes || String(propsRaw.label.classes).trim() === '') {
              propsRaw.label.classes = 'govuk-label--m';
            }
            // 2) Hint default text when missing or empty
            const hintText = propsRaw?.hint?.text;
            if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !String(hintText || '').trim()) {
              propsRaw.hint = { ...(propsRaw.hint || {}), text: 'This is the optional hint text' };
            }
          }
        } catch (_) {}
        } else if (t === 'paragraph') {
          try {
            if (propsRaw && typeof propsRaw === 'object') {
              if (!propsRaw.text) propsRaw.text = 'Paragraph text';
              if (!propsRaw.classes) propsRaw.classes = 'govuk-body';
            }
          } catch (_) {}
        }
      return {
        id: r.id,
        key: r.template_key,
        version: r.version,
        type: r.type,
        label: r.label,
        description: r.description ?? null,
        props: propsRaw,
        editable_fields: parseJson(r.prop_schema) ?? [],
        has_options: !!r.has_options,
        option_schema: parseJson(r.option_schema) ?? null,
        status: r.status
      };
    });
    res.status(200).json(out);
  } catch (err) {
    console.error('GET /api/component-templates failed:', err);
    res.status(500).json({ error: 'Failed to fetch component templates' });
  }
});

// Step detail with composed components (ordered)
app.get('/api/steps/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [[step]] = await pool.query(
      `SELECT id, name, status, ui_meta FROM iset_intake.step WHERE id = ?`,
      [id]
    );
    if (!step) return res.status(404).json({ error: 'Step not found' });

    const [components] = await pool.query(
      `SELECT
         sc.id,
         sc.position,
         sc.template_id,
         ct.template_key,
         ct.version,
         sc.props_overrides
       FROM iset_intake.step_component sc
       JOIN iset_intake.component_template ct ON ct.id = sc.template_id
       WHERE sc.step_id = ?
       ORDER BY sc.position`,
      [id]
    );

    const mapped = components.map(c => ({
      id: c.id,
      position: c.position,
      templateId: c.template_id,
      templateKey: c.template_key,
      templateVersion: c.version,
      props: normaliseJson(c.props_overrides)
    }));

    res.status(200).json({
      id: step.id,
      name: step.name,
      status: step.status,
      ui_meta: normaliseJson(step.ui_meta),
      components: mapped
    });
  } catch (err) {
    console.error('GET /api/steps/:id failed:', err);
    res.status(500).json({ error: 'Failed to fetch step' });
  }
});

// --- helpers for transactional writes --------------------------------------
async function withTx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

// Resolve component template references: supports templateId or template_key
async function resolveTemplateIds(components, conn) {
  // Collect missing IDs keyed by template_key
  const missingKeys = Array.from(new Set(
    components
      .filter(c => !c || typeof c !== 'object')
      .map(() => null)
  ));
  const keys = Array.from(new Set(
    components
      .filter(c => c && !c.templateId && c.template_key)
      .map(c => String(c.template_key))
  ));

  const map = new Map();
  if (keys.length) {
    const [rows] = await conn.query(
      `SELECT id, template_key, version
       FROM iset_intake.component_template
       WHERE status='active' AND template_key IN (${keys.map(() => '?').join(',')})
       ORDER BY template_key, version DESC`,
      keys
    );
    // take highest version per key
    for (const row of rows) {
      if (!map.has(row.template_key)) map.set(row.template_key, row.id);
    }
  }

  return components.map((c, i) => {
    if (!c || typeof c !== 'object') {
      throw Object.assign(new Error(`Invalid component at index ${i}`), { code: 400 });
    }
    const templateId = c.templateId || map.get(c.template_key) || null;
    if (!templateId) {
      throw Object.assign(new Error(`Missing template reference for component at index ${i}`), { code: 400 });
    }
    return {
      templateId: Number(templateId),
      props: c.props ? (typeof c.props === 'string' ? normaliseJson(c.props) : c.props) : null
    };
  });
}

// --- Create a new step ------------------------------------------------------
// Body: { name: string, status: 'active'|'inactive', components: [{ templateId:number|, template_key?:string, props?:object }], ui_meta?: any }
app.post('/api/steps', async (req, res) => {
  const { name, status = 'active', components = [], ui_meta = null } = req.body || {};
  if (!name || !Array.isArray(components)) {
    return res.status(400).json({ error: 'name and components[] are required' });
  }
  try {
    const stepId = await withTx(async (conn) => {
      const [r] = await conn.query(
        `INSERT INTO iset_intake.step (name, status, ui_meta) VALUES (?,?,?)`,
        [name, status, ui_meta ? JSON.stringify(ui_meta) : null]
      );
      const newId = r.insertId;
      if (components.length) {
        const resolved = await resolveTemplateIds(components, conn);
        const values = resolved.map((c, i) => [
          newId,
          i + 1,
          c.templateId,
          c.props ? JSON.stringify(c.props) : null,
        ]);
        await conn.query(
          `INSERT INTO iset_intake.step_component (step_id, position, template_id, props_overrides)
           VALUES ?`,
          [values]
        );
      }
      return newId;
    });
    res.status(201).json({ id: stepId });
  } catch (err) {
    if (err.code === 400) return res.status(400).json({ error: err.message });
    console.error('POST /api/steps failed:', err);
    res.status(500).json({ error: 'Failed to create step' });
  }
});

// --- Update a step (replace components) -------------------------------------
// Body: { name?: string, status?: string, components?: [{ templateId|template_key, props }], ui_meta?: any }
app.put('/api/steps/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status, components, ui_meta } = req.body || {};
  try {
    await withTx(async (conn) => {
      // ensure step exists
      const [[exists]] = await conn.query(
        `SELECT id FROM iset_intake.step WHERE id = ?`,
        [id]
      );
      if (!exists) throw Object.assign(new Error('Not found'), { code: 404 });

      if (name != null || status != null || typeof ui_meta !== 'undefined') {
        await conn.query(
          `UPDATE iset_intake.step SET
             name = COALESCE(?, name),
             status = COALESCE(?, status),
             ui_meta = ?
           WHERE id = ?`,
          [
            name ?? null,
            status ?? null,
            typeof ui_meta === 'undefined' ? null : JSON.stringify(ui_meta),
            id
          ]
        );
      }

      if (Array.isArray(components)) {
        // replace all components atomically
        await conn.query(`DELETE FROM iset_intake.step_component WHERE step_id = ?`, [id]);
        if (components.length) {
          const resolved = await resolveTemplateIds(components, conn);
          const values = resolved.map((c, i) => [
            id,
            i + 1,
            c.templateId,
            c.props ? JSON.stringify(c.props) : null,
          ]);
          await conn.query(
            `INSERT INTO iset_intake.step_component (step_id, position, template_id, props_overrides)
             VALUES ?`,
            [values]
          );
        }
      }
    });
    res.status(200).json({ id, message: 'Step updated' });
  } catch (err) {
    if (err.code === 404) return res.status(404).json({ error: 'Step not found' });
    if (err.code === 400) return res.status(400).json({ error: err.message });
    console.error('PUT /api/steps/:id failed:', err);
    res.status(500).json({ error: 'Failed to update step' });
  }
});

// --- Delete a step ----------------------------------------------------------
app.delete('/api/steps/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [[ref]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM iset_intake.workflow_step WHERE step_id = ?`,
      [id]
    );
    if (ref.cnt > 0) {
      return res.status(409).json({ error: `Step is used by ${ref.cnt} workflow(s)` });
    }
    await withTx(async (conn) => {
      await conn.query(`DELETE FROM iset_intake.step_component WHERE step_id = ?`, [id]);
      await conn.query(`DELETE FROM iset_intake.step WHERE id = ?`, [id]);
    });
    res.status(200).json({ message: 'Step deleted' });
  } catch (err) {
    console.error('DELETE /api/steps/:id failed:', err);
    res.status(500).json({ error: 'Failed to delete step' });
  }
});

/**
 * Helper to insert a new event into iset_case_event.
 * @param {Object} params
 * @param {number} params.user_id - Required. User ID for the event.
 * @param {string} params.event_type - Required. Event type (must match iset_event_type).
 * @param {Object} params.event_data - Required. Event data as JS object (will be stored as JSON).
 * @param {number|null} [params.case_id=null] - Optional. Case ID (nullable).
 * @param {boolean} [params.is_read=false] - Optional. Mark event as read (default false).
 * @returns {Promise<number>} The inserted event's ID.
 */
async function addCaseEvent({ user_id, event_type, event_data, case_id = null, is_read = false }) {
  if (!user_id || !event_type || typeof event_data === 'undefined') {
    throw new Error('Missing required fields for addCaseEvent');
  }
  const [result] = await pool.query(
    `INSERT INTO iset_case_event (user_id, case_id, event_type, event_data, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [user_id, case_id, event_type, JSON.stringify(event_data), is_read]
  );
  return result.insertId;
}

/**
 * GET /api/intake-officers
 *
 * Returns all evaluators (both roles) with their PTMA assignments (if any).
 * - Only active evaluators are included.
 * - If an evaluator has multiple PTMAs, they appear once per PTMA.
 * - If an evaluator has no PTMA, ptma fields are null and label is 'Not assigned to a PTMA'.
 */
app.get('/api/intake-officers', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id AS evaluator_id,
        e.name AS evaluator_name,
        e.email AS evaluator_email,
        e.role AS evaluator_role,
        p.id AS ptma_id,
        p.name AS ptma_name,
        p.iset_code AS ptma_code,
        p.iset_full_name AS ptma_full_name,
        p.iset_status AS ptma_status,
        p.iset_province AS ptma_province,
        p.iset_indigenous_group AS ptma_indigenous_group,
        IFNULL(p.name, 'Not assigned to a PTMA') AS ptma_label
      FROM iset_evaluators e
      LEFT JOIN iset_evaluator_ptma ep ON e.id = ep.evaluator_id AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())
      LEFT JOIN ptma p ON ep.ptma_id = p.id
      WHERE e.status = 'active'
      ORDER BY e.name, p.name
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching intake officers:', error);
    res.status(500).json({ error: 'Failed to fetch intake officers' });
  }
});


/**
 * POST /api/cases
 *
 * Creates a new ISET case for a submitted application and assigns it to a specific evaluator (from iset_evaluators).
 *
 * Expected JSON body:
 * {
 *   application_id: number,          // ID from iset_application
 *   assigned_to_user_id: number,     // Evaluator (iset_evaluators.id)
 *   ptma_id: number | null,          // PTMA (ptma.id) or null
 *   priority: 'low' | 'medium' | 'high' (optional) // Defaults to 'medium'
 * }
 *
 * Behavior:
 * - Checks if a case already exists for the given application_id.
 * - If so, returns 409 Conflict.
 * - If not, inserts a new row into iset_case with:
 *     - status: 'open'
 *     - stage: 'intake_review'
 *     - opened_at: now (default in schema)
 *     - priority: provided or 'medium'
 *     - application_id, assigned_to_user_id, ptma_id as given
 */
app.post('/api/cases', async (req, res) => {
  const { application_id, assigned_to_user_id, ptma_id = null, priority = 'medium' } = req.body;

  if (!application_id || !assigned_to_user_id) {
    return res.status(400).json({ error: 'Missing required fields: application_id and assigned_to_user_id' });
  }

  try {
    // Check for existing case
    const [existing] = await pool.query(
      `SELECT id FROM iset_case WHERE application_id = ?`,
      [application_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'A case already exists for this application.' });
    }

    // Insert new case with updated schema fields only
    const [result] = await pool.query(
      `INSERT INTO iset_case (
        application_id, assigned_to_user_id, ptma_id, status, priority, stage, opened_at
      ) VALUES (?, ?, ?, 'open', ?, 'intake_review', NOW())`,
      [application_id, assigned_to_user_id, ptma_id, priority]
    );

    const case_id = result.insertId;

    // Get applicant user_id for this application
    const [[appRow]] = await pool.query(
      'SELECT user_id FROM iset_application WHERE id = ?',
      [application_id]
    );
    if (!appRow) {
      return res.status(500).json({ error: 'Application not found after case creation' });
    }
    const applicant_user_id = appRow.user_id;

    // Get all files for this application/applicant
    const [files] = await pool.query(
      'SELECT * FROM iset_application_file WHERE user_id = ? AND file_path IS NOT NULL',
      [applicant_user_id]
    );

    // Insert each file into iset_case_document
    for (const file of files) {
      await pool.query(
        `INSERT INTO iset_case_document (case_id, uploaded_by_user_id, file_name, file_path, label, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          case_id,
          file.user_id,
          file.original_filename,
          file.file_path,
          file.document_type,
          file.uploaded_at || new Date()
        ]
      );
    }

    // Remove the files from iset_application_file
    if (files.length > 0) {
      const fileIds = files.map(f => f.id);
      await pool.query(
        `DELETE FROM iset_application_file WHERE id IN (${fileIds.map(() => '?').join(',')})`,
        fileIds
      );
    }

    // Log case assignment event
    const event_type = 'case_assigned';
    // Fetch evaluator name and PTMA code for event message
    let evaluatorName = '';
    let ptmaCode = '';
    try {
      const [[evalRow]] = await pool.query(
        'SELECT name FROM iset_evaluators WHERE id = ?',
        [assigned_to_user_id]
      );
      evaluatorName = evalRow ? evalRow.name : '';
      if (ptma_id) {
        const [[ptmaRow]] = await pool.query(
          'SELECT iset_code FROM ptma WHERE id = ?',
          [ptma_id]
        );
        ptmaCode = ptmaRow ? ptmaRow.iset_code : '';
      }
    } catch (e) {
      evaluatorName = '';
      ptmaCode = '';
    }
    const event_data = {
      message: `Case assigned to ${evaluatorName} of ${ptmaCode} with priority ${priority}`,
      application_id,
      assigned_to_user_id,
      assigned_to_user_name: evaluatorName,
      ptma_id,
      ptma_code: ptmaCode,
      priority,
      timestamp: new Date().toISOString()
    };
    await pool.query(
      'INSERT INTO iset_case_event (case_id, user_id, event_type, event_data, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [case_id, applicant_user_id, event_type, JSON.stringify(event_data)]
    );

    res.status(201).json({ message: 'Case created', case_id });
  } catch (error) {
    console.error('Error creating case:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * GET /api/case-assignment/unassigned-applications
 *
 * Returns a list of applications that have been submitted but not yet assigned
 * to a case (i.e. no record exists in the iset_case table for them).
 *
 * Each result includes:
 * - application_id
 * - submission timestamp
 * - applicant name and email
 * - program type
 */
app.get('/api/case-assignment/unassigned-applications', async (req, res) => {
  try {
    // Run a query to find all submitted applications that don't yet have a case
    let sql = `
      SELECT 
        a.id AS application_id,
        a.created_at AS submitted_at,
        u.name AS applicant_name,
        u.email,
        a.tracking_id
      FROM iset_application a
      JOIN user u ON a.user_id = u.id
      LEFT JOIN iset_case c ON a.id = c.application_id
      WHERE c.id IS NULL\n`;
    const params = [];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeApplications } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeApplications(req.auth || {}, 'a');
        sql += ` AND ${scopeSql}\n`;
        params.push(...scopeParams);
      }
    } catch (_) {}
    sql += '      ORDER BY a.created_at DESC';
    const [rows] = await pool.query(sql, params);

    // Send results to the frontend
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching unassigned applications:', err);
    res.status(500).json({ error: 'Failed to fetch unassigned applications' });
  }
});


/**
 * GET /api/tasks
 *
 * Returns all open tasks assigned to the authenticated caseworker (hard‑coded to user_id = 18 for now).
 *
 * Response fields:
 * - id
 * - case_id
 * - title
 * - description
 * - due_date
 * - priority
 * - status
 * - source
 * - remind_at
 * - snoozed_until
 * - repeat_interval_days
 * - tracking_id
 */
app.get('/api/tasks', async (req, res) => {
  let userId = 18; // replace with req.user.id when auth is active
  try {
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    if (authProvider === 'cognito') {
      userId = Number(req.auth?.userId) || -1;
    }
  } catch (_) {}
  try {
    let sql = `SELECT
         t.id,
         t.case_id,
         t.title,
         t.description,
         t.due_date,
         t.priority,
         t.status,
         t.source,
         t.remind_at,
         t.snoozed_until,
         t.repeat_interval_days,
         a.tracking_id  -- Include tracking_id from iset_application
       FROM iset_case_task t
       JOIN iset_case c ON t.case_id = c.id
       JOIN iset_application a ON c.application_id = a.id
       WHERE t.assigned_to_user_id = ?\n`;
    const params = [userId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        sql += ` AND ${scopeSql}\n`;
        params.push(...scopeParams);
      }
    } catch (_) {}
    sql += ` AND t.status IN ('open', 'in_progress')\n`;
    sql += ` ORDER BY 
         t.priority = 'high' DESC,
         t.due_date < CURDATE() DESC,
         t.due_date ASC`;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});


///Casework Task Scheduler
const generateSystemTasks = async () => {
  try {
    // Fetch all 'documents_overdue' events
    const [events] = await pool.query(
      `SELECT e.id, e.case_id, e.event_type, e.event_data, e.created_at, a.tracking_id
       FROM iset_case_event e
       JOIN iset_case c ON e.case_id = c.id
       JOIN iset_application a ON c.application_id = a.id
       WHERE e.event_type = 'documents_overdue'`
    );

    for (const event of events) {
      const { case_id, event_data, tracking_id } = event;
      const data =
        typeof event_data === 'string' ? JSON.parse(event_data) : event_data || {};

      // Check if a task already exists for this case
      const [existingTask] = await pool.query(
        `SELECT id FROM iset_case_task WHERE case_id = ? AND title = 'Request missing documents' AND status != 'completed'`,
        [case_id]
      );

      if (existingTask.length === 0) {
        // No task exists, create a new one
        const title = 'Request missing documents';
        const description = `Follow up with applicant to submit ${data.missing.join(', ')}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 2); // Due in 2 days

        await pool.query(
          `INSERT INTO iset_case_task (
            case_id, assigned_to_user_id, title, description, due_date, priority, status, source, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            case_id,
            18, // Assign to caseworker 18, you can modify this based on case assignment logic
            title,
            description,
            dueDate,
            'high',
            'open',
            'system',
            null // If system-generated, created_by_user_id can be NULL
          ]
        );

        console.log(`Task created for case ${tracking_id}: ${title}`);
      }
    }
  } catch (err) {
    console.error('Error generating system tasks:', err);
  }
};

app.get('/api/applicants/:id/documents', async (req, res) => {
  const applicantId = req.params.id;
  try {
    // Query all documents uploaded by this user (applicant), regardless of case_id
    const [rows] = await pool.query(
      `SELECT id, case_id, uploaded_by_user_id, file_name, file_path, label, uploaded_at
       FROM iset_case_document
       WHERE uploaded_by_user_id = ?
       ORDER BY uploaded_at DESC`,
      [applicantId]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching applicant documents:', error);
    res.status(500).json({ error: 'Failed to fetch applicant documents' });
  }
});

/**
 * GET /api/cases
 *
 * Returns all ISET cases with:
 * - Full case data from iset_case
 * - Assigned evaluator's name and email (from iset_evaluators)
 * - Linked application's tracking ID and submitted_at timestamp
 * - Applicant name and email (from user)
 * - PTMA assignments for the evaluator (if any, as a comma-separated string)
 */
app.get('/api/cases', async (req, res) => {
  try {
    const { stage } = req.query;
  let sql = `
      SELECT 
        c.id,
        c.application_id,
        c.assigned_to_user_id,
        c.status,
        c.priority,
        c.stage,
        c.opened_at,
        c.closed_at,
        c.last_activity_at,

        e.name AS assigned_user_name,
        e.email AS assigned_user_email,
        GROUP_CONCAT(p.iset_code SEPARATOR ', ') AS assigned_user_ptmas,

        a.tracking_id,
        a.created_at AS submitted_at,
        applicant.name AS applicant_name,
        applicant.email AS applicant_email

      FROM iset_case c
      JOIN iset_evaluators e ON c.assigned_to_user_id = e.id
      LEFT JOIN iset_evaluator_ptma ep ON e.id = ep.evaluator_id AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())
      LEFT JOIN ptma p ON ep.ptma_id = p.id
      JOIN iset_application a ON c.application_id = a.id
      JOIN user applicant ON a.user_id = applicant.id
    `;
    const params = [];
    if (stage) {
      sql += 'WHERE c.stage = ?\n';
      params.push(stage);
    }
    // RBAC scoping (feature-flagged)
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        sql += (stage ? ' AND ' : 'WHERE ') + scopeSql + '\n';
        params.push(...scopeParams);
      }
    } catch (_) {}

    sql += 'GROUP BY c.id\nORDER BY c.last_activity_at DESC';

    const [rows] = await pool.query(sql, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});


// Get a single case by case id
app.get('/api/cases/:id', async (req, res) => {
  const caseId = req.params.id;
  try {
    // Fetch case and joined application fields
  let baseSql = `
      SELECT 
        c.id,
        c.application_id,
        c.assigned_to_user_id,
        c.status,
        c.priority,
        c.stage,
        c.program_type,
        c.case_summary,
        c.opened_at,
        c.closed_at,
        c.last_activity_at,
        c.ptma_id,
        c.assessment_date_of_assessment,
        c.assessment_employment_goals,
        c.assessment_previous_iset,
        c.assessment_previous_iset_details,
        c.assessment_employment_barriers,
        c.assessment_local_area_priorities,
        c.assessment_other_funding_details,
        c.assessment_esdc_eligibility,
        c.assessment_intervention_start_date,
        c.assessment_intervention_end_date,
        c.assessment_institution,
        c.assessment_program_name,
        c.assessment_itp,
        c.assessment_wage,
        c.assessment_recommendation,
        c.assessment_justification,
        c.assessment_nwac_review,
        c.assessment_nwac_reason,
        e.name AS assigned_user_name,
        e.email AS assigned_user_email,
        p.name AS assigned_user_ptma_name,
        a.tracking_id,
        a.created_at AS submitted_at,
        applicant.name AS applicant_name,
        applicant.email AS applicant_email,
        applicant.id AS applicant_user_id,
        -- Application fields for assessment pre-population
        a.employment_goals,
        a.employment_barriers,
        a.target_employer AS institution
      FROM iset_case c
      JOIN iset_evaluators e ON c.assigned_to_user_id = e.id
      LEFT JOIN ptma p ON c.ptma_id = p.id
      JOIN iset_application a ON c.application_id = a.id
      JOIN user applicant ON a.user_id = applicant.id
      WHERE c.id = ?
    `;

    const params = [caseId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        baseSql += ` AND ${scopeSql}`;
        params.push(...scopeParams);
      }
    } catch (_) {}

    const [rows] = await pool.query(baseSql + ' LIMIT 1', params);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching case:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});


/**
 * GET /api/case-events
 *
 * Returns recent case-related events for the authenticated caseworker (user_id = 18).
 *
 * Query Parameters:
 * - unread=true        → Only return unread events
 * - type=event_type    → Filter by specific event type (optional)
 * - limit=25           → Max number of events to return (default: 25)
 *
 * Response fields:
 * - id, case_id, event_type, event_data, is_read, created_at
 * - tracking_id        → from iset_application
 * - label              → from iset_event_type
 * - alert_variant      → from iset_event_type (info, success, warning, error)
 */
app.get('/api/case-events', async (req, res) => {
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  const caseId = req.query.case_id ? Number(req.query.case_id) : null;
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;
  const eventType = req.query.type;
  const unread = req.query.unread === 'true';

  if (!userId && !caseId) {
    return res.status(400).json({ error: 'user_id or case_id is required' });
  }

  let whereClauses = [];
  let params = [];

  if (userId && caseId) {
    whereClauses.push('(e.user_id = ? OR e.case_id = ?)');
    params.push(userId, caseId);
  } else if (userId) {
    whereClauses.push('e.user_id = ?');
    params.push(userId);
  } else if (caseId) {
    whereClauses.push('e.case_id = ?');
    params.push(caseId);
  }

  if (eventType) {
    whereClauses.push('e.event_type = ?');
    params.push(eventType);
  }
  if (unread) {
    whereClauses.push('e.is_read = 0');
  }

  let whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  try {
    // RBAC scoping if enabled: ensure events are for cases within scope
    const scopedParams = [...params];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        whereSql += (whereSql ? ' AND ' : 'WHERE ') + scopeSql;
        scopedParams.push(...scopeParams);
      }
    } catch (_) {}

    const [rows] = await pool.query(`
      SELECT 
        e.id, e.case_id, e.event_type, e.event_data, e.is_read, e.created_at,
        a.tracking_id,
        et.label, et.alert_variant,
        u.name AS user_name
      FROM iset_case_event e
      LEFT JOIN iset_case c ON e.case_id = c.id
      LEFT JOIN iset_application a ON c.application_id = a.id
      LEFT JOIN iset_event_type et ON e.event_type = et.event_type
      LEFT JOIN user u ON e.user_id = u.id
      ${whereSql}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ? OFFSET ?
    `, [...scopedParams, limit, offset]);
    // Parse event_data JSON if needed
    rows.forEach(row => {
      if (typeof row.event_data === 'string') {
        try { row.event_data = JSON.parse(row.event_data); } catch {}
      }
    });
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching case events:', error);
    res.status(500).json({ error: 'Failed to fetch case events' });
  }
});


/**
 * PUT /api/case-events/:id/read
 *
 * Marks a specific case event as read for the authenticated user (hardcoded to user_id = 18).
 *
 * Path Parameter:
 * - :id → the ID of the event to update
 *
 * Behavior:
 * - Updates `is_read` to true if the event belongs to the current user.
 *
 * Response:
 * - 200 OK with success message
 * - 403 Forbidden if the event does not belong to the user
 * - 404 Not Found if the event ID doesn’t exist
 */
app.put('/api/case-events/:id/read', async (req, res) => {
  const userId = 18;
  const eventId = req.params.id;

  try {
    const [rows] = await pool.query(
      'SELECT id FROM iset_case_event WHERE id = ? AND user_id = ?',
      [eventId, userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized or event not found' });
    }

    await pool.query(
      'UPDATE iset_case_event SET is_read = TRUE WHERE id = ?',
      [eventId]
    );

    res.status(200).json({ message: 'Event marked as read' });
  } catch (err) {
    console.error('Error updating event read status:', err);
    res.status(500).json({ error: 'Failed to update event status' });
  }
});


/**
 * POST /api/case-events
 *
 * Request body:
 * {
 *   user_id: number (required),
 *   case_id: number | null (nullable),
 *   event_type: string (required, must match iset_event_type),
 *   event_data: object (required, valid JSON)
 * }
 *
 * Response: { id, message }
 */
app.post('/api/case-events', async (req, res) => {
  const { user_id, case_id = null, event_type, event_data } = req.body;
  if (!user_id || !event_type || typeof event_data === 'undefined' ) {
    return res.status(400).json({ error: 'Missing required fields: user_id, event_type, event_data' });
  }
  try {
    // Validate event_type exists in iset_event_type
    const [eventTypeRows] = await pool.query('SELECT event_type FROM iset_event_type WHERE event_type = ?', [event_type]);
    if (eventTypeRows.length === 0) {
      return res.status(400).json({ error: 'Invalid event_type' });
    }
    // Insert event
    const [result] = await pool.query(
      'INSERT INTO iset_case_event (case_id, user_id, event_type, event_data, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [case_id, user_id, event_type, JSON.stringify(event_data)]
    );
    res.status(201).json({ id: result.insertId, message: 'Event created' });
  } catch (error) {
    console.error('Error creating case event:', error);
    res.status(500).json({ error: 'Failed to create case event' });
  }
});


/**
 * POST /api/counter-session
 * 
 * Starts a new counter session for a user at a given counter.
 * 
 * - Only one active session is allowed per counter at a time.
 * - If the counter is already in use (no logout_time recorded), the request will fail.
 * - A successful request creates a new row in the counter_session table.
 * 
 * Expected request body:
 * {
 *   "userId": 123,       // ID of the user (staff member)
 *   "counterId": 5       // ID of the counter they are logging into
 * }
 */
app.post('/api/counter-session', async (req, res) => {
  const { userId, counterId } = req.body;

  try {
    // Step 1: Check if there is an existing active session for this counter
    const [existing] = await pool.query(
      'SELECT id FROM counter_session WHERE counter_id = ? AND logout_time IS NULL',
      [counterId]
    );

    // Step 2: If there is an active session, reject the request
    if (existing.length > 0) {
      return res.status(409).send({ message: 'This counter is already in use.' });
    }

    // Step 3: Insert new session into the counter_session table
    await pool.query(
      'INSERT INTO counter_session (counter_id, user_id) VALUES (?, ?)',
      [counterId, userId]
    );

    // Step 4: Return success
    res.status(201).send({ message: 'Counter session started successfully.' });
  } catch (error) {
    // Log the error for debugging
    console.error('Error starting counter session:', error);
    // Return error response
    res.status(500).send({ message: 'Failed to start counter session', error: error.message });
  }
});

/**
 * GET /api/counter-session/active?userId=1
 * 
 * Returns the currently active counter session for the given user, if one exists.
 * 
 * Response:
 * {
 *   counterId: 1,
 *   counterName: "Booth 1",
 *   locationId: 1,
 *   loginTime: "2025-04-03T14:18:00Z"
 * }
 */
app.get('/api/counter-session/active', async (req, res) => {
  const { userId } = req.query;

  try {
    const [rows] = await pool.query(`
      SELECT cs.counter_id AS counterId, c.name AS counterName, c.location_id AS locationId, cs.login_time AS loginTime
      FROM counter_session cs
      JOIN counter c ON cs.counter_id = c.id
      WHERE cs.user_id = ? AND cs.logout_time IS NULL
      ORDER BY cs.login_time DESC
      LIMIT 1
    `, [userId]);

    if (rows.length === 0) {
      return res.status(404).send({ message: 'No active session found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).send({ message: 'Failed to fetch session' });
  }
});


/**
 * DELETE /api/counter-session/:counterId
 * 
 * Signs out the currently active session for the specified counter.
 * 
 * - Updates the latest active session (logout_time IS NULL) to mark it as ended.
 * - Safe to call even if no session is currently active.
 */

/**
 * GET /api/counters
 * 
 * Fetches a list of all counters from the system.
 * 
 * Each counter has:
 * - id: the internal identifier
 * - name: display name (e.g. "Booth 1", "Counter A")
 * 
 * This endpoint is used by the Counter Sign-In widget to populate the dropdown
 * of available counters at a location.
 */
app.get('/api/counters', async (req, res) => {
  try {
    // Query the database for all counters (id and name)
    const [rows] = await pool.query('SELECT id, name FROM counter');

    // Return the result as JSON
    res.json(rows);
  } catch (error) {
    // Log any errors and return a 500 status
    console.error('Error fetching counters:', error);
    res.status(500).send({ message: 'Failed to fetch counters' });
  }
});


// --- Basic Users and Roles for Admin UI pages (lightweight) ---------------
// List basic users from the user table for demo/admin views
app.get('/api/users', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email
         FROM user
        ORDER BY id DESC
        LIMIT 500`
    );
    // Shape to match UI expectations (includes a role field even if null)
    const out = rows.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role || null }));
    res.status(200).json(out);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Static role catalogue for the Roles table in Manage Users
app.get('/api/roles', (_req, res) => {
  // Keep in sync with navigation/feature flags as needed
  const roles = [
    { id: 'SysAdmin', name: 'System Administrator', description: 'Full administrative access to the Admin Portal.' },
    { id: 'ProgramAdmin', name: 'Program Administrator', description: 'Manage programs, templates, and reporting.' },
    { id: 'RegionalCoordinator', name: 'Regional Coordinator', description: 'Coordinate case assignments and oversee regional workflows.' },
    { id: 'PTMAStaff', name: 'PTMA Staff', description: 'PTMA-level view and updates for assigned cases.' },
  ];
  res.status(200).json(roles);
});

// Minimal notifications summary for Manage Notifications landing
app.get('/api/notifications', async (_req, res) => {
  try {
    // Provide a simple summary based on existing notification_template rows if present
    const [rows] = await pool.query(
      `SELECT type, language, status, COUNT(*) AS count
         FROM notification_template
        GROUP BY type, language, status
        ORDER BY type, language, status`
    ).catch(() => [ [] ]); // if table missing, fall back to empty array

    const summary = Array.isArray(rows) ? rows : [];
    res.status(200).json({ templatesSummary: summary });
  } catch (err) {
    // If anything fails, return an empty structure so UI keeps working
    console.warn('Notifications summary unavailable:', err?.message || err);
    res.status(200).json({ templatesSummary: [] });
  }
});


app.delete('/api/counter-session/:counterId', async (req, res) => {
  const counterId = req.params.counterId;

  try {
    // Step 1: Update the latest active session by setting logout_time
    const [result] = await pool.query(`
      UPDATE counter_session
      SET logout_time = NOW()
      WHERE counter_id = ? AND logout_time IS NULL
    `, [counterId]);

    if (result.affectedRows > 0) {
      res.status(200).send({ message: 'Counter session ended successfully' });
    } else {
      res.status(200).send({ message: 'No active session to end' });
    }

  } catch (error) {
    console.error('Error ending counter session:', error);
    res.status(500).send({ message: 'Failed to end counter session', error: error.message });
  }
});


// New endpoint to return list of option data sources
app.get('/api/option-data-sources', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, label, endpoint FROM option_data_sources ORDER BY label');
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch option data sources:', error);
    res.status(500).json({ error: 'Failed to retrieve option data sources' });
  }
});


app.get('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`Fetching BlockStep with ID: ${id}`);

    const [rows] = await pool.query(
      'SELECT id, name, type, config_path, status FROM blockstep WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      console.warn(`BlockStep with ID ${id} not found.`);
      return res.status(404).json({ message: 'BlockStep not found' });
    }

    const blockStep = rows[0];

    // Don't try to read or parse .njk here; let frontend load it via /api/load-njk-template
    blockStep.components = []; // Ensure components key exists, even if unused

    res.status(200).json(blockStep);
  } catch (error) {
    console.error('Error fetching BlockStep:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// GET endpoint to retrieve all BlockSteps from the database
app.get('/api/blocksteps', async (req, res) => {
  try {
    // Query the database for all BlockSteps
    const [blocksteps] = await pool.query(
      'SELECT id, name, type, config_path, status FROM blockstep'
    );

    // Return the fetched BlockSteps as JSON
    res.status(200).json(blocksteps);
  } catch (error) {
    // Log and return an error if the query fails
    console.error('Error fetching blocksteps:', error);
    res.status(500).json({ message: 'Failed to fetch blocksteps' });
  }
});

app.post('/api/blocksteps', async (req, res) => {
  const { name, status, components, njkContent } = req.body;

  if (!name || !components || components.length === 0 || !njkContent) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Generate slug for file name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const configPath = `blocksteps/blockstep_${slug}_v1.njk`;
  const jsonPath = configPath.replace('.njk', '.json');

  try {
    // Insert DB row
    const [result] = await pool.query(`
      INSERT INTO blockstep (name, type, config_path, status)
      VALUES (?, 'nunjucks', ?, ?)
    `, [name, configPath, status]);

    const newId = result.insertId;

    // Write Nunjucks file
    fs.writeFileSync(path.join(__dirname, configPath), njkContent, 'utf8');

    // Write JSON file
    fs.writeFileSync(path.join(__dirname, jsonPath), JSON.stringify({ name, status, components }, null, 2), 'utf8');

    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Error creating new blockstep:', err);
    res.status(500).json({ message: 'Failed to create blockstep' });
  }
});

app.put('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;

  if (!name || !status) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    await pool.query(`
      UPDATE blockstep
      SET name = ?, status = ?
      WHERE id = ?
    `, [name, status, id]);

    res.status(200).json({ message: 'BlockStep updated successfully' });
  } catch (err) {
    console.error('Error updating BlockStep:', err);
    res.status(500).json({ message: 'Failed to update BlockStep' });
  }
});

app.delete('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the blockstep record to get file paths
    const [rows] = await pool.query('SELECT config_path FROM blockstep WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'BlockStep not found' });
    }

    const { config_path } = rows[0];
    const jsonPath = config_path.replace('.njk', '.json');

    // Delete the blockstep record from the database
    await pool.query('DELETE FROM blockstep WHERE id = ?', [id]);

    // Delete the associated files
    const njkFullPath = path.join(__dirname, config_path);
    const jsonFullPath = path.join(__dirname, jsonPath);

    if (fs.existsSync(njkFullPath)) fs.unlinkSync(njkFullPath);
    if (fs.existsSync(jsonFullPath)) fs.unlinkSync(jsonFullPath);

    res.status(200).json({ message: 'BlockStep and associated files deleted successfully.' });
  } catch (error) {
    console.error('Error deleting BlockStep:', error);
    res.status(500).json({ message: 'Failed to delete BlockStep.' });
  }
});

app.get('/api/render-nunjucks', (req, res) => {
  const { template_path } = req.query;

  if (!template_path) {
    console.error('template_path query parameter is required');
    return res.status(400).json({ error: 'template_path query parameter is required' });
  }

  const filePath = path.join(__dirname, template_path);
  console.log('Reading Nunjucks template from:', filePath);

  fs.readFile(filePath, 'utf8', (err, template) => {
    if (err) {
      console.error('Error reading Nunjucks template:', err);
      return res.status(500).json({ error: 'Failed to load Nunjucks template' });
    }

    try {
      // Render the Nunjucks template
      const renderedHtml = nunjucks.renderString(template);
      res.send(renderedHtml);
    } catch (renderError) {
      console.error('Error rendering Nunjucks template:', renderError);
      res.status(500).json({ error: 'Failed to render Nunjucks template' });
    }
  });
});

// GET /api/load-njk-template
// This endpoint loads the raw contents of a Nunjucks (.njk) template file from disk.
//
// It is used by the Modify Intake Step UI to preview the saved template exactly as it was last written.
// The frontend sends the file path (relative to the project root) using the `?path=` query parameter.
// The server reads the file as plain text and returns its contents without parsing.
//
// Example request:
//   GET /api/load-njk-template?path=blocksteps/blockstep_request-extra-time_v1.njk
//
// Returns:
//   200 OK with text/plain body if successful
//   400 if `path` is missing
//   500 if the file cannot be read

app.get('/api/load-njk-template', (req, res) => {
  const { path: templatePath } = req.query;

  if (!templatePath) {
    console.error('Missing template path');
    return res.status(400).send('Missing template path');
  }

  const fullPath = path.join(__dirname, templatePath);
  console.log('Loading Nunjucks template from:', fullPath);

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    console.error('Error reading .njk file:', err.message);
    res.status(500).send('Could not read template file');
  }
});

app.get('/api/search-users', async (req, res) => {
  const { query } = req.query;
  try {
    const [users] = await pool.query(`
      SELECT id, name, email, phone_number
      FROM user
      WHERE name LIKE ? OR email LIKE ? OR phone_number LIKE ?
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    res.status(200).send(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).send({ message: 'Failed to search users' });
  }
});


// Save slot search criteria to a separate variable
let slotSearchCriteria = {};
let appointmentData = {};

app.post('/api/save-slot-search-criteria', (req, res) => {
  slotSearchCriteria = { ...req.body };
  appointmentData = { ...appointmentData, ...req.body };
  res.status(200).send({ message: 'Slot search criteria and appointment data saved successfully' });
});

app.get('/api/get-slot-search-criteria', (req, res) => {
  res.status(200).send(slotSearchCriteria);
});

app.get('/api/get-appointment', (req, res) => {
  res.status(200).send(appointmentData);
});

app.get('/api/services', async (req, res) => {
  try {
    const [services] = await pool.query('SELECT id, name FROM service_type');
    res.status(200).send(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).send({ message: 'Failed to fetch services' });
  }
});

// --- Notification Templates API (DB-backed) ---

// Get all templates
app.get('/api/templates', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, type, status, language, subject, content, created_at, updated_at
      FROM notification_template
      ORDER BY name, language, type, status
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get a template by ID
app.get('/api/templates/:templateId', async (req, res) => {
  const templateId = req.params.templateId;
  try {
    const [rows] = await pool.query(
      'SELECT id, name, type, status, language, subject, content, created_at, updated_at FROM notification_template WHERE id = ?',
      [templateId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Save (create or update) a template by ID
app.post('/api/templates/:templateId', async (req, res) => {
  const templateId = req.params.templateId;
  const { name, type, status, language, subject, content } = req.body;
  if (!name || !type || !content || !subject) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // If templateId is 'new' or not a number, insert; else update
    if (templateId === 'new' || isNaN(Number(templateId))) {
      const [result] = await pool.query(
        `INSERT INTO notification_template (name, type, status, language, subject, content) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, type, status, language, subject, content]
      );
      res.status(201).json({ id: result.insertId, message: 'Template created' });
    } else {
      const [result] = await pool.query(
        `UPDATE notification_template SET name=?, type=?, status=?, language=?, subject=?, content=? WHERE id=?`,
        [name, type, status, language, subject, content, templateId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }
      res.status(200).json({ id: templateId, message: 'Template updated' });
    }
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
});

// Delete a template by ID
app.delete('/api/templates/:templateId', async (req, res) => {
  const templateId = req.params.templateId;
  try {
    const [result] = await pool.query(
      'DELETE FROM notification_template WHERE id = ?',
      [templateId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(200).json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

app.get('/api/admin/messages', async (req, res) => {
  try {
    console.log("Fetching messages...");  // 🔴 Log request start

    const [messages] = await pool.query(`
          SELECT id, sender_id, recipient_id, subject, body, status, deleted, urgent, created_at 
          FROM messages
          ORDER BY urgent DESC, created_at DESC
      `);

    console.log("Messages fetched:", messages);  // 🔴 Log retrieved messages

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);  // 🔴 Log error details
    res.status(500).json({ error: error.message });  // 🔴 Send error details in response
  }
});


app.post('/api/admin/messages', async (req, res) => {
  const { sender_id, recipient_id, subject, body, urgent } = req.body;

  if (!sender_id || !recipient_id || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result] = await pool.query(`
          INSERT INTO messages (sender_id, recipient_id, subject, body, status, deleted, urgent, created_at)
          VALUES (?, ?, ?, ?, 'unread', FALSE, ?, NOW())
      `, [sender_id, recipient_id, subject, body, urgent]);

    res.status(201).json({ message: 'Message sent', messageId: result.insertId });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Mark a message as deleted
app.put('/api/admin/messages/:id/delete', async (req, res) => {
  const messageId = req.params.id;
  try {
    const [result] = await pool.query(
      'UPDATE messages SET deleted = 1 WHERE id = ?',
      [messageId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Update message status (PUT /api/admin/messages/:id/status)
app.put('/api/admin/messages/:id/status', async (req, res) => {
  const messageId = req.params.id;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Missing status' });
  }
  try {
    await pool.query('UPDATE messages SET status = ? WHERE id = ?', [status, messageId]);
    res.status(200).json({ message: 'Status updated' });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ error: 'Failed to update message status' });
  }
});

app.get('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  try {
    const [services] = await pool.query(`
      SELECT st.id, st.name
      FROM location_service_link ls
      JOIN service_type st ON ls.service_id = st.id
      WHERE ls.location_id = ?
    `, [locationId]);
    res.status(200).send(services);
  } catch (error) {
    console.error('Error fetching location services:', error);
    res.status(500).send({ message: 'Failed to fetch location services' });
  }
});

app.post('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const serviceIds = req.body;

  try {
    // Delete existing services for the location
    await pool.query('DELETE FROM location_service_link WHERE location_id = ?', [locationId]);

    // Insert new services for the location
    const values = serviceIds.map(serviceId => [locationId, serviceId]);
    await pool.query('INSERT INTO location_service_link (location_id, service_id) VALUES ?', [values]);

    res.status(200).send({ message: 'Services updated successfully' });
  } catch (error) {
    console.error('Error updating location services:', error);
    res.status(500).send({ message: 'Failed to update location services' });
  }
});

app.put('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const serviceIds = req.body;

  try {
    // Delete existing services for the location
    await pool.query('DELETE FROM location_service_link WHERE location_id = ?', [locationId]);

    // Insert new services for the location
    const values = serviceIds.map(serviceId => [locationId, serviceId]);
    await pool.query('INSERT INTO location_service_link (location_id, service_id) VALUES ?', [values]);

    res.status(200).send({ message: 'Services updated successfully' });
  } catch (error) {
    console.error('Error updating location services:', error);
    res.status(500).send({ message: 'Failed to update location services' });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const { country, location, service } = req.query;
    console.log('Received query parameters:', req.query); // Debugging log

    let query = `
SELECT 
    a.id, 
    u.name, 
    s.date, 
    s.time, 
    a.status, 
    st.name AS serviceType, 
    l.name AS location
FROM appointment a
JOIN user u ON a.user_id = u.id
JOIN booking b ON a.id = b.appointment_id
JOIN slot s ON b.slot_id = s.id  -- Direct join with slot using slot_id from booking
JOIN service_type st ON a.serviceType = st.id
JOIN location l ON s.location_id = l.id
WHERE 1=1;
    `;

    if (country && country !== 'all') {
      query += ` AND l.country_id = ${mysql.escape(country)}`;
    }

    if (location && location !== 'all') {
      query += ` AND l.id = ${mysql.escape(location)}`;
    }

    if (service && service !== 'all') {
      query += ` AND st.name = ${mysql.escape(service)}`;
    }

    console.log('Constructed SQL query:', query); // Debugging log

    const [appointments] = await pool.query(query);

    // Mask the name field
    const maskedAppointments = appointments.map(appointment => {
      const nameParts = appointment.name.split(' ');
      const maskedName = nameParts.map(part => {
        if (part.length <= 2) return part;
        return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
      }).join(' ');
      return { ...appointment, name: maskedName };
    });

    res.status(200).send(maskedAppointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).send({ message: 'Failed to fetch appointments' });
  }
});

app.get('/api/appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;
  try {
    const [appointment] = await pool.query(`
SELECT 
    a.id, 
    u.name, 
    s.date, 
    s.time, 
    a.status, 
    st.name AS serviceType, 
    l.name AS location
FROM appointment a
JOIN user u ON a.user_id = u.id
JOIN booking b ON a.id = b.appointment_id
JOIN slot s ON b.slot_id = s.id  -- Direct join with slot using slot_id from booking
JOIN service_type st ON a.serviceType = st.id
JOIN location l ON s.location_id = l.id
WHERE a.id = ?;
    `, [appointmentId]);

    if (appointment.length === 0) {
      return res.status(404).send({ message: 'Appointment not found' });
    }

    res.status(200).send(appointment[0]);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).send({ message: 'Failed to fetch appointment' });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;
  const { status } = req.body;

  try {
    // Update the status in the appointment table
    await pool.query('UPDATE appointment SET status = ? WHERE id = ?', [status, appointmentId]);

    if (status === 'serving') {
      // Update the service_start_time in the queue table
      await pool.query('UPDATE queue SET service_start_time = ? WHERE appointment_id = ?', [new Date(), appointmentId]);
    } else if (status === 'package' || status === 'complete') {
      // Update the service_end_time in the queue table
      await pool.query('UPDATE queue SET service_end_time = ? WHERE appointment_id = ?', [new Date(), appointmentId]);
    } else if (status === 'booked') {
      // Delete the record from the queue table
      await pool.query('DELETE FROM queue WHERE appointment_id = ?', [appointmentId]);
    }

    res.status(200).send({ message: 'Appointment status updated successfully' });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).send({ message: 'Failed to update appointment status' });
  }
});

app.delete('/api/queue/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM queue WHERE appointment_id = ?', [appointmentId]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ message: 'Queue record not found' });
    }

    res.status(200).send({ message: 'Queue record deleted successfully' });
  } catch (error) {
    console.error('Error deleting queue record:', error);
    res.status(500).send({ message: 'Failed to delete queue record' });
  }
});

const formatDateTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
};

app.put('/api/queue', async (req, res) => {
  const { appointmentId, service_start_time, service_end_time, status } = req.body;

  try {
    const formattedStartTime = formatDateTime(service_start_time);
    const formattedEndTime = formatDateTime(service_end_time);

    const [result] = await pool.query(`
      UPDATE queue 
      SET 
        service_start_time = COALESCE(?, service_start_time), 
        service_end_time = COALESCE(?, service_end_time), 
        status = COALESCE(?, status)
      WHERE appointment_id = ?
    `, [formattedStartTime, formattedEndTime, status, appointmentId]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ message: 'Queue record not found' });
    }

    res.status(200).send({ message: 'Queue record updated successfully' });
  } catch (error) {
    console.error('Error updating queue record:', error);
    res.status(500).send({ message: 'Failed to update queue record' });
  }
});

// --- PTMA Endpoints ---

// List all PTMAs or Hubs (filter by type if provided)
app.get('/api/ptmas', async (req, res) => {
  try {
    const type = req.query.type;
    let whereClause = '';
    let params = [];
    if (type === 'PTMA' || type === 'Hub') {
      whereClause = 'WHERE type = ?';
      params = [type];
    }
    // Get all PTMAs or Hubs
    const [ptmas] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      ${whereClause}
    `, params);

    // Get applications (all cases per PTMA/Hub)
    const [applicationCounts] = await pool.query(`
      SELECT ptma_id, COUNT(*) AS applications
      FROM iset_case
      WHERE ptma_id IS NOT NULL
      GROUP BY ptma_id
    `);
    // Get open cases per PTMA/Hub
    const [openCaseCounts] = await pool.query(`
      SELECT ptma_id, COUNT(*) AS cases
      FROM iset_case
      WHERE ptma_id IS NOT NULL AND status = 'open'
      GROUP BY ptma_id
    `);
    // Build lookup maps
    const applicationsMap = Object.fromEntries(applicationCounts.map(r => [r.ptma_id, r.applications]));
    const casesMap = Object.fromEntries(openCaseCounts.map(r => [r.ptma_id, r.cases]));

    // Map DB fields to API fields for each PTMA/Hub, adding counts
    const mapped = ptmas.map(db => ({
      id: db.id,
      full_name: db.iset_full_name,
      code: db.iset_code,
      status: db.iset_status,
      province: db.iset_province,
      indigenous_group: db.iset_indigenous_group,
      full_address: db.iset_full_address,
      agreement_id: db.iset_agreement_id,
      notes: db.iset_notes,
      website_url: db.website_url || null,
      contact_name: db.contact_name || null,
      contact_email: db.contact_email || null,
      contact_phone: db.contact_phone || null,
      contact_notes: db.contact_notes || null,
      applications: applicationsMap[db.id] || 0,
      cases: casesMap[db.id] || 0
    }));
    res.status(200).json(mapped);
  } catch (error) {
    console.error('Error fetching PTMAs:', error);
    res.status(500).send({ message: 'Failed to fetch PTMAs' });
  }
});

// Get PTMA by ID
app.get('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
  try {
    const [ptmas] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    if (ptmas.length === 0) {
      return res.status(404).send({ message: 'PTMA not found' });
    }
    // Map DB fields to API fields
    const db = ptmas[0];
    res.status(200).json({
      id: db.id,
      full_name: db.iset_full_name,
      code: db.iset_code,
      status: db.iset_status,
      province: db.iset_province,
      indigenous_group: db.iset_indigenous_group,
      full_address: db.iset_full_address,
      agreement_id: db.iset_agreement_id,
      notes: db.iset_notes,
      website_url: db.website_url || null,
      contact_name: db.contact_name || null,
      contact_email: db.contact_email || null,
      contact_phone: db.contact_phone || null,
      contact_notes: db.contact_notes || null
    });
  } catch (error) {
    console.error('Error fetching PTMA:', error);
    res.status(500).send({ message: 'Failed to fetch PTMA' });
  }
});

// Create PTMA
app.post('/api/ptmas', async (req, res) => {
  const {
    location,
    iset_full_name,
    iset_code,
    iset_status,
    iset_province,
    iset_indigenous_group,
    iset_full_address,
    iset_agreement_id,
    iset_notes,
    website_url,
    contact_name,
    contact_email,
    contact_phone,
    contact_notes
  } = req.body;
  try {
    const [result] = await pool.query(`
          INSERT INTO ptma (name, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [location, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes]);
    const ptmaId = result.insertId;
    const [newPtma] = await pool.query(`
      SELECT id, name AS location, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    res.status(201).send(newPtma[0]);
  } catch (error) {
    console.error('Error creating PTMA:', error);
    res.status(500).send({ message: 'Failed to create PTMA' });
  }
});

// Update PTMA
app.put('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
  const {
    full_name,
    code,
    status,
    province,
    indigenous_group,
    full_address,
    agreement_id,
    notes,
    website_url,
    contact_name,
    contact_email,
    contact_phone,
    contact_notes
  } = req.body;
  try {
    await pool.query(`
      UPDATE ptma SET 
        iset_full_name = ?,
        iset_code = ?,
        iset_status = ?,
        iset_province = ?,
        iset_indigenous_group = ?,
        iset_full_address = ?,
        iset_agreement_id = ?,
        iset_notes = ?,
        website_url = ?,
        contact_name = ?,
        contact_email = ?,
        contact_phone = ?,
        contact_notes = ?
      WHERE id = ?
    `, [full_name, code, status, province, indigenous_group, full_address, agreement_id, notes, website_url, contact_name, contact_email, contact_phone, contact_notes, ptmaId]);
    const [updatedPtma] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    const db = updatedPtma[0];
    res.status(200).json({
      id: db.id,
      full_name: db.iset_full_name,
      code: db.iset_code,
      status: db.iset_status,
      province: db.iset_province,
      indigenous_group: db.iset_indigenous_group,
      full_address: db.iset_full_address,
      agreement_id: db.iset_agreement_id,
      notes: db.iset_notes,
      website_url: db.website_url || null,
      contact_name: db.contact_name || null,
      contact_email: db.contact_email || null,
      contact_phone: db.contact_phone || null,
      contact_notes: db.contact_notes || null
    });
  } catch (error) {
    console.error('Error updating PTMA:', error);
    res.status(500).send({ message: 'Failed to update PTMA' });
  }
});

// Delete PTMA
app.delete('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
  try {
    await pool.query('DELETE FROM ptma WHERE id = ?', [ptmaId]);
    res.status(200).send({ message: 'PTMA deleted successfully' });
  } catch (error) {
    console.error('Error deleting PTMA:', error);
    res.status(500).send({ message: 'Failed to delete PTMA' });
  }
});

// Get evaluators for a PTMA
app.get('/api/ptmas/:ptmaId/evaluators', async (req, res) => {
  const { ptmaId } = req.params;
  try {
    const [evaluators] = await pool.query(`
      SELECT 
        e.id, 
        e.name, 
        e.email, 
        e.role,
        ep.assigned_at,
        ep.unassigned_at
      FROM iset_evaluators e
      JOIN iset_evaluator_ptma ep 
        ON e.id = ep.evaluator_id
      WHERE ep.ptma_id = ?
        AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())
      ORDER BY e.name
    `, [ptmaId]);
    res.status(200).json(evaluators);
  } catch (error) {
    console.error('Error fetching evaluators for PTMA:', error);
    res.status(500).json({ error: 'Failed to fetch evaluators' });
  }
});
// --- End PTMA Endpoints ---

// Get full iset_application by application_id
app.get('/api/applications/:id', async (req, res) => {
  const applicationId = req.params.id;
  try {
    // Get application data
    let appSql = 'SELECT * FROM iset_application a WHERE a.id = ?';
    const appParams = [applicationId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeApplications } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeApplications(req.auth || {}, 'a');
        appSql += ` AND ${scopeSql}`;
        appParams.push(...scopeParams);
      }
    } catch (_) {}
    const [[application]] = await pool.query(appSql, appParams);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get case info (if exists)
    let caseSql = `SELECT id, assigned_to_user_id, status, priority, stage, program_type, case_summary, opened_at, closed_at, last_activity_at, ptma_id FROM iset_case c WHERE application_id = ?`;
    const caseParams = [applicationId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        caseSql += ` AND ${scopeSql}`;
        caseParams.push(...scopeParams);
      }
    } catch (_) {}
    const [[caseRow]] = await pool.query(caseSql, caseParams);

    let evaluator = null;
    let ptma = null;
    if (caseRow) {
      // Get evaluator info
      const [[evalRow]] = await pool.query(
        'SELECT id, name, email, role, status FROM iset_evaluators WHERE id = ?',
        [caseRow.assigned_to_user_id]
      );
      evaluator = evalRow || null;
      // Get PTMA info directly from iset_case.ptma_id
      if (caseRow.ptma_id) {
        const [[ptmaRow]] = await pool.query(
          'SELECT id, name, iset_code FROM ptma WHERE id = ?',
          [caseRow.ptma_id]
        );
        ptma = ptmaRow || null;
      }
    }

    res.status(200).json({ ...application, assigned_evaluator: evaluator, ptma, case: caseRow || null });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

/**
 * GET /api/applications/:id/ptma
 *
 * Returns the PTMA(s) for the assigned evaluator of the given application, or null if not assigned.
 */
app.get('/api/applications/:id/ptma', async (req, res) => {
  const applicationId = req.params.id;
  try {
    // Get assigned evaluator for this application (via iset_case)
    let s = 'SELECT assigned_to_user_id FROM iset_case c WHERE application_id = ?';
    const sParams = [applicationId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        s += ` AND ${scopeSql}`;
        sParams.push(...scopeParams);
      }
    } catch (_) {}
    const [[caseRow]] = await pool.query(s, sParams);
    if (!caseRow) {
      return res.status(200).json({ ptmas: [] });
    }
    // Get all current PTMA assignments for this evaluator
    const [ptmaRows] = await pool.query(
      `SELECT p.id, p.name, p.iset_code, p.iset_full_name, p.iset_status, p.iset_province, p.iset_indigenous_group
       FROM iset_evaluator_ptma ep
       JOIN ptma p ON ep.ptma_id = p.id
       WHERE ep.evaluator_id = ? AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())`,
      [caseRow.assigned_to_user_id]
    );
    res.status(200).json({ ptmas: ptmaRows });
  } catch (error) {
    console.error('Error fetching ptma for application:', error);
    res.status(500).json({ error: 'Failed to fetch ptma for application' });
  }
});

// Update case_summary for a given application
app.put('/api/applications/:id/ptma-case-summary', async (req, res) => {
  const applicationId = req.params.id;
  const { case_summary } = req.body;
  if (!case_summary) {
    return res.status(400).json({ error: 'Missing case_summary in request body' });
  }
  try {
    // Update the case_summary in iset_case for the given application_id
    let upd = 'UPDATE iset_case c SET case_summary = ? WHERE application_id = ?';
    const updParams = [case_summary, applicationId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        upd += ` AND ${scopeSql}`;
        updParams.push(...scopeParams);
      }
    } catch (_) {}
    const [result] = await pool.query(upd, updParams);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Case not found for this application' });
    }
    // Return the updated case_summary (and optionally the full case row)
  const [[updatedCase]] = await pool.query('SELECT case_summary FROM iset_case WHERE application_id = ?', [applicationId]);
    res.status(200).json({ case_summary: updatedCase.case_summary });
  } catch (error) {
    console.error('Error updating case summary:', error);
    res.status(500).json({ error: 'Failed to update case summary' });
  }
});

// Serve uploaded files statically for document viewing (corrected path)
app.use('/uploads', express.static('X:/ISET/ISET-intake/uploads'));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`CORS allowed origin: ${corsOptions.origin}`);
});

// Get all events for a specific case (with user name, event type label, and alert variant)
app.get('/api/cases/:case_id/events', async (req, res) => {
  const caseId = req.params.case_id;
  const { limit = 50, offset = 0 } = req.query;
  try {
    let sql = `
      SELECT 
        e.id AS event_id,
        e.case_id,
        e.event_type,
        et.label AS event_type_label,
        et.alert_variant,
        e.event_data,
        e.created_at,
        u.id AS user_id,
        u.name AS user_name
      FROM iset_case_event e
      JOIN user u ON e.user_id = u.id
      JOIN iset_event_type et ON e.event_type = et.event_type
      JOIN iset_case c ON e.case_id = c.id
      WHERE e.case_id = ?\n`;
    const qParams = [caseId];
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        sql += ` AND ${scopeSql}\n`;
        qParams.push(...scopeParams);
      }
    } catch (_) {}
    sql += '      ORDER BY e.created_at DESC\n      LIMIT ? OFFSET ?';
    const [rows] = await pool.query(sql, [...qParams, Number(limit), Number(offset)]);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching case events:', error);
    res.status(500).json({ error: 'Failed to fetch case events' });
  }
});


/**
 * POST /api/purge-cases
 *
 * Deletes all rows from iset_case_document, iset_case_event, iset_case_note, iset_case_task, then iset_case.
 * Used for demo reset purposes only.
 */
app.post('/api/purge-cases', async (req, res) => {
  try {
    // Delete from child tables first due to foreign key constraints
    await pool.query('DELETE FROM iset_case_document');
    await pool.query('DELETE FROM iset_case_event');
    await pool.query('DELETE FROM iset_case_note');
    await pool.query('DELETE FROM iset_case_task');
    await pool.query('DELETE FROM iset_case');
    res.status(200).json({ message: 'All cases and related data purged.' });
  } catch (error) {
    console.error('Error purging cases:', error);
    res.status(500).json({ error: 'Failed to purge cases' });
  }
});

// Purge all applications, drafts, and files (for demo reset)
app.post('/api/purge-applications', async (req, res) => {
  try {
    // Delete from child tables first to avoid FK constraint errors
    await pool.query('DELETE FROM iset_application_file');
    await pool.query('DELETE FROM iset_application_draft');
    await pool.query('DELETE FROM iset_application');
    res.status(200).json({ message: 'All applications, drafts, and files have been deleted.' });
  } catch (error) {
    console.error('Error purging applications:', error);
    res.status(500).json({ error: 'Failed to purge applications.' });
  }
});

// Endpoint to get the content of a .njk file
app.get('/api/get-njk-file', (req, res) => {
  const templatePath = req.query.template_path;
  const filePath = path.join(__dirname, templatePath); // Corrected path

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading .njk file:', err);
      return res.status(500).send('Error reading .njk file');
    }
    res.send(data);
  });
});

//This is probably safe to remove. It was from when I stoed jsons, not nunjucks.
app.get('/api/blockstep-json', (req, res) => {
  const { config_path } = req.query;

  if (!config_path) {
    console.error('config_path query parameter is required'); // Add logging
    return res.status(400).json({ error: 'config_path query parameter is required' });
  }

  const filePath = path.join(__dirname, config_path);
  console.log('Reading BlockStep JSON from:', filePath); // Add logging

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading BlockStep JSON:', err); // Add logging
      return res.status(500).json({ error: 'Failed to load BlockStep JSON' });
    }

    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('Error parsing JSON file:', parseError); // Add logging
      res.status(500).json({ error: 'Invalid JSON format' });
    }
  });
});

app.post('/api/generate-static-njk-template', (req, res) => {
  const { components } = req.body;

  if (!Array.isArray(components)) {
    return res.status(400).json({ error: 'Missing or invalid components array' });
  }

  const flattenProps = (obj, prefix = '') => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      ) {
        Object.assign(acc, flattenProps(value, path));
      } else {
        acc[path] = value;
      }
      return acc;
    }, {});
  };

  try {
    const rendered = components.map((component) => {
      const mergedProps = {
        ...component.props,
        ...component.props?.props
      };

      const templateBeforeInjection = component.nunjucks_template || '';
      let template = templateBeforeInjection;

      const shouldInjectAttributes =
        mergedProps.mode === 'dynamic' &&
        mergedProps.endpoint &&
        !template.includes('attributes:');

      if (shouldInjectAttributes) {
        const match = template.match(/(govukRadios|govukSelect|govukCheckboxes)\s*\(\s*{([\s\S]*?)\}\s*\)/);
        if (match) {
          const componentName = match[1];
          const innerProps = match[2];

          const injectedValue = JSON.stringify(
            { 'data-options-endpoint': mergedProps.endpoint },
            null,
            2
          ).replace(/^/gm, '  '); // indent for Nunjucks readability

          const insertion = `attributes: ${injectedValue},\n`;
          const modifiedInner = insertion + innerProps;

          template = template.replace(innerProps, modifiedInner);
        }
      }

      const flatProps = flattenProps(mergedProps);

      for (const [path, value] of Object.entries(flatProps)) {
        const pattern = new RegExp(`props\\.${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');

        let stringified;
        if (value === undefined || value === null) {
          stringified = '';
        } else if (typeof value === 'string') {
          stringified = `"${value}"`;
        } else if (Array.isArray(value) || typeof value === 'object') {
          stringified = JSON.stringify(value, null, 2);
        } else {
          stringified = String(value);
        }

        template = template.replace(pattern, stringified);
      }

      template = template.replace(/,\s*([}\]])/g, '$1');

      return template;
    });

    const output = rendered.filter(Boolean).join('\n\n');
    res.send(output);
  } catch (err) {
    console.error('Error generating static Nunjucks template:', err);
    res.status(500).json({ error: 'Failed to generate static Nunjucks template' });
  }
});

app.post('/api/save-blockstep-json', (req, res) => {
  const { json_path, content } = req.body;

  if (!json_path || !content) {
    return res.status(400).json({ message: 'Missing json_path or content' });
  }

  const fullPath = path.join(__dirname, json_path);

  fs.writeFile(fullPath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error saving JSON file:', err);
      return res.status(500).json({ message: 'Failed to save JSON file' });
    }

    res.status(200).json({ message: 'JSON file saved successfully' });
  });
});


// Endpoint to save the content of a .njk file
app.post('/api/save-njk-file', (req, res) => {
  const templatePath = req.body.template_path;
  const content = req.body.content;
  const filePath = path.join(__dirname, templatePath); // Corrected path

  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error saving .njk file:', err);
      return res.status(500).send('Error saving .njk file');
    }
    res.send('File saved successfully');
  });
});

// Endpoint to fetch all components
app.get('/api/govuk-components', async (req, res) => {
  try {
    const [components] = await pool.query('SELECT * FROM govuk_component');
    res.status(200).json(components);
  } catch (error) {
    console.error('Error fetching components:', error);
    res.status(500).json({ message: 'Failed to fetch components' });
  }
});

// Endpoint to fetch a single component by ID
app.get('/api/govuk-components/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [components] = await pool.query('SELECT * FROM govuk_component WHERE id = ?', [id]);
    if (components.length === 0) {
      return res.status(404).json({ message: 'Component not found' });
    }
    res.status(200).json(components[0]);
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({ message: 'Failed to fetch component' });
  }
});

// Endpoint to create a new component
app.post('/api/govuk-components', async (req, res) => {
  const { type, label, props } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO govuk_component (type, label, props) VALUES (?, ?, ?)', [type, label, JSON.stringify(props)]);
    res.status(201).json({ id: result.insertId, type, label, props });
  } catch (error) {
    console.error('Error creating component:', error);
    res.status(500).json({ message: 'Failed to create component' });
  }
});

// Endpoint to update an existing component
app.put('/api/govuk-components/:id', async (req, res) => {
  const { id } = req.params;
  const { type, label, props } = req.body;
  try {
    await pool.query('UPDATE govuk_component SET type = ?, label = ?, props = ? WHERE id = ?', [type, label, JSON.stringify(props), id]);
    res.status(200).json({ id, type, label, props });
  } catch (error) {
    console.error('Error updating component:', error);
    res.status(500).json({ message: 'Failed to update component' });
  }
});

// Endpoint to delete a component
app.delete('/api/govuk-components/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM govuk_component WHERE id = ?', [id]);
    res.status(200).json({ message: 'Component deleted successfully' });
  } catch (error) {
    console.error('Error deleting component:', error);
    res.status(500).json({ message: 'Failed to delete component' });
  }
});

app.get('/api/load-blockstep-json', (req, res) => {
  const { path: jsonPath } = req.query;

  if (!jsonPath) {
    return res.status(400).json({ message: 'Missing path parameter' });
  }

  const fullPath = path.join(__dirname, jsonPath);

  fs.readFile(fullPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading JSON file:', err.message);
      return res.status(500).json({ message: 'Failed to read JSON file' });
    }

    try {
      const jsonData = JSON.parse(data);
      res.status(200).json(jsonData);
    } catch (parseErr) {
      console.error('Invalid JSON format:', parseErr.message);
      res.status(500).json({ message: 'Invalid JSON format' });
    }
  });
});

app.post('/api/render-njk', (req, res) => {
  const { template, props } = req.body;

  if (!template || typeof template !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid template' });
  }

  try {
    const renderedHtml = nunjucks.renderString(template, { props });
    res.send(renderedHtml);
  } catch (err) {
    console.error('Nunjucks render error:', err);
    res.status(500).json({ error: 'Failed to render Nunjucks template' });
  }
});

app.get('/api/admin/messages/:id/attachments', async (req, res) => {
  const messageId = req.params.id;
  const caseIdFromQuery = req.query.case_id ? parseInt(req.query.case_id, 10) : null;
  try {
    // Get all attachments for this message
    const [attachments] = await pool.query(
      `SELECT id, message_id, file_path, original_filename, uploaded_at, user_id, application_id
       FROM message_attachment
      
       WHERE message_id = ?
       ORDER BY uploaded_at ASC`,
      [messageId]
    );

    // Get the message to determine sender/recipient
    const [[message]] = await pool.query(
      `SELECT * FROM messages WHERE id = ?`,
      [messageId]
    );
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Use case_id from query if provided, else fallback to previous logic (which will not work if no application_id)
    let caseId = caseIdFromQuery;
    // (Optional: fallback logic if you want to support legacy messages)

    // For each attachment, add to iset_case_document if not already present
    if (caseId) {
      for (const att of attachments) {
        // Ensure file_path is relative (e.g., 'uploads/filename.pdf')
        let relativeFilePath = att.file_path;
        // Normalize slashes for Windows/Unix
        relativeFilePath = relativeFilePath.replace(/\\/g, '/');
        // Remove everything before and including 'uploads/'
        const uploadsIndex = relativeFilePath.lastIndexOf('uploads/');
        if (uploadsIndex !== -1) {
          relativeFilePath = relativeFilePath.substring(uploadsIndex);
        }
        // Always use forward slashes in DB
        relativeFilePath = relativeFilePath.replace(/\\/g, '/');
        try {
          await pool.query(
            `INSERT INTO iset_case_document (case_id, uploaded_by_user_id, file_name, file_path, label, uploaded_at)
             VALUES (?, ?, ?, ?, ?, ?)` ,
            [
              caseId,
              att.user_id || message.sender_id || message.recipient_id,
              att.original_filename,
              relativeFilePath,
              'Secure Message Attachment',
              att.uploaded_at || new Date()
            ]
          );
        } catch (err) {
          if (err && (err.code === 'ER_DUP_ENTRY' || err.code === '23505')) {
            continue;
          } else {
            console.error('Error inserting into iset_case_document:', err);
            throw err;
          }
        }
      }
    }

    res.status(200).json(attachments);
  } catch (error) {
    console.error('Error fetching message attachments:', error);
    res.status(500).json({ error: 'Failed to fetch message attachments' });
  }
});

// Hard delete a message and its attachments
app.delete('/api/admin/messages/:id/hard-delete', async (req, res) => {
  const messageId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Delete attachments first
    await conn.query('DELETE FROM message_attachment WHERE message_id = ?', [messageId]);
    // Delete the message
    const [result] = await conn.query('DELETE FROM messages WHERE id = ?', [messageId]);
    await conn.commit();
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Message not found' });
    } else {
      res.status(200).json({ message: 'Message and attachments deleted' });
    }
  } catch (error) {
    await conn.rollback();
    console.error('Error hard deleting message:', error);
    res.status(500).json({ error: 'Failed to hard delete message' });
  } finally {
    conn.release();
  }
});

// Update assessment fields for a case
app.put('/api/cases/:id', async (req, res) => {
  const caseId = req.params.id;
  const {
    assessment_date_of_assessment,
    assessment_employment_goals,
    assessment_previous_iset,
    assessment_previous_iset_details,
    assessment_employment_barriers,
    assessment_local_area_priorities,
    assessment_other_funding_details,
    assessment_esdc_eligibility,
    assessment_intervention_start_date,
    assessment_intervention_end_date,
    assessment_institution,
    assessment_program_name,
    assessment_itp,
    assessment_wage,
    assessment_recommendation,
    assessment_justification,
    assessment_nwac_review,
    assessment_nwac_reason,
    case_summary, // <-- add this
    status // <-- add this
  } = req.body;

  // Helper: convert blank to null
  const toNull = v => (v === undefined || v === null || v === '' ? null : v);
  // Helper: ensure JSON fields are valid and currency fields are 0 if blank
  const safeJson = (obj) => {
    if (!obj || typeof obj !== 'object') return JSON.stringify({});
    return JSON.stringify(obj);
  };

  try {
    const [result] = await pool.query(
      `UPDATE iset_case SET
        assessment_date_of_assessment = ?,
        assessment_employment_goals = ?,
        assessment_previous_iset = ?,
        assessment_previous_iset_details = ?,
        assessment_employment_barriers = ?,
        assessment_local_area_priorities = ?,
        assessment_other_funding_details = ?,
        assessment_esdc_eligibility = ?,
        assessment_intervention_start_date = ?,
        assessment_intervention_end_date = ?,
        assessment_institution = ?,
        assessment_program_name = ?,
        assessment_itp = ?,
        assessment_wage = ?,
        assessment_recommendation = ?,
        assessment_justification = ?,
        assessment_nwac_review = ?,
        assessment_nwac_reason = ?,
        case_summary = ?,
        status = COALESCE(?, status)
      WHERE id = ?`,
      [
        toNull(assessment_date_of_assessment),
        toNull(assessment_employment_goals),
        toNull(assessment_previous_iset),
        toNull(assessment_previous_iset_details),
        assessment_employment_barriers ? JSON.stringify(assessment_employment_barriers) : null,
        assessment_local_area_priorities ? JSON.stringify(assessment_local_area_priorities) : null,
        toNull(assessment_other_funding_details),
        toNull(assessment_esdc_eligibility),
        toNull(assessment_intervention_start_date),
        toNull(assessment_intervention_end_date),
        toNull(assessment_institution),
        toNull(assessment_program_name),
        safeJson(assessment_itp),
        safeJson(assessment_wage),
        toNull(assessment_recommendation),
        toNull(assessment_justification),
        toNull(assessment_nwac_review),
        toNull(assessment_nwac_reason),
        toNull(case_summary), // <-- add this
        toNull(status), // <-- add this
        caseId
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    // Fetch the updated case to get user_id, stage, and other info
    const [[caseRow]] = await pool.query(
      `SELECT c.*, a.user_id AS applicant_user_id, a.tracking_id, e.name AS evaluator_name
       FROM iset_case c
       JOIN iset_application a ON c.application_id = a.id
       LEFT JOIN iset_evaluators e ON c.assigned_to_user_id = e.id
       WHERE c.id = ?`,
      [caseId]
    );

    // Log event for coordinator assessment submission
    if (assessment_recommendation && assessment_justification) {
      // Always use applicant's user id for event logging
      const coordinatorName = caseRow.evaluator_name || '';
      await addCaseEvent({
        user_id: caseRow.applicant_user_id,
        case_id: caseId,
        event_type: 'assessment_submitted',
        event_data: {
          evaluator_name: coordinatorName || null,
          tracking_id: caseRow.tracking_id || null,
          message: coordinatorName
            ? `Assessment submitted by coordinator: ${coordinatorName}.`
            : 'Assessment submitted by coordinator.'
        }
      });
    }
    // Log event for NWAC review submission
    if (assessment_nwac_review) {
      // Always use applicant's user id for event logging
      await addCaseEvent({
        user_id: caseRow.applicant_user_id,
        case_id: caseId,
        event_type: 'nwac_review_submitted',
        event_data: {
          evaluator_name: caseRow.evaluator_name || null,
          tracking_id: caseRow.tracking_id || null,
          message: 'NWAC review submitted.'
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating assessment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add API endpoint to update case stage
app.put('/api/cases/:id/stage', async (req, res) => {
  const caseId = req.params.id;
  const { stage } = req.body;
  if (!stage) {
    return res.status(400).json({ error: 'Missing stage in request body' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE iset_case SET stage = ?, last_activity_at = NOW() WHERE id = ?',
      [stage, caseId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Optionally log event
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating case stage:', error);
    res.status(500).json({ error: 'Failed to update case stage' });
  }
});

// Notification Settings Endpoints
// GET all notification settings with template info
app.get('/api/notifications', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT ns.*, nt.name as template_name, nt.language as template_language
            FROM notification_setting ns
            LEFT JOIN notification_template nt ON ns.template_id = nt.id
            ORDER BY ns.event, ns.role, ns.language
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch notification settings' });
    }
});

// POST create or update a notification setting
app.post('/api/notifications', async (req, res) => {
    const { id, event, role, template_id, language, enabled, email_alert } = req.body;
    try {
        if (id) {
            // Update existing
            await pool.query(
                `UPDATE notification_setting SET event=?, role=?, template_id=?, language=?, enabled=?, email_alert=?, updated_at=NOW() WHERE id=?`,
                [event, role, template_id, language, enabled, email_alert ?? 0, id]
            );
            res.json({ success: true, id });
        } else {
            // Insert new
            const [result] = await pool.query(
                `INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert) VALUES (?, ?, ?, ?, ?, ?)`,
                [event, role, template_id, language, enabled, email_alert ?? 0]
            );
            res.json({ success: true, id: result.insertId });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save notification setting' });
    }
});

// DELETE a notification setting
app.delete('/api/notifications/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`DELETE FROM notification_setting WHERE id=?`, [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete notification setting' });
    }
});

// GET all notification events (from iset_event_type)
app.get('/api/events', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT event_type as value, label, description FROM iset_event_type ORDER BY sort_order, event_type');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// GET all roles (from iset_role or static list)
app.get('/api/roles', async (req, res) => {
    try {
        const [roles] = await pool.query('SELECT RoleID as id, RoleName as name, RoleDescription as description FROM role');
        res.status(200).send(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).send({ message: 'Failed to fetch roles' });
    }
});

// New endpoints for users and roles
app.get('/api/users', async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.name, u.email, GROUP_CONCAT(r.RoleName) as role
      FROM user u
      LEFT JOIN user_role_link ur ON u.id = ur.UserID
      LEFT JOIN role r ON ur.RoleID = r.RoleID
      GROUP BY u.id
    `);

    // Anonymise user names
    const anonymisedUsers = users.map(user => ({
      ...user,
      name: maskName(user.name)
    }));

    res.status(200).send(anonymisedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send({ message: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [user] = await pool.query('SELECT id, name FROM user WHERE id = ?', [id]);
    if (user.length === 0) {
      return res.status(404).send({ message: 'User not found' });
    }
    res.status(200).send(user[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send({ message: 'Failed to fetch user' });
  }
});

