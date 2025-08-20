import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { exchangeCodeForTokens, saveSession } from '../auth/cognito';

export default function AuthCallback() {
  const history = useHistory();
  const { search } = useLocation();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code) {
      setError('Missing authorization code');
      return;
    }
    (async () => {
      try {
        const tokens = await exchangeCodeForTokens(code);
        saveSession(tokens);
        // If a valid state (same-origin absolute URL) is provided, navigate back there; otherwise home
        let target = '/';
        if (state) {
          try {
            const decoded = atob(state);
            const url = new URL(decoded, window.location.origin);
            if (url.origin === window.location.origin) target = url.pathname + url.search + url.hash;
          } catch {}
        }
        history.replace(target);
      } catch (e) {
        setError(e.message || 'Sign-in failed');
      }
    })();
  }, [search, history]);

  return (
    <div style={{ padding: 24 }}>
      <h3>Signing you in…</h3>
      {error && <div style={{ color: 'red' }}>Error: {error}</div>}
    </div>
  );
}
