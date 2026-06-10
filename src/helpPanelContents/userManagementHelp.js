import React from 'react';
import { Box, SpaceBetween } from '@cloudscape-design/components';

const UserManagementHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What this dashboard is for</strong>
      <p>
        User Management is the staff access and participant PATH-account control surface. Use it to invite staff users,
        manage their role and region access, resolve pending first sign-in or MFA issues, and create or activate
        participant accounts for imported client files.
      </p>
    </Box>
    <Box>
      <strong>Staff access</strong>
      <p>
        The Staff access tab lists the administrative users your role is allowed to manage. Use the status filters to
        find disabled accounts, pending first sign-in accounts, missing MFA, and users who have never signed in. Select a
        row to review profile, role, region, security, and activity details.
      </p>
    </Box>
    <Box>
      <strong>Participant PATH accounts</strong>
      <p>
        The Participant PATH accounts tab is for imported applicants and clients. Create an account only when the email
        is correct, then send or resend the PATH activation email when the participant is ready to access the portal.
      </p>
    </Box>
    <Box>
      <strong>Access guardrails</strong>
      <p>
        Staff regions are database-backed through staff profiles and staff-region assignments. Do not treat Cognito
        legacy custom region or user-id claims as the source of truth for access. For participants, avoid manually
        linking accounts by name; use the client-linked PATH account controls.
      </p>
    </Box>
  </SpaceBetween>
);

UserManagementHelp.aiContext =
  'You are helping an authorized PATH staff user on the User Management dashboard. ' +
  'Explain the page as two operational areas: Staff access for Cognito-backed staff/admin accounts, roles, MFA, pending first sign-in, disabled accounts, and database-backed region access; and Participant PATH accounts for imported applicants/clients, account creation, activation email sending, invitation tracking, and activated status. ' +
  'Emphasize access safety: staff role/region scope comes from staff_profiles and staff_region, not legacy Cognito custom claims; participant accounts must stay linked to the correct client and should not be guessed by name. ' +
  'Do not describe generic role CRUD, delete-user flows, or fake help links.';

export default UserManagementHelp;
