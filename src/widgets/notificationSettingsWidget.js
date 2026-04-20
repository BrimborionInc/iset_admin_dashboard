import React, { useState, useEffect } from 'react';
import { Box, Header, ButtonDropdown, Link, Table, Toggle, Select, SpaceBetween, Button, Flashbar, FormField, Input } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import NotificationSettingsWidgetHelp from '../helpPanelContents/notificationSettingsWidgetHelp';
import { apiFetch } from '../auth/apiClient';

const DEFAULT_LANGUAGE = 'en'; // Adjust as needed

const NONE_TEMPLATE_OPTION = { label: 'No template', value: '__none__' };
const EMAIL_SETTINGS_FALLBACK = 'ISET@awentech.ca';
const SENDER_NAME_FALLBACK = 'NWAC PATH';

const APPLICANT_ROLE_VALUE = 'applicant';
const APPLICANT_ROLE = Object.freeze({ value: APPLICANT_ROLE_VALUE, label: 'Applicant' });

const toKey = (value) => (value === null || value === undefined ? '' : String(value));

const ensureArray = (value) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.data)) return value.data;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.rows)) return value.rows;
  }
  return [];
};

const cloneEventRows = (rows = []) => rows.map(event => ({
  ...event,
  children: Array.isArray(event.children) ? event.children.map(child => ({ ...child })) : [],
}));

const normaliseRoleValue = (value) => {
  const key = toKey(value);
  if (!key) return key;
  if (key.toLowerCase() === APPLICANT_ROLE_VALUE) return APPLICANT_ROLE_VALUE;
  return key;
};

const normaliseRolesList = (rolesData) => {
  const normalised = ensureArray(rolesData)
    .map((role) => {
      const rawValue =
        role?.value ??
        role?.RoleName ??
        role?.name ??
        role?.id ??
        role?.RoleID ??
        null;

      const value = normaliseRoleValue(rawValue);

      if (!value) return null;

      const label = role?.label ?? role?.name ?? role?.RoleName ?? value;

      return { ...role, value, label };
    })
    .filter(Boolean);

  const hasApplicant = normalised.some((role) => toKey(role.value).toLowerCase() === APPLICANT_ROLE_VALUE);
  if (!hasApplicant) {
    normalised.push({ ...APPLICANT_ROLE });
  }

  return normalised;
};

const buildTemplateOptions = (templatesData) => {
  const options = ensureArray(templatesData).map((template) => ({
    value: toKey(template?.id),
    label: template?.name || `Template ${template?.id}`,
  }));
  return [NONE_TEMPLATE_OPTION, ...options];
};

const toTemplatePayloadValue = (option) => {
  if (!option || option.value === undefined || option.value === null) return null;
  if (option.value === NONE_TEMPLATE_OPTION.value) return null;
  const numeric = Number(option.value);
  return Number.isNaN(numeric) ? option.value : numeric;
};

const buildEventRows = (eventsData, rolesList, templateOptions, settingsData) => {
  const templateMap = new Map(templateOptions.map((option) => [option.value, option]));
  const settingsArray = ensureArray(settingsData);

  return ensureArray(eventsData).map((event) => {
    const eventId = toKey(
      event?.value ??
      event?.event ??
      event?.event_type ??
      event?.id ??
      ''
    );

    const eventLabel = event?.label || event?.name || eventId;
    const description = event?.description || '';

    const children = ensureArray(rolesList)
      .map((role) => {
        const roleValue = toKey(role?.value);
        if (!roleValue) return null;

        const setting = settingsArray.find(
          (s) =>
            toKey(s?.event) === eventId &&
            normaliseRoleValue(s?.role) === roleValue &&
            (s?.language || DEFAULT_LANGUAGE) === DEFAULT_LANGUAGE,
        );

        const templateOption =
          setting && setting.template_id !== undefined && setting.template_id !== null
            ? templateMap.get(toKey(setting.template_id)) || null
            : null;

        return {
          id: `${eventId}_${roleValue}`,
          role,
          enabled: setting ? !!setting.enabled : false,
          template: templateOption || null,
          settingId: setting ? setting.id : null,
          emailAlert: setting ? !!setting.email_alert : false,
          bellAlert: setting ? !!setting.bell_alert : false,
        };
      })
      .filter(Boolean);

    return {
      eventId,
      eventLabel,
      description,
      children,
    };
  });
};

const parseJsonOrThrow = async (response, label) => {
  if (response.status === 204) return [];

  let body;
  try {
    body = await response.json();
  } catch (err) {
    if (response.ok) return [];
    throw new Error(`${label}: ${err?.message || 'Unable to parse response'}`);
  }

  if (!response.ok) {
    const detail = body && (body.error || body.message);
    throw new Error(`${label}${detail ? `: ${detail}` : ''}`);
  }

  return body;
};

const normaliseTemplateSelection = (option) => {
  if (!option || option.value === NONE_TEMPLATE_OPTION.value) {
    return null;
  }
  return option;
};

const normaliseEmailInput = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
};

const normaliseTextInput = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmailInput(value));

const NotificationSettingsWidget = ({ actions, toggleHelpPanel }) => {
  const [expandedEventIds, setExpandedEventIds] = useState([]);
  const [events, setEvents] = useState([]);
  const [savedEvents, setSavedEvents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [senderEmail, setSenderEmail] = useState('');
  const [savedSenderEmail, setSavedSenderEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [savedSenderName, setSavedSenderName] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [savedReplyTo, setSavedReplyTo] = useState('');
  const [fallbackSenderEmail, setFallbackSenderEmail] = useState(EMAIL_SETTINGS_FALLBACK);
  const [fallbackSenderName, setFallbackSenderName] = useState(SENDER_NAME_FALLBACK);
  const [fallbackReplyTo, setFallbackReplyTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flashMessages, setFlashMessages] = useState([]);
  const [senderValidationError, setSenderValidationError] = useState('');
  const [replyToValidationError, setReplyToValidationError] = useState('');

  const loadAllData = async () => {
    const [eventsRes, rolesRes, templatesRes, settingsRes, senderSettingsRes] = await Promise.all([
      apiFetch('/api/events'),
      apiFetch('/api/roles'),
      apiFetch('/api/templates'),
      apiFetch('/api/notifications'),
      apiFetch('/api/config/notifications/email-settings'),
    ]);

    const [eventsRaw, rolesRaw, templatesRaw, settingsRaw, senderSettingsRaw] = await Promise.all([
      parseJsonOrThrow(eventsRes, 'Load notification events'),
      parseJsonOrThrow(rolesRes, 'Load available roles'),
      parseJsonOrThrow(templatesRes, 'Load notification templates'),
      parseJsonOrThrow(settingsRes, 'Load notification settings'),
      parseJsonOrThrow(senderSettingsRes, 'Load notification email settings'),
    ]);

    const normalisedRoles = normaliseRolesList(rolesRaw);
    const templateOptions = buildTemplateOptions(templatesRaw);
    const eventRows = buildEventRows(eventsRaw, normalisedRoles, templateOptions, settingsRaw);

    return {
      eventRows,
      templateOptions,
      senderEmail: normaliseEmailInput(senderSettingsRaw?.senderEmail || ''),
      senderName: normaliseTextInput(senderSettingsRaw?.senderName || ''),
      replyTo: normaliseEmailInput(senderSettingsRaw?.replyTo || ''),
      fallbackSenderEmail:
        normaliseEmailInput(senderSettingsRaw?.fallbackSenderEmail || '') || EMAIL_SETTINGS_FALLBACK,
      fallbackSenderName:
        normaliseTextInput(senderSettingsRaw?.fallbackSenderName || '') || SENDER_NAME_FALLBACK,
      fallbackReplyTo: normaliseEmailInput(senderSettingsRaw?.fallbackReplyTo || ''),
    };
  };

  // Fetch all reference data and settings
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setFlashMessages([]);

      try {
        const {
          eventRows,
          templateOptions,
          senderEmail: loadedSenderEmail,
          senderName: loadedSenderName,
          replyTo: loadedReplyTo,
          fallbackSenderEmail: loadedFallbackSenderEmail,
          fallbackSenderName: loadedFallbackSenderName,
          fallbackReplyTo: loadedFallbackReplyTo,
        } = await loadAllData();

        if (cancelled) return;

        const preparedRows = cloneEventRows(eventRows);
        setEvents(preparedRows);
        setSavedEvents(cloneEventRows(preparedRows));
        setTemplates(templateOptions);
        setSenderEmail(loadedSenderEmail);
        setSavedSenderEmail(loadedSenderEmail);
        setSenderName(loadedSenderName);
        setSavedSenderName(loadedSenderName);
        setReplyTo(loadedReplyTo);
        setSavedReplyTo(loadedReplyTo);
        setFallbackSenderEmail(loadedFallbackSenderEmail);
        setFallbackSenderName(loadedFallbackSenderName);
        setFallbackReplyTo(loadedFallbackReplyTo);
        setSenderValidationError('');
        setReplyToValidationError('');
        setDirty(false);
      } catch (error) {
        if (cancelled) return;

        console.error('Failed to load notification settings', error);

        setEvents([]);
        setSavedEvents([]);
        setTemplates([]);

        setFlashMessages([
          {
            type: 'error',
            content: error.message || 'Failed to load notification settings. Please retry.',
            dismissible: true,
            onDismiss: () => setFlashMessages([]),
            id: 'notif-load-error',
          },
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  const markDirty = () => setDirty(true);

  const handleSenderEmailChange = ({ detail }) => {
    const nextValue = normaliseEmailInput(detail.value);
    setSenderEmail(nextValue);
    if (!nextValue || isValidEmail(nextValue)) {
      setSenderValidationError('');
    } else {
      setSenderValidationError('Enter a valid email address.');
    }
    markDirty();
  };

  const handleSenderNameChange = ({ detail }) => {
    setSenderName(normaliseTextInput(detail.value));
    markDirty();
  };

  const handleReplyToChange = ({ detail }) => {
    const nextValue = normaliseEmailInput(detail.value);
    setReplyTo(nextValue);
    if (!nextValue || isValidEmail(nextValue)) {
      setReplyToValidationError('');
    } else {
      setReplyToValidationError('Enter a valid email address.');
    }
    markDirty();
  };

  const handleToggle = (parentIdx, childIdx) => {
    setEvents((current) =>
      current.map((event, i) =>
        i === parentIdx
          ? {
              ...event,
              children: event.children.map((child, j) =>
                j === childIdx ? { ...child, enabled: !child.enabled } : child,
              ),
            }
          : event,
      ),
    );

    markDirty();
  };

  const handleTemplateChange = (parentIdx, childIdx, newTemplate) => {
    setEvents((current) =>
      current.map((event, i) =>
        i === parentIdx
          ? {
              ...event,
              children: event.children.map((child, j) =>
                j === childIdx ? { ...child, template: newTemplate } : child,
              ),
            }
          : event,
      ),
    );

    markDirty();
  };

  const handleEmailAlertToggle = (parentIdx, childIdx) => {
    setEvents((current) =>
      current.map((event, i) =>
        i === parentIdx
          ? {
              ...event,
              children: event.children.map((child, j) =>
                j === childIdx ? { ...child, emailAlert: !child.emailAlert } : child,
              ),
            }
          : event,
      ),
    );

    markDirty();
  };

  const handleBellAlertToggle = (parentIdx, childIdx) => {
    setEvents((current) =>
      current.map((event, i) =>
        i === parentIdx
          ? {
              ...event,
              children: event.children.map((child, j) =>
                j === childIdx ? { ...child, bellAlert: !child.bellAlert } : child,
              ),
            }
          : event,
      ),
    );

    markDirty();
  };

  const handleSave = async () => {
    setSaving(true);
    setFlashMessages([]);

    const normalizedSenderEmail = normaliseEmailInput(senderEmail);
    const normalizedSenderName = normaliseTextInput(senderName);
    const normalizedReplyTo = normaliseEmailInput(replyTo);
    const senderChanged =
      normalizedSenderEmail !== savedSenderEmail ||
      normalizedSenderName !== savedSenderName ||
      normalizedReplyTo !== savedReplyTo;

    if (normalizedSenderEmail && !isValidEmail(normalizedSenderEmail)) {
      setSaving(false);
      setSenderValidationError('Enter a valid email address.');
      setFlashMessages([
        {
          type: 'error',
          content: 'Enter a valid sender email address before saving.',
          dismissible: true,
          onDismiss: () => setFlashMessages([]),
          id: 'notif-save-sender-invalid',
        },
      ]);
      return;
    }

    if (normalizedReplyTo && !isValidEmail(normalizedReplyTo)) {
      setSaving(false);
      setReplyToValidationError('Enter a valid email address.');
      setFlashMessages([
        {
          type: 'error',
          content: 'Enter a valid reply-to email address before saving.',
          dismissible: true,
          onDismiss: () => setFlashMessages([]),
          id: 'notif-save-replyto-invalid',
        },
      ]);
      return;
    }

    try {
      const changed = [];

      events.forEach((event, parentIdx) => {
        event.children.forEach((child, childIdx) => {
          const savedChild = savedEvents[parentIdx]?.children?.[childIdx];

          const savedTemplate = savedChild?.template?.value || null;
          const currentTemplate = child.template?.value || null;

          if (
            !savedChild ||
            savedChild.enabled !== child.enabled ||
            savedTemplate !== currentTemplate ||
            (!!savedChild?.emailAlert !== !!child.emailAlert) ||
            (!!savedChild?.bellAlert !== !!child.bellAlert)
          ) {
            const settingId = savedChild?.settingId ?? child.settingId ?? null;
            const roleValue = child.role?.value || child.role;

            changed.push({
              id: settingId,
              event: event.eventId,
              role: roleValue,
              template_id: toTemplatePayloadValue(child.template),
              language: DEFAULT_LANGUAGE,
              enabled: child.enabled ? 1 : 0,
              email_alert: child.emailAlert ? 1 : 0,
              bell_alert: child.bellAlert ? 1 : 0,
            });
          }
        });
      });

      if (!changed.length && !senderChanged) {
        setSaving(false);
        setDirty(false);
        setFlashMessages([
          {
            type: 'info',
            content: 'No changes to save.',
            dismissible: true,
            onDismiss: () => setFlashMessages([]),
            id: 'notif-save-info',
          },
        ]);
        return;
      }

      if (changed.length) {
        await Promise.all(
          changed.map(async (payload) => {
            const response = await apiFetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            let body = null;

            try {
              body = await response.json();
            } catch (err) {
              body = null;
            }

            if (!response.ok || (body && body.error)) {
              const detail = body && (body.error || body.message);

              throw new Error(
                detail ||
                  `Failed to save setting for ${payload.event} (${payload.role})`,
              );
            }
          }),
        );
      }

      if (senderChanged) {
        const senderResponse = await apiFetch('/api/config/notifications/email-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderEmail: normalizedSenderEmail || null,
            senderName: normalizedSenderName || null,
            replyTo: normalizedReplyTo || null,
          }),
        });

        let senderBody = null;
        try {
          senderBody = await senderResponse.json();
        } catch (err) {
          senderBody = null;
        }

        if (!senderResponse.ok || (senderBody && senderBody.error)) {
          const detail = senderBody && (senderBody.error || senderBody.message);
          throw new Error(detail || 'Failed to save notification email settings.');
        }
      }

      const {
        eventRows,
        templateOptions,
        senderEmail: loadedSenderEmail,
        senderName: loadedSenderName,
        replyTo: loadedReplyTo,
        fallbackSenderEmail: loadedFallbackSenderEmail,
        fallbackSenderName: loadedFallbackSenderName,
        fallbackReplyTo: loadedFallbackReplyTo,
      } = await loadAllData();

      const preparedRows = cloneEventRows(eventRows);
      setEvents(preparedRows);
      setSavedEvents(cloneEventRows(preparedRows));
      setTemplates(templateOptions);
      setSenderEmail(loadedSenderEmail);
      setSavedSenderEmail(loadedSenderEmail);
      setSenderName(loadedSenderName);
      setSavedSenderName(loadedSenderName);
      setReplyTo(loadedReplyTo);
      setSavedReplyTo(loadedReplyTo);
      setFallbackSenderEmail(loadedFallbackSenderEmail);
      setFallbackSenderName(loadedFallbackSenderName);
      setFallbackReplyTo(loadedFallbackReplyTo);
      setSenderValidationError('');
      setReplyToValidationError('');
      setDirty(false);
      setSaving(false);

      setFlashMessages([
        {
          type: 'success',
          content: 'Notification settings saved successfully.',
          dismissible: true,
          onDismiss: () => setFlashMessages([]),
          id: 'notif-save-success',
        },
      ]);
    } catch (error) {
      console.error('Failed to save notification settings', error);
      setSaving(false);
      setFlashMessages([
        {
          type: 'error',
          content: error.message || 'Failed to save notification settings.',
          dismissible: true,
          onDismiss: () => setFlashMessages([]),
          id: 'notif-save-error',
        },
      ]);
    }
  };

  const handleCancel = () => {
    setEvents(cloneEventRows(savedEvents));
    setSenderEmail(savedSenderEmail);
    setSenderName(savedSenderName);
    setReplyTo(savedReplyTo);
    setSenderValidationError('');
    setReplyToValidationError('');
    setDirty(false);
    setFlashMessages([]);
  };

  const items = events.map((event, parentIdx) => ({
    ...event,
    parentIdx,
    isParent: true,
    children: (event.children || []).map((child, childIdx) => ({
      ...child,
      parentIdx,
      childIdx,
      isParent: false,
    })),
  }));

  const expandedItems = expandedEventIds
    .map((eventId) => items.find((e) => e.eventId === eventId))
    .filter(Boolean);

  const columnDefinitions = [
    {
      id: 'event',
      header: 'Event',
      cell: (item) => (item.isParent ? item.eventLabel : ''),
      isRowHeader: true,
      minWidth: 180,
    },
    {
      id: 'role',
      header: 'Role',
      cell: (item) => (item.isParent ? '' : item.role?.label || item.role?.value || ''),
      minWidth: 160,
    },
    {
      id: 'enabled',
      header: 'Enabled',
      cell: (item) =>
        item.isParent ? (
          ''
        ) : (
          <Toggle
            checked={item.enabled}
            onChange={() => handleToggle(item.parentIdx, item.childIdx)}
            ariaLabel={`Enable notification for ${events[item.parentIdx]?.eventLabel || 'event'} (${item.role?.label || item.role?.value || 'role'})`}
          />
        ),
      minWidth: 100,
    },
    {
      id: 'template',
      header: 'Notification Template',
      cell: (item) => {
        if (item.isParent) return '';

        const validOption =
          templates.find((t) => t.value === item.template?.value) || null;
        const noneOption = templates.find((t) => t.value === NONE_TEMPLATE_OPTION.value) || NONE_TEMPLATE_OPTION;
        const selectedOption = validOption || (item.template ? null : noneOption);

        return (
          <Select
            selectedOption={selectedOption}
            onChange={({ detail }) =>
              handleTemplateChange(
                item.parentIdx,
                item.childIdx,
                normaliseTemplateSelection(detail.selectedOption),
              )
            }
            options={templates}
            placeholder="Select template"
            expandToViewport
          />
        );
      },
      minWidth: 200,
    },
    {
      id: 'emailAlert',
      header: 'Email alert?',
      cell: (item) =>
        item.isParent ? (
          ''
        ) : (
          <Toggle
            checked={!!item.emailAlert}
            onChange={() =>
              handleEmailAlertToggle(item.parentIdx, item.childIdx)
            }
            ariaLabel={`Enable email alert for ${events[item.parentIdx]?.eventLabel || 'event'} (${item.role?.label || item.role?.value || 'role'})`}
          />
        ),
      minWidth: 120,
    },
    {
      id: 'bellAlert',
      header: 'Bell alert?',
      cell: (item) =>
        item.isParent ? (
          ''
        ) : (
          <Toggle
            checked={!!item.bellAlert}
            onChange={() =>
              handleBellAlertToggle(item.parentIdx, item.childIdx)
            }
            ariaLabel={`Enable bell alert for ${events[item.parentIdx]?.eventLabel || 'event'} (${item.role?.label || item.role?.value || 'role'})`}
          />
        ),
      minWidth: 120,
    },
  ];

  return (
    <BoardItem
      header={
        <Header
          actions={
            <SpaceBetween direction="horizontal" size="s">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={!dirty || saving}
                loading={saving}
              >
                Save
              </Button>

              <Button
                variant="link"
                onClick={handleCancel}
                disabled={!dirty || saving}
              >
                Cancel
              </Button>
            </SpaceBetween>
          }
          info={
            <Link
              variant="info"
              onFollow={() =>
                toggleHelpPanel &&
                NotificationSettingsWidgetHelp &&
                toggleHelpPanel(
                  <NotificationSettingsWidgetHelp />,
                  'Notification Settings Help',
                )
              }
            >
              Info
            </Link>
          }
        >
          Notifications Settings
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription:
          'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription:
          'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <p>
        Events in the ISET application process can be assigned notifications and
        linked to message templates. Current build: English only and doesn't use
        the template (i.e. just standard <i>application submitted</i> type
        messages). Messages are sent by secure messaging, and may or may not be
        accompanied by a regular email saying{' '}
        <i>you have a new secure message</i>.
      </p>

      {flashMessages.length > 0 && <Flashbar items={flashMessages} />}

      <Box margin={{ bottom: 'l' }}>
        <SpaceBetween size="m">
          <FormField
            label="PATH sender name"
            description={`Shown as the From display name for PATH-generated emails. Leave blank to fall back to ${fallbackSenderName || SENDER_NAME_FALLBACK}.`}
          >
            <Input
              value={senderName}
              onChange={handleSenderNameChange}
              placeholder={fallbackSenderName || SENDER_NAME_FALLBACK}
            />
          </FormField>

          <FormField
            label="PATH sender email"
            description={`Used as the From address for PATH-generated SES emails. Leave blank to fall back to ${fallbackSenderEmail || EMAIL_SETTINGS_FALLBACK}.`}
            errorText={senderValidationError || undefined}
          >
            <Input
              type="email"
              value={senderEmail}
              onChange={handleSenderEmailChange}
              placeholder={fallbackSenderEmail || EMAIL_SETTINGS_FALLBACK}
            />
          </FormField>

          <FormField
            label="PATH reply-to email"
            description={
              fallbackReplyTo
                ? `Used as the Reply-To address for PATH-generated emails. Leave blank to fall back to ${fallbackReplyTo}.`
                : 'Used as the Reply-To address for PATH-generated emails. Use a monitored mailbox.'
            }
            errorText={replyToValidationError || undefined}
          >
            <Input
              type="email"
              value={replyTo}
              onChange={handleReplyToChange}
              placeholder={fallbackReplyTo || 'iset@nwac.ca'}
            />
          </FormField>
        </SpaceBetween>
      </Box>

      <Box>
        <Table
          columnDefinitions={columnDefinitions}
          expandableRows={{
            getItemChildren: (item) => item.children,
            isItemExpandable: (item) =>
              Boolean(item.children && item.children.length),
            expandedItems: expandedItems,
            onExpandableItemToggle: ({ detail }) => {
              setExpandedEventIds((prev) => {
                const eventId = detail.item.eventId;

                if (detail.expanded) {
                  return [...prev, eventId];
                }

                return prev.filter((id) => id !== eventId);
              });
            },
          }}
          items={items}
          variant="embedded"
          stripedRows
          loading={loading}
        />
      </Box>
    </BoardItem>
  );
};

export default NotificationSettingsWidget;
