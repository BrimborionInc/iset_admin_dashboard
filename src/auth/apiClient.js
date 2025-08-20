// API client that attaches Cognito ID token when IAM is on, or sends dev-bypass headers when off.
import { buildLoginUrl, loadSession, ensureFreshSession } from './cognito';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

function getBypassHeaders() {
  try {
    const flag = sessionStorage.getItem('iamBypass') === 'off';
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
    const token = sessionStorage.getItem('devBypassToken') || 'local-dev-secret';
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

  const bypass = getBypassHeaders();
  if (bypass) {
    Object.entries(bypass).forEach(([k, v]) => headers.set(k, v));
  } else {
    let sess = loadSession();
    if (!sess || !sess.idToken) {
      // Not signed in
      if (sessionStorage.getItem('iamBypass') === 'off' && sessionStorage.getItem('simulateSignedOut') === 'true') {
        // In simulation mode, avoid navigation; return a faux 401 so callers can render the signed-out UX
        return new Response(JSON.stringify({ error: 'simulated-unauthenticated' }), { status: 401, headers: { 'content-type': 'application/json' } });
      }
      window.location.assign(buildLoginUrl());
      return new Response(null, { status: 0, statusText: 'redirecting-to-login' });
    }
    // Attempt refresh if near expiry
    try {
      sess = await ensureFreshSession() || sess;
    } catch (e) {
      window.location.assign(buildLoginUrl());
      return new Response(null, { status: 0, statusText: 'redirecting-to-login' });
    }
    headers.set('Authorization', 'Bearer ' + sess.idToken);
  }

  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 401 || resp.status === 403) {
    if (!bypass) {
      if (sessionStorage.getItem('iamBypass') === 'off' && sessionStorage.getItem('simulateSignedOut') === 'true') {
        // Still simulate signed-out without leaving the page
        return resp;
      }
      window.location.assign(buildLoginUrl());
    }
  }
  return resp;
}
