ALTER TABLE finance_transaction
  MODIFY status enum(
    'draft',
    'submitted',
    'approved',
    'posted',
    'cancelled',
    'rejected'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft';

UPDATE finance_transaction
   SET status = 'cancelled'
 WHERE status NOT IN ('draft', 'submitted', 'approved', 'posted', 'cancelled', 'rejected');

UPDATE finance_transaction
   SET status = 'submitted'
 WHERE status = 'approved';

ALTER TABLE finance_transaction
  MODIFY status enum(
    'draft',
    'submitted',
    'posted',
    'cancelled',
    'rejected'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft';
