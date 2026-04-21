# Public Landing Page

## Purpose
Provide a clear public entry point for NWAC staff who need to access PATH before signing in.

## Current intent
- The page is publicly reachable by URL.
- The page is not role-aware before authentication.
- Role-aware home dashboards remain post-sign-in behavior and should continue to live in the authenticated app shell.

## Goals
- Make staff sign-in the primary action.
- Keep a direct applicant-portal link available.
- Provide concise access and support guidance for NWAC staff.
- Allow service notices when they are current and operationally meaningful.
- Keep release notes available but secondary and opt-in.
- Avoid marketing copy and development-focused framing on first load.

## Current structure
```text
<LandingPage>
  <Header />
  <Hero />
  <AccessAndSupport />
  <ReleaseNotes collapsedByDefault />
  <Footer />
</LandingPage>
```

## Content guardrails
- Write for NWAC staff accessing PATH, not for product marketing or technical demonstration.
- Do not claim that the public page is role-aware before sign-in.
- Do not let release notes dominate the initial viewport.
- Keep landing-page release notes build-generated from `docs/meta/next-release-notes-log.md`, not hardcoded in the component.
- Prefer operational wording such as applications, cases, reporting, support, and access.
- Keep the applicant portal obvious but secondary to staff sign-in.

## Future options
- Replace hardcoded notices with a managed service-alert source.
- Add approved public training or support links if NWAC provides stable URLs.
- Add a small signed-out status panel only if the data source is trustworthy and current.

## Change Log
- v0.7 - Reframed the landing page as a public staff access/support page, removed product-marketing content, and moved release notes behind an opt-in expandable section.
