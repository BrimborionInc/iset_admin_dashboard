#!/usr/bin/env python3
"""Generate AwenTech client invoices from AWS billing and Bank of Canada FX data."""

from __future__ import annotations

import argparse
import calendar
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


REPO_ROOT = Path(__file__).resolve().parents[1]
CONFIG_ROOT = REPO_ROOT / "config" / "billing" / "clients"
WORD_NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
MONTH_NAMES = {
    name.lower(): index
    for index, name in enumerate(calendar.month_name)
    if name
}
MONEY = Decimal("0.01")


@dataclass(frozen=True, order=True)
class BillingMonth:
    year: int
    month: int

    @property
    def value(self) -> str:
        return f"{self.year:04d}-{self.month:02d}"

    @property
    def label(self) -> str:
        return f"{calendar.month_name[self.month]} {self.year}"

    @property
    def start_date(self) -> str:
        return f"{self.value}-01"

    @property
    def end_date(self) -> str:
        year = self.year
        month = self.month + 1
        if month == 13:
            year += 1
            month = 1
        return f"{year:04d}-{month:02d}-01"

    @property
    def month_end_date(self) -> str:
        day = calendar.monthrange(self.year, self.month)[1]
        return f"{self.year:04d}-{self.month:02d}-{day:02d}"

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate an AwenTech billing invoice.")
    parser.add_argument("--client", required=True, help="Billing client id, for example nwac.")
    parser.add_argument("--month", required=True, help="Billing month in YYYY-MM format.")
    parser.add_argument("--invoice-date", help="Invoice date in YYYY-MM-DD format. Defaults to today.")
    parser.add_argument("--template", help="Explicit DOCX template path. Defaults to the previous invoice.")
    parser.add_argument("--output-root", help="Override the configured invoice archive root.")
    parser.add_argument("--invoice-number", type=int, help="Override the inferred invoice number.")
    parser.add_argument("--force", action="store_true", help="Overwrite generated files if they already exist.")
    parser.add_argument("--dry-run", action="store_true", help="Run lookups and calculations without writing files.")
    parser.add_argument("--allow-estimated-aws", action="store_true", help="Allow Cost Explorer estimated months.")
    parser.add_argument("--no-pdf", action="store_true", help="Generate DOCX and audit only.")
    return parser.parse_args()


def load_config(client_id: str) -> dict[str, Any]:
    config_path = CONFIG_ROOT / f"{client_id}.json"
    if not config_path.exists():
        raise RuntimeError(f"Unknown billing client '{client_id}'. Missing {config_path}.")
    with config_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_billing_month(value: str) -> BillingMonth:
    if not re.fullmatch(r"\d{4}-\d{2}", value or ""):
        raise RuntimeError("--month must be in YYYY-MM format.")
    year_text, month_text = value.split("-")
    year = int(year_text)
    month = int(month_text)
    if month < 1 or month > 12:
        raise RuntimeError("--month must contain a month from 01 to 12.")
    return BillingMonth(year, month)


def parse_invoice_date(value: str | None) -> date:
    if not value:
        return date.today()
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise RuntimeError("--invoice-date must be in YYYY-MM-DD format.") from exc


def ordinal_suffix(day: int) -> str:
    if 10 <= day % 100 <= 20:
        return "th"
    return {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")


def money(value: Decimal | str | int | float) -> Decimal:
    return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)


def money_text(value: Decimal | str | int | float) -> str:
    return f"{money(value):,.2f}"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run_json(command: list[str], env: dict[str, str] | None = None) -> dict[str, Any]:
    try:
        output = subprocess.check_output(command, stderr=subprocess.PIPE, text=True, env=env)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Required command not found: {command[0]}") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.output or "").strip()
        raise RuntimeError(f"Command failed: {' '.join(command)}\n{detail}") from exc
    return json.loads(output)


def assume_billing_role(config: dict[str, Any]) -> dict[str, str]:
    aws_config = config["aws"]
    result = run_json(
        [
            "aws",
            "sts",
            "assume-role",
            "--profile",
            aws_config["sourceProfile"],
            "--role-arn",
            aws_config["billingRoleArn"],
            "--role-session-name",
            "awentech-billing-invoice",
            "--output",
            "json",
        ]
    )
    credentials = result["Credentials"]
    env = os.environ.copy()
    env.update(
        {
            "AWS_ACCESS_KEY_ID": credentials["AccessKeyId"],
            "AWS_SECRET_ACCESS_KEY": credentials["SecretAccessKey"],
            "AWS_SESSION_TOKEN": credentials["SessionToken"],
            "AWS_REGION": "us-east-1",
        }
    )
    return env


def fetch_aws_cost(config: dict[str, Any], billing_month: BillingMonth) -> dict[str, Any]:
    aws_config = config["aws"]
    env = assume_billing_role(config)
    return run_json(
        [
            "aws",
            "ce",
            "get-cost-and-usage",
            "--time-period",
            f"Start={billing_month.start_date},End={billing_month.end_date}",
            "--granularity",
            "MONTHLY",
            "--metrics",
            aws_config.get("metric", "UnblendedCost"),
            "--group-by",
            "Type=DIMENSION,Key=RECORD_TYPE",
            "--output",
            "json",
        ],
        env=env,
    )


def parse_aws_cost(config: dict[str, Any], response: dict[str, Any]) -> dict[str, Any]:
    metric = config["aws"].get("metric", "UnblendedCost")
    row = (response.get("ResultsByTime") or [{}])[0]
    groups = row.get("Groups") or []
    by_record_type: dict[str, Decimal] = {}
    unit = "USD"
    for group in groups:
        key = (group.get("Keys") or [""])[0]
        metric_value = group.get("Metrics", {}).get(metric, {})
        by_record_type[key] = Decimal(str(metric_value.get("Amount", "0")))
        unit = metric_value.get("Unit", unit)
    passthrough_type = config["aws"].get("passthroughRecordType", "Usage")
    passthrough_usd = by_record_type.get(passthrough_type, Decimal("0"))
    total_usd = sum(by_record_type.values(), Decimal("0"))
    return {
        "estimated": bool(row.get("Estimated")),
        "unit": unit,
        "recordTypes": {key: str(value) for key, value in sorted(by_record_type.items())},
        "passthroughRecordType": passthrough_type,
        "passthroughUsd": passthrough_usd,
        "totalUsd": total_usd,
    }


def fetch_monthly_fx_rate(config: dict[str, Any], billing_month: BillingMonth) -> dict[str, Any]:
    fx_config = config["fx"]
    query = urllib.parse.urlencode(
        {
            "start_date": billing_month.start_date,
            "end_date": billing_month.month_end_date,
        }
    )
    url = f"{fx_config['valetUrl']}?{query}"
    with urllib.request.urlopen(url, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    series = fx_config.get("series", "FXMUSDCAD")
    observations = data.get("observations") or []
    observation = next((item for item in observations if item.get(series)), None)
    if not observation:
        raise RuntimeError(f"Bank of Canada monthly USD/CAD rate is not available for {billing_month.label}.")
    rate = Decimal(str(observation[series]["v"]))
    return {
        "rate": rate,
        "observationDate": observation["d"],
        "sourceUrl": url,
        "sourcePage": fx_config.get("sourcePage", ""),
        "source": fx_config.get("source", "Bank of Canada"),
        "series": series,
        "groupDescription": data.get("groupDetail", {}).get("description", ""),
    }


def licence_for_month(config: dict[str, Any], billing_month: BillingMonth) -> dict[str, Any]:
    for row in config["billing"]["licenceSchedule"]:
        starts = parse_billing_month(row["effectiveFrom"])
        ends = parse_billing_month(row["effectiveTo"]) if row.get("effectiveTo") else None
        if starts <= billing_month and (ends is None or billing_month <= ends):
            return row
    raise RuntimeError(f"No licence schedule row covers {billing_month.label}.")


def iter_invoice_docx_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return [
        path
        for path in root.rglob("*.docx")
        if "invoice" in path.name.lower() and not path.name.startswith("~$")
    ]


def parse_month_from_invoice_name(path: Path) -> BillingMonth | None:
    match = re.search(r"Invoice\s*-\s*([A-Za-z]+)\s+(\d{4})", path.name, re.IGNORECASE)
    if not match:
        return None
    month = MONTH_NAMES.get(match.group(1).lower())
    if not month:
        return None
    return BillingMonth(int(match.group(2)), month)


def read_docx_text_nodes(path: Path) -> list[str]:
    with zipfile.ZipFile(path, "r") as archive:
        xml = archive.read("word/document.xml")
    root = ET.fromstring(xml)
    return [node.text or "" for node in root.findall(".//w:t", WORD_NS)]


def parse_invoice_number(path: Path) -> int | None:
    try:
        text = "".join(read_docx_text_nodes(path))
    except Exception:
        return None
    match = re.search(r"Invoice\s*#\s*(\d+)", text, re.IGNORECASE)
    return int(match.group(1)) if match else None


def find_previous_invoice(config: dict[str, Any], billing_month: BillingMonth, output_root: Path) -> dict[str, Any]:
    candidates = []
    for path in iter_invoice_docx_files(output_root):
        invoice_month = parse_month_from_invoice_name(path)
        if not invoice_month or not invoice_month < billing_month:
            continue
        invoice_number = parse_invoice_number(path)
        if invoice_number is None:
            continue
        candidates.append(
            {
                "path": path,
                "month": invoice_month,
                "invoiceNumber": invoice_number,
                "mtime": path.stat().st_mtime,
            }
        )
    if not candidates:
        raise RuntimeError(
            "Could not find a prior invoice DOCX to use as the template. "
            "Pass --template /path/to/template.docx for the first run."
        )
    return sorted(candidates, key=lambda item: (item["month"].year, item["month"].month, item["invoiceNumber"], item["mtime"]))[-1]


def find_index(texts: list[str], value: str, start: int = 0) -> int:
    for index in range(start, len(texts)):
        if texts[index] == value:
            return index
    raise RuntimeError(f"Template marker not found: {value!r}")


def find_index_startswith(texts: list[str], value: str, start: int = 0) -> int:
    for index in range(start, len(texts)):
        if texts[index].startswith(value):
            return index
    raise RuntimeError(f"Template marker not found: {value!r}")


def blank_until_marker(texts: list[str], start: int, stop_values: set[str]) -> None:
    for index in range(start, len(texts)):
        if texts[index] in stop_values:
            return
        texts[index] = ""
    raise RuntimeError("Could not find stop marker while updating amount.")


def set_cad_amount_after(texts: list[str], marker_index: int, amount: Decimal, stop_values: set[str]) -> None:
    cad_index = find_index(texts, "CAD ", marker_index)
    amount_index = cad_index + 1
    texts[amount_index] = money_text(amount)
    blank_until_marker(texts, amount_index + 1, stop_values)


def build_updated_text_nodes(
    template_path: Path,
    invoice_date: date,
    invoice_number: int,
    billing_month: BillingMonth,
    licence_line: str,
    hosting_cad: Decimal,
    subtotal_cad: Decimal,
    sales_tax_cad: Decimal,
    total_due_cad: Decimal,
) -> list[str]:
    texts = read_docx_text_nodes(template_path)

    date_index = find_index(texts, "Date: ")
    texts[date_index + 1] = str(invoice_date.day)
    texts[date_index + 2] = ordinal_suffix(invoice_date.day)
    texts[date_index + 4] = calendar.month_name[invoice_date.month]
    texts[date_index + 6] = str(invoice_date.year)
    texts[date_index + 7] = ""

    invoice_index = find_index(texts, "Invoice", date_index)
    hash_index = find_index(texts, " #", invoice_index)
    texts[hash_index + 1] = str(invoice_number)

    billed_month_index = find_index(texts, " in the month of ")
    texts[billed_month_index + 1] = calendar.month_name[billing_month.month]
    texts[billed_month_index + 3] = str(billing_month.year)
    texts[billed_month_index + 4] = ""

    licence_index = find_index_startswith(texts, "$5,000.00", billed_month_index)
    texts[licence_index] = licence_line
    if licence_index + 1 < len(texts) and texts[licence_index + 1].startswith("."):
        texts[licence_index + 1] = ""

    hosting_index = find_index(texts, "Hosting", billed_month_index)
    hosting_dollar_index = find_index(texts, "$", hosting_index)
    texts[hosting_dollar_index + 1] = money_text(hosting_cad)

    set_cad_amount_after(texts, hosting_dollar_index, subtotal_cad, {"Sales Tax "})

    tax_label_index = find_index(texts, "Sales Tax", hosting_dollar_index)
    set_cad_amount_after(texts, tax_label_index, sales_tax_cad, {"TOTAL DUE"})

    total_due_index = find_index(texts, "TOTAL DUE", tax_label_index)
    set_cad_amount_after(texts, total_due_index, total_due_cad, {"Payment Details"})

    return texts


def replace_docx_text_nodes(template_path: Path, output_path: Path, replacement_texts: list[str]) -> None:
    text_node_pattern = re.compile(rb"(<w:t\b[^>]*>)(.*?)(</w:t>)", re.DOTALL)

    with zipfile.ZipFile(template_path, "r") as source:
        document_xml = source.read("word/document.xml")
        count = len(text_node_pattern.findall(document_xml))
        if count != len(replacement_texts):
            raise RuntimeError(
                f"Template text node count changed while generating invoice: {count} != {len(replacement_texts)}"
            )

        current_index = -1

        def replace(match: re.Match[bytes]) -> bytes:
            nonlocal current_index
            current_index += 1
            text = html.escape(replacement_texts[current_index], quote=False).encode("utf-8")
            return match.group(1) + text + match.group(3)

        new_document_xml = text_node_pattern.sub(replace, document_xml)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp_file:
            tmp_path = Path(tmp_file.name)
        try:
            with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as output:
                for item in source.infolist():
                    data = source.read(item.filename)
                    if item.filename == "word/document.xml":
                        data = new_document_xml
                    output.writestr(item, data)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(tmp_path, output_path)
        finally:
            tmp_path.unlink(missing_ok=True)


def wsl_to_windows_path(path: Path) -> str:
    resolved = str(path)
    if resolved.startswith("/mnt/") and len(resolved) > 6:
        drive = resolved[5]
        rest = resolved[7:].replace("/", "\\")
        return f"{drive.upper()}:\\{rest}"
    return resolved


def export_pdf_with_word(docx_path: Path, pdf_path: Path) -> None:
    if not shutil.which("powershell.exe"):
        raise RuntimeError("powershell.exe is required to export the invoice PDF through Microsoft Word.")
    script = f"""
$ErrorActionPreference = "Stop"
$docx = "{wsl_to_windows_path(docx_path)}"
$pdf = "{wsl_to_windows_path(pdf_path)}"
$word = New-Object -ComObject Word.Application
$word.Visible = $false
try {{
  $doc = $word.Documents.Open($docx)
  $doc.SaveAs([ref]$pdf, [ref]17)
  $doc.Close($false)
}} finally {{
  $word.Quit()
}}
Write-Output $pdf
"""
    subprocess.check_call(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])


def write_audit(
    path: Path,
    config: dict[str, Any],
    billing_month: BillingMonth,
    invoice_date: date,
    invoice_number: int,
    template_path: Path,
    aws_summary: dict[str, Any],
    aws_raw: dict[str, Any],
    fx: dict[str, Any],
    licence_cad: Decimal,
    hosting_cad: Decimal,
    subtotal_cad: Decimal,
    sales_tax_cad: Decimal,
    total_due_cad: Decimal,
    docx_path: Path,
    pdf_path: Path | None,
) -> None:
    record_lines = [
        f"- {key}: {money_text(Decimal(value))} {aws_summary['unit']}"
        for key, value in aws_summary["recordTypes"].items()
    ]
    files = [
        f"- DOCX: `{docx_path}`\n  - SHA-256: `{sha256(docx_path)}`",
    ]
    if pdf_path and pdf_path.exists():
        files.append(f"- PDF: `{pdf_path}`\n  - SHA-256: `{sha256(pdf_path)}`")

    audit = f"""# Awentech Invoice Audit - {billing_month.label}

Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}
Client: {config['clientDisplayName']}
Invoice: #{invoice_number}
Invoice date: {invoice_date.day} {invoice_date.strftime('%B %Y')}
Billing month: {billing_month.label}
Template: `{template_path}`

## Client-Facing Invoice Amounts

- Monthly licence and support: CAD {money_text(licence_cad)}
- Hosting passthrough: CAD {money_text(hosting_cad)}
- Subtotal: CAD {money_text(subtotal_cad)}
- {config['billing']['salesTaxLabel']} rate: {Decimal(str(config['billing']['salesTaxRate'])) * Decimal('100')}%
- {config['billing']['salesTaxLabel']} charged: CAD {money_text(sales_tax_cad)}
- Total due: CAD {money_text(total_due_cad)}

## AWS Hosting Passthrough Evidence

AWS source: Cost Explorer for PROD account `{config['aws']['accountId']}`, queried through role `{Path(config['aws']['billingRoleArn']).name}`.
Query period: {billing_month.start_date} inclusive to {billing_month.end_date} exclusive.
Granularity: MONTHLY.
Metric: {config['aws'].get('metric', 'UnblendedCost')}.
Group by: RECORD_TYPE.
Estimated: {str(aws_summary['estimated']).lower()}.

Cost Explorer result:

{chr(10).join(record_lines)}
- Total shown by AWS Cost Explorer grouping: {money_text(aws_summary['totalUsd'])} {aws_summary['unit']}

Invoice basis used: AWS `{aws_summary['passthroughRecordType']}` only, excluding AWS `Tax`. AWS tax is retained here as audit evidence but not included in the client-facing passthrough basis because AwenTech is invoicing NWAC for AwenTech's taxable supply and applies GST/QST on this invoice.

Raw Cost Explorer response:

```json
{json.dumps(aws_raw, indent=2)}
```

## FX Evidence

FX source: {fx['source']}.
Series: {fx['series']}.
Observation date: {fx['observationDate']}.
Rate: {fx['rate']} CAD per USD.
Source page: {fx['sourcePage']}
Valet query: {fx['sourceUrl']}

Calculation:

USD {aws_summary['passthroughUsd']} x {fx['rate']} = CAD {aws_summary['passthroughUsd'] * fx['rate']}, rounded to CAD {money_text(hosting_cad)}.

## Tax Calculation

CAD {money_text(licence_cad)} + CAD {money_text(hosting_cad)} = CAD {money_text(subtotal_cad)} subtotal.
CAD {money_text(subtotal_cad)} x {Decimal(str(config['billing']['salesTaxRate'])) * Decimal('100')}% = CAD {subtotal_cad * Decimal(str(config['billing']['salesTaxRate']))}, rounded to CAD {money_text(sales_tax_cad)}.
CAD {money_text(subtotal_cad)} + CAD {money_text(sales_tax_cad)} = CAD {money_text(total_due_cad)} total due.

## Generated Files

{chr(10).join(files)}

## Future Email Placeholder

Email sending is intentionally out of scope for this generator. Future automation may add SES-based draft/send tracking and response logging after the file-generation workflow is stable.
"""
    path.write_text(audit, encoding="utf-8")


def write_ledger(client_dir: Path, record: dict[str, Any]) -> None:
    ledger_path = client_dir / "billing-ledger.json"
    if ledger_path.exists():
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    else:
        ledger = {"records": []}
    records = [item for item in ledger.get("records", []) if item.get("billingMonth") != record["billingMonth"]]
    records.append(record)
    records.sort(key=lambda item: item["billingMonth"])
    ledger["records"] = records
    ledger_path.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    config = load_config(args.client)
    billing_month = parse_billing_month(args.month)
    invoice_date = parse_invoice_date(args.invoice_date)
    output_root = Path(args.output_root or config["archiveRoot"])
    client_dir = output_root / config["clientFolderName"]
    year_dir = client_dir / str(billing_month.year)
    docx_path = year_dir / f"{config['invoiceFilePrefix']} - {billing_month.label}.docx"
    pdf_path = year_dir / f"{config['invoiceFilePrefix']} - {billing_month.label}.pdf"
    audit_path = year_dir / f"{config['invoiceFilePrefix']} - {billing_month.label} - audit.md"

    existing_outputs = [path for path in [docx_path, pdf_path, audit_path] if path.exists()]
    if existing_outputs and not args.force and not args.dry_run:
        joined = "\n".join(f"- {path}" for path in existing_outputs)
        raise RuntimeError(f"Refusing to overwrite existing invoice files. Use --force if intentional.\n{joined}")

    if args.template and args.invoice_number:
        template_path = Path(args.template)
        invoice_number = args.invoice_number
    else:
        previous = find_previous_invoice(config, billing_month, output_root)
        template_path = Path(args.template) if args.template else previous["path"]
        invoice_number = args.invoice_number or (int(previous["invoiceNumber"]) + 1)
    licence = licence_for_month(config, billing_month)

    print(f"[billing:invoice] client={config['id']} month={billing_month.value}")
    print(f"[billing:invoice] template={template_path}")
    print(f"[billing:invoice] invoiceNumber={invoice_number}")

    aws_raw = fetch_aws_cost(config, billing_month)
    aws_summary = parse_aws_cost(config, aws_raw)
    if aws_summary["estimated"] and not args.allow_estimated_aws:
        raise RuntimeError(
            f"AWS Cost Explorer still marks {billing_month.label} as estimated. "
            "Re-run later or pass --allow-estimated-aws if this is intentional."
        )
    fx = fetch_monthly_fx_rate(config, billing_month)

    licence_cad = money(licence["monthlyLicenceCad"])
    hosting_cad = money(aws_summary["passthroughUsd"] * fx["rate"])
    subtotal_cad = money(licence_cad + hosting_cad)
    sales_tax_cad = money(subtotal_cad * Decimal(str(config["billing"]["salesTaxRate"])))
    total_due_cad = money(subtotal_cad + sales_tax_cad)

    print(f"[billing:invoice] awsUsageUsd={money_text(aws_summary['passthroughUsd'])}")
    print(f"[billing:invoice] fx={fx['rate']}")
    print(f"[billing:invoice] hostingCad={money_text(hosting_cad)}")
    print(f"[billing:invoice] totalDueCad={money_text(total_due_cad)}")

    if args.dry_run:
        print("[billing:invoice] dry run complete; no files written")
        print(f"[billing:invoice] wouldWrite={docx_path}")
        print(f"[billing:invoice] wouldWrite={pdf_path}")
        print(f"[billing:invoice] wouldWrite={audit_path}")
        return 0

    updated_texts = build_updated_text_nodes(
        template_path=template_path,
        invoice_date=invoice_date,
        invoice_number=invoice_number,
        billing_month=billing_month,
        licence_line=licence["lineCalculation"],
        hosting_cad=hosting_cad,
        subtotal_cad=subtotal_cad,
        sales_tax_cad=sales_tax_cad,
        total_due_cad=total_due_cad,
    )
    replace_docx_text_nodes(template_path, docx_path, updated_texts)

    generated_pdf_path = None
    if not args.no_pdf:
        export_pdf_with_word(docx_path, pdf_path)
        generated_pdf_path = pdf_path

    write_audit(
        path=audit_path,
        config=config,
        billing_month=billing_month,
        invoice_date=invoice_date,
        invoice_number=invoice_number,
        template_path=template_path,
        aws_summary=aws_summary,
        aws_raw=aws_raw,
        fx=fx,
        licence_cad=licence_cad,
        hosting_cad=hosting_cad,
        subtotal_cad=subtotal_cad,
        sales_tax_cad=sales_tax_cad,
        total_due_cad=total_due_cad,
        docx_path=docx_path,
        pdf_path=generated_pdf_path,
    )
    write_ledger(
        client_dir,
        {
            "billingMonth": billing_month.value,
            "invoiceNumber": invoice_number,
            "invoiceDate": invoice_date.isoformat(),
            "docxPath": str(docx_path),
            "pdfPath": str(pdf_path) if generated_pdf_path else None,
            "auditPath": str(audit_path),
            "totalDueCad": money_text(total_due_cad),
            "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
    )

    print(f"[billing:invoice] wrote={docx_path}")
    if generated_pdf_path:
        print(f"[billing:invoice] wrote={generated_pdf_path}")
    print(f"[billing:invoice] wrote={audit_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as error:
        print(f"[billing:invoice] ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
