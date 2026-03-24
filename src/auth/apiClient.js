// API client that always uses the active Cognito session.
import { buildLoginUrl, loadSession, ensureFreshSession, clearSession } from './cognito';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001';

export async function apiFetch(path, options = {}) {
  const isAbsolute = path.startsWith('http');
  const url = isAbsolute ? path : API_BASE + path;
  const headers = new Headers(options.headers || {});
  let sess = loadSession();
  if (!sess || !sess.idToken) {
    window.location.assign(buildLoginUrl());
    return new Response(null, { status: 0, statusText: 'redirecting-to-login' });
  }
  try { sess = await ensureFreshSession() || sess; } catch (e) {
    window.location.assign(buildLoginUrl());
    return new Response(null, { status: 0, statusText: 'redirecting-to-login' });
  }
  headers.set('Authorization', 'Bearer ' + sess.idToken);
  if (sess.accessToken) headers.set('X-Access-Token', sess.accessToken);

  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 401 || resp.status === 403) {
    if (resp.status === 401) {
      clearSession();
    }
    return resp;
  }
  return resp;
}
