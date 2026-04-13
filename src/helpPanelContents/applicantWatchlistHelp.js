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
        full value so authorized staff can correct an entry directly. Notes entered here appear in the watchlist hit
        details view when staff open a flagged application.
      </p>
    </Box>
    <Box>
      <strong>Enable and disable</strong>
      <p>
        Use <strong>Disable watch</strong> to stop future watchlist hits without deleting history. Use{" "}
        <strong>Enable watch</strong> to restore an inactive entry. Existing case and application quick actions can
        still add or reactivate an entry when needed.
      </p>
    </Box>
    <Box>
      <strong>Related alerts</strong>
      <p>
        Active watchlist entries continue to drive the homepage watchlist-hit queue. Flagged applications now also show
        a warning in Application Overview with a <strong>View details</strong> action so staff can review watchlist
        notes and next-step instructions before proceeding.
      </p>
    </Box>
  </SpaceBetween>
);

ApplicantWatchlistHelp.aiContext =
  "Guide an NWAC Administrator or System Administrator using the Applicant Watchlist dashboard. " +
  "Explain that the page manages SIN-based watchlist entries, the table masks SIN values, notes appear in watchlist-hit details, " +
  "watch rows can be disabled or enabled without deleting history, and case/application quick actions can still add or reactivate applicants on the watchlist.";

export default ApplicantWatchlistHelp;
