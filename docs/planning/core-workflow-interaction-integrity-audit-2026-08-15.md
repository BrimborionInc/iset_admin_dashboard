# Core Workflow Interaction Integrity Audit

Purpose: record the bounded review and preventive remediation of
repeat-application interaction defects across PATH's central user workflows.

Audience: engineering, QA, release operations, and future development threads.

Last Updated: 2026-08-15

## Status

- The bounded source review and independent challenge were completed before
  this public-safe candidate was reconstructed. The resulting preventive code
  changes are included here without the unrelated security-assessment work that
  was present in the original local source branch.
- This exact reconstructed candidate has not been rerun or qualified as part of
  the sanitisation step. Earlier source-tree results are historical context, not
  exact-candidate acceptance evidence. Qualification remains with the release
  owner.
- No TEST, live AWS, production deployment, database mutation, data repair, or
  migration is authorised or recorded by this document.
- Historical data inventory and repair remain separate, schema-proven tasks.

## Fixed Boundary

The review follows one client, the client's long-lived case, and two or more
applications through these core workflows:

1. portal and staff-assisted intake, case reuse, and lifecycle reopening;
2. application assessment, review stages, final approval or denial, and
   correction ownership;
3. decision-letter and Client Funding Agreement generation and signing;
4. Action Plan and intervention materialisation, revision, closeout, and
   operational queues;
5. EI evidence and status plus ESDC participant validation and export;
6. application and case documents, secure messages, signing requests,
   reminders, and notification links; and
7. Case Workspace, Application Workspace, home and review queues, role
   permissions, and reporting consumers of those states.

Unrelated finance implementation, workflow authoring, infrastructure, broad UI
cleanup, AI, and qualification-harness development remain outside this review
unless a direct dependency is proved.

## Ownership and State Invariants

- `client` is the person, `case` is the long-lived operational file, and
  `application` is one discrete intake and decision event.
- A selected application must never inherit, expose, mutate, validate, approve,
  deny, sign, report, or resynchronise a sibling application's assessment,
  review workflow, decision artifacts, Action Plan, interventions, documents,
  signing requests, or ESDC record.
- Case-level state may coordinate the file but must not stand in for an
  application-specific owner when more than one application exists.
- Application-less historical records are not evidence that they belong to the
  currently selected application. Ambiguous legacy ownership fails closed or is
  presented explicitly as case-file history.
- Final decisions and signed artifacts remain immutable evidence. Operational
  follow-up may add linked records but must not rewrite their application
  lineage or decision facts.
- Role class is not work ownership. Draft, returned, review, correction, and
  signing permissions use the exact recorded actor, stage, and subject.
- Queue, reporting, notification, and navigation links carry the application
  identity of the event or record that caused them.
- New intake may reopen a terminal case while preserving application-specific
  history and clearing only obsolete case-wide routing or closure state.

## Confirmed Repairs

- Assessment, Action Plan, intervention, ILMP, and ESDC mutation paths now use
  exact application or plan ownership. The former case-wide invalidation entry
  point is removed, and ownerless invalidation fails closed.
- Denying one application no longer terminalises the long-lived case or cancels
  all reminders without first considering sibling applications and ordinary
  plans. General case recomputation considers open applications and excludes
  synthetic reporting-only plans.
- ILMP validation, preparation, direct submission, grouped submission, and
  ready-to-close now preserve immutable submitted or accepted evidence, lock
  and recheck exact candidate rows, and fail closed on mixed or unknown
  ownership. Cross-application grouped export is deliberately blocked pending a
  separately designed fragment model.
- Decision-letter and intervention-letter generation use separate exact owners.
  Their message, signing, PDF, document-link, sent-marker, and workflow effects
  commit or roll back together without borrowing a sibling marker or artifact.
- Assessment recall preserves signed or version-managed Financial Overviews.
  Generic document mutation rejects signed, versioned, payment-linked,
  message-origin, application-submission, system-generated, or
  unknown-provenance artifacts, and rechecks dependencies under lock.
- Secure-message replies and adopted attachments retain the selected message's
  stored application. Historical participant-owned case messages remain
  available across repeat applications.
- Reminder creation and acknowledgement enforce a coherent
  intervention-to-plan-to-application-to-case chain and an explicit workspace
  scope. Application Calendar remains application scoped; Case Workspace
  remains deliberately case wide.
- Application queues enumerate live applications rather than one case-primary
  row, and their navigation preserves `applicationId`. ESDC leaf rows preserve
  exact application identity while grouped containers remain non-navigable.
- New intake reopens only a terminal reused case, clears obsolete case-wide
  reporting state, and preserves earlier application-specific reporting and
  decision history. An already active case retains its lifecycle.

No equivalent confirmed critical or high repeat-application defect was found in
automatic assessment materialisation, CFA version ownership, intervention
proposal or revision ownership, portal signing-request ownership, or regional
snapshot lineage within the bounded review.

## Historical Data and Migration Assessment

Code-only corrections do not repair historical inconsistencies. A future,
separately authorised inventory should check for:

1. ESDC rows whose mutable state disagrees with immutable validation or
   submission history;
2. submission, Action Plan, or intervention application lineage that is absent,
   crosses case boundaries, or disagrees within a batch;
3. terminal or ready-to-close cases that still have nonterminal applications,
   active ordinary plans, blocked reporting submissions, or prematurely
   cancelled reminders;
4. inactive or deleted documents still referenced by signing, funding versions,
   payments, decisions, messages, or intervention letters, including artifacts
   active under the wrong owner;
5. reminders whose case, application, plan, and intervention identifiers do not
   form one chain or whose acknowledgement came from the wrong application
   workspace; and
6. recent notification metadata missing deterministic application ownership.

Deterministic relationships may support a guarded repair. Ambiguous legacy
plans, replies, and missing payloads require staff review rather than assignment
to whichever application is now primary. No repair SQL is included. Any future
inventory, preview, apply, recovery, and verification SQL must follow fresh
target identity and full live-DDL proof.

## Qualification Record

No qualification result is claimed for this reconstructed candidate. It retains
the focused regression suites and rollback-only DEV contract added with the
preventive changes, but those checks must be rerun by the release owner against
the exact candidate. The general release harness is not acceptance evidence for
this audit.
