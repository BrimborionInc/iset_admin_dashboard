# Payments Module User Manual

Purpose: Provide a plain-language guide for using the Payments module dashboards from draft through sending to Finance (email).  
Audience: Program staff and admin operators; Finance receives emailed payment requests (no sign-in).  
Last Updated: 2026-04-06

## 1) Introduction (for new users)
The Payments module is where payment requests are created and sent to Finance by email. A request starts as a **payment packet** with one or more payment lines; evidence must be attached before it can be sent. The goal is to ensure requests are compliant, auditable, and easy to report.

You will primarily use:
- **Program Payments** (`/iset/payments`) to create packets, attach evidence, and send requests to Finance.
- **Finance Payments** (`/finance/payments`) is optional for internal oversight; Finance does not sign in.

## 2) Key concepts
- **Payment packet**: A workflow container for one or more payment lines.
- **Payment line**: One payable item (e.g., living allowance for a month, tuition invoice).
- **Evidence**: Documents required to justify payment (e.g., invoices, attendance reports).
- **Batch**: Optional internal finance grouping of already-submitted lines.
- **Confirmation**: Recording in PATH that payment was completed.

## 3) Roles and access (high level)
Access is role-based. If you do not see a button or action, your role likely does not allow it.
- **Program users** create packets, upload evidence, and send requests to Finance.
- **Finance** receives the payment email and processes payment outside the admin system.
- **Admins** configure finance email routing and evidence rules.

## 4) Dashboard overview
### Program Payments (`/iset/payments`)
Widgets:
- **Payment packet queue**: List of packets and filters (`Draft`, `Ready to send`, `Sent to finance`).
- **Payment packet detail**: Packet lines, evidence checklist, send action, and an Intacct XML (Draft) preview tab.

### Finance Payments (`/finance/payments`)
Widgets:
- **Payment packet queue**: Draft, sent, and confirmed filters for oversight.
- **Payment packet detail**: Read-only view of lines, evidence, and the Intacct XML (Draft) preview tab.
- **Payment communications**: Email log for sent packets.
- **SLA snapshot**: Drafts needing evidence and sent-packet age metrics.

## 5) Status lifecycle (packet + line)
Packet statuses (typical path):
Draft -> Ready to send -> Sent to finance -> Payment confirmed  
Other paths: Cancelled.

Line statuses (derived):
Needs evidence -> Ready to send -> Sent to finance -> Paid  
Other: Held, Cancelled.

Notes:
- Changing the **packet** status updates line status for all non-cancelled lines.
- Evidence must be **received** before a packet can be sent.

## 6) Program Payments: step-by-step
### A0) Approved funding is not a payment packet
Approving an intervention does **not** create a payment packet automatically.

Use the approved intervention amount as the funding ceiling, then create packets only when a specific month, receipt, invoice, or claim period is actually ready to send to Finance.

Examples:
- `Erica - Mileage Jan`
- `Erica - Mileage Feb`
- `Erica - Mileage Mar`
- `Erica - Mileage Apr`

This keeps evidence, claim amounts, and fiscal-year reporting clean. Historical `manual_backload` interventions remain finance-history only and cannot create live payment packets.

### A) Create a payment packet
1. Go to **Program Payments**.
2. In **Payment packet queue**, click **Create packet**.
3. Search and select the **case**.
4. Select an **intervention** (optional but recommended).
5. Choose a **reporting unit** (optional) and **due by** date (optional).
6. Fill the **initial payment line**:
   - Payment type
   - Payee type + payee name
   - Amount
   - Budget pot
   - Service period (required only when the payment type recurrence policy is set to **Required**)
7. Click **Create packet**.

### B) Add or edit lines (Draft only)
1. Select the packet in the queue.
2. In **Payment packet detail**, use **Add line** or **Edit selected**.
3. Save changes.

### C) Upload evidence
1. Open **Evidence checklist**.
2. Click **Upload evidence**.
3. Select whether the evidence is **baseline** (packet) or a **specific line**.
4. Choose an evidence type and upload the file.
5. Note: Uploading sets evidence to **Received**. Sending is blocked until required evidence is received.

### D) Send to Finance
1. Click **Send to finance** once required evidence is received.
2. The system emails the configured finance address and locks edits on the packet.

### E) Intacct XML preview (Draft)
1. Open **Intacct XML (Draft)** in the Payment packet detail tabs.
2. Review the generated AP Bill XML; missing fields are listed and marked as `MISSING_*`.
3. Use **Copy XML** or **Download .xml** for demos.
4. Note: The preview is read-only and is not transmitted to Intacct.

## 7) Finance (email-only)
Finance receives the payment email containing the packet summary, evidence list, and line details. Finance still processes payment outside PATH; PATH is then used to record follow-up such as `Sent to finance` and, when known, `Payment confirmed`.

Main packet statuses shown to staff:
- Draft
- Ready to send
- Sent to finance
- Payment confirmed
- Cancelled

If Sage Intacct integration is enabled, a packet that has been sent may also show `Accepted in Sage Intacct` or `Sage Intacct exceptions`.

## 8) Communications log (email)
Use **Payment communications** to:
- See payment emails sent to finance.
- Log a manual email if a message was sent outside the system.

Notes:
- The system only auto-logs payment emails; there is no inbound sync.

## 9) Notes & requests (internal)
Use **Notes & requests** in the packet detail view to:
- Record clarifications between Program and Finance.
- Track follow-ups that are not part of the email log.

## 10) SLA snapshot
The SLA widget summarizes:
- Drafts needing evidence
- Sent to finance
- Overdue evidence tasks
- Average submission age (days)

Use this to spot evidence gaps and stalled sends.

## 11) Evidence and compliance rules (practical)
Evidence gates are enforced when sending a packet to finance. Evidence must be **received**. Common requirements include:
- **Baseline**: signed client application, funding agreement, case manager assessment, identity documents, band funding confirmation/denial.
- **Living allowance**: attendance report, financial overview, income/expense verification, and a service period that still falls inside the living-allowance backdating window when the packet is sent to finance (default `60` days from period end).
- **Tuition**: invoice or statement of account.
- **Specialized equipment**: institution letter + quote (advance), receipt after payment (if required by policy).
- **TWS (wage subsidy)**: employer letters and subsidy documents.

If required evidence is missing, sending is blocked.

## 12) When sending is blocked (no overrides)
This workflow has no overrides. To send a packet, you must:
- Upload the required evidence, or
- Adjust the line/payment type so the evidence rules match, or
- Resolve funding authorization issues on the intervention.

## 13) Configuration (admin)
### Finance email routing
Configure finance recipients per province/territory:
- Go to **Finance Settings** (`/finance/settings`).
- Update **Finance email routing**.

Routing uses:
1) Packet reporting unit, then  
2) Case region, then  
3) Client address province.

### Evidence and payment type rules
Evidence rules, payment type mappings, and policy caps are configured by admins (runtime config).
- In **Finance Settings -> Payment type mapping**, each payment type now has a **Required evidence** multi-select.
- The same screen also sets each payment type **Recurrence policy**: `Not allowed`, `Allowed (optional)`, or `Required`.
- Changes save to runtime config and are enforced on payment-line evidence checks.

## 14) Reporting export (Annual Report ledger extract)
Staff can export the ledger extract required for Annual Reporting (if enabled):
1. Open **Finance Payments**.
2. Click **Export ledger** in the queue header.
3. Save the CSV file (includes transaction ID, posting date, pot, reporting unit, evidence IDs).

## 15) Troubleshooting
- **No packets in the queue**: Use the status filter or create a new packet in Program Payments.
- **Cannot send**: Check evidence checklist, funding caps, or payment-type policy violations.
- **Email send failed**: Finance routing not configured or email provider not available.
- **Packet locked**: The packet has already been sent to finance; edits are not allowed.
- **Evidence upload error**: Case or applicant context is missing, or the file type/size is invalid.

## 16) Testing script (manual)
Run this in order as a full end-to-end check.

Prerequisites:
- Finance email routing configured (optional for email tests).

Test steps:
1. **Create packet manually**: Open **Program Payments** and create a packet against an approved intervention.
   - Expected: A new draft packet appears in **Program Payments** with the initial line you entered.
2. **Program edits**: Open the packet, add or edit lines to confirm payment type, payee, amount, pot, and service period.
   - Expected: Line saves with updated values and evidence checklist updates.
3. **Evidence upload**: Upload baseline and line evidence.
   - Expected: Evidence shows as **Received** and listed in the checklist.
4. **Validate and mark ready**: Validate the packet, then mark it ready to send.
   - Expected: Validation passes and the packet moves to `Ready to send`.
5. **Send to finance**: Click **Send to finance**.
   - Expected: Status changes to `Sent to finance`, an email log entry is created, and the packet locks.
6. **Record payment**: Mark one line as paid or confirm the packet through the finance follow-up flow.
   - Expected: Paid lines update finance transactions; once all lines are paid, the packet moves to `Payment confirmed`.
7. **Queue/SLA check**: Confirm the queue and SLA snapshot reflect the send.
   - Expected: Draft counts drop; sent-to-finance counts increase.
8. **Internal notes**: Add a note in **Notes & requests**.
   - Expected: Note appears with timestamp and sender.
9. **Ledger export** (optional): Click **Export ledger** in Finance Payments.
   - Expected: CSV downloads with transaction ID, posting date, amount, pot, funding stream, intervention ID, reporting unit, evidence doc IDs.

Record any failures with packet ID, line ID, and the exact error message.
