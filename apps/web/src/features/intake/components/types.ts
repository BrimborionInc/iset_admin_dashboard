import type { LanguageCode, IntakeComponent } from "../schema";

export type FormValues = Record<string, unknown>;
export type FieldErrors = Record<string, string>;

export interface RendererComponentProps {
  readonly component: IntakeComponent;
  readonly language: LanguageCode;
  readonly values: FormValues;
  readonly errors: FieldErrors;
  readonly onValueChange: (storageKey: string, value: unknown) => void;
}

