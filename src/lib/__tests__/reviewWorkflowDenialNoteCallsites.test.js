const fs = require('fs');
const path = require('path');

const readSource = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Decision Maker denial-note call sites', () => {
  test('the backend applies transition note requirements before updating a workflow', () => {
    const source = readSource('isetadminserver.js');

    expect(source).toContain('if (transition.requiresNote && !cleanNote)');
    expect(source).toContain("new Error('review_workflow_note_required')");
  });

  test('the application decision UI blocks a denial without its reason', () => {
    const source = readSource('src/widgets/CoordinatorAssessmentWidget.js');

    expect(source).toContain(
      "(decision === 'reject' || decision === 'push_back') && (!assessment.nwacReason || !assessment.nwacReason.trim())"
    );
    expect(source).toContain("'Reason for denial is required.'");
    expect(source).toContain(
      'assessment_nwac_reason: completeAssessmentPayload.assessment_nwac_reason'
    );
  });

  test('the intervention decision UI blocks a denial without its note', () => {
    const source = readSource(
      'src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx'
    );

    expect(source).toContain(
      'if (outcome === "rejected" && !form.decisionNotes.trim())'
    );
    expect(source).toMatch(
      /reasons\.push\(`Denying \$\{decisionSubjectThis\} requires a note\.`\)/
    );
    expect(source).toContain('decisionNotes: form.decisionNotes || ""');
  });
});
