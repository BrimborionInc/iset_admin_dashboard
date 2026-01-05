# Payments Module User Manual

Purpose: Provide a plain-language guide for using the Payments module dashboards from draft through submission to Finance (email).  
Audience: Program staff and admin operators; Finance receives email submissions (no sign-in).  
Last Updated: 2026-01-04

## 1) Introduction (for new users)
The Payments module is where payment requests are created and submitted to Finance by email. A request starts as a **payment packet** with one or more payment lines; evidence must be attached before submission. The goal is to ensure submissions are compliant, auditable, and easy to report.

You will primarily use:
- **Program Payments** (`/iset/payments`) to create packets, attach evidence, and submit to Finance.
- **Finance Payments** (`/finance/payments`) is optional for internal oversight; Finance does not sign in.

## 2) Key concepts
- **Payment packet**: A workflow container for one or more payment lines.
- **Payment line**: One payable item (e.g., living allowance for a month, tuition invoice).
- **Evidence**: Documents required to justify payment (e.g., invoices, attendance reports).
- **Batch (future)**: A group of lines for EFT processing.
- **Confirmation (future)**: Proof that the payment was sent and recorded.

## 3) Roles and access (high level)
Access is role-based. If you do not see a button or action, your role likely does not allow it.
- **Program users** create packets, upload evidence, and submit to Finance.
- **Finance** receives the submission email and processes payment outside the admin system.
- **Admins** configure finance email routing and evidence rules.

## 4) Dashboard overview
### Program Payments (`/iset/payments`)
Widgets:
- **Payment packet queue**: List of packets and filters (Draft, Submitted to Finance).
- **Payment packet detail**: Packet lines, evidence checklist, and submit action.

### Finance Payments (`/finance/payments`)
Widgets:
- **Payment packet queue**: Draft vs submitted filters for oversight.
- **Payment packet detail**: Read-only view of lines and evidence.
- **Payment communications**: Email log for submissions.
- **SLA snapshot**: Drafts needing evidence and submission age metrics.

## 5) Status lifecycle (packet + line)
Packet statuses (typical path):
Draft -> Submitted  
Other paths: Cancelled.

Line statuses (derived):
Needs Evidence -> Ready to Submit -> Submitted  
Other: Cancelled.

Notes:
- Changing the **packet** status updates line status for all non-cancelled lines.
- Evidence must be **received** before submission.

## 6) Program Payments: step-by-step
### A0) Auto-generated packets (from initial approval)
When the initial intervention is created from an approved assessment, the system auto-creates a **draft** packet. The same happens later if an intervention is approved:
- If the intervention has a pot and approved amount, a draft **line** is created.
- If pot or amount is missing, the packet is created **without a line** and flagged in risk flags.

What you should do:
1. Open **Program Payments** and find the packet in the queue.
2. Add or edit the payment line to confirm payee, amount, pot, and service period.
3. Upload evidence and submit to Finance.

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
   - Service period (required for Living Allowance and Wage Subsidy)
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
5. Note: Uploading sets evidence to **Received**. Submission is blocked until required evidence is received.

### D) Submit to Finance
1. Click **Submit to finance** once required evidence is received.
2. The system emails the configured finance address and locks edits on the packet.

## 7) Finance (email-only)
Finance receives the submission email containing the packet summary, evidence list, and line details. No in-app review or confirmation steps are required.

## 8) Communications log (email)
Use **Payment communications** to:
- See submission emails sent to finance.
- Log a manual email if a message was sent outside the system.

Notes:
- The system only auto-logs submission emails; there is no inbound sync.

## 9) Notes & requests (internal)
Use **Notes & requests** in the packet detail view to:
- Record clarifications between Program and Finance.
- Track follow-ups that are not part of the email log.

## 10) SLA snapshot
The SLA widget summarizes:
- Drafts needing evidence
- Submitted to finance
- Overdue evidence tasks
- Average submission age (days)

Use this to spot evidence gaps and stalled submissions.

## 11) Evidence and compliance rules (practical)
Evidence gates are enforced when submitting. Evidence must be **received**. Common requirements include:
- **Baseline**: signed client application, funding agreement, case manager assessment, identity documents, band funding confirmation/denial.
- **Living allowance**: attendance report, financial overview, income/expense verification.
- **Tuition**: invoice or statement of account.
- **Specialized equipment**: institution letter + quote (advance), receipt after payment (if required by policy).
- **TWS (wage subsidy)**: employer letters and subsidy documents.

If required evidence is missing, submission is blocked.

## 12) When submission is blocked (no overrides)
This workflow has no overrides. To submit, you must:
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

## 14) Reporting export (Annual Report ledger extract)
Staff can export the ledger extract required for Annual Reporting (if enabled):
1. Open **Finance Payments**.
2. Click **Export ledger** in the queue header.
3. Save the CSV file (includes transaction ID, posting date, pot, reporting unit, evidence IDs).

## 15) Troubleshooting
- **No packets in the queue**: Use the status filter or create a new packet in Program Payments.
- **Cannot submit**: Check evidence checklist, funding caps, or payment-type policy violations.
- **Email send failed**: Finance routing not configured or email provider not available.
- **Packet locked**: The packet is already submitted; edits are not allowed.
- **Evidence upload error**: Case or applicant context is missing, or the file type/size is invalid.

## 16) Testing script (manual)
Run this in order as a full end-to-end check.

Prerequisites:
- Finance email routing configured (optional for email tests).

Test steps:
1. **Trigger auto packet**: Approve an intervention in the case workspace.
   - Expected: A new draft packet appears in **Program Payments**. If pot/amount exist, a draft line is present.
2. **Program edits**: Open the packet, add or edit the line to confirm payment type, payee, amount, pot, and service period.
   - Expected: Line saves with updated values and evidence checklist updates.
3. **Evidence upload**: Upload baseline and line evidence.
   - Expected: Evidence shows as **Received** and listed in the checklist.
4. **Submit to finance**: Click **Submit to finance**.
   - Expected: Status changes to Submitted, email log entry created, and the packet locks.
5. **Queue/SLA check**: Confirm the queue and SLA snapshot reflect the submission.
   - Expected: Draft counts drop; submitted counts increase.
6. **Internal notes**: Add a note in **Notes & requests**.
   - Expected: Note appears with timestamp and sender.
7. **Ledger export** (optional): Click **Export ledger** in Finance Payments.
   - Expected: CSV downloads with transaction ID, posting date, amount, pot, funding stream, intervention ID, reporting unit, evidence doc IDs.

Record any failures with packet ID, line ID, and the exact error message.
