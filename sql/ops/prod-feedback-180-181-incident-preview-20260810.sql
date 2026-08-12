-- Read-only PROD incident preview for feedback reports 180 and 181.
-- Live target identity proved on 2026-08-10:
-- database iset_intake; host ip-172-16-0-77; port 3306;
-- current user app_admin@%; MySQL 8.0.42.
-- SHOW CREATE TABLE, SHOW FULL COLUMNS, and SHOW INDEX proved every
-- admin_feedback_report identifier used below before execution.

SELECT id,
       report_type,
       severity,
       status,
       summary,
       description,
       submitted_by_email,
       submitted_by_role,
       page_title,
       page_path,
       submitted_at
  FROM admin_feedback_report
 WHERE id IN (180, 181)
 ORDER BY id;
