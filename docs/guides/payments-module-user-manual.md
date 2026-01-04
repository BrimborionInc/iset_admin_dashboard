# Payments Module User Manual

Purpose: Provide a plain-language guide for using the Payments module dashboards from end to end, including verification, proof-of-payment, overrides, and ledger exports.  
Audience: Program staff, Finance staff, approvers, and admin operators.  
Last Updated: 2026-01-24

## 1) Introduction (for new users)
The Payments module is where payment requests are created, reviewed, approved, and confirmed. A request starts as a **payment packet** and moves through program and finance review with evidence attached at each step. The goal is to ensure payments are compliant, auditable, and easy to report.

You will use two dashboards:
- **Program Payments** (`/iset/payments`) to create packets, attach evidence, and submit to Finance.
- **Finance Payments** (`/finance/payments`) to review, batch, send, and confirm payments.

## 2) Key concepts
- **Payment packet**: A workflow container for one or more payment lines.
- **Payment line**: One payable item (e.g., living allowance for a month, tuition invoice).
- **Evidence**: Documents required to justify payment (e.g., invoices, attendance reports).
- **Batch**: A group of approved lines for EFT processing.
- **Confirmation**: Proof that the payment was sent and recorded.

## 3) Roles and access (high level)
Access is role-based. If you do not see a button or action, your role likely does not allow it.
- **Program users** create and submit packets, and upload evidence.
- **Finance users** review, batch, mark paid, and confirm.
- **Maker-checker** is enforced: the user who requested a payment cannot finance-approve or mark it paid.

## 4) Dashboard overview
### Program Payments (`/iset/payments`)
Widgets:
- **Payment packet queue**: List of packets and filters (Draft, Submitted, Returned, Program Approved).
- **Payment packet detail**: Packet summary, lines, evidence checklist, and status actions.

### Finance Payments (`/finance/payments`)
Widgets:
- **Payment packet queue**: Finance-ready filters (Finance Review, Batching, On Hold, Sent, Confirmed).
- **Payment packet detail**: Full packet workflow with batch and payment actions.
- **Payment communications**: Email log for packets.
- **SLA snapshot**: Counts and turnaround metrics.

## 5) Status lifecycle (packet + line)
Packet statuses (typical path):
Draft → Submitted → Program Review → Program Approved → Finance Review → Finance Approved → Batched → Sent → Confirmed → Closed  
Other paths: Returned, On Hold, Cancelled.

Line statuses (derived):
Needs Evidence → Ready for Program → Ready for Finance → Approved → Batched → Paid  
Other: Held, Cancelled.

Notes:
- Changing the **packet** status updates line status for all non-cancelled lines.
- When all lines are paid, the packet auto-confirms.
- Evidence must be **verified** (not just received) before approvals.

## 6) Program Payments: step-by-step
### A0) Auto-generated packets (from approved interventions)
When an intervention is approved, the system auto-creates a **draft** packet:
- If the intervention has a pot and approved amount, a draft **line** is created.
- If pot or amount is missing, the packet is created **without a line** and flagged in risk flags.

What you should do:
1. Open **Program Payments** and find the packet in the queue.
2. Add or edit the payment line to confirm payee, amount, pot, and service period.
3. Upload evidence and move through program review.

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

### B) Add or edit lines (Draft or Returned only)
1. Select the packet in the queue.
2. In **Payment packet detail**, use **Add line** or **Edit selected**.
3. Save changes.

### C) Upload evidence
1. Open **Evidence checklist**.
2. Click **Upload evidence**.
3. Select whether the evidence is **baseline** (packet) or a **specific line**.
4. Choose an evidence type and upload the file.
5. Note: Uploading sets evidence to **Received**. Finance must **Verify** before approvals.

### D) Submit to Finance
1. Use **Update status** to move the packet to **Program Review** and then **Program Approved**.
2. Click **Send to finance** (sends an email to the configured finance address).
3. Move the packet to **Finance Review** when ready.

## 7) Finance Payments: step-by-step
### A) Review packets
1. Filter the queue to **Ready for finance review**.
2. Select a packet and review the details:
   - Evidence checklist
   - Duplicate warnings
   - Funding caps or policy warnings

### B) Approve for batching
1. Use **Update status** to set **Finance Approved** when ready.
2. In the line table, select approved lines.
3. Click **Create batch**.
4. Click **Approve batch**.
5. Click **Export batch CSV** for EFT processing.

### C) Mark paid and confirm
1. Select a batched line.
2. Click **Mark paid** and enter:
   - Paid date
   - Payment reference (required)
   - Proof-of-payment file (required)
3. When all lines are paid, the packet auto-confirms.
4. Use **Mark confirmed** if needed after payment is sent.

## 8) Communications log (email)
Use **Payment communications** to:
- See outbound/inbound email logs per packet.
- Log a manual email if a message was sent outside the system.

## 9) Notes & requests (internal)
Use **Notes & requests** in the packet detail view to:
- Record clarifications between Program and Finance.
- Track follow-ups that are not part of the email log.

## 10) SLA snapshot
The SLA widget summarizes:
- Ready for finance review
- Ready for batching
- On hold
- Sent awaiting confirmation
- Confirmed / closed
- Overdue evidence tasks
- Average turnaround time

Use this to spot bottlenecks and overdue evidence.

## 11) Evidence and compliance rules (practical)
Evidence gates are enforced when approving for Program or Finance. Evidence must be **verified**. Common requirements include:
- **Baseline**: signed client application, funding agreement, case manager assessment, identity documents, band funding confirmation/denial.
- **Living allowance**: attendance report, financial overview, income/expense verification.
- **Tuition**: invoice or statement of account.
- **Specialized equipment**: institution letter + quote (advance), receipt after payment.
- **TWS (wage subsidy)**: employer letters and subsidy documents.

If required evidence is missing, approval is blocked.

## 12) Overrides (when blocked)
Some actions are gated (missing evidence, duplicates, or approval thresholds). If you have override permissions:
1. Attempt the action.
2. Enter a clear **override reason** in the modal.
3. Submit to proceed and log the override for audit.

## 13) Configuration (admin)
### Finance email routing
Configure finance recipients per province/territory:
- Go to **Finance Settings** (`/finance/settings`).
- Update **Finance email routing**.

Routing uses:
1) Packet reporting unit, then  
2) Case region, then  
3) Client address province.

### Evidence and approval rules
Evidence rules, approval thresholds, and policy caps are configured by admins (runtime config).

## 14) Reporting export (Annual Report ledger extract)
Finance users can export the ledger extract required for Annual Reporting:
1. Open **Finance Payments**.
2. Click **Export ledger** in the queue header.
3. Save the CSV file (includes transaction ID, posting date, pot, reporting unit, evidence IDs).

## 15) Troubleshooting
- **No packets in the queue**: Use the status filter or create a new packet in Program Payments.
- **Cannot approve**: Check evidence checklist, funding caps, duplicate warnings, or EI eligibility blocks.
- **Cannot mark paid**: Line must be **batched** and the batch **approved**.
- **Email send failed**: Finance routing not configured or email provider not available.
- **Evidence upload error**: Case or applicant context is missing, or the file type/size is invalid.

## 16) Testing script (manual)
Run this in order as a full end-to-end check.

Prerequisites:
- Migration `sql/20260124_add_payment_packet_communication_body.sql` applied.
- Backend restarted after the migration.
- Finance email routing configured (optional for email tests).

Test steps:
1. **Trigger auto packet**: Approve an intervention in the case workspace.
   - Expected: A new draft packet appears in **Program Payments**. If pot/amount exist, a draft line is present.
2. **Program edits**: Open the packet, add or edit the line to confirm payment type, payee, amount, pot, and service period.
   - Expected: Line saves with updated values and evidence checklist updates.
3. **Evidence upload**: Upload baseline and line evidence.
   - Expected: Evidence shows as **Received** and listed in the checklist.
4. **Program approval**: Move the packet to **Program Approved**.
   - Expected: If evidence is not verified, approval is blocked and an override modal appears.
5. **Finance verification**: In **Finance Payments**, verify required evidence.
   - Expected: Evidence status changes to **Verified** and approvals can proceed.
6. **Finance approval & batching**: Set **Finance Approved**, select lines, create batch, approve batch, export batch CSV.
   - Expected: Batch status updates and CSV downloads.
7. **Mark paid with proof**: Mark the line paid and upload proof-of-payment.
   - Expected: Paid status saved; proof document recorded; packet auto-confirms when all lines are paid.
8. **Override path** (optional): Try approving with missing evidence or a duplicate warning.
   - Expected: Override modal appears; entering a reason allows the action if role permits.
9. **Internal notes**: Add a note in **Notes & requests**.
   - Expected: Note appears with timestamp and sender.
10. **Ledger export**: Click **Export ledger** in Finance Payments.
   - Expected: CSV downloads with transaction ID, posting date, amount, pot, funding stream, intervention ID, reporting unit, evidence doc IDs.

Record any failures with packet ID, line ID, and the exact error message.
