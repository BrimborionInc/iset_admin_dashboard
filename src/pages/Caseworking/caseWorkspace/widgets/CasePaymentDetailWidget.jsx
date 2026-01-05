import React from "react";
import { useParams } from "react-router-dom";
import PaymentDetailWidget from "../../../finance/widgets/PaymentDetailWidget.jsx";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const CasePaymentDetailWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseId: routeCaseId } = useParams();
  const { caseData } = useCaseWorkspace();
  const resolvedCaseId = caseData?.id ?? routeCaseId ?? "";

  return (
    <PaymentDetailWidget
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

export default CasePaymentDetailWidget;
