const mockSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  class ListUsersCommand { constructor(input) { this.input = input; } }
  class ListUsersInGroupCommand { constructor(input) { this.input = input; } }
  class AdminListGroupsForUserCommand { constructor(input) { this.input = input; } }
  class AdminCreateUserCommand { constructor(input) { this.input = input; } }
  class AdminAddUserToGroupCommand { constructor(input) { this.input = input; } }
  class AdminRemoveUserFromGroupCommand { constructor(input) { this.input = input; } }
  class AdminDisableUserCommand { constructor(input) { this.input = input; } }
  class AdminEnableUserCommand { constructor(input) { this.input = input; } }
  class AdminGetUserCommand { constructor(input) { this.input = input; } }
  class AdminDeleteUserCommand { constructor(input) { this.input = input; } }
  class AdminResetUserPasswordCommand { constructor(input) { this.input = input; } }

  class CognitoIdentityProviderClient {
    send(command) {
      return mockSend(command);
    }
  }

  return {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    ListUsersInGroupCommand,
    AdminListGroupsForUserCommand,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    AdminRemoveUserFromGroupCommand,
    AdminDisableUserCommand,
    AdminEnableUserCommand,
    AdminGetUserCommand,
    AdminDeleteUserCommand,
    AdminResetUserPasswordCommand,
  };
});

jest.mock('../../lib/awsCredentials', () => ({
  resolveAwsCredentials: jest.fn(() => null),
}));

function createResponse() {
  const res = {
    statusCode: 200,
    body: null,
    status: jest.fn(code => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn(payload => {
      res.body = payload;
      return res;
    }),
  };
  return res;
}

function findRoute(router, path, method) {
  return router.stack.find(layer => (
    layer.route
    && layer.route.path === path
    && layer.route.methods[method]
  ));
}

function commandName(command) {
  return command?.constructor?.name;
}

function createTransactionalPool(queryMock) {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
    query: queryMock,
  };
  const pool = {
    getConnection: jest.fn().mockResolvedValue(connection),
    query: jest.fn(),
    connection,
  };
  return pool;
}

async function invokeRoute(routeLayer, req, res) {
  const handlers = routeLayer.route.stack.map(layer => layer.handle);
  let index = 0;

  async function next(err) {
    if (err) throw err;
    const handler = handlers[index++];
    if (!handler) return;
    await handler(req, res, next);
  }

  await next();
}

describe('admin users profile route', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    process.env.COGNITO_STAFF_USER_POOL_ID = 'staff-pool';
    process.env.AWS_REGION = 'ca-central-1';
  });

  test.each(['NWAC Administrator', 'Regional Manager'])(
    'updates DB-backed staff profile name and display name for %s',
    async actorRole => {
    const router = require('./users');
    const routeLayer = findRoute(router, '/users/:username/profile', 'patch');
    expect(routeLayer).toBeTruthy();

    mockSend
      .mockResolvedValueOnce({
        Groups: [{ GroupName: 'ISET_Coordinator' }],
      })
      .mockResolvedValueOnce({
        UserStatus: 'CONFIRMED',
        Enabled: true,
        UserAttributes: [
          { Name: 'email', Value: 'iset@mmvi.ca' },
          { Name: 'sub', Value: 'staff-sub-123' },
        ],
      });

    const pool = {
      query: jest.fn().mockResolvedValue([[], []]),
    };
    const req = {
      auth: { role: actorRole },
      params: { username: 'iset@mmvi.ca' },
      body: {
        name: 'Judy Cook',
        display_name: 'Judy Cook',
      },
      app: { locals: { pool } },
    };
    const res = createResponse();

    await invokeRoute(routeLayer, req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      message: 'User profile updated',
      name: 'Judy Cook',
      displayName: 'Judy Cook',
      display_name: 'Judy Cook',
    });
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toContain('INSERT INTO staff_profiles');
    expect(pool.query.mock.calls[0][0]).toContain('name = VALUES(name)');
    expect(pool.query.mock.calls[0][0]).toContain('display_name = VALUES(display_name)');
    expect(pool.query.mock.calls[0][1]).toEqual([
      'staff-sub-123',
      'iset@mmvi.ca',
      'Judy Cook',
      'Judy Cook',
      'ISET Coordinator',
    ]);
    },
  );
});

describe('admin users create route', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSend.mockReset();
    process.env.COGNITO_STAFF_USER_POOL_ID = 'staff-pool';
    process.env.AWS_REGION = 'ca-central-1';
  });

  test('creates silently, writes DB-backed staff access, then sends Cognito invite', async () => {
    const router = require('./users');
    const routeLayer = findRoute(router, '/users', 'post');
    expect(routeLayer).toBeTruthy();

    const sentCommands = [];
    mockSend.mockImplementation(async command => {
      sentCommands.push(command);
      if (commandName(command) === 'AdminCreateUserCommand' && command.input?.MessageAction === 'SUPPRESS') {
        return {
          User: {
            Username: 'new.rm@example.org',
            Attributes: [{ Name: 'sub', Value: 'staff-sub-rm' }],
          },
        };
      }
      return {};
    });

    const pool = createTransactionalPool(jest.fn()
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ id: 55 }], []])
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce([{ affectedRows: 2 }, []]));
    const req = {
      auth: { role: 'System Administrator' },
      body: {
        email: 'new.rm@example.org',
        name: 'New Regional Manager',
        display_name: 'New RM',
        role: 'Regional_Manager',
        region_ids: [1, 2],
      },
      app: { locals: { pool } },
    };
    const res = createResponse();

    await invokeRoute(routeLayer, req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'User created',
      cognito: 'new.rm@example.org',
      inviteEmail: 'sent',
    });
    expect(sentCommands.map(commandName)).toEqual([
      'AdminCreateUserCommand',
      'AdminAddUserToGroupCommand',
      'AdminCreateUserCommand',
    ]);
    expect(sentCommands[0].input).toMatchObject({
      Username: 'new.rm@example.org',
      MessageAction: 'SUPPRESS',
      DesiredDeliveryMediums: ['EMAIL'],
    });
    expect(sentCommands[0].input.UserAttributes).toEqual(expect.arrayContaining([
      { Name: 'email', Value: 'new.rm@example.org' },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: 'New Regional Manager' },
    ]));
    expect(sentCommands[1].input).toMatchObject({
      Username: 'new.rm@example.org',
      GroupName: 'Regional_Manager',
    });
    expect(sentCommands[2].input).toMatchObject({
      Username: 'new.rm@example.org',
      MessageAction: 'RESEND',
      DesiredDeliveryMediums: ['EMAIL'],
    });
    expect(sentCommands[2].input.UserAttributes).toEqual(expect.arrayContaining([
      { Name: 'email', Value: 'new.rm@example.org' },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'name', Value: 'New Regional Manager' },
    ]));
    expect(pool.connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(pool.connection.commit).toHaveBeenCalledTimes(1);
    expect(pool.connection.rollback).not.toHaveBeenCalled();
    expect(pool.connection.query.mock.calls[4][0]).toContain('INSERT INTO staff_region');
  });

  test('rolls back the Cognito user and does not send an invite when DB staff sync fails', async () => {
    const router = require('./users');
    const routeLayer = findRoute(router, '/users', 'post');
    expect(routeLayer).toBeTruthy();

    const sentCommands = [];
    mockSend.mockImplementation(async command => {
      sentCommands.push(command);
      if (commandName(command) === 'AdminCreateUserCommand') {
        return {
          User: {
            Username: 'broken.rm@example.org',
            Attributes: [{ Name: 'sub', Value: 'staff-sub-broken' }],
          },
        };
      }
      return {};
    });

    const pool = createTransactionalPool(jest.fn()
      .mockResolvedValueOnce([[], []])
      .mockRejectedValueOnce(new Error('staff profile insert failed')));
    const req = {
      auth: { role: 'System Administrator' },
      body: {
        email: 'broken.rm@example.org',
        name: 'Broken Regional Manager',
        role: 'Regional_Manager',
        region_ids: [1],
      },
      app: { locals: { pool } },
    };
    const res = createResponse();

    await invokeRoute(routeLayer, req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to create user',
      detail: 'staff profile insert failed',
    });
    expect(sentCommands.map(commandName)).toEqual([
      'AdminCreateUserCommand',
      'AdminAddUserToGroupCommand',
      'AdminDeleteUserCommand',
    ]);
    expect(sentCommands[0].input?.MessageAction).toBe('SUPPRESS');
    expect(sentCommands.some(command => commandName(command) === 'AdminCreateUserCommand' && command.input?.MessageAction === 'RESEND')).toBe(false);
    expect(sentCommands[2].input).toMatchObject({
      UserPoolId: 'staff-pool',
      Username: 'broken.rm@example.org',
    });
    expect(pool.connection.rollback).toHaveBeenCalledTimes(1);
    expect(pool.connection.commit).not.toHaveBeenCalled();
  });

  test('cleans DB staff rows and deletes Cognito user when final invite send fails', async () => {
    const router = require('./users');
    const routeLayer = findRoute(router, '/users', 'post');
    expect(routeLayer).toBeTruthy();

    const sentCommands = [];
    mockSend.mockImplementation(async command => {
      sentCommands.push(command);
      if (commandName(command) === 'AdminCreateUserCommand' && command.input?.MessageAction === 'SUPPRESS') {
        return {
          User: {
            Username: 'invite.fail@example.org',
            Attributes: [{ Name: 'sub', Value: 'staff-sub-invite-fail' }],
          },
        };
      }
      if (commandName(command) === 'AdminCreateUserCommand' && command.input?.MessageAction === 'RESEND') {
        throw new Error('Cognito invite send failed');
      }
      return {};
    });

    const pool = createTransactionalPool(jest.fn()
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[{ id: 77 }], []])
      .mockResolvedValueOnce([{ affectedRows: 0 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]));
    pool.query
      .mockResolvedValueOnce([[{ id: 77 }], []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const req = {
      auth: { role: 'System Administrator' },
      body: {
        email: 'invite.fail@example.org',
        name: 'Invite Failure',
        role: 'Regional_Manager',
        region_ids: [1],
      },
      app: { locals: { pool } },
    };
    const res = createResponse();

    await invokeRoute(routeLayer, req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to create user',
      detail: 'Cognito invite send failed',
    });
    expect(sentCommands.map(commandName)).toEqual([
      'AdminCreateUserCommand',
      'AdminAddUserToGroupCommand',
      'AdminCreateUserCommand',
      'AdminDeleteUserCommand',
    ]);
    expect(pool.connection.commit).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls.map(call => call[0])).toEqual([
      'SELECT id FROM staff_profiles WHERE cognito_sub = ? LIMIT 1',
      'DELETE FROM staff_region WHERE staff_profile_id = ?',
      'DELETE FROM staff_profiles WHERE id = ?',
    ]);
    expect(pool.query.mock.calls[0][1]).toEqual(['staff-sub-invite-fail']);
    expect(pool.query.mock.calls[1][1]).toEqual([77]);
    expect(pool.query.mock.calls[2][1]).toEqual([77]);
    expect(sentCommands[3].input).toMatchObject({
      UserPoolId: 'staff-pool',
      Username: 'invite.fail@example.org',
    });
  });

  test('fails before mutating Cognito when the staff DB pool is unavailable', async () => {
    const router = require('./users');
    const routeLayer = findRoute(router, '/users', 'post');
    expect(routeLayer).toBeTruthy();

    const req = {
      auth: { role: 'System Administrator' },
      body: {
        email: 'no.db@example.org',
        name: 'No DB',
        role: 'Regional_Manager',
        region_ids: [1],
      },
      app: { locals: {} },
    };
    const res = createResponse();

    await invokeRoute(routeLayer, req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'db_unavailable',
      detail: 'Database connection is required to create staff users',
    });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
