# Shelley Interim Appeal Migration — Jennifer Johnson and Veronica Basque

Status: completed in PROD on 2026-09-03; both applications independently verified in Pending Decision.

## Business outcome

Use the interim appeal process agreed in May: retain the original decision and its evidence, add a clear internal case note that an appeal has been received, and return the existing application-assessment workflow to Pending Decision. Shelley can then uphold the denial, change it to approval, or request further changes through the normal Decision Maker controls.

This is not a correction or deletion of the original decision. The migration creates a second decision pass.

## Exact records

| Participant | Case | Application | Assessment | Review workflow | Original decision event | Denial reporting plan |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Jennifer Johnson | 258 | 199 | 1622 | 66 | 509 | 206 |
| Veronica Basque | 269 | 208 | 1770 | 90 | 529 | 211 |

Shelley Stacey is active staff profile `50`, with the `NWAC Administrator` role. Both decisions were recorded by Madison Coppola, staff profile `51`, on August 27, 2026.

Jennifer has appeal document `13854`, labelled `Appeal Letter`. Veronica has no appeal document stored in PATH; Shelley's email is the appeal source for the case note.

## Migration contract

The guarded transaction:

1. Abort unless the two applications, cases, assessments, workflows, original final-decision events, documents, signing records, reporting plans, and unsubmitted ESDC rows still match the reviewed PROD inventory.
2. Abort if either application has an active edit lock.
3. Move applications `199` and `208` from completed/closed/denied to `pending_approval` / `pending_decision`, clear the current decision outcome, and increment each row version.
4. Reopen cases `258` and `269` to the intake lifecycle while retaining the historical August 27 close date and the original closure evidence in the timeline.
5. Move workflows `66` and `90` from `final_decision_recorded` to `nwac_review`, with the next action owned by the `NWAC Administrator` role. The current decision and decision-letter markers are moved into an appeal-history snapshot and cleared from the live decision fields. This gives Shelley a clean second decision pass while the former decision remains in immutable workflow event `509` or `529`, the original case note, and the generated documents.
6. Add one `interim_appeal_opened` workflow event, one case timeline event, and one internal case note to each file. The event is recorded as a System Administrator migration requested by Shelley; it does not falsely claim Shelley performed the SQL operation.
7. Archive denial-only reporting plans `206` and `211` while the decisions are contested. Their rows, completed reporting interventions, and unsubmitted ESDC rows remain intact. Archiving keeps them out of an ESDC batch during the appeal without deleting history.
8. Clear the case-level “reporting-only denial” flags so the reopened cases behave as active files. The application-specific denial snapshot is retained but marked as not current and appeal-pending.

The transaction will not change the assessment content, Amanda's submission or Regional Manager review, the original denial events or notes, stored decision letters, final assessment packets, messages, signing requests, signed Financial Overviews, reporting interventions, or ESDC payload facts.

## What Shelley will see

Both applications will appear in the NWAC `Pending Decision` queue. The submitted assessment remains read-only. The previous denial reasoning remains visible as context, but Shelley can select and record the outcome through the existing Decision Maker step.

If Shelley requests changes, PATH follows the existing route back through the Regional Manager and submitter before returning to Pending Decision.

## Outcome handling

If Shelley upholds a denial, the ordinary denial action reuses and restores that application's archived denial-reporting plan, revalidates its ESDC row, records a new denial event, and generates the new decision artifacts. The original denial event and files remain historical evidence.

If Shelley changes a decision to approval, PATH creates a new application-linked approval Action Plan and proposed interventions from the unchanged assessment. It does not reuse the closed denial plan. The denial-only plan remains archived as superseded history and its unsubmitted ESDC row remains outside the current ESDC queue. A short, guarded post-decision verification must confirm the new plan, ESDC lineage, approval documents, and case state and mark the retained application reporting snapshot with the appeal outcome.

When PATH generates a later final assessment packet, the former packet is archived rather than deleted. The original denial letter, decision event, case note, and stored file remain part of the audit record.

## Recovery boundary

The prepared recovery is safe only before Shelley or another staff member takes any new workflow action. It fails closed unless each workflow contains exactly one new appeal-open event, the applications retain the expected row versions, the denial reporting plans remain the only application plans, and both ESDC rows remain unsubmitted and payload-free.

Recovery restores the former current denial and decision-letter projection from the appeal-history snapshot and unarchives the denial reporting plans. It does not delete the appeal-open events or case notes; it appends explicit recovery events and notes. Once a staff action occurs, recovery is no longer permitted and any issue must be reconciled forward from the new audit state.

## Production sequence

This was a separate PROD data operation performed during the same maintenance window as the Amanda hotfix. It did not change the TEST-tested hotfix source.

1. Reconfirm the explicit PROD AWS account and live database identity.
2. Run the metadata-only DDL preflight and compare every finished statement with the returned live schema.
3. Put PROD behind the normal maintenance response and create the required Aurora snapshot.
4. Run the read-only preview and require an exact match.
5. Run the guarded apply transaction.
6. Run independent verification: both applications are Pending Decision, both workflows are `nwac_review`, both appeal notes/events exist, original evidence remains, both denial plans are archived, and neither denial ESDC row can enter the current queue.
7. Restore normal service and ask Shelley to confirm that both files open from Pending Decision.
8. After Shelley acts, run the appropriate outcome verification. Do not apply the pre-decision recovery after that point.

## Prepared artifacts

- `sql/ops/prod-shelley-appeal-migration-ddl-preflight-20260903.sql`
- `sql/ops/prod-shelley-appeal-migration-preview-20260903.sql`
- `sql/ops/prod-shelley-appeal-migration-apply-20260903.sql`
- `sql/ops/prod-shelley-appeal-migration-verify-20260903.sql`
- `sql/ops/prod-shelley-appeal-migration-recovery-20260903.sql`

The earlier discovery inventories remain read-only supporting evidence. The guarded apply artifact was executed once in PROD; the recovery artifact has not been executed.

## Production execution evidence

- Restore point `path-prod-20260903-feedback-199-200-appeals-20260903173707` reached `available` before any appeal mutation.
- The final pre-mutation preview matched the reviewed identities and exact record versions. Preview command: `24440abe-5e93-408c-82eb-cb38f56ef762`.
- The guarded transaction committed once under command `5b17748b-55d6-4f3a-a1c2-572353fd7748`.
- Independent verification command `a32e8b22-5265-4efd-8aff-458d268ba7fc` confirmed applications `199` and `208` as `pending_approval` / `pending_decision`, cases `258` and `269` as active intake files, and workflows `66` and `90` at `nwac_review` owned by the `NWAC Administrator` role.
- New workflow events `637` and `638`, case timeline events `490` and `491`, and internal notes `846` and `847` record the appeals and retain the original decision-event references.
- Original denial events `509` and `529`, the original notes, assessment rows, final packets, denial letters, Jennifer's appeal document `13854`, signing history, reporting interventions, and unsubmitted ESDC rows remained intact.
- Denial-only plans `206` and `211` are archived while the appeals are pending. The current ESDC-queue join returned no row for either plan.
- After verification, admin target-group health and public `/readyz` passed, all PROD listeners returned to normal forwarding, and the maintenance announcement row was absent.
- The recovery artifact is now permitted only if no staff member has acted since reopening. Its guards must be allowed to reject recovery once the workflow changes.
