import fs from 'fs';
import path from 'path';

const readRepoFile = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const applicationAssessmentHelp = readRepoFile('src/helpPanelContents/applicationAssessmentHelp.js');
const proposedInterventionsHelp = readRepoFile('src/helpPanelContents/caseWorkspaceProposedInterventionsHelp.js');
const approvalsItemsHelp = readRepoFile('src/helpPanelContents/homeApprovalsItemsHelp.js');
const workQueueHelp = readRepoFile('src/helpPanelContents/homeWorkQueueHelp.js');
const workQueueItemsHelp = readRepoFile('src/helpPanelContents/homeWorkQueueItemsHelp.js');
const applicationWorkspaceHelp = readRepoFile('src/helpPanelContents/applicationCaseDashboardHelp.js');
const caseWorkspaceHelp = readRepoFile('src/helpPanelContents/caseWorkspaceHelp.js');
const aiGuidanceService = readRepoFile('src/server/adminAiGuidanceService.js');
const aiEvalFixtures = JSON.parse(
  readRepoFile('docs/testing/admin-ai-chatbot-eval-fixtures.json')
);

describe('two-step review help guidance', () => {
  test('application guidance explains the two review levels, EI authority, and conditional CFA follow-up', () => {
    expect(applicationAssessmentHelp).toContain('How the two-step review works');
    expect(applicationAssessmentHelp).toContain('Work moves up and down one level at a time');
    expect(applicationAssessmentHelp).toContain('Coordinators can view these fields but cannot set them');
    expect(applicationAssessmentHelp).toContain('CRF maps to CRF funding');
    expect(applicationAssessmentHelp).toContain('EI Active Claim and EI Reach Back map to EI funding');
    expect(applicationAssessmentHelp).toContain('exact application-linked Client Funding Agreement');
    expect(applicationAssessmentHelp).toContain('Zero-funding approvals have no CFA package');
  });

  test('intervention guidance preserves the later EI gate and exact post-approval CFA rule', () => {
    expect(proposedInterventionsHelp).toContain(
      'The submitter may send a new proposal or change to Regional Manager review before the final EI result is recorded.'
    );
    expect(proposedInterventionsHelp).toContain(
      'The Decision Maker cannot approve until the EI status is selected or confirmed.'
    );
    expect(proposedInterventionsHelp).toContain('Do not tell users EI verification must be completed before submitting a proposal for RM review.');
    expect(proposedInterventionsHelp).toContain("the exact Action Plan's Client Funding Agreement");
    expect(proposedInterventionsHelp).toContain('Zero-funding approvals have no CFA package');
    expect(proposedInterventionsHelp).not.toContain('attach EI verification before submitting for review');
    expect(proposedInterventionsHelp).not.toContain('attach the required document before submitting for review');
  });

  test('queue and workspace help separates queue ownership, EI alignment, and CFA completion', () => {
    for (const source of [
      approvalsItemsHelp,
      workQueueHelp,
      workQueueItemsHelp,
      applicationWorkspaceHelp,
      caseWorkspaceHelp,
    ]) {
      expect(source).toContain('EI status');
      expect(source).toMatch(/Client Funding Agreement|CFA/);
    }
    expect(approvalsItemsHelp).toContain('the Decision Maker has requested changes');
    expect(workQueueItemsHelp).toMatch(/the\s+Regional Manager reviews the Decision Maker note/);
    expect(applicationWorkspaceHelp).toContain('the corrected assessment passes RM review again');
    expect(caseWorkspaceHelp).toContain('Decision Maker-requested changes return to the RM first');
  });

  test('grounded AI examples cover the complete workflow, EI gates, and CFA production', () => {
    for (const marker of [
      'guidanceSlug: "two-step-review-up-down"',
      'guidanceSlug: "two-step-review-ei-gates"',
      'guidanceSlug: "two-step-review-cfa-production"',
      'PATH returns the read-only assessment to the Regional Manager first',
    ]) {
      expect(aiGuidanceService).toContain(marker);
    }

    const fixtureIds = new Set(aiEvalFixtures.map(fixture => fixture.id));
    expect(fixtureIds.has('two-step-review-up-down')).toBe(true);
    expect(fixtureIds.has('two-step-review-ei-gates')).toBe(true);
    expect(fixtureIds.has('two-step-review-cfa-production')).toBe(true);
  });
});
