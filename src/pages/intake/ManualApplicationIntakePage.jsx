import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import Board from '@cloudscape-design/board-components/board';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  FormField,
  Header,
  Link,
  Select,
  SpaceBetween,
  Spinner,
  Textarea,
} from '@cloudscape-design/components';
import jsonLogic from 'json-logic-js';
import { apiFetch } from '../../auth/apiClient';
import PortalRegistry from '../../portalRendererRegistry';
import ManualApplicationIntakeHelp from '../../helpPanelContents/manualApplicationIntakeHelp';

const STORAGE_KEY = 'manual-application-intake-runtime.v2';
const DASHBOARD_STORAGE_KEY = 'manual-intake-dashboard-layout-v1';

const INTAKE_SOURCE_OPTIONS = [
  { label: 'Paper application', value: 'paper' },
  { label: 'PDF application', value: 'pdf' },
  { label: 'Phone intake', value: 'phone' },
  { label: 'In-person intake', value: 'in_person' },
  { label: 'Other', value: 'other' },
];

const nonInputTypes = new Set(['paragraph', 'text-block', 'summary-list', 'panel', 'inset-text']);
const INTAKE_WIDGET_ID = 'manual-intake-flow';

const widgetRegistry = {
  [INTAKE_WIDGET_ID]: {
    id: INTAKE_WIDGET_ID,
    defaultRowSpan: 12,
    defaultColumnSpan: 4,
    title: 'Manual Application Intake',
    description: 'Enter and submit applications received outside the public portal.',
  },
};

const defaultLayout = [
  { id: INTAKE_WIDGET_ID, rowSpan: 12, columnSpan: 4 },
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

function computeVisibility(component, answers, steps) {
  const conditions = component?.conditions?.all;
  if (!Array.isArray(conditions) || conditions.length === 0) return true;

  const resolveRefValue = (ref) => {
    if (Object.prototype.hasOwnProperty.call(answers, ref)) return answers[ref];
    for (const step of steps) {
      const comps = Array.isArray(step?.components) ? step.components : [];
      for (const comp of comps) {
        const matches = String(comp.id) === String(ref) || comp?.props?.name === ref || comp?.storageKey === ref;
        if (!matches) continue;
        const key = comp.storageKey || comp.id;
        if (key && Object.prototype.hasOwnProperty.call(answers, key)) return answers[key];
      }
    }
    return undefined;
  };

  const exists = (v) => {
    if (v === null || typeof v === 'undefined') return false;
    if (typeof v === 'string') return v.trim() !== '';
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  };

  for (const cond of conditions) {
    if (!cond || !cond.ref || !cond.op) return false;
    const raw = resolveRefValue(cond.ref);
    const ln = coerceNumber(raw);
    const rn = coerceNumber(cond.value);
    switch (cond.op) {
      case 'exists': if (!exists(raw)) return false; break;
      case 'notExists': if (exists(raw)) return false; break;
      case 'equals':
        if (ln !== null && rn !== null) { if (ln !== rn) return false; }
        else if (String(raw ?? '') !== String(cond.value ?? '')) return false;
        break;
      case 'notEquals':
        if (ln !== null && rn !== null) { if (ln === rn) return false; }
        else if (String(raw ?? '') === String(cond.value ?? '')) return false;
        break;
      case '>': if (ln === null || rn === null || !(ln > rn)) return false; break;
      case '<': if (ln === null || rn === null || !(ln < rn)) return false; break;
      default: return false;
    }
  }
  return true;
}

function StepRenderer({ step, answers, errors, setAnswer, lang, steps, stepTitle }) {
  const renderComponent = (component, componentIndex) => {
    const key = componentKey(component, componentIndex);
    const type = String(component.type || '').toLowerCase();
    const visible = computeVisibility(component, answers, steps);
    if (!visible) return null;
    if (type === 'signature-ack' || type === 'file-upload') return null;
    if ((type === 'paragraph' || type === 'text-block') && componentIndex === 0) {
      const headingText = t(lang, component?.text, '');
      if (normalizeTextValue(headingText) && normalizeTextValue(headingText) === normalizeTextValue(stepTitle)) {
        return null;
      }
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
        render={(child) => {
          const childKey = child.storageKey || child.id;
          const ChildComp = PortalRegistry[String(child.type || '').toLowerCase()];
          if (!ChildComp || !childKey) return null;
          return (
            <ChildComp
              comp={child}
              lang={lang}
              value={answers[childKey]}
              values={answers}
              error={errors[childKey]}
              onChange={(next) => setAnswer(childKey, next)}
            />
          );
        }}
      />
    );
  };

  const components = Array.isArray(step?.components) ? step.components : [];
  return <>{components.map(renderComponent)}</>;
}

function collectActiveComponents(step, answers, steps) {
  const active = [];
  const components = Array.isArray(step?.components) ? step.components : [];

  const visit = (component) => {
    if (!component) return;
    if (!computeVisibility(component, answers, steps)) return;
    active.push(component);
    const type = String(component.type || '').toLowerCase();
    if (type !== 'radio' && type !== 'checkbox' && type !== 'checkboxes') return;

    const key = component.storageKey || component.id;
    const selected = answers[key];
    const selectedSet = new Set(Array.isArray(selected) ? selected.map(String) : [String(selected)]);
    const options = Array.isArray(component.options) ? component.options : [];
    options.forEach((option) => {
      if (!selectedSet.has(String(option.value))) return;
      const children = Array.isArray(option.children)
        ? option.children
        : (Array.isArray(option?.conditional?.children) ? option.conditional.children : []);
      children.forEach((child) => visit(child));
    });
  };

  components.forEach((component) => visit(component));
  return active;
}

function stepHasActionableInputs(step, answers, steps) {
  const activeComponents = collectActiveComponents(step, answers, steps);
  return activeComponents.some((component) => {
    const type = String(component?.type || '').toLowerCase();
    return !nonInputTypes.has(type) && type !== 'signature-ack' && type !== 'file-upload';
  });
}

function validateStep(step, answers, steps, lang) {
  const errors = {};
  const activeComponents = collectActiveComponents(step, answers, steps);

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
      const result = evaluateRule(rule, value, answers);
      if (!result.failed) continue;
      errors[key] = result.message || 'Invalid value';
      if (rule.block !== false) break;
    }
  });

  return errors;
}

function findNextStepIndex(currentStep, answers, steps) {
  if (!currentStep) return -1;
  let nextStepId = null;
  if (Array.isArray(currentStep.branching)) {
    for (const branch of currentStep.branching) {
      try {
        if (branch?.condition && jsonLogic.apply(branch.condition, answers)) {
          nextStepId = branch.nextStepId;
          break;
        }
      } catch (_) {
        // ignore malformed branch expressions
      }
    }
  }
  if (!nextStepId && currentStep.defaultNextStepId) nextStepId = currentStep.defaultNextStepId;
  if (!nextStepId && currentStep.nextStepId) nextStepId = currentStep.nextStepId;
  if (!nextStepId) return -1;
  const target = String(nextStepId);
  return steps.findIndex((step, index) => {
    const normalizedStepId = getStepId(step, index);
    return String(normalizedStepId) === target
      || String(step?.stepId ?? '') === target
      || String(step?.id ?? '') === target;
  });
}

function findNextActionableStepIndex(currentIndex, answers, steps) {
  const visited = new Set();
  let cursor = currentIndex;
  while (Number.isInteger(cursor) && cursor >= 0 && cursor < steps.length) {
    if (visited.has(cursor)) break;
    visited.add(cursor);
    const step = steps[cursor];
    if (stepHasActionableInputs(step, answers, steps)) return cursor;
    const next = findNextStepIndex(step, answers, steps);
    if (next < 0) return cursor;
    cursor = next;
  }
  return Number.isInteger(currentIndex) ? currentIndex : 0;
}

function findStepIndexByField(fieldKey, steps) {
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    const components = Array.isArray(step?.components) ? step.components : [];
    for (const component of components) {
      if (!component) continue;
      if (component.storageKey === fieldKey || component.id === fieldKey) return stepIndex;
      const options = Array.isArray(component.options) ? component.options : [];
      for (const option of options) {
        const children = Array.isArray(option.children)
          ? option.children
          : (Array.isArray(option?.conditional?.children) ? option.conditional.children : []);
        for (const child of children) {
          if (child?.storageKey === fieldKey || child?.id === fieldKey) return stepIndex;
        }
      }
    }
  }
  return -1;
}

function buildDraftPayload({
  schemaVersion,
  workflowId,
  stepIndex,
  answers,
  history,
  intakeSource,
  intakeSourceNotes,
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
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentStep = steps[runner.stepIndex] || null;
  const currentStepId = currentStep ? getStepId(currentStep, runner.stepIndex) : null;
  const nextStepIndex = useMemo(() => findNextStepIndex(currentStep, runner.answers, steps), [currentStep, runner.answers, steps]);
  const isFinalStep = Boolean(currentStep) && nextStepIndex < 0;

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

        setSchemaVersion(nextVersion);
        setWorkflowId(nextWorkflowId);
        setSteps(nextSteps);

        if (draft && draft.schemaVersion === nextVersion) {
          const restoredIndex = Number.isInteger(draft.stepIndex) ? Math.min(Math.max(draft.stepIndex, 0), nextSteps.length - 1) : 0;
          const actionableIndex = findNextActionableStepIndex(
            restoredIndex,
            draft.answers && typeof draft.answers === 'object' ? draft.answers : {},
            nextSteps
          );
          setRunner({
            stepIndex: actionableIndex,
            answers: draft.answers && typeof draft.answers === 'object' ? draft.answers : {},
            errors: {},
            history: Array.isArray(draft.history) ? draft.history : [],
          });
          setIntakeSource(draft.intakeSource || 'paper');
          setIntakeSourceNotes(draft.intakeSourceNotes || '');
          setLang(draft.lang === 'fr' ? 'fr' : 'en');
        } else {
          const firstActionable = findNextActionableStepIndex(0, {}, nextSteps);
          setRunner({ stepIndex: firstActionable, answers: {}, errors: {}, history: [] });
          setIntakeSource('paper');
          setIntakeSourceNotes('');
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
    lang,
  ]);

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
      const previous = nextHistory.pop();
      return {
        ...prev,
        stepIndex: previous,
        history: nextHistory,
        errors: {},
      };
    });
  };

  const goNext = () => {
    if (!currentStep) return;
    const errors = validateStep(currentStep, runner.answers, steps, lang);
    if (Object.keys(errors).length > 0) {
      setRunner((prev) => ({ ...prev, errors }));
      return;
    }
    if (nextStepIndex < 0) return;
    const actionableIndex = findNextActionableStepIndex(nextStepIndex, runner.answers, steps);
    setRunner((prev) => ({
      ...prev,
      stepIndex: actionableIndex,
      history: [...prev.history, prev.stepIndex],
      errors: {},
    }));
  };

  const handleSubmit = async () => {
    if (!currentStep) return;
    const errors = validateStep(currentStep, runner.answers, steps, lang);
    if (Object.keys(errors).length > 0) {
      setRunner((prev) => ({ ...prev, errors }));
      return;
    }

    setSubmitError('');
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

  const renderManualIntakeContent = () => (
    <SpaceBetween size="l">
      {!started ? (
        <>
          <FormField label="Intake source">
            <Select
              selectedOption={INTAKE_SOURCE_OPTIONS.find((opt) => opt.value === intakeSource) || null}
              options={INTAKE_SOURCE_OPTIONS}
              onChange={({ detail }) => setIntakeSource(detail.selectedOption?.value || 'paper')}
            />
          </FormField>

          <FormField label="Source details (optional)">
            <Textarea
              rows={3}
              value={intakeSourceNotes}
              onChange={({ detail }) => setIntakeSourceNotes(detail.value)}
            />
          </FormField>

          <Button variant="primary" onClick={() => setStarted(true)}>Create Application</Button>
        </>
      ) : null}

      {started ? (
        <SpaceBetween size="l">
          <SpaceBetween direction="horizontal" size="xs">
            <Box color="text-body-secondary">{`Step ${runner.stepIndex + 1} of ${steps.length}`}</Box>
            <Button onClick={() => setLang((prev) => (prev === 'en' ? 'fr' : 'en'))}>
              {lang === 'en' ? 'Francais' : 'English'}
            </Button>
          </SpaceBetween>

          {loading ? (
            <Box textAlign="center"><Spinner size="large" /> Loading published intake schema…</Box>
          ) : null}

          {schemaError ? (
            <Alert type="error" header="Unable to load intake schema">{schemaError}</Alert>
          ) : null}

          {!loading && !schemaError && currentStep ? (
            <>
              {submitError ? (
                <Alert type="error" header="Unable to create application">{submitError}</Alert>
              ) : null}

              <Header variant="h3">{t(lang, currentStep.title, currentStep.name || currentStepId || 'Intake Step')}</Header>

              <StepRenderer
                step={currentStep}
                answers={runner.answers}
                errors={runner.errors}
                setAnswer={setAnswer}
                lang={lang}
                steps={steps}
                stepTitle={t(lang, currentStep.title, currentStep.name || currentStepId || 'Intake Step')}
              />

              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={goBack} disabled={runner.history.length === 0 || submitting}>Back</Button>
                {!isFinalStep ? (
                  <Button variant="primary" onClick={goNext} disabled={submitting}>Next</Button>
                ) : (
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={submitting}
                  >
                    Create Application
                  </Button>
                )}
                <Button
                  disabled={submitting}
                  onClick={() => {
                    setRunner({ stepIndex: 0, answers: {}, errors: {}, history: [] });
                    setIntakeSource('paper');
                    setIntakeSourceNotes('');
                    setSubmitError('');
                    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
                  }}
                >
                  Reset
                </Button>
              </SpaceBetween>
            </>
          ) : null}
        </SpaceBetween>
      ) : null}
    </SpaceBetween>
  );

  const renderBoardItem = (item, actions) => {
    if (!item?.id || item.id !== INTAKE_WIDGET_ID) return null;
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
                    'Manual Intake Form',
                    ManualApplicationIntakeHelp.aiContext || ''
                  )
                }
              >
                Info
              </Link>
            }
          >
            Intake Form
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
        {renderManualIntakeContent()}
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
