// Central place to derive API base URL for frontend fetches.
// Priority: window.__API_BASE__ (runtime injected) -> env REACT_APP_API_BASE_URL -> env API_BASE -> same origin.
const apiBase = (typeof window !== 'undefined' && (window.__API_BASE__ || window.REACT_APP_API_BASE_URL))
  || process.env.REACT_APP_API_BASE_URL
  || process.env.API_BASE
  || '';

export function buildApiUrl(path) {
  if (!path.startsWith('/')) path = '/' + path;
  if (!apiBase) return path; // relative fallback
  // Avoid double slash
  return apiBase.replace(/\/$/, '') + path;
}

export function getApiBase() { return apiBase; }
