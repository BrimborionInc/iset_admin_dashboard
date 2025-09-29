import { Fragment } from "react";
import { resolveText, type IntakeComponent, type IntakeComponentOption, type LanguageCode } from "../schema";
import type { FieldErrors, FormValues, RendererComponentProps } from "./types";
import { isComponentVisible, isOptionVisible } from "../conditions";

type SummaryRow = Record<string, unknown>;

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getComponentKey(component: IntakeComponent): string {
  if (typeof component.id === "string" && component.id.length > 0) {
    return component.id;
  }
  if (typeof component.storageKey === "string" && component.storageKey.length > 0) {
    return component.storageKey;
  }
  if (typeof component.name === "string" && component.name.length > 0) {
    return component.name;
  }
  return `${component.type}-${hashString(JSON.stringify(component))}`;
}

function getStorageKey(component: IntakeComponent): string | undefined {
  if (typeof component.storageKey === "string" && component.storageKey.length > 0) {
    return component.storageKey;
  }
  if (typeof component.name === "string" && component.name.length > 0) {
    return component.name;
  }
  return undefined;
}

function getClassName(component: IntakeComponent, fallback: string): string {
  if (typeof component.class === "string" && component.class.length > 0) {
    return component.class;
  }
  if (typeof component.classes === "string" && component.classes.length > 0) {
    return component.classes;
  }
  return fallback;
}

function normalizeStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function resolveOptionValue(option: IntakeComponentOption | undefined, index: number, language: LanguageCode): string {
  if (option && typeof option.value === "string" && option.value.length > 0) {
    return option.value;
  }
  const label = resolveText(option?.label, language);
  if (label) {
    return label;
  }
  return `option-${index}`;
}

function buildDescribedBy(ids: string[]): string | undefined {
  const filtered = ids.filter(Boolean);
  return filtered.length > 0 ? filtered.join(" ") : undefined;
}

function extractValue(values: FormValues, key?: string): unknown {
  if (!key) {
    return undefined;
  }

  if (Object.prototype.hasOwnProperty.call(values, key)) {
    return values[key];
  }

  const segments = key.split(".");
  let cursor: unknown = values;
  for (const segment of segments) {
    if (cursor && typeof cursor === "object" && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return cursor;
}

function formatSummaryValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatSummaryValue(item))
      .filter((item) => item.length > 0)
      .join(", ");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("day" in record || "month" in record || "year" in record) {
      const day = (record["day"] ?? "").toString();
      const month = (record["month"] ?? "").toString();
      const year = (record["year"] ?? "").toString();
      const parts = [day, month, year].filter((part) => part.trim().length > 0);
      return parts.join("/");
    }

    return Object.values(record)
      .map((entry) => formatSummaryValue(entry))
      .filter((entry) => entry.length > 0)
      .join(", ");
  }

  return String(value);
}
function paragraphRenderer(component: IntakeComponent, language: LanguageCode) {
  const text = resolveText(component.text, language);
  if (!text) {
    return null;
  }
  const className = getClassName(component, "govuk-body");
  const Tag = typeof component.as === "string" ? (component.as as keyof JSX.IntrinsicElements) : "p";
  return <Tag className={className}>{text}</Tag>;
}

function inputRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const storageKey = getStorageKey(component);
  if (!storageKey) {
    return null;
  }

  const label = resolveText(component.label, language);
  const hint = resolveText(component.hint, language);
  const value = normalizeStringValue(values[storageKey]);
  const inputType = typeof component.inputType === "string" ? component.inputType : "text";
  const className = getClassName(component, "govuk-input");
  const required = Boolean(component.required);
  const errorMessage = errors[storageKey];
  const describedBy = buildDescribedBy([
    errorMessage ? `${storageKey}-error` : "",
    hint ? `${storageKey}-hint` : ""
  ]);
  const formGroupClass = `govuk-form-group${errorMessage ? " govuk-form-group--error" : ""}`;

  return (
    <div className={formGroupClass}>
      {label && (
        <label className={`govuk-label ${typeof component.labelClass === "string" ? component.labelClass : ""}`} htmlFor={storageKey}>
          {label}
          {required ? <span className="govuk-required"> *</span> : null}
        </label>
      )}
      {hint && (
        <div className="govuk-hint" id={`${storageKey}-hint`}>
          {hint}
        </div>
      )}
      {errorMessage && (
        <p className="govuk-error-message" id={`${storageKey}-error`}>
          <span className="govuk-visually-hidden">Error:</span> {errorMessage}
        </p>
      )}
      <input
        id={storageKey}
        name={storageKey}
        type={inputType}
        className={className}
        value={value}
        aria-describedby={describedBy}
        autoComplete={typeof component.autocomplete === "string" ? component.autocomplete : undefined}
        placeholder={resolveText(component.placeholder, language) || undefined}
        required={required}
        onChange={(event) => onValueChange(storageKey, event.target.value)}
      />
    </div>
  );
}

function textareaRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const storageKey = getStorageKey(component);
  if (!storageKey) {
    return null;
  }

  const label = resolveText(component.label, language);
  const hint = resolveText(component.hint, language);
  const value = normalizeStringValue(values[storageKey]);
  const className = getClassName(component, "govuk-textarea");
  const rows = typeof component.rows === "number" ? component.rows : 5;
  const required = Boolean(component.required);
  const errorMessage = errors[storageKey];
  const describedBy = buildDescribedBy([
    errorMessage ? `${storageKey}-error` : "",
    hint ? `${storageKey}-hint` : ""
  ]);
  const formGroupClass = `govuk-form-group${errorMessage ? " govuk-form-group--error" : ""}`;

  return (
    <div className={formGroupClass}>
      {label && (
        <label className={`govuk-label ${typeof component.labelClass === "string" ? component.labelClass : ""}`} htmlFor={storageKey}>
          {label}
          {required ? <span className="govuk-required"> *</span> : null}
        </label>
      )}
      {hint && (
        <div className="govuk-hint" id={`${storageKey}-hint`}>
          {hint}
        </div>
      )}
      {errorMessage && (
        <p className="govuk-error-message" id={`${storageKey}-error`}>
          <span className="govuk-visually-hidden">Error:</span> {errorMessage}
        </p>
      )}
      <textarea
        id={storageKey}
        name={storageKey}
        className={className}
        rows={rows}
        value={value}
        aria-describedby={describedBy}
        maxLength={typeof component.maxLength === "number" ? component.maxLength : undefined}
        placeholder={resolveText(component.placeholder, language) || undefined}
        required={required}
        onChange={(event) => onValueChange(storageKey, event.target.value)}
      />
    </div>
  );
}

function characterCountRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const storageKey = getStorageKey(component);
  if (!storageKey) {
    return null;
  }

  const label = resolveText(component.label, language);
  const hint = resolveText(component.hint, language);
  const value = normalizeStringValue(values[storageKey]);
  const maxLength = typeof component.maxLength === "number" ? component.maxLength : undefined;
  const threshold = typeof component.threshold === "number" ? component.threshold : undefined;
  const messageId = `${storageKey}-character-count`;
  const errorMessage = errors[storageKey];
  const describedByIds = [errorMessage ? `${storageKey}-error` : "", hint ? `${storageKey}-hint` : ""];
  if (maxLength) {
    describedByIds.push(messageId);
  }
  const describedBy = buildDescribedBy(describedByIds);
  const formGroupClass = `govuk-form-group${errorMessage ? " govuk-form-group--error" : ""}`;
  const remaining = typeof maxLength === "number" ? maxLength - value.length : undefined;
  let message = "";
  let messageClass = "govuk-character-count__message";

  if (typeof remaining === "number") {
    if (remaining < 0) {
      message = `You have ${Math.abs(remaining)} characters too many`;
      messageClass += " govuk-character-count__message--invalid";
    } else {
      message = `You have ${remaining} characters remaining`;
      if (typeof threshold === "number" && remaining <= threshold) {
        messageClass += " govuk-character-count__message--warning";
      }
    }
  }

  return (
    <div className="govuk-character-count" data-module="govuk-character-count" data-maxlength={maxLength}>
      <div className={formGroupClass}>
        {label && (
          <label className={`govuk-label ${typeof component.labelClass === "string" ? component.labelClass : ""}`} htmlFor={storageKey}>
            {label}
          </label>
        )}
        {hint && (
          <div className="govuk-hint" id={`${storageKey}-hint`}>
            {hint}
          </div>
        )}
        {errorMessage && (
          <p className="govuk-error-message" id={`${storageKey}-error`}>
            <span className="govuk-visually-hidden">Error:</span> {errorMessage}
          </p>
        )}
        <textarea
          id={storageKey}
          name={storageKey}
          className="govuk-textarea govuk-js-character-count"
          rows={typeof component.rows === "number" ? component.rows : 5}
          value={value}
          aria-describedby={describedBy}
          maxLength={maxLength}
          onChange={(event) => onValueChange(storageKey, event.target.value)}
        />
        {message && (
          <div id={messageId} className={messageClass} aria-live="polite">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}

function summaryListRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const rows = Array.isArray((component as Record<string, unknown>).rows)
    ? ((component as Record<string, unknown>).rows as SummaryRow[])
    : [];

  if (rows.length === 0) {
    return null;
  }

  const hideEmpty = Boolean((component as Record<string, unknown>).hideEmpty);
  const componentFallback = resolveText((component as Record<string, unknown>).emptyFallback, language) || "";

  const items = rows
    .map((rawRow, index) => {
      const row = rawRow as SummaryRow;
      const rowKey = typeof row.key === "string" ? row.key : undefined;
      const valueKey = typeof row.value === "string" ? row.value : rowKey;
      const label = resolveText(row.label as unknown, language) || rowKey || `Row ${index + 1}`;
      const emptyFallback = resolveText(row.emptyFallback as unknown, language) || componentFallback;
      const rawValue = valueKey ? extractValue(values, valueKey) : undefined;
      const formattedValue = formatSummaryValue(rawValue);

      if (hideEmpty && formattedValue.trim().length === 0 && emptyFallback.trim().length === 0) {
        return null;
      }

      const displayValue = formattedValue.trim().length > 0 ? formattedValue : emptyFallback;
      const children = Array.isArray(row.components) ? (row.components as IntakeComponent[]) : [];

      return {
        id: rowKey ? `${rowKey}-${index}` : `summary-row-${index}`,
        label,
        value: displayValue,
        children
      };
    })
    .filter((item): item is { id: string; label: string; value: string; children: IntakeComponent[] } => Boolean(item));

  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="govuk-summary-list">
      {items.map((item) => (
        <div className="govuk-summary-list__row" key={item.id}>
          <dt className="govuk-summary-list__key">{item.label}</dt>
          <dd className="govuk-summary-list__value">
            {item.value || <span className="govuk-hint">Not provided</span>}
            {item.children.length > 0 && (
              <div className="govuk-!-margin-top-2">
                {item.children
                  .filter((child) => isComponentVisible(child, values))
                  .map((child) => (
                    <Fragment key={getComponentKey(child)}>
                      <ComponentRenderer component={child} language={language} values={values} errors={errors} onValueChange={onValueChange} />
                    </Fragment>
                  ))}
              </div>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
function selectRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const storageKey = getStorageKey(component);
  if (!storageKey || !Array.isArray(component.options)) {
    return null;
  }

  const visibleOptions = component.options.filter((option) => isOptionVisible(option, values));

  const label = resolveText(component.label, language);
  const hint = resolveText(component.hint, language);
  const value = normalizeStringValue(values[storageKey]);
  const className = getClassName(component, "govuk-select");
  const required = Boolean(component.required);
  const errorMessage = errors[storageKey];
  const describedBy = buildDescribedBy([
    errorMessage ? `${storageKey}-error` : "",
    hint ? `${storageKey}-hint` : ""
  ]);
  const formGroupClass = `govuk-form-group${errorMessage ? " govuk-form-group--error" : ""}`;

  return (
    <div className={formGroupClass}>
      {label && (
        <label className={`govuk-label ${typeof component.labelClass === "string" ? component.labelClass : ""}`} htmlFor={storageKey}>
          {label}
          {required ? <span className="govuk-required"> *</span> : null}
        </label>
      )}
      {hint && (
        <div className="govuk-hint" id={`${storageKey}-hint`}>
          {hint}
        </div>
      )}
      {errorMessage && (
        <p className="govuk-error-message" id={`${storageKey}-error`}>
          <span className="govuk-visually-hidden">Error:</span> {errorMessage}
        </p>
      )}
      <select
        id={storageKey}
        name={storageKey}
        className={className}
        value={value}
        aria-describedby={describedBy}
        required={required}
        onChange={(event) => onValueChange(storageKey, event.target.value)}
      >
        <option value="">{resolveText(component.placeholder, language) || "Select an option"}</option>
        {visibleOptions.map((option, index) => {
          const optionValue = resolveOptionValue(option, index, language);
          const optionLabel = resolveText(option.label, language) || optionValue;
          return (
            <option value={optionValue} key={`${storageKey}-option-${index}`}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function dateInputRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const storageKey = getStorageKey(component);
  if (!storageKey) {
    return null;
  }

  const label = resolveText(component.label, language);
  const hint = resolveText(component.hint, language);
  const errorMessage = errors[storageKey];
  const describedBy = buildDescribedBy([
    errorMessage ? `${storageKey}-error` : "",
    hint ? `${storageKey}-hint` : ""
  ]);
  const formGroupClass = `govuk-form-group${errorMessage ? " govuk-form-group--error" : ""}`;
  const currentValue = values[storageKey];
  const dateValue = typeof currentValue === "object" && currentValue !== null ? (currentValue as Record<string, string>) : {};
  const fields = Array.isArray((component as Record<string, unknown>).dateFields)
    ? ((component as Record<string, unknown>).dateFields as Array<Record<string, unknown>>)
    : [
        { name: "day", label: { en: "Day" }, classes: "govuk-input--width-2" },
        { name: "month", label: { en: "Month" }, classes: "govuk-input--width-2" },
        { name: "year", label: { en: "Year" }, classes: "govuk-input--width-4" }
      ];

  return (
    <div className={formGroupClass}>
      {label && (
        <label className={`govuk-label ${typeof component.labelClass === "string" ? component.labelClass : ""}`} htmlFor={`${storageKey}-day`}>
          {label}
          {component.required ? <span className="govuk-required"> *</span> : null}
        </label>
      )}
      {hint && (
        <div className="govuk-hint" id={`${storageKey}-hint`}>
          {hint}
        </div>
      )}
      {errorMessage && (
        <p className="govuk-error-message" id={`${storageKey}-error`}>
          <span className="govuk-visually-hidden">Error:</span> {errorMessage}
        </p>
      )}
      <div className="govuk-date-input" id={`${storageKey}-date`} aria-describedby={describedBy}>
        {fields.map((field, index) => {
          const name = typeof field.name === "string" && field.name.length > 0 ? field.name : index === 0 ? "day" : index === 1 ? "month" : "year";
          const fieldLabel = resolveText(field.label as unknown, language) || name;
          const fieldId = `${storageKey}-${name}`;
          const fieldValue = typeof dateValue[name] === "string" ? dateValue[name] : "";
          const classes = typeof field.classes === "string" && field.classes.length > 0 ? field.classes : index === 2 ? "govuk-input--width-4" : "govuk-input--width-2";

          return (
            <div className="govuk-date-input__item" key={fieldId}>
              <div className="govuk-form-group">
                <label className="govuk-label govuk-date-input__label" htmlFor={fieldId}>
                  {fieldLabel}
                </label>
                <input
                  id={fieldId}
                  name={`${storageKey}.${name}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={`govuk-input govuk-date-input__input ${classes}`}
                  value={fieldValue}
                  onChange={(event) => {
                    const next = { ...dateValue, [name]: event.target.value };
                    onValueChange(storageKey, next);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function radiosRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const storageKey = getStorageKey(component);
  if (!storageKey || !Array.isArray(component.options)) {
    return null;
  }

  const visibleOptions = component.options.filter((option) => isOptionVisible(option, values));

  const label = resolveText(component.label, language) || "";
  const hint = resolveText(component.hint, language);
  const value = normalizeStringValue(values[storageKey]);
  const className = getClassName(component, "govuk-radios");
  const required = Boolean(component.required);
  const errorMessage = errors[storageKey];
  const describedBy = buildDescribedBy([
    errorMessage ? `${storageKey}-error` : "",
    hint ? `${storageKey}-hint` : ""
  ]);
  const formGroupClass = `govuk-form-group${errorMessage ? " govuk-form-group--error" : ""}`;

  return (
    <div className={formGroupClass}>
      <fieldset className={className} aria-describedby={describedBy}>
        <legend className={`govuk-fieldset__legend ${typeof component.legendClass === "string" ? component.legendClass : ""}`}>
          {label}
          {required ? <span className="govuk-required"> *</span> : null}
        </legend>
        {hint && (
          <div className="govuk-hint" id={`${storageKey}-hint`}>
            {hint}
          </div>
        )}
        {errorMessage && (
          <p className="govuk-error-message" id={`${storageKey}-error`}>
            <span className="govuk-visually-hidden">Error:</span> {errorMessage}
          </p>
        )}
        {visibleOptions.map((option, index) => {
          const optionValue = resolveOptionValue(option, index, language);
          const optionLabel = resolveText(option.label, language) || optionValue;
          const optionHint = resolveText(option.hint, language);
          const optionId = `${storageKey}-${index}`;
          const checked = value === optionValue;
          return (
            <div className="govuk-radios__item" key={optionId}>
              <input
                id={optionId}
                name={storageKey}
                type="radio"
                value={optionValue}
                className="govuk-radios__input"
                checked={checked}
                required={required && index === 0}
                onChange={(event) => onValueChange(storageKey, event.target.value)}
              />
              <label className="govuk-label govuk-radios__label" htmlFor={optionId}>
                {optionLabel}
              </label>
              {optionHint && <div className="govuk-hint govuk-radios__hint">{optionHint}</div>}
              {checked && (
                <div className="govuk-!-margin-left-4 govuk-!-margin-top-2">
                  {renderOptionChildren(option, language, values, errors, onValueChange)}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}

function checkboxesRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const storageKey = getStorageKey(component);
  if (!storageKey || !Array.isArray(component.options)) {
    return null;
  }

  const visibleOptions = component.options.filter((option) => isOptionVisible(option, values));

  const label = resolveText(component.label, language) || "";
  const hint = resolveText(component.hint, language);
  const className = getClassName(component, "govuk-checkboxes");
  const rawValue = values[storageKey];
  const checkedValues = Array.isArray(rawValue) ? (rawValue as string[]) : [];
  const errorMessage = errors[storageKey];
  const describedBy = buildDescribedBy([
    errorMessage ? `${storageKey}-error` : "",
    hint ? `${storageKey}-hint` : ""
  ]);
  const formGroupClass = `govuk-form-group${errorMessage ? " govuk-form-group--error" : ""}`;

  return (
    <div className={formGroupClass}>
      <fieldset className={className} aria-describedby={describedBy}>
        <legend className={`govuk-fieldset__legend ${typeof component.legendClass === "string" ? component.legendClass : ""}`}>
          {label}
        </legend>
        {hint && (
          <div className="govuk-hint" id={`${storageKey}-hint`}>
            {hint}
          </div>
        )}
        {errorMessage && (
          <p className="govuk-error-message" id={`${storageKey}-error`}>
            <span className="govuk-visually-hidden">Error:</span> {errorMessage}
          </p>
        )}
        {visibleOptions.map((option, index) => {
          const optionValue = resolveOptionValue(option, index, language);
          const optionLabel = resolveText(option.label, language) || optionValue;
          const optionHint = resolveText(option.hint, language);
          const optionId = `${storageKey}-${index}`;
          const checked = checkedValues.includes(optionValue);
          return (
            <div className="govuk-checkboxes__item" key={optionId}>
              <input
                id={optionId}
                name={`${storageKey}[]`}
                type="checkbox"
                value={optionValue}
                className="govuk-checkboxes__input"
                checked={checked}
                onChange={(event) => {
                  const nextValues = new Set(checkedValues);
                  if (event.target.checked) {
                    nextValues.add(optionValue);
                  } else {
                    nextValues.delete(optionValue);
                  }
                  onValueChange(storageKey, Array.from(nextValues));
                }}
              />
              <label className="govuk-label govuk-checkboxes__label" htmlFor={optionId}>
                {optionLabel}
              </label>
              {optionHint && <div className="govuk-hint govuk-checkboxes__hint">{optionHint}</div>}
              {checked && (
                <div className="govuk-!-margin-left-4 govuk-!-margin-top-2">
                  {renderOptionChildren(option, language, values, errors, onValueChange)}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}

function detailsRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const summary =
    resolveText((component as Record<string, unknown>).summary, language) ||
    resolveText(component.title, language) ||
    resolveText(component.label, language) ||
    "Details";
  const hint = resolveText(component.hint, language);
  const text = resolveText(component.text, language);
  const className = getClassName(component, "govuk-details");
  const open = Boolean((component as Record<string, unknown>).open);

  return (
    <details className={className} data-module="govuk-details" open={open || undefined}>
      <summary className="govuk-details__summary">
        <span className="govuk-details__summary-text">{summary}</span>
      </summary>
      <div className="govuk-details__text">
        {hint && <p className="govuk-hint">{hint}</p>}
        {text && <p className="govuk-body">{text}</p>}
        {renderChildren(component, language, values, errors, onValueChange)}
      </div>
    </details>
  );
}

function accordionRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const items = Array.isArray((component as Record<string, unknown>).items)
    ? ((component as Record<string, unknown>).items as Array<Record<string, unknown>>)
    : [];
  if (items.length === 0) {
    return null;
  }

  const accordionId = component.id ?? component.storageKey ?? `accordion-${hashString(JSON.stringify(component))}`;
  const className = getClassName(component, "govuk-accordion");

  return (
    <div className={className} data-module="govuk-accordion" id={accordionId}>
      {items.map((item, index) => {
        const heading = resolveText(item.heading as unknown, language) || resolveText(item.title as unknown, language) || `Section ${index + 1}`;
        const summary = resolveText(item.summary as unknown, language);
        const content = resolveText(item.content as unknown, language);
        const children = Array.isArray(item.components) ? (item.components as IntakeComponent[]) : [];
        return (
          <div className="govuk-accordion__section" key={`${accordionId}-section-${index}`}>
            <div className="govuk-accordion__section-header">
              <h2 className="govuk-accordion__section-heading">
                <span className="govuk-accordion__section-button">{heading}</span>
              </h2>
              {summary && (
                <div className="govuk-accordion__section-summary">
                  <span className="govuk-accordion__section-summary-text">{summary}</span>
                </div>
              )}
            </div>
            <div className="govuk-accordion__section-content govuk-body">
              {content && <p className="govuk-body">{content}</p>}
              {children.map((child) => (
                <Fragment key={getComponentKey(child)}>
                  <ComponentRenderer component={child} language={language} values={values} errors={errors} onValueChange={onValueChange} />
                </Fragment>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function signatureAckRenderer(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  const storageKey = getStorageKey(component);
  if (!storageKey) {
    return null;
  }

  const label = resolveText(component.label, language);
  const hint = resolveText(component.hint, language);
  const placeholder = resolveText((component as Record<string, unknown>).placeholder, language) || "";
  const actionLabel = resolveText((component as Record<string, unknown>).actionLabel, language) || "Sign";
  const clearLabel = resolveText((component as Record<string, unknown>).clearLabel, language) || "Clear";
  const statusSigned = resolveText((component as Record<string, unknown>).statusSignedText, language) || "Signed";
  const statusUnsigned = resolveText((component as Record<string, unknown>).statusUnsignedText, language) || "Not signed";
  const value = normalizeStringValue(values[storageKey]);
  const isSigned = value.trim().length > 0;
  const errorMessage = errors[storageKey];
  const describedBy = buildDescribedBy([
    errorMessage ? `${storageKey}-error` : "",
    hint ? `${storageKey}-hint` : ""
  ]);
  const formGroupClass = `govuk-form-group${errorMessage ? " govuk-form-group--error" : ""}`;

  return (
    <div className={formGroupClass}>
      {label && (
        <label className={`govuk-label ${typeof component.labelClass === "string" ? component.labelClass : ""}`} htmlFor={storageKey}>
          {label}
          {component.required ? <span className="govuk-required"> *</span> : null}
        </label>
      )}
      {hint && (
        <div className="govuk-hint" id={`${storageKey}-hint`}>
          {hint}
        </div>
      )}
      {errorMessage && (
        <p className="govuk-error-message" id={`${storageKey}-error`}>
          <span className="govuk-visually-hidden">Error:</span> {errorMessage}
        </p>
      )}
      <div className="govuk-!-margin-bottom-2">
        <input
          id={storageKey}
          name={storageKey}
          type="text"
          className="govuk-input govuk-!-width-two-thirds"
          placeholder={placeholder || undefined}
          value={value}
          aria-describedby={describedBy}
          onChange={(event) => onValueChange(storageKey, event.target.value)}
        />
      </div>
      <div className="govuk-button-group">
        <button
          type="button"
          className="govuk-button govuk-button--secondary"
          onClick={() => {
            if (!value && placeholder) {
              onValueChange(storageKey, placeholder);
            }
          }}
        >
          {actionLabel}
        </button>
        <button
          type="button"
          className="govuk-button govuk-button--secondary"
          onClick={() => onValueChange(storageKey, "")}
        >
          {clearLabel}
        </button>
      </div>
      <p className="govuk-body govuk-!-margin-bottom-0">
        <strong>Status:</strong> {isSigned ? statusSigned : statusUnsigned}
      </p>
    </div>
  );
}

function fileUploadRenderer(component: IntakeComponent, language: LanguageCode) {
  const label = resolveText(component.label, language);
  const hint = resolveText(component.hint, language);
  const className = getClassName(component, "govuk-form-group");
  const placeholderMessage = "File uploads will be enabled in a future update.";

  return (
    <div className={className}>
      {label && <label className={`govuk-label ${typeof component.labelClass === "string" ? component.labelClass : ""}`}>{label}</label>}
      {hint && <div className="govuk-hint">{hint}</div>}
      <input
        type="file"
        className="govuk-file-upload"
        disabled
        aria-disabled="true"
        title="File upload is not available yet"
      />
      <p className="govuk-hint govuk-!-margin-top-1">{placeholderMessage}</p>
    </div>
  );
}

function unsupportedRenderer(component: IntakeComponent) {
  return (
    <div className="govuk-warning-text govuk-!-margin-top-4">
      <span className="govuk-warning-text__icon" aria-hidden="true">
        !
      </span>
      <strong className="govuk-warning-text__text">
        Unsupported component type: {component.type}
      </strong>
    </div>
  );
}
function renderOptionChildren(
  option: IntakeComponentOption,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  if (!Array.isArray(option.children) || option.children.length === 0) {
    return null;
  }

  return option.children
    .filter((child) => isComponentVisible(child, values))
    .map((child) => (
      <Fragment key={getComponentKey(child)}>
        <ComponentRenderer component={child} language={language} values={values} errors={errors} onValueChange={onValueChange} />
      </Fragment>
    ));
}

function renderChildren(
  component: IntakeComponent,
  language: LanguageCode,
  values: FormValues,
  errors: FieldErrors,
  onValueChange: (storageKey: string, value: unknown) => void
) {
  if (!Array.isArray(component.components) || component.components.length === 0) {
    return null;
  }

  return component.components
    .filter((child) => isComponentVisible(child, values))
    .map((child) => (
      <Fragment key={getComponentKey(child)}>
        <ComponentRenderer component={child} language={language} values={values} errors={errors} onValueChange={onValueChange} />
      </Fragment>
    ));
}

export function ComponentRenderer({ component, language, values, errors, onValueChange }: RendererComponentProps) {
  if (!isComponentVisible(component, values)) {
    return null;
  }

  let rendered: JSX.Element | null;

  switch (component.type) {
    case "paragraph":
    case "inset-text":
    case "warning-text":
      rendered = paragraphRenderer(component, language);
      break;
    case "input":
    case "text":
    case "email":
    case "number":
    case "phone":
      rendered = inputRenderer(component, language, values, errors, onValueChange);
      break;
    case "textarea":
    case "text-area":
      rendered = textareaRenderer(component, language, values, errors, onValueChange);
      break;
    case "character-count":
      rendered = characterCountRenderer(component, language, values, errors, onValueChange);
      break;
    case "summary-list":
      rendered = summaryListRenderer(component, language, values, errors, onValueChange);
      break;
    case "select":
      rendered = selectRenderer(component, language, values, errors, onValueChange);
      break;
    case "date":
    case "date-input":
      rendered = dateInputRenderer(component, language, values, errors, onValueChange);
      break;
    case "radios":
    case "radio":
      rendered = radiosRenderer(component, language, values, errors, onValueChange);
      break;
    case "checkboxes":
    case "checkbox":
      rendered = checkboxesRenderer(component, language, values, errors, onValueChange);
      break;
    case "details":
      rendered = detailsRenderer(component, language, values, errors, onValueChange);
      break;
    case "accordion":
      rendered = accordionRenderer(component, language, values, errors, onValueChange);
      break;
    case "signature-ack":
      rendered = signatureAckRenderer(component, language, values, errors, onValueChange);
      break;
    case "file-upload":
      rendered = fileUploadRenderer(component, language);
      break;
    default:
      rendered = unsupportedRenderer(component);
      break;
  }

  return (
    <Fragment>
      {rendered}
      {renderChildren(component, language, values, errors, onValueChange)}
    </Fragment>
  );
}

