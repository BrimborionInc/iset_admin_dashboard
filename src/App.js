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
import { hasValidSession, isIamOn } from './auth/cognito';

import '@cloudscape-design/global-styles/index.css';

const roleOptions = [
  { label: 'Program Administrator', value: 'Program Administrator' },
  { label: 'Regional Coordinator', value: 'Regional Coordinator' },
  { label: 'Application Assessor', value: 'Application Assessor' },
  { label: 'System Administrator', value: 'System Administrator' },
];

const App = () => {
  const [currentLanguage, setCurrentLanguage] = useState('fr');
  const [currentRole, setCurrentRole] = useState(() => {
    try {
      const saved = sessionStorage.getItem('currentRole');
      return saved ? JSON.parse(saved) : roleOptions[0];
    } catch {
      return roleOptions[0];
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasValidSession());
  const [iamEnabled, setIamEnabled] = useState(() => isIamOn());

  const handleLanguageChange = (lang) => {
    setCurrentLanguage(lang);
  };

  useEffect(() => {
    console.log(`I18nProvider locale: ${currentLanguage}`);
  }, [currentLanguage]);

  useEffect(() => {
    try {
      sessionStorage.setItem('currentRole', JSON.stringify(currentRole));
    } catch {}
  }, [currentRole]);

  useEffect(() => {
    const updateAuthState = () => {
      setIsAuthenticated(hasValidSession());
      setIamEnabled(isIamOn());
    };

    updateAuthState();
    window.addEventListener('auth:session-changed', updateAuthState);
    window.addEventListener('storage', updateAuthState);

    return () => {
      window.removeEventListener('auth:session-changed', updateAuthState);
      window.removeEventListener('storage', updateAuthState);
    };
  }, []);

  const LandingOrAppLayout = () => {
    const location = useLocation();
    const isAuthRoute = location.pathname.startsWith('/auth/');

    if (iamEnabled && !isAuthenticated && !isAuthRoute) {
      return <LandingPage />;
    }

    return (
      <>
        <DemoNavigation
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
          currentRole={currentRole}
          setCurrentRole={setCurrentRole}
        />
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
