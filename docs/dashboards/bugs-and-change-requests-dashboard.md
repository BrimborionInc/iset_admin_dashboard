# Bugs and Change Requests Dashboard

Status: implemented in DEV on 2026-04-30
Last reviewed: 2026-04-30

## Scope

- Route: `/support/bugs-change-requests`
- Navigation: `Support > Bugs and Change Requests`
- Frontend:
  - `src/pages/support/BugsChangeRequestsDashboard.jsx`
  - `src/pages/home/widgets/SystemAdminFeedbackQueueWidget.jsx`
  - `src/widgets/AccessControlMatrix.jsx`
  - `src/features/adminFeedback/FloatingFeedbackReviewPanel.jsx`
- Backend:
  - `GET /api/dashboard/admin-feedback-reports`
  - `GET /api/admin/feedback-reports/:id`
  - `PATCH /api/admin/feedback-reports/:id/status`
  - `POST /api/admin/feedback-reports/:id/notes`

## Access

Default route-matrix access is:

- `System Administrator`
- `NWAC Administrator`
- `Regional Manager`

The backend review endpoints use the same role set because reports can include page context and uploaded supporting files.
Do not widen this dashboard to all staff without a privacy review.

## Behavior

The dashboard reuses the same triage widget that appears on the System Administrator homepage.
Users can search and filter submitted bug reports and change requests, open the floating review panel, update status, and add internal notes.

Creating a new report still uses the shared top-nav feedback flow and remains available from the widget's `Report` button.
