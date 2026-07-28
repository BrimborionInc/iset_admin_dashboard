#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const {
  createExecutor,
  extractProdData,
  applyManualAdjustments,
} = require('./generate-regional-snapshot-from-prod');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT_PATH = path.join(
  REPO_ROOT,
  'docs/data/temp/regional-snapshot-approved-applications-funded-clients-fy-2026-27.xlsx'
);
const DEFAULT_SNAPSHOT_PATH = path.join(
  REPO_ROOT,
  'docs/data/temp/regional-snapshot-all-regions-fy-2026-27-new-rules-2026-07-27.xlsx'
);

function parseArgs(argv) {
  const result = {
    output: DEFAULT_OUTPUT_PATH,
    snapshot: DEFAULT_SNAPSHOT_PATH,
    manualAdjustments: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--output') result.output = path.resolve(argv[++index]);
    else if (token === '--snapshot') result.snapshot = path.resolve(argv[++index]);
    else if (token === '--manual-adjustments') {
      result.manualAdjustments = path.resolve(argv[++index]);
    } else if (token === '--help' || token === '-h') {
      process.stdout.write(
        'Usage: node scripts/generate-regional-snapshot-audit-from-prod.js ' +
        '[--output PATH] [--snapshot PATH] [--manual-adjustments PATH]\n'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return result;
}

const BORDER = {
  top: { style: 'thin', color: { argb: 'FFD5D9E0' } },
  left: { style: 'thin', color: { argb: 'FFD5D9E0' } },
  bottom: { style: 'thin', color: { argb: 'FFD5D9E0' } },
  right: { style: 'thin', color: { argb: 'FFD5D9E0' } },
};
const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFECEFF3' },
};

const roundCurrency = value => Math.round((Number(value) || 0) * 100) / 100;

function applyHeader(row) {
  row.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.border = BORDER;
    cell.font = { name: 'Aptos', size: 11, bold: true };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
}

function applyDataRow(row) {
  row.eachCell({ includeEmpty: true }, cell => {
    cell.border = BORDER;
    cell.font = { name: 'Aptos', size: 11 };
    cell.alignment = { vertical: 'top', wrapText: true };
  });
}

function writeSectionTitle(worksheet, rowIndex, title, width) {
  worksheet.mergeCells(rowIndex, 1, rowIndex, width);
  const cell = worksheet.getCell(rowIndex, 1);
  cell.value = title;
  cell.fill = HEADER_FILL;
  cell.border = BORDER;
  cell.font = { name: 'Aptos', size: 12, bold: true };
}

function writeEmptyRow(worksheet, rowIndex, width, message) {
  worksheet.mergeCells(rowIndex, 1, rowIndex, width);
  const cell = worksheet.getCell(rowIndex, 1);
  cell.value = message;
  cell.border = BORDER;
  cell.font = { name: 'Aptos', size: 11, italic: true, color: { argb: 'FF5F6B7A' } };
}

function autoFit(worksheet) {
  worksheet.columns.forEach(column => {
    let width = 12;
    column.eachCell({ includeEmpty: true }, cell => {
      const value = cell.value == null ? '' : String(cell.value);
      width = Math.max(width, Math.min(42, value.length + 2));
    });
    column.width = Math.min(width, 42);
  });
}

function writeProvinceSheet(worksheet, report) {
  const approvedApplications = report.auditDetails?.approvedApplications || [];
  const fundedClients = report.auditDetails?.fundedClients || [];
  const funding = report.fundingMetrics;

  worksheet.properties.defaultRowHeight = 20;
  worksheet.views = [{ state: 'frozen', ySplit: 8 }];
  worksheet.mergeCells('A1:J1');
  worksheet.getCell('A1').value =
    `${report.region.name} — Regional Snapshot Contribution Detail`;
  worksheet.getCell('A1').font = { name: 'Aptos', size: 14, bold: true };
  worksheet.mergeCells('A2:J2');
  worksheet.getCell('A2').value =
    `Reporting Period: ${report.period.start} - ${report.period.end}`;
  worksheet.getCell('A2').font = { name: 'Aptos', size: 10, color: { argb: 'FF5F6B7A' } };
  worksheet.mergeCells('A3:J3');
  worksheet.getCell('A3').value =
    'Approved Applications and Funded Clients are independent populations. ' +
    'The Funded Clients table reconciles the CRF, EI, and total funding shown in the Regional Snapshot.';
  worksheet.getCell('A3').alignment = { wrapText: true };
  worksheet.getCell('A3').font = { name: 'Aptos', size: 10, italic: true };

  const summaryHeaders = [
    'Approved Applications',
    'Funded Clients',
    'CRF Funding',
    'EI Funding',
    'Total Funding',
  ];
  const summaryValues = [
    report.liveMetrics.fundedApplications,
    funding.fundedClientCount,
    funding.crfFundingAmount,
    funding.eiFundingAmount,
    roundCurrency(funding.crfFundingAmount + funding.eiFundingAmount),
  ];
  summaryHeaders.forEach((header, index) => {
    worksheet.getCell(5, index + 1).value = header;
    worksheet.getCell(6, index + 1).value = summaryValues[index];
  });
  applyHeader(worksheet.getRow(5));
  applyDataRow(worksheet.getRow(6));
  [3, 4, 5].forEach(column => {
    worksheet.getCell(6, column).numFmt = '"$"#,##0.00';
  });

  writeSectionTitle(
    worksheet,
    8,
    `Approved Applications (${approvedApplications.length})`,
    10
  );
  const approvedHeaders = [
    'Application',
    'Application ID',
    'Case',
    'Client',
    'Client ID',
    'Reporting Date(s) / Manual Basis',
    'Funded This Period?',
    'CRF Funding',
    'EI Funding',
    'Total Funding',
  ];
  approvedHeaders.forEach((header, index) => {
    worksheet.getCell(9, index + 1).value = header;
  });
  applyHeader(worksheet.getRow(9));
  const approvedStartRow = 10;
  if (approvedApplications.length) {
    approvedApplications.forEach((entry, index) => {
      const row = worksheet.getRow(approvedStartRow + index);
      row.values = [
        entry.applicationReference,
        entry.applicationId,
        entry.caseReference,
        entry.clientName,
        entry.clientId,
        entry.reportingDates.join(', '),
        entry.fundedClient ? 'Yes' : 'No',
        entry.crfFundingAmount,
        entry.eiFundingAmount,
        entry.totalFundingAmount,
      ];
      applyDataRow(row);
      [8, 9, 10].forEach(column => {
        row.getCell(column).numFmt = '"$"#,##0.00';
      });
    });
  } else {
    writeEmptyRow(worksheet, approvedStartRow, 10, 'No approved applications contribute to this period.');
  }

  const fundedTitleRow = approvedStartRow + Math.max(approvedApplications.length, 1) + 2;
  writeSectionTitle(
    worksheet,
    fundedTitleRow,
    `Funded Clients (${fundedClients.length})`,
    9
  );
  const fundedHeaderRow = fundedTitleRow + 1;
  [
    'Client',
    'Client ID',
    'Contributing Application(s)',
    'Case(s)',
    'Scheduled Occurrences',
    'CRF Funding',
    'EI Funding',
    'Total Funding',
    'Manual Adjustment Basis',
  ].forEach((header, index) => {
    worksheet.getCell(fundedHeaderRow, index + 1).value = header;
  });
  applyHeader(worksheet.getRow(fundedHeaderRow));
  const fundedStartRow = fundedHeaderRow + 1;
  if (fundedClients.length) {
    fundedClients.forEach((entry, index) => {
      const row = worksheet.getRow(fundedStartRow + index);
      row.values = [
        entry.clientName,
        entry.clientId,
        entry.applicationReferences.join(', '),
        entry.caseReferences.join(', '),
        entry.fundingOccurrenceCount,
        entry.crfFundingAmount,
        entry.eiFundingAmount,
        entry.totalFundingAmount,
        entry.manualAdjustmentBasis || '',
      ];
      applyDataRow(row);
      [6, 7, 8].forEach(column => {
        row.getCell(column).numFmt = '"$"#,##0.00';
      });
    });
  } else {
    writeEmptyRow(worksheet, fundedStartRow, 9, 'No funded clients contribute to this period.');
  }
  autoFit(worksheet);
}

function normalizeClientName(value) {
  return String(value || '').trim().toLocaleLowerCase('en-CA');
}

function applyManualAuditAdjustments(reports, payload) {
  const reportsByRegion = new Map(
    reports.map(report => [String(report.region.code).toUpperCase(), report])
  );
  const adjustments = Array.isArray(payload?.adjustments) ? payload.adjustments : [];

  adjustments.forEach(adjustment => {
    const regionCode = String(adjustment.region || '').trim().toUpperCase();
    const report = reportsByRegion.get(regionCode);
    if (!report) throw new Error(`Manual audit adjustment has unknown region ${regionCode}.`);

    const names = [adjustment.client, ...(adjustment.aliases || [])]
      .map(normalizeClientName)
      .filter(Boolean);
    const matchesClient = entry => names.includes(normalizeClientName(entry.clientName));
    const crfFundingAmount = roundCurrency(adjustment.crfFunding);
    const eiFundingAmount = roundCurrency(adjustment.eiFunding);
    const totalFundingAmount = roundCurrency(crfFundingAmount + eiFundingAmount);
    const basis = String(adjustment.basis || 'Manual adjustment');

    if (Number(adjustment.approvedApplications || 0) === 1) {
      report.auditDetails.approvedApplications.push({
        applicationReference: `Manual adjustment — ${adjustment.client}`,
        applicationId: null,
        caseReference: '',
        clientName: adjustment.client,
        clientId: null,
        reportingDates: [basis],
        fundedClient: totalFundingAmount > 0,
        crfFundingAmount,
        eiFundingAmount,
        totalFundingAmount,
      });
    } else if (totalFundingAmount > 0) {
      const approvedEntry = report.auditDetails.approvedApplications.find(matchesClient);
      if (!approvedEntry) {
        throw new Error(
          `Manual funding for ${adjustment.client} has no approved application row to merge.`
        );
      }
      approvedEntry.crfFundingAmount = roundCurrency(
        Number(approvedEntry.crfFundingAmount || 0) + crfFundingAmount
      );
      approvedEntry.eiFundingAmount = roundCurrency(
        Number(approvedEntry.eiFundingAmount || 0) + eiFundingAmount
      );
      approvedEntry.totalFundingAmount = roundCurrency(
        approvedEntry.crfFundingAmount + approvedEntry.eiFundingAmount
      );
      approvedEntry.reportingDates = [...approvedEntry.reportingDates, basis];
    }

    if (Number(adjustment.fundedClients || 0) === 1) {
      report.auditDetails.fundedClients.push({
        clientName: adjustment.client,
        clientId: null,
        applicationReferences: [`Manual adjustment — ${adjustment.client}`],
        caseReferences: [],
        fundingOccurrenceCount: 'Manual adjustment',
        crfFundingAmount,
        eiFundingAmount,
        totalFundingAmount,
        manualAdjustmentBasis: basis,
      });
    } else if (totalFundingAmount > 0) {
      const fundedEntry = report.auditDetails.fundedClients.find(matchesClient);
      if (!fundedEntry) {
        throw new Error(
          `Manual funding for ${adjustment.client} has no funded-client row to merge.`
        );
      }
      fundedEntry.crfFundingAmount = roundCurrency(
        Number(fundedEntry.crfFundingAmount || 0) + crfFundingAmount
      );
      fundedEntry.eiFundingAmount = roundCurrency(
        Number(fundedEntry.eiFundingAmount || 0) + eiFundingAmount
      );
      fundedEntry.totalFundingAmount = roundCurrency(
        fundedEntry.crfFundingAmount + fundedEntry.eiFundingAmount
      );
      fundedEntry.fundingOccurrenceCount =
        `${fundedEntry.fundingOccurrenceCount} + manual adjustment`;
      fundedEntry.manualAdjustmentBasis = [
        fundedEntry.manualAdjustmentBasis,
        basis,
      ].filter(Boolean).join(' | ');
    }
  });

  return applyManualAdjustments(reports, payload);
}

async function verifyAgainstSnapshotWorkbook(reports, snapshotPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(snapshotPath);
  const summary = workbook.getWorksheet('Summary');
  const summaryByCode = new Map();
  for (let rowIndex = 5; rowIndex < 5 + reports.length; rowIndex += 1) {
    const row = summary.getRow(rowIndex);
    summaryByCode.set(String(row.getCell(2).value), {
      approvedApplications: Number(row.getCell(6).value || 0),
      fundedClients: Number(row.getCell(9).value || 0),
      crfFunding: Number(row.getCell(10).value || 0),
      eiFunding: Number(row.getCell(11).value || 0),
    });
  }

  reports.forEach(report => {
    const expected = summaryByCode.get(report.region.code);
    if (!expected) throw new Error(`Snapshot workbook is missing ${report.region.code}.`);
    const approvedRows = report.auditDetails.approvedApplications;
    const fundedRows = report.auditDetails.fundedClients;
    const auditCrf = roundCurrency(
      fundedRows.reduce((sum, row) => sum + Number(row.crfFundingAmount || 0), 0)
    );
    const auditEi = roundCurrency(
      fundedRows.reduce((sum, row) => sum + Number(row.eiFundingAmount || 0), 0)
    );
    if (
      approvedRows.length !== expected.approvedApplications ||
      fundedRows.length !== expected.fundedClients ||
      auditCrf !== roundCurrency(expected.crfFunding) ||
      auditEi !== roundCurrency(expected.eiFunding)
    ) {
      throw new Error(
        `Audit rows do not reconcile with the snapshot for ${report.region.code}: ` +
        JSON.stringify({
          audit: {
            approvedApplications: approvedRows.length,
            fundedClients: fundedRows.length,
            crfFunding: auditCrf,
            eiFunding: auditEi,
          },
          snapshot: expected,
          calculated: {
            approvedApplications: report.liveMetrics.fundedApplications,
            fundedClients: report.fundingMetrics.fundedClientCount,
            crfFunding: report.fundingMetrics.crfFundingAmount,
            eiFunding: report.fundingMetrics.eiFundingAmount,
          },
        })
      );
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    fiscalYearStart: 2026,
    periodType: 'year',
    periodKey: 'annual',
  };
  process.stderr.write('Reading Regional Snapshot contribution detail from PROD (read-only)...\n');
  const data = extractProdData(options);
  process.env.NODE_ENV = 'test';
  process.env.PATH_APP_FACTORY_MODE = '1';
  const dependencyStore = require('../src/server/appFactoryTestDeps');
  dependencyStore.setAppFactoryTestDependencies({
    pool: {
      query: async () => [[], []],
      execute: async () => [[], []],
      getConnection: async () => ({
        query: async () => [[], []],
        execute: async () => [[], []],
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
      }),
    },
    authnMiddlewareFactory: () => (_req, _res, next) => next(),
  });
  const { buildRegionalSnapshotPayload } = require('../isetadminserver');
  const executor = createExecutor(data);
  const regions = data.__REGIONS__.filter(region => region.code !== 'XX');
  let reports = [];
  for (const region of regions) {
    reports.push(await buildRegionalSnapshotPayload({
      regionId: Number(region.region_id),
      fiscalYearStart: options.fiscalYearStart,
      periodType: options.periodType,
      periodKey: options.periodKey,
      includeAuditDetails: true,
      executor,
    }));
  }
  dependencyStore.clearAppFactoryTestDependencies();

  if (args.manualAdjustments) {
    const manualAdjustmentPayload = JSON.parse(
      fs.readFileSync(args.manualAdjustments, 'utf8')
    );
    reports = applyManualAuditAdjustments(reports, manualAdjustmentPayload);
  }

  await verifyAgainstSnapshotWorkbook(reports, args.snapshot);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PATH';
  workbook.created = new Date();
  workbook.modified = new Date();
  reports.forEach(report => {
    const worksheet = workbook.addWorksheet(report.region.name.slice(0, 31));
    writeProvinceSheet(worksheet, report);
  });
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  await workbook.xlsx.writeFile(args.output);
  process.stdout.write(`${JSON.stringify({
    output: args.output,
    snapshot: args.snapshot,
    manualAdjustments: args.manualAdjustments,
    provinces: reports.map(report => ({
      code: report.region.code,
      approvedApplications: report.auditDetails.approvedApplications.length,
      fundedClients: report.auditDetails.fundedClients.length,
      crfFunding: report.fundingMetrics.crfFundingAmount,
      eiFunding: report.fundingMetrics.eiFundingAmount,
    })),
  }, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
