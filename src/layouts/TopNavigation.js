import React, { useEffect, useState } from 'react';
import { TopNavigation } from '@cloudscape-design/components';
import { buildLoginUrl, buildLogoutUrl, clearSession, hasValidSession, loadSession } from '../auth/cognito';

function getEmailForRole(role) {
  switch (role?.value || role) {
    case 'Program Administrator':
      return 'admin@nwac.ca';
    case 'Regional Coordinator':
      return 'coordinator@nwac.ca';
    case 'System Administrator':
      return 'sysadmin@nwac.ca';
    case 'Application Assessor':
      return 'assessor@iset.org';
    default:
      return 'user@nwac.ca';
  }
}

function isBypassEnabled() {
  try { return sessionStorage.getItem('iamBypass') === 'off'; } catch { return false; }
}
function isSimSignedOut() {
  try { return sessionStorage.getItem('simulateSignedOut') === 'true'; } catch { return false; }
}

const TopHeader = ({ currentLanguage = 'en', onLanguageChange, currentRole }) => {
  const [signedIn, setSignedIn] = useState(() => hasValidSession());
  const [bypass, setBypass] = useState(() => isBypassEnabled());
  const [email, setEmail] = useState(() => {
    const s = loadSession();
    return s?.idToken && !isBypassEnabled()
      ? (JSON.parse(atob(s.idToken.split('.')[1]))?.email || getEmailForRole(currentRole))
      : getEmailForRole(currentRole);
  });

  useEffect(() => {
    const recompute = () => {
      const s = loadSession();
      const bypassNow = isBypassEnabled();
      setBypass(bypassNow);
      const simOut = isSimSignedOut();
      setSignedIn(bypassNow ? (!simOut && hasValidSession()) : hasValidSession());
      const newEmail = s?.idToken && !bypassNow
        ? (JSON.parse(atob(s.idToken.split('.')[1]))?.email || getEmailForRole(currentRole))
        : getEmailForRole(currentRole);
      setEmail(newEmail);
    };
    const onSessionChanged = () => recompute();
    const onStorage = (e) => {
      if (e.key === 'authSession' || e.key === 'iamBypass' || e.key === 'currentRole' || e.key === 'simulateSignedOut') recompute();
    };
    window.addEventListener('auth:session-changed', onSessionChanged);
    window.addEventListener('storage', onStorage);
    recompute();
    return () => {
      window.removeEventListener('auth:session-changed', onSessionChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [currentRole]);

  const utilities = [];
  utilities.push({
    type: 'menu-dropdown',
    text: currentLanguage === 'en' ? 'English' : 'FranÃ§ais',
    ariaLabel: 'Select Language',
    items: [{ id: 'en', text: 'English' }, { id: 'fr', text: 'FranÃ§ais' }],
    onItemClick: (event) => onLanguageChange(event.detail.id)
  });

  const roleValue = currentRole?.value || currentRole;

  const simSignedOut = isSimSignedOut();
  if ((signedIn && !simSignedOut) || (bypass && !simSignedOut)) {
    if (roleValue === 'System Administrator') {
      utilities.push({ type: 'button', iconName: 'settings', ariaLabel: 'Settings', onClick: () => console.log('Settings clicked') });
    }
    utilities.push({ type: 'button', iconName: 'support', ariaLabel: 'Support', onClick: () => console.log('Support clicked') });
    if (bypass) {
      utilities.push({
        type: 'menu-dropdown',
        text: email,
        ariaLabel: 'Dev bypass account',
        items: [{ id: 'dev-bypass', text: 'Developer bypass mode' }],
        onItemClick: () => {}
      });
    } else {
      utilities.push({
        type: 'menu-dropdown',
        text: email,
        ariaLabel: 'Account Options',
        items: [{ id: 'profile', text: 'My Profile' }, { id: 'signout', text: 'Sign Out' }],
        onItemClick: (e) => {
          if (e.detail.id === 'signout') {
            clearSession();
            window.location.href = buildLogoutUrl();
          }
        }
      });
    }
  } else {
    utilities.push({ type: 'button', text: 'Sign in', onClick: () => { window.location.href = buildLoginUrl(); } });
  }

  return (
    <div>
      <TopNavigation
        identity={{ href: '/', title: 'Awentech Solutions', logo: { src: '/bromborionLogo.png', alt: 'Awentech Inc Logo' } }}
        utilities={utilities}
      />
    </div>
  );
};

export default TopHeader;
