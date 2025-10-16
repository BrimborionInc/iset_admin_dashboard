import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { apiFetch } from '../auth/apiClient';
import roleMatrixData from '../config/roleMatrix.json';

const API_ENDPOINT = '/api/access-control/matrix';
const ROLE_ORDER = ['System Administrator', 'Program Administrator', 'Regional Coordinator', 'Application Assessor'];

const ROLE_ALIASES = {
  'Application Assessor': 'Application Assessor',
  ApplicationAssessor: 'Application Assessor',
  'PTMA Staff': 'Application Assessor',
  PTMAStaff: 'Application Assessor',
  Adjudicator: 'Application Assessor',
  SysAdmin: 'System Administrator',
  'System Admin': 'System Administrator',
  'Program Admin': 'Program Administrator',
  ProgramAdministrator: 'Program Administrator',
};

export const toCanonicalRole = (role) => ROLE_ALIASES[role] || role;

const RoleMatrixContext = createContext({
  roleMatrix: null,
  isLoading: true,
  error: null,
  pendingRoutes: {},
  reloadRoleMatrix: () => Promise.resolve(),
  refreshRoleMatrix: () => Promise.resolve(),
  updateRouteRoles: () => Promise.resolve(),
});

const sanitizeRoles = (roles = []) => {
  const set = new Set();
  (Array.isArray(roles) ? roles : []).forEach(role => {
    const canonical = toCanonicalRole(role);
    if (canonical) set.add(canonical);
  });
  set.add('System Administrator');
  return Array.from(set);
};

const sortRoles = (roles = []) => {
  const sanitized = sanitizeRoles(roles);
  const ordered = [];
  const remaining = new Set(sanitized);
  ROLE_ORDER.forEach(role => {
    if (remaining.has(role)) {
      ordered.push(role);
      remaining.delete(role);
    }
  });
  if (remaining.size > 0) {
    ordered.push(...Array.from(remaining).sort());
  }
  return ordered;
};

const sortRoutesObject = (routes = {}) => {
  return Object.keys(routes)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      acc[key] = routes[key];
      return acc;
    }, {});
};

const normaliseMatrix = (matrix) => {
  if (!matrix || typeof matrix !== 'object') return { default: 'deny', routes: {} };
  const baseRoutes = Object.entries(matrix.routes || {}).reduce((acc, [route, roles]) => {
    acc[route] = sortRoles(roles);
    return acc;
  }, {});
  const defaultPolicy = typeof matrix.default === 'string' && matrix.default.toLowerCase() === 'allow' ? 'allow' : 'deny';
  return {
    default: defaultPolicy,
    routes: sortRoutesObject(baseRoutes),
  };
};

const baseMatrix = normaliseMatrix(roleMatrixData);

const extractErrorMessage = async (response, fallback) => {
  try {
    const data = await response.json();
    if (data?.message) return data.message;
    if (data?.error) return data.error;
  } catch (_) {
    // Ignore JSON parsing errors; fallback message will be used.
  }
  return fallback;
};

export const RoleMatrixProvider = ({ children, shouldLoad = false }) => {
  const [roleMatrix, setRoleMatrix] = useState(baseMatrix);
  const [pendingRoutes, setPendingRoutes] = useState({});
  const [isLoading, setIsLoading] = useState(() => !!shouldLoad);
  const [error, setError] = useState(null);
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false);

  const fetchMatrixFromServer = useCallback(async () => {
    const response = await apiFetch(API_ENDPOINT, { method: 'GET' });
    if (!response.ok) {
      const message = await extractErrorMessage(response, 'Failed to load access control settings.');
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    const payload = await response.json();
    const matrix = normaliseMatrix(payload?.matrix || payload);
    return matrix;
  }, []);

  useEffect(() => {
    if (!shouldLoad) {
      setIsLoading(false);
      setError(null);
      setHasLoadedFromServer(false);
      setRoleMatrix(baseMatrix);
      setPendingRoutes({});
      return undefined;
    }
    if (hasLoadedFromServer) return undefined;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const matrix = await fetchMatrixFromServer();
        if (!cancelled) {
          setRoleMatrix(matrix);
          setHasLoadedFromServer(true);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err?.message || 'Failed to load access control settings.';
          setError(message);
          setRoleMatrix(baseMatrix);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldLoad, hasLoadedFromServer, fetchMatrixFromServer]);

  const persistMatrixRemote = useCallback(async (matrix) => {
    if (!shouldLoad) {
      throw new Error('Access control configuration cannot be saved while signed out.');
    }
    const response = await apiFetch(API_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matrix }),
    });
    if (!response.ok) {
      const message = await extractErrorMessage(response, 'Failed to update access control.');
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    const payload = await response.json();
    return normaliseMatrix(payload?.matrix || payload);
  }, [shouldLoad]);

  const updateRouteRoles = useCallback(async (route, updater) => {
    if (!route || typeof updater !== 'function') return;
    if (!shouldLoad) {
      throw new Error('Access control configuration is not available while signed out.');
    }
    const currentMatrix = roleMatrix || baseMatrix;
    const currentRoles = currentMatrix.routes?.[route] || [];
    const nextRoles = sortRoles(updater([...currentRoles]));
    const nextMatrix = normaliseMatrix({
      default: currentMatrix.default || 'deny',
      routes: {
        ...(currentMatrix.routes || {}),
        [route]: nextRoles,
      },
    });
    setPendingRoutes(prev => ({ ...prev, [route]: true }));
    setRoleMatrix(nextMatrix);
    setError(null);
    try {
      const saved = await persistMatrixRemote(nextMatrix);
      setRoleMatrix(saved);
      setHasLoadedFromServer(true);
    } catch (err) {
      const message = err?.message || 'Failed to update access control.';
      setRoleMatrix(currentMatrix);
      throw new Error(message);
    } finally {
      setPendingRoutes(prev => {
        const copy = { ...prev };
        delete copy[route];
        return copy;
      });
    }
  }, [roleMatrix, persistMatrixRemote, shouldLoad]);

  const reloadRoleMatrix = useCallback(async () => {
    if (!shouldLoad) {
      setRoleMatrix(baseMatrix);
      setHasLoadedFromServer(false);
      setError(null);
      setIsLoading(false);
      setPendingRoutes({});
      return baseMatrix;
    }
    setIsLoading(true);
    setError(null);
    try {
      const matrix = await fetchMatrixFromServer();
      setRoleMatrix(matrix);
      setHasLoadedFromServer(true);
      return matrix;
    } catch (err) {
      const message = err?.message || 'Failed to load access control settings.';
      setError(message);
      setRoleMatrix(baseMatrix);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [shouldLoad, fetchMatrixFromServer]);

  const refreshRoleMatrix = useCallback(async () => {
    if (!shouldLoad) {
      setRoleMatrix(baseMatrix);
      setHasLoadedFromServer(false);
      setPendingRoutes({});
      setError(null);
      setIsLoading(false);
      return baseMatrix;
    }
    setIsLoading(true);
    setError(null);
    setPendingRoutes({});
    try {
      const saved = await persistMatrixRemote(baseMatrix);
      setRoleMatrix(saved);
      setHasLoadedFromServer(true);
      return saved;
    } catch (err) {
      const message = err?.message || 'Failed to restore defaults.';
      setRoleMatrix(baseMatrix);
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [shouldLoad, persistMatrixRemote]);

  const contextValue = useMemo(() => ({
    roleMatrix: roleMatrix || baseMatrix,
    isLoading: shouldLoad ? isLoading : false,
    error,
    pendingRoutes,
    reloadRoleMatrix,
    refreshRoleMatrix,
    updateRouteRoles,
  }), [roleMatrix, isLoading, shouldLoad, error, pendingRoutes, reloadRoleMatrix, refreshRoleMatrix, updateRouteRoles]);

  return (
    <RoleMatrixContext.Provider value={contextValue}>
      {children}
    </RoleMatrixContext.Provider>
  );
};

export const useRoleMatrix = () => useContext(RoleMatrixContext);
