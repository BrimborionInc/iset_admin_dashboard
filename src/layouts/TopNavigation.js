import React from 'react';
import { TopNavigation } from '@cloudscape-design/components';

const TopHeader = ({ currentLanguage = 'en', onLanguageChange }) => {
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
            text: 'Europe, Central Asia',
            ariaLabel: 'Select Region',
            items: [
              { id: 'region-1', text: 'Europe, Central Asia' },
              { id: 'region-2', text: 'Africa, Middle East' },
              { id: 'region-3', text: 'Americas, Caribbean' },
              { id: 'region-4', text: 'Asia, Pacific' },
              { id: 'region-5', text: 'South Asia' },
            ],
          },
          {
            type: 'menu-dropdown',
            text: 'admin@supplier.com',
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
