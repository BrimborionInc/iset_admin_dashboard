// Simple Cognito Hosted UI helpers for React app
const region = process.env.REACT_APP_AWS_REGION;
const domainPrefix = process.env.REACT_APP_COGNITO_DOMAIN_PREFIX;
const clientId = process.env.REACT_APP_COGNITO_CLIENT_ID;
const redirectUri = process.env.REACT_APP_COGNITO_REDIRECT_URI;
const logoutRedirect = process.env.REACT_APP_COGNITO_LOGOUT_URI || (typeof window !== 'undefined' ? window.location.origin + '/' : '/');

export function getHostedBase() {
  return `https://${domainPrefix}.auth.${region}.amazoncognito.com`;
}

export function buildLoginUrl() {
  const base = getHostedBase();
  const p = new URL(base + '/login');
  p.searchParams.set('client_id', clientId);
  p.searchParams.set('response_type', 'code');
  p.searchParams.set('scope', 'openid email profile');
  p.searchParams.set('redirect_uri', redirectUri);
  try {
    // Carry current location through the OAuth flow to return the user where they started
    const current = typeof window !== 'undefined' ? window.location.href : '/';
    p.searchParams.set('state', btoa(current));
  } catch {}
  return p.toString();
}

export function buildLogoutUrl() {
  const base = getHostedBase();
  const p = new URL(base + '/logout');
  p.searchParams.set('client_id', clientId);
  p.searchParams.set('logout_uri', logoutRedirect);
  return p.toString();
}

export async function exchangeCodeForTokens(code) {
  const tokenUrl = getHostedBase() + '/oauth2/token';
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', clientId);
  body.set('code', code);
  body.set('redirect_uri', redirectUri);
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) throw new Error(`Token exchange failed ${resp.status}`);
  return resp.json();
}

export async function refreshTokens(refreshToken) {
  if (!refreshToken) throw new Error('No refresh token');
  const tokenUrl = getHostedBase() + '/oauth2/token';
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('client_id', clientId);
  body.set('refresh_token', refreshToken);
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) throw new Error(`Token refresh failed ${resp.status}`);
  return resp.json();
}

export function saveSession(tokens) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Number(tokens.expires_in || 3600);
  const session = {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
  // Keep existing refresh token if Cognito doesn't return it on refresh
  refreshToken: tokens.refresh_token || loadSession()?.refreshToken || null,
    expiresAt: now + expiresIn - 60,
  };
  sessionStorage.setItem('authSession', JSON.stringify(session));
  try {
    // Notify listeners in-app that auth session changed
    window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: { session, action: 'save' } }));
  } catch {}
  return session;
}

export function loadSession() {
  try { return JSON.parse(sessionStorage.getItem('authSession') || 'null'); } catch { return null; }
}

export function clearSession() {
  sessionStorage.removeItem('authSession');
  try {
    window.dispatchEvent(new CustomEvent('auth:session-changed', { detail: { session: null, action: 'clear' } }));
  } catch {}
}

export function hasValidSession() {
  const s = loadSession();
  if (!s) return false;
  const now = Math.floor(Date.now() / 1000);
  if (typeof s.expiresAt === 'number' && s.expiresAt > now) return true;
  // Consider session usable if we have a refresh token (client may refresh on demand)
  return !!s.refreshToken;
}

export async function ensureFreshSession() {
  const s = loadSession();
  if (!s) return null;
  const now = Math.floor(Date.now() / 1000);
  const needsRefresh = !s.expiresAt || s.expiresAt <= now + 30; // refresh if expiring within 30s
  if (!needsRefresh) return s;
  if (!s.refreshToken) return s;
  try {
    const refreshed = await refreshTokens(s.refreshToken);
    return saveSession(refreshed);
  } catch (e) {
    // If refresh fails, clear session
    clearSession();
    throw e;
  }
}

// UI helpers
export function getIdTokenClaims() {
  const s = loadSession();
  if (!s?.idToken) return null;
  try {
    const payload = JSON.parse(atob(s.idToken.split('.')[1] || ''));
    return payload || null;
  } catch {
    return null;
  }
}

export function getRoleFromClaims(claims) {
  if (!claims) return undefined;
  const role = claims.role || (Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'][0] : undefined);
  return role ? String(role) : undefined;
}

export function isIamOn() {
  try { return sessionStorage.getItem('iamBypass') !== 'off'; } catch { return true; }
}
