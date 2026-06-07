const fs = require('fs');
const path = require('path');

const tableSource = fs.readFileSync(
  path.join(process.cwd(), 'src/pages/Caseworking/portfolio/widgets/CasesTableWidget.jsx'),
  'utf8'
);
const hookSource = fs.readFileSync(
  path.join(process.cwd(), 'src/pages/Caseworking/portfolio/hooks/useCasesData.js'),
  'utf8'
);
const caseStatusSource = fs.readFileSync(
  path.join(process.cwd(), 'src/utils/caseStatus.js'),
  'utf8'
);

describe('ISET Clients status labels', () => {
  test('case status helper labels dormant as No Active Plan', () => {
    expect(caseStatusSource).toContain("dormant: 'No Active Plan'");
  });

  test('ISET Clients table renders status badges through the shared case status helpers', () => {
    expect(tableSource).toContain('getCaseStatusLabel(rawStatus)');
    expect(tableSource).toContain('getCaseStatusBadgeColor(rawStatus)');
    expect(tableSource).not.toContain('primaryStatusLabel || "-"');
  });

  test('case table data exposes normalized status label and color aliases', () => {
    expect(hookSource).toContain('statusLabel: statusMeta.label');
    expect(hookSource).toContain('statusColor: statusMeta.color');
  });
});
