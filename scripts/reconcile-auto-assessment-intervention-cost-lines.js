const mysql = require('mysql2/promise');

try {
  const path = require('path');
  const dotenvPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '..', '.env.production')
    : path.join(__dirname, '..', '.env');
  require('dotenv').config({ path: dotenvPath });
} catch (_) {}

function safeJsonParse(value, fallback = null) {
  if (value === null || typeof value === 'undefined') return fallback;
  try {
    if (Buffer.isBuffer(value)) return JSON.parse(value.toString('utf8'));
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object') return value;
  } catch (_) {}
  return fallback;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function normalizeInterventionCode(value) {
  if (value === null || typeof value === 'undefined') return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeAssessmentProposedInterventions(raw) {
  const parsed = safeJsonParse(raw, raw);
  const list = Array.isArray(parsed) ? parsed : [];
  return list
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const costLines = Array.isArray(item.costLines) ? item.costLines.filter(Boolean) : [];
      return {
        id: item.id ? String(item.id) : null,
        code: normalizeInterventionCode(item.code),
        startDate: normalizeDateOnly(item.startDate || item.start_date),
        endDate: normalizeDateOnly(item.endDate || item.end_date),
        costLines,
        fundingBreakdown: costLines
          .map(line => {
            const amount = Number(line?.amount);
            if (!Number.isFinite(amount) || amount <= 0) return null;
            return {
              label: line?.type ? String(line.type) : null,
              amount: Math.round(amount * 100) / 100,
            };
          })
          .filter(Boolean),
        deliveryMode: item.deliveryMode || item.delivery_mode || null,
        institution: item.institution || null,
        programName: item.programName || item.program_name || null,
        wageSubsidyDetails: item.wageSubsidyDetails || item.wage_subsidy_details || null,
        noc: item.interventionNoc || item.intervention_noc || item.noc || null,
        nocVersion:
          item.interventionNocVersion || item.intervention_noc_version || item.nocVersion || item.noc_version || null,
        index: index + 1,
      };
    })
    .filter(Boolean);
}

function pickMatchingProposal(interventionRow, proposals, metadata) {
  if (!Array.isArray(proposals) || proposals.length === 0) return null;
  const proposedInterventionId =
    metadata?.proposedInterventionId || metadata?.proposed_intervention_id || null;
  if (proposedInterventionId) {
    const exact = proposals.find(entry => entry.id && entry.id === String(proposedInterventionId));
    if (exact) return exact;
  }

  const code = normalizeInterventionCode(interventionRow.intervention_code);
  const startDate = normalizeDateOnly(interventionRow.start_date);
  const endDate = normalizeDateOnly(interventionRow.end_date);

  const exactDateMatch = proposals.filter(entry =>
    entry.code === code &&
    entry.startDate === startDate &&
    (entry.endDate || null) === (endDate || null)
  );
  if (exactDateMatch.length === 1) return exactDateMatch[0];

  const startOnlyMatch = proposals.filter(entry =>
    entry.code === code &&
    entry.startDate === startDate
  );
  if (startOnlyMatch.length === 1) return startOnlyMatch[0];

  const codeOnlyMatch = proposals.filter(entry => entry.code === code);
  if (codeOnlyMatch.length === 1) return codeOnlyMatch[0];

  return null;
}

function parseArgs(argv) {
  const args = { apply: false, caseId: null };
  argv.forEach(arg => {
    if (arg === '--apply') {
      args.apply = true;
      return;
    }
    if (arg.startsWith('--case-id=')) {
      const raw = Number(arg.slice('--case-id='.length));
      args.caseId = Number.isInteger(raw) && raw > 0 ? raw : null;
    }
  });
  return args;
}

async function main() {
  const { apply, caseId } = parseArgs(process.argv.slice(2));
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'iset_intake',
    waitForConnections: true,
    connectionLimit: 4,
    charset: 'utf8mb4_general_ci',
  });

  const params = [];
  let sql = `
    SELECT
      ci.id,
      ci.case_id,
      ci.intervention_code,
      ci.start_date,
      ci.end_date,
      ci.metadata_json,
      ca.proposed_interventions
    FROM iset_case_intervention ci
    JOIN iset_case_assessment ca ON ca.case_id = ci.case_id
    WHERE JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'auto_assessment'
      AND (
        JSON_EXTRACT(ci.metadata_json, '$.costLines') IS NULL
        OR JSON_LENGTH(JSON_EXTRACT(ci.metadata_json, '$.costLines')) = 0
      )
      AND ca.proposed_interventions IS NOT NULL
  `;
  if (caseId) {
    sql += ' AND ci.case_id = ?';
    params.push(caseId);
  }
  sql += ' ORDER BY ci.case_id, ci.id';

  const [rows] = await pool.query(sql, params);
  const actions = [];

  for (const row of rows) {
    const metadata = safeJsonParse(row.metadata_json, {}) || {};
    const proposals = normalizeAssessmentProposedInterventions(row.proposed_interventions);
    const match = pickMatchingProposal(row, proposals, metadata);
    if (!match) {
      actions.push({
        interventionId: row.id,
        caseId: row.case_id,
        action: 'skip',
        reason: 'no_unique_match',
      });
      continue;
    }
    if (!Array.isArray(match.costLines) || match.costLines.length === 0) {
      actions.push({
        interventionId: row.id,
        caseId: row.case_id,
        action: 'skip',
        reason: 'matched_proposal_has_no_cost_lines',
      });
      continue;
    }

    const nextMetadata = {
      ...metadata,
      costLines: match.costLines,
      fundingBreakdown: match.fundingBreakdown.length ? match.fundingBreakdown : metadata.fundingBreakdown || null,
    };
    if (!nextMetadata.deliveryMode && match.deliveryMode) nextMetadata.deliveryMode = match.deliveryMode;
    if (!nextMetadata.institution && match.institution) nextMetadata.institution = match.institution;
    if (!nextMetadata.programName && match.programName) nextMetadata.programName = match.programName;
    if (!nextMetadata.wageSubsidyDetails && match.wageSubsidyDetails) {
      nextMetadata.wageSubsidyDetails = match.wageSubsidyDetails;
    }
    if (!nextMetadata.noc && match.noc) nextMetadata.noc = match.noc;
    if (!nextMetadata.nocVersion && match.nocVersion) nextMetadata.nocVersion = match.nocVersion;

    actions.push({
      interventionId: row.id,
      caseId: row.case_id,
      action: apply ? 'update' : 'would_update',
      matchedProposalId: match.id || null,
      costLineCount: match.costLines.length,
    });

    if (apply) {
      await pool.query(
        'UPDATE iset_case_intervention SET metadata_json = ?, updated_at = NOW() WHERE id = ?',
        [JSON.stringify(nextMetadata), row.id]
      );
    }
  }

  const summary = actions.reduce((acc, item) => {
    acc[item.action] = (acc[item.action] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    apply,
    caseId: caseId || null,
    scanned: rows.length,
    summary,
    actions,
  }, null, 2));

  await pool.end();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
