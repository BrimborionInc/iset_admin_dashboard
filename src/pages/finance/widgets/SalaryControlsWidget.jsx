import React from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Badge,
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  FormField,
  Header,
  Link,
  Select,
  SpaceBetween,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useSalariesData } from "./SalariesDataContext.jsx";

const SalaryControlsWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    selectedFiscalYearStart,
    fiscalYearOptions,
    summary,
    changedRowsCount,
    hasUnsavedChanges,
    loading,
    saving,
    lastLoadedAt,
    setSelectedFiscalYearStart,
    refreshData,
  } = useSalariesData();

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const infoLink = metadata.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        toggleHelpPanel(
          React.createElement(metadata.helpComponent),
          metadata.helpTitle ?? "Salary controls",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              {hasUnsavedChanges ? <Badge color="blue">{changedRowsCount} unsaved</Badge> : null}
              <Button iconName="refresh" onClick={refreshData} loading={loading || saving}>
                Refresh
              </Button>
            </SpaceBetween>
          }
        >
          Salary controls
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Salary controls settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <ColumnLayout columns={4} borders="vertical">
          <FormField label="Fiscal year">
            <Select
              selectedOption={
                fiscalYearOptions.find(option => option.value === String(selectedFiscalYearStart)) || null
              }
              options={fiscalYearOptions}
              onChange={({ detail }) => setSelectedFiscalYearStart(detail.selectedOption?.value)}
            />
          </FormField>
          <Box>
            <Box variant="awsui-key-label">Unsaved changes</Box>
            <Box variant="strong">{hasUnsavedChanges ? `${changedRowsCount} row${changedRowsCount === 1 ? "" : "s"}` : "None"}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">Regions entered</Box>
            <Box variant="strong">{`${summary.enteredRegionCount} / ${summary.regionCount}`}</Box>
          </Box>
          <Box>
            <Box variant="awsui-key-label">Last refreshed</Box>
            <Box>{lastLoadedAt ? new Date(lastLoadedAt).toLocaleString() : "Not loaded yet"}</Box>
          </Box>
        </ColumnLayout>
        <Box color="text-body-secondary">
          Enter one annual salary figure per province or territory. PATH derives an even monthly amount from that annual total.
        </Box>
      </SpaceBetween>
    </BoardItem>
  );
};

export default SalaryControlsWidget;
