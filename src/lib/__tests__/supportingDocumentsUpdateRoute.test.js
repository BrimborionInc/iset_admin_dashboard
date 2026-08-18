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
    expect(routeSource.slice(labelOnlyBranch, scopeResolution)).toContain('requireIntegrityCheck: false');
    expect(routeSource).toContain("console.error('[admin:documents:update-label] error', err)");
  });

  test('full edits validate immutable workflow provenance before resolving destination scope', () => {
    const routeSource = extractRouteBlock('put', '/api/documents/:id');
    const duplicateRouteSource = extractRouteBlock('post', '/api/documents/:id/duplicate');
    const sourceLookup = routeSource.indexOf(
      'applicant_user_id, source, origin_message_id, signing_request_id, updated_at FROM iset_document'
    );
    const integrityGuard = routeSource.indexOf('validateGenericDocumentMutationIntegrity(existingRow)');
    const targetAccessCheck = routeSource.indexOf('validateDocumentAttachmentContextAccess');

    expect(sourceLookup).toBeGreaterThanOrEqual(0);
    expect(integrityGuard).toBeGreaterThan(sourceLookup);
    expect(targetAccessCheck).toBeGreaterThan(integrityGuard);
    expect(duplicateRouteSource).toContain('validateGenericDocumentMutationIntegrity(doc)');
  });

  test('modal and duplicate saves send context for client-scoped documents', () => {
    expect(widgetSource).toContain('const applyClientScopeContext = useCallback');
    expect(widgetSource).toContain("} else if (scope === 'client') {");
    expect(widgetSource).toContain('applyClientScopeContext(payload, editDocument)');
    expect(widgetSource).toContain('applyClientScopeContext(payload, duplicateDocument)');
    expect(widgetSource).toContain("scope === 'client' && !caseId && applicationId ? String(applicationId) : ''");
  });

  test('both inline rename and an unchanged edit modal send a title-only request', () => {
    expect(widgetSource).toContain('body: JSON.stringify({ label: trimmed })');
    expect(widgetSource).toContain('const detailsChanged =');
    expect(widgetSource).toContain('trimmedType !== resolveDocumentType(editDocument) || associationChanged');
    expect(widgetSource).toContain('const payload = { label: trimmedLabel };');
    expect(widgetSource).toContain('if (detailsChanged) {');
    expect(widgetSource).toContain('payload.documentType = trimmedType;');
  });
});
