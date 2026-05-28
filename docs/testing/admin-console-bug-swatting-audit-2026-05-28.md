# Admin Console Bug-Swatting Audit - 2026-05-28

Status: audit snapshot with follow-up progress. Item 1 was fixed locally on 2026-05-28; remaining bug candidates are still open.

Scope: local WSL checkout `/home/bill/ISET/admin-dashboard`, admin console code and test harness. The worktree already had unrelated uncommitted changes before this audit.

## Commands Run

- `npm run lint`
  - Failed with 16 errors and 157 warnings.
  - Runtime-relevant errors: `src/workflows/normalizeWorkflow.js` references undefined `labelText` and `hintText`.
- `CI=true npm test -- --watchAll=false`
  - Failed: 1 suite failed, 22 suites passed.
  - Failing suite: `src/pages/finance/widgets/__tests__/paymentsWorkflowSafety.test.js`.
  - Failed assertions cover the legacy simple paid workflow, the old `Mark paid` action, and Financial Reports follow-up wording.
- `node --check isetadminserver.js`
  - Passed.
- `node --check scripts/esdc-participant-queue-browser-smoke.js`
  - Passed.
- `node --check scripts/path-deploy.js`
  - Passed.

## Bug Candidates

1. Workflow normalization can throw for unlabeled or content-only components.
   - Evidence: `src/workflows/normalizeWorkflow.js` references `labelText` and `hintText` at lines 385, 401, 419, and 431, but those variables are not defined in the current function scope.
   - Likely impact: publishing or previewing workflow steps that lack a resolved label, or text/inset/warning content that relies on fallback text, can fail with `ReferenceError`.
   - Current test gap: `src/workflows/normalizeWorkflow.test.js` only covers labeled form controls, so this path is not exercised.
   - Follow-up: fixed locally on 2026-05-28 by normalizing fallback `labelText` / `hintText` values from `labelEn` / `hintEn` and preserving bilingual fallback text for paragraph, inset-text, and warning-text components. Added `buildWorkflowSchema content-only fallbacks` coverage in `src/workflows/normalizeWorkflow.test.js`.
   - Verification: targeted workflow normalization Jest suite passed; touched-file ESLint and `node --check src/workflows/normalizeWorkflow.js` passed; full Jest passed the workflow suite inside the broader run and still failed only the pre-existing payments safety suite. A read-only local DEV DB smoke built all 13 workflow schemas through `buildWorkflowSchema` with 0 failures.

2. The old simple payments paid path appears to be enabled again.
   - Evidence: `isetadminserver.js` currently has `const SIMPLE_PAYMENT_WORKFLOW = true;`.
   - Existing safety expectation: `paymentsWorkflowSafety.test.js` expects `const SIMPLE_PAYMENT_WORKFLOW = false;`.
   - Likely impact: the backend can allow the legacy paid shortcut instead of forcing the intended payment follow-up and evidence workflow.
   - Follow-up: fixed locally on 2026-05-28 by setting `SIMPLE_PAYMENT_WORKFLOW` back to `false`.
   - Verification: `node --check isetadminserver.js` passed; the targeted `legacy simple paid workflow is disabled` payments safety assertion passed; rollback DEV DB smoke `scripts/payments-workflow-smoke.js` passed and verified a submitted line is created without the legacy paid shortcut plus fixture cleanup.

3. The Payment Detail widget exposes the old `Mark paid` action for submitted packets.
   - Evidence: `src/pages/finance/widgets/PaymentDetailWidget.jsx` computes `canMarkLinePaid` from packet/line state and renders a `Mark paid` button when true.
   - Existing safety expectation: the test expects `const canMarkLinePaid = false;`.
   - Likely impact: staff may bypass the current follow-up-oriented workflow from the UI.
   - Follow-up: fixed locally on 2026-05-28 by setting `canMarkLinePaid` to `false` so the old line-level `Mark paid` button stays hidden while the follow-up workflow remains the supported path.
   - Verification: targeted `old operational Mark paid action is hidden` payments safety assertion passed; touched-file ESLint passed for `PaymentDetailWidget.jsx` and `paymentsWorkflowSafety.test.js`; full payments safety suite now fails only the remaining Financial Reports `PATH follow-up state` assertion.

4. Financial Reports payment-state wording may have drifted from the PATH follow-up model.
   - Evidence: `paymentsWorkflowSafety.test.js` expects `PATH follow-up state`; `src/pages/finance/FinanceReportsPage.jsx` currently labels the column as `Payment status`.
   - Related observation: the default visible detail columns omit `financeFollowUp`, so the payment/follow-up status column is not visible by default.
   - Likely impact: reporting may hide or blur the PATH operational follow-up state that the payments docs say should be explicit.

5. `useWidgetDataLoader` performs duplicate initial loads.
   - Evidence: `src/hooks/useWidgetDataLoader.js` calls `load('auto')` in the mount effect, then the dependency effect also runs on initial mount and calls `load('dep-change')` after `mountedRef.current` is true.
   - Current usage found: `src/widgets/WorkflowListWidget.js`.
   - Likely impact: duplicate initial API traffic and aborted first requests. This is not a steady-state runaway loop, but it fits the recurring request-churn class called out in the browser smoke runbook.

6. NPM local dev scripts are still Windows-shaped in the WSL checkout.
   - Evidence: `package.json` uses `powershell` for `npm run dev`, `set PORT=3001` for `npm start`, and `set ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES=true&&` for `npm run server`.
   - Current WSL guidance instead uses `.vscode/tasks.json` and `docs/guides/wsl-local-development.md` commands with POSIX-style environment variables.
   - Likely impact: developers running the obvious npm scripts in WSL can start the wrong port or miss unsafe local debug route enablement.

## Testing Program Next Step

Use this as a seed backlog for a first "admin console bug swat" slice:

- Fix the failing static/test baseline first: `normalizeWorkflow.js` no-undef and `paymentsWorkflowSafety`.
- Add focused regression tests for unlabeled/content-only workflow components.
- Add or adapt a small browser/network smoke that opens a dashboard/widget using `useWidgetDataLoader` and fails on duplicate/aborted steady-state request churn.
- Promote the existing payment safety suite into the default release preflight once it is green again.
- Normalize WSL npm scripts or document that `.vscode` tasks are the only supported local launcher.
