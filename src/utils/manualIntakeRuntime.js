import jsonLogic from 'json-logic-js';
import PortalRegistry from '../portalRendererRegistry';
import {
  componentConditionsSatisfied,
  componentSupportsConditionalVisibility,
  getConditionLookupKeys,
  optionRevealChildren,
  visitComponentTree,
} from './intakeConditionalVisibility';

const MANUAL_NON_RENDERABLE_TYPES = new Set(['signature-ack', 'file-upload']);
const MANUAL_SPECIAL_RENDERABLE_TYPES = new Set(['warning-text']);

export function componentIsVisibleInManual(component, answers = {}, componentLookup = null) {
  if (!component || typeof component !== 'object') return false;
  if (!componentSupportsConditionalVisibility(component)) return true;
  return componentConditionsSatisfied(component, answers, componentLookup);
}

export function componentWouldRenderInManual(component, answers = {}, componentLookup = null) {
  if (!component || typeof component !== 'object') return false;
  if (!componentIsVisibleInManual(component, answers, componentLookup)) return false;

  const type = String(component.type || component.template_key || '').toLowerCase();
  if (MANUAL_NON_RENDERABLE_TYPES.has(type)) return false;
  if (PortalRegistry[type] || MANUAL_SPECIAL_RENDERABLE_TYPES.has(type)) return true;

  if (Array.isArray(component.children) && component.children.some((child) => componentWouldRenderInManual(child, answers, componentLookup))) {
    return true;
  }
  if (Array.isArray(component.options)) {
    return component.options.some((option) =>
      optionRevealChildren(option).some((child) => componentWouldRenderInManual(child, answers, componentLookup))
    );
  }
  return false;
}

export function collectActiveManualComponents(step, answers = {}, componentLookup = null) {
  const active = [];
  const visit = (component) => {
    if (!component || !componentIsVisibleInManual(component, answers, componentLookup)) return;
    active.push(component);
    if (Array.isArray(component.children)) component.children.forEach((child) => visit(child));

    const type = String(component.type || component.template_key || '').toLowerCase();
    if (!['radio', 'checkbox', 'checkboxes'].includes(type)) return;

    const key = component.storageKey || component.id;
    const selected = key ? answers[key] : undefined;
    const selectedValues = Array.isArray(selected)
      ? selected.map(String)
      : (selected === undefined || selected === null || selected === '' ? [] : [String(selected)]);
    const selectedSet = new Set(selectedValues);
    const options = Array.isArray(component.options) ? component.options : [];
    options.forEach((option) => {
      if (!selectedSet.has(String(option.value))) return;
      optionRevealChildren(option).forEach((child) => visit(child));
    });
  };

  (Array.isArray(step?.components) ? step.components : []).forEach((component) => visit(component));
  return active;
}

export function stepHasRenderableManualContent(step, answers = {}, componentLookup = null) {
  return Array.isArray(step?.components)
    ? step.components.some((component) => componentWouldRenderInManual(component, answers, componentLookup))
    : false;
}

export function resolveNextManualStepIndex(currentStep, answers = {}, steps = []) {
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
        // Ignore malformed branch expressions.
      }
    }
  }

  if (!nextStepId && currentStep.defaultNextStepId) nextStepId = currentStep.defaultNextStepId;
  if (!nextStepId && currentStep.nextStepId) nextStepId = currentStep.nextStepId;
  if (!nextStepId) return -1;

  const target = String(nextStepId);
  return steps.findIndex((step, index) => {
    const normalizedStepId = step?.stepId || step?.id || `step-${index + 1}`;
    return String(normalizedStepId) === target
      || String(step?.stepId ?? '') === target
      || String(step?.id ?? '') === target;
  });
}

export function findNextRenderableManualStepIndex(fromIndex, answers = {}, steps = [], componentLookup = null) {
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= steps.length) return -1;

  const visited = new Set([fromIndex]);
  let candidateIndex = resolveNextManualStepIndex(steps[fromIndex], answers, steps);
  while (candidateIndex !== -1 && !visited.has(candidateIndex)) {
    if (stepHasRenderableManualContent(steps[candidateIndex], answers, componentLookup)) return candidateIndex;
    visited.add(candidateIndex);
    candidateIndex = resolveNextManualStepIndex(steps[candidateIndex], answers, steps);
  }
  return -1;
}

export function findFirstRenderableManualStepIndex(steps = [], answers = {}, componentLookup = null) {
  const first = steps.findIndex((step) => stepHasRenderableManualContent(step, answers, componentLookup));
  return first === -1 ? 0 : first;
}

export function findStepIndexByField(fieldKey, steps = []) {
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    let found = false;
    visitComponentTree(steps[stepIndex]?.components || [], (component) => {
      if (found) return;
      if (getConditionLookupKeys(component).includes(String(fieldKey))) found = true;
    });
    if (found) return stepIndex;
  }
  return -1;
}

export function buildManualValidationData(step, answers = {}) {
  const data = { ...answers };
  visitComponentTree(step?.components || [], (component) => {
    const aliases = getConditionLookupKeys(component);
    const populatedKey = aliases.find((alias) => Object.prototype.hasOwnProperty.call(answers, alias));
    if (!populatedKey) return;
    const value = answers[populatedKey];
    aliases.forEach((alias) => {
      if (!Object.prototype.hasOwnProperty.call(data, alias)) data[alias] = value;
    });
  });
  return data;
}

export function collectHiddenConditionalManualKeys(steps = [], answers = {}, componentLookup = null) {
  const hidden = new Set();
  steps.forEach((step) => {
    visitComponentTree(step?.components || [], (component) => {
      if (!componentSupportsConditionalVisibility(component)) return;
      if (componentConditionsSatisfied(component, answers, componentLookup)) return;
      const key = component?.storageKey || component?.id;
      if (key) hidden.add(key);
    });
  });
  return hidden;
}
