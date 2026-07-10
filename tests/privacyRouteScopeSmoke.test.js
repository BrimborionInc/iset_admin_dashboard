const path = require('path');
const { spawnSync } = require('child_process');

const {
  createDefaultRouteScopeChecks,
  evaluateRouteScopeCheck,
  extractExpressRouteRegistration,
  loadDefaultRouteScopeSources,
  runRouteScopeChecks,
} = require('../src/lib/privacyRouteScopeChecks');

describe('privacy route-scope smoke', () => {
  test('passes against the current guarded route stack', () => {
    const scriptPath = path.resolve(__dirname, '..', 'scripts', 'privacy-route-scope-smoke.js');
    const result = spawnSync(process.execPath, [scriptPath, '--json'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload).toMatchObject({ ok: true });
    expect(payload.results).toHaveLength(71);
  });

  test('does not borrow a guard from a later sibling route', () => {
    const source = [
      "app.get('/api/unguarded', async (req, res) => { res.json({ ok: true }); });",
      "app.get('/api/guarded', async (req, res) => { guard(req); res.json({ ok: true }); });",
    ].join('\n');
    const check = {
      name: 'synthetic unguarded route',
      source: 'admin',
      anchor: "app.get('/api/unguarded'",
      patterns: ['guard(req)'],
      extraction: 'express-route',
    };

    expect(extractExpressRouteRegistration(source, check.anchor)).not.toContain("'/api/guarded'");
    expect(evaluateRouteScopeCheck(source, check)).toMatchObject({ pass: false });
  });

  test('fails focused mutations that remove each formerly stale guard', () => {
    const sources = loadDefaultRouteScopeSources();
    const checks = createDefaultRouteScopeChecks();
    const mutationCases = [
      ['admin conflict resolve validates case access', 'validateCaseAccessByCaseId(req, caseId)'],
      ['admin feedback report detail requires approved reviewer access', 'canReviewAdminFeedback(req)'],
      ['notification template list requires route-matrix access', 'requireNotificationConfigAccess(req, res, [TEMPLATE_EDITOR_ROUTE, MANAGE_NOTIFICATIONS_ROUTE])'],
      ['notification settings list requires route-matrix access', 'requireNotificationConfigAccess(req, res, MANAGE_NOTIFICATIONS_ROUTE)'],
    ];

    expect(runRouteScopeChecks(sources, checks).filter(result => !result.pass)).toEqual([]);

    for (const [name, marker] of mutationCases) {
      const check = checks.find(item => item.name === name);
      expect(check).toBeDefined();
      const originalSource = sources[check.source];
      const route = extractExpressRouteRegistration(originalSource, check.anchor);
      expect(route).toContain(marker);
      const mutatedSource = originalSource.replace(route, route.replace(marker, '/* guard removed by test */'));
      expect(evaluateRouteScopeCheck(mutatedSource, check)).toMatchObject({ pass: false });
    }
  });
});
