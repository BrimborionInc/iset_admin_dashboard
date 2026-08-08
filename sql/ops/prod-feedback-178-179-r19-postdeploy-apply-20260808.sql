-- Guarded note-only PROD reconciliation after release
-- 20260807-assessment-correction-hotfix-r19.
--
-- Scope: admin_feedback_report is guard/read-only; admin_feedback_note receives
-- one idempotent note for each report. No status/history/client/case/application/
-- workflow/document/runtime row is changed.

CREATE TEMPORARY TABLE tmp_feedback_178_179_r19_guard (
  guard_name VARCHAR(64) NOT NULL PRIMARY KEY
);

INSERT INTO tmp_feedback_178_179_r19_guard (guard_name)
VALUES ('reports_ready');

-- Deliberately fail closed through a duplicate primary key if either report is
-- absent or no longer in the reviewed in_progress state.
INSERT INTO tmp_feedback_178_179_r19_guard (guard_name)
SELECT 'reports_ready'
 WHERE NOT EXISTS (
         SELECT 1
           FROM admin_feedback_report AS r178
          WHERE r178.id = 178
            AND r178.status = 'in_progress'
       )
    OR NOT EXISTS (
         SELECT 1
           FROM admin_feedback_report AS r179
          WHERE r179.id = 179
            AND r179.status = 'in_progress'
       );

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text)
SELECT r178.id,
       NULL,
       'Codex',
       NULL,
       'Codex PROD deployment update 2026-08-08: Release 20260807-assessment-correction-hotfix-r19 deployed qualified admin commit 830875e475b1d278e726b8b7499e32acb0ad633b and qualified shared commit 0d06680b77e4e42ed71464775982f2012c11385e. Admin refresh 4c8c0985-212d-4b01-bdc6-1bca7d71ff7c and durable shared refresh eb3d67e0-9ffc-4632-a338-8d2ccdef5ef5 both completed successfully; the live shared correction module matches SHA-256 0d4b0d1f984af011d8c30f071dfff60ca9f357581bd7a9b4015786fd22f0fc0c and all three PROD /readyz endpoints returned 200. No schema, data, runtime-config, or portal application artifact was deployed. Machine qualification passed DEV 16/16, TEST 12/12, and the deployed two-step role journey 126/126 with zero residue. Report remains in_progress because Application 61 still requires the Coordinator correction, resubmission, Regional Manager review, renewed decision, and replacement artifact chain; deploying the prevention code does not complete that live business workflow.'
  FROM admin_feedback_report AS r178
 WHERE r178.id = 178
   AND r178.status = 'in_progress'
   AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_note AS n178
          WHERE n178.report_id = r178.id
            AND n178.author_name = 'Codex'
            AND n178.note_text = 'Codex PROD deployment update 2026-08-08: Release 20260807-assessment-correction-hotfix-r19 deployed qualified admin commit 830875e475b1d278e726b8b7499e32acb0ad633b and qualified shared commit 0d06680b77e4e42ed71464775982f2012c11385e. Admin refresh 4c8c0985-212d-4b01-bdc6-1bca7d71ff7c and durable shared refresh eb3d67e0-9ffc-4632-a338-8d2ccdef5ef5 both completed successfully; the live shared correction module matches SHA-256 0d4b0d1f984af011d8c30f071dfff60ca9f357581bd7a9b4015786fd22f0fc0c and all three PROD /readyz endpoints returned 200. No schema, data, runtime-config, or portal application artifact was deployed. Machine qualification passed DEV 16/16, TEST 12/12, and the deployed two-step role journey 126/126 with zero residue. Report remains in_progress because Application 61 still requires the Coordinator correction, resubmission, Regional Manager review, renewed decision, and replacement artifact chain; deploying the prevention code does not complete that live business workflow.'
       );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text)
SELECT r179.id,
       NULL,
       'Codex',
       NULL,
       'Codex PROD deployment update 2026-08-08: Release 20260807-assessment-correction-hotfix-r19 deployed qualified admin commit 830875e475b1d278e726b8b7499e32acb0ad633b and qualified shared commit 0d06680b77e4e42ed71464775982f2012c11385e. Admin refresh 4c8c0985-212d-4b01-bdc6-1bca7d71ff7c and durable shared refresh eb3d67e0-9ffc-4632-a338-8d2ccdef5ef5 both completed successfully; the live shared correction module matches SHA-256 0d4b0d1f984af011d8c30f071dfff60ca9f357581bd7a9b4015786fd22f0fc0c and all three PROD /readyz endpoints returned 200. No schema, data, runtime-config, or portal application artifact was deployed. The deployed TEST acceptance reproduced the legacy Amanda state and passed the complete correction, Financial Overview signing, optimistic resubmit, Regional Manager sign-off, and Decision Maker handoff chain within 126/126 assertions and zero residue. Report remains in_progress because Application 123 has not been authenticated and technically rechecked in PROD as Amanda; the remaining check is to prove the Pending Review route, Forward changes to Coordinator action, recorded-submitter edit/resubmit, and renewed Decision Maker handoff on that exact live workflow. No synthetic PROD workflow mutation was performed.'
  FROM admin_feedback_report AS r179
 WHERE r179.id = 179
   AND r179.status = 'in_progress'
   AND NOT EXISTS (
         SELECT 1
           FROM admin_feedback_note AS n179
          WHERE n179.report_id = r179.id
            AND n179.author_name = 'Codex'
            AND n179.note_text = 'Codex PROD deployment update 2026-08-08: Release 20260807-assessment-correction-hotfix-r19 deployed qualified admin commit 830875e475b1d278e726b8b7499e32acb0ad633b and qualified shared commit 0d06680b77e4e42ed71464775982f2012c11385e. Admin refresh 4c8c0985-212d-4b01-bdc6-1bca7d71ff7c and durable shared refresh eb3d67e0-9ffc-4632-a338-8d2ccdef5ef5 both completed successfully; the live shared correction module matches SHA-256 0d4b0d1f984af011d8c30f071dfff60ca9f357581bd7a9b4015786fd22f0fc0c and all three PROD /readyz endpoints returned 200. No schema, data, runtime-config, or portal application artifact was deployed. The deployed TEST acceptance reproduced the legacy Amanda state and passed the complete correction, Financial Overview signing, optimistic resubmit, Regional Manager sign-off, and Decision Maker handoff chain within 126/126 assertions and zero residue. Report remains in_progress because Application 123 has not been authenticated and technically rechecked in PROD as Amanda; the remaining check is to prove the Pending Review route, Forward changes to Coordinator action, recorded-submitter edit/resubmit, and renewed Decision Maker handoff on that exact live workflow. No synthetic PROD workflow mutation was performed.'
       );

COMMIT;

SELECT r.id,
       r.status,
       r.updated_at
  FROM admin_feedback_report AS r
 WHERE r.id IN (178, 179)
 ORDER BY r.id;

SELECT n.id,
       n.report_id,
       n.author_name,
       n.note_text,
       n.created_at
  FROM admin_feedback_note AS n
 WHERE n.report_id IN (178, 179)
   AND n.author_name = 'Codex'
   AND n.note_text LIKE 'Codex PROD deployment update 2026-08-08:%'
 ORDER BY n.report_id, n.id;

DROP TEMPORARY TABLE tmp_feedback_178_179_r19_guard;
