-- Immediate pre-apply guard preview for feedback #179.
SELECT id, report_type, severity, status, submitted_by_staff_profile_id,
       submitted_by_name, submitted_by_email, submitted_by_role, updated_at
FROM admin_feedback_report
WHERE id = 179;

SELECT id, email, name, display_name, primary_role, status
FROM staff_profiles
WHERE id = 54;

SELECT id, report_id, author_name, note_text, created_at
FROM admin_feedback_note
WHERE report_id = 179
ORDER BY id;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
FROM admin_feedback_status_history
WHERE report_id = 179
ORDER BY id;
