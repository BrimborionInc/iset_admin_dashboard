# Feedback 178 second recovery artifact

The guarded apply is a single transaction with an exception handler that rolls
back every database change if any guard or write fails. The recovery moved the
assessment directly to its original submitter after live history proved the
first ordinary `rm_review` recovery allowed the unchanged assessment to bypass
the required correction and receive another final approval.

A post-commit reversal must use the pre-apply Aurora cluster snapshot. The apply
removes application-scoped decision and generated-artifact context; copying
participant-specific values into a source-controlled rollback script would
create another PII store.

- Target AWS account: `468278742295`
- Target Aurora cluster: `nwac-prod-db`
- Database: `iset_intake`
- Snapshot identifier: `path-prod-feedback-178-second-recovery-20260806-2033`
- Locked application: `61`
- Workflow: `17`
- Current-state preview: `prod-feedback-178-current-state-preview-20260806.sql`
- Dependency preview: `prod-feedback-178-second-approval-dependency-preview-20260806.sql`
- Lock artifact: `prod-feedback-178-second-recovery-lock-20260806.sql`
- Apply artifact: `prod-feedback-178-second-recovery-apply-20260806.sql`
- Independent verification: `prod-feedback-178-second-recovery-verify-20260806.sql`
- Lock cleanup: `prod-feedback-178-second-recovery-unlock-20260806.sql`

Execution evidence:

- Lock command: `d608717a-682a-4f24-8d9e-4b21e63f9451`
- Snapshot reached `available` at 100% before apply.
- Apply command: `03f2dea2-d799-41ab-9bb5-136153358fb4`
- Independent verification command: `68ebc1b6-ef61-43a6-83da-00fab355497e`
- Unlock command: `2bebb969-82e1-4eb4-88a0-f41f5541d34c`

Independent verification confirmed application `61` is `in_review` with no
decision outcome, workflow `17` is `returned_to_submitter`, all previous review
events remain, second-approval generated artifacts are withdrawn, current
decision context is cleared, and feedback `178` remains `in_progress`.

If later verification identifies a recovery defect, stop work on application
`61`, prevent staff from advancing it, and restore a separate cluster from the
snapshot for evidence comparison. Do not issue a guessed correction query. The
snapshot should remain until the Coordinator correction, resubmission, Regional
Manager review, renewed Decision Maker decision, and replacement artifacts are
all independently verified.
