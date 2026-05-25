const fs = require('fs');
const path = require('path');

const readSource = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const assessmentWidgets = [
  {
    name: 'application assessment',
    source: readSource('src/widgets/CoordinatorAssessmentWidget.js'),
    owner: 'assessment',
  },
  {
    name: 'intervention assessment',
    source: readSource('src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx'),
    owner: 'form',
  },
];

describe('other funding source behavior', () => {
  test.each(assessmentWidgets)('$name supports confirmed, pending, denied, and unknown funding states', ({ source }) => {
    expect(source).toContain('OTHER_FUNDER_STATUS_OPTIONS');
    expect(source).toMatch(/label:\s*["']Confirmed["']/);
    expect(source).toMatch(/label:\s*["']Pending["']/);
    expect(source).toMatch(/label:\s*["']Denied["']/);
    expect(source).toContain('Unknown / not confirmed');
    expect(source).toContain('normalizeOtherFunderStatus');
    expect(source).toContain('OTHER_FUNDER_STATUS_CONFIRMED');
  });

  test.each(assessmentWidgets)('$name only requires coverage for confirmed funding', ({ source }) => {
    expect(source).toContain('if (isConfirmedOtherFundingSource(next) && !String(next.coverage ||');
    expect(source).toContain('Coverage details are required for confirmed funding.');
    expect(source).toContain('Required only when funding is confirmed.');
  });

  test.each(assessmentWidgets)('$name shows the other-funding editor for non-no values', ({ source, owner }) => {
    expect(source).toMatch(new RegExp(`${owner}\\.otherFundingInvolved\\s*&&\\s*${owner}\\.otherFundingInvolved\\s*!==\\s*["']no["']`));
  });

  test.each(assessmentWidgets)('$name collects status, optional amount, coverage, and notes', ({ source }) => {
    expect(source).toContain('Funding status');
    expect(source).toContain('Amount (optional)');
    expect(source).toContain('What this funder covers');
    expect(source).toContain('Funder notes (optional)');
  });

  test.each(assessmentWidgets)('$name only generates co-funder letters for confirmed sources', ({ source }) => {
    expect(source).toContain('fundingSources.filter(isConfirmedOtherFundingSource)');
  });

  test('server PDF formatting records unconfirmed status without inventing amount or coverage', () => {
    const serverSource = readSource('isetadminserver.js');

    expect(serverSource).toContain('formatAssessmentOtherFundingDetailsForPdf');
    expect(serverSource).toContain('Amount not confirmed');
    expect(serverSource).toContain('No confirmed coverage');
    expect(serverSource).toContain('Coverage not specified');
  });
});
