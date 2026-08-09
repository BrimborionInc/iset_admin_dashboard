const {
  REMOTE_IDENTITY_MARKER,
  discoverVerifiedTestInstanceAwsIdentity,
} = require('../scripts/lib/test-instance-aws-identity');

describe('TEST instance AWS identity discovery', () => {
  test('accepts the currently assumed TEST instance role and returns the exact ARN', async () => {
    const issueCommand = jest.fn(() => 'command-1');
    const waitForCommand = jest.fn(() => ({
      Status: 'Success',
      Stdout: `${REMOTE_IDENTITY_MARKER}\n${JSON.stringify({
        Account: '124355655255',
        Arn: 'arn:aws:sts::124355655255:assumed-role/nwac-test-app-role/i-0123456789',
        UserId: 'AROATEST:i-0123456789',
      })}\n`,
    }));

    const identity = await discoverVerifiedTestInstanceAwsIdentity({
      expectedAccountId: '124355655255',
      issueCommand,
      waitForCommand,
    });

    expect(identity.arn).toBe('arn:aws:sts::124355655255:assumed-role/nwac-test-app-role/i-0123456789');
    expect(issueCommand).toHaveBeenCalledTimes(1);
    expect(waitForCommand).toHaveBeenCalledWith('command-1');
  });

  test('rejects an identity outside the exact TEST account', async () => {
    await expect(discoverVerifiedTestInstanceAwsIdentity({
      expectedAccountId: '124355655255',
      issueCommand: () => 'command-2',
      waitForCommand: () => ({
        Status: 'Success',
        Stdout: `${REMOTE_IDENTITY_MARKER}\n${JSON.stringify({
          Account: '468278742295',
          Arn: 'arn:aws:sts::468278742295:assumed-role/prod/i-prod',
          UserId: 'PROD:i-prod',
        })}`,
      }),
    })).rejects.toThrow('outside account 124355655255');
  });
});
