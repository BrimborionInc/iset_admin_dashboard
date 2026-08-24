const fs = require('fs');
const path = require('path');

const readSource = relativePath => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const functionSlice = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe('retired PATH role aliases', () => {
  test('the escalation authorization normalizer accepts only current PATH roles', () => {
    const source = readSource('isetadminserver.js');
    const normalizer = functionSlice(
      source,
      'function canonicalEscalationRole(role)',
      'function resolveStaffRole(req)'
    );

    expect(normalizer).toContain("return 'nwac_administrator'");
    expect(normalizer).toContain("return 'regional_manager'");
    expect(normalizer).toContain("return 'iset_coordinator'");
    expect(normalizer).toContain("return 'system_administrator'");
    expect(normalizer).toContain('return null;');
    expect(normalizer).not.toMatch(/program_?(?:admin|administrator)|regional_?coordinator|application_?assessor|adjudicator/u);
  });

  test('frontend escalation, tutorial, prompt, and queue gates do not translate retired roles', () => {
    const overviewSource = readSource('src/widgets/ApplicationOverviewWidget.js');
    const overviewNormalizer = functionSlice(
      overviewSource,
      'const normalizeEscalationRole =',
      'const formatRoleLabel ='
    );
    const appContentSource = readSource('src/AppContent.js');
    const promptRoleSets = functionSlice(
      appContentSource,
      'const APPLICATION_WORKSPACE_PROMPT_ROLE_KEYS',
      'const CONTEXT_FACTS ='
    );
    const tutorialSource = readSource('src/tutorials/tutorialPlatform.js');
    const tutorialRoleGates = functionSlice(
      tutorialSource,
      'const getHomeIntroTutorialIdForRole =',
      'const isTutorialRelevantForRole ='
    );
    const workQueueSource = readSource('src/pages/home/widgets/ProgramAdminWorkQueueWidget.js');
    const workQueueNormalizer = functionSlice(
      workQueueSource,
      'const normalizeRoleKey =',
      'const buildBucketStorageKey ='
    );

    for (const gateSource of [
      overviewNormalizer,
      promptRoleSets,
      tutorialRoleGates,
      workQueueNormalizer,
    ]) {
      expect(gateSource).not.toMatch(/['"]program[ _](?:admin|administrator)['"]/u);
    }
    expect(overviewNormalizer).not.toMatch(/application_assessor|regional_coordinator|program_administrator/u);
  });
});
