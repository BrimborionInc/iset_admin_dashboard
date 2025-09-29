import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ComponentRenderer } from "./components/ComponentRenderer";
import type { FieldErrors, FormValues } from "./components/types";
import type { IntakeComponent, IntakeComponentOption, IntakeSchema, IntakeStep, LanguageCode } from "./schema";
import { resolveText } from "./schema";
import { isComponentVisible, isOptionVisible } from "./conditions";
import { saveIntakeDraft, submitIntake, type IntakeDraftResponse } from "../../shared/api/intake";



export interface IntakeRendererProps {
  readonly schema: IntakeSchema;
  readonly language: LanguageCode;
  readonly draft?: IntakeDraftResponse | null;
}

interface StepValidationError {
  readonly field: string;
  readonly message: string;
  readonly label: string;
}

function extractInitialValues(draft: IntakeDraftResponse | null | undefined): FormValues {
  const initial: FormValues = {};
  if (!draft) {
    return initial;
  }

  const candidates: unknown[] = [];
  if (draft.stepData) {
    candidates.push(draft.stepData);
  }
  if ((draft as Record<string, unknown>).values) {
    candidates.push((draft as Record<string, unknown>).values);
  }
  if ((draft as Record<string, unknown>).data) {
    candidates.push((draft as Record<string, unknown>).data);
  }

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      Object.assign(initial, candidate as Record<string, unknown>);
    }
  }

  return initial;
}

function getStepKey(step: IntakeStep, index: number): string {
  if (typeof step.stepId === "string" && step.stepId.length > 0) {
    return step.stepId;
  }
  return `step-${index}`;
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

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function resolveOptionValue(option: IntakeComponentOption, index: number, language: LanguageCode): string {
  if (option && typeof option.value === "string" && option.value.length > 0) {
    return option.value;
  }

  const label = resolveText(option?.label, language);
  if (label) {
    return label;
  }

  return option-;
}

function collectValidationErrors(
  components: IntakeComponent[],
  values: FormValues,
  language: LanguageCode,
  errors: StepValidationError[]
) {
  for (const component of components) {
    if (!isComponentVisible(component, values)) {
      continue;
    }

    const storageKey = getStorageKey(component);
    if (storageKey && component.required) {
      const value = values[storageKey];
      if (isEmptyValue(value)) {
        const label = resolveText(component.label, language) || storageKey;
        errors.push({ field: storageKey, label, message: `${label} is required.` });
      }
    }

    if (Array.isArray(component.components) && component.components.length > 0) {
      collectValidationErrors(component.components, values, language, errors);
    }

    if (Array.isArray(component.options) && component.options.length > 0) {
      const componentValue = storageKey ? values[storageKey] : undefined;

      component.options.forEach((option, index) => {
        if (!isOptionVisible(option, values)) {
          return;
        }

        const optionChildren = option.children;
        if (!Array.isArray(optionChildren) || optionChildren.length === 0) {
          return;
        }

        let optionSelected = true;

        if (storageKey) {
          const resolvedValue = resolveOptionValue(option, index, language);

          if (component.type === "checkboxes" || component.type === "checkbox") {
            const selected = Array.isArray(componentValue) ? (componentValue as string[]) : [];
            optionSelected = selected.includes(resolvedValue);
          } else if (
            component.type === "radios" ||
            component.type === "radio" ||
            component.type === "select"
          ) {
            optionSelected = componentValue === resolvedValue;
          }
        }

        if (optionSelected) {
          collectValidationErrors(optionChildren, values, language, errors);
        }
      });
    }
  }
}function collectStorageKeys(components: IntakeComponent[], keys: Set<string>) {
  for (const component of components) {
    const storageKey = getStorageKey(component);
    if (storageKey) {
      keys.add(storageKey);
    }

    if (Array.isArray(component.components) && component.components.length > 0) {
      collectStorageKeys(component.components, keys);
    }

    if (Array.isArray(component.options) && component.options.length > 0) {
      for (const option of component.options) {
        if (Array.isArray(option.children) && option.children.length > 0) {
          collectStorageKeys(option.children, keys);
        }
      }
    }
  }
}

function extractStepValues(step: IntakeStep, values: FormValues): Record<string, unknown> {
  const keys = new Set<string>();
  if (Array.isArray(step.components) && step.components.length > 0) {
    collectStorageKeys(step.components, keys);
  }

  const subset: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in values) {
      subset[key] = values[key];
    }
  }
  return subset;
}

function validateStep(step: IntakeStep, values: FormValues, language: LanguageCode): StepValidationError[] {
  const errors: StepValidationError[] = [];
  if (Array.isArray(step.components)) {
    collectValidationErrors(step.components, values, language, errors);
  }
  return errors;
}

export function IntakeRenderer({ schema, language, draft }: IntakeRendererProps) {
  const steps = schema.steps ?? [];
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const initialValues = useMemo(() => extractInitialValues(draft), [draft]);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [stepErrors, setStepErrors] = useState<StepValidationError[]>([]);
  const [isPersisting, setIsPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues);
    setStepErrors([]);
    setPersistError(null);
    setSubmissionSuccess(null);
  }, [initialValues]);

  const errorMap = useMemo<FieldErrors>(() => {
    const map: FieldErrors = {};
    for (const error of stepErrors) {
      map[error.field] = error.message;
    }
    return map;
  }, [stepErrors]);

  const handleValueChange = useCallback((storageKey: string, value: unknown) => {
    setValues((previous) => {
      if (previous[storageKey] === value) {
        return previous;
      }
      return { ...previous, [storageKey]: value };
    });
    setStepErrors((previous) => previous.filter((error) => error.field !== storageKey));
    setPersistError(null);
    setSubmissionSuccess(null);
  }, []);

  const handlePrevious = useCallback(() => {
    if (isPersisting) {
      return;
    }
    setActiveStepIndex((index) => Math.max(0, index - 1));
    setStepErrors([]);
    setPersistError(null);
    setSubmissionSuccess(null);
  }, [isPersisting]);

  const handleNext = useCallback(async () => {
    if (isPersisting) {
      return;
    }

    const activeStep = steps[Math.min(activeStepIndex, steps.length - 1)];
    const validation = validateStep(activeStep, values, language);
    if (validation.length > 0) {
      setStepErrors(validation);
      return;
    }

    const payload = extractStepValues(activeStep, values);
    const stepId = activeStep.stepId || getStepKey(activeStep, activeStepIndex);

    setIsPersisting(true);
    setPersistError(null);
    setStepErrors([]);
    setSubmissionSuccess(null);

    try {
      await saveIntakeDraft({ stepId, values: payload });
    } catch (error) {
      console.error("[intake] failed to save draft", error);
      setPersistError("We could not save your progress. Please try again soon.");
    } finally {
      setIsPersisting(false);
    }

    setActiveStepIndex((index) => Math.min(steps.length - 1, index + 1));
  }, [activeStepIndex, isPersisting, language, steps, values]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPersisting) {
        return;
      }

      const activeStep = steps[Math.min(activeStepIndex, steps.length - 1)];
      const validation = validateStep(activeStep, values, language);
      if (validation.length > 0) {
        setStepErrors(validation);
        return;
      }

      const payload = extractStepValues(activeStep, values);
      const stepId = activeStep.stepId || getStepKey(activeStep, activeStepIndex);

      setIsPersisting(true);
      setPersistError(null);
      setStepErrors([]);
      setSubmissionSuccess(null);

      try {
        await saveIntakeDraft({ stepId, values: payload });
        const response = await submitIntake({ values });
        if (!response.ok) {
          throw new Error(`Submit failed with status ${response.status}`);
        }
        setActiveStepIndex(0);
        setValues({});
        setSubmissionSuccess("Application submitted. We'll email you when processing begins.");
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } catch (error) {
        console.error("[intake] failed to submit", error);
        setPersistError("We could not submit your application. Please try again.");
      } finally {
        setIsPersisting(false);
      }
    },
    [activeStepIndex, isPersisting, language, steps, values]
  );

  if (steps.length === 0) {
    return (
      <div className="govuk-warning-text govuk-!-margin-top-4">
        <span className="govuk-warning-text__icon" aria-hidden="true">
          !
        </span>
        <strong className="govuk-warning-text__text">This intake workflow does not contain any steps.</strong>
      </div>
    );
  }

  const activeStep = steps[Math.min(activeStepIndex, steps.length - 1)];
  const description = resolveText(activeStep.description, language);
  const stepTitle = resolveText(activeStep.title, language) || activeStep.stepId;

  return (
    <section aria-labelledby="intake-flow-title" className="govuk-!-margin-top-4">
      <header className="govuk-!-margin-bottom-6">
        <h1 className="govuk-heading-l" id="intake-flow-title">
          {schema.title || "Application"}
        </h1>
        <p className="govuk-body">Step {activeStepIndex + 1} of {steps.length}</p>
      </header>

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-one-third">
          <ol className="govuk-list govuk-list--number">
            {steps.map((step, index) => (
              <li key={getStepKey(step, index)} className={index === activeStepIndex ? "govuk-!-font-weight-bold" : ""}>
                {resolveText(step.title, language) || step.stepId}
              </li>
            ))}
          </ol>
        </div>

        <div className="govuk-grid-column-two-thirds">
          {stepErrors.length > 0 && (
            <div className="govuk-error-summary" role="alert" aria-labelledby="intake-step-error-title">
              <h2 className="govuk-error-summary__title" id="intake-step-error-title">
                There is a problem
              </h2>
              <div className="govuk-error-summary__body">
                <ul className="govuk-list govuk-error-summary__list">
                  {stepErrors.map((error) => (
                    <li key={error.field}>
                      <a href={`#${error.field}`}>{error.message}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {persistError && (
            <div className="govuk-error-summary" role="alert" aria-labelledby="intake-persist-error-title">
              <h2 className="govuk-error-summary__title" id="intake-persist-error-title">
                Unable to save changes
              </h2>
              <div className="govuk-error-summary__body">
                <p className="govuk-body">{persistError}</p>
              </div>
            </div>
          )}

          {submissionSuccess && (
            <div className="govuk-notification-banner govuk-notification-banner--success" role="alert" data-module="govuk-notification-banner">
              <div className="govuk-notification-banner__content">
                <h2 className="govuk-notification-banner__title">Success</h2>
                <p className="govuk-body">{submissionSuccess}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <h2 className="govuk-heading-m">{stepTitle}</h2>
            {description && <p className="govuk-body">{description}</p>}

            {Array.isArray(activeStep.components) && activeStep.components.length > 0 ? (
              activeStep.components.map((component, index) => (
                <ComponentRenderer
                  key={`${getStepKey(activeStep, activeStepIndex)}-${index}`}
                  component={component}
                  language={language}
                  values={values}
                  errors={errorMap}
                  onValueChange={handleValueChange}
                />
              ))
            ) : (
              <p className="govuk-body">This step does not contain any questions yet.</p>
            )}

            <div className="govuk-button-group govuk-!-margin-top-6">
              {activeStepIndex > 0 && (
                <button type="button" className="govuk-button govuk-button--secondary" onClick={handlePrevious} disabled={isPersisting}>
                  Back
                </button>
              )}
              {activeStepIndex < steps.length - 1 ? (
                <button type="button" className="govuk-button" onClick={handleNext} disabled={isPersisting}>
                  {isPersisting ? "Saving..." : "Continue"}
                </button>
              ) : (
                <button type="submit" className="govuk-button" disabled={isPersisting}>
                  {isPersisting ? "Submitting..." : "Submit Draft"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}






