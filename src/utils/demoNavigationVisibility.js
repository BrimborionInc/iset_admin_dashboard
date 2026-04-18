import { apiFetch } from '../auth/apiClient';

const EVENT_NAME = 'demo-navigation-visibility';

export const DEMO_NAVIGATION_ROLES = [
  'System Administrator',
  'NWAC Administrator',
  'Regional Manager',
  'ISET Coordinator'
];

export const DEMO_NAVIGATION_DEFAULT_VISIBILITY = DEMO_NAVIGATION_ROLES.reduce((acc, role) => {
  acc[role] = false;
  return acc;
}, {});

const ROLE_ALIASES = Object.freeze({
  System_Administrator: 'System Administrator',
  'System Administrator': 'System Administrator',
  NWAC_Administrator: 'NWAC Administrator',
  'NWAC Administrator': 'NWAC Administrator',
  Regional_Manager: 'Regional Manager',
  'Regional Manager': 'Regional Manager',
  ISET_Coordinator: 'ISET Coordinator',
  'ISET Coordinator': 'ISET Coordinator',
});

let cachedVisibilityMap = { ...DEMO_NAVIGATION_DEFAULT_VISIBILITY };

function normalizeRole(role) {
  if (!role) return null;
  const raw = typeof role === 'object' && role !== null
    ? role.value || role.label || role.role || role.name
    : role;
  if (!raw) return null;
  const normalized = String(raw).trim();
  return ROLE_ALIASES[normalized] || normalized;
}

function normalizeVisibilityMap(mapLike) {
  const source = mapLike && typeof mapLike === 'object' && !Array.isArray(mapLike) && mapLike.visibility
    ? mapLike.visibility
    : mapLike;
  const normalized = { ...DEMO_NAVIGATION_DEFAULT_VISIBILITY };
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return normalized;
  }
  for (const role of DEMO_NAVIGATION_ROLES) {
    if (Object.prototype.hasOwnProperty.call(source, role)) {
      normalized[role] = !!source[role];
    }
  }
  return normalized;
}

function publishVisibilityMap(mapLike) {
  cachedVisibilityMap = normalizeVisibilityMap(mapLike);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { visibility: cachedVisibilityMap } }));
  }
  return cachedVisibilityMap;
}

async function parseConfigResponse(response, fallbackMessage) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || fallbackMessage);
  }
  const visibility = publishVisibilityMap(payload?.visibility || payload);
  return { ...(payload || {}), visibility };
}

export function applyDemoNavigationVisibility(payload) {
  return publishVisibilityMap(payload);
}

export function readDemoNavigationVisibility(role) {
  const map = cachedVisibilityMap;
  if (!role) {
    return map;
  }
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(map, normalizedRole) ? map[normalizedRole] : false;
}

export async function loadDemoNavigationVisibility() {
  const response = await apiFetch('/api/config/runtime/demo-navigation');
  return parseConfigResponse(response, 'Failed to load demo navigation visibility.');
}

export async function saveDemoNavigationVisibility(payload) {
  const visibility = normalizeVisibilityMap(payload);
  const response = await apiFetch('/api/config/runtime/demo-navigation', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visibility }),
  });
  return parseConfigResponse(response, 'Failed to save demo navigation visibility.');
}

export function subscribeToDemoNavigationVisibility(listener) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = event => {
    const map = normalizeVisibilityMap(event?.detail?.visibility);
    listener(map);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
