import React from "react";
import ApplicationEvents from "../../../../widgets/caseWorkspace/ApplicationEventsWidget";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const CaseApplicationEventsWidget = ({ actions, metadata, toggleHelpPanel }) => {
  const { caseData } = useCaseWorkspace();
  const applicationId =
    caseData?.application_id ||
    caseData?.applicationId ||
    caseData?.id ||
    null;

  return (
    <ApplicationEvents
      actions={actions}
      application_id={applicationId}
      caseData={caseData}
      toggleHelpPanel={toggleHelpPanel}
      metadata={metadata}
    />
  );
};

export default CaseApplicationEventsWidget;
