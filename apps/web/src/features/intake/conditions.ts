import type { ConditionDefinition, ConditionGroup, IntakeComponent, IntakeComponentOption } from "./schema";
import type { FormValues } from "./components/types";

function getValue(values: FormValues, reference: string): unknown {
  if (!reference || typeof reference !== "string") {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(values, reference)) {
    return values[reference];
  }

  const segments = reference.split(".");
  let cursor: any = values;
  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in cursor) {
      cursor = cursor[segment as keyof typeof cursor];
    } else {
      return undefined;
    }
  }

  return cursor;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function evaluateCondition(condition: ConditionDefinition, values: FormValues): boolean {
  const reference = typeof condition.ref === "string" ? condition.ref : undefined;
  const operator = typeof condition.op === "string" ? condition.op : undefined;

  if (!reference && !operator) {
    return true;
  }

  const candidate = reference ? getValue(values, reference) : undefined;
  const expected = condition.value;

  switch (operator) {
    case "equals":
      return candidate === expected;
    case "notEquals":
      return candidate !== expected;
    case "exists":
      return !isEmpty(candidate);
    case "notExists":
      return isEmpty(candidate);
    case ">": {
      const left = toNumber(candidate);
      const right = toNumber(expected);
      if (left === null || right === null) {
        return false;
      }
      return left > right;
    }
    case "<": {
      const left = toNumber(candidate);
      const right = toNumber(expected);
      if (left === null || right === null) {
        return false;
      }
      return left < right;
    }
    default:
      return true;
  }
}

export function evaluateConditionGroup(group: ConditionGroup | undefined, values: FormValues): boolean {
  if (!group) {
    return true;
  }

  if (group.all && group.all.length > 0) {
    if (!group.all.every((condition) => evaluateCondition(condition, values))) {
      return false;
    }
  }

  if (group.any && group.any.length > 0) {
    if (!group.any.some((condition) => evaluateCondition(condition, values))) {
      return false;
    }
  }

  return true;
}

export function isComponentVisible(component: IntakeComponent, values: FormValues): boolean {
  return evaluateConditionGroup(component.conditions, values);
}

export function isOptionVisible(option: IntakeComponentOption, values: FormValues): boolean {
  return evaluateConditionGroup(option.conditions, values);
}

