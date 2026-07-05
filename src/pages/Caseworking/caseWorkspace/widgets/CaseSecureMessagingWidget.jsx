import React from "react";
import SecureMessagingWidget from "../../../../widgets/SecureMessagingWidget";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const CaseSecureMessagingWidget = ({ actions, metadata, toggleHelpPanel }) => {
  const { caseData } = useCaseWorkspace();
  return (
    <SecureMessagingWidget
      actions={actions}
      caseData={caseData}
      toggleHelpPanel={toggleHelpPanel}
      metadata={metadata}
    />
  );
};

export default CaseSecureMessagingWidget;
