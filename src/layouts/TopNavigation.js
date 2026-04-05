import React from 'react';
import { TopNavigation } from '@cloudscape-design/components';
import AdminConsoleIntroHelp from '../helpPanelContents/adminConsoleIntroHelp';
import AdminFeedbackHelp from '../helpPanelContents/adminFeedbackHelp';
import { useAuth } from '../context/AuthContext.js';

const FeedbackIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5.25 7.25h5.5" />
    <path d="M5.9 4.85 8 3.25l2.1 1.6" />
    <path d="M5 10.1v-3.5A3 3 0 0 1 8 3.6a3 3 0 0 1 3 3v3.5A2.75 2.75 0 0 1 8.25 12.85h-.5A2.75 2.75 0 0 1 5 10.1Z" />
    <path d="M3.25 5.75 5 6.5" />
    <path d="M3 9.25 5 8.75" />
    <path d="M12.75 5.75 11 6.5" />
    <path d="M13 9.25 11 8.75" />
    <path d="M6.5 12.85v1.4" />
    <path d="M9.5 12.85v1.4" />
  </svg>
);

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

  const openFeedbackPanel = () => {
    if (typeof window === 'undefined') return;
    try {
      const detail = {
        title: 'Bug reporting and change requests',
        content: <AdminFeedbackHelp />,
        context: AdminFeedbackHelp.aiContext || '',
      };
      window.dispatchEvent(new CustomEvent('help:open-topnav', { detail }));
    } catch (error) {
      console.error('Failed to open feedback panel', error);
    }
  };

  if (isAuthenticated) {
    if (role === 'System Administrator') {
      utilities.push({ type: 'button', iconName: 'settings', ariaLabel: 'Settings', onClick: () => console.log('Settings clicked') });
    }
    utilities.push({ type: 'button', iconName: 'support', ariaLabel: 'Support', onClick: openHelpPanel });
    utilities.push({
      type: 'button',
      ariaLabel: 'Report a bug or request a change',
      iconSvg: <FeedbackIcon />,
      onClick: openFeedbackPanel,
    });
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
