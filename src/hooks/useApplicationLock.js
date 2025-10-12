import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../auth/apiClient';

const DEFAULT_STATE = {
  status: 'idle',
  lock: null,
  error: null,
  reason: null,
  owned: false,
  localOwner: false,
};

const HEARTBEAT_MINIMUM_MS = 30_000;
const HEARTBEAT_MAXIMUM_MS = 5 * 60_000;

const cloneDefaultState = () => ({ ...DEFAULT_STATE });

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const formatLockOwner = (lock) => {
  if (!lock) return null;
  return lock.ownerDisplayName || lock.ownerEmail || lock.ownerUserId || null;
};

export const buildLockConflictMessage = (input, defaultMessage = 'This record is currently locked by another user.') => {
  const detail = typeof input === 'object' && input !== null ? input : { reason: input };
  const reason = (detail.reason || detail.error || '').toString().toLowerCase();
  const lock = detail.lock || null;
  const owner = formatLockOwner(lock);
  const expiresAt = lock?.expiresAt ? new Date(lock.expiresAt) : null;
  const expiresSegment = expiresAt && !Number.isNaN(expiresAt.getTime())
    ? ` until ${expiresAt.toLocaleString()}`
    : '';

  if (reason === 'identity_missing' || reason === 'lock_identity_missing') {
    return 'We could not verify your staff identity for locking. Please refresh the page or sign in again.';
  }
  if (reason === 'lock_required' || reason === 'missing' || reason === 'expired') {
    return 'Your editing session expired. Select edit again to reacquire the lock.';
  }
  if (reason === 'owned_by_other' || reason === 'locked') {
    if (owner) {
      return `This record is locked by ${owner}${expiresSegment}. Try again once they finish.`;
    }
    return defaultMessage;
  }
  return detail.message || defaultMessage;
};

const normalizeLock = (rawLock, fallbackApplicationId) => {
  if (!rawLock || typeof rawLock !== 'object') {
    return {
      applicationId: fallbackApplicationId ?? null,
      ownerUserId: null,
      ownerDisplayName: null,
      ownerEmail: null,
      acquiredAt: null,
      expiresAt: null,
      ttlMinutes: null,
      heartbeatMinutes: null,
      reused: false,
    };
  }

  const normalized = {
    applicationId: Number(rawLock.application_id ?? rawLock.applicationId ?? fallbackApplicationId ?? null) || null,
    ownerUserId: rawLock.owner_user_id ?? rawLock.ownerUserId ?? null,
    ownerDisplayName: rawLock.owner_display_name ?? rawLock.ownerDisplayName ?? null,
    ownerEmail: rawLock.owner_email ?? rawLock.ownerEmail ?? null,
    acquiredAt: toIsoOrNull(rawLock.acquired_at ?? rawLock.acquiredAt),
    expiresAt: toIsoOrNull(rawLock.expires_at ?? rawLock.expiresAt),
    ttlMinutes: isFiniteNumber(rawLock.ttl_minutes ?? rawLock.ttlMinutes)
      ? Number(rawLock.ttl_minutes ?? rawLock.ttlMinutes)
      : null,
    heartbeatMinutes: isFiniteNumber(rawLock.heartbeat_minutes ?? rawLock.heartbeatMinutes)
      ? Number(rawLock.heartbeat_minutes ?? rawLock.heartbeatMinutes)
      : null,
    reused: Boolean(rawLock.reused),
  };

  return normalized;
};

const computeHeartbeatMs = (lock) => {
  if (!lock) return null;
  const ttlMinutes = isFiniteNumber(lock.ttlMinutes) ? Number(lock.ttlMinutes) : null;
  const heartbeatMinutes = isFiniteNumber(lock.heartbeatMinutes) ? Number(lock.heartbeatMinutes) : null;

  let intervalMinutes = null;
  if (heartbeatMinutes && heartbeatMinutes > 0) {
    intervalMinutes = heartbeatMinutes;
  } else if (ttlMinutes && ttlMinutes > 0) {
    if (ttlMinutes <= 1) {
      intervalMinutes = 0.75;
    } else if (ttlMinutes <= 5) {
      intervalMinutes = Math.max(0.75, ttlMinutes - 1);
    } else {
      intervalMinutes = Math.max(Math.floor(ttlMinutes * 0.5), 1);
    }
  }

  if (!intervalMinutes || intervalMinutes <= 0) return null;
  const intervalMs = intervalMinutes * 60_000;
  return Math.max(HEARTBEAT_MINIMUM_MS, Math.min(intervalMs, HEARTBEAT_MAXIMUM_MS));
};

export const useApplicationLock = (applicationId, options = {}) => {
  const { autoHeartbeat = true } = options;
  const [state, setState] = useState(() => cloneDefaultState());
  const stateRef = useRef(state);
  const heartbeatRef = useRef(null);
  const pendingAppIdRef = useRef(applicationId);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      if (typeof window !== 'undefined' && window.clearInterval) {
        window.clearInterval(heartbeatRef.current);
      } else {
        clearInterval(heartbeatRef.current);
      }
      heartbeatRef.current = null;
    }
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    return () => {
      clearHeartbeat();
    };
  }, [clearHeartbeat]);

  const performAcquire = useCallback(async ({ force = false, ttlMinutes, silent = false } = {}) => {
    if (!applicationId) {
      const message = 'Unable to acquire a lock: no application selected.';
      if (!silent) {
        setState({
          status: 'failed',
          lock: null,
          error: message,
          reason: 'invalid_application_id',
          owned: false,
          localOwner: false,
        });
      }
      return { ok: false, status: 400, reason: 'invalid_application_id', message };
    }

    if (!silent) {
      setState((prev) => ({
        ...prev,
        status: 'acquiring',
        error: null,
        reason: null,
      }));
    }

    try {
      const payload = {};
      if (isFiniteNumber(ttlMinutes) && Number(ttlMinutes) > 0) {
        payload.ttlMinutes = Math.round(Number(ttlMinutes));
      }
      if (force) {
        payload.force = true;
      }
      const response = await apiFetch(`/api/locks/application/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let body = null;
      try {
        body = await response.json();
      } catch (_) {
        body = null;
      }

      if (!response.ok) {
        const reason = body?.reason || body?.error || (response.status === 423 ? 'locked' : 'lock_acquire_failed');
        const normalizedLock = normalizeLock(body?.lock, applicationId);
        const message = buildLockConflictMessage({ reason, lock: normalizedLock });
        clearHeartbeat();
        setState({
          status: 'failed',
          lock: normalizedLock,
          error: message,
          reason,
          owned: false,
          localOwner: false,
        });
        return { ok: false, status: response.status, reason, lock: normalizedLock, message, body };
      }

      const normalizedLock = normalizeLock(body?.lock, applicationId);
      const previous = stateRef.current;
      const localOwner = previous.owned ? previous.localOwner : !normalizedLock.reused;
      const nextState = {
        status: 'acquired',
        lock: normalizedLock,
        error: null,
        reason: null,
        owned: true,
        localOwner,
      };
      setState(nextState);

      if (autoHeartbeat && localOwner && typeof window !== 'undefined' && window.setInterval) {
        const heartbeatMs = computeHeartbeatMs(normalizedLock);
        if (heartbeatMs) {
          clearHeartbeat();
          heartbeatRef.current = window.setInterval(() => {
            performAcquire({ ttlMinutes: normalizedLock.ttlMinutes, silent: true }).catch(() => {});
          }, heartbeatMs);
        }
      } else if (!localOwner) {
        clearHeartbeat();
      }

      return { ok: true, status: response.status, lock: normalizedLock, localOwner, reused: normalizedLock.reused };
    } catch (error) {
      clearHeartbeat();
      if (!silent) {
        setState({
          status: 'failed',
          lock: null,
          error: error?.message || 'Failed to acquire lock (network error).',
          reason: 'network_error',
          owned: false,
          localOwner: false,
        });
      }
      return { ok: false, status: 0, reason: 'network_error', message: error?.message || 'Network error' };
    }
  }, [applicationId, autoHeartbeat, clearHeartbeat]);

  const acquireLock = useCallback(
    (options) => performAcquire({ ...options, silent: false }),
    [performAcquire]
  );

  const refreshLock = useCallback(() => {
    const currentLock = stateRef.current.lock;
    return performAcquire({ ttlMinutes: currentLock?.ttlMinutes, silent: true });
  }, [performAcquire]);

  const releaseLock = useCallback(async ({ force = false, silent = false } = {}) => {
    const current = stateRef.current;
    if (!applicationId || !current.owned) {
      clearHeartbeat();
      setState(cloneDefaultState());
      return { ok: true, released: false, skipped: true };
    }

    if (!current.localOwner) {
      clearHeartbeat();
      setState(cloneDefaultState());
      return { ok: true, released: false, skipped: true };
    }

    clearHeartbeat();
    setState((prev) => ({ ...prev, status: 'releasing' }));

    try {
      const init = { method: 'DELETE' };
      if (force) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify({ force: true });
      }
      const response = await apiFetch(`/api/locks/application/${applicationId}`, init);
      if (!response.ok && response.status !== 404) {
        let body = null;
        try {
          body = await response.json();
        } catch (_) {
          body = null;
        }
        const message = body?.message || 'Failed to release lock.';
        if (!silent) {
          setState({
            status: 'error',
            lock: current.lock,
            error: message,
            reason: body?.error || 'release_failed',
            owned: false,
            localOwner: false,
          });
        } else {
          setState(cloneDefaultState());
        }
        return { ok: false, status: response.status, message, body };
      }
    } catch (error) {
      if (!silent) {
        setState({
          status: 'error',
          lock: current.lock,
          error: error?.message || 'Failed to release lock.',
          reason: 'release_failed',
          owned: false,
          localOwner: false,
        });
      } else {
        setState(cloneDefaultState());
      }
      return { ok: false, status: 0, message: error?.message || 'Network error' };
    }

    setState(cloneDefaultState());
    return { ok: true, released: true };
  }, [applicationId, clearHeartbeat]);

  useEffect(() => {
    if (pendingAppIdRef.current && pendingAppIdRef.current !== applicationId) {
      // Release any lock held for the previous application id.
      const previousId = pendingAppIdRef.current;
      const previous = stateRef.current;
      if (previousId && previous.owned && previous.localOwner) {
        apiFetch(`/api/locks/application/${previousId}`, { method: 'DELETE' }).catch(() => {});
      }
      clearHeartbeat();
      setState(cloneDefaultState());
    }
    pendingAppIdRef.current = applicationId;
  }, [applicationId, clearHeartbeat]);

  useEffect(() => {
    return () => {
      clearHeartbeat();
      releaseLock({ silent: true }).catch(() => {});
    };
  }, [clearHeartbeat, releaseLock]);

  return {
    lockState: state,
    acquireLock,
    refreshLock,
    releaseLock,
    isLockedByMe: state.owned && state.localOwner,
  };
};

export default useApplicationLock;
