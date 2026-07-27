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
  fgColor: { argb: "FFECEFF3" },
};

const TEXT_MUTED = "FF5F6B7A";

const safeNumber = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toNullableNumber = value => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatCurrency = value =>
  safeNumber(value).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatInteger = value => safeNumber(value).toLocaleString("en-CA");

const formatPercent = value => `${safeNumber(value).toFixed(2)}%`;

const formatNullableCurrency = value => {
  const numeric = toNullableNumber(value);
  return numeric === null ? "—" : formatCurrency(numeric);
};

const toExcelSheetName = value => {
  const sanitized = String(value || "Snapshot")
    .replace(/[\\/*?:[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (sanitized || "Snapshot").slice(0, 31);
};

const autoFitSummaryColumns = worksheet => {
  worksheet.columns.forEach(column => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, cell => {
      const cellValue = cell.value == null ? "" : String(cell.value);
      maxLength = Math.max(maxLength, cellValue.length + 2);
    });
    column.width = Math.min(maxLength, 28);
  });
};

const applyCellBorder = cell => {
  cell.border = BORDER_STYLE;
  cell.alignment = { vertical: "middle" };
  cell.font = { name: "Aptos", size: 11 };
};

const writeSectionTitle = (worksheet, range, text) => {
  worksheet.mergeCells(range);
  const cell = worksheet.getCell(range.split(":")[0]);
  cell.value = text;
  cell.fill = SECTION_FILL;
  cell.border = BORDER_STYLE;
  cell.font = { name: "Aptos", size: 11, bold: true };
  cell.alignment = { vertical: "middle" };
};

const writeLabelValuePair = (worksheet, rowIndex, labelColumn, valueColumn, row = {}) => {
  const labelCell = worksheet.getCell(`${labelColumn}${rowIndex}`);
  const valueCell = worksheet.getCell(`${valueColumn}${rowIndex}`);
  labelCell.value = row.label || "";
  valueCell.value = row.value ?? "";
  applyCellBorder(labelCell);
  applyCellBorder(valueCell);
  labelCell.font = { name: "Aptos", size: 11, bold: Boolean(row.emphasis) };
  valueCell.font = { name: "Aptos", size: 11, bold: Boolean(row.emphasis) };
  valueCell.alignment = { vertical: "middle" };
};

const buildRegionInfoRows = report => [
  { label: "Region", value: report?.region?.name || "—" },
  { label: "Province/Territory", value: report?.region?.code || "—" },
  { label: "Regional Manager", value: report?.snapshot?.regionalManagerName || "—" },
  { label: "ISET Coordinator", value: report?.snapshot?.regionalCoordinatorName || "—" },
];

const buildClientActivityRows = report => [
  { label: "Applications Received", value: formatInteger(report?.liveMetrics?.applicationsReceived) },
  { label: "Approved Applications", value: formatInteger(report?.liveMetrics?.fundedApplications ?? report?.liveMetrics?.funded) },
  {
    label: "Denied/Ineligible/Withdrawn/NC",
    value: formatInteger(report?.liveMetrics?.deniedIneligibleWithdrawn),
  },
  {
    label: "Pending / No Decision",
    value: formatInteger(report?.liveMetrics?.pendingDecision),
  },
];

const buildFundingRows = report => [
  { label: "Funded Clients", value: formatInteger(report?.fundingMetrics?.fundedClientCount ?? report?.liveMetrics?.fundedClients) },
  { label: "CRF Funding ($)", value: formatCurrency(report?.fundingMetrics?.crfFundingAmount) },
  { label: "EI Funding ($)", value: formatCurrency(report?.fundingMetrics?.eiFundingAmount) },
  { label: "Total Funding ($)", value: formatCurrency(report?.derivedMetrics?.totalFunding), emphasis: true },
];

const buildAdminRows = report => [
  { label: "Coordinator Salary ($)", value: formatCurrency(report?.snapshot?.coordinatorSalaryAmount) },
  { label: "Operating Costs ($)", value: formatCurrency(report?.snapshot?.operatingCostsAmount) },
  { label: "Total Admin Cost ($)", value: formatCurrency(report?.derivedMetrics?.totalAdminCost), emphasis: true },
];

const buildKeyMetricRows = report => [
  {
    label: "Client Average Amount Funded",
    value: formatNullableCurrency(report?.derivedMetrics?.clientAverageAmountFunded),
  },
  {
    label: "Admin Cost per Client",
    value: formatCurrency(report?.derivedMetrics?.adminCostPerClient),
  },
  { label: "Admin Ratio", value: formatPercent(report?.derivedMetrics?.adminRatioPercent) },
];

const buildComplianceRows = report => [
  { label: "Status", value: report?.snapshot?.complianceFlag || "Review Required" },
];

const writeSnapshotWorksheet = (worksheet, report) => {
  worksheet.properties.defaultRowHeight = 20;
  worksheet.columns = [
    { width: 30 },
    { width: 20 },
    { width: 3 },
    { width: 30 },
    { width: 20 },
  ];
  worksheet.views = [{ state: "frozen", ySplit: 2 }];

  worksheet.mergeCells("A1:E1");
  worksheet.mergeCells("A2:E2");
  const titleCell = worksheet.getCell("A1");
  const subtitleCell = worksheet.getCell("A2");
  titleCell.value = report?.region?.name
    ? `${report.region.name} ISET - Regional Snapshot Report`
    : "ISET - Regional Snapshot Report";
  subtitleCell.value = report?.period
    ? `Reporting Period: ${report.period.start} - ${report.period.end}`
    : "Reporting Period";
  titleCell.font = { name: "Aptos", size: 14, bold: true };
  subtitleCell.font = { name: "Aptos", size: 10, color: { argb: TEXT_MUTED } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" };

  const sectionPairs = [
    {
      startRow: 4,
      leftTitle: "A. Region Information",
      leftRows: buildRegionInfoRows(report),
      rightTitle: "B. Client Activity",
      rightRows: buildClientActivityRows(report),
    },
    {
      startRow: 10,
      leftTitle: "C. Funding",
      leftRows: buildFundingRows(report),
      rightTitle: "D. Admin & Operating",
      rightRows: buildAdminRows(report),
    },
    {
      startRow: 15,
      leftTitle: "E. Key Metrics",
      leftRows: buildKeyMetricRows(report),
      rightTitle: "F. Compliance Flag",
      rightRows: buildComplianceRows(report),
    },
  ];

  sectionPairs.forEach(section => {
    writeSectionTitle(worksheet, `A${section.startRow}:B${section.startRow}`, section.leftTitle);
    writeSectionTitle(worksheet, `D${section.startRow}:E${section.startRow}`, section.rightTitle);
    const rowCount = Math.max(section.leftRows.length, section.rightRows.length);
    for (let offset = 0; offset < rowCount; offset += 1) {
      const rowIndex = section.startRow + 1 + offset;
      writeLabelValuePair(worksheet, rowIndex, "A", "B", section.leftRows[offset] || {});
      writeLabelValuePair(worksheet, rowIndex, "D", "E", section.rightRows[offset] || {});
    }
  });

  writeSectionTitle(worksheet, "A20:E20", "G. Comments / Recommendations");
  worksheet.mergeCells("A21:E25");
  const commentsCell = worksheet.getCell("A21");
  commentsCell.value =
    report?.snapshot?.commentsRecommendations || "No comments have been saved for this snapshot yet.";
  commentsCell.alignment = { vertical: "top", wrapText: true };
  commentsCell.font = { name: "Aptos", size: 11 };
  commentsCell.border = BORDER_STYLE;

  worksheet.mergeCells("A26:E26");
  const footerCell = worksheet.getCell("A26");
  footerCell.value = report?.snapshot?.updatedAt
    ? `Last updated ${report.snapshot.updatedAt}${report.snapshot.updatedByName ? ` by ${report.snapshot.updatedByName}` : ""}.`
    : "";
  footerCell.font = { name: "Aptos", size: 10, color: { argb: TEXT_MUTED } };
  footerCell.alignment = { vertical: "middle" };
};

const writeSummaryWorksheet = (worksheet, reports, meta = {}) => {
  worksheet.properties.defaultRowHeight = 20;
  worksheet.getCell("A1").value = "Regional Snapshot Summary";
  worksheet.getCell("A1").font = { name: "Aptos", size: 14, bold: true };
  worksheet.getCell("A2").value = meta.subtitle || "";
  worksheet.getCell("A2").font = { name: "Aptos", size: 10, color: { argb: TEXT_MUTED } };

  const headers = [
    "Region",
    "Province/Territory",
    "Regional Manager",
    "ISET Coordinator",
    "Applications Received",
    "Approved Applications",
    "Denied/Ineligible/Withdrawn/NC",
    "Pending / No Decision",
    "Funded Clients",
    "CRF Funding ($)",
    "EI Funding ($)",
    "Total Funding ($)",
    "Coordinator Salary ($)",
    "Operating Costs ($)",
    "Total Admin Cost ($)",
    "Client Average Amount Funded",
    "Admin Cost per Client",
    "Admin Ratio",
    "Compliance Flag",
  ];

  const headerRow = worksheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = SECTION_FILL;
    cell.border = BORDER_STYLE;
    cell.font = { name: "Aptos", size: 11, bold: true };
  });

  reports.forEach((report, reportIndex) => {
    const row = worksheet.getRow(5 + reportIndex);
    const values = [
      report?.region?.name || "",
      report?.region?.code || "",
      report?.snapshot?.regionalManagerName || "",
      report?.snapshot?.regionalCoordinatorName || "",
      safeNumber(report?.liveMetrics?.applicationsReceived),
      safeNumber(report?.liveMetrics?.fundedApplications ?? report?.liveMetrics?.funded),
      safeNumber(report?.liveMetrics?.deniedIneligibleWithdrawn),
      safeNumber(report?.liveMetrics?.pendingDecision),
      safeNumber(report?.fundingMetrics?.fundedClientCount ?? report?.liveMetrics?.fundedClients),
      safeNumber(report?.fundingMetrics?.crfFundingAmount),
      safeNumber(report?.fundingMetrics?.eiFundingAmount),
      toNullableNumber(report?.derivedMetrics?.totalFunding),
      toNullableNumber(report?.snapshot?.coordinatorSalaryAmount),
      toNullableNumber(report?.snapshot?.operatingCostsAmount),
      toNullableNumber(report?.derivedMetrics?.totalAdminCost),
      toNullableNumber(report?.derivedMetrics?.clientAverageAmountFunded),
      toNullableNumber(report?.derivedMetrics?.adminCostPerClient),
      toNullableNumber(report?.derivedMetrics?.adminRatioPercent) === null
        ? null
        : toNullableNumber(report?.derivedMetrics?.adminRatioPercent) / 100,
      report?.snapshot?.complianceFlag || "",
    ];
    values.forEach((value, index) => {
      row.getCell(index + 1).value = value;
    });
    row.eachCell(cell => {
      cell.border = BORDER_STYLE;
      cell.font = { name: "Aptos", size: 11 };
    });
  });

  const totalRowIndex = 5 + reports.length;
  const totalRow = worksheet.getRow(totalRowIndex);
  totalRow.getCell(1).value = "Total";
  totalRow.getCell(1).font = { name: "Aptos", size: 11, bold: true };
  totalRow.getCell(1).fill = SECTION_FILL;
  totalRow.getCell(1).border = BORDER_STYLE;

  const sumColumns = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  sumColumns.forEach(columnIndex => {
    const cell = totalRow.getCell(columnIndex);
    const columnLetter = worksheet.getColumn(columnIndex).letter;
    cell.value = {
      formula: `SUM(${columnLetter}5:${columnLetter}${totalRowIndex - 1})`,
    };
    cell.font = { name: "Aptos", size: 11, bold: true };
    cell.fill = SECTION_FILL;
    cell.border = BORDER_STYLE;
  });

  totalRow.getCell(15).value = {
    formula: `SUM(O5:O${totalRowIndex - 1})`,
  };
  totalRow.getCell(16).value = {
    formula: `IF(I${totalRowIndex}=0,"",L${totalRowIndex}/I${totalRowIndex})`,
  };
  totalRow.getCell(17).value = {
    formula: `IF(I${totalRowIndex}=0,"",O${totalRowIndex}/I${totalRowIndex})`,
  };
  totalRow.getCell(18).value = {
    formula: `IF(L${totalRowIndex}=0,"",O${totalRowIndex}/L${totalRowIndex})`,
  };

  for (let index = 16; index <= 18; index += 1) {
    const cell = totalRow.getCell(index);
    cell.font = { name: "Aptos", size: 11, bold: true };
    cell.fill = SECTION_FILL;
    cell.border = BORDER_STYLE;
  }

  const issues = reports.flatMap(report =>
    (Array.isArray(report?.dataQualityIssues) ? report.dataQualityIssues : []).map(issue => ({
      region: issue?.region || report?.region?.code || report?.region?.name || "",
      applicationReference: issue?.applicationReference || "",
      caseReference: issue?.caseReference || "",
      interventionReference: issue?.interventionReference || "",
      issueType: issue?.issueType || "",
      reportingEffect: issue?.reportingEffect || "",
      remediation: issue?.remediation || "",
    }))
  );
  const issueTitleRowIndex = totalRowIndex + 3;
  worksheet.mergeCells(issueTitleRowIndex, 1, issueTitleRowIndex, 7);
  const issueTitleCell = worksheet.getCell(issueTitleRowIndex, 1);
  issueTitleCell.value = "Data Quality Issues";
  issueTitleCell.fill = SECTION_FILL;
  issueTitleCell.border = BORDER_STYLE;
  issueTitleCell.font = { name: "Aptos", size: 11, bold: true };

  const issueHeaders = [
    "Region",
    "Application",
    "Case",
    "Intervention",
    "Issue Type",
    "Reporting Effect / Fallback",
    "Remediation",
  ];
  const issueHeaderRow = worksheet.getRow(issueTitleRowIndex + 1);
  issueHeaders.forEach((header, index) => {
    const cell = issueHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.fill = SECTION_FILL;
    cell.border = BORDER_STYLE;
    cell.font = { name: "Aptos", size: 11, bold: true };
  });
  if (issues.length) {
    issues.forEach((issue, issueIndex) => {
      const row = worksheet.getRow(issueTitleRowIndex + 2 + issueIndex);
      [
        issue.region,
        issue.applicationReference,
        issue.caseReference,
        issue.interventionReference,
        String(issue.issueType).replace(/_/g, " "),
        issue.reportingEffect,
        issue.remediation,
      ].forEach((value, index) => {
        const cell = row.getCell(index + 1);
        cell.value = value;
        cell.border = BORDER_STYLE;
        cell.font = { name: "Aptos", size: 11 };
        cell.alignment = { vertical: "top", wrapText: true };
      });
    });
  } else {
    const emptyRowIndex = issueTitleRowIndex + 2;
    worksheet.mergeCells(emptyRowIndex, 1, emptyRowIndex, 7);
    const emptyCell = worksheet.getCell(emptyRowIndex, 1);
    emptyCell.value = "No data quality issues identified for this reporting period.";
    emptyCell.border = BORDER_STYLE;
    emptyCell.font = { name: "Aptos", size: 11, color: { argb: TEXT_MUTED } };
  }

  [10, 11, 12, 13, 14, 15, 16, 17].forEach(index => {
    worksheet.getColumn(index).numFmt = '"$"#,##0.00';
  });
  worksheet.getColumn(18).numFmt = "0.00%";

  autoFitSummaryColumns(worksheet);
  worksheet.views = [{ state: "frozen", ySplit: 4 }];
};

export const buildRegionalSnapshotWorkbook = async ({ reports, includeSummary = false, subtitle = "" }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PATH";
  workbook.created = new Date();
  workbook.modified = new Date();

  const reportList = Array.isArray(reports) ? reports.filter(Boolean) : [];

  if (includeSummary) {
    const summarySheet = workbook.addWorksheet("Summary");
    writeSummaryWorksheet(summarySheet, reportList, { subtitle });
  }

  reportList.forEach(report => {
    const worksheet = workbook.addWorksheet(toExcelSheetName(report?.region?.name || "Snapshot"));
    writeSnapshotWorksheet(worksheet, report);
  });

  return workbook.xlsx.writeBuffer();
};

export const triggerExcelDownload = async ({ reports, filename, includeSummary = false, subtitle = "" }) => {
  const buffer = await buildRegionalSnapshotWorkbook({ reports, includeSummary, subtitle });
  const blob = new Blob(
    [buffer],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  );
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
