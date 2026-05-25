-- PROD feedback #117 Cognito diagnostics note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @noted_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 117, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex diagnostics note 2026-05-25: Checked Cognito-side evidence for report #117. PROD public portal is using applicant pool ca-central-1_1TMlyEAK5 / nwac-prod-portal with EmailConfiguration.EmailSendingAccount=COGNITO_DEFAULT, so these activation-code emails are sent through AWS-managed Cognito email rather than the PATH SES sender. AdminGetUser confirms kaaylcee@gmail.com exists in Cognito, is Enabled=true, UserStatus=CONFIRMED, and email_verified=true. This supports that the CodeDeliveryDetails entries are for a real, verified account. Further diagnosis from AWS would require Cognito userNotification ERROR log delivery / CloudWatch access or AWS support review; current operator/app role access is denied for cognito-idp:GetLogDeliveryConfiguration, and Cognito-managed email does not expose the same account-level SES bounce/suppression diagnostics that PATH SES messages would.'
       ),
       @noted_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 117
      AND note_text LIKE 'Codex diagnostics note 2026-05-25: Checked Cognito-side evidence for report #117%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 117;

SELECT report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 117
 ORDER BY created_at DESC, id DESC
 LIMIT 3;
