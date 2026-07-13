const fs = require('fs');
const path = require('path');

const {
  createEvidenceId,
  requiredChecksFor,
  resolveDomains,
  resolveOperationDomains,
  sha256Json,
  validateInventory,
  validateQualificationEvidence,
} = require('../src/lib/releaseQualification');

const inventory = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '..', 'docs', 'testing', 'release-coverage-inventory.json'),
  'utf8'
));

function evidence(overrides = {}) {
  const value = {
    schemaVersion: 1,
    generatedAt: '2026-07-13T12:00:00.000Z',
    expiresAt: '2026-07-16T12:00:00.000Z',
    stage: 'dev',
    releaseId: 'release-1',
    decision: 'GO',
    inventorySha256: sha256Json(inventory),
    domains: ['schema-readiness'],
    candidate: {
      components: ['admin', 'portal', 'shared'],
      schemaSha256: 'schema-1',
      source: {
        admin: { gitHead: 'a', treeFingerprint: 'tree-a' },
        portal: { gitHead: 'p', treeFingerprint: 'tree-p' },
        shared: { gitHead: 's', treeFingerprint: 'tree-s' },
      },
    },
    requiredChecks: ['real-mysql-contract'],
    checks: [{ id: 'real-mysql-contract', status: 'passed' }],
    ...overrides,
  };
  value.evidenceId = createEvidenceId(value);
  return value;
}

describe('release qualification contract', () => {
  test('the machine coverage inventory is valid and all mandatory checks resolve', () => {
    expect(validateInventory(inventory)).toEqual([]);
    const checks = requiredChecksFor(inventory, 'dev', inventory.domains.map(domain => domain.id));
    expect(checks).toEqual(expect.arrayContaining([
      'admin-aggregate',
      'portal-aggregate',
      'real-mysql-contract',
      'admin-browser-suite',
      'payment-db-rollback',
    ]));
  });

  test('shared and schema changes expand to dependent cross-application domains', () => {
    const resolved = resolveDomains(inventory, {
      admin: ['src/lib/adminRuntimeSchemaContract.js'],
      portal: [],
      shared: ['events/deliveryQueue.js'],
    });
    expect(resolved.unmatched).toEqual([]);
    expect(resolved.domainIds).toEqual(expect.arrayContaining([
      'schema-readiness',
      'notifications-workers',
    ]));
  });

  test('configuration and refresh operations map to explicit release domains', () => {
    expect(resolveOperationDomains(inventory, ['dataset:intake-release', 'workflow:21']).domainIds)
      .toEqual(expect.arrayContaining(['intake-cross-application', 'runtime-config']));
    expect(resolveOperationDomains(inventory, ['arbitrary-sql']).unmatched).toEqual(['arbitrary-sql']);
  });

  test('GO evidence must be unexpired and exact for all three source trees', () => {
    const value = evidence();
    expect(validateQualificationEvidence({
      evidence: value,
      expectedStage: 'dev',
      currentSource: value.candidate.source,
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
      now: new Date('2026-07-14T00:00:00.000Z'),
    })).toEqual([]);

    expect(validateQualificationEvidence({
      evidence: value,
      expectedStage: 'dev',
      currentSource: {
        ...value.candidate.source,
        portal: { gitHead: 'p', treeFingerprint: 'changed' },
      },
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
      now: new Date('2026-07-14T00:00:00.000Z'),
    })).toContain('qualification source does not match current portal tree');
  });

  test('failed, unavailable, expired, or tampered evidence cannot authorize release', () => {
    const unavailable = evidence({
      requiredChecks: ['real-mysql-contract'],
      checks: [{ id: 'real-mysql-contract', status: 'unavailable' }],
    });
    expect(validateQualificationEvidence({
      evidence: unavailable,
      expectedStage: 'dev',
      currentSource: unavailable.candidate.source,
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
      now: new Date('2026-07-17T00:00:00.000Z'),
    })).toEqual(expect.arrayContaining([
      'qualification evidence is expired or has no valid expiry',
      'qualification check real-mysql-contract is unavailable',
    ]));

    unavailable.decision = 'GO-but-edited';
    expect(validateQualificationEvidence({
      evidence: unavailable,
      expectedStage: 'dev',
      currentSource: unavailable.candidate.source,
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
    })).toContain('qualification evidence checksum mismatch');
  });
});
