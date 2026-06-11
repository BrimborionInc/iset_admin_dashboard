import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import Board from '@cloudscape-design/board-components/board';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  FormField,
  Header,
  Input,
  Link,
  RadioGroup,
  Select,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  Textarea,
  Wizard,
} from '@cloudscape-design/components';
import jsonLogic from 'json-logic-js';
import { apiFetch } from '../../auth/apiClient';
import PortalRegistry from '../../portalRendererRegistry';
import ManualApplicationIntakeHelp from '../../helpPanelContents/manualApplicationIntakeHelp';
import { buildConditionComponentLookup } from '../../utils/intakeConditionalVisibility';
import {
  buildManualValidationData,
  collectActiveManualComponents,
  collectHiddenConditionalManualKeys,
  componentIsVisibleInManual,
  findFirstRenderableManualStepIndex,
  findNextRenderableManualStepIndex,
  findStepIndexByField,
  stepHasRenderableManualContent,
} from '../../utils/manualIntakeRuntime';
import './ManualApplicationIntakePage.css';

const STORAGE_KEY = 'manual-application-intake-runtime.v2';
const DASHBOARD_STORAGE_KEY = 'manual-intake-dashboard-layout-v12';
const ACCOUNT_SEARCH_NO_RESULTS_MESSAGE = 'No matching clients or applicant accounts found.';

const INTAKE_SOURCE_OPTIONS = [
  { label: 'Paper application', value: 'paper' },
  { label: 'PDF application', value: 'pdf' },
  { label: 'Phone intake', value: 'phone' },
  { label: 'In-person intake', value: 'in_person' },
  { label: 'Other', value: 'other' },
];

const nonInputTypes = new Set(['paragraph', 'text-block', 'summary-list', 'panel', 'inset-text', 'warning-text']);
const FLOW_WIDGET_ID = 'staff-assisted-intake-flow';
const INTAKE_WIDGET_ID = 'manual-intake-flow';

const ACCOUNT_STRATEGY_OPTIONS = [
  {
    value: 'review_later',
    label: 'Create application, review PATH account after submission',
    description: 'Use when identity, email, or activation timing still needs staff review in the Application Workspace.',
  },
  {
    value: 'create_ready_to_invite',
    label: 'Prepare PATH account, invite later',
    description: 'Create or reuse the applicant account silently so staff can send activation from the workspace or User Management.',
  },
  {
    value: 'link_selected_client',
    label: 'Use selected existing client or account',
    description: 'Attach this application to the selected PATH client and reuse their existing case/account posture.',
  },
  {
    value: 'no_portal_planned',
    label: 'No portal access planned for now',
    description: 'Use for staff-assisted service where portal activation is not appropriate yet. Record the reason.',
  },
];

const widgetRegistry = {
  [FLOW_WIDGET_ID]: {
    id: FLOW_WIDGET_ID,
    defaultRowSpan: 3,
    defaultColumnSpan: 4,
    title: 'Staff-Assisted Intake Flow',
    description: 'Shows the recommended order and current state of the intake process.',
  },
  [INTAKE_WIDGET_ID]: {
    id: INTAKE_WIDGET_ID,
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    title: 'Staff-Assisted Intake Wizard',
    description: 'Complete identity, account handling, application details, and submission.',
  },
};

const defaultLayout = [
  { id: FLOW_WIDGET_ID, rowSpan: 3, columnSpan: 4 },
  { id: INTAKE_WIDGET_ID, rowSpan: 4, columnSpan: 4 },
];

const boardI18nStrings = {
  liveAnnouncementDndStarted: (operation) => (operation === 'resize' ? 'Resizing' : 'Dragging'),
  liveAnnouncementDndItemReordered: (operation) => {
    const position =
      operation.direction === 'horizontal'
        ? `column ${operation.placement.x + 1}`
        : `row ${operation.placement.y + 1}`;
    return `Item moved to ${position}.`;
  },
  liveAnnouncementDndItemResized: (operation) => {
    const base =
      operation.direction === 'horizontal'
        ? `columns ${operation.placement.width}`
        : `rows ${operation.placement.height}`;
    const constraint =
      operation.direction === 'horizontal'
        ? (operation.isMinimalColumnsReached ? ' (minimal)' : '')
        : (operation.isMinimalRowsReached ? ' (minimal)' : '');
    return `Item resized to ${base}${constraint}.`;
  },
  liveAnnouncementDndItemInserted: (operation) => {
    const column = `column ${operation.placement.x + 1}`;
    const row = `row ${operation.placement.y + 1}`;
    return `Item inserted to ${column}, ${row}.`;
  },
  liveAnnouncementDndCommitted: (operation) => `${operation} committed`,
  liveAnnouncementDndDiscarded: (operation) => `${operation} discarded`,
  liveAnnouncementItemRemoved: (op) => `Removed item ${op.item.data.title}.`,
  navigationAriaLabel: 'Manual intake dashboard navigation',
  navigationAriaDescription: 'Use arrow keys to move between widgets.',
  navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
};

const boardItemI18nStrings = {
  dragHandleAriaLabel: 'Drag handle',
  dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
  resizeHandleAriaLabel: 'Resize handle',
  resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
};

function exportLayout(items = []) {
  return items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset,
  }));
}

function toBoardItems(layout = []) {
  return layout
    .map((item) => {
      const def = widgetRegistry[item.id];
      if (!def) return null;
      return {
        id: def.id,
        rowSpan: item.rowSpan ?? def.defaultRowSpan,
        columnSpan: item.columnSpan ?? def.defaultColumnSpan,
        columnOffset: item.columnOffset,
        data: {
          title: def.title,
          description: def.description,
        },
      };
    })
    .filter(Boolean);
}

function computePaletteItems(items = []) {
  return Object.values(widgetRegistry)
    .filter((definition) => !items.some((item) => item.id === definition.id))
    .map((definition) => ({
      id: definition.id,
      data: { title: definition.title, description: definition.description },
    }));
}

function areLayoutsEqual(a = [], b = []) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right || left.id !== right.id) return false;
    if ((left.rowSpan ?? null) !== (right.rowSpan ?? null)) return false;
    if ((left.columnSpan ?? null) !== (right.columnSpan ?? null)) return false;
    if ((left.columnOffset ?? null) !== (right.columnOffset ?? null)) return false;
  }
  return true;
}

function loadDashboardLayoutFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const filtered = parsed.filter((entry) => entry && widgetRegistry[entry.id]);
    return filtered.length ? filtered : null;
  } catch (error) {
    console.error('[ManualIntake] failed to parse stored layout', error);
    return null;
  }
}

function t(lang, value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value[lang] || value.en || value.fr || fallback;
  return fallback;
}

function normalizeTextValue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeValidation(raw) {
  if (!raw || typeof raw !== 'object') return { required: false, rules: [] };
  const next = JSON.parse(JSON.stringify(raw));
  if (!next.requiredMessage && next.errorMessage) {
    next.requiredMessage = typeof next.errorMessage === 'object'
      ? next.errorMessage
      : { en: next.errorMessage, fr: next.errorMessage };
  }
  if (next.pattern) {
    const exists = Array.isArray(next.rules) && next.rules.some((r) => (r.type || r.kind) === 'pattern');
    if (!exists) {
      next.rules = [
        ...(next.rules || []),
        { id: 'auto-pattern', type: 'pattern', trigger: ['submit'], pattern: next.pattern },
      ];
    }
    delete next.pattern;
  }
  if (next.minLength) {
    const exists = Array.isArray(next.rules) && next.rules.some((r) => (r.type || r.kind) === 'length');
    if (!exists) {
      next.rules = [
        ...(next.rules || []),
        { id: 'auto-length', type: 'length', trigger: ['submit'], minLength: next.minLength },
      ];
    }
    delete next.minLength;
  }
  next.rules = Array.isArray(next.rules) ? next.rules : [];
  next.rules = next.rules.map((rule) => {
    if (!rule) return rule;
    const out = { ...rule };
    if (!out.type && out.kind) out.type = out.kind;
    if (!Array.isArray(out.trigger) || out.trigger.length === 0) out.trigger = ['submit'];
    if (!out.severity) out.severity = 'error';
    if (typeof out.block === 'undefined') out.block = out.severity === 'error';
    return out;
  });
  return next;
}

function valueIsEmpty(value, compType) {
  if (String(compType || '').toLowerCase() === 'file-upload') {
    return !Array.isArray(value) || value.length === 0;
  }
  if (value === null || typeof value === 'undefined') return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function coerceNumber(value) {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSinValue(value) {
  const digits = String(value || '').replace(/\D+/g, '').slice(0, 9);
  if (!digits) return '';
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

function normalizeEmailValue(value) {
  return String(value || '').trim().toLowerCase();
}

function readFirstAnswer(answers = {}, keys = []) {
  for (const key of keys) {
    const value = answers[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value !== null && typeof value !== 'undefined' && typeof value !== 'object') return String(value).trim();
  }
  return '';
}

function buildApplicantIdentityPreview(answers = {}) {
  const firstName = readFirstAnswer(answers, ['first-name', 'first_name']);
  const lastName = readFirstAnswer(answers, ['last-name', 'last_name']);
  const preferredName = readFirstAnswer(answers, ['preferred-name', 'preferred_name']);
  const email = normalizeEmailValue(readFirstAnswer(answers, ['contact-email-address', 'contact_email_address', 'email']));
  const phone = readFirstAnswer(answers, ['telephone-day', 'telephone_day', 'phone']);
  const province = readFirstAnswer(answers, ['address-province', 'address_province', 'province']);
  const fullName = [preferredName || firstName, lastName].filter(Boolean).join(' ').trim()
    || [firstName, lastName].filter(Boolean).join(' ').trim();
  const searchText = email || [firstName, lastName].filter(Boolean).join(' ').trim() || phone;
  return {
    firstName,
    lastName,
    preferredName,
    fullName,
    email,
    phone,
    province,
    searchText,
  };
}

function buildAccountDecisionPayload({ accountDecision, selectedApplicantMatch }) {
  return {
    strategy: accountDecision.strategy,
    selectedClientId: selectedApplicantMatch?.clientId || null,
    selectedApplicantName: selectedApplicantMatch?.applicantName || null,
    selectedApplicantEmail: selectedApplicantMatch?.email || selectedApplicantMatch?.accountEmail || null,
    selectedAccountStatus: selectedApplicantMatch?.accountStatus || null,
    searchQuery: accountDecision.searchQuery || null,
    notes: accountDecision.notes || null,
  };
}

function getAccountDecisionError({ accountDecision, selectedApplicantMatch, applicantIdentityPreview }) {
  if (accountDecision.strategy === 'link_selected_client' && !selectedApplicantMatch?.clientId) {
    return 'Select an existing client/account match before choosing this option.';
  }
  if (accountDecision.strategy === 'create_ready_to_invite' && !applicantIdentityPreview.email) {
    return 'Enter the applicant email before preparing a PATH account.';
  }
  if (accountDecision.strategy === 'no_portal_planned' && !String(accountDecision.notes || '').trim()) {
    return 'Record why portal access is not planned before creating the application.';
  }
  return '';
}

function accountStatusBadge(status, label) {
  const map = {
    no_account: { color: 'grey', text: label || 'No account' },
    created: { color: 'blue', text: label || 'Ready to invite' },
    invitation_sent: { color: 'green', text: label || 'Invitation sent' },
    activated: { color: 'green', text: label || 'Activated' },
  };
  const cfg = map[status] || { color: 'grey', text: label || status || 'Unknown' };
  return <Badge color={cfg.color}>{cfg.text}</Badge>;
}

function getAccountStrategyShortLabel(strategy) {
  const map = {
    review_later: 'Review later',
    create_ready_to_invite: 'Prepare for invite',
    link_selected_client: 'Use existing client',
    no_portal_planned: 'No portal planned',
  };
  return map[strategy] || 'Review later';
}

function buildManualIntakeFlowSteps({
  applicantIdentityPreview,
  selectedApplicantMatch,
  accountDecision,
  accountSearchLoading,
  accountSearchResults,
  accountSearchError,
  accountValidationError,
  started,
  loading,
  schemaError,
  currentVisibleStepNumber,
  totalVisibleSteps,
  isFinalStep,
  submitting,
}) {
  const identityComplete = Boolean(applicantIdentityPreview.fullName && applicantIdentityPreview.email);
  const identityStarted = Boolean(
    applicantIdentityPreview.fullName ||
    applicantIdentityPreview.email ||
    applicantIdentityPreview.phone ||
    applicantIdentityPreview.province
  );
  const noSearchResults = accountSearchError === ACCOUNT_SEARCH_NO_RESULTS_MESSAGE;
  const possibleMatches = Array.isArray(accountSearchResults) ? accountSearchResults.length : 0;
  const searchReady = Boolean(accountDecision.searchQuery || applicantIdentityPreview.searchText);
  const strategy = accountDecision.strategy || 'review_later';
  const hasDecisionNote = Boolean(String(accountDecision.notes || '').trim());
  const selectedName = selectedApplicantMatch?.applicantName || 'Selected client';

  const flowSteps = [
    {
      id: 'identity',
      title: 'Identity',
      status: identityComplete ? 'Captured' : identityStarted ? 'In progress' : 'Not started',
      type: identityComplete ? 'success' : identityStarted ? 'in-progress' : 'pending',
      detail: identityComplete
        ? 'Name and email are ready.'
        : identityStarted
          ? 'Finish key identity fields.'
          : 'Start with the applicant name and contact details.',
      complete: identityComplete,
    },
  ];

  if (selectedApplicantMatch) {
    flowSteps.push({
      id: 'account-check',
      title: 'Check Existing Account',
      status: 'Match selected',
      type: 'success',
      detail: selectedName,
      complete: true,
    });
  } else if (accountSearchLoading) {
    flowSteps.push({
      id: 'account-check',
      title: 'Check Existing Account',
      status: 'Searching',
      type: 'loading',
      detail: 'Searching PATH records.',
      complete: false,
    });
  } else if (noSearchResults) {
    flowSteps.push({
      id: 'account-check',
      title: 'Check Existing Account',
      status: 'No match found',
      type: 'success',
      detail: 'Proceed with account handling.',
      complete: true,
    });
  } else if (accountSearchError) {
    flowSteps.push({
      id: 'account-check',
      title: 'Check Existing Account',
      status: 'Needs review',
      type: 'warning',
      detail: accountSearchError,
      complete: false,
    });
  } else if (possibleMatches > 0) {
    flowSteps.push({
      id: 'account-check',
      title: 'Check Existing Account',
      status: 'Select a match',
      type: 'in-progress',
      detail: `${possibleMatches} possible match${possibleMatches === 1 ? '' : 'es'} found.`,
      complete: false,
    });
  } else {
    flowSteps.push({
      id: 'account-check',
      title: 'Check Existing Account',
      status: searchReady ? 'Ready to search' : 'Waiting',
      type: searchReady ? 'in-progress' : 'pending',
      detail: searchReady
        ? 'Search before submitting.'
        : 'Use name, email, case, or region.',
      complete: false,
    });
  }

  const handlingBase = {
    id: 'account-handling',
    title: 'Account Handling',
    detail: getAccountStrategyShortLabel(strategy),
  };
  if (accountValidationError) {
    flowSteps.push({
      ...handlingBase,
      status: 'Needs decision',
      type: 'warning',
      detail: accountValidationError,
      complete: false,
    });
  } else if (strategy === 'link_selected_client') {
    flowSteps.push({
      ...handlingBase,
      status: selectedApplicantMatch ? 'Linked' : 'Select match',
      type: selectedApplicantMatch ? 'success' : 'warning',
      detail: selectedApplicantMatch ? selectedName : 'Choose a search result.',
      complete: Boolean(selectedApplicantMatch),
    });
  } else if (strategy === 'create_ready_to_invite') {
    flowSteps.push({
      ...handlingBase,
      status: applicantIdentityPreview.email ? 'Ready' : 'Email needed',
      type: applicantIdentityPreview.email ? 'success' : 'warning',
      detail: applicantIdentityPreview.email
        ? 'Prepare silently for later activation.'
        : 'Enter email before preparing.',
      complete: Boolean(applicantIdentityPreview.email),
    });
  } else if (strategy === 'no_portal_planned') {
    flowSteps.push({
      ...handlingBase,
      status: hasDecisionNote ? 'Recorded' : 'Reason needed',
      type: hasDecisionNote ? 'success' : 'warning',
      detail: hasDecisionNote
        ? 'Staff-assisted context will be saved.'
        : 'Add a no-portal note.',
      complete: hasDecisionNote,
    });
  } else {
    flowSteps.push({
      ...handlingBase,
      status: 'Review after submit',
      type: 'info',
      detail: 'Activation stays as explicit follow-up.',
      complete: true,
    });
  }

  if (schemaError) {
    flowSteps.push({
      id: 'application-details',
      title: 'Application Details',
      status: 'Schema error',
      type: 'error',
      detail: 'The intake form could not load.',
      complete: false,
    });
  } else if (loading) {
    flowSteps.push({
      id: 'application-details',
      title: 'Application Details',
      status: 'Loading',
      type: 'loading',
      detail: 'Loading the intake form.',
      complete: false,
    });
  } else if (started) {
    flowSteps.push({
      id: 'application-details',
      title: 'Application Details',
      status: isFinalStep ? 'Final step' : `Step ${currentVisibleStepNumber} of ${totalVisibleSteps}`,
      type: isFinalStep ? 'info' : 'in-progress',
      detail: 'Complete visible intake fields.',
      complete: false,
    });
  } else {
    flowSteps.push({
      id: 'application-details',
      title: 'Application Details',
      status: 'Not started',
      type: 'pending',
      detail: 'Start after identity/account triage.',
      complete: false,
    });
  }

  flowSteps.push({
    id: 'submit-follow-up',
    title: 'Submit & Follow Up',
    status: submitting ? 'Submitting' : started && isFinalStep ? 'Ready' : 'Not ready',
    type: submitting ? 'loading' : started && isFinalStep ? 'in-progress' : 'pending',
    detail: 'Create the application; activation remains follow-up.',
    complete: false,
  });

  return flowSteps;
}

function getFlowCardTone(type) {
  const tones = {
    success: {
      border: '#037f0c',
      background: '#f1faf2',
      marker: '#037f0c',
    },
    'in-progress': {
      border: '#0972d3',
      background: '#f1f7ff',
      marker: '#0972d3',
    },
    info: {
      border: '#0972d3',
      background: '#f1f7ff',
      marker: '#0972d3',
    },
    loading: {
      border: '#0972d3',
      background: '#f1f7ff',
      marker: '#0972d3',
    },
    warning: {
      border: '#a65d03',
      background: '#fff7ed',
      marker: '#a65d03',
    },
    error: {
      border: '#d13212',
      background: '#fff3f0',
      marker: '#d13212',
    },
    pending: {
      border: '#7d8998',
      background: '#f6f7f7',
      marker: '#7d8998',
    },
  };
  return tones[type] || tones.pending;
}

const REGISTRATION_KEYS = [
  'sfn-registration-number',
  'nsfn-registration-number',
  'metis-registration-number',
  'inuit-registration-number',
  'registration-number',
];

const REGISTRATION_KEY_BY_IDENTITY = {
  first_nations_status: 'sfn-registration-number',
  first_nations_non_status: 'nsfn-registration-number',
  metis: 'metis-registration-number',
  inuit: 'inuit-registration-number',
};

function harmonizeRegistrationAnswers(rawAnswers = {}) {
  const answers = { ...rawAnswers };
  const identity = String(answers['legal-indigenous-identity'] || '').trim();
  const targetKey = REGISTRATION_KEY_BY_IDENTITY[identity] || 'sfn-registration-number';
  const generic = String(answers['registration-number'] || '').trim();

  if (generic) {
    if (!String(answers[targetKey] || '').trim()) {
      answers[targetKey] = generic;
    }
  } else {
    for (const key of REGISTRATION_KEYS) {
      const value = String(answers[key] || '').trim();
      if (!value) continue;
      answers['registration-number'] = value;
      if (!String(answers[targetKey] || '').trim()) {
        answers[targetKey] = value;
      }
      break;
    }
  }
  return answers;
}

function evaluateRule(rule, value, allValues) {
  const type = rule.type || rule.kind;
  const message = () => {
    if (typeof rule.message === 'string') return rule.message;
    if (rule.message && typeof rule.message === 'object') return rule.message.en || rule.message.fr || 'Invalid value';
    return 'Invalid value';
  };
  try {
    if (type === 'predicate') {
      if (!rule.when) return { failed: false };
      return jsonLogic.apply(rule.when, allValues) ? { failed: true, message: message() } : { failed: false };
    }
    if (type === 'atLeastOne') {
      const fields = Array.isArray(rule.fields) ? rule.fields : [];
      const ok = fields.some((field) => !valueIsEmpty(allValues[field], null));
      return ok ? { failed: false } : { failed: true, message: message() };
    }
    if (type === 'range') {
      if (valueIsEmpty(value, null)) return { failed: false };
      const n = coerceNumber(value);
      if (n === null) return { failed: false };
      if (rule.min !== undefined && n < Number(rule.min)) return { failed: true, message: message() };
      if (rule.max !== undefined && n > Number(rule.max)) return { failed: true, message: message() };
      return { failed: false };
    }
    if (type === 'length') {
      if (typeof value !== 'string' || value === '') return { failed: false };
      if (rule.minLength !== undefined && value.length < Number(rule.minLength)) return { failed: true, message: message() };
      if (rule.maxLength !== undefined && value.length > Number(rule.maxLength)) return { failed: true, message: message() };
      return { failed: false };
    }
    if (type === 'pattern') {
      if (typeof value !== 'string' || value === '' || !rule.pattern) return { failed: false };
      const re = new RegExp(rule.pattern, rule.flags || '');
      return re.test(value) ? { failed: false } : { failed: true, message: message() };
    }
    if (type === 'compare') {
      const resolve = (operand) => (
        typeof operand === 'string' && Object.prototype.hasOwnProperty.call(allValues, operand)
          ? allValues[operand]
          : operand
      );
      const left = resolve(rule.left);
      const right = resolve(rule.right);
      let ok = true;
      switch (rule.op) {
        case '==': ok = left === right; break;
        case '!=': ok = left !== right; break;
        case '>': ok = Number(left) > Number(right); break;
        case '>=': ok = Number(left) >= Number(right); break;
        case '<': ok = Number(left) < Number(right); break;
        case '<=': ok = Number(left) <= Number(right); break;
        default: ok = true;
      }
      return ok ? { failed: false } : { failed: true, message: message() };
    }
  } catch (_) {
    return { failed: false };
  }
  return { failed: false };
}

function getStepId(step, index) {
  return step.stepId || step.id || `step-${index + 1}`;
}

function componentKey(component, index) {
  return component.storageKey || component.id || `component-${index}`;
}

function StepRenderer({ step, answers, errors, setAnswer, lang, componentLookup, stepTitle }) {
  const renderNode = (component, componentIndex, isTopLevel = true) => {
    if (!component || !componentIsVisibleInManual(component, answers, componentLookup)) return null;

    const key = componentKey(component, componentIndex);
    const type = String(component.type || '').toLowerCase();
    if (type === 'signature-ack' || type === 'file-upload') return null;

    if ((type === 'paragraph' || type === 'text-block') && isTopLevel && componentIndex === 0) {
      const headingText = t(lang, component?.text, '');
      if (normalizeTextValue(headingText) && normalizeTextValue(headingText) === normalizeTextValue(stepTitle)) {
        return null;
      }
    }

    if (type === 'warning-text') {
      const text = t(lang, component?.text || component?.props?.text, '');
      const assistive = t(lang, component?.iconFallbackText || component?.props?.iconFallbackText, '');
      const classes = component?.classes || component?.props?.classes || '';
      return (
        <div key={key} className={`govuk-warning-text ${classes}`.trim()} role={component?.role || component?.props?.role || 'alert'} style={{ marginBottom: 16 }}>
          <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
          <strong className="govuk-warning-text__text">
            {assistive ? <span className="govuk-warning-text__assistive">{assistive} </span> : null}
            {text}
          </strong>
        </div>
      );
    }

    const Comp = PortalRegistry[type];
    if (!Comp) {
      return (
        <Alert key={key} type="warning" header={`Unsupported component type: ${type || 'unknown'}`}>
          This component is not currently renderable in admin manual intake.
        </Alert>
      );
    }

    return (
      <Comp
        key={key}
        comp={component}
        lang={lang}
        value={answers[key]}
        values={answers}
        error={errors[key]}
        onChange={(next) => setAnswer(key, next)}
        render={(child) => renderNode(child, child?.storageKey || child?.id || `${key}-child`, false)}
      />
    );
  };

  const renderComponent = (component, componentIndex) => {
    return renderNode(component, componentIndex, true);
  };

  const components = Array.isArray(step?.components) ? step.components : [];
  return <>{components.map(renderComponent)}</>;
}

function validateStep(step, answers, lang, componentLookup) {
  const errors = {};
  const activeComponents = collectActiveManualComponents(step, answers, componentLookup);
  const validationData = buildManualValidationData(step, answers);

  activeComponents.forEach((component, index) => {
    const key = componentKey(component, index);
    const type = String(component.type || '').toLowerCase();
    if (nonInputTypes.has(type) || type === 'signature-ack' || type === 'file-upload') return;

    const value = answers[key];
    const rawValidation = component?.validation && typeof component.validation === 'object'
      ? component.validation
      : (component?.props?.validation && typeof component.props.validation === 'object' ? component.props.validation : {});
    const validation = normalizeValidation(rawValidation);

    const required = Boolean(component.required || component?.props?.required || validation.required);
    if (required && valueIsEmpty(value, type)) {
      errors[key] = t(lang, validation.requiredMessage, 'This field is required');
      return;
    }

    for (const rule of validation.rules) {
      const triggers = Array.isArray(rule.trigger) ? rule.trigger : ['submit'];
      if (!triggers.includes('submit')) continue;
      const result = evaluateRule(rule, value, validationData);
      if (!result.failed) continue;
      errors[key] = result.message || 'Invalid value';
      if (rule.block !== false) break;
    }
  });

  return errors;
}

function buildDraftPayload({
  schemaVersion,
  workflowId,
  stepIndex,
  answers,
  history,
  intakeSource,
  intakeSourceNotes,
  accountDecision,
  selectedApplicantMatch,
  noExistingMatchConfirmed,
  lang,
}) {
  return {
    schemaVersion,
    workflowId,
    stepIndex,
    answers,
    history,
    intakeSource,
    intakeSourceNotes,
    accountDecision,
    selectedApplicantMatch,
    noExistingMatchConfirmed,
    lang,
  };
}

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

const ManualApplicationIntakePage = ({ setAvailableItems, setSplitPanelOpen, toggleHelpPanel }) => {
  const history = useHistory();
  const [layout, setLayout] = useState(() => loadDashboardLayoutFromStorage() ?? defaultLayout);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems.map((item) => item.id)));
  const [activeWizardStepIndex, setActiveWizardStepIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState('');
  const [schemaVersion, setSchemaVersion] = useState(null);
  const [workflowId, setWorkflowId] = useState('iset-v1');
  const [steps, setSteps] = useState([]);
  const [runner, setRunner] = useState({ stepIndex: 0, answers: {}, errors: {}, history: [] });
  const [lang, setLang] = useState('en');
  const [intakeSource, setIntakeSource] = useState('paper');
  const [intakeSourceNotes, setIntakeSourceNotes] = useState('');
  const [accountDecision, setAccountDecision] = useState({
    strategy: 'review_later',
    searchQuery: '',
    notes: '',
  });
  const [selectedApplicantMatch, setSelectedApplicantMatch] = useState(null);
  const [noExistingMatchConfirmed, setNoExistingMatchConfirmed] = useState(false);
  const [accountSearchResults, setAccountSearchResults] = useState([]);
  const [accountSearchLoading, setAccountSearchLoading] = useState(false);
  const [accountSearchError, setAccountSearchError] = useState('');
  const [accountValidationError, setAccountValidationError] = useState('');
  const [wizardNavigationError, setWizardNavigationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const componentLookup = useMemo(() => buildConditionComponentLookup(steps), [steps]);
  const applicantIdentityPreview = useMemo(
    () => buildApplicantIdentityPreview(runner.answers),
    [runner.answers]
  );
  const currentStep = steps[runner.stepIndex] || null;
  const currentStepId = currentStep ? getStepId(currentStep, runner.stepIndex) : null;
  const hiddenConditionalKeys = useMemo(
    () => collectHiddenConditionalManualKeys(steps, runner.answers, componentLookup),
    [componentLookup, runner.answers, steps]
  );
  const nextRenderableStepIndex = useMemo(
    () => findNextRenderableManualStepIndex(runner.stepIndex, runner.answers, steps, componentLookup),
    [componentLookup, runner.answers, runner.stepIndex, steps]
  );
  const visibleStepIndices = useMemo(() => {
    const indices = steps.reduce((acc, step, index) => {
      if (stepHasRenderableManualContent(step, runner.answers, componentLookup)) acc.push(index);
      return acc;
    }, []);
    return indices.length ? indices : steps.map((_, index) => index);
  }, [componentLookup, runner.answers, steps]);
  const currentVisibleStepIndex = visibleStepIndices.indexOf(runner.stepIndex);
  const currentVisibleStepNumber = currentVisibleStepIndex >= 0 ? currentVisibleStepIndex + 1 : 1;
  const totalVisibleSteps = visibleStepIndices.length || 1;
  const isFinalStep = Boolean(currentStep) && nextRenderableStepIndex < 0;
  const currentIntakeStepErrors = useMemo(
    () => (currentStep ? validateStep(currentStep, runner.answers, lang, componentLookup) : {}),
    [componentLookup, currentStep, lang, runner.answers]
  );
  const currentIntakeStepValid = Object.keys(currentIntakeStepErrors).length === 0;
  const identityStepComplete = Boolean(applicantIdentityPreview.fullName && applicantIdentityPreview.email && intakeSource);
  const accountSearchStepComplete = Boolean(selectedApplicantMatch?.clientId || noExistingMatchConfirmed);
  const accountDecisionErrorText = useMemo(
    () => getAccountDecisionError({ accountDecision, selectedApplicantMatch, applicantIdentityPreview }),
    [accountDecision, applicantIdentityPreview, selectedApplicantMatch]
  );
  const accountHandlingStepComplete = accountSearchStepComplete && !accountDecisionErrorText;
  const applicationDetailsStepComplete = Boolean(started && currentStep && isFinalStep && currentIntakeStepValid);
  const wizardI18nStrings = useMemo(() => ({
    stepNumberLabel: stepNumber => `Step ${stepNumber}`,
    collapsedStepsLabel: (stepNumber, stepsCount) => `Step ${stepNumber} of ${stepsCount}`,
    navigationAriaLabel: 'Staff-assisted intake steps',
    cancelButton: '',
    previousButton: activeWizardStepIndex === 3 && runner.history.length > 0 ? 'Previous form step' : 'Previous',
    nextButton: activeWizardStepIndex === 3 && !isFinalStep ? 'Next form step' : 'Next',
    optional: 'Optional',
    nextButtonLoadingAnnouncement: 'Loading next intake step',
    submitButtonLoadingAnnouncement: 'Creating application',
  }), [activeWizardStepIndex, isFinalStep, runner.history.length]);
  const wizardStepAccess = useMemo(() => ([
    true,
    identityStepComplete,
    accountSearchStepComplete,
    accountHandlingStepComplete,
    applicationDetailsStepComplete,
  ]), [
    accountHandlingStepComplete,
    accountSearchStepComplete,
    applicationDetailsStepComplete,
    identityStepComplete,
  ]);
  const flowSteps = useMemo(() => buildManualIntakeFlowSteps({
    applicantIdentityPreview,
    selectedApplicantMatch,
    accountDecision,
    accountSearchLoading,
    accountSearchResults,
    accountSearchError,
    accountValidationError,
    started,
    loading,
    schemaError,
    currentVisibleStepNumber,
    totalVisibleSteps,
    isFinalStep,
    submitting,
  }), [
    accountDecision,
    accountSearchError,
    accountSearchLoading,
    accountSearchResults,
    accountValidationError,
    applicantIdentityPreview,
    currentVisibleStepNumber,
    isFinalStep,
    loading,
    schemaError,
    selectedApplicantMatch,
    started,
    submitting,
    totalVisibleSteps,
  ]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems.map((item) => item.id));
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
        try { setAvailableItems(paletteItems); } catch (_) {}
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
      } catch (_) {}
    }
  }, [boardItems, paletteItems, setAvailableItems]);

  const resetLayout = useCallback(() => {
    setLayout((current) => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
    paletteSignatureRef.current = JSON.stringify(defaultPalette.map((item) => item.id));
    if (typeof setAvailableItems === 'function') {
      try { setAvailableItems(defaultPalette); } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(DASHBOARD_STORAGE_KEY); } catch (_) {}
    }
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === 'function') {
      try { setAvailableItems(paletteItems); } catch (_) {}
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    const handlePaletteAdd = (event) => {
      const id = event?.detail?.id;
      if (!id || !widgetRegistry[id]) return;
      setLayout((current) => {
        if (current.some((item) => item.id === id)) return current;
        return [...current, { id }];
      });
    };
    window.addEventListener('manualIntake:openPalette', handleOpen);
    window.addEventListener('manualIntake:resetLayout', handleReset);
    window.addEventListener('palette:add', handlePaletteAdd);
    return () => {
      window.removeEventListener('manualIntake:openPalette', handleOpen);
      window.removeEventListener('manualIntake:resetLayout', handleReset);
      window.removeEventListener('palette:add', handlePaletteAdd);
    };
  }, [openPalette, resetLayout]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;

    async function loadSchema() {
      setLoading(true);
      setSchemaError('');
      try {
        const response = await apiFetch('/api/workflows/published/intake-schema');
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.message || data?.error || 'Failed to load published intake schema');
        }
        const nextSteps = Array.isArray(data.steps) ? data.steps : [];
        if (!nextSteps.length) {
          throw new Error('Published intake schema has no steps');
        }
        if (cancelled) return;

        const draft = loadDraft();
        const nextVersion = data.version || null;
        const nextWorkflowId = String(data.workflowId || data?.meta?.workflowId || 'iset-v1');
        const nextComponentLookup = buildConditionComponentLookup(nextSteps);

        setSchemaVersion(nextVersion);
        setWorkflowId(nextWorkflowId);
        setSteps(nextSteps);

        if (draft && draft.schemaVersion === nextVersion) {
          const draftAnswers = draft.answers && typeof draft.answers === 'object' ? draft.answers : {};
          const restoredIndex = Number.isInteger(draft.stepIndex) ? Math.min(Math.max(draft.stepIndex, 0), nextSteps.length - 1) : 0;
          const restoredStepIsRenderable = stepHasRenderableManualContent(nextSteps[restoredIndex], draftAnswers, nextComponentLookup);
          const restoredStepIndex = (() => {
            if (restoredStepIsRenderable) return restoredIndex;
            const candidate = restoredIndex > 0
              ? findNextRenderableManualStepIndex(restoredIndex - 1, draftAnswers, nextSteps, nextComponentLookup)
              : -1;
            return candidate >= 0
              ? candidate
              : findFirstRenderableManualStepIndex(nextSteps, draftAnswers, nextComponentLookup);
          })();
          setRunner({
            stepIndex: restoredStepIndex,
            answers: draftAnswers,
            errors: {},
            history: Array.isArray(draft.history)
              ? draft.history.filter((index) => Number.isInteger(index) && index >= 0 && index < nextSteps.length)
              : [],
          });
          setIntakeSource(draft.intakeSource || 'paper');
          setIntakeSourceNotes(draft.intakeSourceNotes || '');
          setAccountDecision({
            strategy: draft.accountDecision?.strategy || 'review_later',
            searchQuery: draft.accountDecision?.searchQuery || '',
            notes: draft.accountDecision?.notes || '',
          });
          setSelectedApplicantMatch(draft.selectedApplicantMatch || null);
          setNoExistingMatchConfirmed(Boolean(draft.noExistingMatchConfirmed));
          setLang(draft.lang === 'fr' ? 'fr' : 'en');
        } else {
          const firstRenderable = findFirstRenderableManualStepIndex(nextSteps, {}, nextComponentLookup);
          setRunner(previous => ({ stepIndex: firstRenderable, answers: previous.answers || {}, errors: {}, history: [] }));
          setLang('en');
        }
      } catch (error) {
        if (!cancelled) {
          setSchemaError(error?.message || 'Failed to load published intake schema');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSchema();
    return () => {
      cancelled = true;
    };
  }, [started]);

  useEffect(() => {
    if (!started || !schemaVersion) return;
    try {
      const payload = buildDraftPayload({
        schemaVersion,
        workflowId,
        stepIndex: runner.stepIndex,
        answers: runner.answers,
        history: runner.history,
        intakeSource,
        intakeSourceNotes,
        accountDecision,
        selectedApplicantMatch,
        noExistingMatchConfirmed,
        lang,
      });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      // ignore session storage errors
    }
  }, [
    started,
    schemaVersion,
    workflowId,
    runner.stepIndex,
    runner.answers,
    runner.history,
    intakeSource,
    intakeSourceNotes,
    accountDecision,
    selectedApplicantMatch,
    noExistingMatchConfirmed,
    lang,
  ]);

  useEffect(() => {
    if (!hiddenConditionalKeys.size) return;
    setRunner((previous) => {
      let changed = false;
      const nextAnswers = { ...previous.answers };
      const nextErrors = { ...previous.errors };
      hiddenConditionalKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(nextAnswers, key)) {
          delete nextAnswers[key];
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(nextErrors, key)) {
          delete nextErrors[key];
          changed = true;
        }
      });
      return changed ? { ...previous, answers: nextAnswers, errors: nextErrors } : previous;
    });
  }, [hiddenConditionalKeys]);

  useEffect(() => {
    if (!started || !steps.length || !currentStep) return;
    if (stepHasRenderableManualContent(currentStep, runner.answers, componentLookup)) return;
    const fallbackIndex = runner.stepIndex > 0
      ? findNextRenderableManualStepIndex(runner.stepIndex - 1, runner.answers, steps, componentLookup)
      : findFirstRenderableManualStepIndex(steps, runner.answers, componentLookup);
    if (!Number.isInteger(fallbackIndex) || fallbackIndex < 0 || fallbackIndex === runner.stepIndex) return;
    setRunner((previous) => ({ ...previous, stepIndex: fallbackIndex, errors: {} }));
  }, [componentLookup, currentStep, runner.answers, runner.stepIndex, started, steps]);

  const setAnswer = (key, value) => {
    const nextValue = key === 'social-insurance-number' ? normalizeSinValue(value) : value;
    setRunner((prev) => {
      const nextErrors = { ...prev.errors };
      delete nextErrors[key];
      return {
        ...prev,
        answers: { ...prev.answers, [key]: nextValue },
        errors: nextErrors,
      };
    });
  };

  const goBack = () => {
    setRunner((prev) => {
      if (!prev.history.length) return prev;
      const nextHistory = [...prev.history];
      while (nextHistory.length) {
        const previous = nextHistory.pop();
        if (!stepHasRenderableManualContent(steps[previous], prev.answers, componentLookup)) continue;
        return {
          ...prev,
          stepIndex: previous,
          history: nextHistory,
          errors: {},
        };
      }
      return { ...prev, history: [], errors: {} };
    });
  };

  const goNext = () => {
    if (!currentStep) return;
    const errors = validateStep(currentStep, runner.answers, lang, componentLookup);
    if (Object.keys(errors).length > 0) {
      setRunner((prev) => ({ ...prev, errors }));
      return;
    }
    if (nextRenderableStepIndex < 0) return;
    setRunner((prev) => ({
      ...prev,
      stepIndex: nextRenderableStepIndex,
      history: [...prev.history, prev.stepIndex],
      errors: {},
    }));
  };

  const runAccountSearch = useCallback(async (queryOverride = null) => {
    const query = String(queryOverride ?? accountDecision.searchQuery ?? '').trim();
    if (!query) {
      setAccountSearchError('Enter an email, name, case number, or region to search.');
      setAccountSearchResults([]);
      return;
    }
    setAccountSearchLoading(true);
    setAccountSearchError('');
    setNoExistingMatchConfirmed(false);
    try {
      const params = new URLSearchParams({
        q: query,
        pageSize: '8',
        page: '1',
        sortField: 'status',
        sortDirection: 'asc',
      });
      const response = await apiFetch(`/api/admin/applicants?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to search applicant accounts');
      }
      const users = Array.isArray(data.users) ? data.users : [];
      setAccountSearchResults(users);
      if (!users.length) {
        setAccountSearchError(ACCOUNT_SEARCH_NO_RESULTS_MESSAGE);
        setNoExistingMatchConfirmed(true);
      }
    } catch (error) {
      setAccountSearchResults([]);
      setAccountSearchError(error?.message || 'Failed to search applicant accounts');
    } finally {
      setAccountSearchLoading(false);
    }
  }, [accountDecision.searchQuery]);

  const validateAccountDecision = () => {
    return getAccountDecisionError({ accountDecision, selectedApplicantMatch, applicantIdentityPreview });
  };

  const handleSubmit = async () => {
    if (!currentStep) return;
    const errors = validateStep(currentStep, runner.answers, lang, componentLookup);
    if (Object.keys(errors).length > 0) {
      setRunner((prev) => ({ ...prev, errors }));
      return;
    }

    const nextAccountError = validateAccountDecision();
    if (nextAccountError) {
      setAccountValidationError(nextAccountError);
      return;
    }

    setSubmitError('');
    setAccountValidationError('');
    setSubmitting(true);
    try {
      const response = await apiFetch('/api/applications/manual-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          intakePayload: harmonizeRegistrationAnswers(runner.answers),
          history: runner.history
            .map((stepIndex) => ({ step: steps[stepIndex], stepIndex }))
            .filter((entry) => Boolean(entry.step))
            .map((entry) => getStepId(entry.step, entry.stepIndex)),
          intakeSource,
          intakeSourceNotes,
          accountDecision: buildAccountDecisionPayload({ accountDecision, selectedApplicantMatch }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data?.fields && typeof data.fields === 'object') {
          setRunner((prev) => ({ ...prev, errors: data.fields }));
          const firstField = Object.keys(data.fields)[0];
          const stepIndex = findStepIndexByField(firstField, steps);
          if (stepIndex >= 0) {
            setRunner((prev) => ({ ...prev, stepIndex }));
          }
        }
        throw new Error(data?.message || data?.error || 'Failed to create application');
      }
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
      history.push(`/application-case/${data.case_id}`, {
        flashMessage: `Application ${data.tracking_id || ''} created successfully.`,
        flashType: 'success',
      });
    } catch (error) {
      setSubmitError(error?.message || 'Failed to create application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleItemsChange = ({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const next = exportLayout(detail.items);
    setLayout((current) => (areLayoutsEqual(current, next) ? current : next));
  };

  const getWizardStepBlockedMessage = (stepIndex) => {
    if (stepIndex <= 0) return '';
    if (stepIndex === 1 && !identityStepComplete) {
      return 'Enter the applicant name, email, and intake source first.';
    }
    if (stepIndex === 2 && !accountSearchStepComplete) {
      return 'Search for an existing client/account or continue without a match.';
    }
    if (stepIndex === 3 && !accountHandlingStepComplete) {
      return accountDecisionErrorText || 'Choose an account handling plan.';
    }
    if (stepIndex === 4 && !applicationDetailsStepComplete) {
      return 'Complete the visible application form step before review.';
    }
    return '';
  };

  const activateWizardStep = (stepIndex) => {
    const blockedMessage = getWizardStepBlockedMessage(stepIndex);
    if (blockedMessage) {
      setWizardNavigationError(blockedMessage);
      if (stepIndex === 1) setActiveWizardStepIndex(0);
      if (stepIndex === 2) setActiveWizardStepIndex(identityStepComplete ? 1 : 0);
      if (stepIndex === 3) setActiveWizardStepIndex(accountSearchStepComplete ? 2 : (identityStepComplete ? 1 : 0));
      if (stepIndex === 4) setActiveWizardStepIndex(accountHandlingStepComplete ? 3 : (accountSearchStepComplete ? 2 : 0));
      return false;
    }
    if (stepIndex === 3 && !started) setStarted(true);
    setWizardNavigationError('');
    setAccountValidationError('');
    setActiveWizardStepIndex(stepIndex);
    return true;
  };

  const handleWizardNavigate = ({ detail }) => {
    const requestedStepIndex = detail?.requestedStepIndex;
    const reason = detail?.reason;
    if (!Number.isInteger(requestedStepIndex) || requestedStepIndex < 0 || requestedStepIndex > 4) return;
    if (requestedStepIndex === activeWizardStepIndex) return;

    if (reason === 'previous' && activeWizardStepIndex === 3 && runner.history.length > 0) {
      goBack();
      return;
    }

    if (requestedStepIndex > activeWizardStepIndex) {
      if (activeWizardStepIndex === 0 && !identityStepComplete) {
        setWizardNavigationError('Enter the applicant name, email, and intake source first.');
        return;
      }
      if (activeWizardStepIndex === 1 && !accountSearchStepComplete) {
        setWizardNavigationError('Search for an existing client/account or continue without a match.');
        return;
      }
      if (activeWizardStepIndex === 2) {
        const nextAccountError = validateAccountDecision();
        if (nextAccountError) {
          setAccountValidationError(nextAccountError);
          setWizardNavigationError(nextAccountError);
          return;
        }
      }
      if (activeWizardStepIndex === 3) {
        if (!started) {
          setStarted(true);
          return;
        }
        if (!currentStep) return;
        const errors = validateStep(currentStep, runner.answers, lang, componentLookup);
        if (Object.keys(errors).length > 0) {
          setRunner((prev) => ({ ...prev, errors }));
          setWizardNavigationError('Complete required fields before continuing.');
          return;
        }
        if (!isFinalStep) {
          goNext();
          return;
        }
      }
    }

    activateWizardStep(requestedStepIndex);
  };

  const renderProcessFlowContent = () => (
    <SpaceBetween size="s">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          alignItems: 'stretch',
        }}
      >
        {flowSteps.map((step, index) => {
          const tone = getFlowCardTone(step.type);
          const locked = !wizardStepAccess[index];
          const active = activeWizardStepIndex === index;
          return (
            <button
              type="button"
              key={step.id}
              onClick={() => activateWizardStep(index)}
              aria-current={active ? 'step' : undefined}
              disabled={locked && !active}
              style={{
                position: 'relative',
                minWidth: 0,
                minHeight: '132px',
                height: '100%',
                padding: '14px 16px',
                border: `2px solid ${active ? '#0972d3' : tone.border}`,
                borderRadius: '8px',
                background: tone.background,
                boxSizing: 'border-box',
                textAlign: 'left',
                cursor: locked && !active ? 'not-allowed' : 'pointer',
                font: 'inherit',
                color: '#000716',
                boxShadow: active ? '0 0 0 2px rgba(9, 114, 211, 0.2)' : 'none',
                opacity: locked && !active ? 0.75 : 1,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '18px',
                  right: '18px',
                  width: '14px',
                  height: '14px',
                  border: `4px solid ${tone.marker}`,
                  borderRadius: '999px',
                  background: '#ffffff',
                  boxSizing: 'border-box',
                }}
              />
              <SpaceBetween size="xxs">
                <div
                  style={{
                    fontSize: '30px',
                    lineHeight: '32px',
                    fontWeight: 700,
                    paddingRight: '24px',
                  }}
                >
                  {index + 1}
                </div>
                <Box variant="strong">{step.title}</Box>
                <StatusIndicator type={locked && !active ? 'pending' : step.type}>
                  {locked && !active ? 'Locked' : step.status}
                </StatusIndicator>
                <div style={{ overflowWrap: 'anywhere' }}>
                  <Box color="text-body-secondary">{step.detail}</Box>
                </div>
              </SpaceBetween>
            </button>
          );
        })}
      </div>
    </SpaceBetween>
  );

  const renderIdentityWizardStep = () => (
    <SpaceBetween size="l">
      <ColumnLayout columns={2}>
        <FormField label="First name" controlId="first-name">
          <Input
            value={runner.answers['first-name'] || ''}
            onChange={({ detail }) => setAnswer('first-name', detail.value)}
            spellcheck={false}
          />
        </FormField>
        <FormField label="Last name" controlId="last-name">
          <Input
            value={runner.answers['last-name'] || ''}
            onChange={({ detail }) => setAnswer('last-name', detail.value)}
            spellcheck={false}
          />
        </FormField>
      </ColumnLayout>
      <ColumnLayout columns={2}>
        <FormField label="Email address" controlId="contact-email-address">
          <Input
            value={runner.answers['contact-email-address'] || ''}
            onChange={({ detail }) => setAnswer('contact-email-address', detail.value)}
            spellcheck={false}
          />
        </FormField>
        <FormField label="Intake source">
          <Select
            selectedOption={INTAKE_SOURCE_OPTIONS.find((opt) => opt.value === intakeSource) || null}
            options={INTAKE_SOURCE_OPTIONS}
            onChange={({ detail }) => setIntakeSource(detail.selectedOption?.value || 'paper')}
          />
        </FormField>
      </ColumnLayout>
      <FormField label="Source note" stretch>
        <Textarea
          rows={2}
          value={intakeSourceNotes}
          onChange={({ detail }) => setIntakeSourceNotes(detail.value)}
          spellcheck={true}
          placeholder="Mail date, PDF sender, phone or walk-in context"
        />
      </FormField>
    </SpaceBetween>
  );

  const renderAccountSearchWizardStep = () => (
    <SpaceBetween size="m">
      {selectedApplicantMatch ? (
        <Alert type="success" header="Existing client selected">
          {selectedApplicantMatch.applicantName || 'Selected client'} will be used for this application.
        </Alert>
      ) : noExistingMatchConfirmed ? (
        <Alert type="info" header="No existing match selected">
          Continue with a new or later-reviewed account plan.
        </Alert>
      ) : null}

      <FormField label="Search PATH records" stretch>
        <SpaceBetween direction="horizontal" size="xs">
          <Input
            value={accountDecision.searchQuery}
            onChange={({ detail }) => {
              setAccountDecision(current => ({ ...current, searchQuery: detail.value }));
              setAccountSearchError('');
              setNoExistingMatchConfirmed(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runAccountSearch();
            }}
            placeholder="Email, name, case number, or region"
            spellcheck={false}
          />
          <Button
            iconName="search"
            onClick={() => runAccountSearch()}
            loading={accountSearchLoading}
          >
            Search
          </Button>
          <Button
            onClick={() => {
              const query = applicantIdentityPreview.searchText;
              setAccountDecision(current => ({ ...current, searchQuery: query }));
              setNoExistingMatchConfirmed(false);
              if (query) runAccountSearch(query);
            }}
            disabled={!applicantIdentityPreview.searchText || accountSearchLoading}
          >
            Use identity
          </Button>
        </SpaceBetween>
      </FormField>

      {accountSearchError ? (
        <Alert type={accountSearchResults.length ? 'info' : 'warning'}>
          {accountSearchError}
        </Alert>
      ) : null}

      {accountSearchResults.length || accountSearchLoading ? (
        <Table
          items={accountSearchResults}
          loading={accountSearchLoading}
          loadingText="Searching applicant accounts"
          selectionType="single"
          selectedItems={selectedApplicantMatch ? [selectedApplicantMatch] : []}
          onSelectionChange={({ detail }) => {
            const selected = detail.selectedItems?.[0] || null;
            setSelectedApplicantMatch(selected);
            setNoExistingMatchConfirmed(false);
            if (selected) {
              setAccountDecision(current => ({ ...current, strategy: 'link_selected_client' }));
              setAccountValidationError('');
              setWizardNavigationError('');
            }
          }}
          trackBy="clientId"
          columnDefinitions={[
            {
              id: 'applicant',
              header: 'Applicant',
              cell: item => (
                <SpaceBetween size="xxs">
                  {item.caseId ? (
                    <Link href={`/cases/${item.caseId}`}>{item.applicantName || 'Client'}</Link>
                  ) : (
                    <Box>{item.applicantName || 'Client'}</Box>
                  )}
                  <Box variant="small" color="text-body-secondary">{item.email || item.accountEmail || 'No email on account'}</Box>
                </SpaceBetween>
              ),
              minWidth: 180,
            },
            {
              id: 'account',
              header: 'PATH account',
              cell: item => accountStatusBadge(item.accountStatus, item.accountStatusLabel),
              minWidth: 130,
            },
            {
              id: 'case',
              header: 'Case',
              cell: item => item.caseNumber || 'No case',
              minWidth: 120,
            },
            {
              id: 'owner',
              header: 'Region / owner',
              cell: item => [item.regionCode, item.caseManagerName].filter(Boolean).join(' · ') || 'Unassigned',
              minWidth: 160,
            },
          ]}
          empty={
            <Box textAlign="center" color="text-body-secondary">
              No matching client or applicant account found.
            </Box>
          }
        />
      ) : null}

      {!selectedApplicantMatch ? (
        <Button
          onClick={() => {
            setNoExistingMatchConfirmed(true);
            setAccountValidationError('');
            setWizardNavigationError('');
          }}
        >
          Continue without match
        </Button>
      ) : (
        <Button
          variant="link"
          onClick={() => {
            setSelectedApplicantMatch(null);
            setAccountDecision(current => (
              current.strategy === 'link_selected_client'
                ? { ...current, strategy: 'review_later' }
                : current
            ));
          }}
        >
          Clear selected match
        </Button>
      )}
    </SpaceBetween>
  );

  const renderAccountHandlingWizardStep = () => {
    const selectedStrategy = ACCOUNT_STRATEGY_OPTIONS.find(option => option.value === accountDecision.strategy) || ACCOUNT_STRATEGY_OPTIONS[0];
    return (
      <SpaceBetween size="m">
        {accountValidationError ? (
          <Alert type="error" header="Review applicant account handling">
            {accountValidationError}
          </Alert>
        ) : null}

        <FormField label="Account handling plan" description={selectedStrategy.description}>
          <RadioGroup
            value={accountDecision.strategy}
            onChange={({ detail }) => {
              setAccountDecision(current => ({ ...current, strategy: detail.value }));
              setAccountValidationError('');
            }}
            items={ACCOUNT_STRATEGY_OPTIONS}
          />
        </FormField>

        {accountDecision.strategy === 'no_portal_planned' ? (
          <FormField label="Reason portal access is not planned" stretch>
            <Textarea
              rows={3}
              value={accountDecision.notes}
              onChange={({ detail }) => setAccountDecision(current => ({ ...current, notes: detail.value }))}
              placeholder="Reason for staff-assisted service"
              spellcheck={true}
            />
          </FormField>
        ) : null}
      </SpaceBetween>
    );
  };

  const renderApplicationDetailsWizardStep = () => (
    <SpaceBetween size="l">
      <SpaceBetween direction="horizontal" size="xs">
        <Box color="text-body-secondary">{`Form step ${currentVisibleStepNumber} of ${totalVisibleSteps}`}</Box>
        <Button onClick={() => setLang((prev) => (prev === 'en' ? 'fr' : 'en'))}>
          {lang === 'en' ? 'Francais' : 'English'}
        </Button>
      </SpaceBetween>

      {loading ? (
        <Box textAlign="center"><Spinner size="large" /> Loading published intake schema...</Box>
      ) : null}

      {schemaError ? (
        <Alert type="error" header="Unable to load intake schema">{schemaError}</Alert>
      ) : null}

      {!loading && !schemaError && currentStep ? (
        <>
          <Header variant="h3">{t(lang, currentStep.title, currentStep.name || currentStepId || 'Intake Step')}</Header>
          <StepRenderer
            step={currentStep}
            answers={runner.answers}
            errors={runner.errors}
            setAnswer={setAnswer}
            lang={lang}
            componentLookup={componentLookup}
            stepTitle={t(lang, currentStep.title, currentStep.name || currentStepId || 'Intake Step')}
          />
        </>
      ) : null}
    </SpaceBetween>
  );

  const renderReviewWizardStep = () => (
    <SpaceBetween size="m">
      {submitError ? (
        <Alert type="error" header="Unable to create application">{submitError}</Alert>
      ) : null}
      <ColumnLayout columns={3} variant="text-grid">
        <div>
          <Box variant="awsui-key-label">Applicant</Box>
          <Box variant="strong">{applicantIdentityPreview.fullName || 'Not entered'}</Box>
          <Box color="text-body-secondary">{applicantIdentityPreview.email || 'No email'}</Box>
        </div>
        <div>
          <Box variant="awsui-key-label">Existing client/account</Box>
          <Box variant="strong">{selectedApplicantMatch?.applicantName || (noExistingMatchConfirmed ? 'No match selected' : 'Not checked')}</Box>
          <Box margin={{ top: 'xxs' }}>
            {selectedApplicantMatch
              ? accountStatusBadge(selectedApplicantMatch.accountStatus, selectedApplicantMatch.accountStatusLabel)
              : <Badge color="grey">New or later review</Badge>}
          </Box>
        </div>
        <div>
          <Box variant="awsui-key-label">Account plan</Box>
          <Box variant="strong">{getAccountStrategyShortLabel(accountDecision.strategy)}</Box>
          <Box color="text-body-secondary">{INTAKE_SOURCE_OPTIONS.find(option => option.value === intakeSource)?.label || 'Intake source not set'}</Box>
        </div>
      </ColumnLayout>
    </SpaceBetween>
  );

  const renderManualIntakeWizardContent = () => (
    <SpaceBetween size="m">
      {wizardNavigationError ? (
        <Alert type="warning" onDismiss={() => setWizardNavigationError('')}>
          {wizardNavigationError}
        </Alert>
      ) : null}
      <Wizard
        className="manual-intake-wizard"
        activeStepIndex={activeWizardStepIndex}
        i18nStrings={wizardI18nStrings}
        onNavigate={handleWizardNavigate}
        onSubmit={handleSubmit}
        isLoadingNextStep={loading || accountSearchLoading || submitting}
        submitButtonText="Create application"
        secondaryActions={[]}
        steps={[
          {
            title: 'Identity & source',
            content: renderIdentityWizardStep(),
            errorText: !identityStepComplete && activeWizardStepIndex > 0 ? 'Identity is incomplete.' : undefined,
          },
          {
            title: 'Find existing account',
            content: renderAccountSearchWizardStep(),
            errorText: !accountSearchStepComplete && activeWizardStepIndex > 1 ? 'Account check is incomplete.' : undefined,
          },
          {
            title: 'Account handling',
            content: renderAccountHandlingWizardStep(),
            errorText: accountDecisionErrorText || undefined,
          },
          {
            title: 'Application details',
            content: renderApplicationDetailsWizardStep(),
            errorText: Object.keys(runner.errors).length > 0 ? 'Complete required fields before continuing.' : undefined,
          },
          {
            title: 'Review & submit',
            content: renderReviewWizardStep(),
          },
        ]}
      />
    </SpaceBetween>
  );

  const renderBoardItem = (item, actions) => {
    if (!item?.id) return null;
    if (item.id === FLOW_WIDGET_ID) {
      return (
        <BoardItem
          header={
            <Header
              variant="h2"
              info={
                <Link
                  variant="info"
                  onFollow={() =>
                    toggleHelpPanel &&
                    toggleHelpPanel(
                      <ManualApplicationIntakeHelp />,
                      'Staff-Assisted Intake Flow',
                      ManualApplicationIntakeHelp.aiContext || ''
                    )
                  }
                >
                  Info
                </Link>
              }
            >
              Staff-Assisted Intake Flow
            </Header>
          }
          settings={
            actions?.removeItem ? (
              <ButtonDropdown
                items={[{ id: 'remove', text: 'Remove widget' }]}
                ariaLabel="Staff-assisted intake flow widget settings"
                variant="icon"
                onItemClick={() => actions.removeItem()}
              />
            ) : null
          }
          i18nStrings={boardItemI18nStrings}
        >
          {renderProcessFlowContent()}
        </BoardItem>
      );
    }
    if (item.id !== INTAKE_WIDGET_ID) return null;
    return (
      <BoardItem
        header={
          <Header
            variant="h2"
            info={
              <Link
                variant="info"
                onFollow={() =>
                  toggleHelpPanel &&
                  toggleHelpPanel(
                    <ManualApplicationIntakeHelp />,
                    'Staff-Assisted Intake Wizard',
                    ManualApplicationIntakeHelp.aiContext || ''
                  )
                }
              >
                Info
              </Link>
            }
          >
            Staff-Assisted Intake Wizard
          </Header>
        }
        settings={
          actions?.removeItem ? (
            <ButtonDropdown
              items={[{ id: 'remove', text: 'Remove widget' }]}
              ariaLabel="Manual intake widget settings"
              variant="icon"
              onItemClick={() => actions.removeItem()}
            />
          ) : null
        }
        i18nStrings={boardItemI18nStrings}
      >
        {renderManualIntakeWizardContent()}
      </BoardItem>
    );
  };

  return (
    <SpaceBetween size="l">
      <Box color="text-body-secondary">
        Use this dashboard to enter application information received outside the portal (for example paper or PDF submissions).
      </Box>
      <Board
        i18nStrings={boardI18nStrings}
        items={boardItems}
        onItemsChange={handleItemsChange}
        renderItem={renderBoardItem}
        empty={<Box padding="m">No widgets on the Manual Intake dashboard.</Box>}
      />
    </SpaceBetween>
  );
};

export default ManualApplicationIntakePage;
