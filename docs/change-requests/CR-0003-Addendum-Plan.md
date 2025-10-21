# CR-0003 Addendum Planning Notes

_Scope: scaffolding-only implementation using dummy data (no live services)_

## 1. Context Snapshot
- Base finance dashboards (Overview, Budgets, Allocations, Reconciliation, Monitoring, Forecasting, Reports) now reference the updated NWAC + PTMA pot hierarchy seeded in `financeDemoData.js`.
- Existing functionality supports configurable boards, table persistence, and mock data contexts only; no backend API wiring or notifications are in play yet.

## 2. Addendum Workstream Checklist

### 2.1 Payments Workspace (New Dashboard)
- [x] Create `FinancePaymentsPage.jsx` board with palette/reset events (`financePayments:*`).
- [x] Scaffold widgets:
  - Payment Requests Queue (table with persistence).
  - Payment Detail & Documents (board item for EFT packets, status, uploads).
  - Communication Log (mock email history).
  - SLA Snapshot (metric cards).
- [x] Seed `PaymentsDataContext.jsx` with dummy packets, documents, SLA calculations.

### 2.2 Budgets & Allocations Enhancements
- [ ] Regional commitment overview widget (PTMA admin/client metrics, GL snippet).
- [ ] Top-up recommendations widget (actions to open Allocations wizard prefilled).
- [ ] Reuse `financeDemoData.js` metadata; extend if additional regional stats are needed.

### 2.3 Reports Dashboard Enhancements
- [ ] Client Report Builder widget (select client(s), choose sections, mock preview).
- [ ] Regional/PTMA Summary Builder widget (budget vs committed vs spent vs balance).
- [ ] Report Scheduler widget (mock schedule list/form).
- [ ] Wire up persistence (column widths, `CollectionPreferences`) to match other tables.
- [ ] Add help panel entries with `aiContext`.

### 2.4 Settings Dashboard Enhancements
- [ ] GL Mapping Manager (table/editor for pot → GL account).
- [ ] PTMA Agreement Templates manager (list uploads, metadata).
- [ ] Email Template Manager (for payment request/confirmation).
- [ ] Ensure widgets consume the same dummy data and expose CRUD-like scaffolds without real saves.

## 3. Shared Tasks & Dependencies
- [x] Update `docs/guides/dashboard-scaffolding.md` once Payments board is in place.
- Maintain consistency of mock IDs across contexts (Budgets, Allocations, Monitoring, Reports, new Payments data).
- Add help-panel components for every new widget/page to keep AI assistant context aligned.
- No notification/email dispatch will be implemented—use placeholder actions/log entries only.

## 4. Open Questions / To Confirm
- Required fields for payment packets (EFT, invoice, approval references) — confirm formatting before final mock.
- Whether regional summary should respect saved view filters or operate independently per widget.
- Preferred naming convention for settings widgets (`FinanceSettingsGLMappingWidget.jsx` etc.).
