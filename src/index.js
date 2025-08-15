import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@cloudscape-design/global-styles/index.css';

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
