import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  Box,
  ButtonDropdown,
  Link,
  ColumnLayout,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";

const PREFERENCE_STORAGE_KEY = "finance-budget-hierarchy-preferences-v1";
const INITIAL_STATE = {
  id: "",
  name: "",
  description: "",
  presets: {},
  updatedAt: null,
};

const loadInitialState = () => {
  if (typeof window === "undefined") {
    return INITIAL_STATE;
  }
  try {
    const raw = window.localStorage.getItem(PREFERENCE_STORAGE_KEY);
    if (!raw) {
      return INITIAL_STATE;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return INITIAL_STATE;
    }
    const { viewMode, riskFilter, timeframe, filteringText } = parsed;
    const presets = {
      viewMode: viewMode ?? "default",
      riskFilter: riskFilter ?? "all",
    };
    if (timeframe) {
      presets.timeframe = timeframe;
    }
    if (filteringText) {
      presets.search = filteringText;
    }
    return {
      id: "preferences",
      name: "Stored dashboard preferences",
      description: "",
      presets,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Budgets] failed to read stored view summary", error);
    return INITIAL_STATE;
  }
};

const BudgetActiveViewWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const [state, setState] = useState(loadInitialState);

  useEffect(() => {
    const handler = event => {
      const { viewId, viewName, description, presets } = event?.detail || {};
      if (!viewId) {
        return;
      }
      setState({
        id: viewId,
        name: viewName || viewId,
        description: description || "",
        presets: presets || {},
        updatedAt: new Date().toISOString(),
      });
    };
    window.addEventListener("financeBudgets:viewLoaded", handler);
    return () => window.removeEventListener("financeBudgets:viewLoaded", handler);
  }, []);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Loaded view summary",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "clear") {
      setState(INITIAL_STATE);
    } else if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  const presetEntries = useMemo(() => {
    return Object.entries(state.presets || {});
  }, [state.presets]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Tracks which saved view or preference set is currently applied."
        >
          Loaded view summary
        </Header>
      }
      settings={
        <ButtonDropdown
          ariaLabel="Loaded view settings"
          variant="icon"
          items={[
            { id: "clear", text: "Clear summary" },
            ...(typeof actions.removeItem === "function"
              ? [{ id: "remove", text: "Remove widget" }]
              : []),
          ]}
          onItemClick={handleSettingsClick}
        />
      }
      i18nStrings={boardItemI18nStrings}
    >
      {state.id ? (
        <SpaceBetween size="s">
          <ColumnLayout columns={2} variant="text-grid">
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">View</Box>
              <Box variant="awsui-value-large">{state.name}</Box>
              {state.description ? <Box variant="p">{state.description}</Box> : null}
            </SpaceBetween>
            <SpaceBetween size="xxs">
              <Box variant="awsui-key-label">Last loaded</Box>
              <Box variant="p">
                {state.updatedAt
                  ? new Date(state.updatedAt).toLocaleString()
                  : "Unknown"}
              </Box>
            </SpaceBetween>
          </ColumnLayout>
          <Box variant="awsui-key-label">Applied presets</Box>
          {presetEntries.length ? (
            <ColumnLayout columns={2} variant="text-grid">
              {presetEntries.map(([key, value]) => (
                <SpaceBetween key={key} size="xxs">
                  <Box variant="awsui-key-label">{key}</Box>
                  <Box variant="p">{String(value)}</Box>
                </SpaceBetween>
              ))}
            </ColumnLayout>
          ) : (
            <Box variant="p">Default dashboard settings applied.</Box>
          )}
        </SpaceBetween>
      ) : (
        <Box variant="p">
          No saved view has been loaded in this session. Select a view from the Saved
          views widget to populate this summary.
        </Box>
      )}
    </BoardItem>
  );
};

export default BudgetActiveViewWidget;

