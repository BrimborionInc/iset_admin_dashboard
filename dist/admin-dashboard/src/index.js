import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@cloudscape-design/global-styles/index.css';
// Include GOV.UK Frontend styles to ensure portal renderer components display faithfully inside admin preview.
// Prefer local copy (built via govuk-frontend assets pipeline) to avoid external network dependency.
import './css/govuk-frontend.min.css';

// Dev-only: warn on raw fetch /api calls lacking Authorization (helps catch missed apiFetch migrations)
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (function monkeyPatchFetch() {
    if (window.__FETCH_PATCHED__) return; window.__FETCH_PATCHED__ = true;
    const orig = window.fetch;
    window.fetch = async function patchedFetch(input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        const headers = (init && init.headers) || (input && input.headers) || {};
        const hdrObj = headers instanceof Headers ? headers : new Headers(headers);
        const hasAuth = !!hdrObj.get('Authorization');
        const hasBypass = !!(hdrObj.get('X-Dev-Bypass') || hdrObj.get('x-dev-bypass'));
        if (/\/api\//.test(url) && !hasAuth && !hasBypass) {
          // console.warn noise filtered by single line prefix
          console.warn('[raw-fetch-no-auth]', url);
        }
      } catch (_) { /* ignore */ }
      return orig.apply(this, arguments);
    };
  })();
}

// In development, silence benign ResizeObserver loop errors to avoid the full-screen overlay
// See: https://github.com/WICG/resize-observer/issues/38
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const ignoreResizeObserverError = (ev) => {
    try {
      const msg = (ev && ev.message)
        || (ev && ev.reason && ev.reason.message)
        || (ev && ev.error && ev.error.message)
        || '';
      if (typeof msg === 'string' && (
        msg.includes('ResizeObserver loop limit exceeded') ||
        msg.includes('ResizeObserver loop completed with undelivered notifications')
      )) {
        ev.preventDefault && ev.preventDefault();
        // Stop other listeners (including React's error overlay) from seeing this benign error
        ev.stopImmediatePropagation && ev.stopImmediatePropagation();
        return true;
      }
    } catch (_) { /* noop */ }
    return false;
  };
  // Use capture to run before bubble listeners
  window.addEventListener('error', ignoreResizeObserverError, true);
  window.addEventListener('unhandledrejection', ignoreResizeObserverError, true);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App />
);

// Define or remove reportWebVitals if not used
// import reportWebVitals from './reportWebVitals';
// reportWebVitals();
