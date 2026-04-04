INSERT INTO document_type (
  code,
  label,
  scope,
  description,
  sort_order,
  is_active
)
VALUES (
  'student_financial_assistance_statement',
  'Student financial assistance statement',
  'application',
  NULL,
  135,
  1
)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  scope = VALUES(scope),
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;
