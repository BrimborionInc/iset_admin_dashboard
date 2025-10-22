# Public Portal Rebuild Proposal (Baseline)
Maintainer: Codex assistant during rebuild planning
Application name: ISET Public Portal
Last updated: 2025-09-25

## Stack Choices
- Framework & build tool: Vite + React 18 in strict TypeScript mode to keep a fast dev loop with familiar React ergonomics.
- Language: TypeScript everywhere; compiler plus ESLint import cycle rules guard against the zero circular dependency constraint.
- Package & workspace manager: npm workspaces with committed package-lock for deterministic installs without introducing extra tooling.
- Routing: React Router v7 data APIs because they are stable, accessible, and trivial to test in isolation.
- State model: React context for view/auth state and TanStack Query for server cache so we avoid bespoke global stores while keeping async logic predictable.
- Styling & design system: GOV.UK Frontend SCSS modules bundled through Vite to reuse existing accessible patterns.
- Testing: Vitest + Testing Library for unit/component coverage and Playwright for the mandatory smoke E2E.
- Lint/format: ESLint (TypeScript config + import/no-cycle) alongside Prettier enforced via npm scripts.
- Env & secrets: dotenv-flow for layered .env loading, validated at startup by a shared Zod schema package to satisfy twelve-factor requirements.
- API layer: Internal `@iset/api-client` package defining typed endpoints with a pluggable `HttpAdapter` so fetch/axios/test doubles stay swappable.
- Auth boundary: `@iset/auth` module owns the Cognito handshake and cookie orchestration; legacy session code is not imported into the new build and all front-end flows use the modern auth client directly.
- Error handling & notifications: Route-level React error boundaries and a shared toast/alert service implemented in `@iset/ui` using accessible live regions.
- Logging & metrics: Pino for backend HTTP logging and a thin browser logger in `@iset/logging` that forwards structured entries with request IDs.
- CI: GitHub Actions job running install -> typecheck -> lint -> test (Vitest + Playwright) against Node LTS 18/20 with fail-fast.

## Folder Layout
```
apps/
  web/src/app/(routes and loaders)
  web/src/features/{intake,messaging,...}
  web/src/shared/{components,ui,hooks}
  api/src/{http,services,adapters}
packages/
  api-client/src
  auth/src
  config/src/env
  logging/src
  ui/src
tests/
  e2e/playwright
  integration/api
```

## Key Patterns
- Ports & adapters: Feature slices depend on domain ports from `packages/api-client`; salvaged features are copied into the new workspace (no imports from the retired repository).
- API client: Endpoint maps declare method, path, input, and output types; the default adapter wraps `fetch` with retries, auth header injection, and structured error handling.
- Error handling: Layout-level error boundaries catch renderer failures, emit structured logs, and surface safe messaging through the shared toast service.
- Auth boundary: Cognito tokens are managed in `packages/auth`, stored via HTTP-only cookies, and exposed to React through a typed context; there is no legacy session adapter in the clean base—any temporary fallbacks live under `packages/legacy` and do not ship by default.
- Observability: Fastify backend (if/when introduced) provides schema validation and structured logging; request metadata funnels through `@iset/logging` for future cross-app tracing.

## Porting Principles Learned
- UI migrations are literal copies of the current public portal; do not redesign, drop accents, or swap copy.
- Styling, layout, and behaviour must match the old build pixel-for-pixel unless a change is explicitly requested.
- Source files from the retired repository are copied into this workspace; no runtime imports may point back to the legacy tree.
- Verify behaviour against the legacy portal before committing replacements (sign-in flow, menus, dynamic renderer, etc.).

## Accessibility & Internationalization
- Accessibility baseline: GOV.UK components, axe checks in CI, and toast/error patterns wired to ARIA live regions to maintain WCAG 2.1 AA.
- Internationalization: Remains on; bilingual content pulled from JSON catalogs and schema payloads using `Intl.MessageFormat` so admin-authored translations flow unchanged.

## Risks & Tradeoffs
- Running Cognito and legacy session adapters in parallel increases surface area until deprecation; mitigated by feature flags and contract tests.
- npm workspaces require hoist discipline; we will lock versions and lint workspace boundaries to prevent bleed.
- Introducing TanStack Query adds another dependency but avoids custom cache plumbing; risk accepted for stability.
- Fastify adoption demands a small learning curve for the team though it yields built-in validation and performance.
- Strict lint rules will surface hidden cycles during salvage; plan includes fixer scripts and staged enforcement.

## Used-Endpoint Report
| Resource | Method & path(s) | Likely live usage |
| --- | --- | --- |
| Health & uptime | GET `/api/health` | ELB and synthetic monitors keep backend health signals alive. |
| Session introspection | GET `/api/me`; GET `/api/auth/heartbeat` | Applicant dashboard and idle timeout banner rely on these endpoints; no standalone profile data is collected. |
| Legacy auth | POST `/api/login`; POST `/api/logout`; POST `/api/register`; POST `/api/check-email`; POST `/api/request-password-reset`; POST `/api/reset-password` | Current username/password flows in dev and prod. |
| Cognito handshake | POST `/api/auth/callback`; POST `/api/auth/logout`; POST `/api/auth/forgot-password`; POST `/api/auth/confirm-forgot-password`; POST `/api/auth/register`; POST `/api/auth/confirm-registration`; POST `/api/auth/resend-confirmation`; POST `/api/auth/dev-admin-confirm`; POST `/api/auth/password-login`; POST `/api/auth/refresh` | New OIDC-based journeys for `/auth/callback`, password reset, and admin-assisted confirmations. |
| Intake navigation | GET `/api/intake-step/:stepId`; POST `/api/intake-step/:stepId/update`; GET `/api/intake-json`; POST `/api/intake-json`; POST `/api/intake/complete` | Dynamic workflow runner fetches step configs, persists partial answers, and finalizes submissions. |
| Draft management | GET/POST/DELETE `/api/draft`; POST `/api/save-draft`; POST `/api/jordan/save-draft`; GET `/api/jordan/get-draft`; DELETE `/api/jordan/delete-draft` | Save-and-resume for schema flow plus Jordan variant. |
| Applications & submissions | POST `/api/applications`; GET `/api/applications`; GET `/api/applications/by-tracking-id`; GET `/api/jordan-applications/by-tracking-id`; GET `/api/submissions`; GET `/api/submissions/by-reference` | Applicant dashboards, tracking lookup, and Jordan flows. |
| Messaging | GET `/api/messages`; GET `/api/messages/context`; GET `/api/messages/:id`; POST `/api/messages/reply`; POST `/api/messages/reply-with-attachments`; PUT `/api/messages/:id/read`; PUT `/api/messages/:id/replied`; DELETE `/api/messages/:id`; DELETE `/api/messages/clear-deleted` | Secure messaging inbox, compose, reply, and deletion flows. |
| Document lifecycle | GET `/api/uploads/info`; POST `/api/uploads/presign`; POST `/api/documents/finalize`; GET `/api/documents`; GET `/api/documents/:id/presign-download`; POST `/api/upload-application-file`; DELETE `/api/delete-bil` | File upload wizard, presigned S3 integration, and legacy cleanup endpoints. |
| Organizations | GET `/api/organizations`; GET `/api/organizations/:id` | Self-identification flows and required document lists. |
| Case coordination | POST `/api/case-events`; POST `/api/jordan/save-draft` | Timeline updates and notifications when applicants submit or respond. |
| AI support | POST `/api/ai-support` | Applicant help chat using OpenRouter. |
| Provisioning | POST `/api/provision/applicant` | Admin-triggered applicant bootstrap exposed via admin dashboard. |
| Admin metrics/config | GET `/api/admin/auth-metrics`; GET `/api/admin/linkage-stats`; GET/PATCH `/api/admin/upload-config` | Admin console widgets and upload size configuration. |
## Compliance Addendum

### Accessibility Targets
- Commitment: WCAG 2.2 AA across all interactive flows with no regression tolerance.
- Guardrails: `eslint-plugin-jsx-a11y`, route-level focus restoration, global skip-link (`Skip to main content`), modal/dialog trap tests, and GOV.UK contrast tokens.
- Automated checks: Playwright smoke run executes `@axe-core/playwright` assertions per route; failures block CI.

### WCAG 2.2 AA Checklist (Shipping Gate)
- All interactive controls reachable and operable via keyboard only.
- Programmatic names/roles/states exposed for widgets (aria-labels align with visible text).
- Focus indicators meet 3:1 contrast; on focus, the indicator is not clipped.
- Viewport zoom up to 200% preserves content and functionality without horizontal scroll.
- No flashing >3 times/second; animated content offers pause or stop controls.
- Error messaging announced in live regions and linked to invalid inputs.

### AA Conformance Note
Current GOV.UK design system components plus our accessibility guardrails satisfy the success criteria we target. New components must document keyboard behaviour, focus order, and localization notes in the feature README, and QA cannot sign off without the checklist above and automated axe coverage.

### Security Posture (CCCS PBMM Alignment)
- Secrets: `import.meta.env` values validated with Zod; build fails if required keys missing. No secrets bundled—frontend only receives public configuration via typed `window.__ISET_CONFIG__` hydrated from the backend.
- Auth: OIDC/OAuth2 authorization code with PKCE, short-lived cookies (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`), and CSRF tokens on same-site POSTs.
- Error handling: Root error boundary logs redacted metadata server-side; user sees generic messages. React stack traces stripped from production bundles.
- Logging & telemetry: Browser logging funnels through `@iset/logging`, scrubs emails, SINs, and tracking IDs. Server correlates request IDs without exposing PII.
- Supply chain: npm lockfile committed, dependency versions pinned, `npm audit --omit dev` runs in CI, SAST via `npm run lint:security` (ESLint security rules + `ts-unused-exports`), SBOM generated with `cyclonedx-npm`.

### CI/CD Gates
1. `npm ci` (deterministic install).
2. `npm run typecheck` (tsc --noEmit) and `npm run lint` (includes a11y plugin + security rules).
3. `npm run test` (Vitest) and `npm run test:e2e` (Playwright smoke with axe assertions).
4. `npm audit --audit-level=high` and `npx cyclonedx-npm --output sbom.json`.
5. Pipeline fails on any accessibility, dependency, or SAST issue.

### Security Headers Profile (Gateway)
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'self';
  form-action 'self'; img-src 'self' data: https://cdn.gov.uk;
  script-src 'self' 'sha256-<app-shell-hash>'; style-src 'self' 'sha256-<govuk-style-hash>';
  connect-src 'self' https://api.iset.gov.ca; font-src 'self'; manifest-src 'self';
  frame-src https://chatsupport.iset.gov.ca;
Referrer-Policy: no-referrer
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), microphone=(), gyroscope=(), payment=()
X-Content-Type-Options: nosniff
X-Frame-Options: DENY (mirrors CSP but kept for legacy agents)
```
Example CSP notes: Replace `sha256-<...>` with build-time hashes emitted by Vite for inline loader scripts/styles. If Web Workers or analytics are introduced, extend `worker-src` or `script-src` accordingly—never use `unsafe-inline`.

### Browser Runtime Practices
- `npm run dev` proxied through HTTPS locally using mkcert certificates to mirror Secure cookie handling.
- Browser storage limited to `sessionStorage` for ephemeral UI state; no tokens stored outside cookies.
- CSRF tokens delivered via `Set-Cookie` (SameSite=Strict) and echoed in `X-CSRF-Token` header on state-changing requests.




