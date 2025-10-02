import React, { useState, useEffect } from 'react';
import { I18nProvider } from '@cloudscape-design/components/i18n';
import enMessages from '@cloudscape-design/components/i18n/messages/all.en';
import frMessages from '@cloudscape-design/components/i18n/messages/all.fr';
import { DarkModeProvider } from './context/DarkModeContext.js';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import AppContent from './AppContent.js';
import TopNavigation from './layouts/TopNavigation.js';
import DemoNavigation from './layouts/DemoNavigation.js';
import BottomFooter from './layouts/BottomFooter.js';
import ErrorBoundary from './context/ErrorBoundary.js';
import { RoleMatrixProvider } from './context/RoleMatrixContext';
import LandingPage from './pages/LandingPage.jsx';
import { hasValidSession, isIamOn, getIdTokenClaims, getRoleFromClaims } from './auth/cognito';
import { readDemoNavigationVisibility, subscribeToDemoNavigationVisibility } from './utils/demoNavigationVisibility';

import '@cloudscape-design/global-styles/index.css';

const roleOptions = [
  { label: 'Program Administrator', value: 'Program Administrator' },
  { label: 'Regional Coordinator', value: 'Regional Coordinator' },
  { label: 'Application Assessor', value: 'Application Assessor' },
  { label: 'System Administrator', value: 'System Administrator' },
];

const getRoleKey = roleOption => {
  if (!roleOption) {
    return 'Program Administrator';
  }
  if (typeof roleOption === 'string') {
    return roleOption;
  }
  return roleOption.value || roleOption.label || 'Program Administrator';
};

const getInitialRole = () => {
  if (typeof window === 'undefined') {
    return roleOptions[0];
  }
  try {
    const saved = sessionStorage.getItem('currentRole');
    return saved ? JSON.parse(saved) : roleOptions[0];
  } catch {
    return roleOptions[0];
  }
};

const deriveActiveRoleName = (iamOnFlag, isAuthenticatedFlag, currentRoleOption) => {
  if (iamOnFlag && isAuthenticatedFlag) {
    const claims = getIdTokenClaims();
    const cognitoRole = getRoleFromClaims(claims);
    if (cognitoRole) {
      return cognitoRole;
    }
  }
  return getRoleKey(currentRoleOption);
};

const App = () => {
  const [currentLanguage, setCurrentLanguage] = useState('fr');
  const [currentRole, setCurrentRole] = useState(() => getInitialRole());
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasValidSession());
  const [iamEnabled, setIamEnabled] = useState(() => isIamOn());
  const [activeRole, setActiveRole] = useState(() => deriveActiveRoleName(isIamOn(), hasValidSession(), getInitialRole()));
  const [showDemoNavigation, setShowDemoNavigation] = useState(() => readDemoNavigationVisibility(deriveActiveRoleName(isIamOn(), hasValidSession(), getInitialRole())));

  const handleLanguageChange = lang => {
    setCurrentLanguage(lang);
  };

  useEffect(() => {
    console.log(`I18nProvider locale: ${currentLanguage}`);
  }, [currentLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      sessionStorage.setItem('currentRole', JSON.stringify(currentRole));
    } catch {}
  }, [currentRole]);

  useEffect(() => {
    const nextRole = deriveActiveRoleName(iamEnabled, isAuthenticated, currentRole);
    setActiveRole(prev => (prev === nextRole ? prev : nextRole));
  }, [currentRole, iamEnabled, isAuthenticated]);

  useEffect(() => {
    if (!iamEnabled || !isAuthenticated || !activeRole) {
      return;
    }
    const currentRoleValue = typeof currentRole === 'object' && currentRole !== null ? currentRole.value : currentRole;
    if (currentRoleValue !== activeRole) {
      setCurrentRole({ label: activeRole, value: activeRole });
    }
  }, [iamEnabled, isAuthenticated, activeRole, currentRole]);

  useEffect(() => {
    if (!activeRole) {
      setShowDemoNavigation(true);
      return;
    }
    setShowDemoNavigation(prev => {
      const next = readDemoNavigationVisibility(activeRole);
      return prev === next ? prev : next;
    });
  }, [activeRole]);

  useEffect(() => {
    const unsubscribe = subscribeToDemoNavigationVisibility(map => {
      const visibilityMap = map || readDemoNavigationVisibility();
      const next = activeRole && Object.prototype.hasOwnProperty.call(visibilityMap, activeRole)
        ? visibilityMap[activeRole]
        : true;
      setShowDemoNavigation(prev => (prev === next ? prev : next));
    });
    return unsubscribe;
  }, [activeRole]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateAuthState = () => {
      const authenticated = hasValidSession();
      const iamOnFlag = isIamOn();
      setIsAuthenticated(authenticated);
      setIamEnabled(iamOnFlag);
      setActiveRole(prev => {
        const nextRole = deriveActiveRoleName(iamOnFlag, authenticated, currentRole);
        return prev === nextRole ? prev : nextRole;
      });
    };

    updateAuthState();
    window.addEventListener('auth:session-changed', updateAuthState);
    window.addEventListener('storage', updateAuthState);

    return () => {
      window.removeEventListener('auth:session-changed', updateAuthState);
      window.removeEventListener('storage', updateAuthState);
    };
  }, [currentRole]);

  const LandingOrAppLayout = () => {
    const location = useLocation();
    const isAuthRoute = location.pathname.startsWith('/auth/');

    if (iamEnabled && !isAuthenticated && !isAuthRoute) {
      return <LandingPage />;
    }

    return (
      <>
        {showDemoNavigation && (
          <DemoNavigation
            currentLanguage={currentLanguage}
            onLanguageChange={handleLanguageChange}
            currentRole={currentRole}
            setCurrentRole={setCurrentRole}
          />
        )}
        <TopNavigation
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
          currentRole={currentRole}
          setCurrentRole={setCurrentRole}
        />
        <ErrorBoundary>
          <AppContent currentRole={currentRole} />
        </ErrorBoundary>
        <BottomFooter />
      </>
    );
  };

  return (
    <RoleMatrixProvider>
      <DarkModeProvider>
        <I18nProvider
          locale={currentLanguage}
          messages={currentLanguage === 'en' ? [frMessages] : [enMessages]}
        >
          <Router>
            <LandingOrAppLayout />
          </Router>
        </I18nProvider>
      </DarkModeProvider>
    </RoleMatrixProvider>
  );
};

export default App;
