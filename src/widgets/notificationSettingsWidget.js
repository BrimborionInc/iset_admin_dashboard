import React, { useState, useEffect } from 'react';
import { Box, Header, ButtonDropdown, Link, Table, Toggle, Select, SpaceBetween, Button, Flashbar } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import NotificationSettingsWidgetHelp from '../helpPanelContents/notificationSettingsWidgetHelp';

const DEFAULT_LANGUAGE = 'en'; // Adjust as needed
const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

const NotificationSettingsWidget = ({ actions, toggleHelpPanel }) => {
  const [expandedEventIds, setExpandedEventIds] = useState([]);
  const [events, setEvents] = useState([]); // working draft
  const [savedEvents, setSavedEvents] = useState([]); // last loaded from backend
  const [templates, setTemplates] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flashMessages, setFlashMessages] = useState([]);

  // Fetch all reference data and settings
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const eventsRes = await fetch(`${API_BASE}/api/events`);
      const eventsData = await eventsRes.json();
      const rolesRes = await fetch(`${API_BASE}/api/roles`);
      const rolesData = await rolesRes.json();
      const templatesRes = await fetch(`${API_BASE}/api/templates`);
      const templatesData = await templatesRes.json();
      const settingsRes = await fetch(`${API_BASE}/api/notifications`);
      const settingsData = await settingsRes.json();
      const eventRows = eventsData.map(event => {
        const children = rolesData.map(role => {
          const setting = settingsData.find(s => s.event === event.value && s.role === role.value && s.language === DEFAULT_LANGUAGE);
          const template = setting
            ? templatesData.find(t => t.id === setting.template_id) || null
            : null;
          return {
            id: `${event.value}_${role.value}`,
            role,
            enabled: setting ? !!setting.enabled : false,
            template: template ? { value: template.id, label: template.name } : null,
            settingId: setting ? setting.id : null,
          };
        });
        return {
          eventId: event.value,
          eventLabel: event.label,
          description: event.description,
          children,
        };
      });
      setEvents(eventRows);
      setSavedEvents(eventRows);
      setTemplates(templatesData.map(t => ({ value: t.id, label: t.name })));
      setRoles(rolesData);
      setLoading(false);
      setDirty(false);
    };
    fetchData();
  }, []);

  // Mark as dirty on any change
  const markDirty = () => setDirty(true);

  // Toggle notification enabled/disabled for a child row (draft only)
  const handleToggle = (parentIdx, childIdx) => {
    setEvents(events => events.map((event, i) =>
      i === parentIdx
        ? {
            ...event,
            children: event.children.map((child, j) =>
              j === childIdx ? { ...child, enabled: !child.enabled } : child
            ),
          }
        : event
    ));
    markDirty();
  };

  // Change template for a child row (draft only)
  const handleTemplateChange = (parentIdx, childIdx, newTemplate) => {
    setEvents(events => events.map((event, i) =>
      i === parentIdx
        ? {
            ...event,
            children: event.children.map((child, j) =>
              j === childIdx ? { ...child, template: newTemplate } : child
            ),
          }
        : event
    ));
    markDirty();
  };

  // Save all changes to backend
  const handleSave = async () => {
    setSaving(true);
    // Flatten all children
    const changed = [];
    events.forEach((event, parentIdx) => {
      event.children.forEach((child, childIdx) => {
        const savedChild = savedEvents[parentIdx]?.children[childIdx];
        // Compare to saved state
        if (
          !savedChild ||
          savedChild.enabled !== child.enabled ||
          (savedChild.template?.value || null) !== (child.template?.value || null)
        ) {
          changed.push({
            id: child.settingId,
            event: event.eventId,
            role: child.role.value,
            template_id: child.template ? child.template.value : null,
            language: DEFAULT_LANGUAGE,
            enabled: child.enabled,
          });
        }
      });
    });
    // Save all changed settings
    await Promise.all(
      changed.map(payload =>
        fetch(`${API_BASE}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      )
    );
    // Reload from backend to get new settingIds, etc.
    const eventsRes = await fetch(`${API_BASE}/api/events`);
    const eventsData = await eventsRes.json();
    const rolesRes = await fetch(`${API_BASE}/api/roles`);
    const rolesData = await rolesRes.json();
    const templatesRes = await fetch(`${API_BASE}/api/templates`);
    const templatesData = await templatesRes.json();
    const settingsRes = await fetch(`${API_BASE}/api/notifications`);
    const settingsData = await settingsRes.json();
    const eventRows = eventsData.map(event => {
      const children = rolesData.map(role => {
        const setting = settingsData.find(s => s.event === event.value && s.role === role.value && s.language === DEFAULT_LANGUAGE);
        const template = setting
          ? templatesData.find(t => t.id === setting.template_id) || null
          : null;
        return {
          id: `${event.value}_${role.value}`,
          role,
          enabled: setting ? !!setting.enabled : false,
          template: template ? { value: template.id, label: template.name } : null,
          settingId: setting ? setting.id : null,
        };
      });
      return {
        eventId: event.value,
        eventLabel: event.label,
        description: event.description,
        children,
      };
    });
    setEvents(eventRows);
    setSavedEvents(eventRows);
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
  };

  // Cancel changes and revert to last saved state
  const handleCancel = () => {
    setEvents(savedEvents);
    setDirty(false);
  };

  // Flatten for Table: parent rows are events, children are notifications
  const items = events.map((event, parentIdx) => ({
    ...event,
    parentIdx,
    isParent: true,
    children: event.children.map((child, childIdx) => ({
      ...child,
      parentIdx,
      childIdx,
      isParent: false,
    })),
  }));

  // Map expandedEventIds to event objects for expandedItems
  const expandedItems = expandedEventIds.map(eventId => items.find(e => e.eventId === eventId)).filter(Boolean);

  // Unified columns for both parent and child rows
  const columnDefinitions = [
    {
      id: 'event',
      header: 'Event',
      cell: item => item.isParent ? item.eventLabel : '',
      isRowHeader: true,
      minWidth: 180,
    },
    {
      id: 'description',
      header: 'Description',
      cell: item => item.isParent ? item.description : '',
      minWidth: 220,
    },
    {
      id: 'role',
      header: 'Role',
      cell: item => item.isParent ? '' : item.role.label,
      minWidth: 160,
    },
    {
      id: 'enabled',
      header: 'Enabled',
      cell: item => item.isParent ? '' : (
        <Toggle
          checked={item.enabled}
          onChange={() => handleToggle(item.parentIdx, item.childIdx)}
          ariaLabel={`Enable notification for ${events[item.parentIdx].eventLabel} (${item.role.label})`}
        />
      ),
      minWidth: 100,
    },
    {
      id: 'template',
      header: 'Notification Template',
      cell: item => {
        // Ensure selectedOption is either null or a valid option object
        const validOption = templates.find(t => t.value === item.template?.value) || null;
        return item.isParent ? '' : (
          <Select
            selectedOption={validOption}
            onChange={({ detail }) => handleTemplateChange(item.parentIdx, item.childIdx, detail.selectedOption)}
            options={templates}
            placeholder="Select template"
            expandToViewport
            // disabled={!item.enabled} // (keep as-is or remove if you want always enabled)
          />
        );
      },
      minWidth: 200,
    },
  ];

  return (
    <BoardItem
      header={<Header
        actions={
          <SpaceBetween direction="horizontal" size="s">
            <Button variant="primary" onClick={handleSave} disabled={!dirty || saving} loading={saving}>Save</Button>
            <Button variant="link" onClick={handleCancel} disabled={!dirty || saving}>Cancel</Button>
          </SpaceBetween>
        }
        info={
          <Link
            variant="info"
            onFollow={() => toggleHelpPanel && NotificationSettingsWidgetHelp && toggleHelpPanel(<NotificationSettingsWidgetHelp />, 'Notification Settings Help')}
          >
            Info
          </Link>
        }
      >Notifications Settings</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
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
      {flashMessages.length > 0 && <Flashbar items={flashMessages} />}
      <Box>
        <Table
          columnDefinitions={columnDefinitions}
          expandableRows={{
            getItemChildren: item => item.children,
            isItemExpandable: item => Boolean(item.children && item.children.length),
            expandedItems: expandedItems,
            onExpandableItemToggle: ({ detail }) => {
              setExpandedEventIds(prev => {
                const eventId = detail.item.eventId;
                if (detail.expanded) {
                  return [...prev, eventId];
                } else {
                  return prev.filter(id => id !== eventId);
                }
              });
            },
          }}
          items={items}
          header={<Header variant="h3">Event Notification Settings (Grouped by Event)</Header>}
          variant="embedded"
          stripedRows
          loading={loading}
        />
      </Box>
    </BoardItem>
  );
};

export default NotificationSettingsWidget;
