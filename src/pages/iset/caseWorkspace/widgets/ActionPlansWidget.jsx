import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
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
import NewActionPlanModal from "../modals/NewActionPlanModal.jsx";
import CloseActionPlanModal from "../modals/CloseActionPlanModal.jsx";
import ConfirmActionPlanModal from "../modals/ConfirmActionPlanModal.jsx";
import ActionPlanDetailsModal from "../modals/ActionPlanDetailsModal.jsx";

const formatLabel = value => {
  if (!value) return "-";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
};

const formatDate = value => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
};

const getStatusType = status => {
  switch ((status || "").toLowerCase()) {
    case "draft":
      return "pending";
    case "active":
      return "info";
    case "closed":
      return "success";
    case "archived":
      return "stopped";
    default:
      return "info";
  }
};

const getPlanActions = status => {
  const actions = [{ id: "view", text: "View action plan" }];
  switch ((status || "").toLowerCase()) {
    case "draft":
      actions.push(
        { id: "activate", text: "Activate plan" },
        { id: "archive", text: "Archive plan" }
      );
      break;
    case "active":
      actions.push({ id: "close", text: "Close plan" });
      break;
    case "closed":
      actions.push({ id: "archive", text: "Archive plan" });
      break;
    default:
      break;
  }
  return actions;
};

const ActionPlansWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    caseData,
    selectedActionPlanId,
    setSelectedActionPlanId,
    refresh,
    activateActionPlan,
    closeActionPlan,
    archiveActionPlan,
  } = useCaseWorkspace();
  const [modalVisible, setModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [closeModalPlan, setCloseModalPlan] = useState(null);
  const [detailsModalPlan, setDetailsModalPlan] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [closeError, setCloseError] = useState(null);

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? "Action plans", metadata.aiContext ?? "");
      }}
    >
      Info
    </Link>
  ) : undefined;

  const plans = caseData?.actionPlans ?? [];

  const handleActionFeedback = message => {
    setSuccessMessage(message);
    setErrorMessage(null);
  };

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const handleCreated = plan => {
    handleActionFeedback(plan?.name ? `Action plan "${plan.name}" created.` : "Action plan created.");
    if (plan?.id) {
      setSelectedActionPlanId(plan.id);
    }
    refresh().catch(() => {});
  };

  const handlePlanAction = (actionId, plan) => {
    if (!plan || !actionId) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    if (actionId === "view") {
      setDetailsModalPlan(plan);
    } else if (actionId === "activate") {
      setPendingConfirm({ type: "activate", plan });
    } else if (actionId === "close") {
      setCloseError(null);
      setCloseModalPlan(plan);
    } else if (actionId === "archive") {
      setPendingConfirm({ type: "archive", plan });
    }
  };

  const executePendingAction = async () => {
    if (!pendingConfirm) return;
    const { type, plan } = pendingConfirm;
    setActionSubmitting(true);
    try {
      if (type === "activate") {
        const updated = await activateActionPlan(plan.id);
        handleActionFeedback(`Action plan "${updated?.name || plan.title}" activated.`);
        setSelectedActionPlanId(updated?.id || plan.id);
      } else if (type === "archive") {
        const updated = await archiveActionPlan(plan.id, {});
        handleActionFeedback(`Action plan "${updated?.name || plan.title}" archived.`);
        if ((updated?.status || "").toLowerCase() === "archived" && selectedActionPlanId === plan.id) {
          setSelectedActionPlanId(null);
        }
      }
      await refresh().catch(() => {});
    } catch (error) {
      setErrorMessage(error?.message || "Unable to update action plan.");
    } finally {
      setActionSubmitting(false);
      setPendingConfirm(null);
    }
  };

  const handleCloseSubmit = async payload => {
    if (!closeModalPlan) return;
    setCloseSubmitting(true);
    setCloseError(null);
    try {
      const updated = await closeActionPlan(closeModalPlan.id, payload);
      handleActionFeedback(`Action plan "${updated?.name || closeModalPlan.title}" closed.`);
      await refresh().catch(() => {});
      setCloseModalPlan(null);
    } catch (error) {
      setCloseError(error?.message || "Unable to close action plan.");
    } finally {
      setCloseSubmitting(false);
    }
  };

  const handleCloseDismiss = () => {
    if (closeSubmitting) return;
    setCloseModalPlan(null);
    setCloseError(null);
  };

  const tableColumns = useMemo(() => [
    {
      id: "title",
      header: "Plan",
      cell: item => item.title || "Untitled",
      isRowHeader: true,
    },
    {
      id: "dates",
      header: "Dates",
      cell: item => `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`,
    },
    {
      id: "status",
      header: "Status",
      cell: item => (
        <StatusIndicator type={getStatusType(item.status)}>
          {formatLabel(item.status || "unknown")}
        </StatusIndicator>
      ),
    },
    {
      id: "result",
      header: "Result",
      cell: item => {
        if (!item.resultCode) return "-";
        return (
          <SpaceBetween size="xxs">
            <span>{formatLabel(item.resultCode)}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-body-secondary)" }}>
              {formatDate(item.resultDate)}
            </span>
          </SpaceBetween>
        );
      },
    },
    {
      id: "interventions",
      header: "Interventions",
      cell: item =>
        Number.isFinite(item.interventionCount)
          ? item.interventionCount
          : item.interventions
          ? item.interventions.length
          : 0,
    },
    {
      id: "actions",
      header: "Actions",
      cell: item => {
        const items = getPlanActions(item.status);
        if (!items.length) {
          return <span style={{ color: "var(--color-text-body-secondary)" }}>None</span>;
        }
        const disabled = actionSubmitting || closeSubmitting;
        return (
          <ButtonDropdown
            ariaLabel={`Actions for ${item.title}`}
            items={items}
            onItemClick={({ detail }) => handlePlanAction(detail.id, item)}
            disabled={disabled}
            expandToViewport
          >
            Actions
          </ButtonDropdown>
        );
      },
    },
  ], [actionSubmitting, closeSubmitting]);

  const confirmContent = useMemo(() => {
    if (!pendingConfirm) return null;
    const planName = pendingConfirm.plan?.title || "this action plan";
    if (pendingConfirm.type === "activate") {
      return {
        title: "Activate action plan",
        message: `Activate "${planName}"? Only one action plan can be active at a time.`,
        confirmLabel: "Activate",
      };
    }
    return {
      title: "Archive action plan",
      message: `Archive "${planName}"? Archived plans become read-only.`,
      confirmLabel: "Archive",
    };
  }, [pendingConfirm]);

  const handleDetailsSaved = async updated => {
    setDetailsModalPlan(null);
    handleActionFeedback(`Action plan "${updated?.name || updated?.title || "Plan"}" updated.`);
    await refresh().catch(() => {});
  };

  const handleDetailsDismiss = () => {
    if (actionSubmitting || closeSubmitting) return;
    setDetailsModalPlan(null);
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description={metadata.description ?? "Manage action plans and select one to edit interventions."}
          actions={
            <Button iconName="add-plus" onClick={() => setModalVisible(true)}>
              New action plan
            </Button>
          }
        >
          {metadata.title ?? "Action plans"}
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Action plans settings"
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
          <Alert type="success" onDismiss={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert type="error" onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}
        {plans.length ? (
          <Table
            trackBy="id"
            variant="embedded"
            resizableColumns
            selectionType="single"
            selectedItems={plans.filter(plan => plan.id === selectedActionPlanId)}
            onSelectionChange={({ detail }) => {
              const plan = detail?.selectedItems?.[0];
              if (plan?.id) {
                setSelectedActionPlanId(plan.id);
              }
            }}
            onRowClick={({ detail }) => {
              const plan = detail?.item;
              if (plan?.id) {
                setSelectedActionPlanId(plan.id);
              }
            }}
            columnDefinitions={tableColumns}
            items={plans}
            empty={<Box padding="m">No action plans defined yet.</Box>}
            header={<Header variant="h3">Action plans</Header>}
          />
        ) : (
          <Box padding="m">No action plans defined yet.</Box>
        )}
      </SpaceBetween>
      {modalVisible && (
        <NewActionPlanModal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          onCreated={plan => {
            setModalVisible(false);
            handleCreated(plan);
          }}
        />
      )}
      <CloseActionPlanModal
        visible={!!closeModalPlan}
        plan={closeModalPlan}
        submitting={closeSubmitting}
        error={closeError}
        onSubmit={handleCloseSubmit}
        onDismiss={handleCloseDismiss}
      />
      <ActionPlanDetailsModal
        visible={!!detailsModalPlan}
        plan={detailsModalPlan}
        onDismiss={handleDetailsDismiss}
        onSaved={handleDetailsSaved}
      />
      <ConfirmActionPlanModal
        visible={!!pendingConfirm}
        title={confirmContent?.title || ""}
        message={confirmContent?.message || ""}
        confirmLabel={confirmContent?.confirmLabel || "Confirm"}
        submitting={actionSubmitting}
        onConfirm={executePendingAction}
        onDismiss={() => {
          if (actionSubmitting) return;
          setPendingConfirm(null);
        }}
      />
    </BoardItem>
  );
};

export default ActionPlansWidget;
