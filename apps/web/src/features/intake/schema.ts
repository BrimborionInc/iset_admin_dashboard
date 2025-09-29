
import type { IntakeSchemaResponse } from '../../shared/api/intake';

export type SchemaText = string | { [locale: string]: string | null | undefined } | null | undefined;
export type LanguageCode = 'en' | 'fr';

export interface ConditionDefinition {
  readonly ref?: string;
  readonly op?: string;
  readonly value?: unknown;
}

export interface ConditionGroup {
  readonly all?: ConditionDefinition[];
  readonly any?: ConditionDefinition[];
}

export interface IntakeComponentOption extends Record<string, unknown> {
  label?: SchemaText | string;
  hint?: SchemaText | string;
  value?: string;
  children?: IntakeComponent[];
  conditions?: ConditionGroup;
}

export interface IntakeComponent extends Record<string, unknown> {
  type: string;
  components?: IntakeComponent[];
  options?: IntakeComponentOption[];
  conditions?: ConditionGroup;
}

export interface IntakeStep extends Record<string, unknown> {
  stepId: string;
  title?: SchemaText | string;
  description?: SchemaText | string;
  components: IntakeComponent[];
}

export interface IntakeSchema {
  version: string;
  title: string;
  steps: IntakeStep[];
}

export const SUPPORTED_LANGUAGES: readonly LanguageCode[] = ['en', 'fr'];

export function parseIntakeSchema(raw: IntakeSchemaResponse): IntakeSchema {
  if (!isRecord(raw)) {
    return { version: 'unknown', title: '', steps: [] };
  }

  const version = typeof raw.version === 'string' ? raw.version : 'unknown';
  const title = typeof raw.title === 'string' ? raw.title : '';
  const steps = Array.isArray(raw.steps)
    ? raw.steps.map(parseStep).filter((step): step is IntakeStep => Boolean(step))
    : [];

  return { version, title, steps };
}

export function resolveText(value: SchemaText | string | undefined, language: LanguageCode): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  const mapping = value ?? {};
  const fallbackOrder = [language, ...SUPPORTED_LANGUAGES.filter((locale) => locale !== language)];
  for (const locale of fallbackOrder) {
    const candidate = mapping[locale];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  for (const candidate of Object.values(mapping)) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return '';
}

function parseStep(raw: unknown): IntakeStep | null {
  if (!isRecord(raw)) {
    return null;
  }

  const stepId = typeof raw.stepId === 'string' ? raw.stepId : undefined;
  if (!stepId) {
    return null;
  }

  const components = Array.isArray(raw.components)
    ? raw.components.map(parseComponent).filter((component): component is IntakeComponent => Boolean(component))
    : [];

  const step: IntakeStep = {
    ...(raw as Record<string, unknown>),
    stepId,
    components
  };

  return step;
}

function parseComponent(raw: unknown): IntakeComponent | null {
  if (!isRecord(raw)) {
    return null;
  }

  const type = typeof raw.type === 'string' ? raw.type : undefined;
  if (!type) {
    return null;
  }

  const component: IntakeComponent = {
    ...(raw as Record<string, unknown>),
    type
  };

  const children = Array.isArray(raw.components)
    ? raw.components.map(parseComponent).filter((child): child is IntakeComponent => Boolean(child))
    : undefined;
  if (children && children.length > 0) {
    component.components = children;
  } else {
    delete component.components;
  }

  const options = Array.isArray(raw.options)
    ? raw.options.map(parseOption).filter((option): option is IntakeComponentOption => Boolean(option))
    : undefined;
  if (options && options.length > 0) {
    component.options = options;
  } else {
    delete component.options;
  }

  const conditions = parseConditionGroup(raw.conditions);
  if (conditions) {
    component.conditions = conditions;
  } else {
    delete component.conditions;
  }

  return component;
}

function parseOption(raw: unknown): IntakeComponentOption | null {
  if (!isRecord(raw)) {
    return null;
  }

  const option: IntakeComponentOption = {
    ...(raw as Record<string, unknown>)
  };

  const children = Array.isArray(raw.children)
    ? raw.children.map(parseComponent).filter((child): child is IntakeComponent => Boolean(child))
    : undefined;
  if (children && children.length > 0) {
    option.children = children;
  } else {
    delete option.children;
  }

  const conditions = parseConditionGroup(raw.conditions);
  if (conditions) {
    option.conditions = conditions;
  } else {
    delete option.conditions;
  }

  return option;
}

function parseConditionGroup(raw: unknown): ConditionGroup | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const all = Array.isArray(raw.all)
    ? raw.all.map(parseCondition).filter((condition): condition is ConditionDefinition => Boolean(condition))
    : undefined;
  const any = Array.isArray(raw.any)
    ? raw.any.map(parseCondition).filter((condition): condition is ConditionDefinition => Boolean(condition))
    : undefined;

  if ((all?.length ?? 0) === 0 && (any?.length ?? 0) === 0) {
    return undefined;
  }

  const group: ConditionGroup = {};
  if (all && all.length > 0) {
    group.all = all;
  }
  if (any && any.length > 0) {
    group.any = any;
  }
  return group;
}

function parseCondition(raw: unknown): ConditionDefinition | null {
  if (!isRecord(raw)) {
    return null;
  }

  const condition: ConditionDefinition = {};
  if (typeof raw.ref === 'string') {
    condition.ref = raw.ref;
  }
  if (typeof raw.op === 'string') {
    condition.op = raw.op;
  }
  if ('value' in raw) {
    condition.value = (raw as Record<string, unknown>).value;
  }

  if (!condition.ref && !condition.op && condition.value === undefined) {
    return null;
  }

  return condition;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
