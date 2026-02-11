# Standard Prompt (Manual + UAT Framework)

Purpose: A reusable prompt and response framework for Codex to produce consistent manual content and UAT scripts for PATH/ISET public portal and admin functionality.

Audience: Codex (LLM) and project staff generating UAT artifacts from chat outputs.

Status: Canonical. Use this at the start of new Codex chat threads to enforce a consistent response structure.

Last Updated: 2026-02-09

## How To Use This

1. Paste the "Copy-Paste Prompt" into a new Codex thread.
2. Replace the bracketed placeholders.
3. For each new feature area, say only: "Next section: <name>".
4. Do not accept alternative formats in outputs. The chat output is the artifact.

## Copy-Paste Prompt (New Threads)

```text
You are author and owner of the PATH/ISET docbase and codebase for the purpose of this session.

Goal:
Produce manual content and UAT test scripts section-by-section for the PATH/ISET system.

Critical requirement:
Every response MUST follow the exact "Standard Response Format" below, using the same 8 headings and order.
The response will be copied directly into UAT artifacts, so do not add meta commentary, progress updates, or tool output.

Scope for this section:
[SECTION NAME]

Constraints:
- Keep sections 1 and 2 short, visual, and non-technical (orientation, not instruction).
- Section 3 is behavioral rules (user-facing), descriptive not implementation.
- Section 4 includes step-by-step only where ambiguity exists (order matters, multiple valid paths, or confusion likely).
- Sections 5 and 6 may include technical references, but keep them contained and scoped.
- Section 7 must list by-design limitations plainly (factual, unapologetic).
- Section 8 must be a UAT test script table that tests the function in isolation, not full business workflows.

Artifacts:
- Include exactly one screenshot placeholder reference in Section 1 using the path format:
  `portal/assets/screenshots/<screenshot-file>.png`
- Include cross-references in Sections 3/5/6 when relevant, as plain file paths (no URLs).

If you are unsure:
- State assumptions explicitly inside the relevant section (not above the headings).
- Prefer testing-relevant assumptions (what UAT should expect) over design speculation.

Now produce the content for: [SECTION NAME]
```

## Standard Response Format (8 Headings, Always)

Use the exact headings, numbering, and order below.

### 1. Overview (what this function is for)

Requirements:
- One paragraph maximum.
- Non-technical, public-facing language.
- Where it sits in the journey (public-facing, pre-intake, in-intake, post-submit).
- Exactly one screenshot placeholder line:
  `Screenshot: portal/assets/screenshots/<name>.png`

### 2. Who uses this function and when

Requirements:
- Primary user
- Indirect users
- Expected use
- Not used (what is out of scope, prevents irrelevant UAT edge cases)

### 3. Functional behaviour (user-facing rules)

Requirements:
- Behavior and rules only (validation, required fields, error handling, confirmations, state changes).
- No implementation details unless needed to define observable behavior.
- Include cross-references to other manuals when helpful:
  Example: `Cross-reference: portal/accounts/session-timeout-sign-out.md`

### 4. Step-by-step usage (only where ambiguity exists)

Requirements:
- Numbered steps only.
- Include steps only when order matters or confusion is likely.
- If obvious, keep this section very short.

### 5. Configuration & administration notes

Requirements:
- What can be configured by program admins and where (high-level).
- What is global vs environment-specific.
- Impacts of changing settings (behavior changes UAT should expect).
- Do not teach underlying vendor services (for example, "how Cognito works").

### 6. Technical behaviour (contained, for IT/audit)

Requirements:
- Technical but conceptual (tokens, session lifetime, audit logging, storage, data model behavior).
- Clearly separate what PATH does vs what the identity provider / external system does.
- Include endpoint names or data fields only if they help future maintenance and audit.

### 7. Known constraints and by-design limitations

Requirements:
- Bullet list.
- Short, factual.
- Oriented to UAT and stakeholder expectation management.

### 8. UAT test script (table)

Requirements:
- Markdown table.
- Columns MUST be exactly:
  `Test ID | Scenario | Preconditions | Action | Expected result | Pass / Fail | Notes`
- Test IDs should be stable and prefixed by a short code for the section:
  Examples: `AUTH-001`, `UPLOAD-004`, `SUBMIT-003`
- Scenarios should test the function in isolation.
- Use concrete expected results (what a tester sees), not internal states.

## Style Rules (Non-Negotiable)

- Output ONLY the 8 sections. No introductions, no "next steps", no progress updates.
- Use plain language. Avoid acronyms unless defined once in-context.
- Prefer "what the user sees" over "what the system does internally", except in Sections 5 and 6.
- If there are multiple variants (environments, roles, feature flags), call them out explicitly in Sections 5/6.
- Cross-references must be file paths, not links.

## Optional Add-On (Docbase Hygiene)

If the thread also includes "review docbase" or "bring docs up to date":
- After delivering the 8 sections in chat, update the docbase on disk:
  - Add or update the corresponding `docs/.../<section>.md`
  - Update the relevant index page
  - Update `docs/meta/changelog.md` with the date and a one-line summary
  - Add screenshot placeholder entries in `docs/.../assets/screenshots/README.md`

## List of Sections

Applicant Dashboard & Start/Resume Application
Covers entry point after sign‑in, draft resume/delete, status cards, and routing.

Dynamic Intake Flow (core form experience)
Step navigation, validation, branching, save‑and‑finish‑later, and summary.

Document Uploads
File upload rules, required docs visibility, upload errors, and finalize behavior.

Secure Messaging
Inbox/sent/deleted, compose, attachments, and coordinator availability gating.

Submission & Confirmation
Submit flow, confirmation page, and post‑submit status changes.

Application Details / Documents Center
Viewing submitted application details and document lists.

Help/Support + Legal pages
Help content, privacy/cookies/accessibility pages.