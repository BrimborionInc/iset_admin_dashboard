import { useEffect, useState } from 'react';
import { apiFetch } from '../auth/apiClient';

const FALLBACK_ROLE_KEYS = ['demoRole', 'simRole', 'simulatedRole', 'isetRole', 'role', 'currentRole', 'userRole'];

function normaliseUserResponse(data) {
  if (!data || typeof data !== 'object') return {};
  const auth = data.auth || {};
  const profile = data.profile || {};
  const userId = auth.sub || auth.user_id || auth.id || profile.id || null;
  const displayName = auth.name || profile.name || null;
  const email = auth.email || profile.email || null;
  const role = auth.role || auth.primary_role || profile.role || null;
  return { userId: userId ? String(userId) : null, displayName, email, role };
}

function readFallbackRole() {
  for (const key of FALLBACK_ROLE_KEYS) {
    try {
      const value = window.localStorage?.getItem(key);
      if (value) return value;
    } catch (_) {
      /* noop */
    }
  }
  return null;
}

function readFallbackUserId() {
  try {
    return (
      window.sessionStorage?.getItem('devUserId') ||
      window.localStorage?.getItem('devUserId') ||
      null
    );
  } catch (_) {
    return null;
  }
}

export default function useCurrentUser() {
  const [state, setState] = useState({
    loading: true,
    userId: null,
    displayName: null,
    email: null,
    role: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!res.ok) {
          throw new Error(`Failed to load current user (${res.status})`);
        }
        const data = await res.json();
        if (cancelled) return;
        const normalised = normaliseUserResponse(data);
        const fallbackRole = normalised.role || readFallbackRole();
        setState({
          loading: false,
          userId: normalised.userId || readFallbackUserId(),
          displayName: normalised.displayName,
          email: normalised.email,
          role: fallbackRole,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        const fallbackRole = readFallbackRole();
        const fallbackId = readFallbackUserId();
        setState({
          loading: false,
          userId: fallbackId,
          displayName: null,
          email: null,
          role: fallbackRole,
          error: error?.message || 'Unable to determine current user',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
