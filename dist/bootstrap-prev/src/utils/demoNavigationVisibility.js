const STORAGE_KEY = 'demoNavigationVisible';
const EVENT_NAME = 'demo-navigation-visibility';

export const DEMO_NAVIGATION_ROLES = [
  'System Administrator',
  'Program Administrator',
  'Regional Coordinator',
  'Application Assessor'
];

export const DEMO_NAVIGATION_DEFAULT_VISIBILITY = DEMO_NAVIGATION_ROLES.reduce((acc, role) => {
  acc[role] = true;
  return acc;
}, {});

function getLocalStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function getSessionStorage() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function normalizeVisibilityMap(mapLike) {
  const normalized = { ...DEMO_NAVIGATION_DEFAULT_VISIBILITY };
  if (!mapLike || typeof mapLike !== 'object') {
    return normalized;
  }
  for (const role of DEMO_NAVIGATION_ROLES) {
    if (Object.prototype.hasOwnProperty.call(mapLike, role)) {
      normalized[role] = !!mapLike[role];
    }
  }
  return normalized;
}

function readRawVisibilityValue() {
  if (typeof window === 'undefined') {
    return null;
  }
  const storages = [getLocalStorage(), getSessionStorage()];
  for (const storage of storages) {
    if (!storage) continue;
    const raw = storage.getItem(STORAGE_KEY);
    if (raw != null) {
      return raw;
    }
  }
  return null;
}

function readVisibilityMap() {
  const raw = readRawVisibilityValue();
  if (raw == null) {
    return { ...DEMO_NAVIGATION_DEFAULT_VISIBILITY };
  }
  if (raw === 'true' || raw === 'false') {
    const visible = raw === 'true';
    return DEMO_NAVIGATION_ROLES.reduce((acc, role) => {
      acc[role] = visible;
      return acc;
    }, {});
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const mapFromArray = parsed.reduce((acc, entry) => {
        if (entry && typeof entry === 'object' && entry.role) {
          acc[entry.role] = !!entry.visible;
        }
        return acc;
      }, {});
      return normalizeVisibilityMap(mapFromArray);
    }
    return normalizeVisibilityMap(parsed);
  } catch {
    return { ...DEMO_NAVIGATION_DEFAULT_VISIBILITY };
  }
}

function persistVisibilityMap(map) {
  if (typeof window === 'undefined') {
    return map;
  }
  const payload = JSON.stringify(map);
  const local = getLocalStorage();
  const session = getSessionStorage();
  if (local) {
    try { local.setItem(STORAGE_KEY, payload); } catch {/* ignore */}
  }
  if (session) {
    try { session.setItem(STORAGE_KEY, payload); } catch {/* ignore */}
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { visibility: map } }));
  return map;
}

export function readDemoNavigationVisibility(role) {
  const map = readVisibilityMap();
  if (!role) {
    return map;
  }
  return Object.prototype.hasOwnProperty.call(map, role) ? map[role] : true;
}

export function writeDemoNavigationVisibility(payload, visible) {
  const current = readVisibilityMap();
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return persistVisibilityMap(normalizeVisibilityMap({ ...current, ...payload }));
  }
  if (typeof payload === 'string') {
    const next = { ...current, [payload]: !!visible };
    return persistVisibilityMap(normalizeVisibilityMap(next));
  }
  return persistVisibilityMap(current);
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

