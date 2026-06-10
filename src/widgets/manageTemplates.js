import React, { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  ExpandableSection,
  FormField,
  Grid,
  Header,
  Icon,
  Input,
  Link,
  Modal,
  Select,
  SpaceBetween,
  Table,
  Tabs
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import { TextB, TextItalic, TextUnderline, LinkSimple, ListBullets, ListNumbers } from '@phosphor-icons/react';
import { apiFetch } from '../auth/apiClient';
import ManageTemplatesWidgetHelp from '../helpPanelContents/manageTemplatesWidgetHelp';

const TOKEN_GROUPS = [
  {
    id: 'case',
    label: 'Case and applicant',
    description: 'Use these for applicant-facing templates and staff alerts that identify the file.',
    tokens: [
      {
        id: 'applicant_name',
        label: 'Applicant name',
        value: '{applicant_name}',
        description: 'Primary applicant display name.'
      },
      {
        id: 'application_id',
        label: 'Application ID',
        value: '{application_id}',
        description: 'Internal application identifier when available.'
      },
      {
        id: 'tracking_id',
        label: 'Tracking ID',
        value: '{tracking_id}',
        description: 'Applicant-facing PATH tracking code.'
      },
      {
        id: 'submission_date',
        label: 'Submission date',
        value: '{submission_date}',
        description: 'Date the application or workflow item was submitted.'
      },
      {
        id: 'event_datetime',
        label: 'Event date and time',
        value: '{event_datetime}',
        description: 'Date and time the notification event was recorded.'
      }
    ]
  },
  {
    id: 'staff',
    label: 'Staff and event',
    description: 'Useful for internal staff emails, secure-message notifications, and workflow handoffs.',
    tokens: [
      {
        id: 'assessor_name',
        label: 'Assessor name',
        value: '{assessor_name}',
        description: 'Assigned assessor or staff owner when supplied by the event.'
      },
      {
        id: 'actor_name',
        label: 'Actor name',
        value: '{actor_name}',
        description: 'Staff member or system actor that caused the event.'
      },
      {
        id: 'event_message',
        label: 'Event message',
        value: '{event_message}',
        description: 'Short dispatcher-provided summary of what happened.'
      },
      {
        id: 'message_subject',
        label: 'Message subject',
        value: '{message_subject}',
        description: 'Secure message subject when the event is message-related.'
      },
      {
        id: 'message_to_name',
        label: 'Message to name',
        value: '{message_to_name}',
        description: 'Recipient display name for message events.'
      },
      {
        id: 'message_from_name',
        label: 'Message from name',
        value: '{message_from_name}',
        description: 'Sender display name for message events.'
      },
      {
        id: 'message_received_at',
        label: 'Message received at',
        value: '{message_received_at}',
        description: 'Date and time a secure-message event was received.'
      }
    ]
  },
  {
    id: 'nwac',
    label: 'NWAC review',
    description: 'Fields sent by NWAC review approval, denial, and changes-requested events.',
    tokens: [
      {
        id: 'review_outcome',
        label: 'Review outcome code',
        value: '{review_outcome}',
        description: 'Raw outcome value such as approve, reject, or request_changes.'
      },
      {
        id: 'review_outcome_label',
        label: 'Review outcome label',
        value: '{review_outcome_label}',
        description: 'Readable outcome label such as Approved or Changes requested.'
      },
      {
        id: 'review_reason',
        label: 'Review reason',
        value: '{review_reason}',
        description: 'Reviewer-entered rationale or requested change notes.'
      },
      {
        id: 'approval_cost_total',
        label: 'Approval cost total',
        value: '{approval_cost_total}',
        description: 'Approved or reviewed cost total supplied with the review event.'
      },
      {
        id: 'budget_pot_code',
        label: 'Budget pot code',
        value: '{budget_pot_code}',
        description: 'Funding pot code attached to the review context.'
      },
      {
        id: 'budget_pot_name',
        label: 'Budget pot name',
        value: '{budget_pot_name}',
        description: 'Funding pot display name attached to the review context.'
      },
      {
        id: 'posting_context',
        label: 'Posting context',
        value: '{posting_context}',
        description: 'Short accounting or posting context from the review event.'
      },
      {
        id: 'intervention_title',
        label: 'Intervention title',
        value: '{intervention_title}',
        description: 'Title or label for an intervention proposal or revision event.'
      },
      {
        id: 'proposal_type',
        label: 'Proposal type',
        value: '{proposal_type}',
        description: 'Proposal kind, such as new or revision.'
      },
      {
        id: 'approval_request_type',
        label: 'Approval request type',
        value: '{approval_request_type}',
        description: 'Queue/workflow type for an intervention approval event.'
      }
    ]
  },
  {
    id: 'decision',
    label: 'Decision',
    description: 'Decision fields used by applicant decision and status-change notifications.',
    tokens: [
      {
        id: 'decision_outcome',
        label: 'Decision outcome code',
        value: '{decision_outcome}',
        description: 'Raw decision outcome value.'
      },
      {
        id: 'decision_outcome_label',
        label: 'Decision outcome label',
        value: '{decision_outcome_label}',
        description: 'Readable decision label such as Approved or Not eligible.'
      }
    ]
  },
  {
    id: 'links',
    label: 'Links and support',
    description: 'Use link tokens instead of pasted URLs when the target comes from configuration.',
    tokens: [
      {
        id: 'portal_signin_link',
        label: 'Portal sign-in link',
        value: '[link url="{portal_dashboard_url}"]Sign in to your account[/link]',
        description: 'Formatted link to the applicant portal dashboard.'
      },
      {
        id: 'portal_dashboard_url',
        label: 'Portal dashboard URL',
        value: '{portal_dashboard_url}',
        description: 'Raw portal dashboard URL. Prefer the formatted link token in body copy.'
      },
      {
        id: 'support_email',
        label: 'Support email',
        value: '{support_email}',
        description: 'Configured support mailbox.'
      }
    ]
  }
];

const tokenOptions = TOKEN_GROUPS.flatMap((group) =>
  group.tokens.map((token) => ({
    ...token,
    groupId: group.id,
    groupLabel: group.label,
    label: `${group.label}: ${token.label}`
  }))
);

const tokenNamesFromValue = (value = '') =>
  Array.from(value.matchAll(/\{([^}]+)\}/g)).map((match) => match[1]);

const KNOWN_TOKEN_NAMES = new Set(
  tokenOptions.flatMap((option) => tokenNamesFromValue(option.value))
);

const TOKEN_ID_BY_NAME = tokenOptions.reduce((acc, option) => {
  tokenNamesFromValue(option.value).forEach((tokenName) => {
    acc[tokenName] = option.id;
  });
  return acc;
}, {});

const BASE_PREVIEW_SAMPLE = {
  applicant_name: 'Jamie Applicant',
  application_id: 'APP-2042',
  tracking_id: 'NWAC-1A2B3C',
  submission_date: 'Oct 24, 2025',
  event_datetime: 'October 24, 2025 at 2:35 p.m. EDT',
  assessor_name: 'Casey Assessor',
  actor_name: 'Morgan Reviewer',
  event_message: 'A review update was recorded on this file.',
  portal_dashboard_url: 'https://portal.sample/dashboard',
  support_email: 'support@example.ca',
  message_subject: 'Follow-up question about your file',
  message_received_at: 'October 24, 2025 at 2:35 p.m. EDT',
  decision_outcome: 'approved',
  decision_outcome_label: 'Approved',
  message_to_name: 'Jamie Applicant',
  message_from_name: 'Casey Assessor',
  review_outcome: 'request_changes',
  review_outcome_label: 'Changes requested',
  review_reason: 'Please confirm the training dates and attach the updated cost estimate.',
  approval_cost_total: '$4,250.00',
  budget_pot_code: 'PATH-TRAINING',
  budget_pot_name: 'Training supports',
  posting_context: 'Review queue',
  intervention_title: 'Skills training support',
  proposal_type: 'new',
  approval_request_type: 'new_intervention'
};

const PREVIEW_SCENARIOS = [
  {
    id: 'nwac_changes_requested',
    label: 'NWAC changes requested',
    description: 'Staff review email with rationale, budget, and case fields.',
    tokenIds: [
      'applicant_name',
      'tracking_id',
      'actor_name',
      'review_outcome_label',
      'review_reason',
      'approval_cost_total',
      'budget_pot_code',
      'budget_pot_name',
      'posting_context'
    ],
    sample: {
      ...BASE_PREVIEW_SAMPLE,
      event_message: 'NWAC requested changes before this file can move forward.',
      review_outcome: 'request_changes',
      review_outcome_label: 'Changes requested'
    }
  },
  {
    id: 'nwac_approved',
    label: 'NWAC approved',
    description: 'Staff review email for an approved NWAC review outcome.',
    tokenIds: [
      'applicant_name',
      'tracking_id',
      'actor_name',
      'review_outcome_label',
      'review_reason',
      'approval_cost_total',
      'budget_pot_code',
      'budget_pot_name'
    ],
    sample: {
      ...BASE_PREVIEW_SAMPLE,
      event_message: 'NWAC approved this file.',
      review_outcome: 'approve',
      review_outcome_label: 'Approved',
      review_reason: 'Approved for posting to the selected budget pot.'
    }
  },
  {
    id: 'nwac_denied',
    label: 'NWAC denied',
    description: 'Staff review email for a denied NWAC review outcome.',
    tokenIds: [
      'applicant_name',
      'tracking_id',
      'actor_name',
      'review_outcome_label',
      'review_reason',
      'approval_cost_total',
      'budget_pot_code',
      'budget_pot_name'
    ],
    sample: {
      ...BASE_PREVIEW_SAMPLE,
      event_message: 'NWAC denied this file.',
      review_outcome: 'reject',
      review_outcome_label: 'Denied',
      review_reason: 'The request does not meet the current funding criteria.'
    }
  },
  {
    id: 'intervention_proposal_approved',
    label: 'Intervention proposal approved',
    description: 'Staff email for a new or revised intervention proposal decision.',
    tokenIds: [
      'applicant_name',
      'tracking_id',
      'actor_name',
      'intervention_title',
      'proposal_type',
      'review_outcome_label',
      'approval_cost_total',
      'budget_pot_code',
      'posting_context'
    ],
    sample: {
      ...BASE_PREVIEW_SAMPLE,
      event_message: 'NWAC approved an intervention proposal.',
      review_outcome: 'approve',
      review_outcome_label: 'Approved',
      intervention_title: 'Skills training support',
      proposal_type: 'new',
      approval_request_type: 'new_intervention'
    }
  },
  {
    id: 'secure_message',
    label: 'Secure message',
    description: 'Applicant or staff message notification.',
    tokenIds: [
      'applicant_name',
      'tracking_id',
      'message_received_at',
      'event_datetime',
      'message_subject',
      'message_to_name',
      'message_from_name',
      'portal_signin_link',
      'portal_dashboard_url',
      'support_email'
    ],
    sample: {
      ...BASE_PREVIEW_SAMPLE,
      event_message: 'A secure message was added to this file.'
    }
  },
  {
    id: 'applicant_submission',
    label: 'Applicant submission',
    description: 'Initial application or submission acknowledgement.',
    tokenIds: [
      'applicant_name',
      'application_id',
      'tracking_id',
      'submission_date',
      'portal_signin_link',
      'portal_dashboard_url',
      'support_email'
    ],
    sample: {
      ...BASE_PREVIEW_SAMPLE,
      event_message: 'A new application was submitted.'
    }
  },
  {
    id: 'decision_approved',
    label: 'Decision approved',
    description: 'Applicant-facing decision notification.',
    tokenIds: [
      'applicant_name',
      'tracking_id',
      'decision_outcome',
      'decision_outcome_label',
      'portal_signin_link',
      'portal_dashboard_url',
      'support_email'
    ],
    sample: {
      ...BASE_PREVIEW_SAMPLE,
      decision_outcome: 'approved',
      decision_outcome_label: 'Approved',
      event_message: 'A program decision was recorded.'
    }
  },
  {
    id: 'generic_staff',
    label: 'Generic staff alert',
    description: 'Broad staff notification when only basic case and event context is guaranteed.',
    tokenIds: [
      'applicant_name',
      'tracking_id',
      'actor_name',
      'event_message',
      'assessor_name'
    ],
    sample: {
      ...BASE_PREVIEW_SAMPLE,
      event_message: 'A PATH staff notification was dispatched for this file.'
    }
  }
];

const DEFAULT_PREVIEW_SCENARIO_ID = 'nwac_changes_requested';

const languages = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' }
];

const TemplateEditorContext = createContext(null);

const useTemplateEditor = () => {
  const context = useContext(TemplateEditorContext);
  if (!context) {
    throw new Error('TemplateEditor widgets must be rendered inside TemplateEditorProvider.');
  }
  return context;
};

const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const replacePlaceholders = (value = '', sample = {}) =>
  value.replace(/\{([^}]+)\}/g, (_, token) =>
    sample[token] !== undefined ? sample[token] : `{${token}}`
  );

const collectTokenNames = (value = '') =>
  Array.from(new Set(tokenNamesFromValue(value || '')));

const collectLocalizedTokenNames = (localized = {}) => {
  const allText = Object.values(localized)
    .map((entry) => `${entry?.subject || ''}\n${entry?.textBody || ''}`)
    .join('\n');
  return collectTokenNames(allText);
};

const getScenarioById = (scenarioId) =>
  PREVIEW_SCENARIOS.find((scenario) => scenario.id === scenarioId) || PREVIEW_SCENARIOS[0];

const buildTemplateDiagnostics = (localized = {}, scenario = PREVIEW_SCENARIOS[0]) => {
  const tokenNames = collectLocalizedTokenNames(localized);
  const unknownTokens = tokenNames.filter((tokenName) => !KNOWN_TOKEN_NAMES.has(tokenName));
  const scenarioTokenIds = new Set(scenario?.tokenIds || []);
  const scenarioTokens = tokenNames
    .filter((tokenName) => KNOWN_TOKEN_NAMES.has(tokenName))
    .map((tokenName) => ({
      tokenName,
      tokenId: TOKEN_ID_BY_NAME[tokenName] || tokenName
    }))
    .filter(({ tokenId }) => !scenarioTokenIds.has(tokenId));

  return {
    tokenNames,
    unknownTokens,
    scenarioTokens: Array.from(
      new Map(scenarioTokens.map((item) => [item.tokenName, item])).values()
    )
  };
};

const formatTemplateDate = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

const defaultLocalizedContent = () => ({
  en: { subject: '', textBody: '' },
  fr: { subject: '', textBody: '' }
});

const cloneLocalizedContent = (content = {}) => ({
  en: { ...(content.en || { subject: '', textBody: '' }) },
  fr: { ...(content.fr || { subject: '', textBody: '' }) }
});

const extractJson = (s) => {
  if (!s || typeof s !== 'string') return null;
  try { return JSON.parse(s); } catch (_) {}
  const fenced = s.match(/```json\s*([\s\S]*?)```/i) || s.match(/```\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) {
    try { return JSON.parse(fenced[1]); } catch (_) {}
  }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = s.slice(start, end + 1);
    try { return JSON.parse(slice); } catch (_) {}
  }
  return null;
};

const STORAGE_KEY = 'manageTemplates.selection.v1';

const safeSessionStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return null;
    }
    return window.sessionStorage;
  } catch (err) {
    console.warn('[templates] sessionStorage unavailable', err);
    return null;
  }
};

const readStoredSelection = () => {
  try {
    const storage = safeSessionStorage();
    if (!storage) return null;
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[templates] failed to read stored selection', err);
    return null;
  }
};

const writeStoredSelection = (payload) => {
  try {
    const storage = safeSessionStorage();
    if (!storage) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[templates] failed to persist selection', err);
  }
};

const clearStoredSelection = () => {
  try {
    const storage = safeSessionStorage();
    if (!storage) return;
    storage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[templates] failed to clear stored selection', err);
  }
};

const toolbarActions = [
  { id: 'bold', label: 'Bold', icon: TextB },
  { id: 'italic', label: 'Italic', icon: TextItalic },
  { id: 'underline', label: 'Underline', icon: TextUnderline },
  { id: 'link', label: 'Insert link', icon: LinkSimple },
  { id: 'bullets', label: 'Bulleted list', icon: ListBullets },
  { id: 'numbers', label: 'Numbered list', icon: ListNumbers }
];

const inlineFormatTokens = {
  bold: { open: '[b]', close: '[/b]', htmlOpen: '<strong>', htmlClose: '</strong>' },
  italic: { open: '[i]', close: '[/i]', htmlOpen: '<em>', htmlClose: '</em>' },
  underline: { open: '[u]', close: '[/u]', htmlOpen: '<u>', htmlClose: '</u>' }
};

const listFormatTokens = {
  bullets: { open: '[ul]', close: '[/ul]', htmlOpen: '<ul>', htmlClose: '</ul>' },
  numbers: { open: '[ol]', close: '[/ol]', htmlOpen: '<ol>', htmlClose: '</ol>' }
};

const listItemToken = { open: '[li]', close: '[/li]', htmlOpen: '<li>', htmlClose: '</li>' };

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeLinkUrl = (value = '') => {
  let url = (value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
};

const TemplateEditorProvider = ({ children, toggleHelpPanel }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [localizedContent, setLocalizedContent] = useState(defaultLocalizedContent());
  const [activeLanguage, setActiveLanguage] = useState('en');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [baselineTemplate, setBaselineTemplate] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translateModal, setTranslateModal] = useState(null); // { mode: 'missing'|'confirm', fromLang, targetLang, fromLabel, targetLabel, message }
  const [feedbackModal, setFeedbackModal] = useState(null); // { status: 'success'|'error', message: string }
  const [linkModal, setLinkModal] = useState(null); // { url, text, selection: { lang, start, end }, error? }
  const [previewScenarioId, setPreviewScenarioId] = useState(DEFAULT_PREVIEW_SCENARIO_ID);
  const textAreaRef = useRef(null);
  const selectionRef = useRef({
    en: { start: 0, end: 0 },
    fr: { start: 0, end: 0 }
  });
  const storedSelectionRef = useRef(readStoredSelection());
  const hasRestoredSelectionRef = useRef(false);

  const handleTemplateSelection = useCallback((templateId, options = {}) => {
    const draftOverride = options.draftOverride;
    apiFetch(`/api/templates/${templateId}`)
      .then((response) => response.json())
      .then((data) => {
        const nextTemplate = {
          ...data,
          name: draftOverride?.name || data.name
        };
        setSelectedTemplate(nextTemplate);
        const localized = defaultLocalizedContent();
        localized.en.subject = data.localized?.en?.subject || data.subject || '';
        localized.en.textBody = data.localized?.en?.textBody || data.textBody || data.content || '';
        localized.fr.subject = data.localized?.fr?.subject || '';
        localized.fr.textBody = data.localized?.fr?.textBody || '';
        setLocalizedContent(localized);
        setActiveLanguage(draftOverride?.activeLanguage || 'en');
        setPreviewScenarioId(draftOverride?.previewScenarioId || DEFAULT_PREVIEW_SCENARIO_ID);
        selectionRef.current = {
          en: { start: 0, end: 0 },
          fr: { start: 0, end: 0 }
        };
        setBaselineTemplate({
          name: data.name || '',
          localized: cloneLocalizedContent(localized)
        });
        if (draftOverride?.localized) {
          setLocalizedContent(cloneLocalizedContent(draftOverride.localized));
        }
        // status temporarily dropped from UI/payload
      })
      .catch((error) => console.error('Error fetching template details:', error));
  }, []);

  const attemptRestoreSelection = useCallback(() => {
    if (hasRestoredSelectionRef.current) return;
    const stored = storedSelectionRef.current;
    if (!stored) {
      hasRestoredSelectionRef.current = true;
      return;
    }

    hasRestoredSelectionRef.current = true;
    if (stored.type === 'existing' && stored.templateId) {
      handleTemplateSelection(stored.templateId, { draftOverride: stored });
      return;
    }

    if (stored.type === 'new') {
      const localized = cloneLocalizedContent(stored.localized || defaultLocalizedContent());
      setSelectedTemplate({
        id: null,
        name: stored.name || stored.baseline?.name || 'New Template',
        status: 'Draft',
        language: 'English',
        subject: localized.en.subject || 'Subject line',
        htmlBody: localized.en.textBody || '',
        textBody: localized.en.textBody || ''
      });
      setLocalizedContent(localized);
      setActiveLanguage(stored.activeLanguage || 'en');
      setPreviewScenarioId(stored.previewScenarioId || DEFAULT_PREVIEW_SCENARIO_ID);
      selectionRef.current = {
        en: { start: 0, end: 0 },
        fr: { start: 0, end: 0 }
      };
      setBaselineTemplate({
        name: stored.baseline?.name || 'New Template',
        localized: cloneLocalizedContent(stored.baseline?.localized || defaultLocalizedContent())
      });
    }
  }, [handleTemplateSelection]);

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    apiFetch('/api/templates')
      .then((response) => response.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []));
        setLoading(false);
        attemptRestoreSelection();
      })
      .catch((error) => {
        console.error('Error fetching templates:', error);
        setLoading(false);
        attemptRestoreSelection();
      });
  }, [attemptRestoreSelection]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const applyInlineFormat = (formatId) => {
    const definition = inlineFormatTokens[formatId];
    if (!definition) return;
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const lang = activeLanguage;
    const value = localizedContent[lang]?.textBody || '';
    const selection = selectionRef.current[lang] || { start: value.length, end: value.length };
    const safeStart = Math.max(0, Math.min(value.length, selection.start));
    const safeEnd = Math.max(safeStart, Math.min(value.length, selection.end));
    const hasSelection = safeStart !== safeEnd;
    const before = value.slice(0, safeStart);
    const selected = value.slice(safeStart, safeEnd);
    const after = value.slice(safeEnd);
    const nextValue = hasSelection
      ? `${before}${definition.open}${selected}${definition.close}${after}`
      : `${before}${definition.open}${definition.close}${after}`;
    const nextSelection = hasSelection
      ? {
          start: safeStart + definition.open.length,
          end: safeEnd + definition.open.length
        }
      : {
          start: safeStart + definition.open.length,
          end: safeStart + definition.open.length
        };
    setLocalizedContent((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        textBody: nextValue
      }
    }));
    selectionRef.current[lang] = nextSelection;
    requestAnimationFrame(() => {
      const nextTextarea = textAreaRef.current;
      if (!nextTextarea) return;
      try {
        nextTextarea.focus();
        nextTextarea.setSelectionRange(nextSelection.start, nextSelection.end);
      } catch (_) {
        /* ignore */
      }
    });
  };

  const insertLinkToken = (selectionMeta, url, displayText) => {
    const lang = selectionMeta?.lang ?? activeLanguage;
    const value = localizedContent[lang]?.textBody || '';
    const start = Math.max(0, Math.min(value.length, selectionMeta?.start ?? value.length));
    const end = Math.max(start, Math.min(value.length, selectionMeta?.end ?? value.length));
    const before = value.slice(0, start);
    const after = value.slice(end);
    const cleanText = displayText && displayText.length ? displayText : url;
    const tokenPrefix = `[link url="${url}"]`;
    const token = `${tokenPrefix}${cleanText}[/link]`;
    const nextValue = `${before}${token}${after}`;
    setLocalizedContent((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        textBody: nextValue
      }
    }));
    const textStart = start + tokenPrefix.length;
    const textEnd = textStart + cleanText.length;
    selectionRef.current[lang] = { start: textStart, end: textEnd };
    requestAnimationFrame(() => {
      const nextTextarea = textAreaRef.current;
      if (!nextTextarea) return;
      try {
        nextTextarea.focus();
        nextTextarea.setSelectionRange(textStart, textEnd);
      } catch (_) {
        /* ignore */
      }
    });
  };

  const openLinkModal = () => {
    const lang = activeLanguage;
    const value = localizedContent[lang]?.textBody || '';
    const selection = selectionRef.current[lang] || { start: value.length, end: value.length };
    const selectedText = value.slice(selection.start, selection.end);
    setLinkModal({
      url: '',
      text: selectedText,
      selection: { lang, start: selection.start, end: selection.end },
      error: ''
    });
  };

  const closeLinkModal = () => setLinkModal(null);

  const confirmLinkModal = () => {
    if (!linkModal) return;
    const normalizedUrl = normalizeLinkUrl(linkModal.url);
    if (!normalizedUrl) {
      setLinkModal((prev) => (prev ? { ...prev, error: 'Enter a valid https:// URL.' } : prev));
      return;
    }
    const text = linkModal.text?.length ? linkModal.text : normalizedUrl;
    insertLinkToken(linkModal.selection, normalizedUrl, text);
    setLinkModal(null);
  };

  const applyListFormat = (mode) => {
    const listToken = listFormatTokens[mode];
    if (!listToken) return;
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const lang = activeLanguage;
    const value = localizedContent[lang]?.textBody || '';
    const selection = selectionRef.current[lang] || { start: value.length, end: value.length };
    const safeStart = Math.max(0, Math.min(value.length, selection.start));
    const safeEnd = Math.max(safeStart, Math.min(value.length, selection.end));
    const selected = value.slice(safeStart, safeEnd);
    const before = value.slice(0, safeStart);
    const after = value.slice(safeEnd);
    const hasContent = selected.trim().length > 0;
    const placeholderText = hasContent ? null : 'List item';
    const lines = hasContent ? selected.split(/\r?\n/) : [placeholderText];
    const listItems = lines
      .map((line) => `${listItemToken.open}${line || ''}${listItemToken.close}`)
      .join('\n');
    const listBlock = `${listToken.open}\n${listItems}\n${listToken.close}`;
    const nextValue = `${before}${listBlock}${after}`;
    const insertedLength = listBlock.length;
    const blockStart = safeStart;
    const blockEnd = safeStart + insertedLength;

    const placeholderStart = blockStart + listToken.open.length + 1 + listItemToken.open.length;
    const placeholderEnd = hasContent
      ? blockEnd - (listToken.close.length + 1)
      : placeholderStart + (placeholderText ? placeholderText.length : 0);

    setLocalizedContent((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        textBody: nextValue
      }
    }));

    selectionRef.current[lang] = hasContent
      ? { start: blockStart, end: blockEnd }
      : { start: placeholderStart, end: placeholderEnd };

    requestAnimationFrame(() => {
      const nextTextarea = textAreaRef.current;
      if (!nextTextarea) return;
      try {
        nextTextarea.focus();
        const sel = selectionRef.current[lang];
        nextTextarea.setSelectionRange(sel.start, sel.end);
      } catch (_) {
        /* ignore */
      }
    });
  };

  const handleToolbarAction = (actionId) => {
    if (inlineFormatTokens[actionId]) {
      applyInlineFormat(actionId);
      return;
    }
    if (actionId === 'link') {
      captureSelection();
      openLinkModal();
      return;
    }
    if (listFormatTokens[actionId]) {
      applyListFormat(actionId);
      return;
    }
    // Additional actions (links, lists, etc.) can be wired here later.
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || !baselineTemplate || !isDirty) return;
    const english = localizedContent.en;
    const payload = {
      name: selectedTemplate.name,
      localized: localizedContent,
      subject: english.subject,
      htmlBody: english.textBody,
      textBody: english.textBody,
      content: english.textBody
    };

    try {
      const response = await apiFetch(`/api/templates/${selectedTemplate.id ?? 'new'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message = data?.error || 'Failed to save template.';
        throw new Error(message);
      }

      fetchTemplates();
      if (data) {
        setSelectedTemplate(data);
        setBaselineTemplate({
          name: data.name,
          localized: cloneLocalizedContent(data.localized || localizedContent)
        });
        setLocalizedContent(cloneLocalizedContent(data.localized || localizedContent));
      } else {
        setBaselineTemplate({
          name: selectedTemplate.name,
          localized: cloneLocalizedContent(localizedContent)
        });
      }
      setFeedbackModal({ status: 'success', message: 'Template saved successfully.' });
    } catch (error) {
      console.error('Error saving template:', error);
      setFeedbackModal({ status: 'error', message: error.message || 'Failed to save template.' });
    }
  };

  useEffect(() => {
    if (!selectedTemplate || !baselineTemplate) return;
    const payload = {
      type: selectedTemplate.id ? 'existing' : 'new',
      templateId: selectedTemplate.id || null,
      name: selectedTemplate.name || '',
      localized: localizedContent,
      baseline: baselineTemplate,
      activeLanguage,
      previewScenarioId
    };
    storedSelectionRef.current = payload;
    writeStoredSelection(payload);
  }, [selectedTemplate, localizedContent, baselineTemplate, activeLanguage, previewScenarioId]);

  const templateFocusKey = selectedTemplate ? (selectedTemplate.id ?? 'new') : null;

  useEffect(() => {
    if (!selectedTemplate) return;
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const selection = selectionRef.current[activeLanguage] || { start: 0, end: 0 };
    requestAnimationFrame(() => {
      try {
        textarea.focus();
        textarea.setSelectionRange(selection.start, selection.end);
      } catch (_) {
        /* ignore */
      }
    });
  }, [activeLanguage, selectedTemplate, templateFocusKey]);

  const handleNewTemplate = () => {
    const newTemplate = {
      name: "New Template",
      status: "Draft",
      language: "English",
      subject: "Subject line",
      htmlBody: "<p>Write your email...</p>",
      textBody: "Write your email..."
    };
    setSelectedTemplate(newTemplate);
    setLocalizedContent({
      en: { subject: newTemplate.subject, textBody: newTemplate.textBody },
      fr: { subject: '', textBody: '' }
    });
    setActiveLanguage('en');
    setPreviewScenarioId(DEFAULT_PREVIEW_SCENARIO_ID);
    selectionRef.current = {
      en: { start: 0, end: 0 },
      fr: { start: 0, end: 0 }
    };
    setBaselineTemplate({
      name: newTemplate.name,
      localized: cloneLocalizedContent({
        en: { subject: newTemplate.subject, textBody: newTemplate.textBody },
        fr: { subject: '', textBody: '' }
      })
    });
    // status temporarily dropped from UI/payload
  };

  const captureSelection = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    selectionRef.current[activeLanguage] = {
      start: textarea.selectionStart || 0,
      end: textarea.selectionEnd || 0
    };
  };

  const handleInsertToken = (token) => {
    if (!token) return;
    const textarea = textAreaRef.current;
    const currentValue = localizedContent[activeLanguage].textBody || '';
    const selection = selectionRef.current[activeLanguage] || { start: 0, end: 0 };
    if (textarea && typeof selection.start === 'number') {
      const { start, end } = selection;
      const nextValue =
        currentValue.slice(0, start) + token.value + currentValue.slice(end);
      setLocalizedContent((prev) => ({
        ...prev,
        [activeLanguage]: {
          ...prev[activeLanguage],
          textBody: nextValue
        }
      }));
      requestAnimationFrame(() => {
        const el = textAreaRef.current;
        if (!el) return;
        const cursor = start + token.value.length;
        el.focus();
        try {
          el.setSelectionRange(cursor, cursor);
        } catch (err) {
          console.warn('setSelectionRange failed', err);
        }
        selectionRef.current[activeLanguage] = { start: cursor, end: cursor };
      });
    } else {
      const nextValue = currentValue + token.value;
      setLocalizedContent((prev) => ({
        ...prev,
        [activeLanguage]: {
          ...prev[activeLanguage],
          textBody: nextValue
        }
      }));
    }
  };

  const handleDeleteTemplate = () => {
    if (!templateToDelete) return;

    apiFetch(`/api/templates/${templateToDelete.id}`, {
      method: 'DELETE'
    })
      .then((response) => {
        if (response.ok) {
          fetchTemplates();
          if (selectedTemplate && templateToDelete.id === selectedTemplate.id) {
            setSelectedTemplate(null);
            setLocalizedContent(defaultLocalizedContent());
            setBaselineTemplate(null);
            storedSelectionRef.current = null;
            clearStoredSelection();
          }
          setTemplateToDelete(null);
          setFeedbackModal({
            status: 'success',
            message: 'Template deleted successfully.'
          });
        } else {
          console.error("Error deleting template:", response.statusText);
          setFeedbackModal({
            status: 'error',
            message: 'Failed to delete template.'
          });
        }
      })
      .catch((error) => {
        console.error("Error deleting template:", error);
        setFeedbackModal({
          status: 'error',
          message: error.message || 'Failed to delete template.'
        });
      });
  };

  const previewScenario = useMemo(
    () => getScenarioById(previewScenarioId),
    [previewScenarioId]
  );

  const previewSample = useMemo(
    () => previewScenario?.sample || BASE_PREVIEW_SAMPLE,
    [previewScenario]
  );

  const renderPreviewText = (value = '') => replacePlaceholders(value, previewSample);

  const renderPreviewHtml = (body) => {
    if (!body || !body.trim()) {
      return '<em>No content yet.</em>';
    }

    const linkMatches = [];
    const withLinks = body.replace(/\[link\s+url="([^"]*)"\](.*?)\[\/link\]/gis, (_, href, text) => {
      const sentinel = `__LINK_${linkMatches.length}__`;
      linkMatches.push({ sentinel, href, text });
      return sentinel;
    });

    const previewTokenMap = {
      ...inlineFormatTokens,
      ...listFormatTokens,
      listItem: listItemToken
    };

    const formatSentinels = Object.keys(previewTokenMap).reduce((acc, key) => {
      acc[key] = {
        open: `__FMT_${key.toUpperCase()}_OPEN__`,
        close: `__FMT_${key.toUpperCase()}_CLOSE__`
      };
      return acc;
    }, {});

    const withPlaceholders = withLinks.replace(/\{([^}]+)\}/g, (_, token) =>
      previewSample[token] !== undefined ? previewSample[token] : `{${token}}`
    );

    const withSentinels = Object.entries(previewTokenMap).reduce((result, [key, token]) => {
      const sentinel = formatSentinels[key];
      return result
        .replace(new RegExp(escapeRegExp(token.open), 'gi'), sentinel.open)
        .replace(new RegExp(escapeRegExp(token.close), 'gi'), sentinel.close);
    }, withPlaceholders);

    const escaped = escapeHtml(withSentinels);

    let html = Object.entries(previewTokenMap).reduce((result, [key, token]) => {
      const sentinel = formatSentinels[key];
      return result
        .replace(new RegExp(sentinel.open, 'g'), token.htmlOpen)
        .replace(new RegExp(sentinel.close, 'g'), token.htmlClose);
    }, escaped);

    html = html.replace(/\n/g, '<br />')
      .replace(/<ul><br \/>/g, '<ul>')
      .replace(/<ol><br \/>/g, '<ol>')
      .replace(/<br \/><li>/g, '<li>')
      .replace(/<\/li><br \/>/g, '</li>')
      .replace(/<br \/><\/ul>/g, '</ul>')
      .replace(/<br \/><\/ol>/g, '</ol>');

    linkMatches.forEach(({ sentinel, href, text }) => {
      const resolvedHref = replacePlaceholders(href, previewSample);
      const resolvedText = replacePlaceholders(text || href, previewSample);
      const safeHref = normalizeLinkUrl(resolvedHref) || '#';
      const linkText = escapeHtml(resolvedText).replace(/\n/g, '<br />');
      html = html.replace(
        new RegExp(escapeRegExp(sentinel), 'g'),
        `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${linkText}</a>`
      );
    });

    return html;
  };

  const isDirty = useMemo(() => {
    if (!selectedTemplate || !baselineTemplate) return false;
    const nameDirty = (selectedTemplate.name || '') !== (baselineTemplate.name || '');
    const localizedDirty = JSON.stringify(localizedContent) !== JSON.stringify(baselineTemplate.localized);
    return nameDirty || localizedDirty;
  }, [selectedTemplate, baselineTemplate, localizedContent]);

  const handleRevertChanges = () => {
    if (!baselineTemplate || !selectedTemplate) return;
    setSelectedTemplate((prev) => ({ ...prev, name: baselineTemplate.name }));
    setLocalizedContent(cloneLocalizedContent(baselineTemplate.localized));
    setActiveLanguage('en');
    selectionRef.current = {
      en: { start: 0, end: 0 },
      fr: { start: 0, end: 0 }
    };
    setTranslateModal(null);
  };

  const translateBatch = async (items) => {
    const system = {
      role: 'system',
      content: 'You are a translation assistant. Translate between English and Canadian French. Preserve placeholders like {token}, numbers, punctuation, and formatting. Respond ONLY with JSON matching the requested schema.'
    };
    const user = {
      role: 'user',
      content: JSON.stringify({
        instruction: 'For each item, translate text from `from` to `to`. Respond with { "translations": [{ "id": string, "lang": "en"|"fr", "text": string }] }',
        items
      })
    };
    const res = await apiFetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [system, user] })
    });
    if (res.status === 501) {
      const err = new Error('ai-disabled');
      err.code = 'ai-disabled';
      throw err;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    const translations = parsed?.translations;
    if (!Array.isArray(translations) || !translations.length) {
      throw new Error('unexpected-response');
    }
    return translations
      .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.text === 'string')
      .map((entry) => ({ id: entry.id, lang: entry.lang, text: entry.text }));
  };

  const openTranslateModal = (fromLang) => {
    if (translating) return;
    const targetLang = fromLang === 'en' ? 'fr' : 'en';
    const fromLabel = languages.find((l) => l.id === fromLang)?.label || fromLang;
    const targetLabel = languages.find((l) => l.id === targetLang)?.label || targetLang;
    const source = localizedContent[fromLang];
    const missing = [];
    if (!source.subject || !source.subject.trim()) missing.push('subject');
    if (!source.textBody || !source.textBody.trim()) missing.push('email body');
    if (missing.length) {
      setTranslateModal({
        mode: 'missing',
        message: `Provide the ${missing.join(' and ')} in ${fromLabel} before translating.`
      });
      return;
    }
    setTranslateModal({
      mode: 'confirm',
      fromLang,
      targetLang,
      fromLabel,
      targetLabel
    });
  };

  const performTranslation = async ({ fromLang, targetLang, fromLabel, targetLabel }) => {
    setTranslating(true);
    try {
      const source = localizedContent[fromLang];
      const items = [
        { id: 'subject', from: fromLang, to: targetLang, text: source.subject },
        { id: 'textBody', from: fromLang, to: targetLang, text: source.textBody }
      ];
      const translations = await translateBatch(items);
      setLocalizedContent((prev) => {
        const next = cloneLocalizedContent(prev);
        translations.forEach((entry) => {
          if (!entry || entry.lang !== targetLang) return;
          if (entry.id === 'subject') next[targetLang].subject = entry.text;
          if (entry.id === 'textBody') next[targetLang].textBody = entry.text;
        });
        return next;
      });
      selectionRef.current[targetLang] = { start: 0, end: 0 };
      setActiveLanguage(targetLang);
    } catch (error) {
      if (error.code === 'ai-disabled') {
        setTranslateModal({ mode: 'info', message: 'AI translation is disabled on this environment.' });
      } else if (error.message === 'unexpected-response') {
        setTranslateModal({ mode: 'info', message: 'Translation service returned an unexpected response.' });
      } else {
        setTranslateModal({ mode: 'info', message: `Translation failed: ${error.message || String(error)}` });
      }
      return;
    } finally {
      setTranslating(false);
    }
  };

  const handleSubjectChange = (lang, value) => {
    setLocalizedContent((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        subject: value
      }
    }));
  };

  const handleBodyChange = (lang, value) => {
    setLocalizedContent((prev) => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        textBody: value
      }
    }));
  };

  const promptDeleteTemplate = (template) => {
    setTemplateToDelete(template);
    setShowDeleteModal(true);
  };

  const contextValue = {
    toggleHelpPanel,
    templates,
    loading,
    handleTemplateSelection,
    handleNewTemplate,
    promptDeleteTemplate,
    selectedTemplate,
    setSelectedTemplate,
    localizedContent,
    setLocalizedContent,
    activeLanguage,
    setActiveLanguage,
    handleSubjectChange,
    handleBodyChange,
    openTranslateModal,
    translating,
    renderPreviewHtml,
    renderPreviewText,
    handleToolbarAction,
    handleInsertToken,
    captureSelection,
    textAreaRef,
    handleSaveTemplate,
    handleRevertChanges,
    isDirty,
    languages,
    tokenOptions,
    tokenGroups: TOKEN_GROUPS,
    previewScenarios: PREVIEW_SCENARIOS,
    previewScenario,
    previewScenarioId,
    setPreviewScenarioId,
    diagnostics: buildTemplateDiagnostics(localizedContent, previewScenario),
    linkModal,
    setLinkModal,
    confirmLinkModal,
    closeLinkModal
  };

  return (
    <TemplateEditorContext.Provider value={contextValue}>
      {children}

      {linkModal && (
        <Modal
          visible
          header="Insert link"
          onDismiss={closeLinkModal}
          closeAriaLabel="Close link modal"
          footer={
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={closeLinkModal}>Cancel</Button>
              <Button variant="primary" onClick={confirmLinkModal}>
                Insert link
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <FormField label="URL" errorText={linkModal.error}>
              <Input
                placeholder="https://example.com"
                value={linkModal.url ?? ''}
                spellcheck={false}
                onChange={({ detail }) =>
                  setLinkModal((prev) => (prev ? { ...prev, url: detail.value, error: '' } : prev))
                }
              />
            </FormField>
            <FormField label="Display text" description="Optional">
              <Input
                value={linkModal.text ?? ''}
                spellcheck
                onChange={({ detail }) =>
                  setLinkModal((prev) => (prev ? { ...prev, text: detail.value } : prev))
                }
              />
            </FormField>
          </SpaceBetween>
        </Modal>
      )}

      {feedbackModal && (
        <Modal
          visible
          onDismiss={() => setFeedbackModal(null)}
          closeAriaLabel="Close modal"
          header={feedbackModal.status === 'success' ? 'Template updated' : 'Action failed'}
          footer={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={() => setFeedbackModal(null)}>
                Close
              </Button>
            </SpaceBetween>
          }
        >
          <Box>
            {feedbackModal.message}
          </Box>
        </Modal>
      )}

      {translateModal && (
        <Modal
          onDismiss={() => setTranslateModal(null)}
          visible
          closeAriaLabel="Close modal"
          header={
            translateModal.mode === 'confirm'
              ? `Translate ${translateModal.fromLabel} content`
              : 'Translation notice'
          }
          footer={
            translateModal.mode === 'confirm' ? (
            <SpaceBetween direction="horizontal" size="s">
              <Button onClick={() => setTranslateModal(null)}>Cancel</Button>
              <Button
                variant="primary"
                loading={translating}
                disabled={translating}
                onClick={() => {
                  const payload = translateModal;
                  setTranslateModal(null);
                  performTranslation(payload);
                }}
              >
                {`Overwrite with ${translateModal.targetLabel === 'Français' ? 'French' : translateModal.targetLabel}`}
              </Button>
            </SpaceBetween>
            ) : (
              <Button onClick={() => setTranslateModal(null)}>Close</Button>
            )
          }
        >
          {translateModal.mode === 'confirm' ? (
            <SpaceBetween size="s">
              <p>
                {`This will overwrite the ${translateModal.targetLabel} subject and email body with AI-generated text based on the ${translateModal.fromLabel} version.`}
              </p>
              <p>AI translations can contain errors. Review the results before sending to applicants.</p>
            </SpaceBetween>
          ) : (
            <p>{translateModal.message}</p>
          )}
        </Modal>
      )}

      {showDeleteModal && (
        <Modal
          onDismiss={() => setShowDeleteModal(false)}
          visible={showDeleteModal}
          closeAriaLabel="Close modal"
          header="Delete Template"
          footer={
            <SpaceBetween direction="horizontal" size="s">
              <Button variant="primary" onClick={() => { handleDeleteTemplate(); setShowDeleteModal(false); }}>Delete</Button>
              <Button variant="normal" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            </SpaceBetween>
          }
        >
          Are you sure you want to delete this template?
        </Modal>
      )}
    </TemplateEditorContext.Provider>
  );
};

const TemplateLibraryWidget = ({ actions, dragHandleAriaLabel, i18nStrings }) => {
  const {
    templates,
    loading,
    selectedTemplate,
    handleTemplateSelection,
    handleNewTemplate,
    promptDeleteTemplate
  } = useTemplateEditor();
  const [libraryFilter, setLibraryFilter] = useState('');
  const filteredTemplates = useMemo(() => {
    const query = libraryFilter.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) =>
      [template.name, template.subject, template.type, template.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [templates, libraryFilter]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description="Find and load notification templates. Edits happen in the Editor widget."
          actions={<Button onClick={handleNewTemplate}>New Template</Button>}
        >
          Library
        </Header>
      }
      dragHandleAriaLabel={dragHandleAriaLabel}
      i18nStrings={i18nStrings}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <SpaceBetween size="m">
        <Input
          type="search"
          ariaLabel="Search templates"
          placeholder="Search templates"
          value={libraryFilter}
          spellcheck={false}
          onChange={({ detail }) => setLibraryFilter(detail.value)}
        />
        <Table
          items={filteredTemplates}
          loading={loading}
          trackBy="id"
          stripedRows
          variant="embedded"
          header={null}
          empty={
            <Box textAlign="center" color="inherit">
              <b>No templates found</b>
              <Box padding={{ top: 's' }} variant="p" color="inherit">
                Adjust the search or create a new template.
              </Box>
            </Box>
          }
          columnDefinitions={[
            {
              id: 'name',
              header: 'Template',
              cell: item => (
                <SpaceBetween size="xxs">
                  <Link onFollow={() => handleTemplateSelection(item.id)}>
                    {item.name}
                  </Link>
                  {selectedTemplate?.id === item.id ? (
                    <Badge color="blue">Loaded</Badge>
                  ) : null}
                </SpaceBetween>
              )
            },
            {
              id: 'updated',
              header: 'Updated',
              cell: item => formatTemplateDate(item.updated_at || item.created_at)
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={() => handleTemplateSelection(item.id)}>
                    Edit
                  </Button>
                  <Button
                    variant="icon"
                    iconName="close"
                    ariaLabel={`Delete ${item.name}`}
                    onClick={() => promptDeleteTemplate(item)}
                  />
                </SpaceBetween>
              )
            }
          ]}
        />
      </SpaceBetween>
    </BoardItem>
  );
};

const CompactFieldReference = ({ tokenGroups, previewScenario, onInsert, captureSelection }) => {
  const scenarioTokenIds = new Set(previewScenario?.tokenIds || []);

  return (
    <ExpandableSection headerText="Field reference" defaultExpanded={false}>
      <SpaceBetween size="m">
        {tokenGroups.map((group) => (
          <SpaceBetween key={group.id} size="xs">
            <Box variant="strong">{group.label}</Box>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '8px'
              }}
            >
              {group.tokens.map((token) => (
                <div
                  key={token.id}
                  style={{
                    border: '1px solid var(--color-border-divider-default)',
                    borderRadius: '6px',
                    padding: '8px',
                    minWidth: 0
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <Button
                      variant="inline-link"
                      onMouseDown={() => captureSelection()}
                      onClick={() => onInsert({ value: token.value })}
                    >
                      {token.label}
                    </Button>
                    {scenarioTokenIds.has(token.id) ? (
                      <Badge color="green">Typical</Badge>
                    ) : null}
                  </div>
                  <Box variant="small" color="text-body-secondary">
                    <code style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{token.value}</code>
                  </Box>
                </div>
              ))}
            </div>
          </SpaceBetween>
        ))}
      </SpaceBetween>
    </ExpandableSection>
  );
};

const TemplateEditorWidget = ({ actions, dragHandleAriaLabel, i18nStrings }) => {
  const {
    toggleHelpPanel,
    selectedTemplate,
    setSelectedTemplate,
    localizedContent,
    activeLanguage,
    setActiveLanguage,
    handleSubjectChange,
    handleBodyChange,
    openTranslateModal,
    translating,
    renderPreviewHtml,
    renderPreviewText,
    handleInsertToken,
    handleToolbarAction,
    captureSelection,
    textAreaRef,
    handleSaveTemplate,
    handleRevertChanges,
    isDirty,
    languages,
    tokenOptions,
    tokenGroups,
    previewScenarios,
    previewScenario,
    previewScenarioId,
    setPreviewScenarioId,
    diagnostics
  } = useTemplateEditor();

  const [tokenSelectOption, setTokenSelectOption] = useState(null);
  const [subjectTokenSelectOption, setSubjectTokenSelectOption] = useState(null);
  const previewScenarioOptions = useMemo(
    () => previewScenarios.map((scenario) => ({
      label: scenario.label,
      value: scenario.id,
      description: scenario.description
    })),
    [previewScenarios]
  );
  const subjectTokenOptions = useMemo(
    () => tokenOptions
      .filter((option) => !option.value.includes('[link'))
      .map((option) => ({
        label: option.label,
        value: option.value,
        description: option.description
      })),
    [tokenOptions]
  );
  const selectedPreviewScenarioOption =
    previewScenarioOptions.find((option) => option.value === previewScenarioId) || previewScenarioOptions[0];
  const frenchMissing = selectedTemplate && (
    !localizedContent.fr?.subject?.trim() ||
    !localizedContent.fr?.textBody?.trim()
  );

  const renderLanguageSection = (lang) => {
    if (lang !== activeLanguage) {
      return null;
    }
    const langLabel = languages.find((l) => l.id === lang)?.label || lang;
    const content = localizedContent[lang] || { subject: '', textBody: '' };
    const scenarioTokenNames = diagnostics.scenarioTokens.map((item) => `{${item.tokenName}}`);
    const unknownTokenNames = diagnostics.unknownTokens.map((tokenName) => `{${tokenName}}`);
    return (
      <SpaceBetween size="m">
        <Grid
          gridDefinition={[{ colspan: 8 }, { colspan: 4 }]}
          className="subject-row"
          alignItems="end"
        >
          <FormField label={`Subject (${langLabel})`}>
            <Input
              value={content.subject}
              spellcheck
              onChange={({ detail }) => handleSubjectChange(lang, detail.value)}
            />
          </FormField>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 1fr) auto',
              gap: '12px',
              alignItems: 'end'
            }}
          >
            <FormField label="Insert in subject">
              <Select
                expandToViewport
                filteringType="auto"
                placeholder="Field"
                selectedOption={subjectTokenSelectOption}
                options={subjectTokenOptions}
                onChange={({ detail }) => {
                  const option = detail.selectedOption;
                  if (!option?.value) {
                    setSubjectTokenSelectOption(null);
                    return;
                  }
                  const separator = content.subject && !content.subject.endsWith(' ') ? ' ' : '';
                  handleSubjectChange(lang, `${content.subject || ''}${separator}${option.value}`);
                  setSubjectTokenSelectOption(null);
                }}
              />
            </FormField>
            <Button
              onClick={() => openTranslateModal(lang)}
              iconName="gen-ai"
              disabled={translating}
            >
              {lang === 'en' ? 'Translate to French' : 'Traduire en anglais'}
            </Button>
          </div>
        </Grid>
        <Grid gridDefinition={[{ colspan: 7 }, { colspan: 5 }]}>
          <SpaceBetween size="s">
            <FormField label={`Email body (${langLabel})`}>
              <textarea
                ref={lang === activeLanguage ? textAreaRef : null}
                rows={20}
                className="textarea-native"
                value={content.textBody}
                onChange={(event) => {
                  handleBodyChange(lang, event.target.value);
                  captureSelection();
                }}
                onClick={captureSelection}
                onKeyUp={captureSelection}
                onKeyDown={captureSelection}
                onSelect={captureSelection}
                onFocus={captureSelection}
                onMouseUp={captureSelection}
                placeholder="Write the message applicants or staff will receive."
                spellCheck
                style={{ width: '100%', minHeight: 360, padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border-input-default)' }}
              />
            </FormField>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '8px',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                {toolbarActions.map(({ id, label, icon: IconComponent }) => (
                  <button
                    key={`${id}-${lang}`}
                    type="button"
                    aria-label={`${label} (${langLabel})`}
                    onClick={() => handleToolbarAction(id)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      captureSelection();
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      color: 'var(--color-text-body-default)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <IconComponent size={20} weight="regular" />
                  </button>
                ))}
              </div>
              <div style={{ flexGrow: 1, minWidth: '200px', maxWidth: '320px' }}>
                <Select
                  expandToViewport
                  filteringType="auto"
                  placeholder="Insert field"
                  selectedOption={tokenSelectOption}
                  options={tokenOptions.map((option) => ({
                    label: option.label,
                    value: option.value,
                    description: option.description
                  }))}
                  onChange={({ detail }) => {
                    const option = detail.selectedOption;
                    if (!option?.value) {
                      setTokenSelectOption(null);
                      return;
                    }
                    captureSelection();
                    handleInsertToken({ value: option.value });
                    setTokenSelectOption(null);
                  }}
                />
              </div>
            </div>
          </SpaceBetween>
          <SpaceBetween size="m">
              <Header
                variant="h4"
                actions={
                  <div style={{ minWidth: 260 }}>
                    <Select
                      expandToViewport
                      filteringType="auto"
                      ariaLabel="Preview scenario"
                      selectedOption={selectedPreviewScenarioOption}
                      options={previewScenarioOptions}
                      onChange={({ detail }) => {
                        setPreviewScenarioId(detail.selectedOption?.value || DEFAULT_PREVIEW_SCENARIO_ID);
                      }}
                    />
                  </div>
                }
              >
                Preview
              </Header>
              <Box variant="small" color="text-body-secondary">
                {previewScenario.description}
              </Box>
              {unknownTokenNames.length ? (
                <Alert type="warning" header="Unknown fields">
                  {unknownTokenNames.join(', ')}
                </Alert>
              ) : null}
              {scenarioTokenNames.length ? (
                <Box variant="small" color="text-body-secondary">
                  {scenarioTokenNames.length} field{scenarioTokenNames.length === 1 ? '' : 's'} outside this preview scenario:
                  {' '}
                  {scenarioTokenNames.join(', ')}
                </Box>
              ) : null}
              <div style={{ border: '1px solid var(--color-border-divider-default)', borderRadius: '6px', padding: '12px', backgroundColor: 'var(--color-background-layout-panel, #f8f8f8)' }}>
                <Box variant="awsui-key-label">Subject preview</Box>
                <Box margin={{ top: 'xs' }}>
                  {renderPreviewText(content.subject || 'No subject yet.')}
                </Box>
              </div>
              <div style={{ border: '1px solid var(--color-border-divider-default)', borderRadius: '6px', padding: '12px', backgroundColor: 'var(--color-background-layout-panel, #f8f8f8)', minHeight: 260 }}>
                <Box variant="awsui-key-label">Body preview</Box>
                <Box margin={{ top: 's' }}>
                  <div
                    style={{ fontFamily: 'inherit', whiteSpace: 'normal' }}
                    dangerouslySetInnerHTML={{ __html: renderPreviewHtml(content.textBody || '') }}
                  />
                </Box>
              </div>
              <CompactFieldReference
                tokenGroups={tokenGroups}
                previewScenario={previewScenario}
                onInsert={handleInsertToken}
                captureSelection={captureSelection}
              />
          </SpaceBetween>
        </Grid>
      </SpaceBetween>
    );
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description="Draft localized email templates for applicant and staff events. Select a template, edit the bilingual subject and body tabs, then save to publish updates for Notification Settings."
          info={
            <Link
              variant="info"
              onFollow={() =>
                toggleHelpPanel &&
                ManageTemplatesWidgetHelp &&
                toggleHelpPanel(<ManageTemplatesWidgetHelp />, 'Template Editor Help')
              }
            >
              Info
            </Link>
          }
          actions={
            selectedTemplate ? (
              <SpaceBetween direction="horizontal" size="s">
                <Button
                  variant="primary"
                  onClick={handleSaveTemplate}
                  disabled={!isDirty}
                >
                  Save changes
                </Button>
                <Button onClick={handleRevertChanges} disabled={!isDirty}>
                  Cancel
                </Button>
              </SpaceBetween>
            ) : null
          }
        >
          Editor
        </Header>
      }
      dragHandleAriaLabel={dragHandleAriaLabel}
      i18nStrings={i18nStrings}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      {!selectedTemplate ? (
        <Box textAlign="center" padding="xxl">
          <SpaceBetween size="m">
            <Icon name="file" size="large" />
            <Box variant="strong">Select a template to start editing</Box>
            <Box variant="p">Pick an existing template or create a new one using the button above.</Box>
          </SpaceBetween>
        </Box>
      ) : (
        <SpaceBetween size="l">
          <SpaceBetween size="m">
            <FormField label="Template name">
              <Input
                value={selectedTemplate.name}
                spellcheck={false}
                onChange={({ detail }) => setSelectedTemplate({ ...selectedTemplate, name: detail.value })}
              />
            </FormField>
            {frenchMissing ? (
              <Box variant="small" color="text-body-secondary">
                <Badge color="red">French incomplete</Badge>
                {' '}
                Add the French subject and body before assigning this template to bilingual notifications.
              </Box>
            ) : null}
            <Tabs
              activeTabId={activeLanguage}
              onChange={({ detail }) => setActiveLanguage(detail.activeTabId)}
              tabs={languages.map((lang) => ({
                id: lang.id,
                label: lang.label,
                content: renderLanguageSection(lang.id)
              }))}
            />
          </SpaceBetween>
        </SpaceBetween>
      )}
    </BoardItem>
  );
};

export { TemplateLibraryWidget, TemplateEditorWidget };
export default TemplateEditorProvider;
