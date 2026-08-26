const fs = require('fs');
const path = require('path');

const { splitStatements } = require('../src/lib/sharedSchemaMigrationRunner');

const migrationPath = path.join(
  __dirname,
  '..',
  'sql',
  'migrations',
  '20260825_0001_add_typed_cfa_funding_lineage.sql'
);

describe('typed CFA and Funding Overview lineage migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const compactSql = sql.replace(/\s+/gu, ' ');

  test('adds only nullable version ownership and deliberately leaves history unresolved', () => {
    expect(sql).toMatch(/Historical rows are deliberately not backfilled/u);
    expect(sql).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE|REPLACE)\b/imu);

    [
      'cfa_version ADD COLUMN application_id BIGINT UNSIGNED NULL',
      'cfa_version ADD COLUMN action_plan_id BIGINT UNSIGNED NULL',
      'funding_overview_version ADD COLUMN application_id BIGINT UNSIGNED NULL',
    ].forEach(fragment => expect(compactSql).toContain(fragment));
  });

  test('preserves the case/template series columns and unique topology', () => {
    expect(compactSql).not.toMatch(/(?:ALTER TABLE|CREATE INDEX) cfa_series/iu);
    expect(compactSql).not.toMatch(/(?:ALTER TABLE|CREATE INDEX) funding_overview_series/iu);
    expect(compactSql).not.toContain('uniq_cfa_series_case_application_template');
    expect(compactSql).not.toContain('uniq_funding_overview_series_case_application_template');
    expect(compactSql).not.toContain('DROP INDEX uniq_funding_overview_series_case_template');
  });

  test('adds indexed restrictive foreign keys for the three typed owners', () => {
    [
      'fk_cfa_version_application FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT',
      'fk_cfa_version_action_plan FOREIGN KEY (action_plan_id) REFERENCES iset_case_action_plan (id) ON DELETE RESTRICT',
      'fk_funding_overview_version_application FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT',
    ].forEach(fragment => expect(compactSql).toContain(fragment));

    [
      'idx_cfa_version_application',
      'idx_cfa_version_action_plan',
      'idx_funding_overview_version_application',
    ].forEach(indexName => expect(compactSql).toContain(`CREATE INDEX ${indexName}`));
  });

  test('is retry-guarded for the canonical ledger runner statement splitter', () => {
    expect(sql).toMatch(/filename\/checksum is recorded in iset_migration/u);
    expect(sql).toMatch(/every change below is guarded/u);

    const statements = splitStatements(sql);
    const prepareCount = statements.filter(statement => /^PREPARE stmt FROM @ddl$/u.test(statement)).length;
    const executeCount = statements.filter(statement => /^EXECUTE stmt$/u.test(statement)).length;
    const deallocateCount = statements.filter(statement => /^DEALLOCATE PREPARE stmt$/u.test(statement)).length;

    expect(prepareCount).toBeGreaterThan(0);
    expect(executeCount).toBe(prepareCount);
    expect(deallocateCount).toBe(prepareCount);
  });
});
