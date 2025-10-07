import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Resilient data loading hook tailored for dashboard widgets.
 * Handles retries with exponential backoff, aborts on unmount, and exposes a refresh helper.
 *
 * @param {(ctx: { signal: AbortSignal }) => Promise<any>} fetcher - async function that returns widget data.
 * @param {Object} options
 * @param {Array<any>} [options.dependencies=[]] - dependencies that should trigger a reload when changed.
 * @param {*} [options.initialData=null] - data returned before the first successful load.
 * @param {number} [options.maxRetries=2] - number of retry attempts after the initial failure.
 * @param {number} [options.initialDelay=400] - delay (ms) before the first retry.
 * @param {number} [options.maxDelay=4000] - maximum delay (ms) between retries.
 * @param {boolean} [options.immediate=true] - load immediately on mount.
 */
export function useWidgetDataLoader(fetcher, {
  dependencies = [],
  initialData = null,
  maxRetries = 2,
  initialDelay = 400,
  maxDelay = 4000,
  immediate = true
} = {}) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState(immediate ? 'loading' : 'idle');
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(false);

  const disposeController = () => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (_) { /* ignore */ }
      abortRef.current = null;
    }
  };

  const load = useCallback(async (mode = 'auto') => {
    disposeController();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    const isManual = mode === 'manual';
    setStatus(prev => {
      if (isManual && prev === 'success') return 'refreshing';
      if (prev === 'success' && mode === 'dep-change') return 'refreshing';
      return 'loading';
    });
    setError(null);

    let attempt = 0;
    let delay = initialDelay;
    const totalAttempts = Math.max(0, maxRetries) + 1;

    while (attempt < totalAttempts) {
      if (!mountedRef.current || signal.aborted) break;
      try {
        const result = await fetcher({ signal });
        if (!mountedRef.current || signal.aborted) return;
        setData(result);
        setStatus('success');
        setError(null);
        return result;
      } catch (err) {
        if (signal.aborted || !mountedRef.current) return;
        const isLastAttempt = attempt >= totalAttempts - 1;
        if (isLastAttempt) {
          setStatus('error');
          setError(err);
          return null;
        }
        await sleep(Math.min(delay, maxDelay));
        delay = Math.min(delay * 2, maxDelay);
      }
      attempt += 1;
    }
    return null;
  }, [fetcher, initialDelay, maxDelay, maxRetries]);

  const refresh = useCallback(() => load('manual'), [load]);

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      load('auto');
    } else {
      setStatus('idle');
    }
    return () => {
      mountedRef.current = false;
      disposeController();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedDeps = Array.isArray(dependencies) ? dependencies : [dependencies];
  const depsSignature = useMemo(() => {
    if (!normalizedDeps.length) return '__empty__';
    return normalizedDeps.map((value, index) => {
      if (value === null) return `null:${index}`;
      const type = typeof value;
      if (type === 'object') {
        if (value instanceof Date) return `date:${value.getTime()}`;
        try {
          return `obj:${JSON.stringify(value)}`;
        } catch (_) {
          return `obj:${String(value)}`;
        }
      }
      if (type === 'function') {
        return `fn:${value.name || 'anonymous'}:${index}`;
      }
      if (type === 'undefined') return `undefined:${index}`;
      if (Number.isNaN(value)) return `nan:${index}`;
      return `prim:${String(value)}:${index}`;
    }).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...normalizedDeps]);

  useEffect(() => {
    if (!mountedRef.current) return;
    if (!immediate) return;
    load('dep-change');
  }, [immediate, load, depsSignature]);

  const isLoading = status === 'loading';
  const isRefreshing = status === 'refreshing';

  return {
    data,
    status,
    error,
    isLoading,
    isRefreshing,
    refresh,
  };
}

export default useWidgetDataLoader;
