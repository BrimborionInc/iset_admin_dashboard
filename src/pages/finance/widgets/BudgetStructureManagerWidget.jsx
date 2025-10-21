import React, { useEffect, useMemo, useState } from "react";
import { BoardItem } from "@cloudscape-design/board-components";
import {
  Header,
  SpaceBetween,
  ButtonDropdown,
  Link,
  FormField,
  Input,
  Textarea,
  Select,
  Tabs,
  Box,
  Button,
  Container,
  StatusIndicator,
  ColumnLayout,
  Table,
} from "@cloudscape-design/components";
import { boardItemI18nStrings } from "./common";
import { useBudgetsData } from "./BudgetsDataContext.jsx";

const nodeTypeOptions = [
  { label: "Funding stream", value: "Funding stream" },
  { label: "Program", value: "Program" },
  { label: "Project", value: "Project" },
  { label: "Delivery partner", value: "Delivery partner" },
];

const topLevelOption = { label: "Top-level budget", value: "" };

const blankCreateForm = {
  name: "",
  code: "",
  parentOption: topLevelOption,
  nodeType: nodeTypeOptions[1],
  owner: "",
  approved: "",
  adjusted: "",
  committed: "",
  forecast: "",
  adminPct: "",
  description: "",
  policyNotes: "",
};

const mapPotToEditForm = (pot, parentOptions) => {
  if (!pot) {
    return null;
  }
  const parentOption =
    parentOptions.find(option => option.value === (pot.parentId ?? "")) ?? topLevelOption;
  const nodeType =
    nodeTypeOptions.find(option => option.value === pot.nodeType) ?? nodeTypeOptions[0];
  return {
    name: pot.name ?? "",
    code: pot.code ?? "",
    parentOption,
    nodeType,
    owner: pot.owner ?? "",
    approved: pot.approved !== undefined ? String(pot.approved) : "",
    adjusted: pot.adjusted !== undefined ? String(pot.adjusted) : "",
    committed: pot.committed !== undefined ? String(pot.committed) : "",
    forecast: pot.forecast !== undefined ? String(pot.forecast) : "",
    adminPct:
      pot.adminTargetPct !== undefined && pot.adminTargetPct !== null
        ? String(pot.adminTargetPct)
        : "",
    description: pot.description ?? "",
    policyNotes: pot.policyNotes ?? "",
  };
};

const draftColumns = [
  {
    id: "summary",
    header: "Change",
    cell: item => item.summary,
  },
  {
    id: "type",
    header: "Type",
    cell: item => item.type,
  },
  {
    id: "timestamp",
    header: "Recorded",
    cell: item => item.timestamp,
  },
];

const snapshotColumns = [
  {
    id: "label",
    header: "Snapshot",
    cell: item => item.label,
  },
  {
    id: "capturedOn",
    header: "Captured",
    cell: item => item.capturedOn,
  },
  {
    id: "capturedBy",
    header: "Captured by",
    cell: item => item.capturedBy,
  },
];

const BudgetStructureManagerWidget = ({ actions = {}, metadata = {}, toggleHelpPanel }) => {
  const {
    pots,
    selectedPotId,
    selectPot,
    createPot,
    updatePot,
    archivePot,
    draftChanges,
    publishDraftChanges,
    discardDraftChanges,
    snapshots,
    createSnapshot,
    activeVersion,
  } = useBudgetsData();

  const [activeTab, setActiveTab] = useState("create");
  const [createForm, setCreateForm] = useState(blankCreateForm);
  const [editForm, setEditForm] = useState(null);

  const parentOptions = useMemo(() => {
    const map = new Map(pots.map(pot => [pot.id, pot]));
    const depthCache = new Map();
    const getDepth = potId => {
      if (!potId) {
        return 0;
      }
      if (depthCache.has(potId)) {
        return depthCache.get(potId);
      }
      const pot = map.get(potId);
      if (!pot || !pot.parentId) {
        depthCache.set(potId, 0);
        return 0;
      }
      const depth = 1 + getDepth(pot.parentId);
      depthCache.set(potId, depth);
      return depth;
    };
    const options = pots
      .filter(pot => pot.status !== "archived")
      .map(pot => {
        const depth = getDepth(pot.id);
        const prefix = depth ? `${"\u2014 ".repeat(depth)}` : "";
        return { label: `${prefix}${pot.name}`, value: pot.id };
      });
    return [topLevelOption, ...options];
  }, [pots]);

  const selectedPot = useMemo(
    () => pots.find(pot => pot.id === selectedPotId) ?? null,
    [pots, selectedPotId]
  );

  useEffect(() => {
    setEditForm(mapPotToEditForm(selectedPot, parentOptions));
  }, [selectedPot, parentOptions]);

  useEffect(() => {
    const handler = event => {
      const { mode, potId, parentId } = event.detail || {};
      if (mode === "edit" && potId) {
        setActiveTab("edit");
        selectPot(potId);
        return;
      }
      if (mode === "create") {
        setActiveTab("create");
        if (parentId) {
          const parent = pots.find(pot => pot.id === parentId);
          if (parent) {
            setCreateForm(form => ({
              ...form,
              parentOption: { label: parent.name, value: parent.id },
            }));
          }
        }
      }
    };
    window.addEventListener("financeBudgets:managePot", handler);
    return () => window.removeEventListener("financeBudgets:managePot", handler);
  }, [pots, selectPot]);

  const infoLink =
    metadata.helpComponent && toggleHelpPanel ? (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(
            helpContent,
            metadata.helpTitle ?? "Structure manager",
            metadata.aiContext ?? ""
          );
        }}
      >
        Info
      </Link>
    ) : undefined;

  const handleCreateChange = (field, value) => {
    setCreateForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditChange = (field, value) => {
    setEditForm(prev => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleCreateSubmit = event => {
    event.preventDefault();
    createPot({
      name: createForm.name,
      code: createForm.code,
      parentId: createForm.parentOption?.value || null,
      nodeType: createForm.nodeType?.value,
      owner: createForm.owner,
      approved: createForm.approved,
      adjusted: createForm.adjusted,
      committed: createForm.committed,
      forecast: createForm.forecast,
      adminPct: createForm.adminPct,
      description: createForm.description,
      policyNotes: createForm.policyNotes,
    });
    setCreateForm({
      ...blankCreateForm,
      nodeType: createForm.nodeType,
    });
  };

  const handleEditSubmit = event => {
    event.preventDefault();
    if (!selectedPot) {
      return;
    }
    updatePot(selectedPot.id, {
      name: editForm?.name,
      code: editForm?.code,
      parentId: editForm?.parentOption?.value || null,
      nodeType: editForm?.nodeType?.value,
      owner: editForm?.owner,
      approved: editForm?.approved,
      adjusted: editForm?.adjusted,
      committed: editForm?.committed,
      forecast: editForm?.forecast,
      adminPct: editForm?.adminPct,
      description: editForm?.description,
      policyNotes: editForm?.policyNotes,
    });
  };

  const handleArchive = () => {
    if (!selectedPot) {
      return;
    }
    archivePot(selectedPot.id);
  };

  const handlePublishDraft = () => {
    publishDraftChanges({});
  };

  const handleDiscardDraft = () => {
    discardDraftChanges();
  };

  const handleSnapshot = () => {
    createSnapshot({});
  };

  const draftItems = useMemo(
    () =>
      draftChanges.map(change => ({
        ...change,
        timestamp: new Date(change.timestamp).toLocaleString(),
      })),
    [draftChanges]
  );

  const infoBar = (
    <SpaceBetween size="xs">
      <StatusIndicator type={draftItems.length ? "warning" : "success"}>
        {draftItems.length
          ? `${draftItems.length} draft change${draftItems.length === 1 ? "" : "s"} pending`
          : "No draft changes"}
      </StatusIndicator>
      <StatusIndicator type="info">
        Active version: {activeVersion?.label ?? "Unversioned"}
      </StatusIndicator>
    </SpaceBetween>
  );

  const createTab = (
    <form onSubmit={handleCreateSubmit}>
      <SpaceBetween size="m">
        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="s">
            <FormField label="Pot name" stretch>
              <Input
                value={createForm.name}
                placeholder="e.g., Skills Training West"
                onChange={({ detail }) => handleCreateChange("name", detail.value)}
              />
            </FormField>
            <FormField label="Funding code" stretch>
              <Input
                value={createForm.code}
                placeholder="e.g., STW-2024"
                onChange={({ detail }) => handleCreateChange("code", detail.value)}
              />
            </FormField>
            <FormField label="Parent pot" stretch>
              <Select
                selectedOption={createForm.parentOption}
                options={parentOptions}
                onChange={({ detail }) => handleCreateChange("parentOption", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Node type" stretch>
              <Select
                selectedOption={createForm.nodeType}
                options={nodeTypeOptions}
                onChange={({ detail }) => handleCreateChange("nodeType", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Owner">
              <Input
                value={createForm.owner}
                placeholder="e.g., Finance Officer"
                onChange={({ detail }) => handleCreateChange("owner", detail.value)}
              />
            </FormField>
          </SpaceBetween>
          <SpaceBetween size="s">
            <FormField label="Approved amount">
              <Input
                type="number"
                value={createForm.approved}
                placeholder="0"
                onChange={({ detail }) => handleCreateChange("approved", detail.value)}
              />
            </FormField>
            <FormField label="Adjusted amount">
              <Input
                type="number"
                value={createForm.adjusted}
                placeholder="0"
                onChange={({ detail }) => handleCreateChange("adjusted", detail.value)}
              />
            </FormField>
            <FormField label="Committed amount">
              <Input
                type="number"
                value={createForm.committed}
                placeholder="0"
                onChange={({ detail }) => handleCreateChange("committed", detail.value)}
              />
            </FormField>
            <FormField label="Forecast amount">
              <Input
                type="number"
                value={createForm.forecast}
                placeholder="0"
                onChange={({ detail }) => handleCreateChange("forecast", detail.value)}
              />
            </FormField>
            <FormField label="Admin % target">
              <Input
                type="number"
                value={createForm.adminPct}
                placeholder="e.g., 12.5"
                onChange={({ detail }) => handleCreateChange("adminPct", detail.value)}
              />
            </FormField>
          </SpaceBetween>
        </ColumnLayout>
        <FormField label="Description">
          <Textarea
            value={createForm.description}
            placeholder="Short description shown in the pot detail panel."
            rows={3}
            onChange={({ detail }) => handleCreateChange("description", detail.value)}
          />
        </FormField>
        <FormField label="Policy guardrails">
          <Textarea
            value={createForm.policyNotes}
            placeholder="Document policy notes, approval references, or usage guardrails."
            rows={3}
            onChange={({ detail }) => handleCreateChange("policyNotes", detail.value)}
          />
        </FormField>
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" type="submit" iconName="add-plus">
            Create pot
          </Button>
          <Button
            variant="link"
            onClick={() => setCreateForm({ ...blankCreateForm })}
          >
            Reset form
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </form>
  );

  const editTab = selectedPot ? (
    <form onSubmit={handleEditSubmit}>
      <SpaceBetween size="m">
        <ColumnLayout columns={2} variant="text-grid">
          <SpaceBetween size="s">
            <FormField label="Pot name" stretch>
              <Input
                value={editForm?.name ?? ""}
                onChange={({ detail }) => handleEditChange("name", detail.value)}
              />
            </FormField>
            <FormField label="Funding code" stretch>
              <Input
                value={editForm?.code ?? ""}
                onChange={({ detail }) => handleEditChange("code", detail.value)}
              />
            </FormField>
            <FormField label="Parent pot" stretch>
              <Select
                selectedOption={editForm?.parentOption ?? topLevelOption}
                options={parentOptions}
                onChange={({ detail }) => handleEditChange("parentOption", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Node type" stretch>
              <Select
                selectedOption={editForm?.nodeType ?? nodeTypeOptions[0]}
                options={nodeTypeOptions}
                onChange={({ detail }) => handleEditChange("nodeType", detail.selectedOption)}
              />
            </FormField>
            <FormField label="Owner">
              <Input
                value={editForm?.owner ?? ""}
                onChange={({ detail }) => handleEditChange("owner", detail.value)}
              />
            </FormField>
          </SpaceBetween>
          <SpaceBetween size="s">
            <FormField label="Approved amount">
              <Input
                type="number"
                value={editForm?.approved ?? ""}
                onChange={({ detail }) => handleEditChange("approved", detail.value)}
              />
            </FormField>
            <FormField label="Adjusted amount">
              <Input
                type="number"
                value={editForm?.adjusted ?? ""}
                onChange={({ detail }) => handleEditChange("adjusted", detail.value)}
              />
            </FormField>
            <FormField label="Committed amount">
              <Input
                type="number"
                value={editForm?.committed ?? ""}
                onChange={({ detail }) => handleEditChange("committed", detail.value)}
              />
            </FormField>
            <FormField label="Forecast amount">
              <Input
                type="number"
                value={editForm?.forecast ?? ""}
                onChange={({ detail }) => handleEditChange("forecast", detail.value)}
              />
            </FormField>
            <FormField label="Admin % target">
              <Input
                type="number"
                value={editForm?.adminPct ?? ""}
                onChange={({ detail }) => handleEditChange("adminPct", detail.value)}
              />
            </FormField>
          </SpaceBetween>
        </ColumnLayout>
        <FormField label="Description">
          <Textarea
            value={editForm?.description ?? ""}
            rows={3}
            onChange={({ detail }) => handleEditChange("description", detail.value)}
          />
        </FormField>
        <FormField label="Policy guardrails">
          <Textarea
            value={editForm?.policyNotes ?? ""}
            rows={3}
            onChange={({ detail }) => handleEditChange("policyNotes", detail.value)}
          />
        </FormField>
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" type="submit">
            Save changes
          </Button>
          <Button
            iconName="add-plus"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("financeBudgets:managePot", {
                  detail: { mode: "create", parentId: selectedPot.id },
                })
              )
            }
          >
            Create child pot
          </Button>
          <Button
            iconName="shuffle"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("financeBudgets:navigate", {
                  detail: { target: "allocations", potId: selectedPot.id },
                })
              )
            }
          >
            Start reallocation
          </Button>
          <Button
            variant="link"
            iconName="remove"
            onClick={handleArchive}
          >
            Archive pot
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </form>
  ) : (
    <Box variant="p">Select a budget pot from the hierarchy to edit its details.</Box>
  );

  const versionsTab = (
    <SpaceBetween size="m">
      {infoBar}
      <Container header={<Header variant="h3">Draft changes</Header>}>
        <Table
          items={draftItems}
          trackBy="id"
          columnDefinitions={draftColumns}
          variant="embedded"
          empty={<Box variant="p">No draft changes captured.</Box>}
        />
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" disabled={!draftItems.length} onClick={handlePublishDraft}>
            Publish draft
          </Button>
          <Button
            variant="link"
            disabled={!draftItems.length}
            onClick={handleDiscardDraft}
          >
            Discard changes
          </Button>
        </SpaceBetween>
      </Container>
      <Container header={<Header variant="h3">Snapshots</Header>}>
        <Table
          items={snapshots}
          trackBy="id"
          columnDefinitions={snapshotColumns}
          variant="embedded"
          empty={<Box variant="p">No snapshots captured yet.</Box>}
        />
        <Button onClick={handleSnapshot}>
          Capture draft snapshot
        </Button>
      </Container>
    </SpaceBetween>
  );

  const tabs = [
    { id: "create", label: "Create pot", content: createTab },
    { id: "edit", label: "Edit selected", content: editTab },
    { id: "versions", label: "Drafts & versions", content: versionsTab },
  ];

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === "remove" && typeof actions.removeItem === "function") {
      actions.removeItem();
    }
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={infoLink}
          description="Manage budget pots, capture draft changes, and publish structure updates."
        >
          Structure manager
        </Header>
      }
      settings={
        typeof actions.removeItem === "function" ? (
          <ButtonDropdown
            ariaLabel="Structure manager settings"
            variant="icon"
            items={[{ id: "remove", text: "Remove widget" }]}
            onItemClick={handleSettingsClick}
          />
        ) : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <Tabs
        tabs={tabs}
        activeTabId={activeTab}
        onChange={({ detail }) => setActiveTab(detail.activeTabId)}
      />
    </BoardItem>
  );
};

export default BudgetStructureManagerWidget;
