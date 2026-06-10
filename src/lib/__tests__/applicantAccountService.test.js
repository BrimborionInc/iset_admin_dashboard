const mockSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
  AdminCreateUserCommand: jest.fn(input => ({ commandName: 'AdminCreateUserCommand', input })),
  AdminDeleteUserCommand: jest.fn(input => ({ commandName: 'AdminDeleteUserCommand', input })),
  AdminGetUserCommand: jest.fn(input => ({ commandName: 'AdminGetUserCommand', input })),
  AdminSetUserPasswordCommand: jest.fn(input => ({ commandName: 'AdminSetUserPasswordCommand', input })),
  AdminUpdateUserAttributesCommand: jest.fn(input => ({ commandName: 'AdminUpdateUserAttributesCommand', input })),
}));

jest.mock('@aws-sdk/client-ses', () => ({
  SESClient: jest.fn(() => ({ send: jest.fn() })),
  SendEmailCommand: jest.fn(input => ({ commandName: 'SendEmailCommand', input })),
}));

jest.mock('../awsCredentials', () => ({
  resolveAwsCredentials: jest.fn(() => null),
}));

describe('applicantAccountService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockReset();
    process.env = {
      ...originalEnv,
      COGNITO_TRUSTED_POOLS: 'ca-central-1_exampleApplicantPool:portal-client',
      COGNITO_STAFF_USER_POOL_ID: 'ca-central-1_staffPool',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('repairs FORCE_CHANGE_PASSWORD applicant users before password-reset activation', async () => {
    const {
      ensureApplicantCognitoPasswordResetReady,
    } = require('../applicantAccountService');
    const {
      AdminSetUserPasswordCommand,
      AdminGetUserCommand,
    } = require('@aws-sdk/client-cognito-identity-provider');

    mockSend
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ UserStatus: 'CONFIRMED' });

    const result = await ensureApplicantCognitoPasswordResetReady(
      'invitee@example.com',
      { UserStatus: 'FORCE_CHANGE_PASSWORD' }
    );

    expect(AdminSetUserPasswordCommand).toHaveBeenCalledWith(expect.objectContaining({
      UserPoolId: 'ca-central-1_exampleApplicantPool',
      Username: 'invitee@example.com',
      Password: expect.any(String),
      Permanent: true,
    }));
    expect(AdminGetUserCommand).toHaveBeenCalledWith(expect.objectContaining({
      UserPoolId: 'ca-central-1_exampleApplicantPool',
      Username: 'invitee@example.com',
    }));
    expect(result).toEqual(expect.objectContaining({
      repairedTemporaryPassword: true,
      userStatusBefore: 'FORCE_CHANGE_PASSWORD',
      userStatusAfter: 'CONFIRMED',
    }));
  });

  test('leaves already confirmed applicant users unchanged', async () => {
    const {
      ensureApplicantCognitoPasswordResetReady,
    } = require('../applicantAccountService');
    const {
      AdminSetUserPasswordCommand,
    } = require('@aws-sdk/client-cognito-identity-provider');

    const result = await ensureApplicantCognitoPasswordResetReady(
      'invitee@example.com',
      { UserStatus: 'CONFIRMED' }
    );

    expect(AdminSetUserPasswordCommand).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      repairedTemporaryPassword: false,
      userStatusBefore: 'CONFIRMED',
      userStatusAfter: 'CONFIRMED',
    }));
  });

  test('changes an unactivated applicant account email across Cognito, local user, and client rows', async () => {
    const {
      changeApplicantAccountEmail,
    } = require('../applicantAccountService');
    const {
      AdminCreateUserCommand,
      AdminDeleteUserCommand,
      AdminSetUserPasswordCommand,
    } = require('@aws-sdk/client-cognito-identity-provider');

    const oldEmail = 'candance.stone31@outlook.com';
    const newEmail = 'candace.stone31@outlook.com';
    const oldSub = 'old-sub';
    const newSub = 'new-sub';
    const observedQueries = {};
    const dbPool = {
      query: jest.fn(async (sql, params = []) => {
        const compactSql = String(sql).replace(/\s+/g, ' ').trim();

        if (compactSql === 'SHOW COLUMNS FROM `user`') {
          return [[
            { Field: 'email' },
            { Field: 'cognito_sub' },
            { Field: 'name' },
            { Field: 'preferred_language' },
            { Field: 'email_verified' },
            { Field: 'suspended' },
          ]];
        }

        if (compactSql.includes('FROM client WHERE id = ? LIMIT 1')) {
          return [[{
            id: 15,
            first_name: 'Candace',
            last_name: 'Stone',
            address_json: JSON.stringify({
              contact: {
                email: oldEmail,
                emailNormalized: oldEmail,
              },
            }),
            applicant_cognito_sub: oldSub,
            applicant_cognito_username: oldEmail,
            applicant_account_status: 'invitation_sent',
            applicant_account_email: oldEmail,
            applicant_invited_at: '2026-05-27T16:00:00Z',
            applicant_activated_at: null,
          }]];
        }

        if (compactSql.includes('LOWER(COALESCE(applicant_account_email')) {
          return [[]];
        }

        if (compactSql.includes('FROM user WHERE LOWER(email) = ? LIMIT 1')) {
          return [[]];
        }

        if (compactSql.includes('FROM client WHERE id <> ? AND applicant_cognito_sub = ? LIMIT 1')) {
          return [[]];
        }

        if (compactSql.includes('FROM user WHERE cognito_sub = ? OR cognito_sub = ? OR email = ?')) {
          observedQueries.userLookupParams = params;
          return [[{
            id: 18,
            email: oldEmail,
            cognito_sub: oldSub,
          }]];
        }

        if (compactSql.startsWith('UPDATE user SET email = ?, cognito_sub = ?')) {
          observedQueries.userUpdateParams = params;
          return [{ affectedRows: 1 }];
        }

        if (compactSql.startsWith('UPDATE client SET applicant_cognito_sub = ?')) {
          observedQueries.clientUpdateParams = params;
          return [{ affectedRows: 1 }];
        }

        if (compactSql.startsWith('INSERT INTO client_applicant_account_event')) {
          observedQueries.eventParams = params;
          observedQueries.eventMetadata = JSON.parse(params[3]);
          return [{ insertId: 298 }];
        }

        if (compactSql.includes('WITH latest_case AS')) {
          return [[{
            client_id: 15,
            first_name: 'Candace',
            last_name: 'Stone',
            address_json: JSON.stringify({
              contact: {
                email: newEmail,
                emailNormalized: newEmail,
              },
            }),
            applicant_cognito_sub: newSub,
            applicant_cognito_username: newEmail,
            applicant_account_status: 'created',
            applicant_account_email: newEmail,
            applicant_invited_at: null,
            applicant_activated_at: null,
            case_id: 15,
            case_number: 'CASE-15',
            case_status: 'active',
          }]];
        }

        throw new Error(`Unexpected SQL in test: ${compactSql}`);
      }),
    };

    const notFound = new Error('not found');
    notFound.name = 'UserNotFoundException';
    mockSend
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        UserStatus: 'CONFIRMED',
        UserAttributes: [
          { Name: 'sub', Value: newSub },
          { Name: 'email', Value: newEmail },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'preferred_username', Value: newEmail },
          { Name: 'given_name', Value: 'Candace' },
          { Name: 'family_name', Value: 'Stone' },
        ],
      })
      .mockResolvedValueOnce({});

    const result = await changeApplicantAccountEmail(dbPool, {
      clientId: 15,
      email: newEmail,
      actorStaffProfileId: 42,
      source: 'case_header',
    });

    expect(result).toEqual(expect.objectContaining({
      clientId: 15,
      email: newEmail,
      accountEmail: newEmail,
      cognitoSub: newSub,
      cognitoUsername: newEmail,
      accountStatus: 'created',
    }));
    expect(observedQueries.userLookupParams).toEqual([oldSub, newSub, newEmail, oldSub, newSub, newEmail]);
    expect(observedQueries.userUpdateParams).toEqual(expect.arrayContaining([newEmail, newSub, 18]));
    expect(observedQueries.userUpdateParams[0]).toBe(newEmail);
    expect(observedQueries.userUpdateParams[1]).toBe(newSub);
    expect(observedQueries.userUpdateParams.at(-1)).toBe(18);
    expect(observedQueries.clientUpdateParams).toEqual([
      newSub,
      newEmail,
      newEmail,
      'created',
      newEmail,
      newEmail,
      15,
    ]);
    expect(observedQueries.eventParams?.slice(0, 3)).toEqual([15, 'account_email_changed', 42]);
    expect(observedQueries.eventMetadata).toEqual(expect.objectContaining({
      source: 'case_header',
      previousEmail: oldEmail,
      newEmail,
      previousCognitoSub: oldSub,
      newCognitoSub: newSub,
      previousCognitoUsername: oldEmail,
      newCognitoUsername: newEmail,
      previousCognitoDeleted: true,
    }));
    expect(AdminCreateUserCommand).toHaveBeenCalledWith(expect.objectContaining({
      UserPoolId: 'ca-central-1_exampleApplicantPool',
      Username: newEmail,
      MessageAction: 'SUPPRESS',
    }));
    expect(AdminSetUserPasswordCommand).toHaveBeenCalledWith(expect.objectContaining({
      UserPoolId: 'ca-central-1_exampleApplicantPool',
      Username: newEmail,
      Permanent: true,
    }));
    expect(AdminDeleteUserCommand).toHaveBeenCalledWith(expect.objectContaining({
      UserPoolId: 'ca-central-1_exampleApplicantPool',
      Username: oldEmail,
    }));
  });

  test('orders applicant account rows before applying limit and offset', async () => {
    const {
      fetchApplicantAccountRows,
    } = require('../applicantAccountService');
    const observedQueries = {};
    const dbPool = {
      query: jest.fn(async (sql, params = []) => {
        const compactSql = String(sql).replace(/\s+/g, ' ').trim();

        if (compactSql.includes('SELECT COUNT(*) AS total')) {
          observedQueries.countSql = compactSql;
          observedQueries.countParams = params;
          return [[{ total: 42 }]];
        }

        if (compactSql.includes('SELECT cl.id AS client_id')) {
          observedQueries.mainSql = compactSql;
          observedQueries.mainParams = params;
          return [[{
            client_id: 25,
            first_name: 'Ada',
            last_name: 'North',
            address_json: JSON.stringify({ contact: { email: 'ada.north@example.org' } }),
            applicant_cognito_sub: 'applicant-sub',
            applicant_cognito_username: 'ada.north@example.org',
            applicant_account_status: 'created',
            applicant_account_email: 'ada.north@example.org',
            applicant_invited_at: null,
            applicant_activated_at: null,
            case_id: 250,
            case_number: 'CASE-250',
            case_status: 'active',
            region_code: 'NU',
            region_name: 'Nunavut',
            case_manager_name: 'Case Manager',
            applicant_user_id: 125,
          }]];
        }

        throw new Error(`Unexpected SQL in test: ${compactSql}`);
      }),
    };

    const result = await fetchApplicantAccountRows(dbPool, {
      status: 'created',
      limit: 20,
      offset: 40,
      sortField: 'email',
      sortDirection: 'desc',
      includeTotal: true,
    });

    expect(result).toEqual({
      total: 42,
      rows: [expect.objectContaining({
        clientId: 25,
        applicantName: 'Ada North',
        email: 'ada.north@example.org',
        accountStatus: 'created',
      })],
    });
    const orderIndex = observedQueries.mainSql.indexOf('ORDER BY');
    const limitIndex = observedQueries.mainSql.indexOf('LIMIT ? OFFSET ?');
    expect(observedQueries.countSql).not.toContain('LIMIT ? OFFSET ?');
    expect(observedQueries.countParams).toEqual([]);
    expect(orderIndex).toBeGreaterThan(-1);
    expect(limitIndex).toBeGreaterThan(-1);
    expect(orderIndex).toBeLessThan(limitIndex);
    expect(observedQueries.mainSql).toMatch(/ORDER BY LOWER\(COALESCE\(\s*cl\.applicant_account_email/i);
    expect(observedQueries.mainSql).toContain('DESC, cl.updated_at DESC');
    expect(observedQueries.mainParams).toEqual([20, 40]);
  });

  test('does not change an activated applicant account email', async () => {
    const {
      changeApplicantAccountEmail,
    } = require('../applicantAccountService');
    const dbPool = {
      query: jest.fn(async sql => {
        const compactSql = String(sql).replace(/\s+/g, ' ').trim();
        if (compactSql.includes('FROM client WHERE id = ? LIMIT 1')) {
          return [[{
            id: 15,
            first_name: 'Candace',
            last_name: 'Stone',
            address_json: '{}',
            applicant_cognito_sub: 'active-sub',
            applicant_cognito_username: 'candace.stone31@outlook.com',
            applicant_account_status: 'activated',
            applicant_account_email: 'candace.stone31@outlook.com',
            applicant_invited_at: '2026-05-27T16:00:00Z',
            applicant_activated_at: '2026-05-27T16:30:00Z',
          }]];
        }
        throw new Error(`Unexpected SQL in test: ${compactSql}`);
      }),
    };

    await expect(changeApplicantAccountEmail(dbPool, {
      clientId: 15,
      email: 'new.email@example.com',
    })).rejects.toMatchObject({ code: 'account_already_activated' });

    expect(mockSend).not.toHaveBeenCalled();
    expect(dbPool.query).toHaveBeenCalledTimes(1);
  });
});
