import React, { useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  ExpandableSection,
  FileUpload,
  FormField,
  Header,
  Input,
  Link,
  SpaceBetween,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import boardItemI18nStrings from "../../../widgets/common";

const MAX_UPLOAD_MB = 5;
const MAX_IMPORT_ROWS = 500;

const TEMPLATE_COLUMNS = [
  "First Name",
  "Last Name",
  "Middle Initials",
  "Preferred Name",
  "Date of Birth",
  "Birth Gender",
  "Identity Gender",
  "Indigenous Identity",
  "SIN",
  "Email",
  "Phone Primary",
  "Phone Alternate",
  "Address Line 1",
  "City",
  "Province",
  "Postal Code",
  "Mailing Address",
  "Home Community",
];

const ACTION_LABELS = {
  create_client_and_case: "Create client and case",
  create_case_for_existing_client: "Create case for existing client",
  update_existing_case: "Update existing case",
  manual_review: "Manual review required",
};

const MATCH_SOURCE_LABELS = {
  sin: "SIN",
  sin_case_or_submission: "case/submission SIN",
  email: "email",
  name_dob: "name + DOB",
  name_only: "name only",
};

const downloadTemplate = () => {
  const csv = `${TEMPLATE_COLUMNS.join(",")}\n`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "client-batch-import-template.csv";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const renderIssueList = issues => {
  if (!Array.isArray(issues) || issues.length === 0) {
    return <Box color="text-body-secondary">No issues</Box>;
  }
  return (
    <SpaceBetween size="xxs">
      {issues.map((issue, index) => (
        <Box key={`${issue?.code || "issue"}-${index}`} color={issue?.level === "error" ? "text-status-error" : "text-status-info"}>
          {issue?.message || issue?.code || "Issue"}
        </Box>
      ))}
    </SpaceBetween>
  );
};

const renderMatchSummary = item => {
  if (!item?.matchedClient?.id) {
    return <Box color="text-body-secondary">New client</Box>;
  }
  const source =
    MATCH_SOURCE_LABELS[item.matchedClient.matchSource] ||
    item.matchedClient.matchSource ||
    "match";
  return (
    <SpaceBetween size="xxs">
      <Box>{`Client #${item.matchedClient.id} via ${source}`}</Box>
      {item.matchedClient.existingCaseNumber ? (
        <Box color="text-body-secondary">
          {`Case ${item.matchedClient.existingCaseNumber} (${item.matchedClient.existingCaseStatus || "status unknown"})`}
        </Box>
      ) : item.matchedClient.existingCaseCount > 0 ? (
        <Box color="text-body-secondary">{`${item.matchedClient.existingCaseCount} existing case(s)`}</Box>
      ) : (
        <Box color="text-body-secondary">No existing case</Box>
      )}
    </SpaceBetween>
  );
};

const ClientFileImportWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  preview = null,
  previewError = null,
  commitError = null,
  commitResult = null,
  isPreviewing = false,
  isCommitting = false,
  onPreviewFile,
  onCommit,
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [firstDataRowNumber, setFirstDataRowNumber] = useState("");
  const [localError, setLocalError] = useState(null);

  const infoLink = useMemo(() => {
    if (!metadata?.helpComponent || !toggleHelpPanel) return undefined;
    return (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const HelpComponent = metadata.helpComponent;
          toggleHelpPanel(
            <HelpComponent />,
            metadata.helpTitle || metadata.title || "Client batch import",
            metadata.aiContext || "",
          );
        }}
      >
        Info
      </Link>
    );
  }, [metadata, toggleHelpPanel]);

  const settingsMenu =
    actions && typeof actions.removeItem === "function" ? (
      <ButtonDropdown
        ariaLabel="Client batch import widget settings"
        variant="icon"
        items={[{ id: "remove", text: "Remove widget" }]}
        onItemClick={({ detail }) => {
          if (detail?.id === "remove") {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  const handlePreview = async () => {
    setLocalError(null);
    const file = Array.isArray(selectedFiles) && selectedFiles.length ? selectedFiles[0] : null;
    if (!file) {
      setLocalError("Select a spreadsheet before previewing the import.");
      return;
    }
    const manualFirstDataRowNumber = firstDataRowNumber ? Number(firstDataRowNumber) : null;
    if (firstDataRowNumber && (!Number.isInteger(manualFirstDataRowNumber) || manualFirstDataRowNumber < 1)) {
      setLocalError("First data row must be a whole number greater than 0.");
      return;
    }
    try {
      await onPreviewFile?.(file, {
        firstDataRowNumber: manualFirstDataRowNumber,
      });
    } catch (error) {
      setLocalError(error?.message || "The import preview failed.");
    }
  };

  const handleCommit = async () => {
    setLocalError(null);
    try {
      await onCommit?.();
    } catch (error) {
      setLocalError(error?.message || "The import could not be committed.");
    }
  };

  const summaryItems = preview?.summary
    ? [
        { label: "Total rows", value: String(preview.summary.totalRows || 0) },
        { label: "Ready", value: String(preview.summary.readyRows || 0) },
        { label: "Blocked", value: String(preview.summary.blockedRows || 0) },
        { label: "Warnings", value: String(preview.summary.warningRows || 0) },
        { label: "New clients + cases", value: String(preview.summary.createClientAndCaseCount || 0) },
        { label: "Existing clients", value: String(preview.summary.matchedClientCount || 0) },
      ]
    : [];

  const previewColumns = useMemo(
    () => [
      {
        id: "status",
        header: "Status",
        cell: item => (
          <StatusIndicator type={item.ready ? "success" : "error"}>
            {item.ready ? "Ready" : "Blocked"}
          </StatusIndicator>
        ),
      },
      {
        id: "rowNumber",
        header: "Row",
        cell: item => item.rowNumber || "—",
      },
      {
        id: "displayName",
        header: "Participant",
        cell: item => item.displayName || "Unnamed row",
      },
      {
        id: "action",
        header: "Planned action",
        cell: item => ACTION_LABELS[item.action] || item.action || "Review",
      },
      {
        id: "match",
        header: "Match",
        cell: item => renderMatchSummary(item),
      },
      {
        id: "issues",
        header: "Issues",
        cell: item => renderIssueList(item.issues),
      },
    ],
    []
  );

  const commitColumns = useMemo(
    () => [
      {
        id: "rowNumber",
        header: "Row",
        cell: item => item.rowNumber || "—",
      },
      {
        id: "displayName",
        header: "Participant",
        cell: item => item.displayName || "Unnamed row",
      },
      {
        id: "action",
        header: "Committed action",
        cell: item => ACTION_LABELS[item.action] || item.action || "Imported",
      },
      {
        id: "caseNumber",
        header: "Case",
        cell: item =>
          item.caseId ? (
            <Link href={`/cases/${item.caseId}`}>{item.caseNumber || `Case ${item.caseId}`}</Link>
          ) : (
            "—"
          ),
      },
      {
        id: "clientId",
        header: "Client ID",
        cell: item => item.clientId || "—",
      },
    ],
    []
  );

  const canPreview = !isPreviewing && !isCommitting;
  const canCommit = Boolean(preview?.canCommit) && !isPreviewing && !isCommitting;

  return (
    <BoardItem
      header={
        <Header variant="h2" description={metadata?.description} info={infoLink}>
          {metadata?.title || "Client batch import"}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {localError ? <Alert type="error">{localError}</Alert> : null}
        {previewError ? <Alert type="error">{previewError}</Alert> : null}
        {commitError ? <Alert type="error">{commitError}</Alert> : null}
        {commitResult ? (
          <Alert type="success" header="Import committed">
            {`${commitResult.summary?.processedRows || 0} row(s) were applied. ${commitResult.summary?.createdCases || 0} case(s) were created and ${commitResult.summary?.updatedCases || 0} existing case(s) were updated.`}
          </Alert>
        ) : null}

        <Alert type="info" header="Client batch import only">
          This dashboard creates or updates core client files only. It does not create applicant accounts, historical
          applications, assessments, or interventions.
        </Alert>

        <FormField
          label="Spreadsheet"
          description="Upload one client backload spreadsheet for dry-run review."
          constraintText={`One .xlsx, .xlsm, or .csv file up to ${MAX_UPLOAD_MB} MB and ${MAX_IMPORT_ROWS} data rows.`}
        >
          <FileUpload
            value={selectedFiles}
            onChange={({ detail }) => {
              setLocalError(null);
              setSelectedFiles(Array.isArray(detail?.value) ? detail.value.slice(0, 1) : []);
            }}
            multiple={false}
            accept={[".xlsx", ".xlsm", ".csv"]}
            loading={isPreviewing}
          />
        </FormField>

        <FormField
          label="First data row"
          description="Optional. Use this when the spreadsheet includes guidance rows between the column headers and the first participant row."
          constraintText="Leave blank to auto-detect the first participant data row."
        >
          <Input
            type="number"
            placeholder="Auto-detect"
            value={firstDataRowNumber}
            onChange={({ detail }) => {
              setLocalError(null);
              setFirstDataRowNumber(String(detail.value || "").replace(/[^\d]/g, ""));
            }}
          />
        </FormField>

        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" onClick={handlePreview} loading={isPreviewing} disabled={!canPreview}>
            Preview import
          </Button>
          <Button onClick={handleCommit} loading={isCommitting} disabled={!canCommit}>
            Commit import
          </Button>
          <Button onClick={downloadTemplate} disabled={isPreviewing || isCommitting}>
            Download CSV template
          </Button>
        </SpaceBetween>

        {(isPreviewing || isCommitting) ? (
          <StatusIndicator type="loading">
            {isPreviewing ? "Preparing dry run" : "Committing client batch import"}
          </StatusIndicator>
        ) : null}

        <ExpandableSection headerText="Expected columns">
          <Box color="text-body-secondary">
            {TEMPLATE_COLUMNS.join(", ")}
          </Box>
        </ExpandableSection>

        {preview?.unknownHeaders?.length ? (
          <Alert type="warning" header="Ignored columns">
            {preview.unknownHeaders.join(", ")}
          </Alert>
        ) : null}

        {preview?.headerRowNumber ? (
          <Box color="text-body-secondary">
            {`Using header row ${preview.headerRowNumber} and ${preview.firstDataRowMode === "manual" ? "manual" : "auto-detected"} first data row ${preview.firstDataRowNumber || "?"}${
              preview.skippedLeadingRowCount
                ? ` (${preview.skippedLeadingRowCount} leading non-data row${preview.skippedLeadingRowCount === 1 ? "" : "s"} skipped)`
                : ""
            }.`}
          </Box>
        ) : null}

        {preview?.summary ? (
          <ColumnLayout columns={3} variant="text-grid">
            {summaryItems.map(item => (
              <div key={item.label}>
                <Box color="text-body-secondary" fontSize="body-s">
                  {item.label}
                </Box>
                <Box fontSize="heading-m">{item.value}</Box>
              </div>
            ))}
          </ColumnLayout>
        ) : null}

        <Table
          header={
            <Header
              variant="h3"
              description={
                preview?.fileName
                  ? `${preview.fileName}${preview.worksheetName ? ` • ${preview.worksheetName}` : ""}`
                  : "Run a dry run to review the import plan."
              }
            >
              Dry-run preview
            </Header>
          }
          columnDefinitions={previewColumns}
          items={preview?.rows || []}
          loading={isPreviewing}
          wrapLines
          empty={
            <Box color="text-body-secondary">
              Upload a spreadsheet and run a dry run to see which client files will be created or updated.
            </Box>
          }
        />

        {commitResult?.results?.length ? (
          <Table
            header={<Header variant="h3">Committed rows</Header>}
            columnDefinitions={commitColumns}
            items={commitResult.results}
            wrapLines
            empty={<Box color="text-body-secondary">No rows have been committed yet.</Box>}
          />
        ) : null}
      </SpaceBetween>
    </BoardItem>
  );
};

export default ClientFileImportWidget;
