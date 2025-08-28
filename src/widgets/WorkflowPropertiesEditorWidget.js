import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Grid, FormField, Input, Select, Button, Alert, SpaceBetween } from '@cloudscape-design/components';

const WorkflowPropertiesEditorWidget = ({ name, status, startUiId, startOptions = [], onChange, onSave, onPublish, saving, saveMsg, onClear, dirty }) => {
  const itemI18n = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
  };

  return (
    <BoardItem
  header={<Header variant="h2" actions={<SpaceBetween size="xs" direction="horizontal">{dirty && <span style={{alignSelf:'center', color:'#d13212', fontSize:12}}>Unsaved changes</span>}{onPublish && <Button onClick={onPublish} disabled={saving}>Publish</Button>}<Button loading={saving} variant="primary" onClick={onSave} disabled={!dirty && !name}>Save</Button></SpaceBetween>}>Workflow</Header>}
      i18nStrings={itemI18n}
    >
      {saveMsg ? (
        <Alert
          type={/fail|error/i.test(saveMsg) ? 'error' : 'success'}
          dismissible
          onDismiss={() => onClear && onClear()}
          header={/fail|error/i.test(saveMsg) ? 'Save failed' : 'Success'}
        >
          {saveMsg}
        </Alert>
      ) : null}
      <Grid gridDefinition={[{ colspan: 4 }, { colspan: 2 }, { colspan: 2 }]}> 
        <FormField label="Name">
          <Input value={name} onChange={({ detail }) => onChange({ name: detail.value })} />
        </FormField>
        <FormField label="Status">
          <Select
            selectedOption={{ label: status, value: status }}
            onChange={({ detail }) => onChange({ status: detail.selectedOption?.value || 'draft' })}
            options={[{ label: 'draft', value: 'draft' }, { label: 'active', value: 'active' }, { label: 'inactive', value: 'inactive' }]}
          />
        </FormField>
        <FormField label="Start step">
          <Select
            placeholder="Select start"
            selectedOption={startUiId ? startOptions.find(o => o.value === startUiId) || null : null}
            onChange={({ detail }) => onChange({ startUiId: detail.selectedOption?.value || null })}
            options={startOptions}
          />
        </FormField>
      </Grid>
    </BoardItem>
  );
};

export default WorkflowPropertiesEditorWidget;
