const CONDITIONAL_VISIBILITY_TARGET_TYPES = new Set([
  'file-upload',
  'radio',
  'radios',
  'checkbox',
  'checkboxes',
  'input',
  'textarea',
  'character-count',
  'warning-text',
  'inset-text',
  'paragraph',
]);

const CONDITIONAL_VISIBILITY_REFERENCEABLE_TYPES = new Set([
  'input',
  'text',
  'email',
  'phone',
  'password',
  'password-input',
  'number',
  'textarea',
  'select',
  'radio',
  'radios',
  'checkbox',
  'checkboxes',
  'date',
  'date-input',
  'character-count',
  'file-upload',
  'signature-ack',
]);

const CONDITIONAL_VISIBILITY_OPERATOR_OPTIONS = [
  { value: 'equals', label: 'equals', requiresValue: true },
  { value: 'notEquals', label: 'notEquals', requiresValue: true },
  { value: 'exists', label: 'exists', requiresValue: false },
  { value: 'notExists', label: 'notExists', requiresValue: false },
  { value: 'emptyOrZero', label: 'emptyOrZero', requiresValue: false },
  { value: 'contains', label: 'contains', requiresValue: true },
  { value: 'notContains', label: 'notContains', requiresValue: true },
  { value: 'containsAny', label: 'containsAny', requiresValue: true },
  { value: 'notContainsAny', label: 'notContainsAny', requiresValue: true },
  { value: 'containsAll', label: 'containsAll', requiresValue: true },
  { value: '>', label: '>', requiresValue: true },
  { value: '<', label: '<', requiresValue: true },
];

const CONDITIONAL_VISIBILITY_OPERATORS = new Map(
  CONDITIONAL_VISIBILITY_OPERATOR_OPTIONS.map((item) => [item.value, item])
);

export function normalizeConditionalComponentType(type) {
  return String(type || '').trim().toLowerCase();
}

export function componentSupportsConditionalVisibility(componentOrType) {
  const type = normalizeConditionalComponentType(
    typeof componentOrType === 'string'
      ? componentOrType
      : (componentOrType?.type || componentOrType?.template_key)
  );
  return CONDITIONAL_VISIBILITY_TARGET_TYPES.has(type);
}

export function componentCanBeConditionReference(componentOrType) {
  const type = normalizeConditionalComponentType(
    typeof componentOrType === 'string'
      ? componentOrType
      : (componentOrType?.type || componentOrType?.template_key)
  );
  return CONDITIONAL_VISIBILITY_REFERENCEABLE_TYPES.has(type);
}

export function conditionOperatorSupported(op) {
  return CONDITIONAL_VISIBILITY_OPERATORS.has(String(op || '').trim());
}

export function conditionOperatorRequiresValue(op) {
  return CONDITIONAL_VISIBILITY_OPERATORS.get(String(op || '').trim())?.requiresValue !== false;
}

export function getByPath(obj, path) {
  if (obj == null || !path || typeof path !== 'string') return undefined;
  const tokens = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current = obj;
  for (const token of tokens) {
    if (current == null) return undefined;
    current = current[token];
  }
  return current;
}

export function optionRevealChildren(option) {
  if (Array.isArray(option?.children)) return option.children;
  if (option?.conditional && Array.isArray(option.conditional.children)) return option.conditional.children;
  return [];
}

export function visitComponentTree(components, visitor) {
  if (!Array.isArray(components) || typeof visitor !== 'function') return;
  const visit = (component, parent = null) => {
    if (!component || typeof component !== 'object') return;
    visitor(component, parent);
    if (Array.isArray(component.children)) {
      component.children.forEach((child) => visit(child, component));
    }
    if (Array.isArray(component.options)) {
      component.options.forEach((option) => {
        optionRevealChildren(option).forEach((child) => visit(child, component));
      });
    }
  };
  components.forEach((component) => visit(component));
}

export function getConditionLookupKeys(component) {
  return [
    component?.storageKey,
    component?.id,
    component?.name,
    component?.props?.name,
    component?.props?.id,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value));
}

export function buildConditionComponentLookup(steps = []) {
  const lookup = new Map();
  (Array.isArray(steps) ? steps : []).forEach((step) => {
    visitComponentTree(step?.components || [], (component) => {
      getConditionLookupKeys(component).forEach((key) => {
        if (!lookup.has(key)) lookup.set(key, component);
      });
    });
  });
  return lookup;
}

function coerceNumeric(a, b) {
  const left = typeof a === 'string' && a.trim() !== '' ? Number(a) : a;
  const right = typeof b === 'string' && b.trim() !== '' ? Number(b) : b;
  if (Number.isFinite(left) && Number.isFinite(right)) return [left, right];
  return [a, b];
}

export function looselyEqual(a, b) {
  if ((a === null && b === undefined) || (a === undefined && b === null)) return true;
  const [left, right] = coerceNumeric(a, b);
  if (Number.isFinite(left) && Number.isFinite(right)) return left === right;
  return String(left ?? '') === String(right ?? '');
}

export function toConditionTokenList(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      try {
        return toConditionTokenList(JSON.parse(trimmed));
      } catch (_) {
        // Fall through to comma-separated parsing for author-entered strings.
      }
    }
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function hasToken(current, value) {
  const currentTokens = new Set(toConditionTokenList(current));
  const needles = toConditionTokenList(value);
  if (!needles.length) return false;
  return currentTokens.has(needles[0]);
}

function hasAnyToken(current, value) {
  const currentTokens = new Set(toConditionTokenList(current));
  const needles = toConditionTokenList(value);
  if (!needles.length) return false;
  return needles.some((needle) => currentTokens.has(needle));
}

function hasAllTokens(current, value) {
  const currentTokens = new Set(toConditionTokenList(current));
  const needles = toConditionTokenList(value);
  if (!needles.length) return false;
  return needles.every((needle) => currentTokens.has(needle));
}

function matchesEmptyOrZero(current) {
  if (current === undefined || current === null) return true;
  if (typeof current === 'string') {
    const trimmed = current.trim();
    if (!trimmed) return true;
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) && numberValue === 0;
  }
  if (typeof current === 'number') return Number.isFinite(current) && current === 0;
  if (Array.isArray(current)) return current.length === 0;
  return current === false;
}

export function resolveConditionRefValue(ref, answers = {}, componentLookup = null) {
  if (ref == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(answers, ref)) return answers[ref];
  const byPath = getByPath(answers, ref);
  if (byPath !== undefined) return byPath;
  const component = componentLookup?.get?.(String(ref));
  if (!component) return undefined;
  for (const key of getConditionLookupKeys(component)) {
    if (Object.prototype.hasOwnProperty.call(answers, key)) return answers[key];
    const nested = getByPath(answers, key);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

export function evaluateConditionalVisibilityRules(conditions, answers = {}, componentLookup = null) {
  if (!conditions || !conditions.all) return true;
  const rules = Array.isArray(conditions.all) ? conditions.all : [];
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') return true;
    const { ref, op, value } = rule;
    const current = resolveConditionRefValue(ref, answers, componentLookup);
    switch (op) {
      case 'exists':
        if (current === undefined || current === null || (typeof current === 'string' && current.trim() === '')) return false;
        break;
      case 'notExists':
        if (!(current === undefined || current === null || (typeof current === 'string' && current.trim() === ''))) return false;
        break;
      case 'emptyOrZero':
        if (!matchesEmptyOrZero(current)) return false;
        break;
      case 'equals':
        if (!looselyEqual(current, value)) return false;
        break;
      case 'notEquals':
        if (looselyEqual(current, value)) return false;
        break;
      case 'contains':
        if (!hasToken(current, value)) return false;
        break;
      case 'notContains':
        if (hasToken(current, value)) return false;
        break;
      case 'containsAny':
        if (!hasAnyToken(current, value)) return false;
        break;
      case 'notContainsAny':
        if (hasAnyToken(current, value)) return false;
        break;
      case 'containsAll':
        if (!hasAllTokens(current, value)) return false;
        break;
      case '>': {
        const [left, right] = coerceNumeric(current, value);
        if (!(Number.isFinite(left) && Number.isFinite(right)) || !(left > right)) return false;
        break;
      }
      case '<': {
        const [left, right] = coerceNumeric(current, value);
        if (!(Number.isFinite(left) && Number.isFinite(right)) || !(left < right)) return false;
        break;
      }
      default:
        break;
    }
  }
  return true;
}

export function componentConditionsSatisfied(component, answers = {}, componentLookup = null) {
  if (!componentSupportsConditionalVisibility(component)) return true;
  return evaluateConditionalVisibilityRules(component?.conditions || component?.props?.conditions, answers, componentLookup);
}

export {
  CONDITIONAL_VISIBILITY_OPERATORS,
  CONDITIONAL_VISIBILITY_OPERATOR_OPTIONS,
  CONDITIONAL_VISIBILITY_REFERENCEABLE_TYPES,
  CONDITIONAL_VISIBILITY_TARGET_TYPES,
};
