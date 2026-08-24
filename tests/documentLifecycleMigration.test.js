const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.resolve(__dirname, '..', 'sql', 'migrations', '20260824_0001_add_document_lifecycle_audit.sql'),
  'utf8'
);

describe('document lifecycle migration contract', () => {
  test('keeps document deletion state separate from the existing workflow archive status', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS iset_document_lifecycle (');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS iset_document_lifecycle_event (');
    expect(migration).not.toMatch(/\bALTER\s+TABLE\s+iset_document\b/iu);
    expect(migration).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE)\s+iset_document\b/iu);
  });

  test('retains a minimal tombstone and append-only actor snapshots after the document row is gone', () => {
    expect(migration).toContain('original_document_id BIGINT UNSIGNED NOT NULL');
    expect(migration).toContain('UNIQUE KEY uq_iset_document_lifecycle_original (original_document_id)');
    expect(migration).toMatch(/FOREIGN KEY \(document_id\) REFERENCES iset_document \(id\)\s+ON DELETE SET NULL/iu);
    expect(migration).not.toContain('chk_iset_document_lifecycle_identity');
    expect(migration).toContain('actor_role_snapshot VARCHAR(64) NULL');
    expect(migration).toContain('actor_name_snapshot VARCHAR(255) NULL');
    expect(migration).toContain('actor_email_snapshot VARCHAR(255) NULL');
    expect(migration).not.toMatch(/\b(?:file_name|file_path|label_snapshot|metadata_snapshot)\b/iu);
  });

  test('permits only the reversible delete and restore lifecycle', () => {
    expect(migration).toContain("current_state IN ('active', 'deleted')");
    expect(migration).toContain("event_type IN ('deleted', 'restored')");
    expect(migration).toContain("from_state IN ('active', 'deleted')");
    expect(migration).toContain("to_state IN ('active', 'deleted')");
    expect(migration).not.toMatch(/\b(?:purge|permanent)\w*\b/iu);
  });

  test('makes lifecycle transitions idempotent without cascading away audit history', () => {
    expect(migration).toContain('UNIQUE KEY uq_iset_document_lifecycle_event_operation (operation_id, event_type)');
    expect(migration).not.toMatch(/ON DELETE CASCADE/iu);
  });
});
