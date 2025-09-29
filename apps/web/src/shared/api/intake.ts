export interface IntakeSchemaResponse {
  readonly version?: string;
  readonly title?: string | { [language: string]: string | null | undefined } | null;
  readonly steps?: Array<Record<string, unknown>>;
}

export interface IntakeDraftResponse {
  readonly stepData?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly lastSavedAt?: string;
}

export interface SaveIntakeDraftPayload {
  readonly stepId: string;
  readonly values: Record<string, unknown>;
}

export interface SubmitIntakePayload {
  readonly values: Record<string, unknown>;
}

const JSON_HEADERS: HeadersInit = {
  Accept: "application/json"
};

async function requestJson<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const headers: HeadersInit = {
    ...JSON_HEADERS,
    ...(init?.headers ?? {})
  };

  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers
  });

  if (!response.ok) {
    const error = new Error(`Request to ${path} failed with status ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return {} as TResponse;
  }

  return (await response.json()) as TResponse;
}

export function fetchIntakeSchema(): Promise<IntakeSchemaResponse> {
  return requestJson<IntakeSchemaResponse>("/api/intake/schema");
}

export function fetchIntakeDraft(): Promise<IntakeDraftResponse> {
  return requestJson<IntakeDraftResponse>("/api/intake/draft");
}

export function saveIntakeDraft(payload: SaveIntakeDraftPayload): Promise<IntakeDraftResponse> {
  return requestJson<IntakeDraftResponse>("/api/intake/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export function submitIntake(payload: SubmitIntakePayload): Promise<Response> {
  return fetch("/api/intake/submit", {
    method: "POST",
    credentials: "include",
    headers: {
      ...JSON_HEADERS,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

