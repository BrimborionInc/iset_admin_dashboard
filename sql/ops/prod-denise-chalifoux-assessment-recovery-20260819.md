# Denise Chalifoux accidental-denial recovery

Target: PROD account `468278742295`, Aurora cluster `nwac-prod-db`, database
`iset_intake`, application `31`, case `113`, assessment `34`, workflow `59`.

Pre-apply recovery point:

- Snapshot: `path-prod-denise-assessment-recovery-20260819-150930`
- ARN: `arn:aws:rds:ca-central-1:468278742295:cluster-snapshot:path-prod-denise-assessment-recovery-20260819-150930`
- Status before apply: `available`, 100%, encrypted
- Snapshot creation time: `2026-08-19T15:15:02.851Z`

The snapshot is the authoritative full recovery artifact, including the exact
pending ESDC validation seed that apply removes. Restore it to an isolated
Aurora cluster first; do not replace or restore the live cluster without a new
explicitly reviewed PROD recovery plan and authorization. Before any selective
copy-back, repeat exact target identity and live-DDL discovery and compare every
identifier in the finished recovery SQL to that restored and live DDL.

Operational artifacts:

- `prod-denise-chalifoux-assessment-recovery-inventory-20260819.sql`
- `prod-denise-chalifoux-assessment-recovery-preview-20260819.sql`
- `prod-denise-chalifoux-assessment-recovery-lock-20260819.sql`
- `prod-denise-chalifoux-assessment-recovery-apply-20260819.sql`
- `prod-denise-chalifoux-assessment-recovery-verify-20260819.sql`
- `prod-denise-chalifoux-assessment-recovery-unlock-20260819.sql`

The apply preserves the original denial workflow event and creates new workflow,
case-event, and internal-note audit entries. It archives rather than deletes the
denial-generated action plan, interventions, and document. Only the untouched,
unsubmitted ESDC seed is deleted. If apply fails after lock acquisition, run the
guarded unlock artifact only after confirming the main transaction rolled back.
