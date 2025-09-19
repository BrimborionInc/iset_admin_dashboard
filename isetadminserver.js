const path = require('path');
const { maskName } = require('./src/utils/utils'); // Update the import statement
const nunjucks = require("nunjucks");
const { getRenderer: getComponentRenderer } = require('./src/server/componentRenderRegistry');

// Configure Nunjucks to use GOV.UK Frontend components
nunjucks.configure([
  path.join(__dirname, 'src', 'server-macros'),
  path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist'),
], {
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
  : path.resolve(__dirname, '.env'); // Development/local path
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
// Workflow normalization (shared preview/publish schema builder)
let buildWorkflowSchema; // lazy require inside try-catch to avoid crash if file missing
try {
  ({ buildWorkflowSchema } = require('./src/workflows/normalizeWorkflow'));
} catch (e) {
  console.warn('[init] normalizeWorkflow module load failed:', e.message);
}
let validateWorkflow;
try { ({ validateWorkflow } = require('./src/workflows/validateComponents')); } catch (e) { console.warn('validator load failed:', e.message); }
// NOTE: SUPPORTED_COMPONENT_TYPES is already defined later in this file for publish support.
// We only attempt to import if not present (in older restored versions). If shadowed, ignore.
let importedSupportedTypes;
try { ({ SUPPORTED_COMPONENT_TYPES: importedSupportedTypes } = require('./src/workflows/constants')); } catch (e) { /* optional */ }

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

// --- Public Linkage Coverage Proxy (moved before auth middleware) ---------
// Returns aggregate, non-sensitive linkage stats from the intake service WITHOUT requiring admin auth.
// Placed here (before Cognito auth mounting) so /api/admin/linkage-stats is publicly reachable.
// Caching: 10s in-memory to reduce upstream load during dashboard refreshes.
let __linkageStatsCache = { ts: 0, ttlMs: 10_000, data: null };
app.get('/api/admin/linkage-stats', async (req, res) => {
  try {
    const baseRaw = process.env.LINKAGE_STATS_URL || process.env.INTAKE_BASE_URL || 'http://localhost:5000';
    const base = /^https?:\/\//i.test(baseRaw) ? baseRaw : `http://${baseRaw}`;
    const url = base.replace(/\/$/, '') + '/api/admin/linkage-stats';

    if (__linkageStatsCache.data && (Date.now() - __linkageStatsCache.ts) < __linkageStatsCache.ttlMs) {
      return res.json({ ...(__linkageStatsCache.data || {}), _cache: true, _source: 'cache', _public: true });
    }

    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

    let resp, text;
    try {
      resp = await fetch(url, { headers: { 'Content-Type': 'application/json' }, timeout: 5000 });
      text = await resp.text();
    } catch (netErr) {
      return res.status(502).json({ error: 'linkage_stats_failed', category: 'network', message: netErr.message, upstreamBase: base });
    }
    if (!resp.ok) {
      return res.status(resp.status === 404 ? 404 : 502).json({ error: 'linkage_stats_failed', category: 'upstream', status: resp.status, body: text.slice(0,500), upstreamBase: base });
    }
    let json;
    try { json = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'linkage_stats_failed', category: 'parse', upstreamBase: base, body: text.slice(0,500) });
    }
    __linkageStatsCache = { ts: Date.now(), ttlMs: __linkageStatsCache.ttlMs, data: json };
    res.json({ ...json, _cache: false, _source: 'upstream', _public: true });
  } catch (e) {
    res.status(500).json({ error: 'linkage_stats_proxy_failed', message: e.message });
  }
});

// --- Upload Config Proxy (for standalone dashboard hitting admin port) ---
// Forwards to intake service which hosts canonical implementation.
// GET  /api/admin/upload-config  -> proxy to {INTAKE_BASE_URL}/api/admin/upload-config
// PATCH /api/admin/upload-config -> proxy body and return result
app.all(['/api/admin/upload-config'], async (req, res) => {
  try {
    const baseRaw = process.env.INTAKE_BASE_URL || 'http://localhost:5000';
    const base = /^https?:\/\//i.test(baseRaw) ? baseRaw : `http://${baseRaw}`;
    const targetUrl = base.replace(/\/$/, '') + '/api/admin/upload-config';
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const method = req.method.toUpperCase();
    if (!['GET','PATCH'].includes(method)) {
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    const headers = { 'Content-Type': 'application/json' };
    // Forward dev bypass + role headers for local auth simulation
    const fwdHeaders = ['x-dev-bypass','x-dev-role','x-dev-userid'];
    for (const h of fwdHeaders) {
      const v = req.headers[h];
      if (v) headers[h] = v;
    }
    // Forward bearer token if present
    if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];
    // Forward cookies if present (for access/id tokens)
    if (req.headers['cookie']) headers['cookie'] = req.headers['cookie'];
    let body;
    if (method === 'PATCH') {
      body = JSON.stringify(req.body || {});
    }
    let upstream;
    try {
      upstream = await fetch(targetUrl, { method, headers, body, timeout: 8000 });
    } catch (netErr) {
      return res.status(502).json({ error: 'upstream_unreachable', message: netErr.message, upstream: targetUrl });
    }
    const text = await upstream.text();
    let json;
    try { json = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'upstream_invalid_json', snippet: text.slice(0,200) });
    }
    res.status(upstream.status).json(json);
  } catch (e) {
    res.status(500).json({ error: 'upload_config_proxy_failed', message: e.message });
  }
});

// Minimal staff profile upsert middleware.
// Purpose: ensure a local operational record exists (mirrors Cognito identity) for future assignment logic.
// Relies on global `pool` defined later in file; waits until pool is available.
async function staffProfileMiddleware(req, res, next) {
  try {
    if (!req.auth || !req.auth.sub) return next();
    // pool may not yet be defined if this middleware executes before DB init section; poll a few ms.
    let attempts = 0;
    while (typeof pool === 'undefined' && attempts < 20) { // ~200ms max wait
      await new Promise(r => setTimeout(r, 10));
      attempts++;
    }
    if (!pool) return next();
    const { sub, email, role, regionId } = req.auth;
    await pool.query(`CREATE TABLE IF NOT EXISTS staff_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cognito_sub VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(320) NULL,
      primary_role VARCHAR(64) NULL,
      /* region_id optional – legacy tables may not have it */
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_role (primary_role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`);
    // Attempt to add region_id if supported (ignore failures / old MySQL not supporting IF NOT EXISTS)
    try { await pool.query('ALTER TABLE staff_profiles ADD COLUMN region_id INT NULL'); } catch(_) {}
    try { await pool.query('ALTER TABLE staff_profiles ADD INDEX idx_region (region_id)'); } catch(_) {}
    // Determine if region_id column exists (cache per process)
    if (typeof global.__HAS_REGION_ID_COL === 'undefined') {
      try {
        await pool.query('SELECT region_id FROM staff_profiles LIMIT 0');
        global.__HAS_REGION_ID_COL = true;
      } catch { global.__HAS_REGION_ID_COL = false; }
    }
    // Ensure non-null email if schema has NOT NULL constraint (fallback to synthetic)
    const safeEmail = email || (sub ? `${sub}@placeholder.local` : 'unknown@placeholder.local');
    if (global.__HAS_REGION_ID_COL) {
      await pool.query(`INSERT INTO staff_profiles (cognito_sub,email,primary_role,region_id) VALUES (?,?,?,?)
        ON DUPLICATE KEY UPDATE email=VALUES(email), primary_role=VALUES(primary_role), region_id=VALUES(region_id)`,
        [sub, safeEmail, role || null, Number.isFinite(regionId) ? regionId : null]);
    } else {
      await pool.query(`INSERT INTO staff_profiles (cognito_sub,email,primary_role) VALUES (?,?,?)
        ON DUPLICATE KEY UPDATE email=VALUES(email), primary_role=VALUES(primary_role)`,
        [sub, safeEmail, role || null]);
    }
    let rows;
    try {
      [rows] = await pool.query('SELECT id, cognito_sub, email, primary_role, region_id FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [sub]);
    } catch (selErr) {
      if (/region_id/.test(selErr.message)) {
        [rows] = await pool.query('SELECT id, cognito_sub, email, primary_role FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [sub]);
      } else throw selErr;
    }
    if (rows && rows[0]) req.staffProfile = rows[0];
  } catch (e) {
    console.warn('[staff_profiles] middleware failed (non-fatal):', e.message);
  } finally {
    return next();
  }
}

// --- Authentication (Cognito) - feature flagged ---
// New: allow local development bypass via DEV_DISABLE_AUTH=true (non-production only)
try {
  const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
  const devDisableAuth = process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
  const devAuthBypass = (process.env.DEV_AUTH_BYPASS === 'true' || process.env.DEV_AUTH_BYPASS === '1') && process.env.NODE_ENV !== 'production';
  if (authProvider === 'cognito' && devDisableAuth) {
    console.warn('\n============================================================');
    console.warn('[AUTH] DEV AUTH BYPASS ACTIVE (DEV_DISABLE_AUTH=true)');
    console.warn('[AUTH] All /api requests are unauthenticated locally.');
    console.warn('[AUTH] DO NOT USE THIS IN PROD. Remove DEV_DISABLE_AUTH to re-enable.');
    console.warn('============================================================\n');
    // Mark responses so calls are visibly unauthenticated in network inspector
    app.use((req, res, next) => { res.setHeader('X-Auth-Bypassed', 'true'); next(); });
  } else if (authProvider === 'cognito') {
    const { authnMiddleware } = require('./src/middleware/authn');
    // Attach auth first, then staff profile enrichment
    app.use('/api', authnMiddleware(), staffProfileMiddleware);
    if (devAuthBypass) {
      console.warn('[AUTH] Cognito auth enabled but DEV_AUTH_BYPASS=true: X-Dev-Bypass header with matching token will short-circuit auth in middleware');
    }
  }
} catch (e) {
  console.warn('Auth middleware init failed:', e?.message);
}

// Mount admin users router (Cognito administrative user lifecycle)
try {
  const adminUsersRouter = require('./src/routes/admin/users');
  app.use('/api/admin', adminUsersRouter);
} catch (e) {
  console.warn('Admin users router mount failed:', e?.message);
}

// Simple auth probe for smoke testing
app.get('/api/auth/me', (req, res) => {
  const enabled = String(process.env.AUTH_PROVIDER || 'none').toLowerCase() === 'cognito';
  if (!enabled) return res.status(200).json({ provider: 'none', auth: null });
  if (!req.auth) return res.status(401).json({ error: 'Unauthenticated' });
  res.json({ provider: 'cognito', auth: req.auth });
});

// List assignable staff for case assignment
// GET /api/staff/assignable
// In dev bypass (IAM off) returns placeholder identities; otherwise queries staff_profiles by allowed roles.
app.get('/api/staff/assignable', async (req, res) => {
  try {
    const iamOn = String(process.env.AUTH_PROVIDER || 'none').toLowerCase() === 'cognito';
    const devBypassEnv = process.env.DEV_DISABLE_AUTH === 'true' || process.env.DEV_AUTH_BYPASS === 'true';
    const isAuthenticated = !!req.auth && iamOn; // real token processed by auth middleware
    // If IAM truly off (not Cognito) -> always placeholders.
    // If IAM on + authenticated -> always real staff (ignore dev bypass env to avoid stale placeholder UI when real users exist).
    // If IAM on but unauthenticated (edge case) -> fallback placeholders so UI can still render Assign modal meaningfully.
    if (!iamOn || (!isAuthenticated && devBypassEnv)) {
      return res.json([
        { id: 'placeholder-admin', email: 'admin@nwac.ca', role: 'Program Administrator', display_name: 'Admin (Program Administrator)' },
        { id: 'placeholder-coordinator', email: 'coordinator@nwac.ca', role: 'Regional Coordinator', display_name: 'Coordinator (Regional Coordinator)' },
        { id: 'placeholder-assessor', email: 'user@nwac.ca', role: 'Application Assessor', display_name: 'Assessor (Application Assessor)' }
      ]);
    }
    const roles = ['Program Administrator','Regional Coordinator','Application Assessor'];
    const [rows] = await pool.query(
      `SELECT id, cognito_sub, email, primary_role AS role, email AS display_name
         FROM staff_profiles
        WHERE primary_role IN (${roles.map(()=>'?').join(',')})
        ORDER BY primary_role, email`, roles);
    res.json(rows.map(r => ({ id: r.id, email: r.email, role: r.role, display_name: r.display_name })));
  } catch (e) {
    console.error('GET /api/staff/assignable failed:', e.message);
    res.status(500).json({ error: 'assignable_fetch_failed' });
  }
});

// PATCH /api/cases/:id/assign { assignee_id | placeholder_email }
// Accepts either a real staff_profiles id or a placeholder email when IAM off.
app.patch('/api/cases/:id/assign', async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  if (!Number.isInteger(caseId) || caseId < 1) return res.status(400).json({ error: 'invalid_case_id' });
  const { assignee_id, placeholder_email } = req.body || {};
  try {
    const [[caseRow]] = await pool.query('SELECT id, application_id, assigned_to_user_id FROM iset_case WHERE id=? LIMIT 1', [caseId]);
    if (!caseRow) return res.status(404).json({ error: 'case_not_found' });
    let assignId = null;
    if (assignee_id) {
      const [[staff]] = await pool.query('SELECT id FROM staff_profiles WHERE id=? LIMIT 1', [assignee_id]);
      if (!staff) return res.status(400).json({ error: 'staff_not_found' });
      assignId = staff.id;
    } else if (placeholder_email) {
      // For placeholders, create ephemeral staff_profiles row if needed (dev mode convenience)
      const emailNorm = String(placeholder_email).toLowerCase();
      const roleMap = {
        'admin@nwac.ca': 'Program Administrator',
        'coordinator@nwac.ca': 'Regional Coordinator',
        'user@nwac.ca': 'Application Assessor'
      };
      const inferredRole = roleMap[emailNorm] || 'Application Assessor';
      const subVal = `placeholder-${emailNorm}`;
      // Try full column set first
      try {
        await pool.query(`INSERT INTO staff_profiles (cognito_sub,email,primary_role) VALUES (?,?,?)
          ON DUPLICATE KEY UPDATE email=VALUES(email), primary_role=VALUES(primary_role)`, [ subVal, placeholder_email, inferredRole ]);
      } catch (insErr) {
        // Fallback: if table definition differs, attempt minimal insert without role then update
        try {
          await pool.query(`INSERT INTO staff_profiles (cognito_sub,email) VALUES (?,?) ON DUPLICATE KEY UPDATE email=VALUES(email)`, [ subVal, placeholder_email ]);
          await pool.query(`UPDATE staff_profiles SET primary_role=? WHERE cognito_sub=? AND (primary_role IS NULL OR primary_role='')`, [ inferredRole, subVal ]);
        } catch (fallbackErr) {
          console.warn('Placeholder staff insert fallback failed:', fallbackErr.message);
        }
      }
      const [[row]] = await pool.query('SELECT id FROM staff_profiles WHERE cognito_sub=? LIMIT 1', [ subVal ]);
      assignId = row?.id || null;
    } else {
      return res.status(400).json({ error: 'assignee_required' });
    }
    await pool.query('UPDATE iset_case SET assigned_to_user_id=?, updated_at=NOW() WHERE id=?', [assignId, caseId]);
    return res.json({ ok: true, case_id: caseId, assigned_to_user_id: assignId });
  } catch (e) {
    console.error('PATCH /api/cases/:id/assign failed:', e.message);
    res.status(500).json({ error: 'assign_failed', message: e.message });
  }
});

// (Removed duplicate linkage-stats route; public version defined earlier before auth.)


// --- AI Chat proxy & status (server-side, avoids exposing API keys in browser) -----
// GET  /api/ai/status -> { enabled: boolean, provider: string|null }
// POST /api/ai/chat   -> OpenRouter streaming/standard chat completion
const AI_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '';
if (!AI_KEY) {
  console.warn('[AI] No OPENROUTER_API_KEY / OPENROUTER_KEY set. /api/ai/chat will return 501 (disabled).');
} else {
  console.log('[AI] OpenRouter key detected. AI translation/chat enabled.');
}
// Simple in-memory cache for model catalog
let __aiModelsCache = { fetchedAt: 0, ttl: 0, data: [] };
async function fetchOpenRouterModels(force = false) {
  const now = Date.now();
  const ttlMs = (parseInt(process.env.OPENROUTER_MODELS_TTL || '3600', 10) || 3600) * 1000;
  if (!force && __aiModelsCache.data.length && (now - __aiModelsCache.fetchedAt) < __aiModelsCache.ttl) {
    return { fromCache: true, models: __aiModelsCache.data };
  }
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (AI_KEY) headers.Authorization = `Bearer ${AI_KEY}`;
    const resp = await axios.get('https://openrouter.ai/api/v1/models', { headers, timeout: 10000 });
    const raw = resp.data?.data || resp.data?.models || [];
    // Normalize subset of useful fields
    const models = raw.map(m => ({
      id: m.id || m.name || m.slug,
      name: m.name || m.id,
      context: m.context_length || m.context_length_tokens || m.context || null,
      pricing: m.pricing || m.cost || null,
      description: m.description || '',
      architecture: m.architecture || m.family || null,
      provider: m.provider || (m.id ? m.id.split('/')[0] : null)
    })).filter(m => m.id);
    __aiModelsCache = { fetchedAt: now, ttl: ttlMs, data: models };
    return { fromCache: false, models };
  } catch (e) {
    console.warn('[AI] fetch models failed:', e.message);
    return { fromCache: false, models: [] };
  }
}
// Policy allowlist: env OPENROUTER_ALLOWED_MODELS (comma) or prefixes OPENROUTER_ALLOWED_PREFIXES
function isModelAllowed(modelId) {
  if (!modelId) return false;
  const allowModels = (process.env.OPENROUTER_ALLOWED_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowModels.length && allowModels.includes(modelId)) return true;
  const allowPrefixes = (process.env.OPENROUTER_ALLOWED_PREFIXES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowPrefixes.length && allowPrefixes.some(p => modelId.startsWith(p))) return true;
  // Fallback to legacy prefix list if none configured
  if (!allowModels.length && !allowPrefixes.length) {
    const legacy = ['openai/','mistralai/','anthropic/','google/','meta/'];
    return legacy.some(p => modelId.startsWith(p));
  }
  return false;
}
// GET /api/ai/models -> dynamic model catalog (role not strictly required but we may restrict later)
app.get('/api/ai/models', async (req, res) => {
  try {
    const { models, fromCache } = await fetchOpenRouterModels(Boolean(req.query.force));
    // Apply allowlist filter
    const filtered = models.filter(m => isModelAllowed(m.id));
    res.json({ count: filtered.length, fromCache, ttlSeconds: (parseInt(process.env.OPENROUTER_MODELS_TTL || '3600',10)||3600), models: filtered });
  } catch (e) {
    res.status(500).json({ error: 'models_fetch_failed', message: e.message });
  }
});
app.get('/api/ai/status', (_req, res) => {
  const enabled = !!AI_KEY;
  const configuredModel = (process.env.OPENROUTER_MODEL || '').trim();
  const params = {
    temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
    top_p: parseFloat(process.env.OPENROUTER_TOP_P || '1'),
    max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '0', 10) || null,
    presence_penalty: parseFloat(process.env.OPENROUTER_PRESENCE_PENALTY || '0'),
    frequency_penalty: parseFloat(process.env.OPENROUTER_FREQUENCY_PENALTY || '0')
  };
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  res.json({ enabled, provider: enabled ? 'openrouter' : null, model: (global.__AI_MODEL_OVERRIDE || configuredModel || 'mistralai/mistral-7b-instruct'), params, fallbacks });
});
// Body: { messages: [{ role, content }], model? }
app.post('/api/ai/chat', async (req, res) => {
  try {
    const key = AI_KEY;
    if (!key) {
      return res.status(501).json({ error: 'ai_disabled', message: 'AI assistant disabled (missing API key).' });
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
    const FALLBACK_MODEL = 'mistralai/mistral-7b-instruct';
  const defaultModel = (global.__AI_MODEL_OVERRIDE || process.env.OPENROUTER_MODEL || '').trim() || FALLBACK_MODEL;
    const requestedModel = (typeof model === 'string' && model.trim()) ? model.trim() : null;
    const mdl = requestedModel || defaultModel;
    const headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.ALLOWED_ORIGIN || 'http://localhost:3001',
      'X-Title': 'Admin Dashboard Assistant',
    };
    // Generation params (defaults from env; allow per-request override if provided)
    const params = {
      temperature: Math.min(2, Math.max(0, typeof req.body.temperature === 'number' ? req.body.temperature : parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'))),
      top_p: Math.min(1, Math.max(0, typeof req.body.top_p === 'number' ? req.body.top_p : parseFloat(process.env.OPENROUTER_TOP_P || '1'))),
      presence_penalty: Math.min(2, Math.max(-2, typeof req.body.presence_penalty === 'number' ? req.body.presence_penalty : parseFloat(process.env.OPENROUTER_PRESENCE_PENALTY || '0'))),
      frequency_penalty: Math.min(2, Math.max(-2, typeof req.body.frequency_penalty === 'number' ? req.body.frequency_penalty : parseFloat(process.env.OPENROUTER_FREQUENCY_PENALTY || '0'))),
    };
    const maxTokensEnv = parseInt(process.env.OPENROUTER_MAX_TOKENS || '0', 10);
    const max_tokens = typeof req.body.max_tokens === 'number' ? req.body.max_tokens : (maxTokensEnv > 0 ? maxTokensEnv : undefined);
    if (max_tokens && (!Number.isInteger(max_tokens) || max_tokens < 1)) return res.status(400).json({ error: 'invalid_max_tokens' });
    const fallbacksChain = (process.env.OPENROUTER_FALLBACK_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
    const attempted = [];
    async function tryModel(modelId) {
      attempted.push(modelId);
      const payload = { model: modelId, messages: safeMessages, ...params };
      if (max_tokens) payload.max_tokens = max_tokens;
      return axios.post('https://openrouter.ai/api/v1/chat/completions', payload, { headers });
    }
    let resp;
    let primaryError = null;
    try {
      resp = await tryModel(mdl);
    } catch (err) {
      primaryError = err;
      const status = err?.response?.status;
      // Iterate fallbacks if configured error and chain exists
      if ([400,401,402,403,404,422].includes(Number(status)) && fallbacksChain.length) {
        for (const fb of fallbacksChain) {
          if (fb === mdl) continue; // skip if same
            try {
              resp = await tryModel(fb);
              return res.status(200).json({ ...resp.data, _fallbackChain: attempted });
            } catch (e2) {
              continue;
            }
        }
      }
      const details = err?.response?.data || { message: err.message };
      return res.status(status || 500).json({ error: 'proxy_failed', details, attempted, _fallbackChain: attempted });
    }
    res.status(200).json({ ...resp.data, _attempted: attempted });
  } catch (e) {
    const status = e?.response?.status || 500;
    const details = e?.response?.data || { message: e.message };
    res.status(status).json({ error: 'proxy_failed', details });
  }
});

// PATCH /api/config/runtime/ai-model  { model: "model-name" }
// Non-persistent (in-memory) override for active session; requires System Administrator role when auth enabled
app.patch('/api/config/runtime/ai-model', async (req, res) => {
  try {
    const body = req.body || {};
    const nextModel = (body.model || '').trim();
    if (!nextModel) return res.status(400).json({ error: 'model_required' });
    // Basic allowlist (can be expanded)
    const allowedPrefixes = ['openai/', 'mistralai/', 'anthropic/', 'google/', 'meta/'];
    if (!allowedPrefixes.some(p => nextModel.startsWith(p))) {
      return res.status(400).json({ error: 'unsupported_model', message: 'Model prefix not allowed in this environment.' });
    }
    // Authorization: if auth provider enabled, require SysAdmin
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    let effectiveRole = req.auth?.role;
    if ((!effectiveRole || devAuthBypassed) && !req.auth) {
      // Attempt to derive role from dev bypass header (since auth middleware not attached in bypass mode)
      const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role');
      if (hdrRole) effectiveRole = hdrRole;
    }
    if (authProvider === 'cognito' && !devAuthBypassed) {
      if (effectiveRole !== 'System Administrator') return res.status(403).json({ error: 'forbidden' });
    } else {
      // Non-cognito or bypass mode: still enforce role if header provided; allow if System Administrator else forbid
      if (effectiveRole && effectiveRole !== 'System Administrator') {
        return res.status(403).json({ error: 'forbidden' });
      }
    }
    const prev = global.__AI_MODEL_OVERRIDE || process.env.OPENROUTER_MODEL || '';
    // Persist to .env file (atomic-ish replace). We retain previous lines & replace/append OPENROUTER_MODEL.
    let persisted = false;
    try {
      const envFile = dotenvPath; // resolved earlier depending on NODE_ENV
      let content = '';
      try { content = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''; } catch { /* ignore read error */ }
      const lines = content.split(/\r?\n/);
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*OPENROUTER_MODEL\s*=/.test(lines[i])) { lines[i] = `OPENROUTER_MODEL=${nextModel}`; found = true; break; }
      }
      if (!found) {
        if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
        lines.push(`OPENROUTER_MODEL=${nextModel}`);
      }
      const newContent = lines.join('\n');
      // Write via temp file then rename for a bit more safety
      const tmpPath = envFile + '.tmp';
      fs.writeFileSync(tmpPath, newContent, 'utf8');
      fs.renameSync(tmpPath, envFile);
      persisted = true;
      // Reflect immediately in process env & clear volatile override
      process.env.OPENROUTER_MODEL = nextModel;
      delete global.__AI_MODEL_OVERRIDE;
    } catch (fileErr) {
      // Fall back to in-memory override if file write fails
      global.__AI_MODEL_OVERRIDE = nextModel;
      console.warn('[ai-model] Failed to persist to .env, using in-memory override only:', fileErr.message);
    }
    // Also persist to shared runtime_config for public scope so portal can consume
    try {
      await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
      await pool.query("INSERT INTO iset_runtime_config (scope,k,v) VALUES ('public','ai.model',JSON_OBJECT('model',?)) ON DUPLICATE KEY UPDATE v=VALUES(v)", [ nextModel ]);
    } catch (dbErr) {
      console.warn('[ai-model] DB persist failed (non-fatal):', dbErr.message);
    }
    // Lightweight audit log (stdout). Could be extended to DB later.
    console.log('[audit] ai-model-change', JSON.stringify({ when: new Date().toISOString(), prev, next: nextModel, by: req.auth?.sub || 'dev-bypass', role: effectiveRole || null, persisted }));
    res.json({ ok: true, model: nextModel, persisted });
  } catch (e) {
    res.status(500).json({ error: 'ai_model_update_failed', message: e.message });
  }
});

// GET current AI generation params & fallbacks
app.get('/api/config/runtime/ai-params', (req, res) => {
  try {
    const params = {
      temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
      top_p: parseFloat(process.env.OPENROUTER_TOP_P || '1'),
      max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '0', 10) || null,
      presence_penalty: parseFloat(process.env.OPENROUTER_PRESENCE_PENALTY || '0'),
      frequency_penalty: parseFloat(process.env.OPENROUTER_FREQUENCY_PENALTY || '0')
    };
    const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
    res.json({ params, fallbacks });
  } catch (e) {
    res.status(500).json({ error: 'ai_params_fetch_failed', message: e.message });
  }
});

function persistEnvUpdates(updates) {
  const envFile = dotenvPath;
  let content = '';
  try { content = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''; } catch { /* ignore */ }
  const lines = content.split(/\r?\n/);
  const map = new Map();
  for (const l of lines) {
    const m = l.match(/^\s*([^#=]+?)\s?=\s?(.*)$/);
    if (m) map.set(m[1].trim(), m[2]);
  }
  Object.entries(updates).forEach(([k,v]) => { if (v === null || typeof v === 'undefined') return; map.set(k, String(v)); });
  const newLines = [];
  const seen = new Set();
  for (const l of lines) {
    const m = l.match(/^\s*([^#=]+?)\s?=/);
    if (m) {
      const key = m[1].trim();
      if (updates[key] !== undefined && !seen.has(key)) {
        newLines.push(`${key}=${map.get(key)}`);
        seen.add(key);
        continue;
      }
    }
    newLines.push(l);
  }
  for (const [k,v] of Object.entries(updates)) {
    if (!seen.has(k)) newLines.push(`${k}=${v}`);
  }
  const finalContent = newLines.join('\n');
  const tmp = envFile + '.tmp';
  fs.writeFileSync(tmp, finalContent, 'utf8');
  fs.renameSync(tmp, envFile);
  // Reflect into process.env
  Object.entries(updates).forEach(([k,v]) => { process.env[k] = String(v); });
}

// PATCH AI generation params
app.patch('/api/config/runtime/ai-params', async (req, res) => {
  try {
    const body = req.body || {};
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    let role = req.auth?.role;
    if ((!role || devAuthBypassed) && !req.auth) {
      const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role');
      if (hdrRole) role = hdrRole;
    }
    if (role !== 'System Administrator') return res.status(403).json({ error: 'forbidden' });
    const toNumberOrNull = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const temperature = toNumberOrNull(body.temperature);
    const top_p = toNumberOrNull(body.top_p);
    const max_tokens = toNumberOrNull(body.max_tokens);
    const presence_penalty = toNumberOrNull(body.presence_penalty);
    const frequency_penalty = toNumberOrNull(body.frequency_penalty);
    function inRange(val, min, max) { return typeof val === 'number' && !Number.isNaN(val) && val >= min && val <= max; }
    if (temperature !== null && !inRange(temperature, 0, 2)) return res.status(400).json({ error: 'invalid_temperature' });
    if (top_p !== null && !inRange(top_p, 0, 1)) return res.status(400).json({ error: 'invalid_top_p' });
    if (presence_penalty !== null && !inRange(presence_penalty, -2, 2)) return res.status(400).json({ error: 'invalid_presence_penalty' });
    if (frequency_penalty !== null && !inRange(frequency_penalty, -2, 2)) return res.status(400).json({ error: 'invalid_frequency_penalty' });
    if (max_tokens !== null && (!Number.isInteger(max_tokens) || max_tokens < 1)) return res.status(400).json({ error: 'invalid_max_tokens' });
    const updates = {};
    if (temperature !== null) updates.OPENROUTER_TEMPERATURE = temperature;
    if (top_p !== null) updates.OPENROUTER_TOP_P = top_p;
    if (max_tokens !== null) updates.OPENROUTER_MAX_TOKENS = max_tokens;
    if (presence_penalty !== null) updates.OPENROUTER_PRESENCE_PENALTY = presence_penalty;
    if (frequency_penalty !== null) updates.OPENROUTER_FREQUENCY_PENALTY = frequency_penalty;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'no_updates' });
    try { persistEnvUpdates(updates); } catch (e) { return res.status(500).json({ error: 'persist_failed', message: e.message }); }
    try {
      const payload = {};
      if (updates.OPENROUTER_TEMPERATURE !== undefined) payload.temperature = Number(updates.OPENROUTER_TEMPERATURE);
      if (updates.OPENROUTER_TOP_P !== undefined) payload.top_p = Number(updates.OPENROUTER_TOP_P);
      if (updates.OPENROUTER_PRESENCE_PENALTY !== undefined) payload.presence_penalty = Number(updates.OPENROUTER_PRESENCE_PENALTY);
      if (updates.OPENROUTER_FREQUENCY_PENALTY !== undefined) payload.frequency_penalty = Number(updates.OPENROUTER_FREQUENCY_PENALTY);
      if (updates.OPENROUTER_MAX_TOKENS !== undefined) payload.max_tokens = Number(updates.OPENROUTER_MAX_TOKENS);
      await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
      await pool.query("INSERT INTO iset_runtime_config (scope,k,v) VALUES ('public','ai.params',JSON_OBJECT('temperature',?, 'top_p',?, 'presence_penalty',?, 'frequency_penalty',?, 'max_tokens', ?)) ON DUPLICATE KEY UPDATE v=VALUES(v)", [ payload.temperature ?? null, payload.top_p ?? null, payload.presence_penalty ?? null, payload.frequency_penalty ?? null, payload.max_tokens ?? null ]);
    } catch (dbErr) {
      console.warn('[ai-params] DB persist failed (non-fatal):', dbErr.message);
    }
    console.log('[audit] ai-params-change', JSON.stringify({ when: new Date().toISOString(), updates, by: req.auth?.sub || 'dev-bypass', role }));
    res.json({ ok: true, updates });
  } catch (e) { res.status(500).json({ error: 'ai_params_update_failed', message: e.message }); }
});

// PATCH AI fallback chain (comma-separated list)
app.patch('/api/config/runtime/ai-fallbacks', async (req, res) => {
  try {
    const body = req.body || {};
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    let role = req.auth?.role;
    if ((!role || devAuthBypassed) && !req.auth) {
      const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role'); if (hdrRole) role = hdrRole;
    }
    if (role !== 'System Administrator') return res.status(403).json({ error: 'forbidden' });
    const listRaw = body.fallbackModels || body.fallbacks || [];
    const list = Array.isArray(listRaw) ? listRaw : String(listRaw).split(',');
    const cleaned = list.map(s => String(s).trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
    for (const mdl of cleaned) { if (!isModelAllowed(mdl)) return res.status(400).json({ error: 'unsupported_model_in_fallbacks', model: mdl }); }
    try { persistEnvUpdates({ OPENROUTER_FALLBACK_MODELS: cleaned.join(',') }); } catch (e) { return res.status(500).json({ error: 'persist_failed', message: e.message }); }
    try {
      await pool.query("CREATE TABLE IF NOT EXISTS iset_runtime_config (id INT AUTO_INCREMENT PRIMARY KEY, scope VARCHAR(32) NOT NULL, k VARCHAR(128) NOT NULL, v JSON NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY uniq_scope_key (scope,k)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
      await pool.query("INSERT INTO iset_runtime_config (scope,k,v) VALUES ('public','ai.fallbacks', CAST(? AS JSON)) ON DUPLICATE KEY UPDATE v=VALUES(v)", [ JSON.stringify(cleaned) ]);
    } catch (dbErr) {
      console.warn('[ai-fallbacks] DB persist failed (non-fatal):', dbErr.message);
    }
    console.log('[audit] ai-fallbacks-change', JSON.stringify({ when: new Date().toISOString(), fallbackModels: cleaned, by: req.auth?.sub || 'dev-bypass', role }));
    res.json({ ok: true, fallbackModels: cleaned });
  } catch (e) { res.status(500).json({ error: 'ai_fallbacks_update_failed', message: e.message }); }
});

// --- Runtime Configuration Introspection (non-secret) -----------------------
// GET /api/config/runtime -> selected non-sensitive runtime configuration values
// NOTE: Only exposes values safe for admin viewing; secrets go through /api/config/security
// ---------------- Multi-scope Auth Runtime (Phase 4) ----------------
// Persistent (filesystem JSON) multi-scope auth configuration
// Public-only fields: maxPasswordResetsPerDay, anomalyProtection
const authConfigPath = process.env.AUTH_CONFIG_FILE || path.resolve(__dirname, 'db', 'auth-config.json');

function deepMerge(to, from) {
  if (!from || typeof from !== 'object') return to;
  Object.keys(from).forEach(k => {
    const fv = from[k];
    if (fv && typeof fv === 'object' && !Array.isArray(fv)) {
      if (!to[k] || typeof to[k] !== 'object') to[k] = {};
      deepMerge(to[k], fv);
    } else {
      to[k] = fv;
    }
  });
  return to;
}

function defaultAuthConfig() {
  return {
    admin: {
      tokenTtl: { access: 3600, id: 3600, refresh: 86400, frontendIdle: 900, absolute: 28800 },
      policy: {
        mfaMode: 'optional',
        pkceRequired: true,
        passwordPolicy: { minLength: 12, requireUpper: true, requireLower: true, requireNumber: true, requireSymbol: false },
        lockout: { threshold: 5, durationSeconds: 900 },
        federation: { providers: [], lastSync: null }
      }
    },
    public: {
      tokenTtl: { access: 3600, id: 3600, refresh: 86400, frontendIdle: 900, absolute: 28800 },
      policy: {
        mfaMode: 'off',
        pkceRequired: true,
        passwordPolicy: { minLength: 12, requireUpper: true, requireLower: true, requireNumber: true, requireSymbol: false },
        lockout: { threshold: 5, durationSeconds: 900 },
        federation: { providers: [], lastSync: null },
        maxPasswordResetsPerDay: 5,
        anomalyProtection: 'standard'
      }
    }
  };
}

function loadAuthConfigFromFile() {
  try {
    if (fs.existsSync(authConfigPath)) {
      const raw = fs.readFileSync(authConfigPath, 'utf8');
      const parsed = JSON.parse(raw);
      return deepMerge(defaultAuthConfig(), parsed);
    }
  } catch (e) {
    console.warn('[auth-config] Failed reading persisted auth config, using defaults:', e.message);
  }
  return defaultAuthConfig();
}

function persistAuthConfig(cfg) {
  try {
    const dir = path.dirname(authConfigPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = authConfigPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
    fs.renameSync(tmp, authConfigPath);
  } catch (e) {
    console.warn('[auth-config] Persist failed:', e.message);
  }
}

const __authConfig = global.__authConfig || (global.__authConfig = loadAuthConfigFromFile());

function sysAdminOnly(req) {
  const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
  const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
  let role = req.auth?.role;
  if ((!role || devAuthBypassed) && !req.auth) {
    const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role');
    if (hdrRole) role = hdrRole;
  }
  // Normalize legacy / short group codes (e.g., "SysAdmin") to canonical display roles
  const normalizeRole = (r) => {
    if (!r) return r;
    const map = {
      SysAdmin: 'System Administrator',
      'System Administrator': 'System Administrator'
    };
    return map[r] || r;
  };
  return normalizeRole(role) === 'System Administrator';
}

app.get('/api/config/runtime', (req, res) => {
  try {
    const enabled = !!AI_KEY;
    const aiModel = (process.env.OPENROUTER_MODEL || '').trim() || 'mistralai/mistral-7b-instruct';
    const aiParams = {
      temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.7'),
      top_p: parseFloat(process.env.OPENROUTER_TOP_P || '1'),
      max_tokens: parseInt(process.env.OPENROUTER_MAX_TOKENS || '0',10) || null,
      presence_penalty: parseFloat(process.env.OPENROUTER_PRESENCE_PENALTY || '0'),
      frequency_penalty: parseFloat(process.env.OPENROUTER_FREQUENCY_PENALTY || '0')
    };
    const fallbackModels = (process.env.OPENROUTER_FALLBACK_MODELS || '').split(',').map(s=>s.trim()).filter(Boolean);
    const authProvider = String(process.env.AUTH_PROVIDER || 'none');
    const devBypass = process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const nodeEnv = process.env.NODE_ENV || 'development';
    const authAdmin = __authConfig.admin;
    const authPublic = __authConfig.public;
    res.json({
      ai: { enabled, model: aiModel, params: aiParams, fallbackModels },
      auth: { // legacy combined surface (admin-focused)
        tokenTtl: authAdmin.tokenTtl,
        mfa: { mode: authAdmin.policy.mfaMode },
        passwordPolicy: authAdmin.policy.passwordPolicy,
        lockout: authAdmin.policy.lockout,
        pkceRequired: authAdmin.policy.pkceRequired,
        devBypass,
        provider: authProvider
      },
      authAdmin: {
        provider: 'cognito',
        issuer: process.env.COGNITO_ISSUER || '',
        tokenTtl: authAdmin.tokenTtl,
        mfa: { mode: authAdmin.policy.mfaMode },
        passwordPolicy: authAdmin.policy.passwordPolicy,
        lockout: authAdmin.policy.lockout,
        pkceRequired: authAdmin.policy.pkceRequired,
        federation: authAdmin.policy.federation
      },
      authPublic: {
        provider: 'cognito',
        issuer: process.env.COGNITO_ISSUER || '',
        tokenTtl: authPublic.tokenTtl,
        mfa: { mode: authPublic.policy.mfaMode },
        passwordPolicy: authPublic.policy.passwordPolicy,
        lockout: authPublic.policy.lockout,
        pkceRequired: authPublic.policy.pkceRequired,
        federation: authPublic.policy.federation,
        maxPasswordResetsPerDay: authPublic.policy.maxPasswordResetsPerDay,
        anomalyProtection: authPublic.policy.anomalyProtection
      },
      cors: { allowedOrigins },
      env: { nodeEnv }
    });
  } catch (e) {
    res.status(500).json({ error: 'config_runtime_failed', message: e.message });
  }
});

// PATCH auth session TTLs (supports scope=admin|public, fallback both if none)
app.patch('/api/config/runtime/auth-session', (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const scope = (req.query.scope || '').toLowerCase();
    if (scope && !['admin','public'].includes(scope)) return res.status(400).json({ error: 'invalid_scope' });
    const ttl = (req.body || {}).tokenTtl || {};
    const apply = target => {
      ['access','id','refresh','frontendIdle','absolute'].forEach(k => { if (ttl[k] !== undefined) target.tokenTtl[k] = ttl[k]; });
    };
  if (scope) apply(__authConfig[scope]); else { apply(__authConfig.admin); apply(__authConfig.public); }
  persistAuthConfig(__authConfig);
  res.json({ tokenTtl: scope ? __authConfig[scope].tokenTtl : { ...__authConfig.admin.tokenTtl } });
  } catch (e) { res.status(500).json({ error: 'auth_session_update_failed', message: e.message }); }
});

// PATCH auth policy (scope)
app.patch('/api/config/runtime/auth-policy', (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const scope = (req.query.scope || '').toLowerCase();
    if (scope && !['admin','public'].includes(scope)) return res.status(400).json({ error: 'invalid_scope' });
    const body = req.body || {};
    const apply = target => {
      if (body.mfa && typeof body.mfa.mode === 'string') target.policy.mfaMode = body.mfa.mode;
      if (body.pkceRequired !== undefined) target.policy.pkceRequired = !!body.pkceRequired;
      if (body.passwordPolicy) target.policy.passwordPolicy = { ...target.policy.passwordPolicy, ...body.passwordPolicy };
      if (body.lockout) target.policy.lockout = { ...target.policy.lockout, ...body.lockout };
    };
    if (scope) apply(__authConfig[scope]); else { apply(__authConfig.admin); apply(__authConfig.public); }
    // Public-only fields
    if (body.maxPasswordResetsPerDay !== undefined && (!scope || scope === 'public')) {
      const target = scope ? __authConfig[scope] : __authConfig.public; // if both, only apply to public
      target.policy.maxPasswordResetsPerDay = Number(body.maxPasswordResetsPerDay) || 0;
    }
    if (body.anomalyProtection && (!scope || scope === 'public')) {
      const target = scope ? __authConfig[scope] : __authConfig.public;
      target.policy.anomalyProtection = String(body.anomalyProtection);
    }
    persistAuthConfig(__authConfig);
    const src = scope ? __authConfig[scope] : __authConfig.admin;
    const pub = __authConfig.public;
    const base = {
      mfa: { mode: src.policy.mfaMode },
      passwordPolicy: src.policy.passwordPolicy,
      lockout: src.policy.lockout,
      pkceRequired: src.policy.pkceRequired
    };
    if (scope === 'public') {
      base.maxPasswordResetsPerDay = pub.policy.maxPasswordResetsPerDay;
      base.anomalyProtection = pub.policy.anomalyProtection;
    }
    res.json(base);
  } catch (e) { res.status(500).json({ error: 'auth_policy_update_failed', message: e.message }); }
});

// Federation sync (dummy timestamp update for now)
app.post('/api/config/runtime/auth-federation-sync', (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const scope = (req.query.scope || '').toLowerCase();
    if (scope && !['admin','public'].includes(scope)) return res.status(400).json({ error: 'invalid_scope' });
    const now = new Date().toISOString();
    const apply = target => { target.policy.federation.lastSync = now; };
  if (scope) apply(__authConfig[scope]); else { apply(__authConfig.admin); apply(__authConfig.public); }
  persistAuthConfig(__authConfig);
  res.json({ lastSync: now });
  } catch (e) { res.status(500).json({ error: 'auth_federation_sync_failed', message: e.message }); }
});

// GET /api/config/security -> secret presence + masked forms (never full secret values)
app.get('/api/config/security', (req, res) => {
  try {
    // Derive effective role (mirror logic used in ai-model PATCH for consistency)
    const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
    const devAuthBypassed = authProvider === 'cognito' && process.env.DEV_DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production';
    let effectiveRole = req.auth?.role || null;
    if ((!effectiveRole || devAuthBypassed) && !req.auth) {
      const hdrRole = req.get('x-dev-role') || req.get('X-Dev-Role');
      if (hdrRole) effectiveRole = hdrRole;
    }
    const MASK_LEVEL = (() => {
      if (effectiveRole === 'System Administrator') return 'admin'; // standard masked view
      if (effectiveRole === 'Program Administrator') return 'restricted'; // heavily masked
      return 'none'; // no visibility
    })();
    const baseMask = (val) => {
      if (!val) return { present: false, masked: null };
      const str = String(val);
      if (str.length <= 8) return { present: true, masked: str[0] + '***' + str.slice(-1) };
      return { present: true, masked: str.slice(0, 4) + '***' + str.slice(-4) };
    };
    const restrictedRemask = (masked) => {
      if (!masked) return null;
      // Replace all but last 2 visible chars with * to further restrict
      return masked.replace(/.(?=..$)/g, '*');
    };
    const secretDefs = [
      { key: 'OPENROUTER_API_KEY', val: process.env.OPENROUTER_API_KEY },
      { key: 'OPENROUTER_KEY', val: process.env.OPENROUTER_KEY },
      { key: 'DB_PASS', val: process.env.DB_PASS },
      { key: 'DEV_DB_KEY', val: process.env.DEV_DB_KEY },
    ];
    let secrets = [];
    if (MASK_LEVEL !== 'none') {
      secrets = secretDefs.map(s => {
        const masked = baseMask(s.val);
        if (MASK_LEVEL === 'restricted' && masked.present) {
          return { key: s.key, present: true, masked: restrictedRemask(masked.masked) };
        }
        return { key: s.key, present: masked.present, masked: masked.masked };
      });
    }
    res.json({ role: effectiveRole, visibility: MASK_LEVEL, secrets });
  } catch (e) {
    res.status(500).json({ error: 'config_security_failed', message: e.message });
  }
});

// ---------------- Session Audit (Phase 8) -----------------
// Endpoints assume audit table (created by intake service) exists in same DB.
// Protected: System Administrator only.
app.get('/api/audit/session/stats', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const [[agg]] = await pool.query(`SELECT COUNT(*) total, MIN(issued_at) oldest, MAX(last_seen_at) newest FROM user_session_audit`).catch(()=>[[{ total:0, oldest:null, newest:null }]]);
    const [[last24]] = await pool.query(`SELECT COUNT(DISTINCT user_id) active_users_24h, COUNT(*) rows_24h FROM user_session_audit WHERE last_seen_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`).catch(()=>[[{ active_users_24h:0, rows_24h:0 }]]);
    res.json({ total: agg.total, oldest: agg.oldest, newest: agg.newest, activeUsers24h: last24.active_users_24h, rows24h: last24.rows_24h });
  } catch (e) { res.status(500).json({ error: 'session_audit_stats_failed', message: e.message }); }
});
app.get('/api/audit/session/recent', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit||'50',10)));
    const [rows] = await pool.query(`SELECT user_id, session_key, issued_at, last_seen_at, ip_hash, user_agent_hash FROM user_session_audit ORDER BY last_seen_at DESC LIMIT ?`, [limit]);
    res.json({ count: rows.length, sessions: rows });
  } catch (e) { res.status(500).json({ error: 'session_audit_recent_failed', message: e.message }); }
});
app.post('/api/audit/session/prune', async (req, res) => {
  try {
    if (!sysAdminOnly(req)) return res.status(403).json({ error: 'forbidden' });
    const days = Math.min(365, Math.max(1, parseInt(req.query.days||req.body?.days||'60',10)));
    const [result] = await pool.query(`DELETE FROM user_session_audit WHERE last_seen_at < DATE_SUB(NOW(), INTERVAL ? DAY)`, [days]);
    res.json({ pruned: result.affectedRows || 0, olderThanDays: days });
  } catch (e) { res.status(500).json({ error: 'session_audit_prune_failed', message: e.message }); }
});

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

const pool = mysql.createPool(dbConfig);

// --- Simple SQL Migration Runner (auto-executes .sql files in /sql once) -----------------
// Strategy:
// 1. Ensure tracking table `iset_migration` (id, filename, checksum, applied_at, duration_ms, success, error_snippet).
// 2. Read all *.sql files in ./sql (non-recursive), sort by filename asc.
// 3. For each file, compute SHA256 checksum. If filename+checksum already recorded with success=1, skip.
// 4. Execute file contents via single multi-statement split on /;\n/ boundaries (basic splitter ignoring inside strings is overkill here; assume migration scripts are simple). If any statement fails, record failure (first 500 chars of error) and stop further execution to avoid partial ordering surprises.
// 5. Log summary.
// ENV Controls:
//   DISABLE_AUTO_MIGRATIONS=true -> skip runner.
//   AUTO_MIGRATIONS_DRY_RUN=true -> report pending without executing.
// Notes: idempotency encouraged inside scripts; runner only executes once per checksum.
(async () => {
  try {
    if (String(process.env.DISABLE_AUTO_MIGRATIONS || 'false').toLowerCase() === 'true') {
      console.log('[migrations] Auto migration runner disabled via DISABLE_AUTO_MIGRATIONS');
      return;
    }
    const sqlDir = path.join(__dirname, 'sql');
    if (!fs.existsSync(sqlDir)) {
      console.log('[migrations] No sql directory present, skipping');
      return;
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS iset_migration (\n      id INT AUTO_INCREMENT PRIMARY KEY,\n      filename VARCHAR(255) NOT NULL,\n      checksum CHAR(64) NOT NULL,\n      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n      duration_ms INT NOT NULL,\n      success TINYINT(1) NOT NULL DEFAULT 1,\n      error_snippet TEXT NULL,\n      UNIQUE KEY uniq_filename_checksum (filename, checksum)\n    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    const [appliedRows] = await pool.query('SELECT filename, checksum, success FROM iset_migration');
    const appliedMap = new Map(appliedRows.map(r => [r.filename + '|' + r.checksum, r]));
    const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();
    if (!files.length) { console.log('[migrations] No .sql files found'); return; }
    const crypto = require('crypto');
    const pending = [];
    for (const file of files) {
      const full = path.join(sqlDir, file);
      const content = fs.readFileSync(full, 'utf8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');
      if (appliedMap.has(file + '|' + checksum)) continue; // already applied this exact content
      pending.push({ file, full, content, checksum });
    }
    if (!pending.length) { console.log('[migrations] No pending migrations'); return; }
    const dryRun = String(process.env.AUTO_MIGRATIONS_DRY_RUN || 'false').toLowerCase() === 'true';
    if (dryRun) {
      console.log('[migrations] DRY RUN pending migrations:', pending.map(p => p.file));
      return;
    }
    console.log('[migrations] Applying', pending.length, 'migration(s):', pending.map(p => p.file).join(', '));
    for (const m of pending) {
      const start = Date.now();
      let success = 0; let errorSnippet = null;
      try {
        // Basic split: keep statements simple; allow DELIMITER not used in our scripts.
        const statements = m.content
          .split(/;\s*\n+/) // split on semicolon followed by newline(s)
          .map(s => s.trim())
          .filter(s => s.length);
        for (const stmt of statements) {
          await pool.query(stmt);
        }
        success = 1;
        console.log(`[migrations] Applied ${m.file} (${statements.length} statements)`);
      } catch (e) {
        errorSnippet = (e && e.message ? e.message : String(e)).slice(0, 500);
        console.error(`[migrations] FAILED ${m.file}:`, errorSnippet);
      }
      const duration = Date.now() - start;
      await pool.query('INSERT INTO iset_migration (filename, checksum, duration_ms, success, error_snippet) VALUES (?,?,?,?,?)', [m.file, m.checksum, duration, success, errorSnippet]);
      if (!success) {
        console.error('[migrations] Halting further migrations due to failure');
        break;
      }
    }
  } catch (err) {
    console.error('[migrations] Runner unexpected error:', err.message);
  }
})();

// --- Startup DB diagnostic (enable/disable via ENABLE_DB_DIAG env var; defaults to true) ---------
// Logs which physical MySQL instance we're connected to plus a quick summary of the step table.
// This helps detect situations where manual SQL sessions and the Node process point at different instances.
// Safe / read-only. To silence, set ENABLE_DB_DIAG=false in the environment.
(async () => {
  if (String(process.env.ENABLE_DB_DIAG || 'true').toLowerCase() === 'true') {
    try {
      const [[meta]] = await pool.query('SELECT @@hostname AS host, @@port AS port, DATABASE() AS db');
      const [[counts]] = await pool.query('SELECT COUNT(*) AS stepCount, COALESCE(MAX(id),0) AS maxStepId FROM iset_intake.step');
      const [recent] = await pool.query('SELECT id, name, status FROM iset_intake.step ORDER BY id DESC LIMIT 5');
      console.log('[DB-DIAG]', JSON.stringify({
        host: meta.host,
        port: meta.port,
        database: meta.db,
        stepCount: counts.stepCount,
        maxStepId: counts.maxStepId,
        recentSteps: recent.map(r => ({ id: r.id, name: r.name, status: r.status }))
      }));
    } catch (e) {
      console.warn('[DB-DIAG] failed:', e && e.message ? e.message : e);
    }
  }
})();

// ---------------- Component Template Validation (initial: radio) -----------------
// We load JSON Schemas from src/component-lib/schemas. For now we focus on radio.
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, strict: false });
const schemaCache = {};
function loadSchemaIfNeeded(key) {
  if (schemaCache[key]) return schemaCache[key];
  try {
    const schemaPath = path.join(__dirname, 'src', 'component-lib', 'schemas', `${key}.schema.json`);
    if (fs.existsSync(schemaPath)) {
      const raw = fs.readFileSync(schemaPath, 'utf8');
      const json = JSON.parse(raw);
      schemaCache[key] = ajv.compile(json);
      return schemaCache[key];
    }
  } catch (e) {
    console.warn(`[schema] Failed loading schema for ${key}:`, e.message);
  }
  schemaCache[key] = null; // cache miss to avoid repeated fs hits
  return null;
}

function validateTemplatePayload(templateKey, payloadProps) {
  const validate = loadSchemaIfNeeded(templateKey);
  if (!validate) return { ok: true }; // no schema -> allow (future components)
  const valid = validate(payloadProps);
  if (valid) return { ok: true };
  return {
    ok: false,
    errors: (validate.errors || []).map(e => ({
      instancePath: e.instancePath,
      message: e.message,
      keyword: e.keyword,
      params: e.params
    }))
  };
}

// Sync radio template from filesystem source of truth if drift (latest-only approach)
// This does NOT create historical versions; it updates latest in-place given pre-release status.
async function syncRadioTemplateFromFile() {
  try {
    const filePath = path.join(__dirname, 'src', 'component-lib', 'radio.template.json');
    if (!fs.existsSync(filePath)) return;
    const fileJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Always target latest (highest version then highest id) so admin UI (which selects latest) stays in sync
    const [rows] = await pool.query('SELECT * FROM component_templates WHERE template_key = ? ORDER BY version DESC, id DESC LIMIT 1', ['radio']).catch(() => [null]);
    let row = rows && rows.length ? rows[0] : null;
    if (!row) {
      // Fallback: singular table name
      const [rowsAlt] = await pool.query('SELECT * FROM component_template WHERE template_key = ? ORDER BY version DESC, id DESC LIMIT 1', ['radio']).catch(() => [null]);
      row = rowsAlt && rowsAlt.length ? rowsAlt[0] : null;
    }
    if (!row) {
      // Auto-insert initial row if missing so template becomes available
      try {
        const insertSqlPlural = 'INSERT INTO component_templates (template_key, type, version, label, description, status, default_props, prop_schema, has_options, option_schema, export_njk_template) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
        const params = [fileJson.template_key || 'radio', fileJson.type || fileJson.template_key || 'radio', 1, fileJson.label, fileJson.description || '', fileJson.status || 'active', JSON.stringify(fileJson.default_props), JSON.stringify(fileJson.prop_schema), fileJson.has_options ? 1 : 0, JSON.stringify(fileJson.option_schema || null), fileJson.export_njk_template || null];
        let [ins] = await pool.query(insertSqlPlural, params).catch(() => [null]);
        if (!ins || !ins.insertId) {
          const insertSqlSingular = 'INSERT INTO component_template (template_key, type, version, label, description, status, default_props, prop_schema, has_options, option_schema, export_njk_template) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
          await pool.query(insertSqlSingular, params);
        }
        console.log('[sync] radio template inserted (initial) from file');
      } catch (e2) {
        console.warn('[sync] failed inserting radio template:', e2.message);
      }
      return;
    }
    const dbProps = typeof row.default_props === 'string' ? (() => { try { return JSON.parse(row.default_props); } catch { return {}; } })() : (row.default_props || row.props || {});
    const dbSchema = typeof row.prop_schema === 'string' ? (() => { try { return JSON.parse(row.prop_schema); } catch { return []; } })() : (row.prop_schema || row.editable_fields || []);
    const exportTpl = row.export_njk_template || row.export_njk || null;
    const drift = JSON.stringify(dbProps) !== JSON.stringify(fileJson.default_props)
      || JSON.stringify(dbSchema) !== JSON.stringify(fileJson.prop_schema)
      || String(exportTpl || '') !== String(fileJson.export_njk_template || '')
      || (row.label !== fileJson.label)
      || (String(row.description||'') !== String(fileJson.description||''));
    if (drift) {
      const sqlPlural = 'UPDATE component_templates SET label=?, description=?, status=?, default_props=?, prop_schema=?, has_options=?, option_schema=?, export_njk_template=? WHERE id=?';
      const params = [fileJson.label, fileJson.description || '', fileJson.status || 'active', JSON.stringify(fileJson.default_props), JSON.stringify(fileJson.prop_schema), fileJson.has_options ? 1 : 0, JSON.stringify(fileJson.option_schema || null), fileJson.export_njk_template || null, row.id];
      let [result] = await pool.query(sqlPlural, params).catch(() => [null]);
      if (!result || result.affectedRows === 0) {
        const sqlSingular = 'UPDATE component_template SET label=?, description=?, status=?, default_props=?, prop_schema=?, has_options=?, option_schema=?, export_njk_template=? WHERE id=?';
        await pool.query(sqlSingular, params);
      }
      console.log('[sync] radio template (latest version) updated from file source of truth');
    }
  } catch (e) {
    console.warn('[sync] radio template sync failed:', e.message);
  }
}

// Fire and forget sync on startup (non-blocking)
syncRadioTemplateFromFile();

// Generic helper to sync a template by key (initial reuse for input)
async function syncTemplateFromFile(templateKey) {
  try {
    const filePath = path.join(__dirname, 'src', 'component-lib', `${templateKey}.template.json`);
    if (!fs.existsSync(filePath)) return;
    const fileJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const [rowsPlural] = await pool.query('SELECT * FROM component_templates WHERE template_key = ? ORDER BY version DESC, id DESC LIMIT 1', [templateKey]).catch(() => [null]);
    let row = rowsPlural && rowsPlural.length ? rowsPlural[0] : null;
    if (!row) {
      const [rowsSingular] = await pool.query('SELECT * FROM component_template WHERE template_key = ? ORDER BY version DESC, id DESC LIMIT 1', [templateKey]).catch(() => [null]);
      row = rowsSingular && rowsSingular.length ? rowsSingular[0] : null;
    }
    if (!row) {
      // Auto insert new template if missing
      try {
        const insertSqlPlural = 'INSERT INTO component_templates (template_key, type, version, label, description, status, default_props, prop_schema, has_options, option_schema, export_njk_template) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
        const params = [fileJson.template_key || templateKey, fileJson.type || fileJson.template_key || templateKey, 1, fileJson.label, fileJson.description || '', fileJson.status || 'active', JSON.stringify(fileJson.default_props), JSON.stringify(fileJson.prop_schema), fileJson.has_options ? 1 : 0, JSON.stringify(fileJson.option_schema || null), fileJson.export_njk_template || null];
        let [ins] = await pool.query(insertSqlPlural, params).catch(() => [null]);
        if (!ins || !ins.insertId) {
          const insertSqlSingular = 'INSERT INTO component_template (template_key, type, version, label, description, status, default_props, prop_schema, has_options, option_schema, export_njk_template) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
          await pool.query(insertSqlSingular, params);
        }
        console.log(`[sync] ${templateKey} template inserted (initial) from file`);
      } catch (e2) {
        console.warn(`[sync] failed inserting ${templateKey} template:`, e2.message);
      }
      return;
    }
    const dbProps = typeof row.default_props === 'string' ? (() => { try { return JSON.parse(row.default_props); } catch { return {}; } })() : (row.default_props || {});
    const dbSchema = typeof row.prop_schema === 'string' ? (() => { try { return JSON.parse(row.prop_schema); } catch { return []; } })() : (row.prop_schema || []);
    const exportTpl = row.export_njk_template || row.export_njk || null;
    const drift = JSON.stringify(dbProps) !== JSON.stringify(fileJson.default_props)
      || JSON.stringify(dbSchema) !== JSON.stringify(fileJson.prop_schema)
      || String(exportTpl || '') !== String(fileJson.export_njk_template || '')
      || (row.label !== fileJson.label)
      || (String(row.description||'') !== String(fileJson.description||''));
    if (drift) {
      const sqlPlural = 'UPDATE component_templates SET label=?, description=?, status=?, default_props=?, prop_schema=?, has_options=?, option_schema=?, export_njk_template=? WHERE id=?';
      const params = [fileJson.label, fileJson.description || '', fileJson.status || 'active', JSON.stringify(fileJson.default_props), JSON.stringify(fileJson.prop_schema), fileJson.has_options ? 1 : 0, JSON.stringify(fileJson.option_schema || null), fileJson.export_njk_template || null, row.id];
      let [result] = await pool.query(sqlPlural, params).catch(() => [null]);
      if (!result || result.affectedRows === 0) {
        const sqlSingular = 'UPDATE component_template SET label=?, description=?, status=?, default_props=?, prop_schema=?, has_options=?, option_schema=?, export_njk_template=? WHERE id=?';
        await pool.query(sqlSingular, params);
      }
      console.log(`[sync] ${templateKey} template updated from file source of truth`);
    }
  } catch (e) {
    console.warn(`[sync] ${templateKey} template sync failed:`, e.message);
  }
}

// Input template sync (reuse generic helper)
async function syncInputTemplateFromFile() { return syncTemplateFromFile('input'); }
syncInputTemplateFromFile();

// Checkbox template sync (reuse generic helper)
async function syncCheckboxTemplateFromFile() { return syncTemplateFromFile('checkbox'); }
syncCheckboxTemplateFromFile();

// Date-input template sync (reuse generic helper)
async function syncDateInputTemplateFromFile() { return syncTemplateFromFile('date-input'); }
syncDateInputTemplateFromFile();

// File-upload template sync (reuse generic helper)
async function syncFileUploadTemplateFromFile() { return syncTemplateFromFile('file-upload'); }
syncFileUploadTemplateFromFile();

// Summary-list template sync (reuse generic helper)
async function syncSummaryListTemplateFromFile() { return syncTemplateFromFile('summary-list'); }
syncSummaryListTemplateFromFile();

// Textarea template sync (reuse generic helper)
async function syncTextareaTemplateFromFile() { return syncTemplateFromFile('textarea'); }
syncTextareaTemplateFromFile();

// Character-count template sync (reuse generic helper)
async function syncCharacterCountTemplateFromFile() { return syncTemplateFromFile('character-count'); }
syncCharacterCountTemplateFromFile();

// Inset-text template sync (reuse generic helper)
async function syncInsetTextTemplateFromFile() { return syncTemplateFromFile('inset-text'); }
syncInsetTextTemplateFromFile();

// Panel template sync (reuse generic helper)
async function syncPanelTemplateFromFile() { return syncTemplateFromFile('panel'); }
syncPanelTemplateFromFile();

// Details template sync (reuse generic helper)
async function syncDetailsTemplateFromFile() { return syncTemplateFromFile('details'); }
syncDetailsTemplateFromFile();

// Text-block template sync (reuse generic helper)
async function syncTextBlockTemplateFromFile() { return syncTemplateFromFile('text-block'); }
syncTextBlockTemplateFromFile();

// Select template sync (reuse generic helper)
async function syncSelectTemplateFromFile() { return syncTemplateFromFile('select'); }
syncSelectTemplateFromFile();

// Warning-text template sync (reuse generic helper)
async function syncWarningTextTemplateFromFile() { return syncTemplateFromFile('warning-text'); }
syncWarningTextTemplateFromFile();

// Signature-ack template sync (reuse generic helper)
async function syncSignatureAckTemplateFromFile() { return syncTemplateFromFile('signature-ack'); }
syncSignatureAckTemplateFromFile();

// Dev helper endpoint to force re-sync of radio template from filesystem (no versioning bump)
app.post('/api/dev/sync/radio-template', async (_req, res) => {
  await syncRadioTemplateFromFile();
  res.json({ ok: true, message: 'Radio template sync attempted' });
});

// Dev helper to sync input template
app.post('/api/dev/sync/input-template', async (_req, res) => {
  await syncInputTemplateFromFile();
  res.json({ ok: true, message: 'Input template sync attempted' });
});

// Dev helper to sync checkbox template
app.post('/api/dev/sync/checkbox-template', async (_req, res) => {
  await syncCheckboxTemplateFromFile();
  res.json({ ok: true, message: 'Checkbox template sync attempted' });
});

// Dev helper to sync date-input template
app.post('/api/dev/sync/date-input-template', async (_req, res) => {
  await syncDateInputTemplateFromFile();
  res.json({ ok: true, message: 'Date-input template sync attempted' });
});

// Dev helper to sync file-upload template
app.post('/api/dev/sync/file-upload-template', async (_req, res) => {
  await syncFileUploadTemplateFromFile();
  res.json({ ok: true, message: 'File-upload template sync attempted' });
});

// Dev helper to sync summary-list template
app.post('/api/dev/sync/summary-list-template', async (_req, res) => {
  await syncSummaryListTemplateFromFile();
  res.json({ ok: true, message: 'Summary-list template sync attempted' });
});

// Dev helper to sync textarea template
app.post('/api/dev/sync/textarea-template', async (_req, res) => {
  await syncTextareaTemplateFromFile();
  res.json({ ok: true, message: 'Textarea template sync attempted' });
});

// Dev helper to sync character-count template
app.post('/api/dev/sync/character-count-template', async (_req, res) => {
  await syncCharacterCountTemplateFromFile();
  res.json({ ok: true, message: 'Character-count template sync attempted' });
});

// Dev helper to sync inset-text template
app.post('/api/dev/sync/inset-text-template', async (_req, res) => {
  await syncInsetTextTemplateFromFile();
  res.json({ ok: true, message: 'Inset-text template sync attempted' });
});

// Dev helper to sync panel template
app.post('/api/dev/sync/panel-template', async (_req, res) => {
  await syncPanelTemplateFromFile();
  res.json({ ok: true, message: 'Panel template sync attempted' });
});

// Dev helper to sync details template
app.post('/api/dev/sync/details-template', async (_req, res) => {
  await syncDetailsTemplateFromFile();
  res.json({ ok: true, message: 'Details template sync attempted' });
});

// Dev helper to sync text-block template
app.post('/api/dev/sync/text-block-template', async (_req, res) => {
  await syncTextBlockTemplateFromFile();
  res.json({ ok: true, message: 'Text-block template sync attempted' });
});

// Dev helper to sync select template
app.post('/api/dev/sync/select-template', async (_req, res) => {
  await syncSelectTemplateFromFile();
  res.json({ ok: true, message: 'Select template sync attempted' });
});

// Dev helper to sync signature-ack template
app.post('/api/dev/sync/signature-ack-template', async (_req, res) => {
  await syncSignatureAckTemplateFromFile();
  res.json({ ok: true, message: 'Signature-ack template sync attempted' });
});

// ---------------- Component Templates Endpoints (Library) -----------------
// Provides CRUD-lite access to component template definitions stored in DB.
// Actual schema (DESCRIBE iset_intake.component_template):
// id (PK), template_key (varchar), version (int), type (varchar), label (varchar), description (text),
// default_props (json, NOT NULL), prop_schema (json, nullable), export_njk_template (text), status (varchar),
// created_at (datetime), updated_at (datetime), has_options (tinyint), option_schema (json)
// NOTE: Earlier code used conceptual names: name -> label, props -> default_props, editable_fields -> prop_schema.
// For backward compatibility we still emit name + editable_fields, but writes now target the correct columns.

async function selectComponentTemplates() {
  // Try plural then singular
  const [rowsPlural] = await pool.query('SELECT * FROM component_templates').catch(() => [null]);
  if (rowsPlural) return rowsPlural;
  const [rowsSingular] = await pool.query('SELECT * FROM component_template');
  return rowsSingular;
}

function normalizeTemplateRow(row) {
  const parse = (v, def = null) => {
    if (v == null) return def;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return def; }
  };
  const defaultProps = parse(row.default_props, {});
  const propSchema = parse(row.prop_schema, []);
  const optionSchema = parse(row.option_schema, null);
  const label = row.label || row.name || row.template_key || row.type || '';
  return {
    id: row.id,
    label,
    // name retained for backward compatibility with any frontend code still expecting it
    name: label,
    description: row.description || '',
    status: row.status || 'active',
    type: row.type || row.template_key || label,
    template_key: row.template_key || row.type || label,
    version: row.version || 1,
    // Expose both legacy and canonical keys
    default_props: defaultProps,
    prop_schema: propSchema,
    props: defaultProps,
    editable_fields: propSchema,
    has_options: !!(row.has_options || row.hasOptions),
    option_schema: optionSchema,
  };
}

// Lightweight read endpoint for component templates (dev + admin usage)
// GET /api/component-templates?templateKey=character-count&includeTemplate=1
// Returns normalized rows; if templateKey provided, filters to latest active version of that key.
app.get('/api/component-templates', async (req, res) => {
  try {
    const { templateKey, includeTemplate } = req.query || {};
    let rows = await selectComponentTemplates();
    if (templateKey) {
      // Filter to rows matching template_key and take highest version if version column exists
      const matches = rows.filter(r => String(r.template_key || r.templateKey || r.type || '').toLowerCase() === String(templateKey).toLowerCase());
      if (matches.length) {
        const sorted = matches.sort((a,b) => (Number(b.version||0) - Number(a.version||0)));
        rows = [sorted[0]];
      } else {
        rows = [];
      }
    }
    let out = rows.map(r => {
      const norm = normalizeTemplateRow(r);
      // Alias legacy plural key to singular for UI consistency
      if (String(norm.template_key).toLowerCase() === 'checkboxes') {
        norm.template_key = 'checkbox';
        norm.type = 'checkbox';
      }
      if (includeTemplate) {
        norm.export_njk_template = r.export_njk_template || r.export_njk || null;
      }
      return norm;
    });
    // Deduplicate by template_key keeping latest version (and preferring rows with richer option_schema length)
    const byKey = new Map();
    for (const tpl of out) {
      const k = String(tpl.template_key).toLowerCase();
      const existing = byKey.get(k);
      if (!existing) { byKey.set(k, tpl); continue; }
      const exScore = (existing.version||0) * 10 + (Array.isArray(existing.option_schema)? existing.option_schema.length:0);
      const newScore = (tpl.version||0) * 10 + (Array.isArray(tpl.option_schema)? tpl.option_schema.length:0);
      if (newScore >= exScore) byKey.set(k, tpl);
    }
    out = Array.from(byKey.values());
    res.status(200).json({ count: out.length, templates: out });
  } catch (e) {
    console.error('GET /api/component-templates failed:', e);
    res.status(500).json({ error: 'component_templates_fetch_failed' });
  }
});

// Removed earlier simple list handler; consolidated logic lives later in file (includes augmentation & version filtering)

app.put('/api/component-templates/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  // Accept both legacy and canonical field names from client
  const label = body.label ?? body.name; // prefer label
  const type = body.type;
  const template_key = body.template_key;
  const version = body.version;
  const default_props = body.default_props ?? body.props; // unify
  const prop_schema = body.prop_schema ?? body.editable_fields; // unify
  const has_options = body.has_options;
  const option_schema = body.option_schema;

  // Schema validation (radio only for now) – use template_key or type to identify
  const tk = (template_key || type || '').toLowerCase();
  if (tk === 'radio' && default_props) {
    const result = validateTemplatePayload('radio', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'input' && default_props) {
    const result = validateTemplatePayload('input', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'textarea' && default_props) {
    const result = validateTemplatePayload('textarea', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'character-count' && default_props) {
    const result = validateTemplatePayload('character-count', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if ((tk === 'checkbox' || tk === 'checkboxes') && default_props) {
    const result = validateTemplatePayload('checkbox', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'inset-text' && default_props) {
    const result = validateTemplatePayload('inset-text', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'panel' && default_props) {
    const result = validateTemplatePayload('panel', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'details' && default_props) {
    const result = validateTemplatePayload('details', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'text-block' && default_props) {
    const result = validateTemplatePayload('text-block', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }
  if (tk === 'signature-ack' && default_props) {
    const result = validateTemplatePayload('signature-ack', default_props);
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', details: result.errors });
  }

  const updates = [];
  const params = [];
  function push(col, val, json = false) {
    if (typeof val === 'undefined') return;
    updates.push(`${col} = ?`);
    params.push(json ? JSON.stringify(val) : val);
  }
  push('label', label);
  push('type', type);
  push('template_key', template_key);
  push('version', version);
  push('default_props', default_props, true);
  push('prop_schema', prop_schema, true);
  push('has_options', typeof has_options === 'boolean' ? (has_options ? 1 : 0) : undefined);
  push('option_schema', option_schema, true);

  if (!updates.length) return res.status(400).json({ error: 'no_updates' });
  try {
    params.push(id);
    const sqlPlural = `UPDATE component_templates SET ${updates.join(', ')} WHERE id = ?`;
    let [result] = await pool.query(sqlPlural, params).catch(() => [null]);
    if (!result || result.affectedRows === 0) {
      const sqlSingular = `UPDATE component_template SET ${updates.join(', ')} WHERE id = ?`;
      [result] = await pool.query(sqlSingular, params);
      if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'not_found' });
    }
    res.status(200).json({ ok: true, updated_fields: updates.map(u => u.split(' ')[0]) });
  } catch (e) {
    res.status(500).json({ error: 'component_template_update_failed', details: e.message });
  }
});

// Targeted fix endpoint to normalize "Confirmation Panel" -> "Panel" and ensure proper fields.
app.post('/api/component-templates/fix/panel-normalize', async (_req, res) => {
  try {
    const rows = await selectComponentTemplates();
    const candidates = rows.filter(r => {
      const nm = String(r.name || '').toLowerCase();
      const tp = String(r.type || '').toLowerCase();
      const tk = String(r.template_key || '').toLowerCase();
      return nm.includes('confirmation panel') || tp === 'confirmation-panel' || tk === 'confirmation-panel';
    });
    if (!candidates.length) return res.status(200).json({ updated: 0, message: 'No matching panel templates found.' });
    let updated = 0;
    for (const row of candidates) {
      const baseProps = (() => {
        try { return typeof row.props === 'string' ? JSON.parse(row.props) : (row.props || {}); } catch { return {}; }
      })();
      if (!baseProps.titleText) baseProps.titleText = 'Application complete';
      if (!baseProps.html) baseProps.html = 'Your reference number<br><strong>ABC123</strong>';
      const editable = ['titleText','html'];
      const params = [ 'Panel', 'panel', 'panel', 1, JSON.stringify(baseProps), JSON.stringify(editable), 0, null, row.id ];
      // Try plural then singular
      const sqlPlural = 'UPDATE component_templates SET name=?, type=?, template_key=?, version=?, props=?, editable_fields=?, has_options=?, option_schema=? WHERE id=?';
      let [result] = await pool.query(sqlPlural, params).catch(() => [null]);
      if (!result || result.affectedRows === 0) {
        const sqlSingular = 'UPDATE component_template SET name=?, type=?, template_key=?, version=?, props=?, editable_fields=?, has_options=?, option_schema=? WHERE id=?';
        [result] = await pool.query(sqlSingular, params);
      }
      if (result && result.affectedRows > 0) updated += result.affectedRows;
    }
    res.status(200).json({ updated });
  } catch (e) {
    res.status(500).json({ error: 'panel_normalize_failed', details: e.message });
  }
});

// Migration: prune prefix/suffix props from character-count templates (should not be translatable)
app.post('/api/component-templates/fix/character-count-prune-prefix-suffix', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, default_props, prop_schema FROM iset_intake.component_template WHERE template_key='character-count'`);
    let updated = 0;
    const changed = [];
    for (const r of rows) {
      let props = {}; try { props = r.default_props ? JSON.parse(r.default_props) : {}; } catch { props = {}; }
      let schema = []; try { schema = r.prop_schema ? JSON.parse(r.prop_schema) : []; } catch { schema = []; }
      const beforeJSON = JSON.stringify(props);
      // Remove stray prefix/suffix keys (text objects or scalars)
      if (props && typeof props === 'object') {
        if (props.prefix) delete props.prefix;
        if (props.suffix) delete props.suffix;
      }
      // Remove any schema entries referencing prefix or suffix
      if (Array.isArray(schema) && schema.length) {
        const filtered = schema.filter(f => !(f && typeof f === 'object' && /(^|\.)prefix(\.|$)/i.test(String(f.path||f.key||''))));
        const filtered2 = filtered.filter(f => !(f && typeof f === 'object' && /(^|\.)suffix(\.|$)/i.test(String(f.path||f.key||''))));
        schema = filtered2;
      }
      const afterJSON = JSON.stringify(props);
      if (afterJSON !== beforeJSON) {
        await pool.query(`UPDATE iset_intake.component_template SET default_props=?, prop_schema=? WHERE id=?`, [afterJSON, JSON.stringify(schema), r.id]);
        updated++; changed.push(r.id);
      }
    }
    res.status(200).json({ ok: true, updated, changed });
  } catch (e) {
    console.error('character-count prune prefix/suffix failed', e);
    res.status(500).json({ error: 'character_count_prune_failed', details: e.message });
  }
});

// One-off migration endpoint to persist label.classes insertion and legacy required removal.
// Safe to run multiple times (idempotent) – it will only update rows needing changes.
app.post('/api/component-templates/migrate/label-required-cleanup', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT id, template_key, type, default_props, prop_schema FROM iset_intake.component_template`);
    const labelClassOptions = [ 'govuk-label', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl' ];
    const inputLike = new Set(['input','textarea','character-count','select','file-upload','password-input']);
    let updated = 0;
    const changedTemplates = [];
    for (const r of rows) {
      let changed = false;
      let schema = [];
      try { schema = r.prop_schema ? JSON.parse(r.prop_schema) : []; } catch { schema = []; }
      if (!Array.isArray(schema)) schema = [];
      const beforeLen = schema.length;
      schema = schema.filter(f => f && f.key !== 'required' && f.path !== 'required');
      if (schema.length !== beforeLen) changed = true;
      const hasLabelText = schema.some(f => f && (f.path === 'label.text' || f.key === 'label.text'));
      const hasLabelClasses = schema.some(f => f && (f.path === 'label.classes' || f.key === 'label.classes'));
      if (hasLabelText && !hasLabelClasses) {
        const insertIdx = schema.findIndex(f => f && (f.path === 'label.text' || f.key === 'label.text'));
        const fieldDef = { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions };
        if (insertIdx >= 0) schema.splice(insertIdx + 1, 0, fieldDef); else schema.push(fieldDef);
        changed = true;
      }
      let defaults = {};
      try { defaults = r.default_props ? JSON.parse(r.default_props) : {}; } catch { defaults = {}; }
      if (inputLike.has(String(r.type).toLowerCase())) {
        if (!defaults.label || typeof defaults.label !== 'object') {
          defaults.label = { text: (defaults.label && defaults.label.text) || 'Label', classes: 'govuk-label--m' };
          changed = true;
        } else if (!defaults.label.classes) {
          defaults.label.classes = 'govuk-label--m';
          changed = true;
        }
      }
      if (changed) {
        await pool.query(`UPDATE iset_intake.component_template SET prop_schema = ?, default_props = ? WHERE id = ?`, [JSON.stringify(schema), JSON.stringify(defaults), r.id]);
        updated++;
        changedTemplates.push({ id: r.id, key: r.template_key, type: r.type });
      }
    }
    res.status(200).json({ message: 'Label/required cleanup complete', updated, changedTemplates });
  } catch (err) {
    console.error('label-required-cleanup failed', err);
    res.status(500).json({ error: 'label_required_cleanup_failed' });
  }
});

// POST /api/component-templates/migrate/backfill-props
// Persists any runtime-backfilled props & editable_fields for input-like templates missing schema (idempotent)
app.post('/api/component-templates/migrate/backfill-props', async (_req, res) => {
  try {
    const targets = ['character-count','input','textarea','select','file-upload','password-input'];
    const [rows] = await pool.query(`SELECT id, type, default_props, prop_schema FROM iset_intake.component_template`);
    const labelClassOptions = [ 'govuk-label', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl' ];
    let updated = 0;
    const changed = [];
    for (const r of rows) {
      const t = String(r.type || '').toLowerCase();
      if (!targets.includes(t)) continue;
      let props = {}; try { props = r.default_props ? JSON.parse(r.default_props) : {}; } catch { props = {}; }
      let schema = []; try { schema = r.prop_schema ? JSON.parse(r.prop_schema) : []; } catch { schema = []; }
      if (!Array.isArray(schema)) schema = [];
      const originalSchemaLen = schema.length;
      const originalPropsJSON = JSON.stringify(props);
      // Normalise label
      if (!props.label || typeof props.label !== 'object') props.label = { text: 'Label', classes: 'govuk-label--m' };
      else if (!props.label.classes) props.label.classes = 'govuk-label--m';
      const ensure = (k, v) => { if (!(k in props)) props[k] = v; };
      if (t === 'character-count') {
        ensure('name','message'); ensure('id',''); ensure('rows','5'); ensure('maxlength','200'); ensure('threshold','75');
        if (!props.hint || typeof props.hint !== 'object') props.hint = { text: 'Do not include personal information.' };
        if (!props.formGroup) props.formGroup = { classes: '' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
      } else if (t === 'input') {
        ensure('name','input-1'); ensure('id','input-1'); ensure('type','text');
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'This is the optional hint text' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
        if (!props.formGroup) props.formGroup = { classes: '' };
      } else if (t === 'textarea') {
        ensure('name','more-detail'); ensure('id','more-detail'); ensure('rows','5');
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'Don\'t include personal or financial information.' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
        if (!props.formGroup) props.formGroup = { classes: '' };
      } else if (t === 'select') {
        ensure('name','example-select');
        if (!Array.isArray(props.items) || !props.items.length) props.items = [ { text: 'Option 1', value: '1' }, { text: 'Option 2', value: '2' }, { text: 'Option 3', value: '3' } ];
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'Pick from the options' };
      } else if (t === 'file-upload') {
        ensure('name','uploadedFile');
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'Files must be under 10MB.' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
      } else if (t === 'password-input') {
        ensure('name','password');
        if (!props.hint || typeof props.hint !== 'object' || !props.hint.text) props.hint = { text: 'This is the optional hint text' };
        if (!props.errorMessage) props.errorMessage = { text: '' };
      }
      // Rebuild schema only if empty
      if (!schema.length) {
        if (t === 'character-count') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'maxlength', path: 'maxlength', type: 'text', label: 'Max Length' },
          { key: 'threshold', path: 'threshold', type: 'text', label: 'Threshold (%)' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
        else if (t === 'input') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Field name' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'type', path: 'type', type: 'enum', label: 'Input type', options: ['text','email','number','password','tel','url','search'] },
          { key: 'label.text', path: 'label.text', type: 'text', label: 'Label' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint' },
          { key: 'errorMessage.text', path: 'errorMessage.text', type: 'text', label: 'Error message' },
          { key: 'classes', path: 'classes', type: 'text', label: 'Input classes' }
        ];
        else if (t === 'textarea') schema = [
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'labelClasses', path: 'label.classes', type: 'select', label: 'Label Classes', options: labelClassOptions.slice(0,4) },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'rows', path: 'rows', type: 'text', label: 'Rows (number as text)' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
        else if (t === 'select') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
        else if (t === 'file-upload') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
        else if (t === 'password-input') schema = [
          { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
          { key: 'id', path: 'id', type: 'text', label: 'ID' },
          { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
          { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
          { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
          { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
        ];
      }
      // Remove legacy required if present
      const filteredSchema = schema.filter(f => f.key !== 'required' && f.path !== 'required');
      if (filteredSchema.length !== schema.length) schema = filteredSchema;
      if (schema.length && !schema.some(f => f.path === 'label.classes') && schema.some(f => f.path === 'label.text')) {
        const idx = schema.findIndex(f => f.path === 'label.text');
        const def = { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions };
        if (idx >= 0) schema.splice(idx + 1, 0, def); else schema.push(def);
      }
      const newPropsJSON = JSON.stringify(props);
      const newSchemaJSON = JSON.stringify(schema);
      if (newPropsJSON !== originalPropsJSON || schema.length !== originalSchemaLen) {
        await pool.query(`UPDATE iset_intake.component_template SET default_props = ?, prop_schema = ? WHERE id = ?`, [newPropsJSON, newSchemaJSON, r.id]);
        updated++; changed.push({ id: r.id, type: t });
      }
    }
    res.status(200).json({ message: 'Backfill complete', updated, changed });
  } catch (err) {
    console.error('backfill-props failed', err);
    res.status(500).json({ error: 'backfill_props_failed' });
  }
});

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
  'signature-ack',
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
    path.join(__dirname, 'src', 'server-macros'),
    path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist'),
    path.join(__dirname, 'node_modules', 'govuk-frontend')
  ], { autoescape: true, noCache: true });
} catch (e) {
  console.warn('Nunjucks reconfigure for preview failed, using existing instance:', e.message);
  env = nunjucks;
}

// Helper: render a single component template to HTML using export_njk_template from DB
function renderRegistryComponent(entry, comp) {
  if (!entry) return null;
  const props = typeof entry.prepareProps === 'function'
    ? entry.prepareProps(comp)
    : ((comp && typeof comp.props === 'object' && comp.props !== null) ? { ...comp.props } : {});
  const context = { props, component: comp };
  if (entry.macro) {
    const macroConfig = entry.macro;
    const macroFile = macroConfig.file;
    const macroName = macroConfig.name;
    if (!macroFile || !macroName) {
      throw new Error('Macro configuration requires file and name');
    }
    const tpl = `{% from "${macroFile}" import ${macroName} %}{{ ${macroName}(props) }}`;
    return env.renderString(tpl, context);
  }
  if (typeof entry.render === 'function') {
    return entry.render({ env, component: comp, props, context, renderComponentHtml });
  }
  throw new Error('Unsupported registry entry');
}

async function renderComponentHtml(comp, depth = 0) {
  if (depth > 4) return '<!-- max depth reached -->';
  const templateKey = comp.template_key || comp.templateKey || comp.templateKey || null;
  const type = comp.type || null;
  const registryEntry = getComponentRenderer({ templateKey, type });
  if (registryEntry) {
    try {
      return renderRegistryComponent(registryEntry, comp);
    } catch (e) {
      console.warn(`registry render failed for ${templateKey || type}: ${e.message}`);
    }
  }
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
    // Normalise radio option hint strings -> { text: "..." } objects so GOV.UK macro renders them.
    const tKey = (templateKey || type || '').toLowerCase();
    // Normalise hint strings for choice components (radios, checkboxes, select)
    if ((tKey === 'radio' || tKey === 'radios' || tKey === 'select' || tKey === 'checkbox' || tKey === 'checkboxes') && comp?.props && Array.isArray(comp.props.items)) {
      // Process conditional follow-up questions (single depth currently) for radios + checkboxes
      if ((tKey === 'radio' || tKey === 'radios' || tKey === 'checkbox' || tKey === 'checkboxes')) {
        const newItems = [];
        for (const it of comp.props.items) {
          if (it && it.conditional && Array.isArray(it.conditional.questions) && it.conditional.questions.length) {
            // Render each follow-up component to HTML
            const htmlParts = [];
            for (const q of it.conditional.questions) {
              try {
                // Defensive clone; ensure nested component has template_key if only type present
                const childComp = { ...q };
                if (!childComp.template_key && childComp.type) childComp.template_key = childComp.type;
                const rendered = await renderComponentHtml(childComp, depth + 1);
                htmlParts.push(rendered);
              } catch (e) {
                htmlParts.push(`<!-- follow-up render error: ${e.message} -->`);
              }
            }
            const combined = htmlParts.join('\n');
            const { questions, ...restCond } = it.conditional;
            newItems.push({
              ...it,
              ...(typeof it.hint === 'string' && it.hint.trim() !== '' ? { hint: { text: it.hint } } : {}),
              conditional: { ...restCond, html: combined }
            });
            continue;
          }
          // No conditional questions
          if (it && typeof it.hint === 'string' && it.hint.trim() !== '') {
            newItems.push({ ...it, hint: { text: it.hint } });
          } else {
            newItems.push(it);
          }
        }
        comp = { ...comp, props: { ...comp.props, items: newItems } };
      } else {
        comp = { ...comp, props: { ...comp.props, items: comp.props.items.map(it => {
          if (it && typeof it.hint === 'string' && it.hint.trim() !== '') {
            return { ...it, hint: { text: it.hint } };
          }
          return it;
        }) } };
      }
    }
    // Backward compatibility: earlier editor bug nested updated date-input items under props.props.items
    if ((tKey === 'date' || tKey === 'date-input') && comp?.props) {
      const nested = comp.props?.props?.items;
      if (Array.isArray(nested) && (!Array.isArray(comp.props.items) || nested.some(n => n?.autocomplete) )) {
        comp = { ...comp, props: { ...comp.props, items: nested } };
      }
    }
    // Prune empty errorMessage objects so GOV.UK macros don't apply error styling by presence alone
    try {
      if (comp?.props && comp.props.errorMessage) {
        const em = comp.props.errorMessage;
        let empty = false;
        if (typeof em.text === 'string') {
          empty = em.text.trim() === '';
        } else if (em && typeof em.text === 'object' && em.text !== null) {
          const vals = Object.values(em.text).map(v => (typeof v === 'string') ? v.trim() : '');
            empty = vals.length > 0 && vals.every(v => v === '');
        } else if (!em.text) {
          // No text field at all
          empty = true;
        }
        if (empty) {
          // Remove field entirely so macro treats as no error
          const { errorMessage, ...rest } = comp.props;
          comp = { ...comp, props: rest };
        }
      }
    } catch { /* ignore pruning errors */ }
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
  let jsModule = '';
  try {
    css = fs.readFileSync(path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist', 'govuk', 'govuk-frontend.min.css'), 'utf8');
  } catch (e) {
    css = '/* failed to inline govuk css: ' + e.message + ' */';
  }
  try {
    jsModule = fs.readFileSync(path.join(__dirname, 'node_modules', 'govuk-frontend', 'dist', 'govuk', 'govuk-frontend.min.js'), 'utf8');
  } catch (e) {
    jsModule = '/* failed to inline govuk js: ' + e.message + ' */';
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
      <script>
        // Ensure GOV.UK Frontend support class is present so component JS will initialise
        // and CSS rules like .govuk-frontend-supported .govuk-radios__conditional--hidden apply.
        (function(){
          var cls = document.body.className || '';
            if(!/\bgovuk-frontend-supported\b/.test(cls)) cls += (cls?' ':'') + 'govuk-frontend-supported';
            if(!/\bjs-enabled\b/.test(cls)) cls += (cls?' ':'') + 'js-enabled';
            document.body.className = cls;
        })();
      </script>
  <div class="govuk-width-container">${innerHtml}</div>
  <script type="module">${jsModule}
  try { window.GOVUKFrontend && window.GOVUKFrontend.initAll(); } catch(e) { console.warn('GOV.UK initAll failed (module)'); }
  </script>
      <script>
// Minimal fallback for conditional radios & checkboxes (no debug logging)
(function(){
  function apply(){
    const support = document.body.classList.contains('govuk-frontend-supported');
    // Reset all conditional containers (radios + checkboxes)
    document.querySelectorAll('.govuk-radios__conditional').forEach(el => { el.classList.add('govuk-radios__conditional--hidden'); if(!support) el.style.display='none'; else if(el.style.display==='none') el.style.removeProperty('display'); });
    document.querySelectorAll('.govuk-checkboxes__conditional').forEach(el => { el.classList.add('govuk-checkboxes__conditional--hidden'); if(!support) el.style.display='none'; else if(el.style.display==='none') el.style.removeProperty('display'); });
    function toggle(input, group){
      const condId = input.getAttribute('aria-controls') || input.getAttribute('data-aria-controls');
      if(!condId) return;
      const condEl = document.getElementById(condId);
      if(!condEl) return;
      const type = group === 'checkbox' ? 'checkboxes' : 'radios';
      const hiddenClass = type === 'checkboxes' ? 'govuk-checkboxes__conditional--hidden' : 'govuk-radios__conditional--hidden';
      const show = input.checked;
      condEl.classList.toggle(hiddenClass, !show);
      input.setAttribute('aria-expanded', show ? 'true':'false');
      if(show) condEl.style.removeProperty('display'); else if(!support) condEl.style.display='none'; else condEl.style.removeProperty('display');
    }
    document.querySelectorAll('input[type=radio]').forEach(inp => { if(inp.classList.contains('govuk-radios__input') || inp.hasAttribute('aria-controls') || inp.hasAttribute('data-aria-controls')) toggle(inp,'radio'); });
    document.querySelectorAll('input[type=checkbox]').forEach(inp => { if(inp.classList.contains('govuk-checkboxes__input') || inp.hasAttribute('aria-controls') || inp.hasAttribute('data-aria-controls')) toggle(inp,'checkbox'); });
  }
  document.addEventListener('change', e => { if (e.target && e.target.matches && (e.target.matches('input[type=radio]') || e.target.matches('input[type=checkbox]'))) apply(); });
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(apply,0); else document.addEventListener('DOMContentLoaded', apply);
})();
      </script>
    </body>
  </html>`;
}

// POST /api/preview/step : render array of components to full HTML doc
app.post('/api/preview/step', async (req, res) => {
  try {
    const comps = Array.isArray(req.body?.components) ? req.body.components : [];
    // Build id lookup for linkage resolution
    const compById = new Map();
    for (const c of comps) {
      if (!c || typeof c !== 'object') continue;
      if (c.id) compById.set(c.id, c);
      const nameKey = c.props && c.props.name;
      if (nameKey && !compById.has(nameKey)) compById.set(nameKey, c);
    }
    const referencedChildIds = new Set();
    // Produce processed components with synthetic embedded conditional.questions for radios & checkboxes based on conditionalChildId
    const processed = comps.map(orig => {
      if (!orig || typeof orig !== 'object') return orig;
      let clone = { ...orig, props: typeof orig.props === 'object' && orig.props !== null ? { ...orig.props } : {} };
      if (!clone.template_key && clone.templateKey) clone.template_key = clone.templateKey;
      const tKey = String(clone.template_key || clone.type || '').toLowerCase();
      if ((tKey === 'radio' || tKey === 'radios' || tKey === 'checkbox' || tKey === 'checkboxes') && Array.isArray(clone.props.items)) {
        const newItems = clone.props.items.map(it => {
          if (!it || typeof it !== 'object') return it;
          if (it.conditionalChildId) {
            const child = compById.get(it.conditionalChildId);
            if (child && child !== clone) {
              const refKey = child.id || (child.props && child.props.name);
              if (refKey) referencedChildIds.add(refKey);
              // For checkboxes, GOV.UK expects .govuk-checkboxes__conditional container; radios already handled similarly.
              // Reuse same structure; macro library differentiates by classes; markup generation handled downstream.
              return { ...it, conditional: { questions: [ { ...child } ] } };
            }
          }
          return it;
        });
        clone = { ...clone, props: { ...clone.props, items: newItems } };
      }
      return clone;
    });
    // Render skipping referenced conditional children at top-level
    let html = '';
    for (const raw of processed) {
      const key = raw && (raw.id || (raw.props && raw.props.name));
      if (key && referencedChildIds.has(key)) continue;
      const comp = { ...raw, props: typeof raw?.props === 'object' && raw.props !== null ? raw.props : {} };
      if (!comp.template_key && comp.templateKey) comp.template_key = comp.templateKey;
      html += await renderComponentHtml(comp, 0) + '\n';
    }
    // Server-side pass to ensure conditionals are hidden unless their input is checked.
    try {
      const $ = cheerio.load(html);
      // Radios
      $('div.govuk-radios').each((_, group) => {
        const $group = $(group);
        $group.find('input.govuk-radios__input').each((__, inp) => {
          const $inp = $(inp);
          if(!$inp.attr('aria-controls') && $inp.attr('data-aria-controls')) {
            $inp.attr('aria-controls', $inp.attr('data-aria-controls'));
          }
          const condId = $inp.attr('aria-controls');
          if (!condId) return;
          const $cond = $('#' + condId);
          if (!$cond.length) return;
          const checked = $inp.is(':checked');
          $inp.attr('aria-expanded', checked ? 'true' : 'false');
          if (!checked) {
            if (!$cond.hasClass('govuk-radios__conditional--hidden')) $cond.addClass('govuk-radios__conditional--hidden');
          } else {
            $cond.removeClass('govuk-radios__conditional--hidden');
            const cleaned = ($cond.attr('style')||'').replace(/display:\s*none;?/,'');
            if (cleaned) $cond.attr('style', cleaned); else $cond.removeAttr('style');
          }
        });
      });
      // Checkboxes
      $('div.govuk-checkboxes').each((_, group) => {
        const $group = $(group);
        $group.find('input.govuk-checkboxes__input').each((__, inp) => {
          const $inp = $(inp);
          if(!$inp.attr('aria-controls') && $inp.attr('data-aria-controls')) {
            $inp.attr('aria-controls', $inp.attr('data-aria-controls'));
          }
          const condId = $inp.attr('aria-controls');
          if (!condId) return;
          const $cond = $('#' + condId);
          if (!$cond.length) return;
          const checked = $inp.is(':checked');
          $inp.attr('aria-expanded', checked ? 'true' : 'false');
          if (!checked) {
            if (!$cond.hasClass('govuk-checkboxes__conditional--hidden')) $cond.addClass('govuk-checkboxes__conditional--hidden');
          } else {
            $cond.removeClass('govuk-checkboxes__conditional--hidden');
            const cleaned = ($cond.attr('style')||'').replace(/display:\s*none;?/,'');
            if (cleaned) $cond.attr('style', cleaned); else $cond.removeAttr('style');
          }
        });
      });
      html = $.html();
    } catch (e) {
      console.warn('conditional preprocess failed:', e.message);
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
      let normProps = props;
      try {
        const keyLower = (templateKey || rows?.[0]?.template_key || '').toLowerCase();
        // Normalise hint strings for choice components (radios, checkboxes, select)
        if ((keyLower === 'radio' || keyLower === 'radios' || keyLower === 'select' || keyLower === 'checkbox' || keyLower === 'checkboxes') && normProps && Array.isArray(normProps.items)) {
          normProps = { ...normProps, items: normProps.items.map(it => {
            if (it && typeof it.hint === 'string' && it.hint.trim() !== '') {
              return { ...it, hint: { text: it.hint } };
            }
            return it;
          }) };
        }
        // Backward compatibility for date-input nested props bug
        if ((keyLower === 'date' || keyLower === 'date-input') && normProps) {
          const nested = normProps?.props?.items;
          if (Array.isArray(nested) && (!Array.isArray(normProps.items) || nested.some(n => n?.autocomplete))) {
            normProps = { ...normProps, items: nested };
          }
        }
        // Prune empty errorMessage to avoid false error styling in working area
        if (normProps && normProps.errorMessage) {
          const em = normProps.errorMessage;
          let empty = false;
          if (typeof em.text === 'string') empty = em.text.trim() === '';
          else if (em && typeof em.text === 'object' && em.text !== null) {
            const vals = Object.values(em.text).map(v => typeof v === 'string' ? v.trim() : '');
            empty = vals.length > 0 && vals.every(v => v === '');
          } else if (!em.text) empty = true;
          if (empty) {
            const { errorMessage, ...rest } = normProps;
            normProps = rest;
          }
        }
      } catch { /* ignore normalisation errors */ }
      html = env.renderString(tpl, { props: normProps });
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

// POST /api/component-templates/panel/version
// Creates a new version of the panel template (id provided or discovered by template_key='panel')
// Adds support for html body (html vs text) while retaining titleText.
app.post('/api/component-templates/panel/version', async (req, res) => {
  try {
    // Find current latest active panel template
    const [[row]] = await pool.query(`SELECT * FROM iset_intake.component_template WHERE template_key='panel' AND status='active' ORDER BY version DESC LIMIT 1`);
    if (!row) return res.status(404).json({ error: 'panel_template_not_found' });
    const currentVersion = Number(row.version || 0);
    const nextVersion = currentVersion + 1;
    const defaultProps = (() => { try { return JSON.parse(row.default_props); } catch { return {}; } })();
    // Promote existing text to html if html not present
    if (!defaultProps.html && defaultProps.text) {
      // Preserve line breaks
      defaultProps.html = String(defaultProps.text).replace(/\n/g, '<br>');
    }
    if (!defaultProps.titleText) defaultProps.titleText = 'Application complete';
    // Remove now redundant plain text if both html & text exist (keep html authoritative)
    if (defaultProps.html) delete defaultProps.text;
    if (typeof defaultProps.headingLevel === 'undefined') defaultProps.headingLevel = 1;
    if (typeof defaultProps.classes === 'undefined') defaultProps.classes = '';

    const newPropSchema = [
      { key: 'titleText', path: 'titleText', type: 'text', label: 'Title Text' },
      { key: 'html', path: 'html', type: 'textarea', label: 'HTML Content' },
      { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' },
      { key: 'headingLevel', path: 'headingLevel', type: 'number', label: 'Heading Level' }
    ];

    const newNunjucks = `{% from "govuk/components/panel/macro.njk" import govukPanel %}\n\n{{ govukPanel({\n  titleText: props.titleText,\n  html: props.html,\n  headingLevel: props.headingLevel,\n  classes: props.classes\n}) }}`;

    await pool.query(
      `INSERT INTO iset_intake.component_template
        (template_key, version, type, label, description, default_props, prop_schema, has_options, option_schema, status, export_njk_template)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.template_key,
        nextVersion,
        row.type || 'panel',
        'Panel',
        'Confirmation / summary panel with title and HTML body.',
        JSON.stringify(defaultProps),
        JSON.stringify(newPropSchema),
        row.has_options || 0,
        row.option_schema || null,
        'active',
        newNunjucks
      ]
    );

    res.status(201).json({ ok: true, template_key: row.template_key, version: nextVersion });
  } catch (e) {
    console.error('panel version create failed', e);
    res.status(500).json({ error: 'panel_version_failed', details: e.message });
  }
});

// POST /api/component-templates/character-count/version2
// Creates a new version (v2) of the character-count template with expanded schema & i18n-aware text fields.
app.post('/api/component-templates/character-count/version2', async (_req, res) => {
  try {
    const [[row]] = await pool.query(`SELECT * FROM iset_intake.component_template WHERE template_key='character-count' AND status='active' ORDER BY version DESC LIMIT 1`);
    const currentVersion = row ? Number(row.version || 0) : 0;
    const nextVersion = currentVersion + 1;
    // Build new default props (preserve existing where possible)
    const base = (() => { try { return row ? JSON.parse(row.default_props || '{}') : {}; } catch { return {}; } })();
    const defaultProps = {
      name: base.name || 'message',
      id: base.id || '',
      label: base.label && typeof base.label === 'object' ? base.label : { text: base.label?.text || 'Message' },
      hint: base.hint && typeof base.hint === 'object' ? base.hint : { text: base.hint?.text || 'Do not include personal information.' },
      errorMessage: base.errorMessage && typeof base.errorMessage === 'object' ? base.errorMessage : { text: '' },
      formGroup: base.formGroup || { classes: '' },
      classes: base.classes || 'govuk-!-margin-bottom-6',
      rows: base.rows || 5,
      maxlength: base.maxlength || 200,
      threshold: base.threshold || 75,
      maxwords: base.maxwords || null,
      autocomplete: base.autocomplete || '',
      spellcheck: typeof base.spellcheck === 'boolean' ? base.spellcheck : true,
      value: base.value || ''
    };
    // Editable field schema (v2)
    const propSchema = [
      { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
      { key: 'id', path: 'id', type: 'text', label: 'ID' },
      { key: 'label.text', path: 'label.text', type: 'text', label: 'Label Text' },
      { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: ['govuk-label--s','govuk-label--m','govuk-label--l','govuk-label--xl','govuk-visually-hidden'] },
      { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint Text' },
      { key: 'errorMessage.text', path: 'errorMessage.text', type: 'text', label: 'Error Message' },
      { key: 'rows', path: 'rows', type: 'number', label: 'Rows' },
      { key: 'maxlength', path: 'maxlength', type: 'number', label: 'Max Length (chars)' },
      { key: 'threshold', path: 'threshold', type: 'number', label: 'Threshold (%)' },
      { key: 'maxwords', path: 'maxwords', type: 'number', label: 'Max Words (optional)' },
      { key: 'autocomplete', path: 'autocomplete', type: 'text', label: 'Autocomplete' },
      { key: 'spellcheck', path: 'spellcheck', type: 'boolean', label: 'Spellcheck' },
      { key: 'value', path: 'value', type: 'textarea', label: 'Default Value' },
      { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
    ];
    // Updated Nunjucks (gracefully handle maxwords)
    const exportNunjucks = `{% from "govuk/components/character-count/macro.njk" import govukCharacterCount %}\n\n{{ govukCharacterCount({\n  name: props.name,\n  id: props.id or props.name,\n  rows: props.rows,\n  maxlength: props.maxlength,\n  maxwords: props.maxwords,\n  threshold: props.threshold,\n  label: props.label,\n  hint: props.hint,\n  errorMessage: props.errorMessage,\n  formGroup: props.formGroup,\n  classes: props.classes,\n  autocomplete: props.autocomplete,\n  spellcheck: props.spellcheck,\n  value: props.value\n}) }}`;
    await pool.query(
      `INSERT INTO iset_intake.component_template (template_key, version, type, label, description, default_props, prop_schema, has_options, option_schema, status, export_njk_template)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'character-count',
        nextVersion,
        'character-count',
        'Character Count',
        'Textarea with live character/word count (v2)',
        JSON.stringify(defaultProps),
        JSON.stringify(propSchema),
        0,
        null,
        'active',
        exportNunjucks
      ]
    );
    res.status(201).json({ ok: true, template_key: 'character-count', version: nextVersion });
  } catch (e) {
    console.error('character-count v2 create failed', e);
    res.status(500).json({ error: 'character_count_v2_failed', details: e.message });
  }
});

// POST /api/component-templates/textarea/version2
// Creates a new version (v2) of the textarea template with bilingual-ready defaults and expanded schema.
app.post('/api/component-templates/textarea/version2', async (_req, res) => {
  try {
    const [[row]] = await pool.query(`SELECT * FROM iset_intake.component_template WHERE template_key='textarea' AND status='active' ORDER BY version DESC LIMIT 1`);
    const currentVersion = row ? Number(row.version || 0) : 0;
    const nextVersion = currentVersion + 1;
    const base = (() => { try { return row ? JSON.parse(row.default_props || '{}') : {}; } catch { return {}; } })();
    const defaultProps = {
      name: base.name || 'more-detail',
      id: base.id || (base.name || 'more-detail'),
      label: base.label && typeof base.label === 'object' ? base.label : { text: base.label?.text || base.label || 'Textarea input', classes: (base.label && base.label.classes) || 'govuk-label--m' },
      hint: base.hint && typeof base.hint === 'object' ? base.hint : { text: base.hint?.text || "Don't include personal or financial information." },
      errorMessage: base.errorMessage && typeof base.errorMessage === 'object' ? base.errorMessage : { text: '' },
      classes: base.classes || '',
      rows: base.rows || 5,
      autocomplete: base.autocomplete || '',
      spellcheck: typeof base.spellcheck === 'boolean' ? base.spellcheck : true,
      value: base.value || ''
    };
    const propSchema = [
      { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
      { key: 'id', path: 'id', type: 'text', label: 'ID' },
      { key: 'label.text', path: 'label.text', type: 'text', label: 'Label Text' },
      { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: ['govuk-label--s','govuk-label--m','govuk-label--l','govuk-label--xl','govuk-visually-hidden'] },
      { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint Text' },
      { key: 'rows', path: 'rows', type: 'number', label: 'Rows' },
      { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' },
      { key: 'autocomplete', path: 'autocomplete', type: 'text', label: 'Autocomplete' },
      { key: 'spellcheck', path: 'spellcheck', type: 'boolean', label: 'Spellcheck' },
      { key: 'value', path: 'value', type: 'textarea', label: 'Default Value' }
    ];
    const nunjucks = `{% from "govuk/components/textarea/macro.njk" import govukTextarea %}\n\n{{ govukTextarea({\n  name: props.name,\n  id: props.id or props.name,\n  label: props.label,\n  hint: props.hint,\n  errorMessage: props.errorMessage,\n  classes: props.classes,\n  rows: props.rows,\n  autocomplete: props.autocomplete,\n  spellcheck: props.spellcheck,\n  value: props.value\n}) }}`;
    await pool.query(
      `INSERT INTO iset_intake.component_template (template_key, version, type, label, description, default_props, prop_schema, has_options, option_schema, status, export_njk_template)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'textarea',
        nextVersion,
        'textarea',
        'Textarea',
        'Multi-line text input (v2)',
        JSON.stringify(defaultProps),
        JSON.stringify(propSchema),
        0,
        null,
        'active',
        nunjucks
      ]
    );
    res.status(201).json({ ok: true, template_key: 'textarea', version: nextVersion });
  } catch (e) {
    console.error('textarea v2 create failed', e);
    res.status(500).json({ error: 'textarea_v2_failed', details: e.message });
  }
});

// POST /api/component-templates/prune-old
// Marks older active versions (status='active') of each template_key as 'inactive', keeping only the highest version active.
app.post('/api/component-templates/prune-old', async (_req, res) => {
  try {
    const [rows] = await pool.query(`SELECT template_key, MAX(version) AS maxv FROM iset_intake.component_template WHERE status='active' GROUP BY template_key`);
    let totalUpdated = 0;
    for (const r of rows) {
      const { template_key, maxv } = r;
      const [result] = await pool.query(
        `UPDATE iset_intake.component_template SET status='inactive' WHERE template_key=? AND status='active' AND version < ?`,
        [template_key, maxv]
      );
      totalUpdated += result.affectedRows || 0;
    }
    res.status(200).json({ ok: true, deactivated: totalUpdated });
  } catch (e) {
    console.error('prune-old failed', e);
    res.status(500).json({ error: 'prune_failed', details: e.message });
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

// --- Runtime Preview (normalized schema) --------------------------------------
// GET /api/workflows/:id/preview -> { steps, meta }
app.get('/api/workflows/:id/preview', async (req, res) => {
  if (!buildWorkflowSchema) return res.status(500).json({ error: 'preview_unavailable', message: 'Normalization module not loaded' });
  const { id } = req.params;
  const audit = String(req.query.auditTemplates || 'false').toLowerCase() === 'true';
  try {
    const out = await buildWorkflowSchema({ pool, workflowId: id, auditTemplates: audit });
    // Optional contract validation (dev aid): ?validate=true
    let validation = null;
    if (validateWorkflow && String(req.query.validate||'false').toLowerCase()==='true') {
      validation = validateWorkflow({ steps: out.steps, meta: out.meta });
    }
    res.status(200).json({ steps: out.steps, meta: out.meta, validation });
  } catch (e) {
    if (e.code === 404) return res.status(404).json({ error: 'Workflow not found' });
    if (e.code === 400) return res.status(400).json({ error: 'invalid_workflow', details: e.details, message: e.message });
    console.error('GET /api/workflows/:id/preview failed:', e);
    res.status(500).json({ error: 'Failed to build preview schema' });
  }
});

// Dev: validate workflow contract without fetching steps manually
app.get('/api/workflows/:id/validate', async (req,res) => {
  if (!buildWorkflowSchema || !validateWorkflow) return res.status(500).json({ error:'validator_unavailable' });
  try {
    const out = await buildWorkflowSchema({ pool, workflowId: req.params.id });
    const validation = validateWorkflow({ steps: out.steps, meta: out.meta });
    res.json(validation);
  } catch (e) {
    const status = e.code === 404 ? 404 : 500;
    res.status(status).json({ error: e.message });
  }
});

// Meta: list supported component types (helps admin UI understand renderer coverage)
app.get('/api/meta/supported-component-types', (_req, res) => {
  if (!SUPPORTED_COMPONENT_TYPES) return res.status(500).json({ error: 'not_available' });
  res.json({ types: Array.from(SUPPORTED_COMPONENT_TYPES) });
});

// --- Publish workflow to Public Portal (v1: immediate push) -----------------
// This builds a self-contained JSON array of steps (bilingual titles/descriptions only for now),
// supporting linear and single-field option-based routing, and writes it to the portal project.
// Target file (dev): ../ISET-intake/src/intakeFormSchema.json relative to this server file.
app.post('/api/workflows/:id/publish', async (req, res) => {
  const { id } = req.params;
  try {
    // Use unified normalization (includes conditional embedding) + template audit
    if (!buildWorkflowSchema) {
      return res.status(500).json({ error: 'normalizer_unavailable' });
    }
    const out = await buildWorkflowSchema({ pool, workflowId: id, auditTemplates: true });
    // Persist primary schema (steps array only for backward compatibility)
    const portalPath = path.resolve(__dirname, '..', 'ISET-intake', 'src', 'intakeFormSchema.json');
    fs.writeFileSync(portalPath, JSON.stringify(out.steps, null, 2), 'utf8');
    // Persist meta sidecar (reuse meta from normalizer, ensuring counts accurate to normalized output)
    const metaPath = path.resolve(__dirname, '..', 'ISET-intake', 'src', 'intakeFormSchema.meta.json');
    try {
      fs.writeFileSync(metaPath, JSON.stringify(out.meta, null, 2), 'utf8');
    } catch (e) {
      console.warn('Failed to write workflow schema meta file:', e && e.message ? e.message : e);
    }
    res.status(200).json({ message: 'Published', portalPath, steps: out.steps.length, metaPath });
  } catch (err) {
    if (err && err.code === 400) {
      const payload = { error: err.message || 'Validation failed' };
      if (err.details) payload.details = err.details;
      return res.status(400).json(payload);
    }
    if (err && err.code === 404) {
      return res.status(404).json({ error: err.message || 'Workflow not found' });
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
      let editable = parseJson(r.prop_schema) ?? [];
      // 1. Broad removal of legacy 'required' editable field (validation panel now authoritative)
      editable = editable.filter(f => (f.key !== 'required' && f.path !== 'required'));
      // 2. Ensure label.classes select for any component that has label.text editing but lacks label.classes
      const hasLabelText = editable.some(f => f.path === 'label.text' || f.key === 'label.text');
      const hasLabelClasses = editable.some(f => f.path === 'label.classes' || f.key === 'label.classes');
      const labelClassOptions = [ 'govuk-label', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl' ];
      if (hasLabelText && !hasLabelClasses) {
        const insertIdx = editable.findIndex(f => f.path === 'label.text' || f.key === 'label.text');
        const fieldDef = {
          key: 'label.classes',
          path: 'label.classes',
          type: 'select',
          label: 'Label classes',
          options: labelClassOptions
        };
        if (insertIdx >= 0) editable.splice(insertIdx + 1, 0, fieldDef); else editable.push(fieldDef);
      }
      // 3. Component-type specific normalisation for character-count / textarea / input to ensure default label classes
      if (['character-count','textarea','input','select','file-upload','password-input'].includes(t)) {
        if (!propsRaw.label || typeof propsRaw.label !== 'object') {
          propsRaw.label = { text: (propsRaw.label && propsRaw.label.text) || (propsRaw.label && typeof propsRaw.label === 'string' ? propsRaw.label : 'Label'), classes: 'govuk-label--m' };
        } else if (!propsRaw.label.classes) {
          propsRaw.label.classes = 'govuk-label--m';
        }
      }
      // 4. Backfill lost default props for certain templates (post-migration safety net)
      if (t === 'character-count') {
        if (!('name' in propsRaw)) propsRaw.name = 'message';
        if (!('id' in propsRaw)) propsRaw.id = '';
        if (!('rows' in propsRaw)) propsRaw.rows = '5';
        if (!('maxlength' in propsRaw)) propsRaw.maxlength = '200';
        if (!('threshold' in propsRaw)) propsRaw.threshold = '75';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object') propsRaw.hint = { text: 'Do not include personal information.' };
        if (!propsRaw.formGroup) propsRaw.formGroup = { classes: '' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
      } else if (t === 'input') {
        if (!('name' in propsRaw)) propsRaw.name = 'input-1';
        if (!('id' in propsRaw)) propsRaw.id = 'input-1';
        if (!('type' in propsRaw)) propsRaw.type = 'text';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'This is the optional hint text' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
        if (!propsRaw.formGroup) propsRaw.formGroup = { classes: '' };
      } else if (t === 'textarea') {
        if (!('name' in propsRaw)) propsRaw.name = 'more-detail';
        if (!('id' in propsRaw)) propsRaw.id = 'more-detail';
        if (!('rows' in propsRaw)) propsRaw.rows = '5';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'Don\'t include personal or financial information.' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
        if (!propsRaw.formGroup) propsRaw.formGroup = { classes: '' };
      } else if (t === 'select') {
        if (!('name' in propsRaw)) propsRaw.name = 'example-select';
        if (!Array.isArray(propsRaw.items) || !propsRaw.items.length) {
          propsRaw.items = [ { text: 'Option 1', value: '1' }, { text: 'Option 2', value: '2' }, { text: 'Option 3', value: '3' } ];
        }
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'Pick from the options' };
      } else if (t === 'file-upload') {
        if (!('name' in propsRaw)) propsRaw.name = 'uploadedFile';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'Files must be under 10MB.' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
      } else if (t === 'password-input') {
        if (!('name' in propsRaw)) propsRaw.name = 'password';
        if (!propsRaw.hint || typeof propsRaw.hint !== 'object' || !propsRaw.hint.text) propsRaw.hint = { text: 'This is the optional hint text' };
        if (!propsRaw.errorMessage) propsRaw.errorMessage = { text: '' };
      }
      // 5. Reconstruct editable_fields if empty (DB may have lost schema). Build minimal viable schema.
      if ((!editable || !editable.length) && ['character-count','input','textarea','select','file-upload','password-input'].includes(t)) {
        const labelClassOptions = [ 'govuk-label', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl' ];
        if (t === 'character-count') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'maxlength', path: 'maxlength', type: 'text', label: 'Max Length' },
            { key: 'threshold', path: 'threshold', type: 'text', label: 'Threshold (%)' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        } else if (t === 'input') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Field name' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'type', path: 'type', type: 'enum', label: 'Input type', options: ['text','email','number','password','tel','url','search'] },
            { key: 'label.text', path: 'label.text', type: 'text', label: 'Label' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hint.text', path: 'hint.text', type: 'text', label: 'Hint' },
            { key: 'errorMessage.text', path: 'errorMessage.text', type: 'text', label: 'Error message' },
            { key: 'classes', path: 'classes', type: 'text', label: 'Input classes' }
          ];
        } else if (t === 'textarea') {
          editable = [
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'labelClasses', path: 'label.classes', type: 'select', label: 'Label Classes', options: labelClassOptions.slice(0,4) },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'rows', path: 'rows', type: 'text', label: 'Rows (number as text)' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        } else if (t === 'select') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        } else if (t === 'file-upload') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        } else if (t === 'password-input') {
          editable = [
            { key: 'name', path: 'name', type: 'text', label: 'Submission Key' },
            { key: 'id', path: 'id', type: 'text', label: 'ID' },
            { key: 'labelText', path: 'label.text', type: 'text', label: 'Label Text' },
            { key: 'label.classes', path: 'label.classes', type: 'select', label: 'Label classes', options: labelClassOptions },
            { key: 'hintText', path: 'hint.text', type: 'text', label: 'Hint Text' },
            { key: 'classes', path: 'classes', type: 'text', label: 'CSS Classes' }
          ];
        }
      }
      return {
        id: r.id,
        key: r.template_key,
        version: r.version,
        type: r.type,
        label: r.label,
        description: r.description ?? null,
        props: propsRaw,
        editable_fields: editable,
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
  // Defensive sanitation: strip placeholder summary-list rows if dynamic config present
  if (Array.isArray(components)) {
    components.forEach(c => {
      try {
        if (!c || !c.props) return;
        const t = String(c.template_key || c.type || '').toLowerCase();
        if (t === 'summary-list') {
          const p = c.props;
            const hasConfig = (Array.isArray(p.included) && p.included.length) || p.workflowId;
            if (hasConfig && Array.isArray(p.rows)) delete p.rows;
        }
      } catch { /* ignore */ }
    });
  }
  if (!name || !Array.isArray(components)) {
    return res.status(400).json({ error: 'name and components[] are required' });
  }
  // Server-side validation: Data Key uniqueness + pattern; date-input structural integrity
  try {
    const seen = new Map(); // lowercased name -> original
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      if (!c || typeof c !== 'object') continue;
      const props = c.props || {};
      const dataKey = props.name;
      if (dataKey != null) {
        if (typeof dataKey !== 'string' || !/^[-a-z0-9_]+$/.test(dataKey)) {
          return res.status(400).json({ error: `Invalid Data Key at component index ${i}: must match ^[-a-z0-9_]+$` });
        }
        const k = dataKey.toLowerCase();
        if (seen.has(k)) {
          return res.status(400).json({ error: `Duplicate Data Key '${dataKey}' at component index ${i} (also used earlier)` });
        }
        seen.set(k, dataKey);
      }
      // date-input structural validation (lightweight)
      const typeKey = String(c.template_key || c.type || '').toLowerCase();
      if (typeKey === 'date-input' || typeKey === 'date') {
        if (!Array.isArray(props.items)) {
          return res.status(400).json({ error: `date-input at index ${i} missing items[] array` });
        }
        const names = props.items.map(it => it && it.name).filter(Boolean);
        const requiredParts = ['day','month','year'];
        const missing = requiredParts.filter(r => !names.includes(r));
        if (missing.length) {
          return res.status(400).json({ error: `date-input at index ${i} missing required parts: ${missing.join(', ')}` });
        }
      }
      if (typeKey === 'file-upload' || typeKey === 'fileupload') {
        if (props.accept && typeof props.accept === 'string') {
          if (props.accept.length > 200) return res.status(400).json({ error: `file-upload at index ${i} accept too long (max 200 chars)` });
          const parts = props.accept.split(',').map(s => s.trim()).filter(Boolean);
          if (parts.length > 0) {
            const invalid = parts.filter(p => !/^\.[A-Za-z0-9]+$/.test(p) && !/^[A-Za-z0-9-]+\/[A-Za-z0-9+.-]+$/.test(p));
            if (invalid.length) return res.status(400).json({ error: `file-upload at index ${i} invalid accept tokens: ${invalid.slice(0,5).join(', ')}` });
          }
        }
        if (props.documentType && typeof props.documentType === 'string') {
          if (!/^[-a-zA-Z0-9_]+$/.test(props.documentType)) return res.status(400).json({ error: `file-upload at index ${i} invalid documentType (use alphanumeric, dash, underscore)` });
          if (props.documentType.length > 40) return res.status(400).json({ error: `file-upload at index ${i} documentType too long (max 40)` });
        }
      }
    }
  } catch (e) {
    return res.status(400).json({ error: 'Validation failed', details: String(e).slice(0,200) });
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
  // Defensive sanitation (same as POST)
  if (Array.isArray(components)) {
    components.forEach(c => {
      try {
        if (!c || !c.props) return;
        const t = String(c.template_key || c.type || '').toLowerCase();
        if (t === 'summary-list') {
          const p = c.props;
          const hasConfig = (Array.isArray(p.included) && p.included.length) || p.workflowId;
          if (hasConfig && Array.isArray(p.rows)) delete p.rows;
        }
      } catch { /* ignore */ }
    });
  }
  try {
    if (Array.isArray(components)) {
      // Same validation logic as in POST route
      const seen = new Map();
      for (let i = 0; i < components.length; i++) {
        const c = components[i];
        if (!c || typeof c !== 'object') continue;
        const props = c.props || {};
        const dataKey = props.name;
        if (dataKey != null) {
          if (typeof dataKey !== 'string' || !/^[-a-z0-9_]+$/.test(dataKey)) {
            return res.status(400).json({ error: `Invalid Data Key at component index ${i}: must match ^[-a-z0-9_]+$` });
          }
          const k = dataKey.toLowerCase();
          if (seen.has(k)) {
            return res.status(400).json({ error: `Duplicate Data Key '${dataKey}' at component index ${i} (also used earlier)` });
          }
          seen.set(k, dataKey);
        }
        const typeKey = String(c.template_key || c.type || '').toLowerCase();
        if (typeKey === 'date-input' || typeKey === 'date') {
          if (!Array.isArray(props.items)) {
            return res.status(400).json({ error: `date-input at index ${i} missing items[] array` });
          }
          const names = props.items.map(it => it && it.name).filter(Boolean);
          const requiredParts = ['day','month','year'];
          const missing = requiredParts.filter(r => !names.includes(r));
          if (missing.length) {
            return res.status(400).json({ error: `date-input at index ${i} missing required parts: ${missing.join(', ')}` });
          }
        }
        if (typeKey === 'file-upload' || typeKey === 'fileupload') {
          if (props.accept && typeof props.accept === 'string') {
            if (props.accept.length > 200) return res.status(400).json({ error: `file-upload at index ${i} accept too long (max 200 chars)` });
            const parts = props.accept.split(',').map(s => s.trim()).filter(Boolean);
            if (parts.length > 0) {
              const invalid = parts.filter(p => !/^\.[A-Za-z0-9]+$/.test(p) && !/^[A-Za-z0-9-]+\/[A-Za-z0-9+.-]+$/.test(p));
              if (invalid.length) return res.status(400).json({ error: `file-upload at index ${i} invalid accept tokens: ${invalid.slice(0,5).join(', ')}` });
            }
          }
          if (props.documentType && typeof props.documentType === 'string') {
            if (!/^[-a-zA-Z0-9_]+$/.test(props.documentType)) return res.status(400).json({ error: `file-upload at index ${i} invalid documentType (use alphanumeric, dash, underscore)` });
            if (props.documentType.length > 40) return res.status(400).json({ error: `file-upload at index ${i} documentType too long (max 40)` });
          }
        }
      }
    }
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
 * In new minimal schema:
 * - If application_id is provided, create case referencing existing working application.
 * - Else if submission_id provided, ingest submission -> working application (iset_application) then create case.
 * Body fields:
 *   submission_id?: number
 *   application_id?: number
 *   assigned_to_user_id?: number | null
 */
app.post('/api/cases', async (req, res) => {
  const { submission_id, application_id, assigned_to_user_id = null } = req.body || {};

  if (!application_id && !submission_id) {
    return res.status(400).json({ error: 'Provide either application_id or submission_id' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let workingApplicationId = application_id || null;

    if (!workingApplicationId && submission_id) {
      // Check existing working application for submission
      const [existingApp] = await conn.query(
        'SELECT id FROM iset_application WHERE submission_id = ? LIMIT 1',
        [submission_id]
      );
      if (existingApp.length > 0) {
        workingApplicationId = existingApp[0].id;
      } else {
        // Fetch submission row
        const [subRows] = await conn.query(
          'SELECT * FROM iset_application_submission WHERE id = ? LIMIT 1',
          [submission_id]
        );
        if (subRows.length === 0) {
          await conn.rollback();
          return res.status(404).json({ error: 'submission_not_found' });
        }
        const submission = subRows[0];
        // Build payload snapshot
        const payload = { source: 'submission_ingest', ingested_at: new Date().toISOString(), submission_snapshot: submission };
        const [insertApp] = await conn.query(
          'INSERT INTO iset_application (submission_id, payload_json, status, version, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())',
          [submission_id, JSON.stringify(payload), 'active', 1]
        );
        workingApplicationId = insertApp.insertId;
      }
    }

    // Prevent duplicate case for application
    const [caseExists] = await conn.query(
      'SELECT id FROM iset_case WHERE application_id = ? LIMIT 1',
      [workingApplicationId]
    );
    if (caseExists.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'case_already_exists', case_id: caseExists[0].id });
    }

    const [insertCase] = await conn.query(
      'INSERT INTO iset_case (application_id, assigned_to_user_id, status, created_at, updated_at) VALUES (?,?,?,?,?)',
      [workingApplicationId, assigned_to_user_id, 'open', new Date(), new Date()]
    );

    await conn.commit();
    return res.status(201).json({ message: 'case_created', case_id: insertCase.insertId, application_id: workingApplicationId });
  } catch (err) {
    await conn.rollback();
    console.error('Error creating case (minimal ingestion flow):', err);
    return res.status(500).json({ error: 'internal_error', detail: err.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/applications/ingest-from-submission
 * Body: { submission_id }
 * Idempotent: returns existing working application if already ingested.
 */
app.post('/api/applications/ingest-from-submission', async (req, res) => {
  const { submission_id } = req.body || {};
  if (!submission_id) return res.status(400).json({ error: 'submission_id_required' });
  try {
    const [existing] = await pool.query('SELECT id FROM iset_application WHERE submission_id = ? LIMIT 1', [submission_id]);
    if (existing.length > 0) {
      return res.status(200).json({ message: 'already_ingested', application_id: existing[0].id });
    }
    const [subRows] = await pool.query('SELECT * FROM iset_application_submission WHERE id = ? LIMIT 1', [submission_id]);
    if (subRows.length === 0) return res.status(404).json({ error: 'submission_not_found' });
    const submission = subRows[0];
    const payload = { source: 'submission_ingest_manual', ingested_at: new Date().toISOString(), submission_snapshot: submission };
    const [insertApp] = await pool.query(
      'INSERT INTO iset_application (submission_id, payload_json, status, version, created_at, updated_at) VALUES (?,?,?,?,NOW(),NOW())',
      [submission_id, JSON.stringify(payload), 'active', 1]
    );
    return res.status(201).json({ message: 'ingested', application_id: insertApp.insertId });
  } catch (err) {
    console.error('Error ingesting submission:', err);
    return res.status(500).json({ error: 'internal_error', detail: err.message });
  }
});



/**
 * GET /api/case-assignment/unassigned-applications
 *
 * Updated to source from iset_application_submission (new submission persistence table).
 * Returns submissions that have no corresponding case in iset_case.
 *
 * Response fields expected by frontend widget:
 * - application_id (aliased to submission id for now; will map when case created)
 * - tracking_id (submission reference_number)
 * - applicant_name
 * - email
 * - submitted_at
 */
app.get('/api/case-assignment/unassigned-applications', async (req, res) => {
  try {
    let sql = `
      SELECT 
        s.id AS application_id,
        s.reference_number AS tracking_id,
        s.submitted_at AS submitted_at,
        u.name AS applicant_name,
        u.email AS email
      FROM iset_application_submission s
      JOIN user u ON s.user_id = u.id
      LEFT JOIN iset_case c ON c.application_id = s.id  -- NOTE: temporary if application_id will point to submission id in new model
      WHERE c.id IS NULL\n`;
    const params = [];
    // NOTE: Scoping disabled for submissions until region / ownership columns are defined on iset_application_submission.
    // Previous attempt tried to use scopeApplications and introduced a nonexistent s.region_id reference causing errors.
    sql += '      ORDER BY s.submitted_at DESC';
    const [rows] = await pool.query(sql, params);
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching unassigned applications (submission table):', err);
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

// Unified applicant documents endpoint now sources from iset_document (generalized store)
app.get('/api/applicants/:id/documents', async (req, res) => {
  const applicantId = req.params.id;
  try {
    const [rows] = await pool.query(
      `SELECT id, case_id, application_id, file_name, file_path, label, source, created_at AS uploaded_at
       FROM iset_document
       WHERE applicant_user_id = ? AND status = 'active'
       ORDER BY created_at DESC`,
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

        ANY_VALUE(e.name) AS assigned_user_name,
        ANY_VALUE(e.email) AS assigned_user_email,
        GROUP_CONCAT(p.iset_code SEPARATOR ', ') AS assigned_user_ptmas,

        ANY_VALUE(a.tracking_id) AS tracking_id,
        ANY_VALUE(a.created_at) AS submitted_at,
  ANY_VALUE(applicant.name) AS applicant_name,
  ANY_VALUE(applicant.email) AS applicant_email,
  ANY_VALUE(applicant.id) AS applicant_user_id

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
    try {
      const authProvider = String(process.env.AUTH_PROVIDER || 'none').toLowerCase();
      if (authProvider === 'cognito') {
        const { scopeCases } = require('./src/lib/dbScope');
        const { sql: scopeSql, params: scopeParams } = scopeCases(req.auth || {}, 'c');
        sql += (stage ? ' AND ' : 'WHERE ') + scopeSql + '\n';
        params.push(...scopeParams);
      }
    } catch (_) {}

    // ONLY_FULL_GROUP_BY compliance: group by primary key and aggregate/ANY_VALUE everything else.
    sql += 'GROUP BY c.id\nORDER BY c.last_activity_at DESC';

    const [rows] = await pool.query(sql, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// -------------------------------------------------------------
// Application Versioning (Working Copy) Endpoints (Initial Draft)
// -------------------------------------------------------------
// GET /api/cases/:case_id/application/versions  -> list metadata of versions
// GET /api/cases/:case_id/application/current   -> current working version payload
// POST /api/cases/:case_id/application/versions -> create new version (full payload replace for now)

app.get('/api/cases/:case_id/application/versions', async (req, res) => {
  const caseId = Number(req.params.case_id);
  if (!caseId) return res.status(400).json({ error: 'invalid_case_id' });
  try {
    const [rows] = await pool.query(
      `SELECT id, version_number, created_at, source_type, change_summary, is_current
         FROM iset_application_version
        WHERE case_id = ?
        ORDER BY version_number ASC`,
      [caseId]
    );
    return res.json(rows);
  } catch (e) {
    console.error('[versions:list] error', e);
    return res.status(500).json({ error: 'failed_to_list_versions' });
  }
});

app.get('/api/cases/:case_id/application/current', async (req, res) => {
  const caseId = Number(req.params.case_id);
  if (!caseId) return res.status(400).json({ error: 'invalid_case_id' });
  try {
    const [[row]] = await pool.query(
      `SELECT id, version_number, payload_json, created_at, source_type, change_summary
         FROM iset_application_version
        WHERE case_id = ? AND is_current = 1
        LIMIT 1`,
      [caseId]
    );
    if (!row) return res.status(404).json({ error: 'no_current_version' });
    return res.json(row);
  } catch (e) {
    console.error('[versions:current] error', e);
    return res.status(500).json({ error: 'failed_to_fetch_current_version' });
  }
});

app.post('/api/cases/:case_id/application/versions', async (req, res) => {
  const caseId = Number(req.params.case_id);
  if (!caseId) return res.status(400).json({ error: 'invalid_case_id' });
  const { payload, changeSummary, sourceType = 'manual_edit' } = req.body || {};
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload_required' });
  try {
    // Fetch current version
    const [[current]] = await pool.query(
      `SELECT id, version_number, payload_json, submission_id
         FROM iset_application_version
        WHERE case_id = ? AND is_current = 1
        LIMIT 1`,
      [caseId]
    );
    if (!current) {
      return res.status(409).json({ error: 'no_initial_version', message: 'Initial version not seeded yet.' });
    }
    const nextVersion = current.version_number + 1;
    const crypto = require('crypto');
    const canonical = JSON.stringify(payload);
    const hash = crypto.createHash('sha256').update(canonical).digest('hex');
    // Mark old current
    await pool.query('UPDATE iset_application_version SET is_current = 0 WHERE id = ?', [current.id]);
    // Insert new
    await pool.query(
      `INSERT INTO iset_application_version (
         case_id, submission_id, version_number, payload_json, created_by_evaluator_id, change_summary, source_type, previous_version_id, payload_hash, is_current
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        caseId,
        current.submission_id,
        nextVersion,
        JSON.stringify(payload),
        null, // TODO: link evaluator (need auth mapping)
        changeSummary || null,
        sourceType,
        current.id,
        hash
      ]
    );
    return res.status(201).json({ message: 'version_created', version_number: nextVersion, hash });
  } catch (e) {
    console.error('[versions:create] error', e);
    return res.status(500).json({ error: 'failed_to_create_version' });
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

// --- Unified Applications Listing Endpoint ----------------------------------
// GET /api/applications?status=Open,In%20Review&limit=50&offset=0
// Role scoping rules (no client override):
//   Program Administrator -> all cases
//   Regional Coordinator  -> cases in their region/team (derivation TBD: using evaluator_ptma join as proxy)
//   Application Assessor  -> only cases assigned to them
// If a submission exists with no case yet:
//   - Visible only to Program Administrators (future) – currently excluded for simplicity
// Response: { count, rows:[ { case_id, tracking_id, applicant_name, status, assigned_user_id, assigned_user_name, submitted_at, region, ptma_codes, sla_risk } ] }
app.get('/api/applications', async (req, res) => {
  try {
    if (!req.auth || req.auth.subjectType !== 'staff') return res.status(403).json({ error: 'forbidden' });
    const { status, limit = 50, offset = 0, search } = req.query;
    const role = req.auth.role;
    const regionId = req.auth.regionId || req.staffProfile?.region_id || null;

    // Base case + application join using new lean model.
    // Assignment user now from staff_profiles (nullable); tracking_id fallback derived from payload_json->submission_snapshot.reference_number if tracking_id column absent.
    // We'll attempt to select a.tracking_id; if schema lacks it, COALESCE will choose JSON extracted value.
    let baseSql = `SELECT c.id AS case_id, c.application_id, c.status, c.assigned_to_user_id,
      c.created_at AS opened_at, c.updated_at AS last_activity_at,
      sp.email AS assigned_user_email, sp.primary_role AS assigned_user_role,
      sp.id AS staff_profile_id,
      JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id,
      a.created_at AS submitted_at,
      0 AS is_unassigned_submission
      FROM iset_case c
      JOIN iset_application a ON c.application_id = a.id
      LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id`;

    const where = [];
    const params = [];
    if (status) {
      const list = String(status).split(',').map(s => s.trim()).filter(Boolean);
      if (list.length) { where.push(`c.status IN (${list.map(()=>'?').join(',')})`); params.push(...list); }
    }
    if (search) {
      const term = `%${search}%`;
  where.push("(JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) LIKE ? OR sp.email LIKE ? OR c.case_summary LIKE ?)");
      params.push(term, term, term);
    }

    if (role === 'Application Assessor') {
      if (!req.staffProfile?.id) return res.json({ count: 0, rows: [] });
      where.push('c.assigned_to_user_id = ?'); params.push(req.staffProfile.id);
    } else if (role === 'Regional Coordinator') {
      // For now: filter by shared region (when regionId present) OR assignments directly to coordinator
      if (regionId) {
        where.push('(sp.region_id = ? OR c.assigned_to_user_id = ?)');
        params.push(regionId, req.staffProfile?.id || 0);
      } else if (req.staffProfile?.id) {
        where.push('c.assigned_to_user_id = ?'); params.push(req.staffProfile.id);
      } else {
        return res.json({ count: 0, rows: [] });
      }
    } else if (role === 'System Administrator' || role === 'Program Administrator') {
      // full access
    } else {
      return res.status(403).json({ error: 'forbidden_role' });
    }

    if (where.length) baseSql += '\nWHERE ' + where.join(' AND ');
    baseSql += '\nGROUP BY c.id';

    let finalSql = baseSql;
    const finalParams = [...params];

    // Add unassigned submissions (applications without case) for elevated roles.
    if (role === 'Program Administrator' || role === 'System Administrator') {
      finalSql = `(${baseSql})\nUNION ALL\n(
        SELECT NULL AS case_id, a.id AS application_id, 'New' AS status, NULL AS assigned_to_user_id, NULL AS opened_at, NULL AS last_activity_at,
        NULL AS assigned_user_email, NULL AS assigned_user_role, NULL AS staff_profile_id,
  JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')) AS tracking_id,
        a.created_at AS submitted_at,
        1 AS is_unassigned_submission
        FROM iset_application a
        LEFT JOIN iset_case c2 ON c2.application_id = a.id
        WHERE c2.id IS NULL
      )`;
    }

    finalSql += `\nORDER BY submitted_at DESC\nLIMIT ? OFFSET ?`;
    finalParams.push(Number(limit), Number(offset));

    const [rows] = await pool.query(finalSql, finalParams);

    // Count
    let count = rows.length;
    try {
      if (role === 'Program Administrator' || role === 'System Administrator') {
        let countCaseSql = 'SELECT COUNT(DISTINCT c.id) AS cnt FROM iset_case c JOIN iset_application a ON c.application_id = a.id LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id';
        if (where.length) countCaseSql += ' WHERE ' + where.join(' AND ');
        const [[caseCnt]] = await pool.query(countCaseSql, params);
        const [[unassignedCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM iset_application a LEFT JOIN iset_case c2 ON c2.application_id = a.id WHERE c2.id IS NULL');
        count = (caseCnt?.cnt || 0) + (unassignedCnt?.cnt || 0);
      } else {
        let countSql = 'SELECT COUNT(DISTINCT c.id) AS cnt FROM iset_case c JOIN iset_application a ON c.application_id = a.id LEFT JOIN staff_profiles sp ON sp.id = c.assigned_to_user_id';
        if (where.length) countSql += ' WHERE ' + where.join(' AND ');
        const [[cRow]] = await pool.query(countSql, params);
        if (cRow && typeof cRow.cnt === 'number') count = cRow.cnt;
      }
    } catch (_) {}

    const now = Date.now();
    const rowsOut = rows.map(r => {
      const submittedMs = r.submitted_at ? new Date(r.submitted_at).getTime() : now;
      const ageDays = (now - submittedMs) / 86400000;
      const sla_risk = (r.status !== 'Closed' && r.status !== 'Rejected' && ageDays > 14) ? 'overdue' : 'ok';
      return {
        case_id: r.case_id,
        tracking_id: r.tracking_id,
        status: r.status,
        assigned_user_id: r.assigned_to_user_id,
        assigned_user_email: r.assigned_user_email || null,
        assigned_user_role: r.assigned_user_role || null,
        submitted_at: r.submitted_at,
        ptma_codes: null, // legacy field removed; placeholder for future taxonomy
        region: null, // region derivation TBD (could parse from application payload or staff profile)
        is_unassigned: r.is_unassigned_submission === 1,
        sla_risk
      };
    });
    res.json({ count, rows: rowsOut });
  } catch (e) {
    console.error('GET /api/applications failed:', e);
    res.status(500).json({ error: 'applications_fetch_failed', message: e.message });
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

    // Derive applicant_user_id for adoption (best effort)
    let applicantUserId = null;
    if (caseId) {
      try {
        const [[caseRow]] = await pool.query(
          'SELECT application_id FROM iset_case WHERE id = ? LIMIT 1',
          [caseId]
        );
        if (caseRow && caseRow.application_id) {
          const [[appRow]] = await pool.query(
            'SELECT user_id FROM iset_application WHERE id = ? LIMIT 1',
            [caseRow.application_id]
          );
            applicantUserId = appRow ? appRow.user_id : null;
        }
      } catch (_) {}
    }
    // Adopt each attachment into iset_document (idempotent on file_path)
    if (caseId) {
      for (const att of attachments) {
        let relativeFilePath = att.file_path.replace(/\\/g, '/');
        const uploadsIndex = relativeFilePath.lastIndexOf('uploads/');
        if (uploadsIndex !== -1) {
          relativeFilePath = relativeFilePath.substring(uploadsIndex);
        }
        relativeFilePath = relativeFilePath.replace(/\\/g, '/');
        try {
          await pool.query(
            `INSERT INTO iset_document (case_id, application_id, applicant_user_id, user_id, origin_message_id, source, file_name, file_path, label, created_at)
             VALUES (?, ?, ?, ?, ?, 'secure_message_attachment', ?, ?, 'Secure Message Attachment', ?)
             ON DUPLICATE KEY UPDATE origin_message_id = VALUES(origin_message_id), updated_at = NOW()` ,
            [
              caseId,
              (caseId ? (await pool.query('SELECT application_id FROM iset_case WHERE id = ? LIMIT 1', [caseId]))[0][0]?.application_id || null : null),
              applicantUserId,
              att.user_id || message.sender_id || message.recipient_id,
              messageId,
              att.original_filename,
              relativeFilePath,
              att.uploaded_at || new Date()
            ]
          );
        } catch (err) {
          if (err && (err.code === 'ER_DUP_ENTRY' || err.code === '23505')) {
            continue;
          } else {
            console.error('Error inserting into iset_document:', err);
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

