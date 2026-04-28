-- Preview duplicate-case consolidation for the one-client/one-case model.
-- Read-only. Intended to run after the privacy ERM schema migrations have
-- produced explicit iset_application.case_id / client_id links.

DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_metrics;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_ranked;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_ranked_copy;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_plan;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_blockers;
DROP TEMPORARY TABLE IF EXISTS tmp_privacy_erm_duplicate_case_ref_counts;

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

CREATE TEMPORARY TABLE tmp_privacy_erm_duplicate_case_ref_counts (
  client_id BIGINT UNSIGNED NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  surviving_case_id BIGINT UNSIGNED NOT NULL,
  merged_case_id BIGINT UNSIGNED NOT NULL,
  table_name VARCHAR(128) NOT NULL,
  row_count INT NOT NULL
) ENGINE=Memory;

INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_application', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_application x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_assessment', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_assessment x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_action_plan', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_action_plan x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_intervention', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_intervention x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_intervention_proposal', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_intervention_proposal x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_document', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_document x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'messages', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN messages x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'message_attachment', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN message_attachment x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'signing_request', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN signing_request x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'cfa_series', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN cfa_series x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'payment_packet', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN payment_packet x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'finance_transaction', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN finance_transaction x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'esdc_participant_submission', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN esdc_participant_submission x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_application_escalation', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_application_escalation x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_conflict_declaration', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_conflict_declaration x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_note', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_note x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_task', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_task x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_event', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_event x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_reminder', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_reminder x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_watch', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_watch x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_action_item', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_action_item x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_compliance_check', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_compliance_check x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_case_financial_snapshot', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_case_financial_snapshot x ON x.case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;
INSERT INTO tmp_privacy_erm_duplicate_case_ref_counts SELECT p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id, 'iset_applicant_watchlist', COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan p JOIN iset_applicant_watchlist x ON x.source_case_id = p.merged_case_id GROUP BY p.client_id, p.client_name, p.surviving_case_id, p.merged_case_id;

SELECT
  client_id,
  client_name,
  COUNT(*) AS current_case_count,
  GROUP_CONCAT(CONCAT(case_id, ':', COALESCE(case_number, ''), ':', status, ':', COALESCE(lifecycle_status, '')) ORDER BY survivor_rank SEPARATOR ' | ') AS cases_ranked
FROM tmp_privacy_erm_duplicate_case_ranked
GROUP BY client_id, client_name
ORDER BY client_name;

SELECT
  p.*,
  COALESCE(blocker_counts.blocker_count, 0) AS blocker_count
FROM tmp_privacy_erm_duplicate_case_plan p
LEFT JOIN (
  SELECT client_id, surviving_case_id, merged_case_id, COUNT(*) AS blocker_count
  FROM tmp_privacy_erm_duplicate_case_blockers
  GROUP BY client_id, surviving_case_id, merged_case_id
) blocker_counts
  ON blocker_counts.client_id = p.client_id
 AND blocker_counts.surviving_case_id = p.surviving_case_id
 AND blocker_counts.merged_case_id = p.merged_case_id
ORDER BY p.client_name, p.merged_case_id;

SELECT *
FROM tmp_privacy_erm_duplicate_case_blockers
ORDER BY client_name, merged_case_id, blocker_type;

SELECT *
FROM tmp_privacy_erm_duplicate_case_ref_counts
WHERE row_count > 0
ORDER BY client_name, merged_case_id, table_name;

SELECT
  (SELECT COUNT(*) FROM tmp_privacy_erm_duplicate_case_plan) AS merge_pairs,
  (SELECT COUNT(*) FROM tmp_privacy_erm_duplicate_case_blockers) AS blocker_rows,
  COALESCE((SELECT SUM(row_count) FROM tmp_privacy_erm_duplicate_case_ref_counts), 0) AS rows_that_would_be_repointed;
