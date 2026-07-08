-- Email System Administrators when a bug report or change request is saved as Critical.
-- Delivery uses the standard notification template/settings system so the row can be
-- managed from Manage Notifications after deployment.

SET @template_name := 'Critical bug or change request alert';
SET @template_subject := '[PATH] Critical {admin_feedback_report_type_label} #{admin_feedback_report_id}: {admin_feedback_summary}';
SET @template_body := 'A Critical bug report or change request was saved in PATH.

[b]Report ID:[/b] {admin_feedback_report_id}
[b]Type:[/b] {admin_feedback_report_type_label}
[b]Severity:[/b] {admin_feedback_severity_label}
[b]Summary:[/b] {admin_feedback_summary}
[b]Reporter:[/b] {admin_feedback_reporter_name} {admin_feedback_reporter_email}
[b]Reporter role:[/b] {admin_feedback_reporter_role}
[b]Captured page:[/b] {admin_feedback_page_title}
[b]Route:[/b] {admin_feedback_page_path}
[b]Submitted:[/b] {admin_feedback_submitted_at}
[b]Attachments:[/b] {admin_feedback_attachment_count}
[b]Trigger:[/b] {admin_feedback_trigger}

[b]Description:[/b]
{admin_feedback_description}

[link url="{admin_feedback_review_url}"]Open Bugs and Change Requests[/link]';

INSERT INTO notification_template (name, type, status, language, subject, content, localized)
SELECT
  @template_name,
  'Email',
  'Released',
  'en',
  @template_subject,
  @template_body,
  CAST(JSON_OBJECT(
    'en',
    JSON_OBJECT(
      'subject', @template_subject,
      'textBody', @template_body
    )
  ) AS JSON)
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_template
   WHERE name COLLATE utf8mb4_unicode_ci = @template_name
     AND type = 'Email'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
     AND status = 'Released'
);

SET @template_id := (
  SELECT id
    FROM notification_template
   WHERE name COLLATE utf8mb4_unicode_ci = @template_name
     AND type = 'Email'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
     AND status = 'Released'
   ORDER BY id DESC
   LIMIT 1
);

INSERT INTO notification_setting (event, role, template_id, language, enabled, email_alert, bell_alert)
SELECT 'admin_feedback_critical', 'System Administrator', @template_id, 'en', 1, 1, 0
WHERE NOT EXISTS (
  SELECT 1
    FROM notification_setting
   WHERE event COLLATE utf8mb4_unicode_ci = 'admin_feedback_critical'
     AND role COLLATE utf8mb4_unicode_ci = 'System Administrator'
     AND language COLLATE utf8mb4_unicode_ci = 'en'
);

UPDATE notification_setting
   SET template_id = @template_id,
       updated_at = NOW()
 WHERE event COLLATE utf8mb4_unicode_ci = 'admin_feedback_critical'
   AND role COLLATE utf8mb4_unicode_ci = 'System Administrator'
   AND language COLLATE utf8mb4_unicode_ci = 'en'
   AND template_id IS NULL
   AND @template_id IS NOT NULL;
