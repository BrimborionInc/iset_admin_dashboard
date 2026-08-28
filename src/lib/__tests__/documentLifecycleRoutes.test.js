const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(path.join(process.cwd(), 'isetadminserver.js'), 'utf8');

function extractRoute(method, route) {
  const marker = `app.${method}('${route}'`;
  const start = serverSource.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf('\napp.', start + marker.length);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

describe('document lifecycle routes', () => {
  test('active document lists expose server-derived delete capability', () => {
    expect(serverSource).toContain('async function decorateDocumentsWithLifecycleCapabilities');
    expect(serverSource).toContain('can_delete: isActive && !archiveBlocker');
    expect(serverSource).toContain('const ARCHIVABLE_DOCUMENT_SOURCES');
    expect(serverSource).toContain("'application_submission'");
    expect(serverSource).toContain('ARCHIVABLE_DOCUMENT_SOURCES.has(source)');
    expect(serverSource).toContain("'payment_evidence_link'");
    expect(serverSource).toContain('payment_followup_event pfe');
  });

  test.each([
    ['get', '/api/applicants/:id/documents'],
    ['get', '/api/cases/:id/documents'],
  ])('%s %s excludes historical deleted rows from the Deleted view', (method, route) => {
    const source = extractRoute(method, route);
    expect(source).toContain("String(req.query.view || '').trim().toLowerCase() === 'deleted'");
    expect(source).toContain('isSystemAdministratorRequest(req)');
    expect(source).toContain('LEFT JOIN iset_document_lifecycle dl ON dl.document_id = d.id');
    expect(source).toContain("dl.current_state = 'deleted'");
    expect(source).toContain('decorateDocumentsWithLifecycleCapabilities(rows)');
  });

  test('restore is System Administrator-only and verifies the stored object before reactivation', () => {
    const source = extractRoute('post', '/api/documents/:id/restore');
    expect(source).toContain('!isSystemAdministratorRequest(req)');
    expect(source).toContain("candidate.current_state !== 'deleted'");
    expect(source).toContain('provider.headObject({ key: candidate.file_path })');
    expect(source).toContain("SET status = 'active'");
    expect(source).toContain("eventType: 'restored'");
    expect(source.indexOf('provider.headObject')).toBeLessThan(source.indexOf("SET status = 'active'"));
  });

  test('supporting documents have no permanent-delete API or purge workflow', () => {
    expect(serverSource).not.toContain("app.delete('/api/documents/:id/permanent'");
    expect(serverSource).not.toContain('iset_document_purge_operation');
    expect(serverSource).not.toContain('getDocumentPermanentDeleteBlocker');
    expect(serverSource).not.toContain('can_permanently_delete');
  });

  test('deleted documents can only be viewed or downloaded by a System Administrator', () => {
    const source = extractRoute('get', '/api/documents/:id/presign-download');
    expect(source).toContain("d.status IN ('active', 'deleted')");
    expect(source).toContain("if (doc.status === 'deleted')");
    expect(source).toContain('!isSystemAdministratorRequest(req)');
    expect(source).toContain("doc.lifecycle_state !== 'deleted'");
  });
});
