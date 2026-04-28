-- Apply duplicate-case consolidation for the one-client/one-case model.
-- Intended for TEST rehearsal and PROD only after the preview has been reviewed,
-- a restore point exists, and the privacy ERM schema migrations have produced
-- explicit iset_application.case_id / client_id links.

CREATE TABLE IF NOT EXISTS iset_case_merge_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  surviving_case_id BIGINT UNSIGNED NOT NULL,
  merged_case_id BIGINT UNSIGNED NOT NULL,
  surviving_client_id BIGINT UNSIGNED DEFAULT NULL,
  merged_client_id BIGINT UNSIGNED DEFAULT NULL,
  merged_by_staff_profile_id BIGINT UNSIGNED DEFAULT NULL,
  merge_reason VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  repointed_application_count INT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT COLLATE utf8mb4_unicode_ci,
  metadata_json JSON DEFAULT NULL,
  merged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_case_merge_audit_surviving (surviving_case_id, merged_at),
  KEY idx_case_merge_audit_merged (merged_case_id, merged_at),
  KEY idx_case_merge_audit_surviving_client (surviving_client_id),
  KEY idx_case_merge_audit_merged_client (merged_client_id),
  KEY idx_case_merge_audit_actor (merged_by_staff_profile_id),
  CONSTRAINT fk_case_merge_audit_surviving FOREIGN KEY (surviving_case_id) REFERENCES iset_case (id) ON DELETE RESTRICT,
  CONSTRAINT fk_case_merge_audit_merged FOREIGN KEY (merged_case_id) REFERENCES iset_case (id) ON DELETE RESTRICT,
  CONSTRAINT fk_case_merge_audit_surviving_client FOREIGN KEY (surviving_client_id) REFERENCES client (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_merge_audit_merged_client FOREIGN KEY (merged_client_id) REFERENCES client (id) ON DELETE SET NULL,
  CONSTRAINT fk_case_merge_audit_actor FOREIGN KEY (merged_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_metrics;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_ranked;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_ranked_copy;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_plan;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_blockers;

CREATE TEMPORARY TABLE tmp_privacy_erm_duplicate_case_metrics AS
SELECT
  c.client_id,
  CONCAT(cl.first_name, ' ', cl.last_name) AS client_name,
  c.id AS case_id,
  c.case_number,
  c.status,
  c.lifecycle_status,
  c.assigned_staff_profile_id,
  c.created_at,
  c.updated_at,
  (SELECT COUNT(*) FROM iset_application x WHERE x.case_id = c.id) AS applications,
  (SELECT COUNT(*) FROM iset_case_assessment x WHERE x.case_id = c.id) AS assessments,
  (SELECT COUNT(*) FROM iset_case_action_plan x WHERE x.case_id = c.id) AS action_plans,
  (SELECT COUNT(*) FROM iset_case_action_plan x WHERE x.case_id = c.id AND LOWER(COALESCE(x.status, '')) NOT IN ('closed', 'cancelled', 'canceled', 'completed', 'archived')) AS open_action_plans,
  (SELECT COUNT(*) FROM iset_case_intervention x WHERE x.case_id = c.id) AS interventions,
  (SELECT COUNT(*) FROM iset_case_intervention x WHERE x.case_id = c.id AND LOWER(COALESCE(x.status, '')) NOT IN ('closed', 'cancelled', 'canceled', 'completed', 'archived')) AS open_interventions,
  (SELECT COUNT(*) FROM iset_intervention_proposal x WHERE x.case_id = c.id) AS intervention_proposals,
  (SELECT COUNT(*) FROM iset_intervention_proposal x WHERE x.case_id = c.id AND LOWER(COALESCE(x.review_status, '')) NOT IN ('closed', 'cancelled', 'canceled', 'completed', 'archived', 'approved')) AS open_intervention_proposals,
  (SELECT COUNT(*) FROM iset_document x WHERE x.case_id = c.id) AS documents,
  (SELECT COUNT(*) FROM messages x WHERE x.case_id = c.id) AS messages,
  (SELECT COUNT(*) FROM message_attachment x WHERE x.case_id = c.id) AS message_attachments,
  (SELECT COUNT(*) FROM signing_request x WHERE x.case_id = c.id) AS signing_requests,
  (SELECT COUNT(*) FROM cfa_series x WHERE x.case_id = c.id) AS cfa_series,
  (SELECT COUNT(*) FROM payment_packet x WHERE x.case_id = c.id) AS payment_packets,
  (SELECT COUNT(*) FROM finance_transaction x WHERE x.case_id = c.id) AS finance_transactions,
  (SELECT COUNT(*) FROM esdc_participant_submission x WHERE x.case_id = c.id) AS esdc_submissions,
  (SELECT COUNT(*) FROM iset_application_escalation x WHERE x.case_id = c.id) AS escalations,
  (SELECT COUNT(*) FROM iset_case_conflict_declaration x WHERE x.case_id = c.id) AS conflict_declarations,
  (SELECT COUNT(*) FROM iset_case_note x WHERE x.case_id = c.id) AS notes,
  (SELECT COUNT(*) FROM iset_case_task x WHERE x.case_id = c.id) AS tasks,
  (SELECT COUNT(*) FROM iset_case_event x WHERE x.case_id = c.id) AS events,
  (SELECT COUNT(*) FROM iset_case_reminder x WHERE x.case_id = c.id) AS reminders,
  (SELECT COUNT(*) FROM iset_case_watch x WHERE x.case_id = c.id) AS watches,
  (SELECT COUNT(*) FROM iset_case_action_item x WHERE x.case_id = c.id) AS action_items,
  (SELECT COUNT(*) FROM iset_case_compliance_check x WHERE x.case_id = c.id) AS compliance_checks,
  (SELECT COUNT(*) FROM iset_case_financial_snapshot x WHERE x.case_id = c.id) AS financial_snapshots,
  (SELECT COUNT(*) FROM iset_applicant_watchlist x WHERE x.source_case_id = c.id) AS applicant_watchlist_refs
FROM iset_case c
JOIN client cl ON cl.id = c.client_id
JOIN (
  SELECT client_id
  FROM iset_case
  WHERE client_id IS NOT NULL
  GROUP BY client_id
  HAVING COUNT(*) > 1
) duplicate_clients ON duplicate_clients.client_id = c.client_id
WHERE c.client_id IS NOT NULL;

ALTER TABLE tmp_privacy_erm_duplicate_case_metrics
  ADD COLUMN active_operational_refs INT NOT NULL DEFAULT 0,
  ADD COLUMN total_ref_count INT NOT NULL DEFAULT 0,
  ADD COLUMN status_rank INT NOT NULL DEFAULT 0;

UPDATE tmp_privacy_erm_duplicate_case_metrics
SET
  active_operational_refs = open_action_plans + open_interventions + open_intervention_proposals,
  total_ref_count =
      applications
    + assessments
    + action_plans
    + interventions
    + intervention_proposals
    + documents
    + messages
    + message_attachments
    + signing_requests
    + cfa_series
    + payment_packets
    + finance_transactions
    + esdc_submissions
    + escalations
    + conflict_declarations
    + notes
    + tasks
    + events
    + reminders
    + watches
    + action_items
    + compliance_checks
    + financial_snapshots
    + applicant_watchlist_refs,
  status_rank = CASE
    WHEN LOWER(COALESCE(lifecycle_status, status, '')) IN ('active', 'intake', 'initiated', 'ready_to_close') THEN 0
    WHEN LOWER(COALESCE(lifecycle_status, status, '')) = 'dormant' THEN 1
    WHEN LOWER(COALESCE(lifecycle_status, status, '')) IN ('closed', 'archived') THEN 2
    ELSE 0
  END;

CREATE TEMPORARY TABLE tmp_privacy_erm_duplicate_case_ranked AS
SELECT
  m.*,
  ROW_NUMBER() OVER (
    PARTITION BY m.client_id
    ORDER BY
      CASE WHEN m.active_operational_refs > 0 THEN 1 ELSE 0 END DESC,
      m.total_ref_count DESC,
      CASE WHEN m.assigned_staff_profile_id IS NOT NULL THEN 1 ELSE 0 END DESC,
      m.status_rank ASC,
      COALESCE(m.updated_at, m.created_at) DESC,
      m.case_id DESC
  ) AS survivor_rank
FROM tmp_privacy_erm_duplicate_case_metrics m;

CREATE TEMPORARY TABLE tmp_privacy_erm_duplicate_case_ranked_copy AS
SELECT * FROM tmp_privacy_erm_duplicate_case_ranked;

CREATE TEMPORARY TABLE tmp_privacy_erm_duplicate_case_plan AS
SELECT
  survivor.client_id,
  survivor.client_name,
  survivor.case_id AS surviving_case_id,
  survivor.case_number AS surviving_case_number,
  survivor.status AS surviving_status,
  survivor.lifecycle_status AS surviving_lifecycle_status,
  survivor.active_operational_refs AS surviving_active_operational_refs,
  survivor.total_ref_count AS surviving_total_ref_count,
  merged.case_id AS merged_case_id,
  merged.case_number AS merged_case_number,
  merged.status AS merged_status,
  merged.lifecycle_status AS merged_lifecycle_status,
  merged.active_operational_refs AS merged_active_operational_refs,
  merged.total_ref_count AS merged_total_ref_count,
  merged.applications AS merged_applications,
  CASE
    WHEN survivor.active_operational_refs > 0 THEN 'survivor_has_open_action_plan_or_intervention'
    WHEN survivor.total_ref_count > 0 THEN 'survivor_has_richest_case_history'
    WHEN survivor.assigned_staff_profile_id IS NOT NULL THEN 'survivor_is_assigned_open_case'
    ELSE 'survivor_is_most_recent_case'
  END AS selection_reason
FROM tmp_privacy_erm_duplicate_case_ranked survivor
JOIN tmp_privacy_erm_duplicate_case_ranked_copy merged
  ON merged.client_id = survivor.client_id
 AND merged.survivor_rank > 1
WHERE survivor.survivor_rank = 1;

CREATE TEMPORARY TABLE tmp_privacy_erm_duplicate_case_blockers (
  client_id BIGINT UNSIGNED NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  surviving_case_id BIGINT UNSIGNED NOT NULL,
  merged_case_id BIGINT UNSIGNED NOT NULL,
  blocker_type VARCHAR(128) NOT NULL,
  blocker_detail VARCHAR(512) NULL
) ENGINE=Memory;

INSERT INTO tmp_privacy_erm_duplicate_case_blockers
SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id,
       'case_assessment_conflict',
       'Both survivor and merged case have iset_case_assessment rows'
FROM tmp_privacy_erm_duplicate_case_plan p
WHERE EXISTS (SELECT 1 FROM iset_case_assessment x WHERE x.case_id = p.surviving_case_id)
  AND EXISTS (SELECT 1 FROM iset_case_assessment x WHERE x.case_id = p.merged_case_id);

INSERT INTO tmp_privacy_erm_duplicate_case_blockers
SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id,
       'case_watch_duplicate',
       CONCAT('staff_profile_id=', merged_watch.staff_profile_id)
FROM tmp_privacy_erm_duplicate_case_plan p
JOIN iset_case_watch merged_watch ON merged_watch.case_id = p.merged_case_id
JOIN iset_case_watch survivor_watch
  ON survivor_watch.case_id = p.surviving_case_id
 AND survivor_watch.staff_profile_id = merged_watch.staff_profile_id;

INSERT INTO tmp_privacy_erm_duplicate_case_blockers
SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id,
       'active_conflict_declaration_duplicate',
       CONCAT('staff_profile_id=', merged_conflict.staff_profile_id, ', is_active=', merged_conflict.is_active)
FROM tmp_privacy_erm_duplicate_case_plan p
JOIN iset_case_conflict_declaration merged_conflict ON merged_conflict.case_id = p.merged_case_id
JOIN iset_case_conflict_declaration survivor_conflict
  ON survivor_conflict.case_id = p.surviving_case_id
 AND survivor_conflict.staff_profile_id = merged_conflict.staff_profile_id
 AND survivor_conflict.is_active = merged_conflict.is_active;

INSERT INTO tmp_privacy_erm_duplicate_case_blockers
SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id,
       'financial_snapshot_date_duplicate',
       CONCAT('as_of_date=', merged_snapshot.as_of_date)
FROM tmp_privacy_erm_duplicate_case_plan p
JOIN iset_case_financial_snapshot merged_snapshot ON merged_snapshot.case_id = p.merged_case_id
JOIN iset_case_financial_snapshot survivor_snapshot
  ON survivor_snapshot.case_id = p.surviving_case_id
 AND survivor_snapshot.as_of_date = merged_snapshot.as_of_date;

INSERT INTO tmp_privacy_erm_duplicate_case_blockers
SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id,
       'multiple_cases_with_open_operational_history',
       'More than one duplicate case has open action-plan/intervention/proposal history'
FROM tmp_privacy_erm_duplicate_case_plan p
WHERE (
  SELECT COUNT(*)
  FROM tmp_privacy_erm_duplicate_case_metrics m
  WHERE m.client_id = p.client_id
    AND m.active_operational_refs > 0
) > 1;

SELECT *
FROM tmp_privacy_erm_duplicate_case_blockers
ORDER BY client_name, merged_case_id, blocker_type;

SET @privacy_erm_duplicate_case_blockers = (
  SELECT COUNT(*) FROM tmp_privacy_erm_duplicate_case_blockers
);

SET @sql = IF(@privacy_erm_duplicate_case_blockers > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''duplicate case consolidation blockers remain; review preview output before apply''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @privacy_erm_case_merge_run_id = CONCAT('duplicate-case-consolidation-', DATE_FORMAT(UTC_TIMESTAMP(), '%Y%m%d%H%i%s'));

START TRANSACTION;

INSERT INTO iset_case_merge_audit (
  surviving_case_id,
  merged_case_id,
  surviving_client_id,
  merged_client_id,
  merged_by_staff_profile_id,
  merge_reason,
  repointed_application_count,
  notes,
  metadata_json
)
SELECT
  p.surviving_case_id,
  p.merged_case_id,
  p.client_id,
  p.client_id,
  NULL,
  'Privacy ERM duplicate-case consolidation for one-client/one-case target model.',
  p.merged_applications,
  CONCAT('Run ', @privacy_erm_case_merge_run_id, '; selection_reason=', p.selection_reason),
  JSON_OBJECT(
    'run_id', @privacy_erm_case_merge_run_id,
    'client_name', p.client_name,
    'surviving_case_number', p.surviving_case_number,
    'merged_case_number', p.merged_case_number,
    'selection_reason', p.selection_reason,
    'surviving_active_operational_refs', p.surviving_active_operational_refs,
    'surviving_total_ref_count', p.surviving_total_ref_count,
    'merged_active_operational_refs', p.merged_active_operational_refs,
    'merged_total_ref_count', p.merged_total_ref_count
  )
FROM tmp_privacy_erm_duplicate_case_plan p;

UPDATE iset_application x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, x.updated_at = NOW();
UPDATE iset_case_assessment x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, x.updated_at = NOW();
UPDATE iset_case_action_plan x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, x.updated_at = NOW();
UPDATE iset_case_intervention x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, x.updated_at = NOW();
UPDATE iset_intervention_proposal x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, x.updated_at = NOW();
UPDATE iset_document x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, x.updated_at = NOW();
UPDATE messages x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id;
UPDATE message_attachment x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id;
UPDATE signing_request x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, x.updated_at = NOW();
UPDATE cfa_series x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id;
UPDATE payment_packet x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, updated_at = NOW();
UPDATE finance_transaction x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, updated_at = NOW();
UPDATE esdc_participant_submission x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, updated_at = NOW();
UPDATE iset_application_escalation x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, updated_at = NOW();
UPDATE iset_case_conflict_declaration x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id;
UPDATE iset_case_note x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id;
UPDATE iset_case_task x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, updated_at = NOW();
UPDATE iset_case_event x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id;
UPDATE iset_case_reminder x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, updated_at = NOW();
UPDATE iset_case_watch x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id;
UPDATE iset_case_action_item x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, updated_at = NOW();
UPDATE iset_case_compliance_check x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id, updated_at = NOW();
UPDATE iset_case_financial_snapshot x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.case_id SET x.case_id = p.surviving_case_id;
UPDATE iset_applicant_watchlist x JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = x.source_case_id SET x.source_case_id = p.surviving_case_id;

UPDATE iset_case survivor
JOIN tmp_privacy_erm_duplicate_case_plan p ON p.surviving_case_id = survivor.id
JOIN iset_case merged_case ON merged_case.id = p.merged_case_id
SET
  survivor.assigned_staff_profile_id = COALESCE(survivor.assigned_staff_profile_id, merged_case.assigned_staff_profile_id),
  survivor.portfolio_region_id = COALESCE(survivor.portfolio_region_id, merged_case.portfolio_region_id),
  survivor.case_context_json = JSON_SET(
    JSON_MERGE_PATCH(
      COALESCE(survivor.case_context_json, JSON_OBJECT()),
      COALESCE(merged_case.case_context_json, JSON_OBJECT())
    ),
    '$.privacy_erm_merged_case_id',
    p.merged_case_id,
    '$.privacy_erm_merged_case_number',
    p.merged_case_number,
    '$.privacy_erm_case_merge_run_id',
    @privacy_erm_case_merge_run_id
  ),
  survivor.updated_at = NOW();

UPDATE iset_case merged_case
JOIN tmp_privacy_erm_duplicate_case_plan p ON p.merged_case_id = merged_case.id
SET
  merged_case.client_id = NULL,
  merged_case.assigned_staff_profile_id = NULL,
  merged_case.status = 'archived',
  merged_case.lifecycle_status = 'archived',
  merged_case.stage = 'merged_duplicate',
  merged_case.closed_at = COALESCE(merged_case.closed_at, NOW()),
  merged_case.case_context_json = JSON_SET(
    COALESCE(merged_case.case_context_json, JSON_OBJECT()),
    '$.privacy_erm_merged_into_case_id',
    p.surviving_case_id,
    '$.privacy_erm_merged_into_case_number',
    p.surviving_case_number,
    '$.privacy_erm_case_merge_run_id',
    @privacy_erm_case_merge_run_id
  ),
  merged_case.updated_at = NOW();

CREATE TEMPORARY TABLE tmp_privacy_erm_duplicate_case_remaining_refs (
  table_name VARCHAR(128) NOT NULL,
  row_count INT NOT NULL
) ENGINE=Memory;

INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_application', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_application x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_assessment', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_assessment x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_action_plan', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_action_plan x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_intervention', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_intervention x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_intervention_proposal', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_intervention_proposal x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_document', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_document x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'messages', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN messages x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'message_attachment', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN message_attachment x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'signing_request', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN signing_request x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'cfa_series', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN cfa_series x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'payment_packet', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN payment_packet x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'finance_transaction', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN finance_transaction x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'esdc_participant_submission', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN esdc_participant_submission x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_application_escalation', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_application_escalation x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_conflict_declaration', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_conflict_declaration x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_note', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_note x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_task', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_task x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_event', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_event x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_reminder', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_reminder x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_watch', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_watch x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_action_item', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_action_item x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_compliance_check', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_compliance_check x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_case_financial_snapshot', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_financial_snapshot x ON x.case_id = p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_remaining_refs SELECT 'iset_applicant_watchlist', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_applicant_watchlist x ON x.source_case_id = p.merged_case_id;

SET @privacy_erm_remaining_duplicate_case_refs = (
  SELECT COALESCE(SUM(row_count), 0)
  FROM tmp_privacy_erm_duplicate_case_remaining_refs
);

SET @privacy_erm_remaining_duplicate_clients = (
  SELECT COUNT(*)
  FROM (
    SELECT client_id
    FROM iset_case
    WHERE client_id IS NOT NULL
    GROUP BY client_id
    HAVING COUNT(*) > 1
  ) duplicate_clients
);

SET @sql = IF(@privacy_erm_remaining_duplicate_case_refs > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''merged duplicate case still has case-owned references after consolidation''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@privacy_erm_remaining_duplicate_clients > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''duplicate client case groups remain after consolidation''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT
  @privacy_erm_case_merge_run_id AS cleanup_run_id,
  (SELECT COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan) AS merged_case_pairs,
  @privacy_erm_remaining_duplicate_case_refs AS remaining_case_refs,
  @privacy_erm_remaining_duplicate_clients AS remaining_duplicate_clients;

COMMIT;
