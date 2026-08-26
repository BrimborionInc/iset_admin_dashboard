const fs = require('fs');
const path = require('path');

const repairSource = fs.readFileSync(
  path.resolve(__dirname, '../../../scripts/prod-repair-feedback-173.js'),
  'utf8'
);
const deploySource = fs.readFileSync(
  path.resolve(__dirname, '../../../scripts/path-deploy.js'),
  'utf8'
);

describe('feedback 173 guarded recovery contract', () => {
  test('pins every affected PROD identity and requires explicit apply/rollback confirmations', () => {
    for (const marker of [
      'const CASE_ID = 12;',
      'const APPLICATION_ID = 95;',
      'const ASSESSMENT_ID = 492;',
      'const HISTORICAL_PLAN_ID = 36;',
      'const INCORRECT_CFA_SERIES_ID = 38;',
      'const INCORRECT_CFA_VERSION_ID = 33;',
      'const INCORRECT_SIGNED_DOCUMENT_ID = 8527;',
      'const INCORRECT_SIGNING_REQUEST_ID = 148;',
      '--confirm=PROD-FEEDBACK-173-CASE-12',
      '--confirm=ROLLBACK-PROD-FEEDBACK-173-CASE-12',
    ]) {
      expect(repairSource).toContain(marker);
    }
  });

  test('uses canonical application materialization and CFA generation before guarded lifecycle repair', () => {
    expect(repairSource).toContain('ensureAutoPlanAndInterventionFromAssessment(connection, {');
    expect(repairSource).toContain('createCfaVersionForPlan({');
    expect(repairSource).toContain("changeReason: 'CORRECTION_AFTER_SEND'");
    expect(repairSource).toContain("SET status = 'withdrawn'");
    expect(repairSource).toContain("SET status = 'approved'");
    expect(repairSource).toContain("lifecycle_status = 'active'");
  });

  test('keeps a fail-closed rollback path that refuses a corrected CFA already sent to the participant', () => {
    expect(repairSource).toContain("assertCondition(correctedVersion?.status === 'draft'");
    expect(repairSource).toContain("assertCondition(!correctedSigning, 'corrected_cfa_already_sent')");
    expect(repairSource).toContain("SET status = 'archived'");
    expect(repairSource).toContain("SET status = 'cancelled'");
    expect(repairSource).toContain('DELETE FROM esdc_participant_submission');
    expect(repairSource).toContain("AND submission_status = 'pending'");
  });

  test('keeps the completed one-off PROD repair out of later runtime release artifacts', () => {
    expect(deploySource).not.toContain("'prod-repair-feedback-173.js'");
  });
});
