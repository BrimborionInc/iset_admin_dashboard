import React, { useEffect, useState } from 'react';
import { I18nProvider } from '@cloudscape-design/components/i18n';
import enMessages from '@cloudscape-design/components/i18n/messages/all.en';
import frMessages from '@cloudscape-design/components/i18n/messages/all.fr';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { DarkModeProvider } from './context/DarkModeContext.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { RoleMatrixProvider } from './context/RoleMatrixContext';
import AppContent from './AppContent.js';
import TopNavigation from './layouts/TopNavigation.js';
import DemoNavigation from './layouts/DemoNavigation.js';
import BottomFooter from './layouts/BottomFooter.js';
import ErrorBoundary from './context/ErrorBoundary.js';
import LandingPage from './pages/LandingPage.jsx';
import AuthCallback from './pages/AuthCallback.js';
import { readDemoNavigationVisibility, subscribeToDemoNavigationVisibility } from './utils/demoNavigationVisibility';

import '@cloudscape-design/global-styles/index.css';

const RoutedAppLayout = ({ currentLanguage, onLanguageChange }) => {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();
  const isAuthRoute = location.pathname.startsWith('/auth/');
  const [showDemoNavigation, setShowDemoNavigation] = useState(() =>
    readDemoNavigationVisibility(role || null)
  );

  useEffect(() => {
    if (!role) {
      setShowDemoNavigation(true);
      return;
    }
    setShowDemoNavigation(prev => {
      const next = readDemoNavigationVisibility(role);
      return prev === next ? prev : next;
    });
  }, [role]);

  useEffect(() => {
    const unsubscribe = subscribeToDemoNavigationVisibility(map => {
      const visibilityMap = map || readDemoNavigationVisibility();
      const next = role && Object.prototype.hasOwnProperty.call(visibilityMap, role)
        ? visibilityMap[role]
        : true;
      setShowDemoNavigation(prev => (prev === next ? prev : next));
    });
    return unsubscribe;
  }, [role]);

  if (isAuthRoute) {
    return <AuthCallback />;
  }

  if (!isAuthenticated) {
    return <LandingPage currentLanguage={currentLanguage} onLanguageChange={onLanguageChange} />;
  }

  return (
    <RoleMatrixProvider shouldLoad={isAuthenticated}>
      <>
        {showDemoNavigation && (
          <DemoNavigation
            currentLanguage={currentLanguage}
            onLanguageChange={onLanguageChange}
          />
        )}
        <TopNavigation
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
        />
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
        <BottomFooter />
      </>
    </RoleMatrixProvider>
  );
};

const App = () => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    if (typeof window === 'undefined') {
      return 'en';
    }
    try {
      return sessionStorage.getItem('currentLanguage') || 'en';
    } catch {
      return 'en';
    }
  });

  const handleLanguageChange = lang => {
    setCurrentLanguage(lang);
    try {
      sessionStorage.setItem('currentLanguage', lang);
    } catch {}
  };

  useEffect(() => {
    console.log(`I18nProvider locale: ${currentLanguage}`);
  }, [currentLanguage]);

  return (
    <AuthProvider>
      <DarkModeProvider>
        <I18nProvider
          locale={currentLanguage}
          messages={currentLanguage === 'fr' ? [frMessages] : [enMessages]}
        >
          <Router>
            <RoutedAppLayout
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
            />
          </Router>
        </I18nProvider>
      </DarkModeProvider>
    </AuthProvider>
  );
};

export default App;
