const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.join(process.cwd(), 'isetadminserver.js'),
  'utf8'
);
const widgetSource = fs.readFileSync(
  path.join(process.cwd(), 'src/widgets/SupportingDocumentsWidget.js'),
  'utf8'
);

function extractRouteBlock(method, route) {
  const marker = `app.${method}('${route}'`;
  const start = serverSource.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextRoute = serverSource.indexOf('\napp.', start + marker.length);
  return serverSource.slice(start, nextRoute === -1 ? undefined : nextRoute);
}

describe('Supporting Documents update route', () => {
  test('label-only updates do not require attachment scope resolution', () => {
    const routeSource = extractRouteBlock('put', '/api/documents/:id');
    const labelOnlyBranch = routeSource.indexOf('if (isLabelOnlyUpdate)');
    const scopeResolution = routeSource.indexOf('const effectiveDocType = docType || metadataObj.document_type || null');

    expect(labelOnlyBranch).toBeGreaterThanOrEqual(0);
    expect(scopeResolution).toBeGreaterThan(labelOnlyBranch);
    expect(routeSource).toContain('SET label = ?, metadata = ?, updated_at = NOW()');
    expect(routeSource).toContain("console.error('[admin:documents:update-label] error', err)");
  });

  test('modal and duplicate saves send context for client-scoped documents', () => {
    expect(widgetSource).toContain('const applyClientScopeContext = useCallback');
    expect(widgetSource).toContain("} else if (scope === 'client') {");
    expect(widgetSource).toContain('applyClientScopeContext(payload, editDocument)');
    expect(widgetSource).toContain('applyClientScopeContext(payload, duplicateDocument)');
    expect(widgetSource).toContain("scope === 'client' && !caseId && applicationId ? String(applicationId) : ''");
  });
});
