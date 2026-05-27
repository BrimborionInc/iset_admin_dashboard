SELECT
  ci.id AS intervention_id,
  ci.case_id,
  c.case_number,
  c.client_id,
  CONCAT(COALESCE(cl.first_name, ''), ' ', COALESCE(cl.last_name, '')) AS client_name,
  ci.status,
  ci.delivery_status,
  ci.intervention_code,
  ci.start_date,
  ci.end_date,
  ci.intervention_cost,
  ci.budget_amount,
  ci.approved_amount,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) AS metadata_source,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.cost')) AS metadata_cost,
  JSON_UNQUOTE(JSON_EXTRACT(ci.esdc_intervention_json, '$.interventionCost')) AS esdc_intervention_cost,
  (
    SELECT ROUND(COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(j.line, '$.amount')) AS DECIMAL(14,2))), 0), 2)
    FROM JSON_TABLE(
      COALESCE(JSON_EXTRACT(ci.metadata_json, '$.costLines'), JSON_ARRAY()),
      '$[*]' COLUMNS (line JSON PATH '$')
    ) AS j
  ) AS metadata_cost_lines_total,
  p.id AS proposal_id,
  p.proposed_cost,
  JSON_UNQUOTE(JSON_EXTRACT(p.payload_json, '$.proposedCost')) AS proposal_payload_cost,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.cost')) AS proposal_metadata_cost
FROM iset_case_intervention ci
JOIN iset_case c ON c.id = ci.case_id
LEFT JOIN client cl ON cl.id = c.client_id
LEFT JOIN iset_intervention_proposal p ON p.legacy_intervention_id = ci.id
WHERE ci.id = 21
  AND ci.case_id = 88
  AND c.client_id = 97
  AND c.case_number = 'MI-MNT3JPF0-5BFEF1'
  AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'auto_assessment';
