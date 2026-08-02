# AwenTech Billing Agent

Purpose: generate monthly AwenTech client invoice files from the prior Word invoice, AWS Cost Explorer, and Bank of Canada FX data.

Current scope is file production only. Email sending is intentionally deferred; the NWAC config keeps an SES placeholder for a later phase.

## Command

From `/home/bill/ISET/admin-dashboard`:

```bash
npm run billing:invoice -- --client nwac --month YYYY-MM
```

Example:

```bash
npm run billing:invoice -- --client nwac --month 2026-06
```

Useful options:

- `--dry-run`: performs AWS and FX lookups and prints the calculated amounts without writing invoice files.
- `--force`: overwrites existing generated files for the same client/month.
- `--invoice-date YYYY-MM-DD`: overrides the invoice date; otherwise the command uses today's date.
- `--template /path/to/file.docx`: uses an explicit Word invoice template.
- `--invoice-number N`: overrides the inferred invoice number.
- `--no-pdf`: writes DOCX/audit only and skips Microsoft Word PDF export.

## NWAC Rules

- Archive root: `/mnt/c/Users/Wilson/OneDrive/AwenTech/2. Financial/7. Invoices`
- Output folder: `NWAC/{year}/`
- Invoice number: inferred from the prior invoice DOCX and incremented by 1.
- Word template: inferred from the most recent prior invoice DOCX unless `--template` is passed.
- Monthly licence fee:
  - `2025-11` through `2027-03`: CAD 2,500, shown as the 50% design partner discount.
  - `2027-04` onward: CAD 5,000.
- AWS passthrough:
  - assumes role `arn:aws:iam::468278742295:role/awentech-billing-readonly` through source profile `nwac-prod`;
  - queries AWS Cost Explorer for the billed month;
  - uses `UnblendedCost`, grouped by `RECORD_TYPE`;
  - uses `Usage` only as the client passthrough basis;
  - excludes AWS `Tax` from the client passthrough and records it in the audit file.
- FX:
  - fetches Bank of Canada monthly average USD/CAD from the Valet API group `FX_RATES_MONTHLY`;
  - uses series `FXMUSDCAD`;
  - converts AWS usage USD to CAD using the billed month's monthly average rate.
- Tax:
  - applies GST/QST at `14.975%` to the invoice subtotal.

The command refuses to generate invoices for AWS months still marked `Estimated` unless `--allow-estimated-aws` is passed.

## Outputs

For a successful month, the command writes:

- `Awentech - Invoice - {Month YYYY}.docx`
- `Awentech - Invoice - {Month YYYY}.pdf`
- audit file named *Awentech - Invoice - {Month YYYY} - audit.md*
- `billing-ledger.json` under the client folder

The audit file records the AWS response, usage/tax breakdown, FX source/rate, conversion, tax calculation, output paths, and file hashes.

## Codex Agent Instructions

Create a Codex Agent named `AwenTech Billing Agent` and use these instructions:

```text
You are the AwenTech Billing Agent for the admin-dashboard workspace.

Your job is to generate monthly AwenTech invoice files, not send emails.

When Bill asks for an invoice month, run:

npm run billing:invoice -- --client nwac --month YYYY-MM

Use --dry-run first only when Bill asks to preview or when the month may be incomplete. Do not pass --force unless Bill explicitly asks to regenerate/overwrite an existing invoice.

The command already performs the real AWS Cost Explorer lookup, assumes the dedicated awentech-billing-readonly role through nwac-prod, fetches Bank of Canada monthly USD/CAD FX, generates DOCX/PDF files, and writes the audit file.

After running it, report only the generated file paths, invoice number, total due, and any errors. Do not explain agent theory or ask implementation-preference questions.

Email sending is out of scope. If Bill asks about email automation, treat it as a future SES phase and do not send anything.
```
