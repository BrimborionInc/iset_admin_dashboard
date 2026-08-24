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

  test('detail edits preserve source lineage and guard only a real attachment change', () => {
    const routeSource = extractRouteBlock('put', '/api/documents/:id');
    const duplicateRouteSource = extractRouteBlock('post', '/api/documents/:id/duplicate');
    const sourceLookup = routeSource.indexOf(
      'applicant_user_id, source, origin_message_id, signing_request_id, updated_at FROM iset_document'
    );
    const sourceLineage = routeSource.indexOf('preserveDocumentSourceLineage({');
    const attachmentChange = routeSource.indexOf('const attachmentMutationRequested');
    const attachmentGuard = routeSource.indexOf('validateDocumentAttachmentMutationIntegrity(existingRow)');
    const targetAccessCheck = routeSource.indexOf('validateDocumentAttachmentContextAccess');

    expect(sourceLookup).toBeGreaterThanOrEqual(0);
    expect(sourceLineage).toBeGreaterThan(sourceLookup);
    expect(attachmentChange).toBeGreaterThan(sourceLineage);
    expect(attachmentGuard).toBeGreaterThan(attachmentChange);
    expect(targetAccessCheck).toBeGreaterThan(attachmentGuard);
    expect(routeSource).not.toContain('validateGenericDocumentMutationIntegrity(existingRow)');
    expect(routeSource).toContain('requireIntegrityCheck: false');
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

  test('uncategorized source documents preload and retain their originating application', () => {
    expect(widgetSource).toContain(
      "let nextApplicationId = item.application_id ? String(item.application_id) : '';"
    );
    expect(widgetSource).toContain('const editHasSourceBoundLineage = hasSourceBoundDocumentLineage(editDocument);');
    expect(widgetSource).toContain('This document stays with the application where it originated.');
    expect(widgetSource).toContain(
      'disabled={editHasSourceBoundLineage && Boolean(editDocument?.application_id)}'
    );
  });

  test('a protected-document delete refusal stays inside the dialog in plain English', () => {
    expect(widgetSource).toContain("payload?.error === 'document_immutable'");
    expect(widgetSource).toContain('setDeleteRefused(true)');
    expect(widgetSource).toContain("This document can't be deleted");
    expect(widgetSource).toContain(
      "PATH needs to keep this document in the applicant's file. You can still change its title or document type."
    );
    expect(widgetSource).toContain("{deleteRefused ? 'Close' : 'Cancel'}");
    expect(widgetSource).toContain('{!deleteRefused && (');
  });

  test('Delete is a reversible archive action and refreshes checklist state', () => {
    const deleteRoute = extractRouteBlock('delete', '/api/documents/:id');
    expect(deleteRoute).toContain("SET status = 'deleted'");
    expect(deleteRoute).toContain('INSERT INTO iset_document_lifecycle');
    expect(deleteRoute).toContain("eventType: 'deleted'");
    expect(deleteRoute).not.toContain('isSystemAdministratorRequest(req)');
    expect(widgetSource).toContain('A System Administrator can restore it');
    expect(widgetSource).not.toContain('This will permanently delete the document from Supporting Documents');
    expect(widgetSource).toContain('await loadChecklist();');
    expect(widgetSource).toContain('disabled: deleting || item.can_delete === false');
    expect(widgetSource).toContain('disabledReason: item.delete_disabled_reason || undefined');
  });

  test('System Administrators get a lifecycle-backed Deleted tab with view, download, and restore only', () => {
    expect(widgetSource).toContain("id: 'deleted', label: 'Deleted'");
    expect(widgetSource).toContain('isSystemAdministratorRole');
    expect(widgetSource).toContain("case 'restore':");
    expect(widgetSource).toContain('/restore`');
    expect(widgetSource).not.toContain("case 'permanent-delete':");
    expect(widgetSource).not.toContain('/permanent`');
    expect(widgetSource).not.toContain('can_permanently_delete');
  });
});
