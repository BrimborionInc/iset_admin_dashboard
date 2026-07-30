const fs = require('fs');
const path = require('path');

const readSource = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const extractBetween = (source, start, end) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('decision-letter external AI boundary', () => {
  const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');
  const generateLetterDraft = extractBetween(
    source,
    'const generateLetterDraft = async',
    'const handleGenerateLetterDraft = async'
  );

  test('has only the narrow approval copy-editing call', () => {
    const externalAiCalls = generateLetterDraft.match(/apiFetch\('\/api\/ai\/chat'/g) || [];

    expect(externalAiCalls).toHaveLength(1);
    expect(generateLetterDraft).toContain('const aiContext = {');
    expect(generateLetterDraft).toContain('request_mode: requestPhraseMode');
    expect(generateLetterDraft).toContain('has_multiple_interventions: interventions.length > 1');
    expect(generateLetterDraft).toContain(
      "approval_mode: approvalLetterHasFunding ? 'funded_intervention' : 'intervention_only'"
    );
  });

  test('does not construct an applicant or case payload for external AI', () => {
    [
      'const contextPayload =',
      'applicant_name:',
      'applicant_full_name:',
      'tracking_id:',
      'case_number:',
      'case_manager_name:',
      'case_manager_email:',
      'applicant_labour_force_status:',
      'applicant_highest_education:',
      'applicant_legal_indigenous_identity:',
    ].forEach(marker => {
      expect(generateLetterDraft).not.toContain(marker);
    });
  });

  test('builds denial drafts locally after the approval branch returns', () => {
    const approvalBranchStart = generateLetterDraft.indexOf('if (!isDenialDraft)');
    const externalAiCall = generateLetterDraft.indexOf("apiFetch('/api/ai/chat'");
    const approvalReturn = generateLetterDraft.indexOf('return;', externalAiCall);
    const denialTemplate = generateLetterDraft.indexOf('denialTemplateDraft = buildDenialTemplateDraftForReason');

    expect(approvalBranchStart).toBeGreaterThanOrEqual(0);
    expect(externalAiCall).toBeGreaterThan(approvalBranchStart);
    expect(approvalReturn).toBeGreaterThan(externalAiCall);
    expect(denialTemplate).toBeGreaterThan(approvalReturn);
    expect(generateLetterDraft.slice(denialTemplate)).not.toContain("apiFetch('/api/ai/chat'");
  });
});
