// Admin user management routes: delegated creation/disablement using Cognito + DB mapping
const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/authz');
const { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminDisableUserCommand, AdminEnableUserCommand, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');

const POOL_ID = process.env.COGNITO_USER_POOL_ID;
const REGION = process.env.AWS_REGION || process.env.COGNITO_REGION;

function getClient() {
  return new CognitoIdentityProviderClient({ region: REGION });
}

// Guard matrix
const CAN_CREATE = {
  SysAdmin: new Set(['SysAdmin', 'ProgramAdmin']),
  ProgramAdmin: new Set(['RegionalCoordinator']),
  RegionalCoordinator: new Set(['Adjudicator']),
};

function canCreateRole(actorRole, targetRole) {
  const set = CAN_CREATE[actorRole];
  return !!set && set.has(targetRole);
}

router.post('/users', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
  try {
    const actor = req.auth;
    const { email, role, region_id, user_id } = req.body || {};
    if (!email || !role) return res.status(400).json({ error: 'email and role are required' });
    if (!canCreateRole(actor.role, role)) return res.status(403).json({ error: 'Not allowed to create this role' });
    if (role !== 'SysAdmin' && role !== 'ProgramAdmin' && !Number.isFinite(region_id)) return res.status(400).json({ error: 'region_id required for regional roles' });

    const client = getClient();
    const createCmd = new AdminCreateUserCommand({
      UserPoolId: POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        ...(Number.isFinite(region_id) ? [{ Name: 'custom:region_id', Value: String(region_id) }] : []),
        ...(user_id ? [{ Name: 'custom:user_id', Value: String(user_id) }] : []),
      ],
      DesiredDeliveryMediums: ['EMAIL'],
      MessageAction: 'SUPPRESS', // using SES/own flow if needed
    });
    const createResp = await client.send(createCmd);

    // Add to group for role
    await client.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL_ID, Username: email, GroupName: role }));

    // Optionally: send custom email via SES here (omitted for brevity)

    res.status(201).json({ message: 'User created', cognito: createResp?.User?.Username || email });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create user', detail: e?.message });
  }
});

router.patch('/users/:username/disable', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
  try {
    const actor = req.auth;
    const { role } = req.body || {};
    const username = req.params.username;
    if (!role) return res.status(400).json({ error: 'role required' });
    if (!canCreateRole(actor.role, role) && actor.role !== 'SysAdmin') return res.status(403).json({ error: 'Forbidden' });

    const client = getClient();
    await client.send(new AdminDisableUserCommand({ UserPoolId: POOL_ID, Username: username }));
    res.json({ message: 'User disabled' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to disable user', detail: e?.message });
  }
});

router.patch('/users/:username/enable', requireRole('SysAdmin', 'ProgramAdmin'), async (req, res) => {
  try {
    const username = req.params.username;
    const client = getClient();
    await client.send(new AdminEnableUserCommand({ UserPoolId: POOL_ID, Username: username }));
    res.json({ message: 'User enabled' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to enable user', detail: e?.message });
  }
});

router.patch('/users/:username/attributes', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
  try {
    const { region_id, user_id } = req.body || {};
    const username = req.params.username;
    const attrs = [];
    if (Number.isFinite(region_id)) attrs.push({ Name: 'custom:region_id', Value: String(region_id) });
    if (user_id) attrs.push({ Name: 'custom:user_id', Value: String(user_id) });
    if (!attrs.length) return res.status(400).json({ error: 'No attributes to update' });

    const client = getClient();
    await client.send(new AdminUpdateUserAttributesCommand({ UserPoolId: POOL_ID, Username: username, UserAttributes: attrs }));
    res.json({ message: 'User attributes updated' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update attributes', detail: e?.message });
  }
});

module.exports = router;
