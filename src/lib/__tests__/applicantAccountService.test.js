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
});
