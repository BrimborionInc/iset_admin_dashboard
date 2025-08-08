import React, { useState, useEffect } from 'react';
import { I18nProvider } from '@cloudscape-design/components/i18n';
import enMessages from '@cloudscape-design/components/i18n/messages/all.en';
import frMessages from '@cloudscape-design/components/i18n/messages/all.fr';
import { DarkModeProvider } from "./context/DarkModeContext.js"; // Import the context provider
import { BrowserRouter as Router } from 'react-router-dom';
import {
  AppLayout,
  BreadcrumbGroup,
  ContentLayout,
  Flashbar,
  Header,
  HelpPanel,
  Link,
  SplitPanel,
  Box,
  SpaceBetween,
  Button,
} from '@cloudscape-design/components';
import AppContent from './AppContent.js';
import TopNavigation from './layouts/TopNavigation.js';
import DemoNavigation from './layouts/DemoNavigation.js';
import BottomFooter from './layouts/BottomFooter.js';
import SideNavigation from './layouts/SideNavigation.js';
import AdminDashboard from './pages/adminDashboardHomePage.js';
import UserManagementDashboard from './pages/manageUsers.js';
import LocationsManagementDashboard from './pages/manageLocations.js';
import ModifyLocation from './pages/modifyLocation.js';
import NewLocationForm from './pages/newLocationForm.js';
import CodeTablesDashboard from './pages/codeTablesDashboard.js';
import TestConfigDashboard from './pages/testConfigDashboard.js';
import ServiceModulesManagementDashboard from './pages/manageServiceModules.js';
import ModifyServiceModule from './pages/modifyServiceModule.js';
import BookAppointmentQ1 from './previews/bookAppointmentQ1.js';
import BookAppointmentQ2 from './previews/bookAppointmentQ2.js';
import BookAppointmentQ3 from './previews/bookAppointmentQ3.js';
import BookAppointmentQ4 from './previews/bookAppointmentQ4.js';
import BookAppointmentQ5 from './previews/bookAppointmentQ5.js';
import BookAppointmentQ6 from './previews/bookAppointmentQ6.js';
import BookAppointmentQ7 from './previews/bookAppointmentQ7.js';
import BookAppointmentQ8 from './previews/bookAppointmentQ8.js';
import { helpMessages } from './utils/helpMessages.js';
import Icon from '@cloudscape-design/components/icon';
import { ItemsPalette, BoardItem } from '@cloudscape-design/board-components';
import ErrorBoundary from './context/ErrorBoundary.js';
import SlotManagementWidget from './widgets/slotManagementWidget.js';

import '@cloudscape-design/global-styles/index.css';

const roleOptions = [
  { label: 'Program Administrator', value: 'Program Administrator' },
  { label: 'Regional Coordinator', value: 'Regional Coordinator' },
  { label: 'PTMA Staff', value: 'PTMA Staff' },
  { label: 'System Administrator', value: 'System Administrator' },
];

const App = () => {
  const [currentLanguage, setCurrentLanguage] = useState('fr');
  const [currentRole, setCurrentRole] = useState(roleOptions[0]);

  const handleLanguageChange = (lang) => {
    setCurrentLanguage(lang);
  };

  useEffect(() => {
    console.log(`I18nProvider locale: ${currentLanguage}`);
  }, [currentLanguage]);

  return (
    <DarkModeProvider>
      <I18nProvider
        locale={currentLanguage}
        messages={currentLanguage === 'en' ? [frMessages] : [enMessages]}
      >
        <Router>
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
        </Router>
      </I18nProvider>
    </DarkModeProvider>
  );
};

export default App;
