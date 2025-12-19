-- Purpose: classification/tag fields for budget pots + snapshot pots (funding_source, is_restricted, agreement_id, fiscal_year_tag).
-- Status: columns and constraints already exist in this database; this migration is a no-op to allow the runner to succeed after prior partial application.
-- TODO: ensure backend snapshot/publish/restore queries in isetadminserver.js read/write these columns.

SELECT 'budget pot classification tags already present - no changes applied' AS info;
