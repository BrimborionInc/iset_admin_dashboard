START TRANSACTION;

INSERT INTO admin_feedback_note (
  report_id,
  author_name,
  author_email,
  note_text,
  created_at
)
SELECT
  126,
  'Codex',
  'codex@awentech.ca',
  'PROD release 20260527-prod-casework-ilmp-hotfix deployed the durable applicant-account email correction path. Case Header now has Change PATH account email for unactivated PATH accounts; the backend repoints the client/local portal user/Cognito identity, resets invitation state, updates the client contact email, attempts to delete the old typo Cognito user, and records account_email_changed before staff resend activation. Live data for this report was already repaired and verified earlier on 2026-05-27.',
  NOW()
WHERE EXISTS (
  SELECT 1
  FROM admin_feedback_report
  WHERE id = 126
    AND status = 'resolved'
);

INSERT INTO admin_feedback_note (
  report_id,
  author_name,
  author_email,
  note_text,
  created_at
)
SELECT
  124,
  'Codex',
  'codex@awentech.ca',
  'PROD release 20260527-prod-casework-ilmp-hotfix deployed the current casework/ILMP correction batch, including long intervention duration capping, residence-cost payment mapping/edit corrections, closeout-only intervention outcomes, action-plan closeout persistence, and ILMP participant queue pagination/sorting. This report remains in_progress pending targeted live recheck of the reported financial correction workflow before it can be marked resolved.',
  NOW()
WHERE EXISTS (
  SELECT 1
  FROM admin_feedback_report
  WHERE id = 124
    AND status = 'in_progress'
);

UPDATE admin_feedback_report
SET updated_at = NOW()
WHERE id IN (124, 126);

COMMIT;
