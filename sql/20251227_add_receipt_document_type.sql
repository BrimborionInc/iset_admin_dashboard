-- Add receipt document type for payment proof tracking.
INSERT INTO `document_type` (code, label, description, sort_order, is_active, scope)
VALUES ('receipt', 'Receipt', 'Proof of payment receipt', 230, 1, 'application')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  scope = VALUES(scope);
