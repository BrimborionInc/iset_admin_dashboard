import React, { useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  Header,
  Input,
  Link,
  Select,
  SpaceBetween,
  StatusIndicator,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useSalariesData } from "./SalariesDataContext.jsx";
import { formatCurrencyDisplay, getCurrencyInputDisplayValue } from "../../../utils/currencyFormat.js";

const formatCurrencyOrDash = value => {
  if (value === null || typeof value === "undefined" || value === "") {
    return "—";
  }
  return formatCurrencyDisplay(value);
};

const parseAnnualSalaryInput = value => {
  const trimmed = String(value ?? "")
    .replace(/[$,\s]/g, "")
    .trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return Number.NaN;
  }
  return Math.round(numeric * 100) / 100;
};

const resolveDerivedMonthlyAmount = item => {
  const parsed = parseAnnualSalaryInput(item.annualSalaryAmountInput);
  if (Number.isNaN(parsed)) {
    return item.derivedMonthlyAmount;
  }
  if (parsed === null) {
    return null;
  }
  return Math.round((parsed / 12) * 100) / 100;
};

const SalaryAnnualEntriesWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [focusedRows, setFocusedRows] = useState({});
  const {
    rows,
    loading,
    saving,
    error,
    saveMessage,
    changedRowsCount,
    hasUnsavedChanges,
    updateRow,
    saveChanges,
    refreshData,
    dismissError,
    dismissSaveMessage,
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
          metadata.helpTitle ?? "Annual salary entries",
          metadata.aiContext ?? ""
        );
      }}
    >
      Info
    </Link>
  ) : undefined;

  const columns = [
    {
      id: "region",
      header: "Province / Territory",
      cell: item => item.regionName,
      sortingField: "regionName",
      minWidth: 180,
    },
    {
      id: "pot",
      header: "Assigned pot",
      cell: item => (
        <Select
          selectedOption={item.potOptions.find(option => option.value === item.budgetPotId) || null}
          options={item.potOptions}
          placeholder="Select pot"
          onChange={({ detail }) =>
            updateRow(item.regionCode, {
              budgetPotId: detail.selectedOption?.value || null,
            })
          }
        />
      ),
      minWidth: 260,
    },
    {
      id: "annualSalary",
      header: "Annual salary",
      cell: item => (
        <Input
          value={getCurrencyInputDisplayValue(
            item.annualSalaryAmountInput,
            Boolean(focusedRows[item.regionCode])
          )}
          inputMode="decimal"
          placeholder="0.00"
          onChange={({ detail }) =>
            updateRow(item.regionCode, {
              annualSalaryAmountInput: detail.value,
            })
          }
          onFocus={() =>
            setFocusedRows(current => ({
              ...current,
              [item.regionCode]: true,
            }))
          }
          onBlur={() =>
            setFocusedRows(current => ({
              ...current,
              [item.regionCode]: false,
            }))
          }
        />
      ),
      minWidth: 170,
    },
    {
      id: "derivedMonthly",
      header: "Derived monthly amount",
      cell: item => formatCurrencyOrDash(resolveDerivedMonthlyAmount(item)),
      minWidth: 180,
    },
    {
      id: "updated",
      header: "Last updated",
      cell: item =>
        item.updatedAt ? (
          <SpaceBetween size="xxs">
            <Box>{new Date(item.updatedAt).toLocaleDateString()}</Box>
            <Box color="text-body-secondary">{item.updatedByName || "Updated"}</Box>
          </SpaceBetween>
        ) : (
          <StatusIndicator type="pending">Not saved yet</StatusIndicator>
        ),
      minWidth: 170,
    },
  ];

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconName="refresh" onClick={refreshData} loading={loading}>
                Refresh
              </Button>
              <Button
                variant="primary"
                onClick={saveChanges}
                loading={saving}
                disabled={!hasUnsavedChanges}
              >
                {hasUnsavedChanges ? `Save changes (${changedRowsCount})` : "Save changes"}
              </Button>
            </SpaceBetween>
          }
        >
          Annual salary entries
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Annual salary entries settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        {error ? (
          <Alert
            type="error"
            statusIconAriaLabel="Error"
            dismissible
            onDismiss={dismissError}
          >
            {error}
          </Alert>
        ) : null}
        {saveMessage ? (
          <Alert
            type="success"
            statusIconAriaLabel="Success"
            dismissible
            onDismiss={dismissSaveMessage}
          >
            {saveMessage}
          </Alert>
        ) : null}
        <Table
          variant="embedded"
          columnDefinitions={columns}
          items={rows}
          loading={loading}
          loadingText="Loading salary rows"
          wrapLines={false}
          stripedRows
          trackBy="regionCode"
          empty={
            <Box textAlign="center" color="inherit">
              No salary rows are available for the selected fiscal year.
            </Box>
          }
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default SalaryAnnualEntriesWidget;
