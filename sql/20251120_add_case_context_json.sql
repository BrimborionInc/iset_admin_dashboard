-- Add case context JSON column for editable client context in case management

ALTER TABLE `iset_case`
  ADD COLUMN `case_context_json` JSON NULL AFTER `next_action_due_at`;

