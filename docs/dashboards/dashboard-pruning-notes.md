Dashboard Cleanup Working Notes
================================

Context
-------
- Goal: retire stale appointment-booking dashboards/pages and their widgets from `src/pages` and `src/widgets`.
- Approach: review each dashboard page sequentially, decide on deletion, and clean up associated imports/routes/widgets immediately.
- Safety net: repo history (main + remote) is considered the source of truth; any mistakenly removed artifacts can be restored later.

What to capture per page
------------------------
- Short description of what the page appears to do.
- List of direct widget/component imports (files under `src/widgets`, `src/helpPanelContents`, etc.).
- Where the page is referenced (e.g., `src/routes/AppRoutes.js`, navigation configs).
- Decision taken (keep/remove) and brief justification.
- Follow-up work (e.g., remove orphaned widgets, update routes, delete help panel content).

Deletion protocol
-----------------
1. Remove the page file and any private widgets used **only** by that page.
2. Update routing (`src/routes/AppRoutes.js`) and navigation menus to eliminate references.
3. Remove related help panel content or context providers if now unused.
4. Re-run `npm run lint` to catch unresolved imports or lint regressions.
5. If the page exposed REST endpoints or other integrations, note for backend follow-up.

Verification checklist
----------------------
- [x] `npm run lint` (after each batch of deletions).
- [ ] `npm run test` (optional if lint uncovers JSX usage; run before final hand-off).
- [ ] Manual scan of `git status` to ensure only intended files are removed/edited.

If something breaks
-------------------
- Use `git log -- <path>` to locate the last known good version of a deleted file.
- Restore via `git checkout <commit> -- <path>` into a temporary location, then reinstate if required.
- Document the recovery in this file to maintain an audit trail.

Running log
-----------
- 2025-10-11: Removed `newAppointmentForm`, `slotSearchWizard`, `applicantDetails`, `AppointmentConfirmed`; pruned routes. Lint currently at 161 warnings.
- 2025-10-11: Deleted orphaned `src/pages/armsReportingDashboard.js` (duplicate of retained ARMS placeholder).
- 2025-10-11: Deleted Assessment Review dashboard and removed `/assessment-review` nav/ACL entries.
- 2025-10-11: Deleted `src/pages/codeTablesDashboard.js` and `/code-tables-dashboard` route (unused code table experiment).
- 2025-10-11: Deleted `src/pages/manageApplications.js` plus `CaseManagementDemoControlsWidget`, `AssignedCasesWidget`, and related ACL/nav entries.
- 2025-10-11: Deleted `src/pages/manageAppointments.js` and associated help/routes.
- 2025-10-11: Deleted `src/pages/experiment.js` route stub.
- 2025-10-11: Deleted `src/pages/manageFees.js` route.
- 2025-10-11: Deleted `src/pages/manageMessages.js` plus secure messaging nav/ACL/help entries.
- 2025-10-11: Deleted `src/pages/manageServiceModules.js` and `/service-modules-management-dashboard` routes.
- 2025-10-11: Deleted `src/pages/manageTicketingDashboard.js` (`/manage-ticketing-dashboard`).
- 2025-10-11: Deleted `src/pages/modifyAppointment.js` (legacy PTMA flow).
- 2025-10-11: Deleted `src/pages/QMSOperatorDemo.js` (`/qms-operator-demo` demo route).
- 2025-10-11: Pruned unused widgets under `src/widgets` (see list below) and removed `src/helpPanelContents/caseTableHelp.js`; ready to rerun lint to confirm clean import graph.

Widgets referenced by retained pages
------------------------------------
- `AccessControlMatrix` (via `src/pages/accessControlDashboard.js`)
- `ApplicationWorkQueueWidget`, `RecentActivityWidget`, `StatisticsWidget` (via `src/pages/adminDashboardHomePage.js`)
- `ApplicationOverviewWidget`, `IsetApplicationFormWidget`, `CoordinatorAssessmentWidget`, `SupportingDocumentsWidget`, `SecureMessagingWidget`, `CaseNotesWidget`, `ApplicationEvents` (via `src/pages/applicationCaseDashboard.js`)
- (none; uses inline placeholder content) `src/pages/armsReporting.js`
- `ApplicationsWidget`, `blankTemplate` (via `src/pages/caseAssignmentDashboard.js`)
- `IntakeStepTableWidget`, `PreviewIntakeStep`, `PreviewStepJSON` (via `src/pages/manageIntakeSteps.js`)
- `NotificationSettingsWidget`, `manageTemplates` (via `src/pages/manageNotifications.js`)

Widgets newly orphaned (candidates for removal)
-----------------------------------------------
- None (2025-10-11 widget sweep cleared the backlog).

Widgets to retain
-----------------
- `AccessControlMatrix.jsx`
- `applicationEvents.js`
- `ApplicationOverviewWidget.js`
- `ApplicationsWidget.js`
- `ApplicationWorkQueueWidget.js`
- `blankTemplate.js`
- `CaseNotesWidget.js`
- `configureNotifications.js`
- `ContactInformation.js`
- `CoordinatorAssessmentWidget.js`
- `EncryptionSettings.js`
- `GeneralInformation.js`
- `GeneralLocationInformation.js`
- `IntakeStepLibraryWidget.js`
- `IntakeStepTableWidget.js`
- `IsetApplicationFormWidget.js`
- `IsetEvaluatorsWidget.js`
- `manageTemplates.js`
- `notificationSettingsWidget.js`
- `OperatingHours.js`
- `PreviewIntakeStep.js`
- `PreviewStepJSON.js`
- `PtmaIsetStatistics.js`
- `RecentActivityWidget.js`
- `SecureMessagingWidget.js`
- `ServicesOffered.js`
- `SlaPerformanceOverview.js`
- `SS1.js`
- `SS2.js`
- `SS3.js`
- `ST2.js`
- `ST3.js`
- `ST6.js`
- `ST7.js`
- `ST8.js`
- `StatisticsWidget.js`
- `StepPropertiesWidget.js`
- `SupportingDocumentsWidget.js`
- `TranslationsWidget.js`
- `WorkflowCanvasWidget.js`
- `WorkflowListWidget.js`
- `WorkflowPreviewWidget.js`
- `WorkflowPropertiesEditorWidget.js`
- `WorkflowPropertiesWidget.js`
- `WorkflowRuntimeSchemaWidget.js`

Widgets removed on 2025-10-11
-----------------------------
- `ApplicationSecuritySettings.js`
- `appointmentsTableWidget.js`
- `appointmentStatus.js`
- `AssessedCasesWidget.js`
- `CallNextWidget.js`
- `caseTable.js`
- `caseTasks.js`
- `caseUpdates.js`
- `ComponentWorkflow.js`
- `composeMessage.js`
- `CounterSignInWidget.js`
- `DataHandlingRetentionSettings.js`
- `EmailAppointmentsWidget.js`
- `EmergencySlot.js`
- `FilterAppointmentsWidget.js`
- `GeneralServiceModuleInformation.js`
- `HolidayClosures.js`
- `IdentityAccessManagementSettings.js`
- `IncidentResponseComplianceSettings.js`
- `KeyManagementSettings.js`
- `LanguagesOffered.js`
- `LoggingMonitoringSettings.js`
- `NetworkSecuritySettings.js`
- `QMSWaitingRoomScreen.js`
- `QueueOverviewWidget.js`
- `ResourceRequirements.js`
- `SecureApiAccessSettings.js`
- `SecureMessagesWidget.js`
- `SessionInfoWidget.jsx`
- `SizeAndFacilities.js`
- `slotManagementWidget.js`
- `slotSearch.js`
- `testBoardItem1.js`
- `testBoardItem2.js`
- `UnassignedApplicationsWidget.js`
- `ViewSlotsWidget.bak`
