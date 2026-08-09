import fs from 'fs';
import path from 'path';
import { interventionApprovalIncludesFundingPackage } from '../InterventionAssessmentWidget';

jest.mock('@cloudscape-design/board-components', () => ({
  BoardItem: () => null,
}));
jest.mock('@cloudscape-design/components', () =>
  new Proxy({}, { get: () => () => null })
);

const readSource = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const extractBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('intervention approval funding-package copy', () => {
  test('requires a positive funded cost line before describing a funding package', () => {
    expect(interventionApprovalIncludesFundingPackage()).toBe(false);
    expect(interventionApprovalIncludesFundingPackage([{ costLines: [] }])).toBe(false);
    expect(
      interventionApprovalIncludesFundingPackage([
        { costLines: [{ amount: '0.00' }, { amount: '-25.00' }] },
      ])
    ).toBe(false);
    expect(
      interventionApprovalIncludesFundingPackage([
        { costLines: [{ amount: '$1,250.00' }] },
      ])
    ).toBe(true);
    expect(
      interventionApprovalIncludesFundingPackage([
        { costLines: [{ amount: '', recurrence: { amountPerPeriod: '125.00' } }] },
      ])
    ).toBe(true);
  });

  test('client letter and send confirmation keep funded attachments conditional', () => {
    const source = readSource(
      'src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx'
    );
    const clientLetterBuilder = extractBetween(
      source,
      'const buildApprovedClientLetterBody = useCallback',
      'const canGenerateLetterDrafts ='
    );
    const sendConfirmation = extractBetween(
      source,
      'const sendApprovalLetterConfirmModal =',
      'const decisionBlockerModal ='
    );

    expect(clientLetterBuilder).toContain('approvalHasFundingPackage');
    expect(clientLetterBuilder).toContain(
      'no Client Funding Agreement or banking/funding forms are attached'
    );
    expect(clientLetterBuilder).toContain(
      'I have attached the Client Funding Agreement for your review'
    );
    expect(sendConfirmation).toContain('approvalHasFundingPackage');
    expect(sendConfirmation).toContain(
      'No Client Funding Agreement or funding forms will be attached because the approved intervention does not include funded cost lines.'
    );
    expect(sendConfirmation).toContain(
      'with the Client Funding Agreement and EFT & Wire Transfer Direct Debit form attached.'
    );
  });

  test('application review actions use submitter wording for dual-role Regional Managers', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');

    expect(source).toContain('Forward changes to submitter');
    expect(source).toContain('Return to submitter');
    expect(source).toContain('Submitter correction required');
    expect(source).not.toContain('Forward changes to Coordinator');
    expect(source).not.toContain('Return to Coordinator');
    expect(source).not.toContain('Coordinator correction required');
  });
});
