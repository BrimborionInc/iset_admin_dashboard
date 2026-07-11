-- R5a review queue only. This file is deliberately read-only.
-- Never infer provenance for a null action plan when more than one application belongs to its case.
SELECT
  ap.id AS action_plan_id,
  ap.case_id,
  ap.name,
  ap.status,
  COUNT(a.id) AS case_application_count,
  GROUP_CONCAT(a.id ORDER BY a.id SEPARATOR ',') AS candidate_application_ids,
  ap.created_at,
  ap.updated_at
FROM iset_case_action_plan ap
LEFT JOIN iset_application a ON a.case_id = ap.case_id
WHERE ap.application_id IS NULL
GROUP BY ap.id, ap.case_id, ap.name, ap.status, ap.created_at, ap.updated_at
HAVING COUNT(a.id) > 0
ORDER BY (COUNT(a.id) > 1) DESC, ap.case_id, ap.id;
