const fs = require('fs');
const path = require('path');

const serverSource = fs.readFileSync(
  path.resolve(__dirname, '../../../isetadminserver.js'),
  'utf8'
);

function extractFunction(name, nextMarker = '\nasync function ') {
  const startMarker = `async function ${name}`;
  const start = serverSource.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf(nextMarker, start + startMarker.length);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

function extractRoute(method, route) {
  const startMarker = `app.${method}('${route}'`;
  const start = serverSource.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = serverSource.indexOf('\napp.', start + startMarker.length);
  expect(end).toBeGreaterThan(start);
  return serverSource.slice(start, end);
}

function loadIntegrityGuard({ paymentLinkCount = 0 } = {}) {
  const start = serverSource.indexOf('const GENERICALLY_MUTABLE_DOCUMENT_SOURCES');
  const end = serverSource.indexOf('\nasync function fetchCaseAccessRowsForDocument', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const implementation = serverSource.slice(start, end);
  const paymentLinkLookup = jest.fn().mockResolvedValue(paymentLinkCount);
  const factory = new Function(
    'normalisePositiveInteger',
    'normaliseString',
    'fetchDocumentPaymentLinkCount',
    'pool',
    `${implementation}\nreturn validateGenericDocumentMutationIntegrity;`
  );
  const guard = factory(
    value => {
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    },
    value => {
      if (value === null || typeof value === 'undefined') return null;
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    },
    paymentLinkLookup,
    { query: jest.fn() }
  );
  return { guard, paymentLinkLookup };
}

function loadAttachmentIntegrityGuard({ paymentLinkCount = 0 } = {}) {
  const start = serverSource.indexOf('function buildImmutableDocumentAttachmentError');
  const end = serverSource.indexOf('\nfunction documentMutationTimestamp', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const implementation = serverSource.slice(start, end);
  const paymentLinkLookup = jest.fn().mockResolvedValue(paymentLinkCount);
  const factory = new Function(
    'normalisePositiveInteger',
    'fetchDocumentPaymentLinkCount',
    'pool',
    `${implementation}\nreturn validateDocumentAttachmentMutationIntegrity;`
  );
  const guard = factory(
    value => {
      const numeric = Number(value);
      return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
    },
    paymentLinkLookup,
    { query: jest.fn() }
  );
  return { guard, paymentLinkLookup };
}

function loadLockedMutationContext({ mutationError = null } = {}) {
  const start = serverSource.indexOf('function documentMutationTimestamp');
  const end = serverSource.indexOf('\nasync function fetchCaseAccessRowsForDocument', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const implementation = serverSource.slice(start, end);
  const validateDocumentAccess = jest.fn().mockResolvedValue(null);
  const validateGenericDocumentMutationIntegrity = jest.fn().mockResolvedValue(mutationError);
  const factory = new Function(
    'normalisePositiveInteger',
    'validateDocumentAccess',
    'validateGenericDocumentMutationIntegrity',
    `${implementation}\nreturn lockGenericDocumentMutationContext;`
  );
  return {
    lock: factory(
      value => {
        const numeric = Number(value);
        return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
      },
      validateDocumentAccess,
      validateGenericDocumentMutationIntegrity
    ),
    validateDocumentAccess,
    validateGenericDocumentMutationIntegrity,
  };
}

describe('generic Supporting Documents mutation integrity', () => {
  test('only ordinary staff uploads are generically mutable', () => {
    const allowlistStart = serverSource.indexOf('const GENERICALLY_MUTABLE_DOCUMENT_SOURCES');
    const helperStart = serverSource.indexOf('async function validateGenericDocumentMutationIntegrity');
    const allowlistSource = serverSource.slice(allowlistStart, helperStart);
    const helperSource = extractFunction(
      'validateGenericDocumentMutationIntegrity',
      '\nconst DOCUMENT_ACTION_BLOCKER_MESSAGES'
    );

    expect(allowlistStart).toBeGreaterThanOrEqual(0);
    expect(allowlistSource).toContain("'manual_upload'");
    expect(allowlistSource).not.toContain("'legacy_intake_upload'");
    expect(allowlistSource).not.toContain("'application_submission'");
    expect(allowlistSource).not.toContain("'secure_message_attachment'");
    expect(allowlistSource).not.toContain("'system_generated'");
    expect(helperSource).toContain('GENERICALLY_MUTABLE_DOCUMENT_SOURCES.has(source)');
    expect(helperSource).toContain("buildImmutableDocumentMutationError('authoritative_source')");
    expect(helperSource.trim().endsWith('return null;\n}')).toBe(true);
  });

  test.each(['manual_upload'])(
    '%s remains mutable when no workflow dependency exists',
    async source => {
      const { guard, paymentLinkLookup } = loadIntegrityGuard();
      const connection = {
        query: jest.fn().mockResolvedValue([[]]),
      };

      await expect(guard({ id: 17, source }, connection)).resolves.toBeNull();
      expect(connection.query).toHaveBeenCalledTimes(2);
      expect(paymentLinkLookup).toHaveBeenCalledWith(17, connection);
    }
  );

  test.each(['application_submission', 'secure_message_attachment', 'system_generated', 'legacy_intake_upload'])(
    '%s fails closed as an authoritative source',
    async source => {
      const { guard } = loadIntegrityGuard();
      const connection = {
        query: jest.fn().mockResolvedValue([[]]),
      };

      await expect(guard({ id: 19, source }, connection)).resolves.toMatchObject({
        status: 409,
        body: {
          error: 'document_immutable',
          reason: 'authoritative_source',
          message:
            "PATH needs to keep this document in the applicant's file, so it can't be copied or deleted. You can still change its title or document type.",
        },
      });
    }
  );

  test('a missing or unknown source fails closed', async () => {
    const connection = { query: jest.fn().mockResolvedValue([[]]) };
    const missingSourceGuard = loadIntegrityGuard().guard;
    await expect(missingSourceGuard({ id: 20, source: null }, connection)).resolves.toMatchObject({
      status: 409,
      body: { error: 'document_immutable', reason: 'authoritative_source' },
    });

    const unknownSourceGuard = loadIntegrityGuard().guard;
    await expect(
      unknownSourceGuard({ id: 21, source: 'unrecognised_source' }, connection)
    ).resolves.toMatchObject({
      status: 409,
      body: { error: 'document_immutable', reason: 'authoritative_source' },
    });
  });

  test('dependency checks make otherwise mutable sources immutable', async () => {
    const signingGuard = loadIntegrityGuard().guard;
    await expect(
      signingGuard({ id: 21, source: 'manual_upload', signing_request_id: 4 }, { query: jest.fn() })
    ).resolves.toMatchObject({ body: { reason: 'signing_request_link' } });

    const messageGuard = loadIntegrityGuard().guard;
    await expect(
      messageGuard({ id: 22, source: 'manual_upload', origin_message_id: 5 }, { query: jest.fn() })
    ).resolves.toMatchObject({ body: { reason: 'secure_message_origin' } });

    const cfaGuard = loadIntegrityGuard().guard;
    await expect(
      cfaGuard(
        { id: 23, source: 'manual_upload' },
        { query: jest.fn().mockResolvedValueOnce([[{ document_id: 23 }]]) }
      )
    ).resolves.toMatchObject({ body: { reason: 'cfa_version_link' } });

    const fundingGuard = loadIntegrityGuard().guard;
    await expect(
      fundingGuard(
        { id: 24, source: 'manual_upload' },
        {
          query: jest.fn()
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[{ document_id: 24 }]]),
        }
      )
    ).resolves.toMatchObject({ body: { reason: 'funding_overview_version_link' } });

    const { guard: paymentGuard } = loadIntegrityGuard({ paymentLinkCount: 1 });
    await expect(
      paymentGuard(
        { id: 25, source: 'manual_upload' },
        { query: jest.fn().mockResolvedValue([[]]) }
      )
    ).resolves.toMatchObject({ body: { reason: 'payment_evidence_link' } });
  });

  test('the central guard rejects every authoritative dependency class', () => {
    const helperSource = extractFunction(
      'validateGenericDocumentMutationIntegrity',
      '\nfunction documentMutationTimestamp'
    );

    expect(helperSource).toContain('documentRow.signing_request_id');
    expect(helperSource).toContain("buildImmutableDocumentMutationError('signing_request_link')");
    expect(helperSource).toContain('documentRow.origin_message_id');
    expect(helperSource).toContain("buildImmutableDocumentMutationError('secure_message_origin')");
    expect(helperSource).toContain('FROM cfa_version_documents cvd');
    expect(helperSource).toContain('WHERE cvd.document_id = ?');
    expect(helperSource).toContain("buildImmutableDocumentMutationError('cfa_version_link')");
    expect(helperSource).toContain('FROM funding_overview_version_documents fvd');
    expect(helperSource).toContain('WHERE fvd.document_id = ?');
    expect(helperSource).toContain("buildImmutableDocumentMutationError('funding_overview_version_link')");
    expect(helperSource).toContain('fetchDocumentPaymentLinkCount(normalizedDocumentId, connection)');
    expect(helperSource).toContain("buildImmutableDocumentMutationError('payment_evidence_link')");
  });

  test.each([
    'application_submission',
    'secure_message_attachment',
    'manual_upload',
    'legacy_intake_upload',
    'system_generated',
    'unrecognised_source',
  ])('%s details are not classified as an unsafe attachment mutation', async source => {
    const { guard, paymentLinkLookup } = loadAttachmentIntegrityGuard();
    const connection = { query: jest.fn().mockResolvedValue([[]]) };

    await expect(guard({ id: 30, source, origin_message_id: 71 }, connection)).resolves.toBeNull();
    expect(connection.query).toHaveBeenCalledTimes(2);
    expect(paymentLinkLookup).toHaveBeenCalledWith(30, connection);
  });

  test('attachment reassignment remains blocked for concrete signing, version, and payment dependencies', async () => {
    await expect(
      loadAttachmentIntegrityGuard().guard(
        { id: 31, signing_request_id: 4 },
        { query: jest.fn() }
      )
    ).resolves.toMatchObject({ body: { reason: 'signing_request_link' } });

    await expect(
      loadAttachmentIntegrityGuard().guard(
        { id: 32 },
        { query: jest.fn().mockResolvedValueOnce([[{ document_id: 32 }]]) }
      )
    ).resolves.toMatchObject({ body: { reason: 'cfa_version_link' } });

    await expect(
      loadAttachmentIntegrityGuard().guard(
        { id: 33 },
        {
          query: jest.fn()
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[{ document_id: 33 }]]),
        }
      )
    ).resolves.toMatchObject({ body: { reason: 'funding_overview_version_link' } });

    await expect(
      loadAttachmentIntegrityGuard({ paymentLinkCount: 1 }).guard(
        { id: 34 },
        { query: jest.fn().mockResolvedValue([[]]) }
      )
    ).resolves.toMatchObject({ body: { reason: 'payment_evidence_link' } });
  });

  test.each([
    ['post', '/api/documents/:id/duplicate'],
    ['delete', '/api/documents/:id'],
  ])('%s %s loads provenance and invokes the integrity guard before mutation', (method, route) => {
    const routeSource = extractRoute(method, route);
    const guardIndex = routeSource.indexOf('validateGenericDocumentMutationIntegrity(');

    expect(routeSource).toContain('source');
    expect(routeSource).toContain('origin_message_id');
    expect(routeSource).toContain('signing_request_id');
    expect(routeSource).toContain("status = 'active'");
    expect(guardIndex).toBeGreaterThan(routeSource.indexOf('validateDocumentAccess('));
    expect(routeSource).toContain('mutationError.status');

    const mutationIndices = [
        routeSource.indexOf('SET label = ?'),
        routeSource.indexOf('SET ${updateFields.join'),
        routeSource.indexOf('duplicateDocumentFile({'),
        routeSource.indexOf("SET status = 'deleted'"),
      ].filter(index => index >= 0);
    const firstMutationIndex = Math.min(...mutationIndices);
    expect(firstMutationIndex).toBeGreaterThan(guardIndex);
    mutationIndices.forEach(mutationIndex => {
      expect(
        routeSource.lastIndexOf('lockGenericDocumentMutationContext({', mutationIndex)
      ).toBeGreaterThanOrEqual(0);
    });
    expect(routeSource).toContain('beginTransaction()');
    expect(routeSource).toContain('lockGenericDocumentMutationContext({');
    expect(routeSource).toContain('.commit()');
  });

  test('document edits use the attachment-specific guard only when the resolved attachment changes', () => {
    const routeSource = extractRoute('put', '/api/documents/:id');
    const labelOnlyMarker = routeSource.indexOf('if (isLabelOnlyUpdate)');
    const labelOnlyEnd = routeSource.indexOf('const effectiveDocType', labelOnlyMarker);
    const labelOnlySource = routeSource.slice(labelOnlyMarker, labelOnlyEnd);
    const sourceLineage = routeSource.indexOf('preserveDocumentSourceLineage({');
    const attachmentGuard = routeSource.indexOf('if (attachmentMutationRequested)');

    expect(labelOnlySource).toContain('lockGenericDocumentMutationContext({');
    expect(labelOnlySource).toContain('requireIntegrityCheck: false');
    expect(labelOnlySource).toContain('SET label = ?, metadata = ?, updated_at = NOW()');
    expect(labelOnlySource).not.toContain('validateGenericDocumentMutationIntegrity(');
    expect(routeSource).not.toContain('validateGenericDocumentMutationIntegrity(existingRow)');
    expect(sourceLineage).toBeGreaterThan(labelOnlyEnd);
    expect(attachmentGuard).toBeGreaterThan(sourceLineage);
    expect(routeSource.slice(attachmentGuard)).toContain(
      'validateDocumentAttachmentMutationIntegrity(existingRow)'
    );

    const fullMutationIndex = routeSource.indexOf('SET ${updateFields.join');
    expect(fullMutationIndex).toBeGreaterThan(labelOnlyEnd);
    const lockedPath = routeSource.slice(
      routeSource.lastIndexOf('lockGenericDocumentMutationContext({', fullMutationIndex),
      fullMutationIndex
    );
    expect(lockedPath).toContain('requireIntegrityCheck: false');
    expect(lockedPath).toContain('lockedAttachmentMutation');
    expect(lockedPath).toContain('validateDocumentAttachmentMutationIntegrity(');
  });

  test('the final locked check catches a dependency created after preflight', async () => {
    const immutable = {
      status: 409,
      body: { error: 'document_immutable', reason: 'cfa_version_link' },
    };
    const { lock, validateGenericDocumentMutationIntegrity } = loadLockedMutationContext({
      mutationError: immutable,
    });
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[
        {
          id: 41,
          status: 'active',
          source: 'manual_upload',
          updated_at: '2026-08-15T12:00:00.000Z',
        },
      ]]),
    };

    await expect(lock({
      documentId: 41,
      req: {},
      expectedUpdatedAt: '2026-08-15T12:00:00.000Z',
      connection,
    })).resolves.toEqual({ error: immutable });

    expect(connection.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(validateGenericDocumentMutationIntegrity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 41 }),
      connection
    );
  });

  test('a title-only lock preserves access and concurrency checks without classifying the whole document as mutable', async () => {
    const { lock, validateDocumentAccess, validateGenericDocumentMutationIntegrity } =
      loadLockedMutationContext({
        mutationError: {
          status: 409,
          body: { error: 'document_immutable', reason: 'authoritative_source' },
        },
      });
    const connection = {
      query: jest.fn().mockResolvedValueOnce([[
        {
          id: 42,
          status: 'active',
          source: 'application_submission',
          updated_at: '2026-08-17T12:00:00.000Z',
        },
      ]]),
    };

    await expect(lock({
      documentId: 42,
      req: {},
      expectedUpdatedAt: '2026-08-17T12:00:00.000Z',
      connection,
      requireIntegrityCheck: false,
    })).resolves.toEqual({
      documentRow: expect.objectContaining({ id: 42, source: 'application_submission' }),
    });

    expect(connection.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(validateDocumentAccess).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ id: 42 }),
      { connection }
    );
    expect(validateGenericDocumentMutationIntegrity).not.toHaveBeenCalled();
  });

  test('immutable responses fail closed with a stable conflict contract', () => {
    expect(serverSource).toContain("error: 'document_immutable'");
    expect(serverSource).toContain("error: 'document_attachment_immutable'");
    expect(serverSource).toContain('status: 409');
    expect(serverSource).toContain(
      "PATH needs to keep this document in the applicant's file, so it can't be copied or deleted."
    );
    expect(serverSource).toContain('The document title and document type can be edited');
  });
});
