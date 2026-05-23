-- Updates the finance payment-packet baseline evidence list.
-- Preserves existing per-payment-type evidence rules and replaces only baseline evidence.

INSERT INTO iset_runtime_config (scope, k, v)
VALUES (
  'finance',
  'payment.evidence.rules',
  JSON_OBJECT(
    'baseline', JSON_OBJECT(
      'required', JSON_ARRAY('FundingAgreement', 'SignedEftBankingForm'),
      'optional', JSON_ARRAY(),
      'postPayRequired', JSON_ARRAY()
    ),
    'paymentTypes', JSON_OBJECT()
  )
)
ON DUPLICATE KEY UPDATE
  v = JSON_SET(
    COALESCE(v, JSON_OBJECT()),
    '$.baseline', JSON_OBJECT(
      'required', JSON_ARRAY('FundingAgreement', 'SignedEftBankingForm'),
      'optional', JSON_ARRAY(),
      'postPayRequired', JSON_ARRAY()
    ),
    '$.paymentTypes', COALESCE(JSON_EXTRACT(v, '$.paymentTypes'), JSON_OBJECT())
  ),
  updated_at = CURRENT_TIMESTAMP;
