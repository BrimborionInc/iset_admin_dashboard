// Minimal React AuthProvider skeleton for Cognito Hosted UI (OIDC Code + PKCE)
// Note: This is a placeholder skeleton; full implementation will handle redirects, token exchange, refresh, and idle-timeout.
import React, { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { idToken, accessToken, expiresAt, role, regionId, userId }

  const value = useMemo(() => ({ session, setSession }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
