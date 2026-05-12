import React from "react";
import { useParams } from "react-router-dom";
import PaymentCommunicationWidget from "../../../finance/widgets/PaymentCommunicationWidget.jsx";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const CasePaymentCommunicationWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseId: routeCaseId } = useParams();
  const { caseData } = useCaseWorkspace();
  const resolvedCaseId = caseData?.id ?? routeCaseId ?? "";

  return (
    <PaymentCommunicationWidget
      actions={actions}
      toggleHelpPanel={toggleHelpPanel}
      metadata={{
        ...metadata,
        mode: "program",
        caseId: resolvedCaseId,
      }}
    />
  );
};

export default CasePaymentCommunicationWidget;
