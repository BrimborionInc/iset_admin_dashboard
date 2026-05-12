// API client that always uses the active Cognito session.
import { buildLoginUrl, loadSession, ensureFreshSession, clearSession } from './cognito';

function getApiBase() {
  const runtimeBase = typeof window !== 'undefined'
    ? (window.__API_BASE__ || window.REACT_APP_API_BASE_URL)
    : null;
  return String(runtimeBase || process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001').replace(/\/+$/, '');
}

function buildApiUrl(path) {
  if (path.startsWith('http')) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBase()}${normalizedPath}`;
}

export async function apiFetch(path, options = {}) {
  const url = buildApiUrl(path);
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
