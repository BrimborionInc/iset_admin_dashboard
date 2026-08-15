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
  test('only ordinary manual and quarantined legacy uploads are generically mutable', () => {
    const allowlistStart = serverSource.indexOf('const GENERICALLY_MUTABLE_DOCUMENT_SOURCES');
    const helperStart = serverSource.indexOf('async function validateGenericDocumentMutationIntegrity');
    const allowlistSource = serverSource.slice(allowlistStart, helperStart);
    const helperSource = extractFunction(
      'validateGenericDocumentMutationIntegrity',
      '\nfunction documentMutationTimestamp'
    );

    expect(allowlistStart).toBeGreaterThanOrEqual(0);
    expect(allowlistSource).toContain("'manual_upload'");
    expect(allowlistSource).toContain("'legacy_intake_upload'");
    expect(allowlistSource).not.toContain("'application_submission'");
    expect(allowlistSource).not.toContain("'secure_message_attachment'");
    expect(allowlistSource).not.toContain("'system_generated'");
    expect(helperSource).toContain('GENERICALLY_MUTABLE_DOCUMENT_SOURCES.has(source)');
    expect(helperSource).toContain("buildImmutableDocumentMutationError('authoritative_source')");
    expect(helperSource.trim().endsWith('return null;\n}')).toBe(true);
  });

  test.each(['manual_upload', 'legacy_intake_upload'])(
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

  test.each(['application_submission', 'secure_message_attachment', 'system_generated'])(
    '%s fails closed as an authoritative source',
    async source => {
      const { guard } = loadIntegrityGuard();
      const connection = {
        query: jest.fn().mockResolvedValue([[]]),
      };

      await expect(guard({ id: 19, source }, connection)).resolves.toMatchObject({
        status: 409,
        body: { error: 'document_immutable', reason: 'authoritative_source' },
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
    ['put', '/api/documents/:id'],
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

  test('immutable responses fail closed with a stable conflict contract', () => {
    expect(serverSource).toContain("error: 'document_immutable'");
    expect(serverSource).toContain('status: 409');
    expect(serverSource).toContain(
      'cannot be edited, duplicated, or deleted through Supporting Documents.'
    );
  });
});
