# CR-0003 Addendum – Finance Payment Communications & Reporting Enhancements

## 1. Background
Client feedback identified several finance operations that are not yet represented in the CR-0003 Financial Management scaffolding. The addendum captures the outstanding finance/payment communication and reporting workflows so UI scaffolds can be extended accordingly (backend integrations remain out of scope for this phase).

## 2. New Requirements

### 2.1 Payment Communications
1. **Payment Request Submission** – Designated ISET staff submit payment packets (EFT form, invoice, supporting docs) directly to Finance.
2. **Payment Confirmation** – Finance staff respond with proof of payment (e.g., EFT confirmation or bank screenshot).
3. **Document Exchange & Audit Trail** – Both request and confirmation artifacts must be visible in the program for attachment to the client/PTMA record.

### 2.2 Master Budget & GL Visibility
1. NWAC master ISET budget must surface GL designations (admin vs client funds, per PTMA/region).
2. PTMA contribution agreements/workplans must be viewable with admin/client splits and current commitments.
3. Real-time tracking of committed vs remaining funds per region/PTMA with quick insight into underspend/overspend.

### 2.3 Fund Reallocation Support
1. Finance must identify when a PTMA/region reaches full commitment and trigger a top-up.
2. Ability to draft transfers of additional funds to PTMA/regions and monitor approvals.

### 2.4 Reporting Outputs
1. Generate individual client reports (application steps, communications, funding history, documents).
2. Produce PTMA/Regional summaries (budget vs committed vs spent vs outstanding).
3. Support on-demand/scheduled monthly, quarterly, and annual report bundles for NWAC/PTMA/funder distribution.

## 3. Scaffolding Changes (UI Only)

### 3.1 Payments Workspace (New Dashboard)
Create `FinancePaymentsPage.jsx` mirroring other finance boards.

| Widget | Description | Mock Data Source |
| --- | --- | --- |
| Payment Requests Queue | List of incoming payment packets with requester, PTMA, amount, document tags | `PaymentsDataContext.tsx` (new) |
| Payment Detail & Documents | View/download/upload EFT forms, invoices, payment proof; track status | same context |
| Communication Log | Mock email send/confirm log, placeholders for templates and recipients | same context |
| SLA Snapshot | Summary of outstanding payment actions by age/SLA | same context |

Payment board should raise events `financePayments:openPalette` / `financePayments:resetLayout` and follow table persistence patterns.

### 3.2 Budgets / Allocations Enhancements
Add widgets to existing dashboards using shared mock data (`financeDemoData.js`):

- **Regional Commitment Overview** (`BudgetRegionalSummaryWidget.jsx`): table of PTMA/region budget vs committed vs remaining vs admin %.  
- **Top-Up Recommendations** (`AllocationTopUpWidget.jsx`): highlight PTMAs with exhausted funds, offer “Draft transfer” action.
- Update `financeDemoData.js` to include PTMA region metadata and GL codes to back these widgets.

### 3.3 Reports Dashboard Additions
Extend `FinanceReportsPage.jsx`:

| Widget | Purpose |
| --- | --- |
| Client Report Builder | Select client(s), include application steps/communications/funding/documents; expose mock preview |
| Regional/PTMA Summary Builder | Generate regional roll-up (budget vs committed vs spent vs balance) |
| Report Scheduler | Mock list/form for monthly/quarterly/annual runs with recipients |

Each widget must include pagination/settings persistence for tables (`CollectionPreferences`, column width persistence) and per-widget help panel entries.

### 3.4 Settings Dashboard Enhancements
Add widgets under `FinanceSettingsPage.jsx`:

- **GL Mapping Manager** – Manage GL accounts for NWAC master budget pots (read/write mock data).  
- **PTMA Agreement Templates** – Upload/view workplan/budget templates with admin/client splits.  
- **Email Template Manager** – Manage canned messages for payment request and confirmation notifications.  

## 4. Data Context Updates (Mock)
1. Create `PaymentsDataContext.jsx` with seeded payment requests, documents, and statuses.
2. Extend `financeDemoData.js` with:
   - `FINANCE_PTMA_REGIONS` (name, region, GL account, budget figures).
   - Mapping of PTMAs to budgets for the new widgets.
3. Ensure Allocation/Reconciliation contexts reference shared pot metadata (already consolidated in prior change).

## 5. Help & Documentation
1. Add per-widget help files with `aiContext` entries (`financePayments*.js`, `financeRegionalSummaryHelp.js`, etc.).
2. Update `docs/guides/dashboard-scaffolding.md` checklist to mention Payments board once scaffolded.

## 6. Out of Scope (Future Implementation)
- Actual email dispatch or SMTP integration.
- Real document storage/retrieval and EFT validation.
- Live budget math or GL synchronization.
- Backend reporting pipelines.

The addendum ensures the UI scaffolding now mirrors the full finance workflow requested by the client, giving downstream implementation teams clear placeholders for future logic and integrations.
