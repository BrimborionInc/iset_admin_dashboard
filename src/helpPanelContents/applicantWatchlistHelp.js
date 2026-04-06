import React from "react";
import { Box, SpaceBetween } from "@cloudscape-design/components";

const ApplicantWatchlistHelp = () => (
  <SpaceBetween size="m">
    <Box>
      <strong>What this dashboard is for</strong>
      <p>
        The Applicant Watchlist dashboard lets NWAC and System Administrators review and maintain the SIN-based
        watchlist used to flag future applications from specific individuals.
      </p>
    </Box>
    <Box>
      <strong>How entries work</strong>
      <p>
        Entries are keyed by Social Insurance Number. The table masks SIN values by default, while the editor shows the
        full value so authorized staff can correct an entry directly.
      </p>
    </Box>
    <Box>
      <strong>Active and inactive</strong>
      <p>
        Removing someone from the watchlist marks the entry inactive instead of deleting it. Existing case and
        application quick actions can still add or reactivate an entry when needed.
      </p>
    </Box>
    <Box>
      <strong>Related alerts</strong>
      <p>
        Active watchlist entries continue to drive the homepage watchlist-hit queue and now also emit shared watchlist
        events for add, update, remove, and hit activity.
      </p>
    </Box>
  </SpaceBetween>
);

ApplicantWatchlistHelp.aiContext =
  "Guide an NWAC Administrator or System Administrator using the Applicant Watchlist dashboard. " +
  "Explain that the page manages SIN-based watchlist entries, the table masks SIN values, inactive entries stay in history, " +
  "and case/application quick actions can still add or reactivate applicants on the watchlist.";

export default ApplicantWatchlistHelp;
