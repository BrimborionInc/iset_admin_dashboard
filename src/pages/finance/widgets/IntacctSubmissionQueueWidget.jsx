import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Link,
  Table,
  Box,
  Select,
  StatusIndicator,
  TextFilter,
  Pagination,
  Alert,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useIntacctSubmissionData } from "./IntacctSubmissionDataContext.jsx";
import FinanceReconciliationTransactionsHelp from "../../../helpPanelContents/financeReconciliationTransactionsHelp.js";

const PAGE_SIZE = 10;

const outcomeOptions = [
  { label: "All outcomes", value: "all" },
  { label: "Success", value: "success" },
  { label: "Partial (attachments)", value: "partial" },
  { label: "Failed", value: "failed" },
];

const reasonLabels = {
  validation: "Validation error",
  authentication: "Authentication error",
  connectivity: "Connectivity issue",
  submission: "Submission error",
  attachments: "Attachment error",
  unknown: "Unknown",
};

const reasonOptions = [
  { label: "All reasons", value: "all" },
  { label: reasonLabels.validation, value: "validation" },
  { label: reasonLabels.authentication, value: "authentication" },
  { label: reasonLabels.connectivity, value: "connectivity" },
  { label: reasonLabels.submission, value: "submission" },
  { label: reasonLabels.attachments, value: "attachments" },
  { label: reasonLabels.unknown, value: "unknown" },
];

const outcomeBadge = outcome => {
  if (outcome === "success") return { type: "success", label: "Success" };
  if (outcome === "partial") return { type: "warning", label: "Partial" };
  if (outcome === "failed") return { type: "error", label: "Failed" };
  return { type: "info", label: "Unknown" };
};

const formatDateTime = value => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString();
};

const formatCurrency = (value, currency = "CAD") => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "—";
  try {
    return amount.toLocaleString("en-CA", { style: "currency", currency });
  } catch (err) {
    return amount.toLocaleString("en-CA", { minimumFractionDigits: 2 });
  }
};

const IntacctSubmissionQueueWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const { submissions, loading, error, selectedSubmissionId, selectSubmission } =
    useIntacctSubmissionData();

  const [outcomeFilter, setOutcomeFilter] = useState(outcomeOptions[0]);
  const [reasonFilter, setReasonFilter] = useState(reasonOptions[0]);
  const [filteringText, setFilteringText] = useState("");
  const [currentPageIndex, setCurrentPageIndex] = useState(1);

  const filteredItems = useMemo(() => {
    const text = filteringText.trim().toLowerCase();
    return submissions.filter(item => {
      const outcomeMatch =
        outcomeFilter.value === "all" ? true : item.outcome === outcomeFilter.value;
      const reasonMatch =
        reasonFilter.value === "all" ? true : item.reason === reasonFilter.value;
      const textMatch = !text
        ? true
        : [
            item.packetLabel,
            item.caseNumber,
            item.caseId,
            item.clientName,
            item.interventionName,
          ]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(text));
      return outcomeMatch && reasonMatch && textMatch;
    });
  }, [submissions, outcomeFilter, reasonFilter, filteringText]);

  const pagesCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pagedItems = filteredItems.slice(
    (currentPageIndex - 1) * PAGE_SIZE,
    currentPageIndex * PAGE_SIZE
  );

  useEffect(() => {
    if (currentPageIndex > pagesCount) {
      setCurrentPageIndex(pagesCount);
    }
  }, [currentPageIndex, pagesCount]);

  const infoHelper = metadata.helpComponent
    ? metadata
    : {
        helpComponent: FinanceReconciliationTransactionsHelp,
        helpTitle: "Submission queue",
        aiContext: FinanceReconciliationTransactionsHelp.aiContext,
      };

  const infoLinkComputed =
    toggleHelpPanel && infoHelper.helpComponent
      ? (
          <Link
            variant="info"
            onFollow={event => {
              event.preventDefault();
              const helpContent = React.createElement(infoHelper.helpComponent);
              toggleHelpPanel(helpContent, infoHelper.helpTitle, infoHelper.aiContext);
            }}
          >
            Info
          </Link>
        )
      : undefined;

  const selectedItems = selectedSubmissionId
    ? filteredItems.filter(item => item.id === selectedSubmissionId)
    : [];

  const columnDefinitions = [
    {
      id: "packet",
      header: "Packet",
      cell: item => item.packetLabel || `PKT-${item.id}`,
      minWidth: 120,
    },
    {
      id: "case",
      header: "Case",
      cell: item => item.caseNumber || item.caseId || "—",
      minWidth: 140,
    },
    {
      id: "amount",
      header: "Amount",
      cell: item => formatCurrency(item.totalAmount, item.currency),
      minWidth: 120,
    },
    {
      id: "attempted",
      header: "Last attempt",
      cell: item => formatDateTime(item.lastAttemptAt || item.submittedAt),
      minWidth: 180,
    },
    {
      id: "outcome",
      header: "Outcome",
      cell: item => {
        const badge = outcomeBadge(item.outcome);
        return <StatusIndicator type={badge.type}>{badge.label}</StatusIndicator>;
      },
      minWidth: 140,
    },
    {
      id: "reason",
      header: "Reason",
      cell: item => reasonLabels[item.reason] || "—",
      minWidth: 160,
    },
  ];

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLinkComputed}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Select
                selectedOption={outcomeFilter}
                options={outcomeOptions}
                onChange={({ detail }) => {
                  setOutcomeFilter(detail.selectedOption);
                  setCurrentPageIndex(1);
                }}
                selectedAriaLabel="Selected outcome filter"
                placeholder="Outcome"
              />
              <Select
                selectedOption={reasonFilter}
                options={reasonOptions}
                onChange={({ detail }) => {
                  setReasonFilter(detail.selectedOption);
                  setCurrentPageIndex(1);
                }}
                selectedAriaLabel="Selected reason filter"
                placeholder="Reason"
              />
            </SpaceBetween>
          }
          description="Payment packets with Intacct REST submission attempts and their latest outcomes."
        >
          Submission queue
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Submission queue settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={({ detail }) => {
              if (detail?.id === "remove") {
                actions.removeItem();
              }
            }}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        <Box variant="p">
          Review the latest Intacct submission results. Select a packet to see full error details
          and retry guidance in Submission detail.
        </Box>
        {error ? (
          <Alert type="error" header="Unable to load Intacct submissions">
            {error}
          </Alert>
        ) : null}
        <Table
          trackBy="id"
          items={pagedItems}
          selectionType="single"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => {
            const next = detail.selectedItems?.[0];
            selectSubmission(next ? next.id : null);
          }}
          columnDefinitions={columnDefinitions}
          variant="embedded"
          loading={loading}
          loadingText="Loading Intacct submissions"
          filter={
            <TextFilter
              filteringText={filteringText}
              onChange={({ detail }) => {
                setFilteringText(detail.filteringText);
                setCurrentPageIndex(1);
              }}
              filteringPlaceholder="Search by packet, case, client, or intervention"
              countText={`${filteredItems.length} match${filteredItems.length === 1 ? "" : "es"}`}
            />
          }
          pagination={
            <Pagination
              currentPageIndex={currentPageIndex}
              pagesCount={pagesCount}
              onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
              disabled={pagesCount <= 1}
            />
          }
          empty={
            <Box padding="m">
              No Intacct submissions recorded yet.
            </Box>
          }
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default IntacctSubmissionQueueWidget;
