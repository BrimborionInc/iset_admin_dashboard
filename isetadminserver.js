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
  process.env.ALLOWED_ORIGIN = 'http://localhost:3000';  // Default for dev
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');

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

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

const pool = mysql.createPool(dbConfig);

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
    // parse JSON safely locally (don't rely on other helpers for forward compatibility)
    const parseJson = v => {
      if (v == null) return null;
      if (typeof v === 'object') return v; // already parsed
      try { return JSON.parse(v); } catch { return null; }
    };
    const out = rows.map(r => ({
      id: r.id,
      key: r.template_key,
      version: r.version,
      type: r.type,
      label: r.label,
      description: r.description ?? null,
      props: parseJson(r.default_props) ?? {},
      editable_fields: parseJson(r.prop_schema) ?? [],
      has_options: !!r.has_options,
      option_schema: parseJson(r.option_schema) ?? null,
      status: r.status
    }));
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
    const [rows] = await pool.query(`
      SELECT 
        a.id AS application_id,
        a.created_at AS submitted_at,
        u.name AS applicant_name,
        u.email,
        a.tracking_id
      FROM iset_application a
      JOIN user u ON a.user_id = u.id
      LEFT JOIN iset_case c ON a.id = c.application_id
      WHERE c.id IS NULL
      ORDER BY a.created_at DESC;
    `);

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
  const userId = 18; // replace with req.user.id when auth is active
  try {
    const [rows] = await pool.query(
      `SELECT
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
       WHERE t.assigned_to_user_id = ? 
         AND t.status IN ('open', 'in_progress')
       ORDER BY 
         t.priority = 'high' DESC,
         t.due_date < CURDATE() DESC,
         t.due_date ASC`,
      [userId]
    );
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
    const [rows] = await pool.query(`
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
      LIMIT 1
    `, [caseId]);

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

  const whereSql = whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : '';

  try {
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
    `, [...params, limit, offset]);
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
    const [[application]] = await pool.query(
      'SELECT * FROM iset_application WHERE id = ?',
      [applicationId]
    );
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get case info (if exists)
    const [[caseRow]] = await pool.query(
      `SELECT id, assigned_to_user_id, status, priority, stage, program_type, case_summary, opened_at, closed_at, last_activity_at, ptma_id FROM iset_case WHERE application_id = ?`,
      [applicationId]
    );

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
    const [[caseRow]] = await pool.query(
      'SELECT assigned_to_user_id FROM iset_case WHERE application_id = ?',
      [applicationId]
    );
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
    const [result] = await pool.query(
      'UPDATE iset_case SET case_summary = ? WHERE application_id = ?',
      [case_summary, applicationId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Case not found for this application' });
    }
    // Return the updated case_summary (and optionally the full case row)
    const [[updatedCase]] = await pool.query(
      'SELECT case_summary FROM iset_case WHERE application_id = ?',
      [applicationId]
    );
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
    const [rows] = await pool.query(`
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
      WHERE e.case_id = ?
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, [caseId, Number(limit), Number(offset)]);
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

