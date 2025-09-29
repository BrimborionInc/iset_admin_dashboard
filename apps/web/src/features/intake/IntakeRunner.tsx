import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "../../shared/context";
import { fetchIntakeDraft, fetchIntakeSchema } from "../../shared/api/intake";
import { type IntakeSchema, parseIntakeSchema, type LanguageCode } from "./schema";
import { IntakeRenderer } from "./IntakeRenderer";

export function IntakeRunner() {
  const { language } = useLanguage();

  const schemaQuery = useQuery({
    queryKey: ["intake-schema"],
    queryFn: fetchIntakeSchema
  });

  const draftQuery = useQuery({
    queryKey: ["intake-draft"],
    queryFn: fetchIntakeDraft
  });

  const schema = useMemo<IntakeSchema | null>(() => {
    if (!schemaQuery.data) {
      return null;
    }

    try {
      return parseIntakeSchema(schemaQuery.data);
    } catch (error) {
      console.warn("[intake] failed to parse schema", error);
      return null;
    }
  }, [schemaQuery.data]);

  if (schemaQuery.isLoading || draftQuery.isLoading) {
    return <p className="govuk-body">Loading intake...</p>;
  }

  if (schemaQuery.error || draftQuery.error || !schema) {
    return (
      <div className="govuk-error-summary" role="alert" aria-labelledby="intake-error-title">
        <h2 className="govuk-error-summary__title" id="intake-error-title">
          We could not load the intake form.
        </h2>
        <div className="govuk-error-summary__body">
          <p>Please refresh the page or try again later.</p>
        </div>
      </div>
    );
  }

  const lang: LanguageCode = language === "fr" ? "fr" : "en";

  return <IntakeRenderer schema={schema} language={lang} draft={draftQuery.data} />;
}
