const VALID_POSTING_CONTEXTS = new Set(["external", "internal"]);

const normalisePostingContext = value => {
  if (typeof value !== "string") return null;
  const normalised = value.trim().toLowerCase();
  return VALID_POSTING_CONTEXTS.has(normalised) ? normalised : null;
};

const readPostingContext = record => {
  const candidates = [
    record?.postingContext,
    record?.posting_context,
    record?.metadata?.postingContext,
    record?.metadata?.posting_context,
  ];
  for (const candidate of candidates) {
    const normalised = normalisePostingContext(candidate);
    if (normalised) return normalised;
  }
  return null;
};

export const resolveInterventionPostingContextForForm = ({
  mode,
  intervention,
  plan,
  fallback = "external",
} = {}) => {
  if (mode === "edit") {
    const savedInterventionContext = readPostingContext(intervention);
    if (savedInterventionContext) return savedInterventionContext;
  }

  return readPostingContext(plan) || normalisePostingContext(fallback) || "external";
};
