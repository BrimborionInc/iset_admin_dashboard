UPDATE workflow
   SET name = 'Financial Overview',
       updated_at = NOW()
 WHERE id = 52
   AND document_type = 'financial_overview'
   AND name = 'Funding Overview';

UPDATE step s
JOIN workflow_step ws ON ws.step_id = s.id
   SET s.name = 'Financial Overview',
       s.updated_at = NOW()
 WHERE ws.workflow_id = 52
   AND s.name = 'Funding Overview';

UPDATE signing_request
   SET workflow_name = 'Financial Overview',
       resolved_schema_json = CASE
         WHEN resolved_schema_json IS NOT NULL
          AND CAST(resolved_schema_json AS CHAR) LIKE '%Funding Overview%'
           THEN CAST(REPLACE(CAST(resolved_schema_json AS CHAR), 'Funding Overview', 'Financial Overview') AS JSON)
         ELSE resolved_schema_json
       END,
       updated_at = NOW()
 WHERE checklist_doc_type = 'financial_overview'
   AND (
     workflow_name = 'Funding Overview'
     OR CAST(resolved_schema_json AS CHAR) LIKE '%Funding Overview%'
   );

UPDATE funding_overview_version
   SET change_summary = REPLACE(change_summary, 'Funding overview', 'Financial overview')
 WHERE change_summary LIKE '%Funding overview%';

UPDATE iset_document
   SET label = CASE
         WHEN label LIKE '%Funding Overview%' THEN REPLACE(label, 'Funding Overview', 'Financial Overview')
         ELSE label
       END,
       file_name = CASE
         WHEN file_name LIKE 'funding-overview-%' THEN REPLACE(file_name, 'funding-overview-', 'financial-overview-')
         ELSE file_name
       END,
       metadata = CASE
         WHEN metadata IS NOT NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.label')) LIKE '%Funding Overview%'
           THEN JSON_SET(
             metadata,
             '$.label',
             REPLACE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.label')), 'Funding Overview', 'Financial Overview')
           )
         ELSE metadata
       END,
       updated_at = NOW()
 WHERE document_category = 'financial_overview'
   AND (
     label LIKE '%Funding Overview%'
     OR file_name LIKE 'funding-overview-%'
     OR (
       metadata IS NOT NULL
       AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.label')) LIKE '%Funding Overview%'
     )
   );
