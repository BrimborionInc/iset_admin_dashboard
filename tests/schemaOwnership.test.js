const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = filename => fs.readFileSync(filename, 'utf8');

describe('canonical runtime schema ownership', () => {
  test('admin, portal, AI guidance, and shared event runtime paths contain no schema DDL', () => {
    const admin = read(path.join(root, 'isetadminserver.js'));
    const sources = [
      admin,
      read(path.join(root, 'src', 'server', 'adminAiGuidanceService.js')),
      read(path.join(root, '..', 'ISET-intake', 'server.js')),
      read(path.join(root, '..', 'shared', 'events', 'service.js')),
    ];
    sources.forEach(source => {
      expect(source).not.toMatch(/\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/iu);
      expect(source).not.toMatch(/\bALTER\s+TABLE\b/iu);
      expect(source).not.toMatch(/\bCREATE\s+INDEX\b/iu);
    });
  });

  test('case detail fails its canonical schema contract explicitly instead of returning fallback data', () => {
    const source = read(path.join(root, 'isetadminserver.js'));
    const catchStart = source.indexOf("const noTable = e && e.code === 'ER_NO_SUCH_TABLE'");
    const explicitFailure = source.indexOf("error: 'case_detail_schema_not_ready'", catchStart);
    const historicalFallback = source.indexOf('usedFallbackQuery = true', catchStart);
    expect(catchStart).toBeGreaterThan(0);
    expect(explicitFailure).toBeGreaterThan(catchStart);
    expect(historicalFallback).toBeGreaterThan(explicitFailure);
    expect(source.slice(catchStart, historicalFallback)).toMatch(/return res\.status\(503\)/u);
  });

  test('readiness checks are deploy smokes and the prepared enum is migration-owned', () => {
    const admin = read(path.join(root, 'isetadminserver.js'));
    const portal = read(path.join(root, '..', 'ISET-intake', 'server.js'));
    const deploy = read(path.join(root, 'scripts', 'path-deploy.js'));
    const migration = read(path.join(root, 'sql', 'migrations', '20260711_0001_verify_runtime_schema_ownership.sql'));
    expect(admin).toMatch(/app\.get\('\/readyz'/u);
    expect(portal).toMatch(/app\.get\('\/readyz'/u);
    expect(deploy).toMatch(/nwac-console\.awentech\.ca\/readyz/u);
    expect(deploy).toMatch(/iset\.nwac\.ca\/readyz/u);
    expect(migration).toMatch(/ALTER TABLE esdc_participant_submission_history MODIFY COLUMN event_type/u);
    expect(admin).not.toMatch(/ALTER TABLE esdc_participant_submission_history/u);
  });
});
