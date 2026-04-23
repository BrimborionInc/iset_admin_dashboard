import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../auth/apiClient';
import {
  buildLoginUrl,
  buildLogoutUrl,
  clearSession,
  getIdTokenClaims,
  getRoleFromClaims,
  hasValidSession,
  loadSession,
} from '../auth/cognito';

const EMPTY_USER = Object.freeze({
  loading: false,
  userId: null,
  staffProfileId: null,
  displayName: null,
  email: null,
  role: null,
  regionId: null,
  regionIds: [],
  groups: [],
  error: null,
});

const EMPTY_CONTEXT = Object.freeze({
  isAuthenticated: false,
  session: null,
  claims: null,
  role: null,
  currentRole: null,
  email: null,
  displayName: null,
  currentUser: EMPTY_USER,
  signIn: () => {},
  signOut: () => {},
  refreshCurrentUser: () => {},
});

const AuthContext = createContext(EMPTY_CONTEXT);

function buildSessionSnapshot() {
  const isAuthenticated = hasValidSession();
  const session = isAuthenticated ? loadSession() : null;
  const claims = isAuthenticated ? getIdTokenClaims() : null;
  const role = claims ? (getRoleFromClaims(claims) || null) : null;
  const currentRole = role ? { label: role, value: role } : null;
  return {
    isAuthenticated,
    session,
    claims,
    role,
    currentRole,
    email: claims?.email || claims?.Email || null,
    displayName: claims?.name || claims?.Name || null,
  };
}

function normaliseUserResponse(data) {
  if (!data || typeof data !== 'object') return {};
  const auth = data.auth || {};
  const profile = data.profile || {};
  const userId = auth.sub || auth.user_id || auth.id || profile.id || null;
  const staffProfileId = auth.staffProfileId || profile.id || null;
  const displayName = auth.name || profile.name || null;
  const email = auth.email || profile.email || null;
  const role = auth.role || auth.primary_role || profile.role || null;
  const regionId = auth.regionId != null ? auth.regionId : (profile.region_id != null ? profile.region_id : null);
  const regionIdsRaw = Array.isArray(auth.regionIds)
    ? auth.regionIds
    : (Array.isArray(profile.region_ids) ? profile.region_ids : null);
  const regionIds = Array.isArray(regionIdsRaw)
    ? Array.from(new Set(regionIdsRaw.map(value => Number(value)).filter(value => Number.isFinite(value))))
    : [];
  const authGroups = Array.isArray(auth.groups) ? auth.groups : [];
  const claimGroups = Array.isArray(auth?.claims?.['cognito:groups']) ? auth.claims['cognito:groups'] : [];
  const profileGroups = Array.isArray(profile.groups) ? profile.groups : [];
  const groups = Array.from(new Set([...authGroups, ...claimGroups, ...profileGroups]))
    .map(value => (typeof value === 'string' ? value.trim() : value))
    .filter(Boolean);
  return {
    userId: userId ? String(userId) : null,
    staffProfileId: staffProfileId ? String(staffProfileId) : null,
    displayName,
    email,
    role,
    regionId,
    regionIds,
    groups,
  };
}

function buildFallbackUser(sessionState, error = null, loading = false) {
  const claimGroups = Array.isArray(sessionState?.claims?.['cognito:groups'])
    ? sessionState.claims['cognito:groups'].map(value => (typeof value === 'string' ? value.trim() : value)).filter(Boolean)
    : [];
  return {
    ...EMPTY_USER,
    loading,
    displayName: sessionState?.displayName || null,
    email: sessionState?.email || null,
    role: sessionState?.role || null,
    groups: claimGroups,
    error,
  };
}

export function AuthProvider({ children }) {
  const [sessionState, setSessionState] = useState(() => buildSessionSnapshot());
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [currentUser, setCurrentUser] = useState(() =>
    sessionState.isAuthenticated ? buildFallbackUser(sessionState, null, true) : EMPTY_USER
  );

  const syncSessionState = useCallback(() => {
    setSessionState(buildSessionSnapshot());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleSessionChanged = () => syncSessionState();
    const handleStorage = event => {
      if (!event || event.key === 'authSession') {
        syncSessionState();
      }
    };

    syncSessionState();
    window.addEventListener('auth:session-changed', handleSessionChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('auth:session-changed', handleSessionChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [syncSessionState]);

  useEffect(() => {
    let cancelled = false;

    if (!sessionState.isAuthenticated) {
      setCurrentUser(EMPTY_USER);
      return undefined;
    }

    (async () => {
      setCurrentUser(buildFallbackUser(sessionState, null, true));
      try {
        const response = await apiFetch('/api/auth/me');
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || `Failed to load current user (${response.status})`);
        }
        if (cancelled) return;
        const normalised = normaliseUserResponse(data);
        setCurrentUser({
          ...EMPTY_USER,
          loading: false,
          userId: normalised.userId || null,
          staffProfileId: normalised.staffProfileId || null,
          displayName: normalised.displayName || null,
          email: normalised.email || null,
          role: normalised.role || null,
          regionId: normalised.regionId ?? null,
          regionIds: Array.isArray(normalised.regionIds) ? normalised.regionIds : [],
          groups: Array.isArray(normalised.groups) ? normalised.groups : [],
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setCurrentUser(buildFallbackUser(sessionState, error?.message || 'Unable to determine current user', false));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionState, refreshVersion]);

  const refreshCurrentUser = useCallback(() => {
    syncSessionState();
    setRefreshVersion(value => value + 1);
  }, [syncSessionState]);

  const signIn = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.location.assign(buildLoginUrl());
  }, []);

  const signOut = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearSession();
    window.location.assign(buildLogoutUrl());
  }, []);

  const effectiveUser = useMemo(() => {
    const groups = Array.isArray(currentUser.groups) && currentUser.groups.length
      ? currentUser.groups
      : buildFallbackUser(sessionState).groups;
    return {
      ...currentUser,
      displayName: currentUser.displayName || sessionState.displayName || null,
      email: currentUser.email || sessionState.email || null,
      role: currentUser.role || sessionState.role || null,
      groups,
    };
  }, [currentUser, sessionState]);

  const effectiveRole = effectiveUser.role || sessionState.role || null;

  const value = useMemo(() => ({
    isAuthenticated: sessionState.isAuthenticated,
    session: sessionState.session,
    claims: sessionState.claims,
    role: effectiveRole,
    currentRole: effectiveRole ? { label: effectiveRole, value: effectiveRole } : null,
    email: effectiveUser.email || null,
    displayName: effectiveUser.displayName || null,
    currentUser: effectiveUser,
    signIn,
    signOut,
    refreshCurrentUser,
  }), [effectiveRole, effectiveUser, refreshCurrentUser, sessionState, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
