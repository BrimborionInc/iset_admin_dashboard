UPDATE payment_packet
SET status = CASE status
  WHEN 'released' THEN 'ready_to_send'
  WHEN 'awaiting_trigger' THEN 'draft'
  WHEN 'returned' THEN 'draft'
  WHEN 'program_review' THEN 'submitted'
  WHEN 'program_approved' THEN 'submitted'
  WHEN 'finance_review' THEN 'submitted'
  WHEN 'finance_approved' THEN 'submitted'
  WHEN 'on_hold' THEN 'submitted'
  WHEN 'batched' THEN 'submitted'
  WHEN 'sent' THEN 'submitted'
  WHEN 'closed' THEN 'confirmed'
  WHEN 'canceled' THEN 'cancelled'
  ELSE status
END
WHERE status IN (
  'released',
  'awaiting_trigger',
  'returned',
  'program_review',
  'program_approved',
  'finance_review',
  'finance_approved',
  'on_hold',
  'batched',
  'sent',
  'closed',
  'canceled'
);

UPDATE payment_packet_line
SET status = CASE status
  WHEN 'ready_for_program' THEN 'ready_to_send'
  WHEN 'ready_for_finance' THEN 'ready_to_send'
  WHEN 'approved' THEN 'ready_to_send'
  WHEN 'batched' THEN 'submitted'
  WHEN 'canceled' THEN 'cancelled'
  ELSE status
END
WHERE status IN (
  'ready_for_program',
  'ready_for_finance',
  'approved',
  'batched',
  'canceled'
);

UPDATE finance_transaction
SET status = 'submitted'
WHERE status = 'approved';

UPDATE payment_status_event
SET from_status = CASE from_status
  WHEN 'released' THEN 'ready_to_send'
  WHEN 'awaiting_trigger' THEN 'draft'
  WHEN 'returned' THEN 'draft'
  WHEN 'program_review' THEN 'submitted'
  WHEN 'program_approved' THEN 'submitted'
  WHEN 'finance_review' THEN 'submitted'
  WHEN 'finance_approved' THEN 'submitted'
  WHEN 'on_hold' THEN 'submitted'
  WHEN 'batched' THEN 'submitted'
  WHEN 'sent' THEN 'submitted'
  WHEN 'closed' THEN 'confirmed'
  WHEN 'ready_for_program' THEN 'ready_to_send'
  WHEN 'ready_for_finance' THEN 'ready_to_send'
  WHEN 'approved' THEN 'ready_to_send'
  WHEN 'canceled' THEN 'cancelled'
  ELSE from_status
END
WHERE from_status IN (
  'released',
  'awaiting_trigger',
  'returned',
  'program_review',
  'program_approved',
  'finance_review',
  'finance_approved',
  'on_hold',
  'batched',
  'sent',
  'closed',
  'ready_for_program',
  'ready_for_finance',
  'approved',
  'canceled'
);

UPDATE payment_status_event
SET to_status = CASE to_status
  WHEN 'released' THEN 'ready_to_send'
  WHEN 'awaiting_trigger' THEN 'draft'
  WHEN 'returned' THEN 'draft'
  WHEN 'program_review' THEN 'submitted'
  WHEN 'program_approved' THEN 'submitted'
  WHEN 'finance_review' THEN 'submitted'
  WHEN 'finance_approved' THEN 'submitted'
  WHEN 'on_hold' THEN 'submitted'
  WHEN 'batched' THEN 'submitted'
  WHEN 'sent' THEN 'submitted'
  WHEN 'closed' THEN 'confirmed'
  WHEN 'ready_for_program' THEN 'ready_to_send'
  WHEN 'ready_for_finance' THEN 'ready_to_send'
  WHEN 'approved' THEN 'ready_to_send'
  WHEN 'canceled' THEN 'cancelled'
  ELSE to_status
END
WHERE to_status IN (
  'released',
  'awaiting_trigger',
  'returned',
  'program_review',
  'program_approved',
  'finance_review',
  'finance_approved',
  'on_hold',
  'batched',
  'sent',
  'closed',
  'ready_for_program',
  'ready_for_finance',
  'approved',
  'canceled'
);
