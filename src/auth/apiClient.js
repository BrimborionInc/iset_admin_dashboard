// API client that attaches Cognito ID token when IAM is on, or sends dev-bypass headers when off.
import { buildLoginUrl, loadSession, ensureFreshSession, clearSession } from './cognito';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

function getBypassHeaders() {
  try {
    // Prefer explicit UI toggle, but also allow env flag and localhost heuristic
    const uiFlag = sessionStorage.getItem('iamBypass') === 'off';
    const envFlag = process.env.REACT_APP_DEV_AUTH_BYPASS === 'true';
    const devLocal = (typeof window !== 'undefined') && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    const flag = uiFlag || envFlag || devLocal;
    if (!flag) return null;
    if (sessionStorage.getItem('simulateSignedOut') === 'true') {
      // Simulate signed-out: don't send any bypass headers so the client path treats it as unauthenticated
      return null;
    }
    const roleRaw = sessionStorage.getItem('currentRole');
    const roleObj = roleRaw ? JSON.parse(roleRaw) : null;
    const role = roleObj?.value || roleObj?.label || roleObj || 'SysAdmin';
    const userId = sessionStorage.getItem('devUserId') || 'dev-user-1';
    const regionId = sessionStorage.getItem('devRegionId') || '';
    // Allow env override to ensure server and client share the key
    const token = sessionStorage.getItem('devBypassToken') || process.env.REACT_APP_DEV_AUTH_TOKEN || 'local-dev-secret';
    return {
      'X-Dev-Bypass': token,
      'X-Dev-Role': role,
      'X-Dev-UserId': userId,
      ...(regionId ? { 'X-Dev-RegionId': regionId } : {}),
    };
  } catch {
    return null;
  }
}

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : API_BASE + path;
  const headers = new Headers(options.headers || {});
  let iamMode = 'unknown';
  try {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('iamBypass');
      if (stored === 'off') iamMode = 'off';
      else if (stored === 'on') iamMode = 'on';
    }
  } catch (_) {}
  headers.set('X-Iam-Mode', iamMode);
  if (process.env.NODE_ENV !== 'production') { try { console.debug('[apiFetch] iamMode=', iamMode, 'path=', path); } catch (_) {} }

  const bypass = getBypassHeaders();
  if (bypass) {
    // Dev simulation headers (may be ignored if server dev bypass not enabled)
    Object.entries(bypass).forEach(([k, v]) => headers.set(k, v));
    // Also attach a real bearer token if available so requests still succeed when server requires Cognito
    const existingAuth = headers.get('Authorization');
    let sess = existingAuth ? null : loadSession();
    if (sess && sess.idToken) {
      headers.set('Authorization', 'Bearer ' + sess.idToken);
    }
  } else {
    let sess = loadSession();
    if (!sess || !sess.idToken) {
      if (sessionStorage.getItem('iamBypass') === 'off' && sessionStorage.getItem('simulateSignedOut') === 'true') {
        return new Response(JSON.stringify({ error: 'simulated-unauthenticated' }), { status: 401, headers: { 'content-type': 'application/json' } });
      }
      window.location.assign(buildLoginUrl());
      return new Response(null, { status: 0, statusText: 'redirecting-to-login' });
    }
    try { sess = await ensureFreshSession() || sess; } catch (e) {
      window.location.assign(buildLoginUrl());
      return new Response(null, { status: 0, statusText: 'redirecting-to-login' });
    }
    headers.set('Authorization', 'Bearer ' + sess.idToken);
  }

  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 401 || resp.status === 403) {
    if (!bypass) {
      const simulate = sessionStorage.getItem('iamBypass') === 'off' && sessionStorage.getItem('simulateSignedOut') === 'true';
      const pending = sessionStorage.getItem('authPending') === '1';
      const onCallback = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback');
      if (simulate || pending || onCallback) return resp;
      if (resp.status === 401) {
        // Only clear session for true authentication failures
        clearSession();
        try { window.dispatchEvent(new CustomEvent('auth:needs-login')); } catch {}
      }
      return resp; // 403 is authorization issue; keep session so UI can show access denied
    }
  }
  return resp;
}