# Feedback 178 recovery artifact

The guarded apply is a single transaction with an exception handler that rolls
back every database change if any guard or write fails. A post-commit reversal
must use the pre-apply Aurora cluster snapshot because the apply deliberately
removes stale decision-letter fields from `iset_case.case_context_json`; copying
those participant-specific values into a source-controlled rollback script
would create an additional PII store.

- Target AWS account: `468278742295`
- Target Aurora cluster: `nwac-prod-db`
- Snapshot identifier: `path-prod-feedback-178-recovery-20260805-1606`
- Locked application: `61`
- Apply artifact: `prod-feedback-178-assessment-correction-apply-20260805.sql`
- Independent verification: `prod-feedback-178-assessment-correction-verify-20260805.sql`
- Lock cleanup: `prod-feedback-178-assessment-correction-unlock-20260805.sql`

If independent verification fails after commit, keep application 61 locked,
stop staff activity on the record, and restore a separate cluster from the
snapshot for evidence comparison/recovery. Do not issue a guessed corrective
query. Record the restored cluster identifier and verification evidence before
any cutover decision. The recovery snapshot must be retained until Derry has
returned the assessment, Danielle has corrected and resubmitted it, and Madison
has recorded the renewed decision.
