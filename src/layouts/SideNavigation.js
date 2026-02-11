import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SideNavigation as CloudscapeSideNavigation, Badge, Hotspot } from '@cloudscape-design/components';
import { isIamOn, hasValidSession, getIdTokenClaims, getRoleFromClaims } from '../auth/cognito';
import { useRoleMatrix, toCanonicalRole } from '../context/RoleMatrixContext';
import { apiFetch } from '../auth/apiClient';

const SideNavigation = ({ currentRole, showTutorialHotspots = false, notificationCount = 0, refreshNotifications, notificationsLoading = false }) => {
  const pruneSections = (items = []) =>
    items.filter(item => {
      if (!item) return false;
      if (item.type !== 'section') return true;
      const childItems = Array.isArray(item.items) ? item.items.filter(Boolean) : [];
      return childItems.length > 0;
    });

  const history = useHistory();
  const { roleMatrix } = useRoleMatrix();
  const [, forceRerender] = useState(0);
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const raw = sessionStorage.getItem('sideNavExpanded');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    const onChange = () => forceRerender(t => t + 1);
    window.addEventListener('auth:session-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('auth:session-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem('sideNavExpanded', JSON.stringify(Array.from(expandedSections))); } catch {}
  }, [expandedSections]);

  useEffect(() => {
    if (!showTutorialHotspots) return;
    setExpandedSections(prev => {
      if (prev.has('Support')) return prev;
      const next = new Set(prev);
      next.add('Support');
      return next;
    });
  }, [showTutorialHotspots]);

  const iamOn = isIamOn();
  const simSignedOut = (() => { try { return sessionStorage.getItem('simulateSignedOut') === 'true'; } catch { return false; } })();
  const signedIn = hasValidSession();
  const tokenRole = getRoleFromClaims(getIdTokenClaims());
  const effectiveRole = (iamOn && signedIn && tokenRole) ? { value: tokenRole } : currentRole;
  const [contactCount, setContactCount] = useState(null);
  const [messageCount, setMessageCount] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    const fetchCount = async status => {
      const params = new URLSearchParams({ pageSize: '1' });
      if (status) params.append('status', status);
      const response = await apiFetch(`/api/admin/contact-messages?${params.toString()}`, { method: 'GET', signal: controller.signal });
      if (!response.ok) {
        const error = new Error('Failed to load contact messages');
        error.status = response.status;
        throw error;
      }
      const data = await response.json();
      return Number(data?.total ?? 0);
    };

    async function loadCounts() {
      try {
        const [newCount, inProgressCount] = await Promise.all([fetchCount('new'), fetchCount('in-progress')]);
        if (!isCancelled) setContactCount(newCount + inProgressCount);
      } catch (error) {
        if (!isCancelled) {
          console.error('[SideNavigation] contact count fetch failed', error);
          setContactCount(null);
        }
      }
    }

    loadCounts();
    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadMessageCount() {
      try {
        const resp = await apiFetch('/api/me/staff-messages/counts', { method: 'GET', signal: controller.signal });
        if (!resp.ok) throw new Error(`status ${resp.status}`);
        const json = await resp.json();
        const unread = Number(json?.inbox?.unread ?? 0);
        if (!cancelled) setMessageCount(unread);
      } catch (err) {
        if (!cancelled) {
          console.error('[SideNavigation] message count fetch failed', err);
          setMessageCount(null);
        }
      }
    }
    loadMessageCount();
    const onRefresh = () => loadMessageCount();
    window.addEventListener('staff-messages:refresh', onRefresh);
    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener('staff-messages:refresh', onRefresh);
    };
  }, []);

  const allNavItems = [
    {
      type: 'section',
      text: 'New ISET Applications',
      items: [
        { type: 'link', text: 'Application Assessment', href: '/case-assignment-dashboard' },
      ],
    },
    {
      type: 'section',
      text: 'Current ISET Clients',
      items: [
        { type: 'link', text: 'Case Management', href: '/iset/cases' },
        { type: 'link', text: 'My Case Queue', href: '/case-management' },
      ],
    },
    {
      type: 'section',
      text: 'Budgets and Payments',
      items: [
        { type: 'link', text: 'Finance Overview', href: '/finance/overview' },
        { type: 'link', text: 'Budgets', href: '/finance/budgets' },
        { type: 'link', text: 'Allocations & Transfers', href: '/finance/allocations' },
        { type: 'link', text: 'Payments', href: '/finance/payments' },
        { type: 'link', text: 'Reconciliation', href: '/finance/reconciliation' },
        { type: 'link', text: 'Financial Reports', href: '/finance/reports' },
        { type: 'link', text: 'Monitoring & Evidence', href: '/finance/monitoring' },
        { type: 'link', text: 'Forecasting & Scenarios', href: '/finance/forecasting' },
        { type: 'link', text: 'Finance Settings', href: '/finance/settings' },
      ],
    },
    {
      type: 'section',
      text: 'Prepare ESDC XML',
      items: [
        { type: 'link', text: 'Overview', href: '/esdc/overview' },
        { type: 'link', text: 'ILMP Exports', href: '/esdc/participants' },
        { type: 'link', text: 'Reporting', href: '/esdc/reporting' },
      ],
    },
    {
      type: 'section',
      text: 'Edit Digital Forms',
      items: [
        { type: 'link', text: 'Manage Intake Steps', href: '/manage-components' },
        { type: 'link', text: 'Manage Workflows', href: '/manage-workflows' },
      ],
    },
    {
      type: 'section',
      text: 'Analytics Dashboard',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'Reporting and Monitoring', href: '/reporting-and-monitoring-dashboard' },
      ],
    },
    {
      type: 'section',
      text: 'ISET Administration',
      items: [
        { type: 'link', text: 'NWAC Hub Management', href: '/nwac-hub-management' },
        { type: 'link', text: 'PTMA Management', href: '/ptma-management' },
      ],
    },
    {
      type: 'section',
      text: 'Configuration',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'User Management', href: '/user-management-dashboard' },
        { type: 'link', text: 'Release Management', href: '/release-management-dashboard' },
        { type: 'link', text: 'Notification Settings', href: '/manage-notifications' },
        { type: 'link', text: 'Template Editor', href: '/template-editor' },
        { type: 'link', text: 'Language Settings', href: '/language-settings-dashboard' },
        { type: 'link', text: 'Event Logging', href: '/configuration/events' },
        { type: 'link', text: 'Configuration Settings', href: '/configuration-settings' },
        { type: 'link', text: 'Query Editor', href: '/configuration/query-editor' },
        { type: 'link', text: 'File Upload Config', href: '/admin/upload-config' },
      ],
    },
    {
      type: 'section',
      text: 'Security',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'Audit and Logs', href: '/audit-logs-dashboard' },
        { type: 'link', text: 'Security Settings', href: '/manage-security-options' },
        { type: 'link', text: 'Access Control', href: '/access-control' },
      ],
    },
    {
      type: 'section',
      text: 'Support',
      defaultExpanded: false,
      items: [
        { type: 'link', text: 'Guidance', href: '/documentation' },
        {
          type: 'link',
          text: 'Tutorials',
          href: '/tutorials-dashboard',
          info: showTutorialHotspots ? (
            <Hotspot hotspotId="intro-tutorials-link" direction="right" />
          ) : undefined,
        },
        { type: 'link', text: 'Help and Support', href: '/help-support-dashboard' },
      ],
    },
  ];

  const notificationsFooterItem = useMemo(() => {
    const item = {
      type: 'link',
      id: 'footer-notifications',
      text: 'Notifications',
      href: '#refresh-notifications',
      external: false,
    };

    if (notificationCount > 0) {
      item.info = (
        <span style={{ display: 'inline-flex', pointerEvents: 'none' }} aria-hidden="true">
          <Badge color="red">{notificationCount}</Badge>
        </span>
      );
    }

    return item;
  }, [notificationCount]);

  const messagesFooterItem = useMemo(() => {
    const placeholderCount = messageCount ?? 0;
    return {
      type: 'link',
      id: 'footer-messages',
      text: 'Messages',
      href: '/messages',
      external: false,
      info: (
        <span style={{ display: 'inline-flex', pointerEvents: 'none' }} aria-hidden="true">
          <Badge color={placeholderCount > 0 ? 'blue' : 'grey'}>{placeholderCount}</Badge>
        </span>
      ),
    };
  }, [messageCount]);

  function isAllowed(href, roleValue) {
    if (!href) return true;
    const allowed = roleMatrix?.routes?.[href];
    const canonicalRole = toCanonicalRole(roleValue);
    if (allowed) return allowed.includes(canonicalRole);
    if (roleMatrix?.default === 'deny') return false;
    return true;
  }

  function filterNavItemsForRole(role, signedOut) {
    if (signedOut) {
      const supportSection = allNavItems.find(section => section.text === 'Support');
      return supportSection ? pruneSections([{ ...supportSection, defaultExpanded: true }]) : [];
    }

    const roleValue = role?.value || role;
    const canonicalRole = toCanonicalRole(roleValue);

    const filteredSections = allNavItems.map(section => {
      if (!section.items) return section;
      return {
        ...section,
        items: section.items.filter(item => isAllowed(item.href, canonicalRole)),
      };
    });

    const footerItems = [];
    const ensureDivider = () => {
      if (!footerItems.some(item => item?.type === 'divider')) {
        footerItems.push({ type: 'divider' });
      }
    };

    if (isAllowed('/contact-communications', canonicalRole)) {
      ensureDivider();
      const contactLink = {
        type: 'link',
        href: '/contact-communications',
        text: 'Contact Communications',
        id: 'footer-contact-communications',
      };
      if (contactCount !== null && contactCount >= 0) {
        contactLink.info = (
          <span style={{ display: 'inline-flex', pointerEvents: 'none' }} aria-hidden="true">
            <Badge color={contactCount > 0 ? 'blue' : 'grey'}>
              {contactCount}
            </Badge>
          </span>
        );
      }
      footerItems.push(contactLink);
    }

    if (isAllowed('/manage-notifications', canonicalRole)) {
      ensureDivider();
      const existingContactIndex = footerItems.findIndex(item => item?.href === '/contact-communications');
      const insertAt = existingContactIndex >= 0 ? existingContactIndex + 1 : footerItems.length;
      footerItems.splice(insertAt, 0, notificationsFooterItem);
    }

    if (isAllowed('/messages', canonicalRole)) {
      ensureDivider();
      const notificationsIndex = footerItems.findIndex(item => item?.id === 'footer-notifications');
      const insertAt = notificationsIndex >= 0 ? notificationsIndex + 1 : footerItems.length;
      footerItems.splice(insertAt, 0, messagesFooterItem);
    }

    return [...pruneSections(filteredSections), ...footerItems];
  }

  const filteredNavItems = filterNavItemsForRole(effectiveRole, (iamOn && !signedIn) || (!iamOn && simSignedOut));

  const itemsWithExpandState = useMemo(() => {
    const apply = (items) => items.map(item => {
      if (item?.type === 'section') {
        const key = item.text || item.href || JSON.stringify(item);
        return {
          ...item,
          defaultExpanded: expandedSections.has(key),
          items: item.items ? apply(item.items) : item.items,
        };
      }
      return item;
    });
    return apply(filteredNavItems);
  }, [filteredNavItems, expandedSections]);

  return (
    <Hotspot hotspotId="intro-side-navigation" direction="right">
      <CloudscapeSideNavigation
        header={{
          href: '/',
          text: 'Homepage',
        }}
        items={itemsWithExpandState}
        onChange={(e) => {
          const detail = e?.detail;
          const item = detail?.item;
          if (item?.type === 'section') {
            const key = item.text || item.href || JSON.stringify(item);
            setExpandedSections(prev => {
              const next = new Set(prev);
              if (detail?.expanded) next.add(key); else next.delete(key);
              return next;
            });
          }
        }}
        onFollow={(e) => {
          const detail = e?.detail;
          const item = detail?.item;
          if (item?.id === 'footer-notifications') {
            e.preventDefault();
            if (notificationsLoading) {
              return;
            }
            if (typeof refreshNotifications === 'function') {
              try {
                const result = refreshNotifications();
                if (result && typeof result.catch === 'function') {
                  result.catch(err => console.error('[SideNavigation] notification refresh failed', err));
                }
              } catch (err) {
                console.error('[SideNavigation] notification refresh failed', err);
              }
            }
            return;
          }

          if (detail && detail.href && !detail.external) {
            e.preventDefault();
            history.push(detail.href);
          }
        }}
      />
    </Hotspot>
  );
};

export default SideNavigation;
