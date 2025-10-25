import React from "react";
import SupportingDocumentsWidget from "../../../../widgets/caseWorkspace/SupportingDocumentsWidget";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const CaseSupportingDocumentsWidget = ({ actions, metadata, toggleHelpPanel }) => {
  const { caseData } = useCaseWorkspace();
  return (
    <SupportingDocumentsWidget
      actions={actions}
      caseData={caseData}
      toggleHelpPanel={toggleHelpPanel}
      metadata={metadata}
    />
  );
};

export default CaseSupportingDocumentsWidget;
