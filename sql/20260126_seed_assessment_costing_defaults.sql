SET @assessment_costing_defaults = '{
  "enabled": true,
  "strategy": "allowed",
  "paymentTypes": [
    { "code": "LivingAllowance", "recurrence": { "mode": "required" } }
  ],
  "interventions": []
}';

INSERT INTO iset_runtime_config (scope, k, v, updated_at)
VALUES ('assessment', 'coordinator.costing.line_item_defaults', CAST(@assessment_costing_defaults AS JSON), NOW())
ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = NOW();
