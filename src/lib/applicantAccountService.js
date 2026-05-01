const crypto = require('crypto');
const {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { resolveAwsCredentials } = require('./awsCredentials');

const AWS_REGION = process.env.AWS_REGION || process.env.COGNITO_REGION || 'ca-central-1';
const SES_REGION = process.env.AWS_SES_REGION || AWS_REGION;
const APPLICANT_STATUS_CREATED = 'created';
const APPLICANT_STATUS_INVITATION_SENT = 'invitation_sent';
const APPLICANT_STATUS_ACTIVATED = 'activated';
const NOTIFICATION_RUNTIME_SCOPE = 'notifications';
const PATH_EMAIL_SETTINGS_KEY = 'path.email';
const DEFAULT_SENDER_EMAIL = 'ISET@awentech.ca';
const DEFAULT_SENDER_NAME = 'NWAC PATH';

let applicantCognitoClient = null;
let sesClient = null;
let userColumnSetCache = null;
let userColumnSetPromise = null;

function normaliseString(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeEmail(value) {
  const trimmed = normaliseString(value);
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function normalizeEmailIdentity(value) {
  const trimmed = normaliseString(value);
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

function normalizeDisplayName(value) {
  if (value === null || typeof value === 'undefined') return null;
  const compact = String(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!compact) return null;
  return compact.slice(0, 120);
}

function resolveReplyToFallback() {
  return normalizeEmailIdentity(
    process.env.NOTIFICATION_SUPPORT_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    process.env.DEFAULT_SUPPORT_EMAIL ||
    null
  );
}

function formatSesSource(senderEmail, senderName) {
  if (!senderName) return senderEmail;
  const escapedName = senderName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escapedName}" <${senderEmail}>`;
}

async function resolveConfiguredSenderConfig(dbPool) {
  const envSender = normalizeEmailIdentity(process.env.SES_SENDER_EMAIL);
  const fallbackSenderEmail = envSender || DEFAULT_SENDER_EMAIL;
  const fallbackSenderName = normalizeDisplayName(process.env.SES_SENDER_NAME) || DEFAULT_SENDER_NAME;
  const fallbackReplyTo = resolveReplyToFallback();
  if (!dbPool) {
    return {
      senderEmail: fallbackSenderEmail,
      senderName: fallbackSenderName,
      replyTo: fallbackReplyTo,
    };
  }
  try {
    const [rows] = await dbPool.query(
      'SELECT v FROM iset_runtime_config WHERE scope = ? AND k = ? LIMIT 1',
      [NOTIFICATION_RUNTIME_SCOPE, PATH_EMAIL_SETTINGS_KEY],
    );
    const raw = rows?.[0]?.v;
    const payload = safeJsonParse(raw, null);
    const configuredEmail =
      normalizeEmailIdentity(payload?.senderEmail) ||
      normalizeEmailIdentity(payload?.sender_email) ||
      normalizeEmailIdentity(payload?.fromEmail);
    const configuredSenderName =
      normalizeDisplayName(payload?.senderName) ||
      normalizeDisplayName(payload?.sender_name) ||
      normalizeDisplayName(payload?.fromName) ||
      normalizeDisplayName(payload?.displayName) ||
      fallbackSenderName;
    const configuredReplyTo =
      normalizeEmailIdentity(payload?.replyTo) ||
      normalizeEmailIdentity(payload?.reply_to) ||
      normalizeEmailIdentity(payload?.replyToEmail) ||
      normalizeEmailIdentity(payload?.supportEmail) ||
      fallbackReplyTo ||
      null;
    return {
      senderEmail: configuredEmail || fallbackSenderEmail,
      senderName: configuredSenderName,
      replyTo: configuredReplyTo,
    };
  } catch (error) {
    return {
      senderEmail: fallbackSenderEmail,
      senderName: fallbackSenderName,
      replyTo: fallbackReplyTo,
    };
  }
}

function safeJsonParse(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function parseTrustedPools(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => {
      const [poolIdRaw, clientIdRaw] = token.split(':');
      const poolId = (poolIdRaw || '').trim();
      const clientId = (clientIdRaw || '').trim() || null;
      return poolId ? { poolId, clientId } : null;
    })
    .filter(Boolean);
}

function resolveApplicantPoolId() {
  const trusted = parseTrustedPools(process.env.COGNITO_TRUSTED_POOLS);
  if (!trusted.length) return null;
  const staffPoolId = process.env.COGNITO_STAFF_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID || null;
  const nonStaff = staffPoolId ? trusted.find(entry => entry.poolId && entry.poolId !== staffPoolId) : null;
  return (nonStaff || trusted[0]).poolId || null;
}

function getApplicantCognitoClient() {
  const poolId = resolveApplicantPoolId();
  if (!poolId) {
    const error = new Error('Missing COGNITO_TRUSTED_POOLS entry for the applicant pool.');
    error.code = 'missing_applicant_pool';
    throw error;
  }
  if (!applicantCognitoClient) {
    const credentials = resolveAwsCredentials();
    const config = { region: AWS_REGION };
    if (credentials) config.credentials = credentials;
    applicantCognitoClient = new CognitoIdentityProviderClient(config);
  }
  return { client: applicantCognitoClient, poolId };
}

function getSesClient() {
  if (!sesClient) {
    const credentials = resolveAwsCredentials();
    const config = { region: SES_REGION };
    if (credentials) config.credentials = credentials;
    sesClient = new SESClient(config);
  }
  return sesClient;
}

async function getUserColumnSet(dbPool) {
  if (userColumnSetCache) return userColumnSetCache;
  if (userColumnSetPromise) return userColumnSetPromise;
  userColumnSetPromise = (async () => {
    const [rows] = await dbPool.query('SHOW COLUMNS FROM `user`');
    userColumnSetCache = new Set((rows || []).map(row => row.Field).filter(Boolean));
    return userColumnSetCache;
  })().finally(() => {
    userColumnSetPromise = null;
  });
  return userColumnSetPromise;
}

function buildDisplayName({ firstName, lastName, preferredName, email }) {
  const preferred = normaliseString(preferredName);
  const first = normaliseString(firstName);
  const last = normaliseString(lastName);
  const emailValue = normalizeEmail(email);
  return (
    [preferred || first, last].filter(Boolean).join(' ').trim() ||
    [first, last].filter(Boolean).join(' ').trim() ||
    emailValue ||
    'Applicant'
  );
}

function buildPortalBaseUrl() {
  let raw = (
    process.env.APPLICANT_PORTAL_URL ||
    process.env.APPLICANT_PORTAL_BASE ||
    process.env.PUBLIC_PORTAL_BASE_URL ||
    process.env.REACT_APP_PORTAL_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.PORTAL_DOMAIN ||
    'http://localhost:3000/'
  ).trim();
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function buildActivationLink(email) {
  const baseUrl = buildPortalBaseUrl();
  const normalizedEmail = normalizeEmail(email);
  const url = new URL('/activate-account', `${baseUrl}/`);
  if (normalizedEmail) {
    url.searchParams.set('email', normalizedEmail);
  }
  return url.toString();
}

function buildStrongRandomPassword() {
  const token = crypto.randomBytes(18).toString('base64url');
  return `Path-${token}aA1!`;
}

function toAttrMap(user) {
  return Object.fromEntries((user?.UserAttributes || user?.Attributes || []).map(attr => [attr.Name, attr.Value]));
}

async function fetchApplicantCognitoUser(username) {
  const normalizedUsername = normalizeEmail(username);
  if (!normalizedUsername) return null;
  const { client, poolId } = getApplicantCognitoClient();
  try {
    const response = await client.send(new AdminGetUserCommand({
      UserPoolId: poolId,
      Username: normalizedUsername,
    }));
    return response || null;
  } catch (error) {
    const name = error?.name || error?.code || '';
    if (name === 'UserNotFoundException') return null;
    throw error;
  }
}

async function updateApplicantCognitoAttributes(username, attributes = []) {
  const normalizedUsername = normalizeEmail(username);
  if (!normalizedUsername || !attributes.length) return;
  const { client, poolId } = getApplicantCognitoClient();
  await client.send(new AdminUpdateUserAttributesCommand({
    UserPoolId: poolId,
    Username: normalizedUsername,
    UserAttributes: attributes,
  }));
}

async function ensureApplicantCognitoUser({
  email,
  firstName = null,
  lastName = null,
  preferredName = null,
}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const error = new Error('A single valid applicant email is required before an account can be created.');
    error.code = 'missing_applicant_email';
    throw error;
  }

  const displayName = buildDisplayName({
    firstName,
    lastName,
    preferredName,
    email: normalizedEmail,
  });
  const givenName = normaliseString(preferredName) || normaliseString(firstName);
  const familyName = normaliseString(lastName);

  let user = await fetchApplicantCognitoUser(normalizedEmail);
  let created = false;

  if (!user) {
    const { client, poolId } = getApplicantCognitoClient();
    const userAttributes = [
      { Name: 'email', Value: normalizedEmail },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'preferred_username', Value: normalizedEmail },
    ];
    if (givenName) userAttributes.push({ Name: 'given_name', Value: givenName });
    if (familyName) userAttributes.push({ Name: 'family_name', Value: familyName });

    await client.send(new AdminCreateUserCommand({
      UserPoolId: poolId,
      Username: normalizedEmail,
      MessageAction: 'SUPPRESS',
      TemporaryPassword: buildStrongRandomPassword(),
      UserAttributes: userAttributes,
    }));

    await client.send(new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: normalizedEmail,
      Password: buildStrongRandomPassword(),
      Permanent: true,
    }));

    created = true;
    user = await fetchApplicantCognitoUser(normalizedEmail);
  } else {
    const attrMap = toAttrMap(user);
    const updates = [];
    if ((attrMap.email || '').toLowerCase() !== normalizedEmail) {
      updates.push({ Name: 'email', Value: normalizedEmail });
    }
    if (attrMap.email_verified !== 'true') {
      updates.push({ Name: 'email_verified', Value: 'true' });
    }
    if ((attrMap.preferred_username || '').toLowerCase() !== normalizedEmail) {
      updates.push({ Name: 'preferred_username', Value: normalizedEmail });
    }
    if (givenName && !attrMap.given_name) {
      updates.push({ Name: 'given_name', Value: givenName });
    }
    if (familyName && !attrMap.family_name) {
      updates.push({ Name: 'family_name', Value: familyName });
    }
    if (updates.length) {
      await updateApplicantCognitoAttributes(normalizedEmail, updates);
      user = await fetchApplicantCognitoUser(normalizedEmail);
    }
  }

  const attrMap = toAttrMap(user);
  return {
    created,
    username: normalizedEmail,
    email: normalizeEmail(attrMap.email) || normalizedEmail,
    cognitoSub: normaliseString(attrMap.sub),
    displayName,
    userStatus: normaliseString(user?.UserStatus),
  };
}

async function deleteApplicantCognitoUser(username) {
  const normalizedUsername = normalizeEmail(username);
  if (!normalizedUsername) return false;
  const { client, poolId } = getApplicantCognitoClient();
  try {
    await client.send(new AdminDeleteUserCommand({
      UserPoolId: poolId,
      Username: normalizedUsername,
    }));
    return true;
  } catch (error) {
    const name = error?.name || error?.code || '';
    if (name === 'UserNotFoundException') return false;
    throw error;
  }
}

async function ensureApplicantLocalUser(dbPool, {
  cognitoSub,
  email,
  name = null,
  preferredLanguage = 'en',
}) {
  const normalizedSub = normaliseString(cognitoSub);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedSub || !normalizedEmail) {
    const error = new Error('Applicant local user sync requires Cognito sub and email.');
    error.code = 'invalid_local_user_identity';
    throw error;
  }

  const columns = await getUserColumnSet(dbPool);
  const hasName = columns.has('name');
  const hasPreferredLanguage = columns.has('preferred_language');
  const hasEmailVerified = columns.has('email_verified');
  const hasSuspended = columns.has('suspended');

  const selectBySub = await dbPool.query(
    `SELECT id, email, cognito_sub${hasSuspended ? ', suspended' : ''}
       FROM user
      WHERE cognito_sub = ?
      LIMIT 1`,
    [normalizedSub]
  );
  const existingBySub = selectBySub?.[0]?.[0] || null;
  if (existingBySub?.id) {
    if (existingBySub.email && existingBySub.email.toLowerCase() !== normalizedEmail) {
      try {
        await dbPool.query('UPDATE user SET email = ? WHERE id = ?', [normalizedEmail, existingBySub.id]);
      } catch (_) {
        // Leave the original email if a unique constraint is already satisfied elsewhere.
      }
    }
    return Number(existingBySub.id);
  }

  const selectByEmail = await dbPool.query(
    `SELECT id, cognito_sub${hasSuspended ? ', suspended' : ''}
       FROM user
      WHERE email = ?
      LIMIT 1`,
    [normalizedEmail]
  );
  const existingByEmail = selectByEmail?.[0]?.[0] || null;
  if (existingByEmail?.id) {
    if (!existingByEmail.cognito_sub) {
      try {
        await dbPool.query('UPDATE user SET cognito_sub = ? WHERE id = ?', [normalizedSub, existingByEmail.id]);
      } catch (error) {
        if (error?.code !== 'ER_DUP_ENTRY') throw error;
      }
    }
    return Number(existingByEmail.id);
  }

  const fields = ['email', 'cognito_sub'];
  const values = [normalizedEmail, normalizedSub];
  const placeholders = ['?', '?'];
  if (hasName) {
    fields.push('name');
    values.push(normaliseString(name) || normalizedEmail);
    placeholders.push('?');
  }
  if (hasPreferredLanguage) {
    fields.push('preferred_language');
    values.push(normaliseString(preferredLanguage) || 'en');
    placeholders.push('?');
  }
  if (hasEmailVerified) {
    fields.push('email_verified');
    values.push(1);
    placeholders.push('?');
  }
  if (hasSuspended) {
    fields.push('suspended');
    values.push(0);
    placeholders.push('?');
  }

  const [insertResult] = await dbPool.query(
    `INSERT INTO user (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values
  );
  return Number(insertResult.insertId);
}

function extractClientEmail(addressJson) {
  const address = safeJsonParse(addressJson, {});
  const contact = address && typeof address === 'object' ? (address.contact || {}) : {};
  return (
    normalizeEmail(contact.emailNormalized) ||
    normalizeEmail(contact.email) ||
    normalizeEmail(address.emailNormalized) ||
    normalizeEmail(address.email) ||
    null
  );
}

function deriveStatusCode(row) {
  if (row?.applicant_account_status === APPLICANT_STATUS_ACTIVATED || row?.applicant_activated_at) {
    return APPLICANT_STATUS_ACTIVATED;
  }
  if (row?.applicant_account_status === APPLICANT_STATUS_INVITATION_SENT || row?.applicant_invited_at) {
    return APPLICANT_STATUS_INVITATION_SENT;
  }
  if (row?.applicant_cognito_sub || row?.applicant_cognito_username) {
    return APPLICANT_STATUS_CREATED;
  }
  return 'no_account';
}

function deriveStatusLabel(statusCode) {
  switch (statusCode) {
    case APPLICANT_STATUS_CREATED:
      return 'Ready to invite';
    case APPLICANT_STATUS_INVITATION_SENT:
      return 'Invitation sent';
    case APPLICANT_STATUS_ACTIVATED:
      return 'Activated';
    default:
      return 'No account';
  }
}

function mapApplicantAccountRow(row) {
  const email = normalizeEmail(row?.applicant_account_email) || extractClientEmail(row?.address_json);
  const statusCode = deriveStatusCode(row);
  const fundedName = [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim();
  return {
    clientId: Number(row?.client_id || row?.id || 0) || null,
    userId: row?.applicant_user_id ? Number(row.applicant_user_id) : null,
    caseId: row?.case_id ? Number(row.case_id) : null,
    caseNumber: row?.case_number || null,
    caseStatus: row?.case_status || null,
    applicantName: fundedName || 'Client',
    email,
    cognitoSub: row?.applicant_cognito_sub || null,
    cognitoUsername: row?.applicant_cognito_username || null,
    username: row?.applicant_cognito_username || null,
    accountStatus: statusCode,
    accountStatusLabel: deriveStatusLabel(statusCode),
    accountEmail: normalizeEmail(row?.applicant_account_email) || null,
    invitedAt: row?.applicant_invited_at || null,
    activatedAt: row?.applicant_activated_at || null,
    regionCode: row?.region_code || null,
    regionName: row?.region_name || null,
    caseManagerName: row?.case_manager_name || null,
    canCreateAccount: statusCode === 'no_account' && Boolean(email),
    canSendActivation: statusCode === APPLICANT_STATUS_CREATED,
    canResendActivation: statusCode === APPLICANT_STATUS_INVITATION_SENT,
  };
}

async function fetchApplicantAccountRows(dbPool, { q = '', clientId = null, limit = 500, status = null } = {}) {
  const search = normaliseString(q);
  const statusKey = normaliseString(status);
  const params = [];
  const activatedCondition = `
    (
      cl.applicant_account_status = '${APPLICANT_STATUS_ACTIVATED}'
      OR cl.applicant_activated_at IS NOT NULL
    )
  `;
  const invitationCondition = `
    (
      cl.applicant_account_status = '${APPLICANT_STATUS_INVITATION_SENT}'
      OR cl.applicant_invited_at IS NOT NULL
    )
  `;
  const createdCondition = `
    (
      cl.applicant_cognito_sub IS NOT NULL
      OR cl.applicant_cognito_username IS NOT NULL
    )
  `;
  let whereSql = `
    WHERE (
      lc.id IS NOT NULL
      OR cl.applicant_cognito_sub IS NOT NULL
      OR cl.applicant_cognito_username IS NOT NULL
      OR JSON_EXTRACT(cl.address_json, '$.contact.emailNormalized') IS NOT NULL
      OR JSON_EXTRACT(cl.address_json, '$.contact.email') IS NOT NULL
    )
  `;

  if (clientId) {
    whereSql += ' AND cl.id = ?';
    params.push(Number(clientId));
  }

  if (search) {
    const like = `%${search.toLowerCase()}%`;
    whereSql += `
      AND (
        LOWER(CONCAT_WS(' ', cl.first_name, cl.last_name)) LIKE ?
        OR LOWER(COALESCE(cl.applicant_account_email, '')) LIKE ?
        OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.contact.emailNormalized')), '')) LIKE ?
        OR LOWER(COALESCE(lc.case_number, '')) LIKE ?
        OR LOWER(COALESCE(r.code, '')) LIKE ?
        OR LOWER(COALESCE(sp.display_name, sp.name, sp.email, '')) LIKE ?
      )
    `;
    params.push(like, like, like, like, like, like);
  }

  if (statusKey === APPLICANT_STATUS_ACTIVATED) {
    whereSql += ` AND ${activatedCondition}`;
  } else if (statusKey === APPLICANT_STATUS_INVITATION_SENT) {
    whereSql += ` AND NOT ${activatedCondition} AND ${invitationCondition}`;
  } else if (statusKey === APPLICANT_STATUS_CREATED) {
    whereSql += ` AND NOT ${activatedCondition} AND NOT ${invitationCondition} AND ${createdCondition}`;
  } else if (statusKey === 'no_account') {
    whereSql += ` AND NOT ${activatedCondition} AND NOT ${invitationCondition} AND NOT ${createdCondition}`;
  }

  params.push(Math.max(1, Math.min(Number(limit) || 500, 1000)));

  const [rows] = await dbPool.query(
    `
      WITH latest_case AS (
        SELECT
          c.*,
          ROW_NUMBER() OVER (PARTITION BY c.client_id ORDER BY c.updated_at DESC, c.id DESC) AS rn
        FROM iset_case c
        WHERE c.client_id IS NOT NULL
      )
      SELECT
        cl.id AS client_id,
        cl.first_name,
        cl.last_name,
        cl.address_json,
        cl.applicant_cognito_sub,
        cl.applicant_cognito_username,
        cl.applicant_account_status,
        cl.applicant_account_email,
        cl.applicant_invited_at,
        cl.applicant_activated_at,
        lc.id AS case_id,
        lc.case_number,
        lc.status AS case_status,
        r.code AS region_code,
        r.name_en AS region_name,
        COALESCE(NULLIF(sp.display_name, ''), NULLIF(sp.name, ''), sp.email) AS case_manager_name,
        (
          SELECT u.id
            FROM user u
           WHERE (
             cl.applicant_cognito_sub IS NOT NULL
             AND u.cognito_sub = cl.applicant_cognito_sub
           ) OR (
             cl.applicant_cognito_sub IS NULL
             AND u.email = (
               COALESCE(
                 cl.applicant_account_email,
                 JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.contact.emailNormalized')),
                 JSON_UNQUOTE(JSON_EXTRACT(cl.address_json, '$.contact.email'))
               ) COLLATE utf8mb4_0900_ai_ci
             )
           )
           ORDER BY CASE WHEN u.cognito_sub = cl.applicant_cognito_sub THEN 0 ELSE 1 END, u.id ASC
           LIMIT 1
        ) AS applicant_user_id
      FROM client cl
      LEFT JOIN latest_case lc
        ON lc.client_id = cl.id
       AND lc.rn = 1
      LEFT JOIN canada_region r
        ON r.region_id = lc.portfolio_region_id
      LEFT JOIN staff_profiles sp
        ON sp.id = lc.assigned_staff_profile_id
      ${whereSql}
      ORDER BY
        CASE
          WHEN cl.applicant_account_status = '${APPLICANT_STATUS_INVITATION_SENT}' THEN 0
          WHEN cl.applicant_account_status = '${APPLICANT_STATUS_CREATED}' THEN 1
          WHEN cl.applicant_account_status = '${APPLICANT_STATUS_ACTIVATED}' THEN 3
          ELSE 2
        END,
        cl.updated_at DESC,
        cl.id DESC
      LIMIT ?
    `,
    params
  );
  return (rows || []).map(mapApplicantAccountRow);
}

async function fetchPortalApplicantUsers(dbPool, { q = '', limit = 500 } = {}) {
  const search = normaliseString(q);
  const params = [];
  let whereSql = `
    WHERE u.cognito_sub IS NOT NULL
      AND staff_by_sub.id IS NULL
      AND staff_by_email.id IS NULL
      AND (
        NULLIF(TRIM(COALESCE(u.email, '')), '') IS NOT NULL
        OR NULLIF(TRIM(COALESCE(u.name, '')), '') IS NOT NULL
      )
  `;

  if (search) {
    const like = `%${search.toLowerCase()}%`;
    whereSql += `
      AND (
        LOWER(COALESCE(u.email, '')) LIKE ?
        OR LOWER(COALESCE(u.name, '')) LIKE ?
      )
    `;
    params.push(like, like);
  }

  params.push(Math.max(1, Math.min(Number(limit) || 500, 1000)));

  const [rows] = await dbPool.query(
    `
      SELECT
        u.id AS user_id,
        u.name AS user_name,
        u.email AS user_email
      FROM user u
      LEFT JOIN staff_profiles staff_by_sub
        ON staff_by_sub.cognito_sub COLLATE utf8mb4_0900_ai_ci =
           u.cognito_sub COLLATE utf8mb4_0900_ai_ci
      LEFT JOIN staff_profiles staff_by_email
        ON LOWER(TRIM(COALESCE(staff_by_email.email, ''))) COLLATE utf8mb4_0900_ai_ci =
           LOWER(TRIM(COALESCE(u.email, ''))) COLLATE utf8mb4_0900_ai_ci
      ${whereSql}
      ORDER BY
        LOWER(COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(u.name), ''), CONCAT('user-', u.id))) ASC,
        u.id ASC
      LIMIT ?
    `,
    params
  );

  return (rows || []).map(row => ({
    userId: row?.user_id ? Number(row.user_id) : null,
    name: normaliseString(row?.user_name) || null,
    email: normalizeEmail(row?.user_email) || normaliseString(row?.user_email) || null,
    username: normalizeEmail(row?.user_email) || normaliseString(row?.user_email) || null,
  }));
}

async function fetchApplicantAccountSummary(dbPool) {
  const activatedCondition = `
    (
      cl.applicant_account_status = '${APPLICANT_STATUS_ACTIVATED}'
      OR cl.applicant_activated_at IS NOT NULL
    )
  `;
  const invitationCondition = `
    (
      cl.applicant_account_status = '${APPLICANT_STATUS_INVITATION_SENT}'
      OR cl.applicant_invited_at IS NOT NULL
    )
  `;
  const createdCondition = `
    (
      cl.applicant_cognito_sub IS NOT NULL
      OR cl.applicant_cognito_username IS NOT NULL
    )
  `;

  const [[row]] = await dbPool.query(
    `
      SELECT
        SUM(CASE WHEN ${activatedCondition} THEN 1 ELSE 0 END) AS activated,
        SUM(CASE WHEN NOT ${activatedCondition} AND ${invitationCondition} THEN 1 ELSE 0 END) AS invitation_sent,
        SUM(CASE WHEN NOT ${activatedCondition} AND NOT ${invitationCondition} AND ${createdCondition} THEN 1 ELSE 0 END) AS created,
        SUM(CASE WHEN NOT ${activatedCondition} AND NOT ${invitationCondition} AND NOT ${createdCondition} THEN 1 ELSE 0 END) AS no_account
      FROM client cl
    `
  );

  return {
    activated: Number(row?.activated || 0),
    invitationSent: Number(row?.invitation_sent || 0),
    readyToInvite: Number(row?.created || 0),
    noAccount: Number(row?.no_account || 0),
  };
}

async function loadApplicantAccountRow(dbPool, clientId) {
  const rows = await fetchApplicantAccountRows(dbPool, { clientId, limit: 1 });
  return rows[0] || null;
}

async function fetchClientCoreRow(dbPool, clientId) {
  const [[row]] = await dbPool.query(
    `SELECT id, first_name, last_name, address_json, applicant_cognito_sub, applicant_cognito_username,
            applicant_account_status, applicant_account_email, applicant_invited_at, applicant_activated_at
       FROM client
      WHERE id = ?
      LIMIT 1`,
    [Number(clientId)]
  );
  return row || null;
}

async function fetchActorStaffProfileId(dbPool, req) {
  const sub = normaliseString(req?.auth?.sub);
  if (!sub) return null;
  const [[row]] = await dbPool.query(
    'SELECT id FROM staff_profiles WHERE cognito_sub = ? LIMIT 1',
    [sub]
  );
  return row?.id ? Number(row.id) : null;
}

async function logApplicantAccountEvent(dbPool, {
  clientId,
  eventType,
  actorStaffProfileId = null,
  metadata = null,
}) {
  await dbPool.query(
    `INSERT INTO client_applicant_account_event
      (client_id, event_type, actor_staff_profile_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [
      Number(clientId),
      eventType,
      actorStaffProfileId || null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

async function persistApplicantAccountLink(dbPool, {
  clientId,
  cognitoSub,
  cognitoUsername,
  email,
  status,
}) {
  await dbPool.query(
    `UPDATE client
        SET applicant_cognito_sub = ?,
            applicant_cognito_username = ?,
            applicant_account_email = ?,
            applicant_account_status = ?,
            updated_at = NOW()
      WHERE id = ?`,
    [
      normaliseString(cognitoSub),
      normalizeEmail(cognitoUsername),
      normalizeEmail(email),
      status,
      Number(clientId),
    ]
  );
}

async function ensureApplicantAccountForClient(dbPool, {
  clientId,
  actorStaffProfileId = null,
  preferredLanguage = 'en',
  source = 'manual',
}) {
  const clientRow = await fetchClientCoreRow(dbPool, clientId);
  if (!clientRow?.id) {
    const error = new Error('Client not found.');
    error.code = 'client_not_found';
    throw error;
  }

  const email = extractClientEmail(clientRow.address_json);
  if (!email) {
    const error = new Error('This client does not have a single valid email address on file.');
    error.code = 'applicant_email_missing';
    throw error;
  }

  const cognitoIdentity = await ensureApplicantCognitoUser({
    email,
    firstName: clientRow.first_name,
    lastName: clientRow.last_name,
  });

  await ensureApplicantLocalUser(dbPool, {
    cognitoSub: cognitoIdentity.cognitoSub,
    email: cognitoIdentity.email,
    name: cognitoIdentity.displayName,
    preferredLanguage,
  });

  const nextStatus = clientRow.applicant_activated_at
    ? APPLICANT_STATUS_ACTIVATED
    : clientRow.applicant_invited_at
      ? APPLICANT_STATUS_INVITATION_SENT
      : APPLICANT_STATUS_CREATED;

  const wasLinked = Boolean(clientRow.applicant_cognito_sub || clientRow.applicant_cognito_username);
  await persistApplicantAccountLink(dbPool, {
    clientId: clientRow.id,
    cognitoSub: cognitoIdentity.cognitoSub,
    cognitoUsername: cognitoIdentity.username,
    email: cognitoIdentity.email,
    status: nextStatus,
  });

  if (cognitoIdentity.created || !wasLinked) {
    await logApplicantAccountEvent(dbPool, {
      clientId: clientRow.id,
      eventType: 'account_created',
      actorStaffProfileId,
      metadata: {
        source,
        accountEmail: cognitoIdentity.email,
        cognitoUsername: cognitoIdentity.username,
      },
    });
  }

  const row = await loadApplicantAccountRow(dbPool, clientRow.id);
  return {
    ...row,
    accountCreated: cognitoIdentity.created,
  };
}

function buildInvitationCopy({ applicantName, activationLink, preferredLanguage }) {
  const firstName = normaliseString(applicantName);
  const lang = String(preferredLanguage || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  if (lang === 'fr') {
    return {
      subject: 'PATH : activez votre compte',
      bodyHtml: `
        <p>Bonjour${firstName ? ` ${firstName}` : ''},</p>
        <p>Votre gestionnaire de cas vous invite maintenant a activer votre compte PATH.</p>
        <p>Pour commencer, ouvrez la page d’activation ci-dessous. Vous pourrez ensuite demander votre code d’activation et definir votre mot de passe PATH pour la premiere fois.</p>
        <p><a href="${activationLink}" target="_blank" rel="noopener noreferrer">Activer votre compte PATH</a></p>
        <p>Si vous n’attendiez pas ce courriel, veuillez communiquer avec votre gestionnaire de cas avant d’utiliser le lien.</p>
      `,
      bodyText: `Bonjour${firstName ? ` ${firstName}` : ''},

Votre gestionnaire de cas vous invite maintenant a activer votre compte PATH.

Pour commencer, ouvrez la page d’activation ci-dessous. Vous pourrez ensuite demander votre code d’activation et definir votre mot de passe PATH pour la premiere fois.

${activationLink}

Si vous n’attendiez pas ce courriel, veuillez communiquer avec votre gestionnaire de cas avant d’utiliser le lien.`,
    };
  }

  return {
    subject: 'PATH: activate your account',
    bodyHtml: `
      <p>Hello${firstName ? ` ${firstName}` : ''},</p>
      <p>Your case manager is now inviting you to activate your PATH account.</p>
      <p>To begin, open the activation page below. You will then be able to request your activation code and set your PATH password for the first time.</p>
      <p><a href="${activationLink}" target="_blank" rel="noopener noreferrer">Activate your PATH account</a></p>
      <p>If you were not expecting this email, please contact your case manager before using the link.</p>
    `,
    bodyText: `Hello${firstName ? ` ${firstName}` : ''},

Your case manager is now inviting you to activate your PATH account.

To begin, open the activation page below. You will then be able to request your activation code and set your PATH password for the first time.

${activationLink}

If you were not expecting this email, please contact your case manager before using the link.`,
  };
}

async function sendApplicantActivationEmail({
  dbPool,
  to,
  applicantName,
  preferredLanguage = 'en',
}) {
  const recipient = normalizeEmail(to);
  if (!recipient) {
    const error = new Error('Invitation recipient email is missing.');
    error.code = 'missing_recipient_email';
    throw error;
  }

  const activationLink = buildActivationLink(recipient);
  const { subject, bodyHtml, bodyText } = buildInvitationCopy({
    applicantName,
    activationLink,
    preferredLanguage,
  });

  const overrideRecipient = normaliseString(process.env.SES_REDIRECT_TO);
  const senderConfig = await resolveConfiguredSenderConfig(dbPool);
  const finalRecipient = overrideRecipient || recipient;
  const client = getSesClient();
  await client.send(new SendEmailCommand({
    Destination: { ToAddresses: [finalRecipient] },
    Message: {
      Subject: { Charset: 'UTF-8', Data: subject },
      Body: {
        Html: { Charset: 'UTF-8', Data: bodyHtml },
        Text: { Charset: 'UTF-8', Data: bodyText },
      },
    },
    Source: formatSesSource(senderConfig.senderEmail, senderConfig.senderName),
    ...(senderConfig.replyTo ? { ReplyToAddresses: [senderConfig.replyTo] } : {}),
  }));

  return { activationLink, recipient, finalRecipient };
}

async function sendApplicantActivationInvitation(dbPool, {
  clientId,
  actorStaffProfileId = null,
}) {
  const clientRow = await fetchClientCoreRow(dbPool, clientId);
  if (!clientRow?.id) {
    const error = new Error('Client not found.');
    error.code = 'client_not_found';
    throw error;
  }

  let accountRow = await loadApplicantAccountRow(dbPool, clientId);
  if (!accountRow?.cognitoSub && !accountRow?.cognitoUsername) {
    const error = new Error('Create the applicant account before sending an activation email.');
    error.code = 'account_not_created';
    throw error;
  }
  if (accountRow.accountStatus === APPLICANT_STATUS_ACTIVATED) {
    const error = new Error('This applicant account is already activated.');
    error.code = 'account_already_activated';
    throw error;
  }

  const preferredLanguageQuery = await dbPool.query(
    `SELECT preferred_language
       FROM user
      WHERE cognito_sub = ?
         OR email = ?
      ORDER BY
        CASE WHEN cognito_sub = ? THEN 0 ELSE 1 END
      LIMIT 1`,
    [
      accountRow.cognitoSub || '',
      accountRow.email || '',
      accountRow.cognitoSub || '',
    ]
  );
  const preferredLanguage = preferredLanguageQuery?.[0]?.[0]?.preferred_language || 'en';
  const sendResult = await sendApplicantActivationEmail({
    dbPool,
    to: accountRow.email,
    applicantName: accountRow.applicantName,
    preferredLanguage,
  });

  await dbPool.query(
    `UPDATE client
        SET applicant_account_status = ?,
            applicant_invited_at = NOW(),
            applicant_invited_by_staff_profile_id = ?,
            updated_at = NOW()
      WHERE id = ?`,
    [
      APPLICANT_STATUS_INVITATION_SENT,
      actorStaffProfileId || null,
      Number(clientId),
    ]
  );

  await logApplicantAccountEvent(dbPool, {
    clientId,
    eventType: 'invitation_sent',
    actorStaffProfileId,
    metadata: {
      activationLink: sendResult.activationLink,
      recipient: sendResult.recipient,
      finalRecipient: sendResult.finalRecipient,
      mode: accountRow.accountStatus === APPLICANT_STATUS_INVITATION_SENT ? 'resend' : 'send',
    },
  });

  accountRow = await loadApplicantAccountRow(dbPool, clientId);
  return accountRow;
}

module.exports = {
  APPLICANT_STATUS_ACTIVATED,
  APPLICANT_STATUS_CREATED,
  APPLICANT_STATUS_INVITATION_SENT,
  buildActivationLink,
  deleteApplicantCognitoUser,
  deriveStatusCode,
  deriveStatusLabel,
  ensureApplicantAccountForClient,
  extractClientEmail,
  fetchActorStaffProfileId,
  fetchApplicantAccountRows,
  fetchApplicantAccountSummary,
  fetchPortalApplicantUsers,
  loadApplicantAccountRow,
  normalizeEmail,
  parseTrustedPools,
  resolveApplicantPoolId,
  sendApplicantActivationInvitation,
};
