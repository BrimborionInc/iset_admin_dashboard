-- PROD feedback reconciliation for fixed/deployed reports on 2026-06-14.
-- Scope: admin_feedback_* tables only. No client/case/application/document/action-plan data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

SET @previous_status_128 := NULL;
SELECT status
  INTO @previous_status_128
  FROM admin_feedback_report
 WHERE id = 128
   AND summary = 'Uploaded Documents - Identity Documents'
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @note_at
 WHERE id = 128
   AND @previous_status_128 IS NOT NULL
   AND @previous_status_128 <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 128, @previous_status_128, 'resolved', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_128 IS NOT NULL
   AND @previous_status_128 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 128
        AND previous_status = @previous_status_128
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 128, NULL, @actor_name, @actor_email,
       'Codex reconciliation 2026-06-14: Report #128 is fixed and deployed. Local regression coverage for Supporting Documents update scope passed in src/lib/__tests__/supportingDocumentsUpdateRoute.test.js, and PROD deployed source on i-034c7daa416ec6865 contains documentSourceRequiresApplicationLineage, preserveDocumentSourceLineage, and both update-route lineage call sites. The edit-modal lineage fix shipped in PROD release 20260601-prod-document-lineage-fix and the earlier inline/modal context fix shipped in 20260528-prod-evening-batch. Marking resolved after code/deployed-source recheck; no live document rows were mutated for verification.',
       @note_at
 WHERE @previous_status_128 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 128
        AND note_text LIKE 'Codex reconciliation 2026-06-14: Report #128 is fixed and deployed%'
   );

SET @previous_status_132 := NULL;
SELECT status
  INTO @previous_status_132
  FROM admin_feedback_report
 WHERE id = 132
   AND summary = 'Documents pending'
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @note_at
 WHERE id = 132
   AND @previous_status_132 IS NOT NULL
   AND @previous_status_132 <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 132, @previous_status_132, 'resolved', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_132 IS NOT NULL
   AND @previous_status_132 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 132
        AND previous_status = @previous_status_132
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 132, NULL, @actor_name, @actor_email,
       'Codex reconciliation 2026-06-14: Report #132 is fixed and deployed. The document checklist route now gives stored denied decision_outcome priority over completed/closed status and approval-stage checklist requests, so denied/closed files stay on the denial/no-funding checklist path instead of showing CFA/EFT as missing. Local verification passed in src/lib/__tests__/documentChecklistRoute.test.js as part of the reconciliation test batch, and PROD deployed source contains the decision_outcome checklist path markers from release 20260605-prod-ilmp-casework-batch. Marking resolved after code/deployed-source recheck.',
       @note_at
 WHERE @previous_status_132 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 132
        AND note_text LIKE 'Codex reconciliation 2026-06-14: Report #132 is fixed and deployed%'
   );

SET @previous_status_136 := NULL;
SELECT status
  INTO @previous_status_136
  FROM admin_feedback_report
 WHERE id = 136
   AND summary = 'Withdraw Application not appearing - Jaimee Lee Gray'
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @note_at
 WHERE id = 136
   AND @previous_status_136 IS NOT NULL
   AND @previous_status_136 <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 136, @previous_status_136, 'resolved', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_136 IS NOT NULL
   AND @previous_status_136 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 136
        AND previous_status = @previous_status_136
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 136, NULL, @actor_name, @actor_email,
       'Codex reconciliation 2026-06-14: Report #136 is fixed and deployed. Local raw-status workflow guard coverage passed in applicationOverviewApplicationScope.test.js, applicationStatusRawWorkflowGuards.test.js, and applicationStatus.test.js. PROD deployed source on i-034c7daa416ec6865 shows closure_notice is withdraw-eligible, Application Overview reads applicationStatusRaw/application_status_raw for quick-action gating, and applicationStatus keeps closure_notice as the raw status while displaying Awaiting Applicant. The fix shipped in release 20260605-prod-ilmp-casework-batch; marking resolved after code/deployed-source recheck.',
       @note_at
 WHERE @previous_status_136 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 136
        AND note_text LIKE 'Codex reconciliation 2026-06-14: Report #136 is fixed and deployed%'
   );

SET @previous_status_138 := NULL;
SELECT status
  INTO @previous_status_138
  FROM admin_feedback_report
 WHERE id = 138
   AND summary = 'ILMP Warning messages unclear'
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @note_at
 WHERE id = 138
   AND @previous_status_138 IS NOT NULL
   AND @previous_status_138 <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 138, @previous_status_138, 'resolved', NULL, @actor_name, @actor_email, @note_at
 WHERE @previous_status_138 IS NOT NULL
   AND @previous_status_138 <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 138
        AND previous_status = @previous_status_138
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 138, NULL, @actor_name, @actor_email,
       'Codex reconciliation 2026-06-14: Report #138 is fixed and deployed. PROD release 20260608-prod-ilmp-validation-messages shipped clearer ILMP blocker/warning wording with what/where/rule guidance and removed the unsupported childcare No funding received warning. Local src/lib/__tests__/ilmpIssueMessages.test.js passed, and PROD deployed source/public release notes on i-034c7daa416ec6865 contain the ILMP issue-message markers and Release 20260608-prod-ilmp-validation-messages package. Marking resolved.',
       @note_at
 WHERE @previous_status_138 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 138
        AND note_text LIKE 'Codex reconciliation 2026-06-14: Report #138 is fixed and deployed%'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 134, NULL, @actor_name, @actor_email,
       'Codex reconciliation 2026-06-14: The decision-letter applicant-name code fix is deployed and local resolver/message-body tests pass, but this report remains in_progress under the workflow/artifact validation rule. Before resolving, recheck a newly generated/sent approval or denial letter in PROD and confirm the client-facing artifact uses the participant salutation/name rather than Dear Applicant.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 134)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 134
        AND note_text LIKE 'Codex reconciliation 2026-06-14: The decision-letter applicant-name code fix is deployed%'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 137, NULL, @actor_name, @actor_email,
       'Codex reconciliation 2026-06-14: Code and safe data repair work for report #137 are deployed/applied, but the report remains in_progress because the Shayleen McNabb file still needs case-manager confirmation for non-derivable facts: barrier to employment, EI claimant category, and previous employment NOC/version where applicable. Do not mark resolved until those facts are confirmed, ILMP validation is rerun, and the targeted recheck is clean.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 137)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 137
        AND note_text LIKE 'Codex reconciliation 2026-06-14: Code and safe data repair work for report #137%'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 140, NULL, @actor_name, @actor_email,
       'Codex reconciliation 2026-06-14: The Case Workspace closed-action-plan recovery action is deployed in PROD and deployed source contains the System Administrator reopen guard, reason/audit path, and ILMP validation/submission reset markers. The report remains in_progress until an authenticated staff workflow recheck confirms the live recovery action end to end, including reason capture, internal note/audit event, ILMP reset, and optional completed-intervention reopen behavior.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 140)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 140
        AND note_text LIKE 'Codex reconciliation 2026-06-14: The Case Workspace closed-action-plan recovery action is deployed%'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 141, NULL, @actor_name, @actor_email,
       'Codex reconciliation 2026-06-14: The funding-revision CFA recovery path is deployed in PROD and deployed source contains createCfaVersionForPlan, createCfaVersionFromAssessment, and applied-revision metadata markers. The report remains in_progress under the workflow/artifact validation rule until an authenticated live recheck confirms the funding revision letter path creates the missing Client Funding Agreement draft and produces the expected client-facing packet/signing request.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 141)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 141
        AND note_text LIKE 'Codex reconciliation 2026-06-14: The funding-revision CFA recovery path is deployed%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (128, 132, 134, 136, 137, 138, 140, 141)
 ORDER BY id;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (128, 132, 136, 138)
 ORDER BY id DESC
 LIMIT 12;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (128, 132, 134, 136, 137, 138, 140, 141)
 ORDER BY id DESC
 LIMIT 16;
