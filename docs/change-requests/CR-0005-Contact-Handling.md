# CR-0005 – Contact Handling & Support Workflow

## Summary
Create an end-to-end contact-handling capability for the NWAC ISET portal. Replace the static telephone/email details with an in-portal submission flow, store enquiries as records, alert administrators through the existing events/notification framework, and provide a dashboard for staff to triage and respond. No e-mail address or phone number will be displayed on the public page after implementation.

## Goals
- Applicants can submit questions/support requests via the Contact page without leaving the portal.
- Messages are persisted in the NWAC-controlled database, respecting Indigenous data sovereignty (Canada-based storage, NWAC governance of access).
- Administrators receive actionable alerts when new messages arrive.
- Staff have a dedicated interface to review, update status, and record responses.
- Future integrations (auto-replies, analytics) have clear hooks.

## Non-Goals
- Implementing multi-channel support (voice/chat).
- Building a full ticketing system (no SLA automation or advanced routing at this phase).
- Automatic e-mail replies beyond optional acknowledgement.

## Current State
- Public Contact page contains static copy and an unconnected form.
- Hard-coded placeholder email/phone (`support@appointmentservice.com`, toll-free number).
- No backend endpoint, persistence, or admin tooling for contact messages.

## Proposed Changes

### Public Portal (ISET-intake)
1. **Database**
   - Create `contact_message` table + Sequelize model.
   - Columns: `id`, `submitted_at`, `full_name`, `email`, `subject`, `message`, `status`, `user_id` (nullable), `submitted_ip`, `updated_at`.

2. **API Endpoint**
   - Add `POST /api/contact` route in `server.js`.
   - Validate inputs, enforce rate-limiting/anti-spam (IP throttle, optional CAPTCHA), sanitize strings, persist to DB.
   - Optional: send acknowledgement using existing SES mailer module.

3. **Contact Page**
   - Replace static copy with new messaging.
   - Bind form fields to state, call `/api/contact` on submit, show success/failure banners.
   - Remove phone/email references; state expected follow-up time.

4. **Accessibility & Privacy**
   - Ensure WCAG-compliant form controls.
   - Provide privacy reminder that submissions are handled by NWAC.

### Backend Services
- No new microservice; reuse current Node server.
- Implement simple spam mitigation and logging.
- Ensure data stays in Canadian infrastructure; update privacy documentation with the new data flow.

### Admin Dashboard (admin-dashboard)
1. **Contact Messages Dashboard**
   - New page/widget listing submissions with filters.
   - Columns: received date, name, subject, status.
   - Detail view to read message, record notes/response, update status (e.g., `new`, `in-progress`, `resolved`).

2. **RBAC & Audit**
   - Restrict access to `System Administrator` and `NWAC Administrator`.
   - Log user and timestamp when updates occur.

3. **Notifications Integration**
   - Emit event `contact_message.received` on submission.
   - Register notification hook to route event into bell alerts (and any configured email notifications).
   - Add optional `contact_message.updated` event for status changes to ensure oversight.

### Documentation
- Update Contact page copy in privacy/cookies documents as needed.
- Add runbook for staff explaining how to triage messages.
- Document table schema and anti-spam policy.

## Dependencies
- Existing SES mailer (optional usage).
- Existing events/notification framework (`registerNotificationHook`, dispatcher).
- Shared DB migration tooling.

## Risks & Mitigations
- **Spam/abuse**: Rate-limit, CAPTCHA, manual ban list.
- **Unread messages**: Notifications, dashboard filters, and potential daily digest email to ensure visibility.
- **Data privacy**: Indigenous data sovereignty language in privacy policy; ensure staff access is auditable.
- **Future scope creep**: Document non-goals to prevent diverting into full CRM.

## Acceptance Criteria
- Portal Contact form successfully stores enquiries in DB and returns success to user.
- Admin dashboard lists new contact messages, with ability to change status and log administrative notes.
- `contact_message.received` events trigger internal notifications as configured.
- No public-facing email or phone number on Contact page.
- Privacy policy/cookies pages mention the handling of contact submissions and data governance.
- Basic anti-spam guardrails implemented (rate limiting, input validation).

## Rollout Plan
1. Implement DB migration and backend endpoint (feature flag optional).
2. Update Contact page front-end and privacy copy.
3. Build admin dashboard + notifications.
4. QA: submit test messages, verify notifications, dashboard behavior, and access controls.
5. Update documentation, runbook, and communicate change to intake staff.

## Open Questions
- Should we send automatic acknowledgement emails? (Optional; requires final decision.)
- Preferred SLA or response-time commitments for Contact messages? (Needed for messaging on the Contact page.)
- Do we need multilingual support in staff dashboard or is English-only acceptable initially?

## Progress Log
- 2025-10-22: Replaced public Contact page with scaffolded bilingual form, inline success/error banners, and guidance pointing users with active applications to Secure Messaging. Backend endpoint and admin tooling still pending.
