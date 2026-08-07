const fs = require('fs');
const path = require('path');

describe('CFA TEST smoke preflight ordering', () => {
  test('proves live identity and DDL before Cognito or S3 fixture effects', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'cfa-signing-test-smoke.js'),
      'utf8'
    );
    const preflight = source.indexOf("'/opt/nwac/admin-dashboard/scripts/cfa-signing-schema-preflight.js'");
    const createApplicant = source.indexOf('applicant.sub = createApplicant(');
    const uploadScript = source.indexOf("aws(['s3', 'cp', sourceScript");

    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(preflight).toBeLessThan(createApplicant);
    expect(preflight).toBeLessThan(uploadScript);
    expect(source).toContain("preflight.status !== 'PASS'");
    expect(source).toContain('Number(preflight.verifiedStatementCount) !== 0');
    expect(source).toContain('if (scriptUploaded)');
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
    expect(preflightSource).toContain('const evidence = await guard.preflight();');
    expect(preflightSource).toContain('verifiedStatementCount: evidence.verifiedStatementCount');
    expect(preflightSource).not.toMatch(/connection\.(?:query|execute|beginTransaction|commit|rollback)\(/);
  });
});
