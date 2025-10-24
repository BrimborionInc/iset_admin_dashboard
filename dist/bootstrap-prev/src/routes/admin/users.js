// Admin user management routes: delegated creation/disablement using Cognito + DB mapping
const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/authz');
const { resolveAwsCredentials } = require('../../lib/awsCredentials');
const { CognitoIdentityProviderClient, ListUsersCommand, ListUsersInGroupCommand, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminDisableUserCommand, AdminEnableUserCommand, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');

const POOL_ID = process.env.COGNITO_USER_POOL_ID;
const REGION = process.env.AWS_REGION || process.env.COGNITO_REGION;

function getClient() {
  return new CognitoIdentityProviderClient({ region: REGION, credentials: resolveAwsCredentials() });
}

// Guard matrix
const CAN_CREATE = {
  SysAdmin: new Set(['SysAdmin', 'ProgramAdmin', 'RegionalCoordinator', 'Adjudicator']),
  ProgramAdmin: new Set(['ProgramAdmin', 'RegionalCoordinator', 'Adjudicator']),
  RegionalCoordinator: new Set(['Adjudicator']),
  Adjudicator: new Set(),
};

function normalizeRoleKey(role) {
  if (!role) return null;
  const cleaned = String(role).trim();
  const slug = cleaned.toLowerCase().replace(/[\s_-]+/g, '');
  switch (slug) {
    case 'sysadmin':
    case 'systemadministrator':
    case 'systemadmin':
      return 'SysAdmin';
    case 'programadmin':
    case 'programadministrator':
      return 'ProgramAdmin';
    case 'regionalcoordinator':
      return 'RegionalCoordinator';
    case 'adjudicator':
      return 'Adjudicator';
    default:
      return cleaned;
  }
}

function canCreateRole(actorKey, targetKey) {
  const set = CAN_CREATE[actorKey];
  return !!set && set.has(targetKey);
}

const AUTH_ENABLED = String(process.env.AUTH_PROVIDER || 'none').toLowerCase() === 'cognito';

// GET /admin/users - list administrative users (Cognito groups)
// Response: [{ username, email, role, status, regionId, mfa, lastSignIn }]
router.get('/users', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().toLowerCase();
    // If no Cognito configured, return a static mock so UI can integrate early
    if (!POOL_ID || !REGION || process.env.AUTH_PROVIDER !== 'cognito') {
      let users = [
        { username: 'alice@example.org', email: 'alice@example.org', role: 'SysAdmin', status: 'CONFIRMED', regionId: null, mfa: true, lastSignIn: '2025-08-20T14:10:00Z', createdAt: '2025-05-01T10:00:00Z' },
        { username: 'bob@example.org', email: 'bob@example.org', role: 'ProgramAdmin', status: 'FORCE_CHANGE_PASSWORD', regionId: null, mfa: false, lastSignIn: null, createdAt: '2025-08-15T12:00:00Z' },
        { username: 'carol.rc.1@example.org', email: 'carol.rc.1@example.org', role: 'RegionalCoordinator', status: 'CONFIRMED', regionId: 1, mfa: true, lastSignIn: '2025-08-23T09:01:00Z', createdAt: '2025-07-20T09:30:00Z' },
        { username: 'dave.adj.1@example.org', email: 'dave.adj.1@example.org', role: 'Adjudicator', status: 'DISABLED', regionId: 1, mfa: false, lastSignIn: '2025-07-29T11:30:00Z', createdAt: '2025-06-18T11:30:00Z' }
      ];
      if (q) users = users.filter(u => [u.username, u.email, u.role].some(v => v.toLowerCase().includes(q)));
      return res.json({ source: 'mock', users });
    }

    const client = getClient();
    // New approach: build user list ONLY from ListUsersInGroup (avoids needing cognito-idp:ListUsers permission).
    // If ListUsers is permitted we can optionally enrich, but it's no longer required.
    const groups = ['SysAdmin','ProgramAdmin','RegionalCoordinator','Adjudicator'];
    const ROLE_RANK = { SysAdmin: 4, ProgramAdmin: 3, RegionalCoordinator: 2, Adjudicator: 1 };
    const userMap = new Map(); // username -> user object
    for (const g of groups) {
      try {
        const resp = await client.send(new ListUsersInGroupCommand({ UserPoolId: POOL_ID, GroupName: g }));
        for (const u of resp.Users || []) {
          const attr = Object.fromEntries((u.Attributes||[]).map(a => [a.Name, a.Value]));
          const existing = userMap.get(u.Username);
            const candidate = {
              username: u.Username,
              email: attr.email || u.Username,
              role: g,
              status: u.UserStatus || 'UNKNOWN',
              regionId: attr['custom:region_id'] ? Number(attr['custom:region_id']) : null,
              mfa: !!u.MFAOptions && u.MFAOptions.length > 0,
              lastSignIn: u.UserLastModifiedDate ? new Date(u.UserLastModifiedDate).toISOString() : null,
              createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : null
            };
            if (!existing) {
              userMap.set(u.Username, candidate);
            } else {
              // If user appears in multiple admin groups, keep the highest-ranked role.
              if ((ROLE_RANK[candidate.role]||0) > (ROLE_RANK[existing.role]||0)) {
                userMap.set(u.Username, { ...existing, role: candidate.role });
              }
            }
        }
      } catch (e) { /* ignore missing group or permission issues per-group */ }
    }
    let users = Array.from(userMap.values());

    // Optional enrichment if ListUsers allowed (adds any users that might have a role assigned but not returned above â€“ rare) / or refresh attributes.
    try {
      const listResp = await client.send(new ListUsersCommand({ UserPoolId: POOL_ID, Limit: 60 }));
      for (const u of listResp.Users || []) {
        if (!userMap.has(u.Username)) continue; // only update known admin users
        const attr = Object.fromEntries((u.Attributes||[]).map(a => [a.Name, a.Value]));
        const existing = userMap.get(u.Username);
        userMap.set(u.Username, {
          ...existing,
          email: attr.email || existing.email,
          status: u.UserStatus || existing.status,
          regionId: attr['custom:region_id'] ? Number(attr['custom:region_id']) : existing.regionId,
          mfa: !!u.MFAOptions && u.MFAOptions.length > 0,
          lastSignIn: u.UserLastModifiedDate ? new Date(u.UserLastModifiedDate).toISOString() : existing.lastSignIn,
          createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : existing.createdAt
        });
      }
      users = Array.from(userMap.values());
    } catch (enrichErr) {
      if (/not authorized to perform: cognito-idp:ListUsers/i.test(enrichErr?.message || '')) {
        // Silently ignore missing ListUsers permission (now optional)
      } else {
        // Non-authorization errors in enrichment phase are logged but not fatal.
        console.warn('[admin-users] Optional ListUsers enrichment failed:', enrichErr.message, 'AWS_ACCESS_KEY_ID=' + (process.env.AWS_ACCESS_KEY_ID || 'missing'), 'AWS_SECRET_ACCESS_KEY=' + (process.env.AWS_SECRET_ACCESS_KEY || 'missing'));
      }
    }

    const filtered = q ? users.filter(u => [u.username, u.email, u.role].some(v => v && v.toLowerCase().includes(q))) : users;
    return res.json({ source: 'cognito', enriched: filtered.length === users.length, users: filtered });
  } catch (e) {
    const msg = e?.message || '';
    if (/not authorized to perform: cognito-idp:ListUsers/i.test(msg)) {
      return res.status(503).json({
        error: 'cognito_access_denied',
        detail: 'Backend AWS credentials lack permission cognito-idp:ListUsers (now optional) or ListUsersInGroup (required).',
        hint: 'Grant cognito-idp:ListUsersInGroup and related admin actions to see users.',
        users: []
      });
    }
    res.status(500).json({ error: 'Failed to list users', detail: msg });
  }
});

// In dev (auth disabled) short-circuit create/modify routes with mock behavior
if (!AUTH_ENABLED) {
  console.log('[admin-users] AUTH disabled â€“ using mock mutation endpoints');
  router.post('/users', (req, res) => {
    console.log('[admin-users][mock] create user body=', req.body);
    return res.status(201).json({ message: 'Mock user created (auth disabled)' });
  });
  router.patch('/users/:username/disable', (req, res) => {
    console.log('[admin-users][mock] disable', req.params.username);
    return res.json({ message: 'Mock user disabled (auth disabled)' });
  });
  router.patch('/users/:username/enable', (req, res) => {
    console.log('[admin-users][mock] enable', req.params.username);
    return res.json({ message: 'Mock user enabled (auth disabled)' });
  });
  router.patch('/users/:username/attributes', (req, res) => {
    console.log('[admin-users][mock] attributes update', req.params.username, 'body=', req.body);
    return res.json({ message: 'Mock attributes updated (auth disabled)' });
  });
  router.patch('/users/:username/role', (req, res) => {
    console.log('[admin-users][mock] role change', req.params.username, '->', req.body?.newRole);
    return res.json({ message: 'Mock role updated (auth disabled)' });
  });
  router.delete('/users/:username/role', (req, res) => {
    console.log('[admin-users][mock] role removal', req.params.username);
    return res.json({ message: 'Mock role removed (auth disabled)' });
  });
  router.post('/users/:username/resend-invite', (req, res) => {
    console.log('[admin-users][mock] resend invite', req.params.username);
    return res.json({ message: 'Mock invite resent (auth disabled)' });
  });
  router.patch('/users/:username/force-reset', (req, res) => {
    console.log('[admin-users][mock] force reset', req.params.username);
    return res.json({ message: 'Mock password reset forced (auth disabled)' });
  });
} else {
  // Real (Cognito) endpoints only when auth enabled
  router.post('/users', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
    try {
      const actor = req.auth;
      const { email, role, region_id, user_id, suppressInvite } = req.body || {};
      const actorKey = normalizeRoleKey(actor?.role);
      const targetKey = normalizeRoleKey(role);
      if (!email || !targetKey) return res.status(400).json({ error: 'email and role are required' });
      if (!actorKey) return res.status(403).json({ error: 'Forbidden' });
      if (!canCreateRole(actorKey, targetKey)) return res.status(403).json({ error: 'Not allowed to create this role' });
      if (targetKey !== 'SysAdmin' && targetKey !== 'ProgramAdmin' && !Number.isFinite(region_id)) return res.status(400).json({ error: 'region_id required for regional roles' });

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
        // If suppressInvite is true we keep legacy behavior (no Cognito email). Otherwise allow
        // Cognito to send its standard invitation email with a temporary password.
        DesiredDeliveryMediums: ['EMAIL'],
        ...(suppressInvite ? { MessageAction: 'SUPPRESS' } : {}),
      });
      const createResp = await client.send(createCmd);
      await client.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL_ID, Username: email, GroupName: targetKey }));
      res.status(201).json({
        message: 'User created',
        cognito: createResp?.User?.Username || email,
        inviteEmail: suppressInvite ? 'suppressed' : 'sent'
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to create user', detail: e?.message });
    }
  });

  router.patch('/users/:username/disable', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
    try {
      const actor = req.auth;
      const { role } = req.body || {};
      const username = req.params.username;
      const actorKey = normalizeRoleKey(actor?.role);
      const targetKey = normalizeRoleKey(role);
      console.log('[admin-users][disable] actor=', actor?.role, 'body.role=', role, 'headers.x-dev-bypass=', req.get('x-dev-bypass'));
      // Dev bypass inside auth-enabled mode (simulate success without Cognito)
      if (req.get('x-dev-bypass')) {
        return res.json({ message: 'Dev bypass: user disabled (mock)' });
      }
      if (!targetKey) return res.status(400).json({ error: 'role required' });
      if (!actorKey) return res.status(403).json({ error: 'Forbidden' });
      if (!canCreateRole(actorKey, targetKey) && actorKey !== 'SysAdmin') return res.status(403).json({ error: 'Forbidden' });
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
      console.log('[admin-users][enable] actor=', req.auth?.role, 'headers.x-dev-bypass=', req.get('x-dev-bypass'));
      if (req.get('x-dev-bypass')) {
        return res.json({ message: 'Dev bypass: user enabled (mock)' });
      }
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

  // Change role (remove from current group, add to target)
  router.patch('/users/:username/role', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
    try {
      const actor = req.auth;
      const username = req.params.username;
      const { newRole, currentRole } = req.body || {};
      const actorKey = normalizeRoleKey(actor?.role);
      const newRoleKey = normalizeRoleKey(newRole);
      const currentRoleKey = normalizeRoleKey(currentRole);
      if (!newRoleKey || !currentRoleKey) return res.status(400).json({ error: 'newRole and currentRole required' });
      if (!actorKey) return res.status(403).json({ error: 'Forbidden' });
      if (!canCreateRole(actorKey, newRoleKey) && actorKey !== 'SysAdmin') return res.status(403).json({ error: 'Forbidden' });
      // NOTE: For full correctness we would call AdminRemoveUserFromGroup for current role and AdminAddUserToGroup for new role.
      const { AdminRemoveUserFromGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const client = getClient();
      try {
        await client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: POOL_ID, Username: username, GroupName: currentRoleKey }));
      } catch (e) { /* ignore removal failures */ }
      await client.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL_ID, Username: username, GroupName: newRoleKey }));
      res.json({ message: 'Role updated' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to change role', detail: e?.message });
    }
  });

  router.delete('/users/:username/role', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
    try {
      const username = req.params.username;
      if (req.get('x-dev-bypass')) return res.json({ message: 'Dev bypass: role removed (mock)' });
      const { ListGroupsForUserCommand, AdminRemoveUserFromGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const client = getClient();
      const groupsResp = await client.send(new ListGroupsForUserCommand({ Username: username, UserPoolId: POOL_ID }));
      const targetGroup = (groupsResp.Groups||[]).find(g => ['SysAdmin','ProgramAdmin','RegionalCoordinator','Adjudicator'].includes(g.GroupName));
      if (!targetGroup) return res.status(404).json({ error: 'No admin role group to remove' });
      await client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: POOL_ID, Username: username, GroupName: targetGroup.GroupName }));
      res.json({ message: 'Role removed' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to remove role', detail: e?.message });
    }
  });

  router.post('/users/:username/resend-invite', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
    try {
      // There is no direct "resend invite" if MessageAction SUPPRESS was used; placeholder for integration with custom email flow.
      if (req.get('x-dev-bypass')) return res.json({ message: 'Dev bypass: invite resent (mock)' });
      res.json({ message: 'Invite resend placeholder (configure SES/Lambda trigger)' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to resend invite', detail: e?.message });
    }
  });

  // Force password reset (sets status to FORCE_CHANGE_PASSWORD)
  router.patch('/users/:username/force-reset', requireRole('SysAdmin', 'ProgramAdmin', 'RegionalCoordinator'), async (req, res) => {
    try {
      if (req.get('x-dev-bypass')) return res.json({ message: 'Dev bypass: password reset forced (mock)' });
      const { AdminResetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const username = req.params.username;
      const client = getClient();
      await client.send(new AdminResetUserPasswordCommand({ UserPoolId: POOL_ID, Username: username }));
      res.json({ message: 'Password reset forced' });
    } catch (e) {
      res.status(500).json({ error: 'Failed to force password reset', detail: e?.message });
    }
  });
}

module.exports = router;


