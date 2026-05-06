-- PROD guarded runtime-config repair for feedback reports #78 and #82.
-- Purpose:
-- - Make assessment Evidence of Income / Evidence of Expense checklist items use
--   the backend conditional IDs so they are not always required.
-- - Keep the canonical active document types evidence_income / evidence_expense.
-- - Let intervention proposal checklist items accept the merged
--   band_funding_decision type as well as older band_funding_confirmation/denial.
-- - Remove the inactive financial_evidence reference from intervention checklist
--   config.
--
-- Recovery notes:
-- - This only updates iset_runtime_config(scope='checklist').
-- - To roll back, reverse the JSON_SET/JSON_ARRAY_APPEND changes below or
--   restore the prior JSON from a pre-run database snapshot/export.

DROP PROCEDURE IF EXISTS prod_fix_feedback_78_82_document_checklist_config;

DELIMITER //

CREATE PROCEDURE prod_fix_feedback_78_82_document_checklist_config()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_missing_type_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_runtime_config app_cfg
    JOIN iset_runtime_config intervention_cfg
      ON intervention_cfg.scope = 'checklist'
     AND intervention_cfg.k = 'checklist.compliance.iset.intervention'
   WHERE app_cfg.scope = 'checklist'
     AND app_cfg.k = 'checklist.compliance.iset'
     AND JSON_UNQUOTE(JSON_EXTRACT(app_cfg.v, '$.gates[0].items[9].id')) = 'evidence-of-income'
     AND JSON_UNQUOTE(JSON_EXTRACT(app_cfg.v, '$.gates[0].items[9].documentTypes[0]')) = 'evidence_income'
     AND JSON_UNQUOTE(JSON_EXTRACT(app_cfg.v, '$.gates[0].items[10].id')) = 'evidence-of-expense'
     AND JSON_UNQUOTE(JSON_EXTRACT(app_cfg.v, '$.gates[0].items[10].documentTypes[0]')) = 'evidence_expense'
     AND JSON_UNQUOTE(JSON_EXTRACT(app_cfg.v, '$.gates[2].items[0].id')) = 'evidence-of-expense-submit-assessment'
     AND JSON_UNQUOTE(JSON_EXTRACT(app_cfg.v, '$.gates[2].items[0].documentTypes[0]')) = 'evidence_expense'
     AND JSON_UNQUOTE(JSON_EXTRACT(app_cfg.v, '$.gates[2].items[1].id')) = 'evidence-of-income-submit-assessment'
     AND JSON_UNQUOTE(JSON_EXTRACT(app_cfg.v, '$.gates[2].items[1].documentTypes[0]')) = 'evidence_income'
     AND JSON_UNQUOTE(JSON_EXTRACT(intervention_cfg.v, '$.gates[0].items[0].id')) = 'band-funding-letter'
     AND JSON_CONTAINS(JSON_EXTRACT(intervention_cfg.v, '$.gates[0].items[0].documentTypes'), JSON_QUOTE('band_funding_decision')) = 0
     AND JSON_UNQUOTE(JSON_EXTRACT(intervention_cfg.v, '$.gates[1].items[0].id')) = 'band-funding-letter'
     AND JSON_CONTAINS(JSON_EXTRACT(intervention_cfg.v, '$.gates[1].items[0].documentTypes'), JSON_QUOTE('band_funding_decision')) = 0
     AND JSON_UNQUOTE(JSON_EXTRACT(intervention_cfg.v, '$.gates[0].items[3].id')) = 'intervention-financial-evidence'
     AND JSON_UNQUOTE(JSON_EXTRACT(intervention_cfg.v, '$.gates[0].items[3].documentTypes[0]')) = 'financial_evidence'
     AND JSON_UNQUOTE(JSON_EXTRACT(intervention_cfg.v, '$.gates[1].items[3].id')) = 'intervention-financial-evidence'
     AND JSON_UNQUOTE(JSON_EXTRACT(intervention_cfg.v, '$.gates[1].items[3].documentTypes[0]')) = 'financial_evidence';
  SELECT k
    FROM iset_runtime_config
   WHERE scope = 'checklist'
     AND k IN ('checklist.compliance.iset', 'checklist.compliance.iset.intervention')
   FOR UPDATE;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for checklist runtime-config repair; expected PROD checklist JSON was not found.';
  END IF;

  UPDATE iset_runtime_config
     SET v = JSON_SET(
           v,
           '$.gates[0].items[9].id', 'financial-records',
           '$.gates[0].items[10].id', 'financial-evidence',
           '$.gates[2].items[0].id', 'financial-evidence',
           '$.gates[2].items[1].id', 'financial-records'
         ),
         updated_at = NOW()
   WHERE scope = 'checklist'
     AND k = 'checklist.compliance.iset'
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Application checklist config update failed.';
  END IF;

  UPDATE iset_runtime_config
     SET v = JSON_ARRAY_APPEND(
           JSON_SET(
             v,
             '$.gates[0].items[3].documentTypes[0]', 'evidence_expense',
             '$.gates[1].items[3].documentTypes[0]', 'evidence_expense'
           ),
           '$.gates[0].items[0].documentTypes', 'band_funding_decision',
           '$.gates[1].items[0].documentTypes', 'band_funding_decision'
         ),
         updated_at = NOW()
   WHERE scope = 'checklist'
     AND k = 'checklist.compliance.iset.intervention'
   LIMIT 1;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Intervention checklist config update failed.';
  END IF;

  SELECT COUNT(*) INTO v_missing_type_count
    FROM iset_runtime_config cfg
    JOIN JSON_TABLE(cfg.v, '$.gates[*]' COLUMNS (
      gate_ord FOR ORDINALITY,
      NESTED PATH '$.items[*]' COLUMNS (
        item_ord FOR ORDINALITY,
        NESTED PATH '$.documentTypes[*]' COLUMNS (
          doc_type VARCHAR(128) PATH '$'
        )
      )
    )) jt
    LEFT JOIN document_type dt
      ON dt.code = jt.doc_type
     AND dt.is_active = 1
   WHERE cfg.scope = 'checklist'
     AND cfg.k IN ('checklist.compliance.iset', 'checklist.compliance.iset.intervention')
     AND jt.doc_type IS NOT NULL
     AND dt.id IS NULL;

  IF v_missing_type_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Checklist config still references inactive or missing document types after update.';
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_name, author_email, note_text)
  SELECT
    report_id,
    'Codex',
    'codex@local',
    note_text
  FROM (
    SELECT
      78 AS report_id,
      '2026-05-06 PROD config repair applied: intervention checklist band-funding-letter requirements now accept the merged band_funding_decision document type in addition to older band_funding_confirmation/band_funding_denial, so Band/Nation decision-letter uploads should clear proposal checklist requirements without file-specific recategorization.' AS note_text
    UNION ALL
    SELECT
      82 AS report_id,
      '2026-05-06 PROD config repair applied: assessment checklist Evidence of Income and Evidence of Expense items now use the backend conditional IDs and canonical active document types evidence_income/evidence_expense. Tuition/books-only applications with no income, expense, or living-allowance values should no longer be blocked by those missing-document rows.'
  ) notes
  WHERE NOT EXISTS (
    SELECT 1
      FROM admin_feedback_note existing
     WHERE existing.report_id = notes.report_id
       AND existing.note_text = notes.note_text
  );

  SELECT COUNT(*) INTO v_note_count
    FROM admin_feedback_note
   WHERE (report_id = 78 AND note_text LIKE '2026-05-06 PROD config repair applied: intervention checklist band-funding-letter requirements now accept%')
      OR (report_id = 82 AND note_text LIKE '2026-05-06 PROD config repair applied: assessment checklist Evidence of Income and Evidence of Expense items now use%');

  IF v_note_count < 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Feedback note verification failed for checklist config repair.';
  END IF;

  INSERT INTO admin_feedback_status_history
    (report_id, previous_status, new_status, changed_by_name, changed_by_email, changed_at)
  SELECT r.id, r.status, 'resolved', 'Codex', 'codex@local', NOW()
    FROM admin_feedback_report r
   WHERE r.id IN (78, 82)
     AND r.status <> 'resolved';

  UPDATE admin_feedback_report
     SET status = 'resolved',
         updated_at = NOW()
   WHERE id IN (78, 82)
     AND status <> 'resolved';

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_feedback_78_82_document_checklist_config();

DROP PROCEDURE IF EXISTS prod_fix_feedback_78_82_document_checklist_config;

SELECT scope, k, updated_at
  FROM iset_runtime_config
 WHERE scope = 'checklist'
   AND k IN ('checklist.compliance.iset', 'checklist.compliance.iset.intervention')
 ORDER BY k;

SELECT cfg.k, jt.gate_id, jt.item_id, jt.document_types
  FROM iset_runtime_config cfg
  JOIN JSON_TABLE(cfg.v, '$.gates[*]' COLUMNS (
    gate_id VARCHAR(128) PATH '$.id',
    NESTED PATH '$.items[*]' COLUMNS (
      item_id VARCHAR(160) PATH '$.id',
      document_types JSON PATH '$.documentTypes'
    )
  )) jt
 WHERE cfg.scope = 'checklist'
   AND cfg.k IN ('checklist.compliance.iset', 'checklist.compliance.iset.intervention')
   AND jt.item_id IN (
     'financial-records',
     'financial-evidence',
     'band-funding-letter',
     'intervention-financial-evidence'
   )
 ORDER BY cfg.k, jt.gate_id, jt.item_id;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (78, 82)
 ORDER BY id;
