'use strict';

const REMOTE_IDENTITY_MARKER = '@@PATH_TEST_INSTANCE_AWS_IDENTITY@@';

async function discoverVerifiedTestInstanceAwsIdentity({
  expectedAccountId,
  issueCommand,
  waitForCommand,
}) {
  if (!/^\d{12}$/u.test(String(expectedAccountId || ''))) {
    throw new Error('Expected TEST AWS account ID is invalid.');
  }
  if (typeof issueCommand !== 'function' || typeof waitForCommand !== 'function') {
    throw new Error('TEST instance identity discovery callbacks are required.');
  }
  const commandId = issueCommand([
    'set -euo pipefail',
    `echo ${REMOTE_IDENTITY_MARKER}`,
    'aws sts get-caller-identity --output json',
  ], 'PATH TEST instance AWS identity discovery');
  const invocation = await Promise.resolve(waitForCommand(commandId));
  if (invocation?.Status !== 'Success') {
    throw new Error(`TEST instance AWS identity discovery failed with status ${invocation?.Status || 'unknown'}.`);
  }
  const stdout = String(invocation?.Stdout || '');
  const markerIndex = stdout.lastIndexOf(REMOTE_IDENTITY_MARKER);
  if (markerIndex < 0) throw new Error('TEST instance AWS identity discovery emitted no marker.');
  let identity;
  try {
    identity = JSON.parse(stdout.slice(markerIndex + REMOTE_IDENTITY_MARKER.length).trim());
  } catch (_) {
    throw new Error('TEST instance AWS identity discovery emitted invalid JSON.');
  }
  const account = String(identity?.Account || '');
  const arn = String(identity?.Arn || '');
  const userId = String(identity?.UserId || '');
  const validArn = arn.startsWith(`arn:aws:iam::${expectedAccountId}:`) ||
    arn.startsWith(`arn:aws:sts::${expectedAccountId}:`);
  if (account !== expectedAccountId || !validArn || !userId) {
    throw new Error(`TEST instance AWS identity was incomplete or outside account ${expectedAccountId}.`);
  }
  return { account, arn, userId, commandId };
}

module.exports = {
  REMOTE_IDENTITY_MARKER,
  discoverVerifiedTestInstanceAwsIdentity,
};
