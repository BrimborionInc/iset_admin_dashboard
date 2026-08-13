const fs = require('fs');
const path = require('path');

const {
  NOTIFICATION_ADMISSION_SQL,
  REQUIRED_COLUMNS,
  WORKFLOW_ADMISSION_SQL,
  compareProofs,
  decodeResult,
  encodeResult,
  fixtureIdentity,
  runAdmission,
} = require('../scripts/cfa-signing-schema-preflight');

function proof(seed = 'a') {
  return {
    identity: {
      database: 'iset_intake',
      host: 'db-host',
      port: 3306,
      currentUser: 'app_admin@10.48.%',
      version: '8.0.42',
      configuredTarget: { host: 'configured-host', user: 'app_admin', database: 'iset_intake', port: 3306 },
    },
    objects: Object.fromEntries(Object.keys(REQUIRED_COLUMNS).map(name => [name, {
      type: 'table',
      rawDdl: `CREATE TABLE ${name} (${seed})`,
      rawDdlHash: `${seed}-${name}`,
      structuralDdlHash: `stable-${name}`,
      columnsHash: `columns-${name}`,
      indexesHash: `indexes-${name}`,
      constraintsHash: `constraints-${name}`,
      volatileDdlOptions: [],
    }])),
    structuralDdlHashes: Object.fromEntries(Object.keys(REQUIRED_COLUMNS).map(name => [name, `stable-${name}`])),
    ddlHashes: Object.fromEntries(Object.keys(REQUIRED_COLUMNS).map(name => [name, `${seed}-${name}`])),
    verifiedStatementCount: 0,
  };
}

function syntheticHarness({ notificationRows = [], workflowRows = null, markerCount = 0 } = {}) {
  const connections = [];
  let proofIndex = 0;
  const createConnection = async () => {
    const connection = { ended: false, end: async () => { connection.ended = true; } };
    connections.push(connection);
    return connection;
  };
  const createGuard = () => {
    const evidence = proof(proofIndex++ === 0 ? 'a' : 'b');
    let statementCount = 0;
    return {
      preflight: async () => evidence,
      getObjectProof: name => ({ columns: REQUIRED_COLUMNS[name].map(column => ({ name: column })) }),
      validateStatement: () => ({ tables: [] }),
      createGuardedConnection: () => ({
        execute: async (sql) => {
          statementCount += 1;
          if (sql === WORKFLOW_ADMISSION_SQL) {
            return [workflowRows || [{ id: 17, name: 'Funding Agreement', status: 'active', workflow_type: 'consent-cm-prefill', document_type: 'funding_agreement' }], []];
          }
          if (sql === NOTIFICATION_ADMISSION_SQL) return [notificationRows, []];
          return [[{ 'COUNT(*)': markerCount }], []];
        },
      }),
      evidence: () => ({ ...evidence, verifiedStatementCount: statementCount }),
    };
  };
  return { connections, createConnection, createGuard };
}

const ARGS = Object.freeze({
  envFile: '/synthetic/.env.test',
  attemptId: 'phase8b-synthetic-0001',
  expectedDatabase: 'iset_intake',
  expectedDbHost: 'configured-host',
  expectedDbUser: 'app_admin',
  expectedDbServerHostname: 'db-host',
  expectedDbPort: 3306,
  expectedDbPrincipal: 'app_admin@10.48.%',
  expectedDbVersion: '8.0.42',
});

const ENV = Object.freeze({ DB_HOST: 'configured-host', DB_PORT: '3306', DB_USER: 'app_admin', DB_PASS: 'synthetic', DB_NAME: 'iset_intake' });

describe('CFA TEST read-only admission', () => {
  test('runs two matching metadata proofs around only admitted prerequisite reads', async () => {
    const harness = syntheticHarness({ notificationRows: [{ id: 3, event: 'document_signed', role: 'ISET Coordinator', language: 'en', enabled: 1, email_alert: 0, bell_alert: 1, template_id: null }] });
    const result = await runAdmission(ARGS, { env: ENV, ...harness });

    expect(result.status).toBe('PASS');
    expect(result.comparison.stable).toBe(true);
    expect(result.comparison.rawDdlChangedObjects).toHaveLength(Object.keys(REQUIRED_COLUMNS).length);
    expect(result.prerequisites.workflow.id).toBe(17);
    expect(result.prerequisites.noEmail).toBe(true);
    expect(result.prerequisites.zeroMarker.every(item => item.count === 0)).toBe(true);
    expect(result.statementCatalogue.length).toBeGreaterThanOrEqual(50);
    expect(new Set(result.statementCatalogue.map(statement => statement.id)).size).toBe(result.statementCatalogue.length);
    expect(result.verifiedStatementCount).toBe(8);
    expect(result.postflightVerifiedStatementCount).toBe(0);
    expect(harness.connections).toHaveLength(2);
    expect(harness.connections.every(connection => connection.ended)).toBe(true);
  });

  test('rejects enabled document-signed email before the second connection', async () => {
    const harness = syntheticHarness({ notificationRows: [{ id: 4, event: 'document_signed', enabled: 1, email_alert: 1, bell_alert: 0 }] });
    await expect(runAdmission(ARGS, { env: ENV, ...harness })).rejects.toThrow('cfa_document_signed_email_enabled:4');
    expect(harness.connections).toHaveLength(1);
    expect(harness.connections[0].ended).toBe(true);
  });

  test.each([
    [[], 'cfa_workflow_selection_not_unique:0'],
    [[{ id: 1 }, { id: 2 }], 'cfa_workflow_selection_not_unique:2'],
  ])('rejects missing or ambiguous exact workflow selection', async (workflowRows, message) => {
    const harness = syntheticHarness({ workflowRows });
    await expect(runAdmission(ARGS, { env: ENV, ...harness })).rejects.toThrow(message);
  });

  test('rejects pre-existing attempt markers', async () => {
    const harness = syntheticHarness({ markerCount: 1 });
    await expect(runAdmission(ARGS, { env: ENV, ...harness })).rejects.toThrow('cfa_attempt_marker_not_clean');
  });

  test('accepts only stable structural proof and rejects structural drift', () => {
    const first = proof('first');
    const second = proof('second');
    expect(compareProofs(first, second).rawDdlChangedObjects).toContain('staff_profiles');
    second.objects.staff_profiles.columnsHash = 'drift';
    expect(() => compareProofs(first, second)).toThrow('cfa_metadata_proofs_conflict');
  });

  test('round-trips content-addressed evidence and rejects digest corruption', () => {
    const result = { status: 'PASS', attemptId: ARGS.attemptId, nested: { ok: true } };
    const envelope = encodeResult(result);
    expect(decodeResult(envelope)).toEqual(result);
    expect(() => decodeResult({ ...envelope, evidenceSha256: '0'.repeat(64) })).toThrow('cfa_preflight_evidence_digest_mismatch');
  });

  test('derives stable separated attempt-owned fixture identities', () => {
    const first = fixtureIdentity('phase8b-synthetic-0001');
    expect(fixtureIdentity('phase8b-synthetic-0001')).toEqual(first);
    expect(fixtureIdentity('phase8b-synthetic-0002')).not.toEqual(first);
    expect(first.applicantEmail).not.toBe(first.staffEmail);
  });

  test('deploy artifacts no longer bind CFA schema safety to the two-step monolith', () => {
    const preflightSource = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'cfa-signing-schema-preflight.js'), 'utf8');
    const portalSource = fs.readFileSync(path.resolve(__dirname, '..', '..', 'ISET-intake', 'scripts', 'cfa-signing-smoke.js'), 'utf8');
    expect(preflightSource).toContain("require('./lib/live-mysql-schema-guard')");
    expect(preflightSource).not.toContain("require('./two-step-review-test-smoke')");
    expect(portalSource).toContain("'cfa-signing-schema-preflight.js'");
    expect(portalSource).not.toContain("'two-step-review-test-smoke.js'");
  });
});
