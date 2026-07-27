#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const Module = require('module');
const babel = require('@babel/core');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(
  REPO_ROOT,
  'docs/data/temp/regional-snapshot-all-regions-fy-2026-27-new-rules-2026-07-27.xlsx'
);

function parseArgs(argv) {
  const result = {
    output: DEFAULT_OUTPUT,
    fiscalYearStart: 2026,
    periodType: 'year',
    periodKey: 'annual',
    manualAdjustments: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--output') result.output = path.resolve(argv[++index]);
    else if (token === '--fiscal-year-start') result.fiscalYearStart = Number(argv[++index]);
    else if (token === '--period-type') result.periodType = argv[++index];
    else if (token === '--period-key') result.periodKey = argv[++index];
    else if (token === '--manual-adjustments') {
      result.manualAdjustments = path.resolve(argv[++index]);
    }
    else if (token === '--help' || token === '-h') {
      process.stdout.write(
        'Usage: node scripts/generate-regional-snapshot-from-prod.js [--output PATH] ' +
        '[--fiscal-year-start YEAR] [--period-type year|quarter|month] [--period-key KEY] ' +
        '[--manual-adjustments PATH]\n'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!Number.isInteger(result.fiscalYearStart)) {
    throw new Error('--fiscal-year-start must be a whole year.');
  }
  return result;
}

const roundCurrency = value => Math.round((Number(value) || 0) * 100) / 100;

function applyManualAdjustments(reports, payload) {
  const adjustments = Array.isArray(payload?.adjustments) ? payload.adjustments : [];
  const disclosures = Array.isArray(payload?.disclosures) ? payload.disclosures : [];
  const totalsByRegion = new Map();

  adjustments.forEach(adjustment => {
    const regionCode = String(adjustment?.region || '').trim().toUpperCase();
    if (!regionCode) throw new Error('Every manual adjustment requires a region.');
    const counts = [
      'applicationsReceived',
      'approvedApplications',
      'fundedClients',
    ];
    counts.forEach(field => {
      const value = Number(adjustment?.[field] || 0);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Manual adjustment ${field} must be a non-negative integer.`);
      }
    });
    ['crfFunding', 'eiFunding'].forEach(field => {
      const value = Number(adjustment?.[field] || 0);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Manual adjustment ${field} must be a non-negative amount.`);
      }
    });
    const current = totalsByRegion.get(regionCode) || {
      applicationsReceived: 0,
      approvedApplications: 0,
      fundedClients: 0,
      crfFunding: 0,
      eiFunding: 0,
    };
    current.applicationsReceived += Number(adjustment.applicationsReceived || 0);
    current.approvedApplications += Number(adjustment.approvedApplications || 0);
    current.fundedClients += Number(adjustment.fundedClients || 0);
    current.crfFunding = roundCurrency(
      current.crfFunding + Number(adjustment.crfFunding || 0)
    );
    current.eiFunding = roundCurrency(
      current.eiFunding + Number(adjustment.eiFunding || 0)
    );
    totalsByRegion.set(regionCode, current);
  });

  return reports.map(report => {
    const regionCode = String(report?.region?.code || '').toUpperCase();
    const adjustment = totalsByRegion.get(regionCode);
    const regionDisclosures = disclosures.filter(disclosure =>
      String(disclosure?.region || '').toUpperCase() === regionCode
    );
    if (!adjustment && !regionDisclosures.length) return report;

    const liveMetrics = {
      ...report.liveMetrics,
      applicationsReceived:
        Number(report?.liveMetrics?.applicationsReceived || 0) +
        Number(adjustment?.applicationsReceived || 0),
      fundedApplications:
        Number(report?.liveMetrics?.fundedApplications || 0) +
        Number(adjustment?.approvedApplications || 0),
    };
    const fundingMetrics = {
      ...report.fundingMetrics,
      fundedClientCount:
        Number(report?.fundingMetrics?.fundedClientCount || 0) +
        Number(adjustment?.fundedClients || 0),
      crfFundingAmount: roundCurrency(
        Number(report?.fundingMetrics?.crfFundingAmount || 0) +
        Number(adjustment?.crfFunding || 0)
      ),
      eiFundingAmount: roundCurrency(
        Number(report?.fundingMetrics?.eiFundingAmount || 0) +
        Number(adjustment?.eiFunding || 0)
      ),
    };
    const totalFunding = roundCurrency(
      fundingMetrics.crfFundingAmount + fundingMetrics.eiFundingAmount
    );
    const totalAdminCost = Number(report?.derivedMetrics?.totalAdminCost);
    const fundedClientCount = fundingMetrics.fundedClientCount;
    const derivedMetrics = {
      ...report.derivedMetrics,
      totalFunding,
      clientAverageAmountFunded:
        fundedClientCount > 0 ? totalFunding / fundedClientCount : null,
      adminCostPerClient:
        fundedClientCount > 0 && Number.isFinite(totalAdminCost)
          ? totalAdminCost / fundedClientCount
          : null,
      adminRatioPercent:
        totalFunding > 0 && Number.isFinite(totalAdminCost)
          ? (totalAdminCost / totalFunding) * 100
          : null,
    };
    return {
      ...report,
      liveMetrics,
      fundingMetrics,
      derivedMetrics,
      dataQualityIssues: [
        ...(Array.isArray(report.dataQualityIssues) ? report.dataQualityIssues : []),
        ...regionDisclosures.map(disclosure => ({
          region: regionCode,
          issueType: disclosure.issueType || 'manual_adjustment_disclosure',
          reportingEffect: disclosure.reportingEffect || '',
          remediation: disclosure.remediation || '',
        })),
      ],
      calculationNotes: {
        ...(report.calculationNotes || {}),
        manualAdjustmentsApplied: Boolean(adjustment),
        manualAdjustmentSource: payload?.source || null,
      },
    };
  });
}

function buildExtractionSql({ fiscalYearStart }) {
  const periodStart = `${fiscalYearStart}-04-01`;
  const periodEnd = `${fiscalYearStart + 1}-03-31`;
  const encode = expression =>
    `HEX(CAST(${expression} AS CHAR CHARACTER SET utf8mb4))`;
  return `
SELECT '__REGIONS__' AS marker;
SELECT ${encode(`JSON_OBJECT(
  'region_id', region_id,
  'code', code,
  'name_en', name_en
)`)} AS row_payload
FROM canada_region
ORDER BY CASE WHEN code = 'XX' THEN 1 ELSE 0 END, name_en ASC;

SELECT '__SNAPSHOTS__' AS marker;
SELECT ${encode(`JSON_OBJECT(
  'id', rs.id,
  'region_id', rs.region_id,
  'period_type', rs.period_type,
  'period_start', rs.period_start,
  'period_end', rs.period_end,
  'snapshot_status', rs.snapshot_status,
  'regional_manager_name', rs.regional_manager_name,
  'regional_coordinator_name', rs.regional_coordinator_name,
  'operating_costs_amount', rs.operating_costs_amount,
  'compliance_flag', rs.compliance_flag,
  'comments_recommendations', rs.comments_recommendations,
  'created_at', rs.created_at,
  'updated_at', rs.updated_at,
  'created_by_name', COALESCE(NULLIF(TRIM(cb.display_name), ''), NULLIF(TRIM(cb.name), ''), NULLIF(TRIM(cb.email), '')),
  'updated_by_name', COALESCE(NULLIF(TRIM(ub.display_name), ''), NULLIF(TRIM(ub.name), ''), NULLIF(TRIM(ub.email), ''))
)`)} AS row_payload
FROM iset_regional_snapshot_report rs
LEFT JOIN staff_profiles cb ON cb.id = rs.created_by_staff_profile_id
LEFT JOIN staff_profiles ub ON ub.id = rs.updated_by_staff_profile_id
WHERE rs.period_start = '${periodStart}'
  AND rs.period_end = '${periodEnd}';

SELECT '__STAFF_DEFAULTS__' AS marker;
SELECT ${encode(`JSON_OBJECT(
  'region_id', region_id,
  'primary_role', primary_role,
  'label', COALESCE(NULLIF(TRIM(display_name), ''), NULLIF(TRIM(name), ''), NULLIF(TRIM(email), ''))
)`)} AS row_payload
FROM staff_profiles
WHERE status = 'active'
  AND primary_role IN ('Regional Manager', 'ISET Coordinator');

SELECT '__SALARIES__' AS marker;
SELECT ${encode(`JSON_OBJECT(
  'region_code', frse.region_code,
  'fiscal_year_start', frse.fiscal_year_start,
  'annual_salary_amount', frse.annual_salary_amount,
  'budget_pot_id', frse.budget_pot_id,
  'budget_pot_name', bp.name
)`)} AS row_payload
FROM finance_regional_salary_entry frse
LEFT JOIN budget_pot bp ON bp.id = frse.budget_pot_id
WHERE frse.fiscal_year_start = ${fiscalYearStart};

SELECT '__APPLICATIONS__' AS marker;
SELECT ${encode(`JSON_OBJECT(
  'id', a.id,
  'case_id', a.case_id,
  'submission_id', a.submission_id,
  'status', a.status,
  'decision_outcome', a.decision_outcome,
  'submitted_at', s.submitted_at,
  'client_id', c.client_id,
  'case_number', c.case_number,
  'client_first_name', cl.first_name,
  'client_last_name', cl.last_name,
  'application_reference', COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.submission_snapshot.reference_number')),
    s.reference_number
  ),
  'submission_address_province', COALESCE(
    JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.answers."address-province"')),
    JSON_UNQUOTE(JSON_EXTRACT(ias.intake_payload, '$."address-province"'))
  ),
  'client_address_province', COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.provinceCode')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.province')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.provinceCode')), '')
  )
)`)} AS row_payload
FROM iset_application a
JOIN iset_case c ON c.id = a.case_id
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
LEFT JOIN iset_application_submission ias ON ias.id = a.submission_id;

SELECT '__INTERVENTIONS__' AS marker;
SELECT ${encode(`JSON_OBJECT(
  'intervention_id', ci.id,
  'case_id', ci.case_id,
  'action_plan_id', ci.action_plan_id,
  'status', ci.status,
  'delivery_status', ci.delivery_status,
  'start_date', ci.start_date,
  'end_date', ci.end_date,
  'intervention_cost', ci.intervention_cost,
  'budget_amount', ci.budget_amount,
  'approved_amount', ci.approved_amount,
  'funding_stream_decision', ci.funding_stream_decision,
  'metadata_json', ci.metadata_json,
  'client_id', c.client_id,
  'case_number', c.case_number,
  'client_address_province', COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.provinceCode')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.province')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.provinceCode')), '')
  ),
  'action_plan_application_id', ap.application_id,
  'action_plan_status', ap.status,
  'action_plan_archived_at', ap.archived_at,
  'action_plan_metadata_json', ap.metadata_json,
  'plan_funding_stream', ap.funding_stream,
  'pot_funding_source', bp.funding_source,
  'proposal_id', p.id,
  'proposal_application_id', p.application_id,
  'proposal_source_intervention_id', p.source_intervention_id,
  'proposal_review_status', p.review_status,
  'esdc_application_id', eps.application_id,
  'unique_plan_proposal_application_id', plan_apps.unique_application_id,
  'plan_proposal_application_count', plan_apps.application_count,
  'resolved_application_id', COALESCE(p.application_id, ap.application_id)
)`)} AS row_payload
FROM iset_case_intervention ci
JOIN iset_case c ON c.id = ci.case_id
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN iset_case_action_plan ap ON ap.id = ci.action_plan_id
LEFT JOIN esdc_participant_submission eps ON eps.action_plan_id = ap.id
LEFT JOIN (
  SELECT
    action_plan_id,
    COUNT(DISTINCT application_id) AS application_count,
    CASE
      WHEN COUNT(DISTINCT application_id) = 1 THEN MAX(application_id)
      ELSE NULL
    END AS unique_application_id
  FROM iset_intervention_proposal
  WHERE application_id IS NOT NULL
  GROUP BY action_plan_id
) plan_apps ON plan_apps.action_plan_id = ap.id
LEFT JOIN budget_pot bp
  ON (
    (ap.budget_pot REGEXP '^[0-9]+$' AND bp.id = CAST(ap.budget_pot AS UNSIGNED))
    OR bp.code = ap.budget_pot
  )
LEFT JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id;

SELECT '__PROPOSALS__' AS marker;
SELECT ${encode(`JSON_OBJECT(
  'intervention_id', NULL,
  'proposal_id', p.id,
  'case_id', p.case_id,
  'action_plan_id', p.action_plan_id,
  'status', p.review_status,
  'delivery_status', NULL,
  'start_date', p.start_date,
  'end_date', p.end_date,
  'proposed_cost', p.proposed_cost,
  'intervention_cost', NULL,
  'budget_amount', NULL,
  'approved_amount', NULL,
  'funding_stream_decision', NULL,
  'payload_json', p.payload_json,
  'metadata_json', p.metadata_json,
  'client_id', c.client_id,
  'case_number', c.case_number,
  'client_address_province', COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.province')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.address.provinceCode')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.province')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.provinceCode')), '')
  ),
  'action_plan_application_id', ap.application_id,
  'action_plan_status', ap.status,
  'action_plan_archived_at', ap.archived_at,
  'action_plan_metadata_json', ap.metadata_json,
  'plan_funding_stream', ap.funding_stream,
  'pot_funding_source', bp.funding_source,
  'proposal_application_id', p.application_id,
  'proposal_source_intervention_id', p.source_intervention_id,
  'esdc_application_id', eps.application_id,
  'unique_plan_proposal_application_id', plan_apps.unique_application_id,
  'plan_proposal_application_count', plan_apps.application_count,
  'resolved_application_id', COALESCE(p.application_id, ap.application_id),
  'proposal_review_status', p.review_status
)`)} AS row_payload
FROM iset_intervention_proposal p
JOIN iset_case c ON c.id = p.case_id
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN iset_case_action_plan ap ON ap.id = p.action_plan_id
LEFT JOIN esdc_participant_submission eps ON eps.action_plan_id = ap.id
LEFT JOIN (
  SELECT
    action_plan_id,
    COUNT(DISTINCT application_id) AS application_count,
    CASE
      WHEN COUNT(DISTINCT application_id) = 1 THEN MAX(application_id)
      ELSE NULL
    END AS unique_application_id
  FROM iset_intervention_proposal
  WHERE application_id IS NOT NULL
  GROUP BY action_plan_id
) plan_apps ON plan_apps.action_plan_id = ap.id
LEFT JOIN budget_pot bp
  ON (
    (ap.budget_pot REGEXP '^[0-9]+$' AND bp.id = CAST(ap.budget_pot AS UNSIGNED))
    OR bp.code = ap.budget_pot
  )
WHERE p.legacy_intervention_id IS NULL
  AND p.source_intervention_id IS NULL
  AND p.archived_at IS NULL;

SELECT '__PAYMENT_MAPPING__' AS marker;
SELECT ${encode(`JSON_OBJECT(
  'v', v,
  'updated_at', updated_at
)`)} AS row_payload
FROM iset_runtime_config
WHERE scope = 'finance'
  AND k = 'payment.intervention.payment_type_map'
LIMIT 1;
`;
}

function extractProdData(options) {
  const profile = 'nwac-prod';
  const region = 'ca-central-1';
  const bucket = 'nwac-prod-artifacts';
  const token = `${Date.now()}-${crypto.randomUUID()}`;
  const sqlKey = `ssm-sql/regional-snapshot/${token}.sql`;
  const outputKey = `ssm-sql/regional-snapshot/${token}.tsv.gz`;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'regional-snapshot-prod-'));
  const sqlPath = path.join(tempDirectory, 'extract.sql');
  const outputPath = path.join(tempDirectory, 'extract.tsv.gz');
  const paramsPath = path.join(tempDirectory, 'params.json');

  const runAws = (args, { allowFailure = false } = {}) => {
    const result = spawnSync('aws', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      env: {
        ...process.env,
        AWS_PAGER: '',
        AWS_CLI_AUTO_PROMPT: 'off',
      },
    });
    if (result.status !== 0 && !allowFailure) {
      throw new Error(`AWS command failed: aws ${args.join(' ')}\n${result.stderr || result.stdout}`);
    }
    return String(result.stdout || '').trim();
  };
  const shellQuote = value => `'${String(value).replace(/'/g, `'\\''`)}'`;

  try {
    fs.writeFileSync(sqlPath, buildExtractionSql(options));
    const onlineIds = runAws([
      'ssm', 'describe-instance-information',
      '--region', region,
      '--profile', profile,
      '--query', 'InstanceInformationList[?PingStatus==`Online`].InstanceId',
      '--output', 'text',
    ]).split(/\s+/).filter(Boolean);
    const asgIds = runAws([
      'autoscaling', 'describe-auto-scaling-groups',
      '--region', region,
      '--profile', profile,
      '--auto-scaling-group-names', 'nwac-prod-asg',
      '--query', 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId',
      '--output', 'text',
    ]).split(/\s+/).filter(Boolean);
    const instanceId = asgIds.find(id => onlineIds.includes(id));
    if (!instanceId) throw new Error('No online in-service PROD app instance was found.');

    const exportedCredentials = runAws([
      'configure', 'export-credentials',
      '--profile', profile,
      '--format', 'process',
    ]);
    const credentials = JSON.parse(exportedCredentials);
    runAws([
      's3', 'cp', sqlPath, `s3://${bucket}/${sqlKey}`,
      '--region', region,
      '--profile', profile,
      '--only-show-errors',
    ]);

    const remoteSql = `/tmp/regional-snapshot-${token}.sql`;
    const remoteOutput = `/tmp/regional-snapshot-${token}.tsv`;
    const remoteGzip = `${remoteOutput}.gz`;
    const remoteCommands = [
      'set -euo pipefail',
      `aws s3 cp ${shellQuote(`s3://${bucket}/${sqlKey}`)} ${shellQuote(remoteSql)} --region ${shellQuote(region)} --only-show-errors`,
      `SECRET_PAYLOAD=$(aws secretsmanager get-secret-value --secret-id ${shellQuote('nwac-prod-db-credentials')} --region ${shellQuote(region)} --query SecretString --output text)`,
      'PY_BIN=python3; command -v python3 >/dev/null 2>&1 || PY_BIN=python',
      `DB_USER=$(printf '%s' "$SECRET_PAYLOAD" | $PY_BIN -c 'import json,sys; print(json.loads(sys.stdin.read()).get("username", ""))')`,
      `DB_PASS=$(printf '%s' "$SECRET_PAYLOAD" | $PY_BIN -c 'import json,sys; print(json.loads(sys.stdin.read()).get("password", ""))')`,
      `MYSQL_PWD="$DB_PASS" mysql -h ${shellQuote('nwac-prod-db.cluster-c3g4iamg8j38.ca-central-1.rds.amazonaws.com')} -P 3306 -u "$DB_USER" ${shellQuote('iset_intake')} < ${shellQuote(remoteSql)} > ${shellQuote(remoteOutput)}`,
      `gzip -c ${shellQuote(remoteOutput)} > ${shellQuote(remoteGzip)}`,
      `AWS_ACCESS_KEY_ID=${shellQuote(credentials.AccessKeyId)} AWS_SECRET_ACCESS_KEY=${shellQuote(credentials.SecretAccessKey)} AWS_SESSION_TOKEN=${shellQuote(credentials.SessionToken || '')} aws s3 cp ${shellQuote(remoteGzip)} ${shellQuote(`s3://${bucket}/${outputKey}`)} --region ${shellQuote(region)} --only-show-errors`,
      `rm -f ${shellQuote(remoteSql)} ${shellQuote(remoteOutput)} ${shellQuote(remoteGzip)}`,
    ];
    fs.writeFileSync(paramsPath, JSON.stringify({ commands: remoteCommands }));
    const commandId = runAws([
      'ssm', 'send-command',
      '--instance-ids', instanceId,
      '--document-name', 'AWS-RunShellScript',
      '--parameters', `file://${paramsPath}`,
      '--comment', 'Codex read-only Regional Snapshot export',
      '--region', region,
      '--profile', profile,
      '--query', 'Command.CommandId',
      '--output', 'text',
    ]);
    process.stderr.write(`Exporting read-only PROD rows via SSM command ${commandId}\n`);
    while (true) {
      const status = runAws([
        'ssm', 'get-command-invocation',
        '--command-id', commandId,
        '--instance-id', instanceId,
        '--region', region,
        '--profile', profile,
        '--query', 'Status',
        '--output', 'text',
      ], { allowFailure: true });
      if (status === 'Success') break;
      if (!['', 'Pending', 'InProgress', 'Delayed'].includes(status)) {
        const errorText = runAws([
          'ssm', 'get-command-invocation',
          '--command-id', commandId,
          '--instance-id', instanceId,
          '--region', region,
          '--profile', profile,
          '--query', 'StandardErrorContent',
          '--output', 'text',
        ], { allowFailure: true });
        throw new Error(`PROD extraction SSM command ended with ${status}: ${errorText}`);
      }
      spawnSync('sleep', ['2']);
    }
    runAws([
      's3', 'cp', `s3://${bucket}/${outputKey}`, outputPath,
      '--region', region,
      '--profile', profile,
      '--only-show-errors',
    ]);
    const resultOutput = require('zlib').gunzipSync(fs.readFileSync(outputPath)).toString('utf8');

    const data = {
      __REGIONS__: [],
      __SNAPSHOTS__: [],
      __STAFF_DEFAULTS__: [],
      __SALARIES__: [],
      __APPLICATIONS__: [],
      __INTERVENTIONS__: [],
      __PROPOSALS__: [],
      __PAYMENT_MAPPING__: [],
    };
    let currentMarker = null;
    resultOutput.split(/\r?\n/).forEach(line => {
      const value = line.trim();
      if (!value || value === 'marker' || value === 'row_payload') return;
      if (Object.prototype.hasOwnProperty.call(data, value)) {
        currentMarker = value;
        return;
      }
      if (!currentMarker) return;
      try {
        const decoded = Buffer.from(value, 'hex').toString('utf8');
        data[currentMarker].push(JSON.parse(decoded));
      } catch (error) {
        throw new Error(`Could not parse ${currentMarker} extraction row: ${error.message}`);
      }
    });
    return data;
  } finally {
    runAws([
      's3', 'rm', `s3://${bucket}/${sqlKey}`,
      '--region', region,
      '--profile', profile,
      '--only-show-errors',
    ], { allowFailure: true });
    runAws([
      's3', 'rm', `s3://${bucket}/${outputKey}`,
      '--region', region,
      '--profile', profile,
      '--only-show-errors',
    ], { allowFailure: true });
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function createExecutor(data) {
  return {
    query: async (sql, params = []) => {
      const text = String(sql);
      let rows = [];
      if (text.includes('FROM canada_region WHERE region_id')) {
        rows = data.__REGIONS__.filter(row => Number(row.region_id) === Number(params[0]));
      } else if (text.includes('FROM iset_regional_snapshot_report rs')) {
        rows = data.__SNAPSHOTS__.filter(row =>
          Number(row.region_id) === Number(params[0]) &&
          row.period_type === params[1] &&
          String(row.period_start).slice(0, 10) === String(params[2]).slice(0, 10) &&
          String(row.period_end).slice(0, 10) === String(params[3]).slice(0, 10)
        );
      } else if (text.includes('FROM staff_profiles') && text.includes('primary_role')) {
        rows = data.__STAFF_DEFAULTS__
          .filter(row => Number(row.region_id) === Number(params[0]))
          .sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')))
          .map(row => ({ primary_role: row.primary_role, label: row.label }));
      } else if (text.includes('FROM finance_regional_salary_entry')) {
        rows = data.__SALARIES__.filter(row =>
          row.region_code === params[0] &&
          Number(row.fiscal_year_start) === Number(params[1])
        );
      } else if (text.includes('FROM iset_application a') && text.includes('a.decision_outcome')) {
        rows = data.__APPLICATIONS__;
      } else if (text.includes('FROM iset_case_intervention ci') && text.includes('resolved_application_id')) {
        rows = data.__INTERVENTIONS__;
      } else if (text.includes('FROM iset_intervention_proposal p') && text.includes('p.archived_at IS NULL')) {
        rows = data.__PROPOSALS__;
      } else if (text.includes('FROM iset_runtime_config') && text.includes('updated_at')) {
        rows = data.__PAYMENT_MAPPING__;
      } else {
        throw new Error(`Offline PROD executor does not recognize query: ${text.slice(0, 180)}`);
      }
      return [rows, []];
    },
  };
}

function loadRegionalSnapshotWorkbookBuilder() {
  const filename = path.join(
    REPO_ROOT,
    'src/pages/reporting/regionalSnapshotExport.js'
  );
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [require.resolve('babel-preset-react-app')],
    sourceMaps: 'inline',
  });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(transformed.code, filename);
  return loaded.exports.buildRegionalSnapshotWorkbook;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  process.stderr.write('Reading the required Regional Snapshot source rows from PROD (read-only)...\n');
  const data = extractProdData(options);

  process.env.NODE_ENV = 'test';
  process.env.BABEL_ENV = 'test';
  process.env.PATH_APP_FACTORY_MODE = '1';
  const dependencyStore = require('../src/server/appFactoryTestDeps');
  dependencyStore.setAppFactoryTestDependencies({
    pool: {
      query: async () => [[], []],
      execute: async () => [[], []],
      getConnection: async () => ({
        query: async () => [[], []],
        execute: async () => [[], []],
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
      }),
    },
    authnMiddlewareFactory: () => (_req, _res, next) => next(),
  });
  const { buildRegionalSnapshotPayload } = require('../isetadminserver');
  const executor = createExecutor(data);
  const regions = data.__REGIONS__.filter(region => region.code !== 'XX');
  let reports = [];
  for (const region of regions) {
    reports.push(await buildRegionalSnapshotPayload({
      regionId: Number(region.region_id),
      fiscalYearStart: options.fiscalYearStart,
      periodType: options.periodType,
      periodKey: options.periodKey,
      executor,
    }));
  }
  dependencyStore.clearAppFactoryTestDependencies();

  if (options.manualAdjustments) {
    const manualAdjustmentPayload = JSON.parse(
      fs.readFileSync(options.manualAdjustments, 'utf8')
    );
    reports = applyManualAdjustments(reports, manualAdjustmentPayload);
  }

  reports.forEach(report => {
    const live = report.liveMetrics;
    const partition =
      Number(live.fundedApplications || 0) +
      Number(live.deniedIneligibleWithdrawn || 0) +
      Number(live.pendingDecision || 0);
    if (partition !== Number(live.applicationsReceived || 0)) {
      throw new Error(`Client Activity does not reconcile for ${report.region.code}.`);
    }
  });

  const buildRegionalSnapshotWorkbook = loadRegionalSnapshotWorkbookBuilder();
  const buffer = await buildRegionalSnapshotWorkbook({
    reports,
    includeSummary: true,
    subtitle: `Reporting Period: ${options.fiscalYearStart}-04-01 - ${options.fiscalYearStart + 1}-03-31`,
  });
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, Buffer.from(buffer));

  const summary = reports.map(report => ({
    region: report.region.code,
    applicationsReceived: report.liveMetrics.applicationsReceived,
    approvedApplications: report.liveMetrics.fundedApplications,
    deniedWithdrawn: report.liveMetrics.deniedIneligibleWithdrawn,
    pending: report.liveMetrics.pendingDecision,
    fundedClients: report.fundingMetrics.fundedClientCount,
    crfFunding: report.fundingMetrics.crfFundingAmount,
    eiFunding: report.fundingMetrics.eiFundingAmount,
    dataQualityIssues: report.dataQualityIssues.length,
  }));
  process.stdout.write(`${JSON.stringify({
    output: options.output,
    manualAdjustments: options.manualAdjustments,
    reports: summary,
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  createExecutor,
  extractProdData,
  applyManualAdjustments,
  loadRegionalSnapshotWorkbookBuilder,
};
