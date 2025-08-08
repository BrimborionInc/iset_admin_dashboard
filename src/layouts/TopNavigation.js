import React from 'react';
import { TopNavigation } from '@cloudscape-design/components';

function getEmailForRole(role) {
  switch (role?.value || role) {
    case 'Program Administrator':
      return 'admin@nwac.ca';
    case 'Regional Coordinator':
      return 'coordinator@nwac.ca';
    case 'System Administrator':
      return 'sysadmin@nwac.ca';
    case 'PTMA Staff':
      return 'staff@ptma.org';
    default:
      return 'user@nwac.ca';
  }
}

const TopHeader = ({ currentLanguage = 'en', onLanguageChange, currentRole }) => {
  console.log('TopNavigation received onLanguageChange:', onLanguageChange);
  return (
    <div>
      <TopNavigation
        identity={{
          href: '/',
          title: 'Awentech Solutions',
          logo: {
            src: '/bromborionLogo.png',
            alt: 'Awentech Inc Logo',
          },
        }}
        utilities={[
          {
            type: 'menu-dropdown',
            text: currentLanguage === 'en' ? 'English' : 'Français',
            ariaLabel: 'Select Language',
            items: [
              { id: 'en', text: 'English' },
              { id: 'fr', text: 'Français' },
            ],
            onItemClick: (event) => {
              console.log('Language menu clicked:', event.detail.id);  // Add this for debugging
              onLanguageChange(event.detail.id);
            },
          },
          {
            type: 'button',
            iconName: 'notification',
            ariaLabel: 'Notifications',
            onClick: () => console.log('Notifications clicked'),
          },
          {
            type: 'button',
            iconName: 'support',
            ariaLabel: 'Support',
            onClick: () => console.log('Support clicked'),
          },
          {
            type: 'button',
            iconName: 'settings',
            ariaLabel: 'Settings',
            onClick: () => console.log('Settings clicked'),
          },
          {
            type: 'menu-dropdown',
            text: getEmailForRole(currentRole),
            ariaLabel: 'Account Options',
            items: [
              { id: 'profile', text: 'My Profile' },
              { id: 'signout', text: 'Sign Out' },
            ],
          },
        ]}
      />
    </div>
  );
};

export default TopHeader;
