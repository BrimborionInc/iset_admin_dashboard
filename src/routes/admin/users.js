// Admin user management routes: delegated creation/disablement using Cognito + DB mapping
const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/authz');
const { resolveAwsCredentials } = require('../../lib/awsCredentials');
const { CognitoIdentityProviderClient, ListUsersCommand, ListUsersInGroupCommand, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminDisableUserCommand, AdminEnableUserCommand, AdminUpdateUserAttributesCommand, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');

const POOL_ID = process.env.COGNITO_STAFF_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID;
const REGION = process.env.AWS_REGION || process.env.COGNITO_REGION;

function buildConfigError() {
  const error = new Error('Cognito staff user management is not configured');
  error.statusCode = 503;
  error.code = 'cognito_not_configured';
  return error;
}

function getClient() {
  if (!POOL_ID || !REGION) {
    throw buildConfigError();
  }
  const credentials = resolveAwsCredentials();
  const config = { region: REGION };
  if (credentials) config.credentials = credentials;
  return new CognitoIdentityProviderClient(config);
}

function sendRouteError(res, err, fallbackError) {
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ error: err.code || fallbackError, detail: err.message });
  }
  return res.status(500).json({ error: fallbackError, detail: err?.message });
}

function hasMfaEnabled(user) {
  if (!user) return false;
  const mfaList = Array.isArray(user.UserMFASettingList) ? user.UserMFASettingList : [];
  if (mfaList.length) return true;
  const preferred = user.PreferredMfaSetting || user.PreferredMFASetting;
  if (preferred && String(preferred).toLowerCase() !== 'nomfa') return true;
  const legacyOptions = Array.isArray(user.MFAOptions) ? user.MFAOptions : [];
  return legacyOptions.length > 0;
}

// Guard matrix
const CAN_CREATE = {
  System_Administrator: new Set(['System_Administrator', 'NWAC_Administrator', 'Regional_Manager', 'ISET_Coordinator']),
  NWAC_Administrator: new Set(['NWAC_Administrator', 'Regional_Manager', 'ISET_Coordinator']),
  Regional_Manager: new Set(['ISET_Coordinator']),
  ISET_Coordinator: new Set(),
};

function normalizeRoleKey(role) {
  if (!role) return null;
  const cleaned = String(role).trim();
  const slug = cleaned.toLowerCase().replace(/[\s_-]+/g, '');
  switch (slug) {
    case 'systemadministrator':
      return 'System_Administrator';
    case 'nwacadministrator':
      return 'NWAC_Administrator';
    case 'regionalmanager':
      return 'Regional_Manager';
    case 'isetcoordinator':
      return 'ISET_Coordinator';
    default:
      return cleaned;
  }
}

function normalizeRegionIdList(list) {
  if (!Array.isArray(list)) return [];
  const normalized = [];
  for (const value of list) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) normalized.push(id);
  }
  return Array.from(new Set(normalized));
}

function resolvePrimaryRegionId(regionIds, regionId) {
  const list = normalizeRegionIdList(regionIds);
  if (list.length) return list[0];
  const numeric = Number(regionId);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

async function fetchStaffProfileIdBySub(pool, cognitoSub) {
  if (!pool || !cognitoSub) return null;
  try {
    const [[row]] = await pool.query('SELECT id FROM staff_profiles WHERE cognito_sub = ? LIMIT 1', [cognitoSub]);
    return row?.id || null;
  } catch (err) {
    return null;
  }
}

async function replaceStaffRegionAssignments(pool, staffProfileId, regionIds) {
  if (!pool) return;
  const ids = normalizeRegionIdList(regionIds);
  if (!staffProfileId) return;
  try {
    await pool.query('DELETE FROM staff_region WHERE staff_profile_id = ?', [staffProfileId]);
    if (!ids.length) return;
    const values = ids.map(id => [staffProfileId, id]);
    await pool.query('INSERT INTO staff_region (staff_profile_id, region_id) VALUES ?', [values]);
  } catch (err) {
    if (/ER_NO_SUCH_TABLE|ER_BAD_FIELD_ERROR/i.test(err?.code || err?.message || '')) return;
    throw err;
  }
}

function canCreateRole(actorKey, targetKey) {
  const set = CAN_CREATE[actorKey];
  return !!set && set.has(targetKey);
}

function mapAdminRoleKeyToStaffPrimaryRole(roleKey) {
  switch (roleKey) {
    case 'System_Administrator':
      return 'System Administrator';
    case 'NWAC_Administrator':
      return 'NWAC Administrator';
    case 'Regional_Manager':
      return 'Regional Manager';
    case 'ISET_Coordinator':
      return 'ISET Coordinator';
    default:
      return null;
  }
}

function getDbPoolFromRequest(req) {
  const pool = req?.app?.locals?.pool;
  return pool && typeof pool.query === 'function' ? pool : null;
}

async function listUsersInGroupAll(client, groupName) {
  const users = [];
  let nextToken = null;

  do {
    const response = await client.send(
      new ListUsersInGroupCommand({
        UserPoolId: POOL_ID,
        GroupName: groupName,
        ...(nextToken ? { NextToken: nextToken } : {}),
      })
    );
    users.push(...(response?.Users || []));
    nextToken = response?.NextToken || null;
  } while (nextToken);

  return users;
}

async function listUserPoolUsersAll(client) {
  const users = [];
  let paginationToken = null;

  do {
    const response = await client.send(
      new ListUsersCommand({
        UserPoolId: POOL_ID,
        ...(paginationToken ? { PaginationToken: paginationToken } : {}),
      })
    );
    users.push(...(response?.Users || []));
    paginationToken = response?.PaginationToken || null;
  } while (paginationToken);

  return users;
}

async function loadAdminUsers({ pool = null, q = '' } = {}) {
  const query = (q || '').toString().toLowerCase();
  const client = getClient();
  const groups = ['System_Administrator', 'NWAC_Administrator', 'Regional_Manager', 'ISET_Coordinator'];
  const roleRank = { System_Administrator: 4, NWAC_Administrator: 3, Regional_Manager: 2, ISET_Coordinator: 1 };
  const userMap = new Map();

  for (const groupName of groups) {
    try {
      const groupUsers = await listUsersInGroupAll(client, groupName);
      for (const user of groupUsers) {
        const attr = Object.fromEntries((user.Attributes || []).map(a => [a.Name, a.Value]));
        const cognitoSub = attr.sub || attr['sub'] || null;
        const existing = userMap.get(user.Username);
        const candidate = {
          username: user.Username,
          email: attr.email || user.Username,
          role: groupName,
          status: user.UserStatus || 'UNKNOWN',
          regionId: attr['custom:region_id'] ? Number(attr['custom:region_id']) : null,
          regionIds: null,
          cognitoSub,
          mfa: hasMfaEnabled(user),
          lastSignIn: user.UserLastModifiedDate ? new Date(user.UserLastModifiedDate).toISOString() : null,
          createdAt: user.UserCreateDate ? new Date(user.UserCreateDate).toISOString() : null,
        };

        if (!existing) {
          userMap.set(user.Username, candidate);
          continue;
        }

        if ((roleRank[candidate.role] || 0) > (roleRank[existing.role] || 0)) {
          userMap.set(user.Username, { ...existing, role: candidate.role });
        }
      }
    } catch (_) {
      // Ignore per-group permission or missing-group issues.
    }
  }

  let users = Array.from(userMap.values());

  try {
    const allUsers = await listUserPoolUsersAll(client);
    for (const user of allUsers) {
      if (!userMap.has(user.Username)) continue;
      const attr = Object.fromEntries((user.Attributes || []).map(a => [a.Name, a.Value]));
      const existing = userMap.get(user.Username);
      const cognitoSub = attr.sub || attr['sub'] || existing.cognitoSub || null;
      userMap.set(user.Username, {
        ...existing,
        email: attr.email || existing.email,
        status: user.UserStatus || existing.status,
        regionId: attr['custom:region_id'] ? Number(attr['custom:region_id']) : existing.regionId,
        cognitoSub,
        mfa: hasMfaEnabled(user),
        lastSignIn: user.UserLastModifiedDate ? new Date(user.UserLastModifiedDate).toISOString() : existing.lastSignIn,
        createdAt: user.UserCreateDate ? new Date(user.UserCreateDate).toISOString() : existing.createdAt,
      });
    }
    users = Array.from(userMap.values());
  } catch (enrichErr) {
    if (!/not authorized to perform: cognito-idp:ListUsers/i.test(enrichErr?.message || '')) {
      console.warn('[admin-users] Optional ListUsers enrichment failed:', enrichErr.message);
    }
  }

  if (users.length) {
    try {
      for (const user of users) {
        if (user.mfa || !user.username) continue;
        const detail = await client.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: user.username }));
        if (detail && hasMfaEnabled(detail)) {
          user.mfa = true;
        }
      }
    } catch (detailErr) {
      if (!/not authorized to perform: cognito-idp:AdminGetUser/i.test(detailErr?.message || '')) {
        console.warn('[admin-users] MFA enrichment failed:', detailErr?.message || detailErr);
      }
    }
  }

  if (pool && users.length) {
    try {
      const subs = users.map(user => user.cognitoSub).filter(Boolean);
      let profiles = [];
      if (subs.length) {
        const placeholders = subs.map(() => '?').join(',');
        [profiles] = await pool.query(
          `SELECT id, cognito_sub, email, region_id FROM staff_profiles WHERE cognito_sub IN (${placeholders})`,
          subs
        );
      }
      const profileBySub = new Map((profiles || []).map(row => [row.cognito_sub, row]));
      const profileIds = (profiles || []).map(row => row.id).filter(Boolean);
      let regionRows = [];
      if (profileIds.length) {
        const placeholders = profileIds.map(() => '?').join(',');
        try {
          [regionRows] = await pool.query(
            `SELECT staff_profile_id, region_id FROM staff_region WHERE staff_profile_id IN (${placeholders})`,
            profileIds
          );
        } catch (err) {
          if (!/ER_NO_SUCH_TABLE|ER_BAD_FIELD_ERROR/i.test(err?.code || err?.message || '')) throw err;
        }
      }
      const regionMap = new Map();
      (regionRows || []).forEach(row => {
        if (!row) return;
        const staffId = row.staff_profile_id;
        const list = regionMap.get(staffId) || [];
        list.push(row.region_id);
        regionMap.set(staffId, list);
      });

      users = users.map(user => {
        const profile = user.cognitoSub ? profileBySub.get(user.cognitoSub) : null;
        const staffId = profile?.id || null;
        const regionIds = staffId && regionMap.has(staffId)
          ? normalizeRegionIdList(regionMap.get(staffId))
          : [];
        const regionId = Number.isFinite(user.regionId)
          ? user.regionId
          : (Number.isFinite(profile?.region_id) ? Number(profile.region_id) : (regionIds[0] || null));
        return {
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          regionId,
          regionIds: regionIds.length ? regionIds : null,
          mfa: user.mfa,
          lastSignIn: user.lastSignIn,
          createdAt: user.createdAt,
        };
      });
    } catch (err) {
      console.warn('[admin-users] staff region enrichment failed:', err?.message || err);
    }
  } else {
    users = users.map(user => ({
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      regionId: user.regionId ?? null,
      regionIds: user.regionIds ?? null,
      mfa: user.mfa,
      lastSignIn: user.lastSignIn,
      createdAt: user.createdAt,
    }));
  }

  if (!query) {
    return users;
  }

  return users.filter(user => [user.username, user.email, user.role].some(value => value && value.toLowerCase().includes(query)));
}

async function upsertStaffProfile(pool, { cognitoSub, email, name, displayName, primaryRole, regionId }) {
  if (!pool) return;
  if (!cognitoSub || !email) return;

  const safeName = typeof name === 'string' ? name.trim() : '';
  const safeDisplay = typeof displayName === 'string' ? displayName.trim() : '';
  const finalName = safeName || safeDisplay || email;
  const finalDisplay = safeDisplay || safeName || email;
  const normalizedRegionId = Number.isFinite(regionId) ? regionId : null;

  await pool.query(
    `INSERT INTO staff_profiles (cognito_sub, email, name, display_name, primary_role, region_id)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        name = VALUES(name),
        display_name = VALUES(display_name),
        primary_role = VALUES(primary_role),
        region_id = VALUES(region_id)`,
    [cognitoSub, email, finalName, finalDisplay, primaryRole, normalizedRegionId]
  );
}

// GET /admin/users - list administrative users (Cognito groups)
// Response: [{ username, email, role, status, regionId, mfa, lastSignIn }]
router.get('/users', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager', 'ISET Coordinator'), async (req, res) => {
  try {
    const users = await loadAdminUsers({
      pool: getDbPoolFromRequest(req),
      q: req.query.q || '',
    });
    return res.json({ source: 'cognito', users });
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
    return sendRouteError(res, e, 'Failed to list users');
  }
});

router.get('/users/summary', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager', 'ISET Coordinator'), async (req, res) => {
  try {
    const users = await loadAdminUsers({
      pool: getDbPoolFromRequest(req),
    });
    const total = users.length || 0;
    const disabled = users.filter(user => user.status === 'DISABLED').length;
    const pending = users.filter(user => user.status === 'FORCE_CHANGE_PASSWORD').length;
    const mfaEnabled = users.filter(user => user.mfa).length;
    const mfaMissing = total - mfaEnabled;
    const neverLoggedIn = users.filter(user => !user.lastSignIn).length;

    return res.json({
      source: 'cognito',
      metrics: {
        total,
        disabled,
        pending,
        mfaEnabled,
        mfaMissing,
        neverLoggedIn,
      },
    });
  } catch (e) {
    const msg = e?.message || '';
    if (/not authorized to perform: cognito-idp:ListUsers/i.test(msg)) {
      return res.status(503).json({
        error: 'cognito_access_denied',
        detail: 'Backend AWS credentials lack permission cognito-idp:ListUsers (now optional) or ListUsersInGroup (required).',
        hint: 'Grant cognito-idp:ListUsersInGroup and related admin actions to see users.',
        metrics: null,
      });
    }
    return sendRouteError(res, e, 'Failed to summarize users');
  }
});

router.post('/users', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager'), async (req, res) => {
    try {
      const actor = req.auth;
      const { email, role, region_id, region_ids, user_id, suppressInvite, name, display_name } = req.body || {};
      const actorKey = normalizeRoleKey(actor?.role);
      const targetKey = normalizeRoleKey(role);
      if (!email || !targetKey) return res.status(400).json({ error: 'email and role are required' });
      if (!actorKey) return res.status(403).json({ error: 'Forbidden' });
      if (!canCreateRole(actorKey, targetKey)) return res.status(403).json({ error: 'Not allowed to create this role' });
      let regionIds = normalizeRegionIdList(region_ids);
      const primaryRegionId = resolvePrimaryRegionId(regionIds, region_id);
      if (!regionIds.length && Number.isFinite(primaryRegionId)) regionIds = [primaryRegionId];
      if (targetKey !== 'System_Administrator' && targetKey !== 'NWAC_Administrator' && !Number.isFinite(primaryRegionId)) {
        return res.status(400).json({ error: 'region_id required for regional roles' });
      }

      const client = getClient();
      const createCmd = new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          ...(Number.isFinite(primaryRegionId) ? [{ Name: 'custom:region_id', Value: String(primaryRegionId) }] : []),
          ...(user_id ? [{ Name: 'custom:user_id', Value: String(user_id) }] : []),
        ],
        // If suppressInvite is true we keep legacy behavior (no Cognito email). Otherwise allow
        // Cognito to send its standard invitation email with a temporary password.
        DesiredDeliveryMediums: ['EMAIL'],
        ...(suppressInvite ? { MessageAction: 'SUPPRESS' } : {}),
      });
      const createResp = await client.send(createCmd);
      await client.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL_ID, Username: email, GroupName: targetKey }));

      const primaryRole = mapAdminRoleKeyToStaffPrimaryRole(targetKey);
      const pool = getDbPoolFromRequest(req);
      if (pool && primaryRole) {
        const createdAttributes = createResp?.User?.Attributes;
        const attr = Array.isArray(createdAttributes)
          ? Object.fromEntries(createdAttributes.map(a => [a.Name, a.Value]))
          : null;

        let cognitoSub = attr?.sub || null;
        if (!cognitoSub) {
          try {
            const getResp = await client.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email }));
            const attrs = Array.isArray(getResp?.UserAttributes) ? getResp.UserAttributes : [];
            cognitoSub = attrs.find(a => a.Name === 'sub')?.Value || null;
          } catch (e) {
            console.warn('[admin-users] staff_profiles upsert skipped (AdminGetUser failed):', e?.message || e);
          }
        }

        if (cognitoSub) {
          try {
            await upsertStaffProfile(pool, {
              cognitoSub,
              email,
              name,
              displayName: display_name,
              primaryRole,
              regionId: Number.isFinite(primaryRegionId) ? Number(primaryRegionId) : null
            });
            const staffProfileId = await fetchStaffProfileIdBySub(pool, cognitoSub);
            if (staffProfileId && regionIds.length) {
              await replaceStaffRegionAssignments(pool, staffProfileId, regionIds);
            }
          } catch (e) {
            console.warn('[admin-users] staff_profiles upsert failed (non-fatal):', e?.message || e);
          }
        } else {
          console.warn('[admin-users] staff_profiles upsert skipped (missing cognito sub for new user)');
        }
      }

      res.status(201).json({
        message: 'User created',
        cognito: createResp?.User?.Username || email,
        inviteEmail: suppressInvite ? 'suppressed' : 'sent'
      });
    } catch (e) {
      return sendRouteError(res, e, 'Failed to create user');
    }
  });

  router.patch('/users/:username/disable', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager'), async (req, res) => {
    try {
      const actor = req.auth;
      const { role } = req.body || {};
      const username = req.params.username;
      const actorKey = normalizeRoleKey(actor?.role);
      const targetKey = normalizeRoleKey(role);
      if (!targetKey) return res.status(400).json({ error: 'role required' });
      if (!actorKey) return res.status(403).json({ error: 'Forbidden' });
      if (!canCreateRole(actorKey, targetKey) && actorKey !== 'System_Administrator') return res.status(403).json({ error: 'Forbidden' });
      const client = getClient();
      await client.send(new AdminDisableUserCommand({ UserPoolId: POOL_ID, Username: username }));
      res.json({ message: 'User disabled' });
    } catch (e) {
      return sendRouteError(res, e, 'Failed to disable user');
    }
  });

  router.patch('/users/:username/enable', requireRole('System Administrator', 'NWAC Administrator'), async (req, res) => {
    try {
      const username = req.params.username;
      const client = getClient();
      await client.send(new AdminEnableUserCommand({ UserPoolId: POOL_ID, Username: username }));
      res.json({ message: 'User enabled' });
    } catch (e) {
      return sendRouteError(res, e, 'Failed to enable user');
    }
  });

  router.patch('/users/:username/attributes', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager'), async (req, res) => {
    try {
      const { region_id, region_ids, user_id } = req.body || {};
      const username = req.params.username;
      let regionIds = normalizeRegionIdList(region_ids);
      const primaryRegionId = resolvePrimaryRegionId(regionIds, region_id);
      if (!regionIds.length && Number.isFinite(primaryRegionId)) regionIds = [primaryRegionId];

      const attrs = [];
      if (Number.isFinite(primaryRegionId)) attrs.push({ Name: 'custom:region_id', Value: String(primaryRegionId) });
      if (user_id) attrs.push({ Name: 'custom:user_id', Value: String(user_id) });

      if (!attrs.length && !regionIds.length) return res.status(400).json({ error: 'No attributes to update' });

      const client = getClient();
      if (attrs.length) {
        await client.send(new AdminUpdateUserAttributesCommand({ UserPoolId: POOL_ID, Username: username, UserAttributes: attrs }));
      }

      const pool = getDbPoolFromRequest(req);
      if (pool && (Number.isFinite(primaryRegionId) || regionIds.length)) {
        try {
          const getResp = await client.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: username }));
          const attr = Object.fromEntries((getResp?.UserAttributes || []).map(a => [a.Name, a.Value]));
          const cognitoSub = attr?.sub || null;
          if (cognitoSub) {
            await pool.query('UPDATE staff_profiles SET region_id = ? WHERE cognito_sub = ?', [Number.isFinite(primaryRegionId) ? Number(primaryRegionId) : null, cognitoSub]);
            const staffProfileId = await fetchStaffProfileIdBySub(pool, cognitoSub);
            if (staffProfileId && regionIds.length) {
              await replaceStaffRegionAssignments(pool, staffProfileId, regionIds);
            }
          }
        } catch (err) {
          console.warn('[admin-users] staff region update failed (non-fatal):', err?.message || err);
        }
      }

      res.json({
        message: 'User attributes updated',
        regionId: Number.isFinite(primaryRegionId) ? Number(primaryRegionId) : null,
        regionIds: regionIds.length ? regionIds : null
      });
    } catch (e) {
      return sendRouteError(res, e, 'Failed to update attributes');
    }
  });

  // Change role (remove from current group, add to target)
  router.patch('/users/:username/role', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager'), async (req, res) => {
    try {
      const actor = req.auth;
      const username = req.params.username;
      const { newRole, currentRole } = req.body || {};
      const actorKey = normalizeRoleKey(actor?.role);
      const newRoleKey = normalizeRoleKey(newRole);
      const currentRoleKey = normalizeRoleKey(currentRole);
      if (!newRoleKey || !currentRoleKey) return res.status(400).json({ error: 'newRole and currentRole required' });
      if (!actorKey) return res.status(403).json({ error: 'Forbidden' });
      if (!canCreateRole(actorKey, newRoleKey) && actorKey !== 'System_Administrator') return res.status(403).json({ error: 'Forbidden' });
      // NOTE: For full correctness we would call AdminRemoveUserFromGroup for current role and AdminAddUserToGroup for new role.
      const { AdminRemoveUserFromGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const client = getClient();
      try {
        await client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: POOL_ID, Username: username, GroupName: currentRoleKey }));
      } catch (e) { /* ignore removal failures */ }
      await client.send(new AdminAddUserToGroupCommand({ UserPoolId: POOL_ID, Username: username, GroupName: newRoleKey }));
      res.json({ message: 'Role updated' });
    } catch (e) {
      return sendRouteError(res, e, 'Failed to change role');
    }
  });

  router.delete('/users/:username/role', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager'), async (req, res) => {
    try {
      const username = req.params.username;
      const { ListGroupsForUserCommand, AdminRemoveUserFromGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const client = getClient();
      const groupsResp = await client.send(new ListGroupsForUserCommand({ Username: username, UserPoolId: POOL_ID }));
      const targetGroup = (groupsResp.Groups||[]).find(g => ['System_Administrator','NWAC_Administrator','Regional_Manager','ISET_Coordinator'].includes(g.GroupName));
      if (!targetGroup) return res.status(404).json({ error: 'No admin role group to remove' });
      await client.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: POOL_ID, Username: username, GroupName: targetGroup.GroupName }));
      res.json({ message: 'Role removed' });
    } catch (e) {
      return sendRouteError(res, e, 'Failed to remove role');
    }
  });

  router.post('/users/:username/resend-invite', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager'), async (req, res) => {
    try {
      // There is no direct "resend invite" if MessageAction SUPPRESS was used; placeholder for integration with custom email flow.
      res.json({ message: 'Invite resend placeholder (configure SES/Lambda trigger)' });
    } catch (e) {
      return sendRouteError(res, e, 'Failed to resend invite');
    }
  });

  // Force password reset (sets status to FORCE_CHANGE_PASSWORD)
  router.patch('/users/:username/force-reset', requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager'), async (req, res) => {
    try {
      const { AdminResetUserPasswordCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const username = req.params.username;
      const client = getClient();
      await client.send(new AdminResetUserPasswordCommand({ UserPoolId: POOL_ID, Username: username }));
      res.json({ message: 'Password reset forced' });
    } catch (e) {
      return sendRouteError(res, e, 'Failed to force password reset');
    }
  });

router.loadAdminUsers = loadAdminUsers;

module.exports = router;


