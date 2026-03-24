import React from 'react';
import { TopNavigation } from '@cloudscape-design/components';
import AdminConsoleIntroHelp from '../helpPanelContents/adminConsoleIntroHelp';
import { useAuth } from '../context/AuthContext.js';

const TopHeader = ({ currentLanguage = 'en', onLanguageChange }) => {
  const { email, role, isAuthenticated, signIn, signOut } = useAuth();
  const languageLabel = currentLanguage === 'en' ? 'English' : 'French';
  const utilities = [{
    type: 'menu-dropdown',
    text: languageLabel,
    ariaLabel: 'Select Language',
    items: [{ id: 'en', text: 'English' }, { id: 'fr', text: 'French' }],
    onItemClick: event => onLanguageChange(event.detail.id),
  }];

  const handleAccountMenuClick = event => {
    if (event.detail.id !== 'signout') return;
    signOut();
  };

  const openHelpPanel = () => {
    if (typeof window === 'undefined') return;
    try {
      const detail = {
        title: 'Admin Console Help',
        content: <AdminConsoleIntroHelp />,
        context: AdminConsoleIntroHelp.aiContext || '',
      };
      window.dispatchEvent(new CustomEvent('help:open-topnav', { detail }));
    } catch (error) {
      console.error('Failed to open help panel', error);
    }
  };

  if (isAuthenticated) {
    if (role === 'System Administrator') {
      utilities.push({ type: 'button', iconName: 'settings', ariaLabel: 'Settings', onClick: () => console.log('Settings clicked') });
    }
    utilities.push({ type: 'button', iconName: 'support', ariaLabel: 'Support', onClick: openHelpPanel });
    utilities.push({
      type: 'menu-dropdown',
      text: email || 'Account',
      ariaLabel: 'Account Options',
      items: [{ id: 'profile', text: 'My Profile' }, { id: 'signout', text: 'Sign Out' }],
      onItemClick: handleAccountMenuClick,
    });
  } else {
    utilities.push({ type: 'button', text: 'Sign in', onClick: signIn });
  }

  return (
    <div>
      <TopNavigation
        identity={{ href: '/', title: 'NWAC', logo: { src: '/nwac-logo.png', alt: 'Awentech Inc Logo' } }}
        utilities={utilities}
      />
    </div>
  );
};

export default TopHeader;
