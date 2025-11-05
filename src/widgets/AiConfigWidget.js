import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  SpaceBetween,
  FormField,
  Select,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Input,
  Multiselect,
  Header,
  Link
} from '@cloudscape-design/components';
import boardItemI18nStrings from './common';

export default function AiConfigWidget({
  actions,
  metadata,
  toggleHelpPanel,
  headerActions,
  aiModel,
  setAiModel,
  canEditAI,
  modelOptions,
  modelsLoading,
  savingModel,
  saveModel,
  params,
  setParams,
  numberInput,
  fallbacks,
  setFallbacks,
  savingParams,
  saveParams,
  savingFallbacks,
  saveFallbacks
}) {
  const handleOpenHelp = () => {
    if (!toggleHelpPanel) return;
    const HelpComponent = metadata?.helpComponent;
    if (!HelpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || 'AI configuration';
    const context = metadata?.aiContext || '';
    toggleHelpPanel(<HelpComponent />, title, context);
  };

  const infoLink =
    metadata?.helpComponent && toggleHelpPanel ? (
      <Link variant="info" onClick={handleOpenHelp}>
        Info
      </Link>
    ) : undefined;

  const settingsMenu =
    actions && typeof actions.removeItem === 'function' ? (
      <ButtonDropdown
        ariaLabel="AI configuration widget settings"
        variant="icon"
        items={[{ id: 'remove', text: 'Remove widget' }]}
        onItemClick={({ detail }) => {
          if (detail.id === 'remove') {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description || 'Tune the default AI model and failover behaviour.'}
          info={infoLink}
          actions={headerActions}
        >
          {metadata?.title || 'AI configuration'}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="s">
        <FormField label="Default Model" description="Primary model used when no per-request override is provided.">
          <Select
            selectedOption={aiModel}
            onChange={e => canEditAI && setAiModel(e.detail.selectedOption)}
            options={modelOptions}
            filteringType="auto"
            statusType={modelsLoading ? 'loading' : 'finished'}
            disabled={!canEditAI}
            placeholder="Select model"
          />
        </FormField>
        {canEditAI && (
          <Button loading={savingModel} onClick={saveModel} disabled={!aiModel}>
            Save Model
          </Button>
        )}
        <ColumnLayout columns={3} variant="text-grid">
          <FormField label="Temperature" description="0=deterministic, higher=creative">
            {numberInput('temperature', 0, 2, 0.1)}
          </FormField>
          <FormField label="Top P" description="Nucleus sampling">
            {numberInput('top_p', 0, 1, 0.01)}
          </FormField>
          <FormField label="Max Tokens" description="Blank for provider default">
            <Input
              type="number"
              value={params.max_tokens === '' ? '' : String(params.max_tokens)}
              onChange={e =>
                setParams(p => ({ ...p, max_tokens: e.detail.value === '' ? '' : Number(e.detail.value) }))
              }
              disabled={!canEditAI}
              placeholder="auto"
            />
          </FormField>
        </ColumnLayout>
        <ColumnLayout columns={3} variant="text-grid">
          <FormField label="Presence Penalty" description="Encourage new topics">
            {numberInput('presence_penalty', -2, 2, 0.1)}
          </FormField>
          <FormField label="Frequency Penalty" description="Reduce repetition">
            {numberInput('frequency_penalty', -2, 2, 0.1)}
          </FormField>
          <FormField label="Fallback Models" description="Tried in order if primary returns an error (4xx).">
            <Multiselect
              selectedOptions={fallbacks}
              onChange={e => canEditAI && setFallbacks(e.detail.selectedOptions)}
              options={modelOptions.filter(option => !aiModel || option.value !== aiModel.value)}
              placeholder="Select fallback models"
              disabled={!canEditAI}
              tokenLimit={5}
            />
          </FormField>
        </ColumnLayout>
        {canEditAI && (
          <SpaceBetween direction="horizontal" size="xs">
            <Button key="ai-save-params" loading={savingParams} onClick={saveParams}>
              Save Parameters
            </Button>
            <Button key="ai-save-fallbacks" loading={savingFallbacks} onClick={saveFallbacks}>
              Save Fallbacks
            </Button>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </BoardItem>
  );
}
