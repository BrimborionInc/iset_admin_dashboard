ALTER TABLE payment_packet
  MODIFY status enum(
    'draft',
    'awaiting_trigger',
    'released',
    'submitted',
    'program_review',
    'returned',
    'program_approved',
    'finance_review',
    'finance_approved',
    'on_hold',
    'batched',
    'sent',
    'confirmed',
    'closed',
    'cancelled'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft';
