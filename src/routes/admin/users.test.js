const mockSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  class AdminListGroupsForUserCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class AdminGetUserCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class CognitoIdentityProviderClient {
    send(command) {
      return mockSend(command);
    }
  }

  return {
    CognitoIdentityProviderClient,
    ListUsersCommand: class {},
    ListUsersInGroupCommand: class {},
    AdminListGroupsForUserCommand,
    AdminCreateUserCommand: class {},
    AdminAddUserToGroupCommand: class {},
    AdminRemoveUserFromGroupCommand: class {},
    AdminDisableUserCommand: class {},
    AdminEnableUserCommand: class {},
    AdminGetUserCommand,
    AdminResetUserPasswordCommand: class {},
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
