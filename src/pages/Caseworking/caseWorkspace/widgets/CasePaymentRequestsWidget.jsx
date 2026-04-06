import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import PaymentRequestsWidget from "../../../finance/widgets/PaymentRequestsWidget.jsx";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";

const buildCaseLabel = (caseData, fallbackCaseId) => {
  const caseNumber =
    caseData?.caseNumber ||
    caseData?.agreementNumber ||
    caseData?.trackingId ||
    caseData?.tracking_id ||
    fallbackCaseId;
  const clientName = caseData?.client?.name || caseData?.applicantName || caseData?.applicant_name;
  if (caseNumber && clientName) {
    return `Case ${caseNumber} - ${clientName}`;
  }
  if (caseNumber) {
    return `Case ${caseNumber}`;
  }
  if (clientName) {
    return clientName;
  }
  return fallbackCaseId ? `Case ${fallbackCaseId}` : "Case";
};

const CasePaymentRequestsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { caseId: routeCaseId } = useParams();
  const { caseData, selectedInterventionId } = useCaseWorkspace();
  const resolvedCaseId = caseData?.id ?? routeCaseId ?? "";
  const caseLabel = useMemo(
    () => buildCaseLabel(caseData, resolvedCaseId),
    [caseData, resolvedCaseId]
  );
  const caseRegionCode = useMemo(() => {
    const regionDetails = caseData?.client?.regionDetails;
    const code =
      regionDetails?.code ||
      regionDetails?.regionCode ||
      regionDetails?.region_code ||
      null;
    if (code) {
      return String(code).trim().toUpperCase();
    }
    const fallback = caseData?.client?.region;
    if (fallback && typeof fallback === "object") {
      const fallbackCode = fallback.code || fallback.regionCode || fallback.region_code;
      if (fallbackCode) {
        return String(fallbackCode).trim().toUpperCase();
      }
    }
    return null;
  }, [caseData]);

  return (
    <PaymentRequestsWidget
      actions={actions}
      toggleHelpPanel={toggleHelpPanel}
      metadata={{
        ...metadata,
        mode: "program",
        caseId: resolvedCaseId,
        caseLabel,
        caseRegionCode,
        selectedInterventionId,
      }}
    />
  );
};

export default CasePaymentRequestsWidget;
