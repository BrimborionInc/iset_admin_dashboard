const fs = require('fs');
const path = require('path');

describe('CFA TEST smoke preflight ordering', () => {
  test('proves live identity/DDL and then the portal-loaded identity before Cognito fixture effects', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'cfa-signing-test-smoke.js'),
      'utf8'
    );
    const preflight = source.indexOf("'/opt/nwac/admin-dashboard/scripts/cfa-signing-schema-preflight.js'");
    const portalIdentity = source.indexOf("'--identity-only'");
    const createApplicant = source.indexOf('applicant.sub = createApplicant(');

    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(portalIdentity).toBeGreaterThan(preflight);
    expect(portalIdentity).toBeLessThan(createApplicant);
    expect(preflight).toBeLessThan(createApplicant);
    expect(source).toContain("preflight.status !== 'PASS'");
    expect(source).toContain('Number(preflight.verifiedStatementCount) !== 0');
    expect(source).toContain('portalAwsIdentity?.account !== EXPECTED_AWS_ACCOUNT');
    expect(source).toContain("'--expected-aws-arn', shellQuote(portalAwsIdentity.arn)");
    expect(source).toContain('instanceRoleArn: remoteAwsIdentity.arn');
    expect(source).toContain('portalContextArn: portalAwsIdentity.arn');
    expect(source).not.toContain('sourceScript');
    expect(source).toContain('if (applicant.sub) deleteApplicant');
  });

  test('deploy artifacts carry the exact preflight and schema-guard support scripts', () => {
    const deploySource = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'),
      'utf8'
    );
    const preflightSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'cfa-signing-schema-preflight.js'),
      'utf8'
    );

    expect(deploySource).toContain("'cfa-signing-schema-preflight.js'");
    expect(deploySource).toContain("'two-step-review-test-smoke.js'");
    expect(deploySource).toContain("const PORTAL_SUPPORT_SCRIPT_FILES = [\n  'cfa-signing-smoke.js'");
    expect(deploySource).toContain('assertArchiveContains(');
    expect(deploySource).toContain('archiveContentPreflight');
    expect(preflightSource).toContain('const evidence = await guard.preflight();');
    expect(preflightSource).toContain('verifiedStatementCount: evidence.verifiedStatementCount');
    expect(preflightSource).not.toMatch(/connection\.(?:query|execute|beginTransaction|commit|rollback)\(/);
  });

  test('portal smoke resolves AWS identity only after loading the selected portal environment', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'ISET-intake', 'scripts', 'cfa-signing-smoke.js'),
      'utf8'
    );
    const load = source.indexOf('loadEnvFile(path.resolve(args.envFile));');
    const identity = source.indexOf('const awsIdentity = await verifyAwsIdentity', load);
    const identityOnly = source.indexOf('if (args.identityOnly)', identity);
    const database = source.indexOf('const db = await mysql.createConnection', identityOnly);

    expect(load).toBeGreaterThan(-1);
    expect(identity).toBeGreaterThan(load);
    expect(identityOnly).toBeGreaterThan(identity);
    expect(database).toBeGreaterThan(identityOnly);
  });
});
