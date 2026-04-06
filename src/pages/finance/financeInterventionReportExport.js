import ExcelJS from "exceljs";

const BORDER_STYLE = {
  top: { style: "thin", color: { argb: "FFD5D9E0" } },
  left: { style: "thin", color: { argb: "FFD5D9E0" } },
  bottom: { style: "thin", color: { argb: "FFD5D9E0" } },
  right: { style: "thin", color: { argb: "FFD5D9E0" } },
};

const SECTION_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF3F4F6" },
};

const HEADER_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE5E7EB" },
};

const TEXT_MUTED = "FF5F6B7A";

const formatCurrency = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
};

const toSheetName = value => {
  const sanitized = String(value || "Report")
    .replace(/[\\/*?:[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (sanitized || "Report").slice(0, 31);
};

const autoFitColumns = worksheet => {
  worksheet.columns.forEach(column => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, cell => {
      const cellValue = cell.value == null ? "" : String(cell.value);
      maxLength = Math.max(maxLength, cellValue.length + 2);
    });
    column.width = Math.min(maxLength, 28);
  });
};

const applyBorder = cell => {
  cell.border = BORDER_STYLE;
  cell.alignment = { vertical: "middle" };
  cell.font = { name: "Aptos", size: 11 };
};

const applyNegativeCurrencyFont = cell => {
  if (Number(cell?.value || 0) < 0) {
    cell.font = { ...(cell.font || { name: "Aptos", size: 11 }), color: { argb: "FFC62828" } };
  }
};

const writeSectionHeader = (worksheet, rowIndex, title) => {
  worksheet.mergeCells(`A${rowIndex}:F${rowIndex}`);
  const cell = worksheet.getCell(`A${rowIndex}`);
  cell.value = title;
  cell.fill = SECTION_FILL;
  cell.border = BORDER_STYLE;
  cell.font = { name: "Aptos", size: 11, bold: true };
};

const writeLabelValueRow = (worksheet, rowIndex, label, value) => {
  const labelCell = worksheet.getCell(`A${rowIndex}`);
  const valueCell = worksheet.getCell(`B${rowIndex}`);
  labelCell.value = label;
  valueCell.value = value ?? "";
  applyBorder(labelCell);
  applyBorder(valueCell);
  labelCell.font = { name: "Aptos", size: 11, bold: true };
};

const writeSummarySheet = (worksheet, summary, meta) => {
  worksheet.properties.defaultRowHeight = 20;
  worksheet.getCell("A1").value = meta?.title || "ISET Advances and Active Clients";
  worksheet.getCell("A1").font = { name: "Aptos", size: 14, bold: true };
  worksheet.getCell("A2").value = `Annual report · FY ${meta?.fiscalYearLabel || ""}`;
  worksheet.getCell("A2").font = { name: "Aptos", size: 10, color: { argb: TEXT_MUTED } };

  writeSectionHeader(worksheet, 4, "Report Context");
  writeLabelValueRow(worksheet, 5, "Fiscal year", meta?.fiscalYearLabel || "—");
  writeLabelValueRow(worksheet, 6, "Region", meta?.provinceLabel || "All regions");
  writeLabelValueRow(worksheet, 7, "Include carry-over", meta?.includeCarryOver ? "Yes" : "No");

  writeSectionHeader(worksheet, 9, "Summary");
  const summaryRows = [
    ["Total advances", formatCurrency(summary?.totalAmount)],
    ["CRF advances", formatCurrency(summary?.fundingTotals?.CRF)],
    ["EI advances", formatCurrency(summary?.fundingTotals?.EI)],
    ["Sent to finance", formatCurrency(summary?.financeTotals?.sentAmount)],
    ["Paid / confirmed", formatCurrency(summary?.financeTotals?.paidAmount)],
    ["Not yet sent", formatCurrency(summary?.financeTotals?.notYetSentAmount)],
    ["Interventions", Number(summary?.interventionCount || 0)],
    ["Participants", Number(summary?.participantCount || 0)],
    ["Regions", Number(summary?.provinceCount || 0)],
  ];
  if (meta?.includeCarryOver) {
    summaryRows.push(
      ["Carry-over from prior FY", formatCurrency(summary?.carryOver?.carryInAmount)],
      ["Carry-over to next FY", formatCurrency(summary?.carryOver?.carryOutAmount)],
      ["Current FY estimate", formatCurrency(summary?.carryOver?.currentFiscalEstimatedAmount)]
    );
  }
  summaryRows.forEach((row, index) => {
    writeLabelValueRow(worksheet, 10 + index, row[0], row[1]);
  });

  const provinceStartRow = 10 + summaryRows.length + 2;
  writeSectionHeader(worksheet, provinceStartRow, "Region Totals");
  const headerRow = worksheet.getRow(provinceStartRow + 1);
  ["Region", "Participants", "Interventions", "CRF advances", "EI advances", "Total advances"].forEach(
    (header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.fill = HEADER_FILL;
      cell.border = BORDER_STYLE;
      cell.font = { name: "Aptos", size: 11, bold: true };
    }
  );

  (Array.isArray(summary?.provinceRows) ? summary.provinceRows : []).forEach((row, index) => {
    const excelRow = worksheet.getRow(provinceStartRow + 2 + index);
    excelRow.values = [
      row?.provinceName || row?.provinceCode || "Unspecified",
      Number(row?.participantCount || 0),
      Number(row?.interventionCount || 0),
      formatCurrency(row?.crfAmount),
      formatCurrency(row?.eiAmount),
      formatCurrency(row?.totalAmount),
    ];
    excelRow.eachCell(cell => applyBorder(cell));
  });

  [4, 5, 6].forEach(columnIndex => {
    worksheet.getColumn(columnIndex).numFmt = '"$"#,##0.00';
  });
  autoFitColumns(worksheet);
  worksheet.views = [{ state: "frozen", ySplit: provinceStartRow + 1 }];
};

const writeDetailSheet = (worksheet, rows, fundingSource, meta) => {
  worksheet.properties.defaultRowHeight = 20;
  worksheet.getCell("A1").value = `${fundingSource} Detail`;
  worksheet.getCell("A1").font = { name: "Aptos", size: 14, bold: true };
  worksheet.getCell("A2").value = `Annual report · FY ${meta?.fiscalYearLabel || ""}`;
  worksheet.getCell("A2").font = { name: "Aptos", size: 10, color: { argb: TEXT_MUTED } };

  const headers = [
    "Region",
    "Participant",
    "Case",
    "Tracking ID",
    "Approved date",
    "Intervention code",
    "Intervention",
    "Intervention title",
    "Start date",
    "End date",
    "Institution / partner",
    "Program / position",
    "Tuition",
    "Books / materials",
    "Living",
    "Childcare",
    "Wage / project",
    "Other",
    "Total advances",
  ];
  if (meta?.includeCarryOver) {
    headers.push("Current FY estimate", "Carry-over adjustment", "Carry-over note");
  }
  headers.push(
    "Payment status",
    "Latest packet status",
    "Sent amount",
    "Paid amount",
    "Sent date",
    "Paid date",
    "Budget pot"
  );

  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = HEADER_FILL;
    cell.border = BORDER_STYLE;
    cell.font = { name: "Aptos", size: 11, bold: true };
  });

  rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(5 + index);
    const values = [
      row?.participantProvinceName || row?.participantProvince || "Unspecified",
      row?.participantName || "Participant",
      row?.caseNumber || "",
      row?.trackingId || "",
      row?.approvedDate || row?.commitmentDate || "",
      row?.interventionCode || "",
      row?.interventionLabel || "",
      row?.interventionTitle || "",
      row?.interventionStartDate || "",
      row?.interventionEndDate || "",
      row?.institution || "",
      row?.programName || "",
      formatCurrency(row?.tuitionAmount),
      formatCurrency(row?.booksMaterialsAmount),
      formatCurrency(row?.livingAmount),
      formatCurrency(row?.childcareAmount),
      formatCurrency(row?.wageAmount),
      formatCurrency(row?.otherAmount),
      formatCurrency(row?.totalAmount),
    ];
    if (meta?.includeCarryOver) {
      values.push(
        formatCurrency(row?.carryOverCurrentFiscalAmount),
        formatCurrency(row?.carryOverAdjustmentAmount),
        row?.carryOverNote || row?.carryOverSourceLabel || ""
      );
    }
    values.push(
      row?.financeFollowUpStatusLabel || "",
      row?.latestPacketStatusLabel || "",
      formatCurrency(row?.financeSentAmount),
      formatCurrency(row?.financePaidAmount),
      row?.financeSentDate || "",
      row?.financePaidDate || "",
      [row?.budgetPotCode, row?.budgetPotName].filter(Boolean).join(" · ")
    );
    excelRow.values = values;
    excelRow.eachCell(cell => applyBorder(cell));
    if (meta?.includeCarryOver) {
      applyNegativeCurrencyFont(excelRow.getCell(21));
    }
  });

  const currencyColumns = meta?.includeCarryOver
    ? [13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 26]
    : [13, 14, 15, 16, 17, 18, 19, 22, 23];
  currencyColumns.forEach(columnIndex => {
    worksheet.getColumn(columnIndex).numFmt = '"$"#,##0.00';
  });
  autoFitColumns(worksheet);
  worksheet.views = [{ state: "frozen", ySplit: 4 }];
};

export const triggerFinanceInterventionReportExcelDownload = async ({
  rows,
  summary,
  meta,
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PATH";
  workbook.created = new Date();
  workbook.modified = new Date();

  const safeRows = Array.isArray(rows) ? rows : [];
  const summarySheet = workbook.addWorksheet("Summary");
  writeSummarySheet(summarySheet, summary, meta);

  ["CRF", "EI"].forEach(fundingSource => {
    const sheetRows = safeRows.filter(row => row?.fundingSource === fundingSource);
    const worksheet = workbook.addWorksheet(
      toSheetName(`${fundingSource} Detail`)
    );
    writeDetailSheet(worksheet, sheetRows, fundingSource, meta);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob(
    [buffer],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  );
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = meta?.filename || "iset-advances-and-active-clients.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
