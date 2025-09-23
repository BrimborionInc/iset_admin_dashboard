import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import roleMatrixData from '../config/roleMatrix.json';

const STORAGE_KEY = 'iset-role-matrix';
const ROLE_ORDER = ['System Administrator', 'Program Administrator', 'Regional Coordinator', 'Application Assessor'];

const ROLE_ALIASES = {
  'Application Assessor': 'Application Assessor',
  'PTMA Staff': 'Application Assessor',
  'SysAdmin': 'System Administrator',
  'Program Admin': 'Program Administrator',
};

export const toCanonicalRole = (role) => ROLE_ALIASES[role] || role;

const RoleMatrixContext = createContext({
  roleMatrix: null,
  isLoading: false,
  error: null,
  pendingRoutes: {},
  refreshRoleMatrix: () => {},
  updateRouteRoles: () => Promise.resolve(),
});

const sanitizeRoles = (roles = []) => {
  const set = new Set();
  (Array.isArray(roles) ? roles : []).forEach(role => set.add(toCanonicalRole(role)));
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
  if (!matrix) return null;
  const baseRoutes = Object.entries(matrix.routes || {}).reduce((acc, [route, roles]) => {
    acc[route] = sortRoles(roles);
    return acc;
  }, {});
  return {
    default: matrix.default || 'deny',
    routes: sortRoutesObject(baseRoutes),
  };
};

const baseMatrix = normaliseMatrix(roleMatrixData);

const loadStoredMatrix = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normaliseMatrix(parsed);
  } catch (err) {
    console.warn('[access-control] failed to load stored role matrix:', err);
    return null;
  }
};

const persistMatrix = (matrix) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
  } catch (err) {
    console.warn('[access-control] failed to persist role matrix:', err);
  }
};

export const RoleMatrixProvider = ({ children }) => {
  const [roleMatrix, setRoleMatrix] = useState(() => loadStoredMatrix() || baseMatrix);
  const [pendingRoutes, setPendingRoutes] = useState({});

  const refreshRoleMatrix = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setRoleMatrix(baseMatrix);
  }, []);

  const updateRouteRoles = useCallback(async (route, updater) => {
    if (!route || typeof updater !== 'function') return;
    setPendingRoutes(prev => ({ ...prev, [route]: true }));
    setRoleMatrix(prev => {
      const current = prev?.routes?.[route] || [];
      const nextRoles = sortRoles(updater([...current]));
      const nextMatrix = {
        default: prev?.default || 'deny',
        routes: sortRoutesObject({
          ...(prev?.routes || {}),
          [route]: nextRoles,
        })
      };
      persistMatrix(nextMatrix);
      return nextMatrix;
    });
    setTimeout(() => {
      setPendingRoutes(prev => {
        const next = { ...prev };
        delete next[route];
        return next;
      });
    }, 150);
  }, []);

  const contextValue = useMemo(() => ({
    roleMatrix: roleMatrix || baseMatrix,
    isLoading: false,
    error: null,
    pendingRoutes,
    refreshRoleMatrix,
    updateRouteRoles,
  }), [roleMatrix, pendingRoutes, refreshRoleMatrix, updateRouteRoles]);

  return (
    <RoleMatrixContext.Provider value={contextValue}>
      {children}
    </RoleMatrixContext.Provider>
  );
};

export const useRoleMatrix = () => useContext(RoleMatrixContext);
