import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonDropdown,
  Header,
  Link,
  SpaceBetween,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "../../widgets/common";
import { useCaseWorkspace } from "../CaseWorkspaceContext.jsx";
import InterventionModal from "../modals/InterventionModal.jsx";

const formatCurrency = value => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `$${numeric.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatLabel = value => {
  if (!value) return "-";
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

const formatDate = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const statusIndicatorType = status => {
  const value = (status || "").toLowerCase();
  if (value === "completed") return "success";
  if (value === "cancelled") return "stopped";
  if (value === "suspended") return "warning";
  return "info";
};

const renderComplianceBadge = status => {
  switch ((status || "").toLowerCase()) {
    case "ok":
      return <Badge color="green">OK</Badge>;
    case "warning":
      return <Badge color="blue">Warning</Badge>;
    case "error":
      return <Badge color="red">Error</Badge>;
    default:
      return <Badge color="grey">Pending</Badge>;
  }
};

const InterventionsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    selectedActionPlanId,
    createIntervention,
    updateIntervention,
    interventionCodes,
    interventionCodesLoading,
    loadInterventionCodes,
    interventionOutcomes,
    interventionOutcomesLoading,
    loadInterventionOutcomes,
    fundingStreams,
    fundingStreamsLoading,
    loadFundingStreams,
    nocVersions,
    nocVersionsLoading,
    loadNocVersions,
    searchNocCodes,
  } = useCaseWorkspace();
  const [selectedInterventionId, setSelectedInterventionId] = useState(null);
  const [formMode, setFormMode] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const activePlan = useMemo(
    () => caseData?.actionPlans?.find(plan => plan.id === selectedActionPlanId),
    [caseData, selectedActionPlanId]
  );

  const interventions = activePlan?.interventions ?? [];
  const selectedIntervention = useMemo(
    () => interventions.find(item => item.id === selectedInterventionId) || null,
    [interventions, selectedInterventionId]
  );

  useEffect(() => {
    setSelectedInterventionId(null);
    setFormMode(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [activePlan?.id]);

  useEffect(() => {
    if (!formMode) return;
    if (interventionCodes.length > 0) return;
    let cancelled = false;
    setErrorMessage(null);
    loadInterventionCodes()
      .catch(error => {
        if (cancelled) return;
        setErrorMessage(error?.message || "Unable to load intervention codes.");
      });
    return () => {
      cancelled = true;
    };
  }, [formMode, interventionCodes, loadInterventionCodes]);

  useEffect(() => {
    if (!formMode) return;
    if (interventionOutcomes.length > 0) return;
    let cancelled = false;
    loadInterventionOutcomes().catch(error => {
      if (cancelled) return;
      setErrorMessage(current => current ?? (error?.message || "Unable to load intervention outcomes."));
    });
    return () => {
      cancelled = true;
    };
  }, [formMode, interventionOutcomes, loadInterventionOutcomes]);

  useEffect(() => {
    if (!formMode) return;
    if (fundingStreams.length > 0) return;
    let cancelled = false;
    loadFundingStreams().catch(error => {
      if (cancelled) return;
      setErrorMessage(current => current ?? (error?.message || "Unable to load funding streams."));
    });
    return () => {
      cancelled = true;
    };
  }, [formMode, fundingStreams, loadFundingStreams]);

  useEffect(() => {
    if (!formMode) return;
    if (nocVersions.length > 0) return;
    let cancelled = false;
    loadNocVersions().catch(error => {
      if (cancelled) return;
      setErrorMessage(current => current ?? (error?.message || "Unable to load NOC versions."));
    });
    return () => {
      cancelled = true;
    };
  }, [formMode, nocVersions, loadNocVersions]);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Interventions", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const planStatus = (activePlan?.status || "").toLowerCase();
  const canModify = !!activePlan && ["draft", "active"].includes(planStatus);
  const canEditSelected =
    canModify &&
    !!selectedIntervention &&
    !["completed", "cancelled"].includes((selectedIntervention?.status || "").toLowerCase());

  const openCreateModal = () => {
    if (!activePlan) {
      setErrorMessage("Select an action plan before adding interventions.");
      return;
    }
    setSuccessMessage(null);
    setErrorMessage(null);
    setFormMode("create");
  };

  const openEditModal = () => {
    if (!activePlan) {
      setErrorMessage("Select an action plan before editing interventions.");
      return;
    }
    if (!canEditSelected) {
      setErrorMessage(
        selectedIntervention
          ? "Completed or cancelled interventions are read-only."
          : "Select an intervention to edit."
      );
      return;
    }
    setSuccessMessage(null);
    setErrorMessage(null);
    setFormMode("edit");
  };

  const handleModalDismiss = () => setFormMode(null);

  const handleModalSubmit = async formValues => {
    if (!activePlan?.id) {
      const error = new Error("Select an action plan first.");
      setErrorMessage(error.message);
      throw error;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    let result;
    if (formMode === "edit") {
      if (!selectedIntervention) {
        const error = new Error("Select an intervention to edit.");
        setErrorMessage(error.message);
        throw error;
      }
      result = await updateIntervention(activePlan.id, selectedIntervention.id, formValues);
      setSuccessMessage(`Intervention "${result?.title || result?.code || "Intervention"}" updated.`);
    } else {
      result = await createIntervention(activePlan.id, formValues);
      setSuccessMessage(`Intervention "${result?.title || result?.code || "Intervention"}" created.`);
    }
    setFormMode(null);
    if (result?.id) {
      setSelectedInterventionId(result.id);
    }
    return result;
  };

  const columns = useMemo(
    () => [
      { id: "code", header: "Code", cell: item => item.code ?? "-", isRowHeader: true },
      { id: "title", header: "Description", cell: item => item.title ?? "-" },
      {
        id: "status",
        header: "Status",
        cell: item => (
          <StatusIndicator type={statusIndicatorType(item.status)}>
            {formatLabel(item.status)}
          </StatusIndicator>
        ),
      },
      {
        id: "dates",
        header: "Start – End",
        cell: item => `${formatDate(item.startDate)} – ${formatDate(item.endDate)}`,
      },
      { id: "outcome", header: "Outcome", cell: item => item.outcome ?? "-" },
      {
        id: "duration",
        header: "Duration (weeks)",
        cell: item => (Number.isFinite(item.durationWeeks) ? item.durationWeeks : "-"),
      },
      { id: "cost", header: "Cost", cell: item => formatCurrency(item.cost) },
      { id: "pot", header: "Budget pot", cell: item => item.potId ?? "Unmapped" },
      {
        id: "compliance",
        header: "Compliance",
        cell: item => (
          <SpaceBetween size="xxs" direction="horizontal">
            {renderComplianceBadge(item.compliance?.ilmp ?? "pending")}
            {renderComplianceBadge(item.compliance?.finance ?? "pending")}
          </SpaceBetween>
        ),
      },
    ],
    []
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={
            metadata.description ??
            "Manage ILMP-compliant intervention data, including budget pots and outcomes."
          }
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button iconName="add-plus" disabled={!canModify} onClick={openCreateModal}>
                Add intervention
              </Button>
              <Button iconName="edit" disabled={!canEditSelected} onClick={openEditModal}>
                Edit selected
              </Button>
            </SpaceBetween>
          }
        >
          {metadata.title ?? "Interventions"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Interventions settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {successMessage && (
          <Alert
            type="success"
            dismissible
            dismissAriaLabel="Dismiss success message"
            onDismiss={() => setSuccessMessage(null)}
          >
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert
            type="error"
            dismissible
            dismissAriaLabel="Dismiss error message"
            onDismiss={() => setErrorMessage(null)}
          >
            {errorMessage}
          </Alert>
        )}
        {activePlan ? (
          <Table
            trackBy="id"
            items={interventions}
            variant="embedded"
            selectionType="single"
            selectedItems={selectedIntervention ? [selectedIntervention] : []}
            onSelectionChange={({ detail }) => {
              const item = detail.selectedItems?.[0];
              setSelectedInterventionId(item?.id ?? null);
            }}
            columnDefinitions={columns}
            empty={<Box padding="m">No interventions defined for this action plan.</Box>}
          />
        ) : (
          <Box padding="m">
            <StatusIndicator type="info">Select an action plan to manage interventions.</StatusIndicator>
          </Box>
        )}
      </SpaceBetween>
      <InterventionModal
        visible={formMode !== null}
        mode={formMode || "create"}
        intervention={formMode === "edit" ? selectedIntervention : null}
        onDismiss={handleModalDismiss}
        onSubmit={handleModalSubmit}
        codeOptions={interventionCodes}
        codesLoading={interventionCodesLoading && interventionCodes.length === 0}
        outcomeOptions={interventionOutcomes}
        outcomesLoading={interventionOutcomesLoading && interventionOutcomes.length === 0}
        fundingStreamOptions={fundingStreams}
        fundingStreamsLoading={fundingStreamsLoading && fundingStreams.length === 0}
        nocVersions={nocVersions}
        nocVersionsLoading={nocVersionsLoading}
        onSearchNocCodes={searchNocCodes}
      />
    </BoardItem>
  );
};

export default InterventionsWidget;
