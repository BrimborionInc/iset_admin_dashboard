-- Add client-scoped identity reference document types.
INSERT INTO `document_type` (code, label, description, sort_order, is_active, scope)
VALUES ('status_card', 'Status or Treaty Card', NULL, 55, 1, 'client')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  scope = VALUES(scope);

INSERT INTO `document_type` (code, label, description, sort_order, is_active, scope)
VALUES ('letter_of_reference', 'Letter of Reference', NULL, 57, 1, 'client')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  scope = VALUES(scope);
