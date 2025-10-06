// Simple Cognito Hosted UI helpers for React app
const region = process.env.REACT_APP_AWS_REGION;
const domainPrefix = process.env.REACT_APP_COGNITO_DOMAIN_PREFIX;
const clientId = process.env.REACT_APP_COGNITO_CLIENT_ID;
const redirectUri = process.env.REACT_APP_COGNITO_REDIRECT_URI;
const logoutRedirect = process.env.REACT_APP_COGNITO_LOGOUT_URI || (typeof window !== 'undefined' ? window.location.origin + '/' : '/');

export function getHostedBase() {
  return `https://${domainPrefix}.auth.${region}.amazoncognito.com`;
}

function getRedirectUri() {
  if (typeof window !== 'undefined') {
    // Allow dynamic override to current origin (helps when port changes between envs)
    if (process.env.REACT_APP_USE_DYNAMIC_REDIRECT === 'true') {
      return window.location.origin + '/auth/callback';
    }
    if (redirectUri) {
      try {
        const configured = new URL(redirectUri);
  if (configured.origin !== window.location.origin) {
          if (process.env.REACT_APP_ALLOW_REDIRECT_ORIGIN_MISMATCH !== 'true') {
            // We still return the configured one (may be intentional across domains), just warn.
          }
        }
      } catch (e) {
      }
    }
  }
  if (redirectUri) return redirectUri;
  if (typeof window !== 'undefined') return window.location.origin + '/auth/callback';
  return '/auth/callback';
}

export function buildLoginUrl() {
  const base = getHostedBase();
  const p = new URL(base + '/login');
  p.searchParams.set('client_id', clientId);
  p.searchParams.set('response_type', 'code');
  p.searchParams.set('scope', 'openid email profile');
  const ru = getRedirectUri();
  p.searchParams.set('redirect_uri', ru);
  try { sessionStorage.setItem('authLastRedirectUri', ru); } catch {}
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
  let usedRedirect = null;
  try { usedRedirect = sessionStorage.getItem('authLastRedirectUri'); } catch {}
  if (!usedRedirect) usedRedirect = getRedirectUri();
  body.set('redirect_uri', usedRedirect);
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
  const now = Math.floor(Date.now() / 1000);
  if (!s) return false;
  if (typeof s.expiresAt === 'number' && s.expiresAt > now) return true;
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
  const raw = claims.role || (Array.isArray(claims['cognito:groups']) ? claims['cognito:groups'][0] : undefined);
  if (!raw) return undefined;
  const norm = normalizeRole(raw);
  return norm;
}

// Map backend / Cognito group codes to UI display names used in roleMatrix & nav filtering
function normalizeRole(r) {
  const map = {
    SysAdmin: 'System Administrator',
    'System Administrator': 'System Administrator',
    ProgramAdmin: 'Program Administrator',
    'Program Administrator': 'Program Administrator',
    RegionalCoordinator: 'Regional Coordinator',
    'Regional Coordinator': 'Regional Coordinator',
  Adjudicator: 'Application Assessor',
  Assessor: 'Application Assessor',
  'ApplicationAssessor': 'Application Assessor',
  'Application Assessor': 'Application Assessor',
  PTMA: 'Application Assessor'
  };
  return map[r] || r; // fall back to raw if unknown
}

export function isIamOn() {
  try { return sessionStorage.getItem('iamBypass') !== 'off'; } catch { return true; }
}
