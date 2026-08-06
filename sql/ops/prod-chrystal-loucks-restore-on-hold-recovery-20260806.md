# Chrystal Loucks application restoration recovery

The guarded apply is a single transaction with an exception handler that rolls
back every database change if any guard or write fails. A post-commit reversal
must use the pre-apply Aurora snapshot because the apply removes generated
withdrawal/reporting rows and a participant-specific case-context value; those
values are intentionally not copied into another source-controlled PII store.

- Target AWS account: `468278742295`
- Target Aurora cluster: `nwac-prod-db`
- Snapshot identifier: `path-prod-chrystal-loucks-restore-20260806-1439`
- Locked applications: `117`, `140`
- Restored application: `117`
- Unchanged application: `140`
- Apply artifact: `prod-chrystal-loucks-restore-on-hold-apply-20260806.sql`
- Independent verification: `prod-chrystal-loucks-restore-on-hold-verify-20260806.sql`
- Lock cleanup: `prod-chrystal-loucks-restore-on-hold-unlock-20260806.sql`

If independent verification fails after commit, keep both applications locked,
stop staff activity on case `69`, and restore a separate cluster from the
snapshot for evidence comparison/recovery. Do not issue a guessed corrective
query. Record the restored cluster identifier and verification evidence before
any cutover decision.
