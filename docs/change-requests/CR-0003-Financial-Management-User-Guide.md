# ISET Financial Management Module – Executive User Guide

_Audience: Program senior management (Executive Directors, Finance Officers, Operations Leads)_  
_Source documents: CR-0003 Functional Requirements, CR-0003 Implementation Log (latest update 2025‑12‑07), CR-0003 Addendum (Payments & Reporting), Finance Enablement Tracker_

---

## 1. Purpose of the Module

The Financial Management module gives agreement holders a single environment to plan, operate, and report on Indigenous Skills & Employment Training (ISET) finances. It connects budgets, reallocations, reconciliation, monitoring, reporting, forecasting, and configuration so senior leadership can:

- Track funding envelopes, program budgets, administrative caps, and burn rate.
- Reallocate funds with full policy checks, approvals, and audit history.
- Resolve transaction exceptions before reporting deadlines.
- Produce interim and year-end submissions with certification and export packages.
- Monitor evidence coverage, capacity-tier obligations, and sampling.
- Project future spend, compare scenarios, and drive proactive actions.
- Configure terminology, hierarchy definitions, approval routes, and mapping rules without redeployment.

The module is being delivered iteratively. This guide summarizes the end-to-end business workflow described in CR‑0003 and reflected in the current scaffolding of the Finance dashboards.

---

## 2. How Senior Management Uses the Module

### Step 1 – Orient with Finance Overview
Start on the **Finance Overview** dashboard to validate high-level health:
- Review headline KPIs (budget vs. spend, admin flat rate, evidence coverage, variance outlook).
- Inspect trend charts for spend vs. forecast.
- Confirm compliance strip items (capacity tier, monitoring dates, open findings).
- Check upcoming deadlines (interim/year-end reports, XML submissions).
Use quick links to drill into Budgets, Allocations, Reconciliation, or Reporting depending on what needs attention.

### Step 2 – Manage Budgets
Move to the **Budgets** dashboard when you need to inspect or maintain the funding structure:
- Toggle between tree and flat views of funding streams, programs, and delivery partners.
- Review approved, adjusted, committed, actual, and forecast balances plus admin attribution.
- Use the Pot Detail panel to inspect history, approvals, evidence, and policy guardrails.
- Saved Views deliver curated perspectives (e.g., by region, by program) and support exports.
- Burn-rate insights highlight overrun/underspend risks.
- The Structure Manager (planned implementation) will allow leaders to:
  - Create or edit pots (including metadata, hierarchy, amounts, policy notes).
  - Stage draft changes, capture snapshots, and publish new structures.
  - Track draft vs. live versions before they feed downstream dashboards.

### Step 3 – Reallocate Funds
Visit **Allocations & Transfers** to move funding between pots with auditability:
- Use the Transfer Wizard to capture source/destination, amount, policy checks, evidence references, and justification.
- Monitor the Pending Approvals queue grouped by stage (Program → Finance → Executive) with SLA indicators.
- Review the Allocation History timeline to answer board or audit enquiries (“before/after” balances).
- Address Policy Exceptions (admin cap, capital restrictions, segregation-of-duties conflicts) before submission.
- Maintain point-in-time Snapshots for governance packages and escalation.

### Step 4 – Reconcile Transaction Exceptions
Use **Reconciliation** to triage transactions ingested from Case Management:
- Work through the Transactions queue filtered by exception type, stream, or status.
- Select an item to open Exception Detail (metadata, proposed reclassification, evidence, action history).
- Apply Bulk Actions to approve, request evidence, or mark non-claimable across similar transactions.
- Monitor Sync Status to ensure ingest feeds remain healthy; trigger manual syncs when needed.

### Step 5 – Prepare Reports
On **Reports**, finance leaders will:
- Generate interim and year-end statements, review variance analyses, and ensure admin flat-rate compliance.
- Address validation findings before certification.
- Capture certification details, lock statements, and generate export artifacts (PDF, CSV, XML).
- Track submission acknowledgements and telemetry (`agreement_id`, `report_id`, `validation_status`).
(Dashboard scaffolding is pending; requirements are defined in CR‑0003 §10.8.)

### Step 6 – Monitor Evidence & Compliance
Use **Monitoring & Evidence** to satisfy capacity-tier obligations:
- Track evidence coverage, manage sampling sets, and build evidence bundles for audits.
- Log findings, resolutions, and status updates for internal or ESDC monitoring.
(Dashboard scaffolding is pending; requirements in CR‑0003 §10.9.)

### Step 7 – Forecast & Run Scenarios
Visit **Forecasting & Scenarios** for proactive management:
- Compare planned vs. actual vs. forecasted spend across pots and time horizons.
- Adjust forecasts manually or via automated suggestions.
- Model scenario reallocations, assess admin percentage impact, and promote approved scenarios into Allocations.
(Dashboard scaffolding is pending; requirements in CR‑0003 §20.)

### Step 8 – Configure Policies & Terminology
Use **Finance Settings** to tailor the experience to each agreement holder:
- Toggle simple vs. advanced mode.
- Define the budget hierarchy, terminology, approval thresholds, and routing rules.
- Maintain category-to-pot mapping rules for reconciliation.
- Manage reporting cadence, due-date reminders, and role visibility.
(Dashboard scaffolding is pending; requirements in CR‑0003 §10.10.)

---

## 3. Current Delivery Status (2025‑12‑07)

| Area | Status | Notes |
|------|--------|-------|
| Navigation & Access Control | Delivered | Finance section routes, guards, and role matrix entries in place. |
| Finance Overview | Delivered | Configurable board with KPIs, trend, compliance, deadlines, help text. |
| Budgets | Delivered | Configurable board with live pot API (CRUD, draft/publish, snapshots), saved views, burn rate, active view; CSV export; structure manager edits drafts. |
| Allocations & Transfers | Scaffolded | Transfer wizard, approvals queue, history, policy exceptions, snapshots using mock data; live wiring pending. |
| Reconciliation | Scaffolded | Transactions queue, exception detail, bulk actions, sync status using mock data; live transaction/evidence wiring pending. |
| Reports | Planned | Requirements documented; dashboard scaffolding still pending. |
| Monitoring & Evidence | Planned | Requirements documented; dashboard scaffolding still pending. |
| Forecasting & Scenarios | Planned | Requirements documented (CR-0003 §20). |
| Finance Payments | Scaffolded | Payments board per addendum (queue, detail, comms, SLA) on mock data; services not wired. |
| Finance Settings | Planned | Configuration requirements documented; dashboard scaffold pending. |
| Configurable dashboard conventions | Delivered | Guidance captured in `docs/guides/cloudscape-table-persistence.md`; applies to all finance boards. |

See `CR-0003-Implementation-Log.md` for detailed sprint history and open tasks.

---

## 4. Key Takeaways for Senior Management

1. **Central Visibility:** The module provides a unified financial command center—begin with Finance Overview, then drill into Budgets, Allocations, Reconciliation, and Reporting workflows as required.
2. **Audit-Ready Operations:** Every adjustment, reallocation, and exception resolution is designed to carry policy checks, approval routing, evidence references, and snapshot history.
3. **Plan → Operate → Report Cycle:** The workflow mirrors the ISET lifecycle—plan budgets, reallocate responsibly, reconcile daily operations, certify reports, monitor compliance, and forecast future scenarios.
4. **Configuration without Redeploys:** Finance Settings will let administrators adapt hierarchy, terminology, approvals, and mapping rules directly—keeping the module aligned with evolving agreements.
5. **Iterative Delivery:** Allocations, Reconciliation, and Payments boards are scaffolded with mock data and persistence patterns now; Reporting, Monitoring, Forecasting, and Settings dashboards will follow the same pattern with real integrations as backend services land.

Use this guide alongside the CR‑0003 documentation for deeper functional details. Future iterations will extend the manual with step-by-step procedures for each dashboard and widget once their workflows move from scaffold to production data.
