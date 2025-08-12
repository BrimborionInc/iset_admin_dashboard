// Updated rewrite of PropertiesPanel.js – corrected JSX restoration
import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Box, Container, Header, Table, Input, Button, Select, SpaceBetween, FormField, Textarea } from '@cloudscape-design/components';
import get from 'lodash/get';

const PropertiesPanel = ({ selectedComponent, updateComponentProperty, pageProperties, setPageProperties }) => {
  const [availableDataSources, setAvailableDataSources] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [optionSourceMode, setOptionSourceMode] = useState('static'); // Track the current mode
  const suppressOptionModeEffectRef = useRef(false); // Add useRef to suppress updates
  const suppressNextModeEffect = useRef(false); // Add useRef to suppress next mode effect

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/option-data-sources`)
      .then(res => setAvailableDataSources(res.data))
      .catch(err => console.error('Failed to load data sources', err));
  }, []);

  useEffect(() => {
    if (!selectedComponent) return;

    if (suppressNextModeEffect.current) {
      suppressNextModeEffect.current = false; // Reset the flag
      return; // Skip automatic updates
    }

    if (suppressOptionModeEffectRef.current) {
      suppressOptionModeEffectRef.current = false; // Reset the flag
      return; // Skip automatic updates
    }

    const mode = selectedComponent.props?.mode ?? 'static';
    setOptionSourceMode(mode === 'simple' ? 'static' : mode); // Update mode only if not suppressed
    const endpoint = selectedComponent.props?.endpoint;
    setSelectedEndpoint(mode === 'dynamic' ? endpoint || null : null);
  }, [selectedComponent]);

  const handleOptionModeChange = (mode, editableField) => {
    suppressOptionModeEffectRef.current = true; // Suppress automatic updates
    if (mode === 'dynamic') {
      suppressNextModeEffect.current = true; // Suppress next mode effect for dynamic mode
    }
    setOptionSourceMode(mode); // Update the local state

    if (mode === 'static' || mode === 'simple') {
      updateComponentProperty('props.mode', 'static', true);
      updateComponentProperty('props.endpoint', null, true);
      updateComponentProperty('props.attributes', null, true); // Remove attributes for static mode
    } else if (mode === 'dynamic') {
      setSelectedEndpoint(null); // Reset the selected endpoint
      updateComponentProperty('props.mode', 'dynamic', true);
      updateComponentProperty('props.endpoint', null, true);
      updateComponentProperty('props.attributes', null, true); // Ensure attributes are cleared initially
    } else if (mode === 'snapshot') {
      updateComponentProperty('props.mode', 'snapshot', true);
      updateComponentProperty(editableField.path, [], true);
    }
  };

  const handleSnapshotFetch = async (endpoint, editableField) => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}${endpoint}`);
      const data = res.data;
      const schema = selectedComponent.option_schema || ['text', 'value'];
      const mapped = data.map((item) => {
        const option = {};
        if (schema.includes('text')) option.text = item.name;
        if (schema.includes('value')) option.value = String(item.id);
        return option;
      });
      updateComponentProperty(editableField.path, mapped, true);
      updateComponentProperty('props.mode', 'static', true); // Revert to static mode
      updateComponentProperty('props.endpoint', null, true); // Clear endpoint
      setOptionSourceMode('static'); // Update local state to static
    } catch (err) {
      console.error('Snapshot fetch failed', err);
    }
  };

  const handleEndpointChange = (endpoint, editableField) => {
    setSelectedEndpoint(endpoint);

    if (endpoint) {
      updateComponentProperty('props.endpoint', endpoint, true);
      updateComponentProperty('props.attributes', { 'data-options-endpoint': endpoint }, true); // Update attributes for dynamic mode
      updateComponentProperty(editableField.path, [], true); // Clear the items array only when a data source is selected
    }
  };

  const handleAddOption = (editableField) => {
    const current = get(selectedComponent.props, editableField.path) || [];
    updateComponentProperty(editableField.path, [...current, { text: '', value: '' }], true);
  };

  const handleRemoveOption = (index, editableField) => {
    const current = get(selectedComponent.props, editableField.path) || [];
    const updated = current.filter((_, i) => i !== index);
    updateComponentProperty(editableField.path, updated, true);
  };

  const getSchema = () => selectedComponent?.option_schema || ['text', 'value'];
  const rawMode = selectedComponent?.props?.mode ?? 'static';
  const currentMode = optionSourceMode; // Use the tracked mode instead of rawMode

  return (
    <>
      <Header variant="h3">Page Properties</Header>
      <Box padding="none" margin="none" overflow="auto">
        <Table
          columnDefinitions={[{
            id: 'property',
            header: 'Property',
            cell: item => item.label,
          }, {
            id: 'value',
            header: 'Value',
            cell: item => item.value,
            editConfig: {
              editingCell: (item, { currentValue, setValue }) => {
                const handleChange = (value) => {
                  setValue(value);
                  if (item.id === 'name') setPageProperties({ name: value, status: pageProperties.status });
                  if (item.id === 'status') setPageProperties({ name: pageProperties.name, status: value });
                };
                if (item.id === 'status') {
                  return <Select selectedOption={{ label: currentValue, value: currentValue }} onChange={({ detail }) => handleChange(detail.selectedOption.value)} options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} />;
                }
                return <Input value={currentValue} onChange={({ detail }) => handleChange(detail.value)} />;
              },
            },
          }]}
          items={[{ id: 'name', label: 'Name', value: pageProperties.name }, { id: 'status', label: 'Status', value: pageProperties.status }]}
        />
      </Box>

      {selectedComponent && (
        <>
          <Box padding="none" margin="none" overflow="auto">
            <Header variant="h3">Component Properties</Header>
            <Table
              columnDefinitions={[{
                id: 'label',
                header: 'Property',
                cell: item => item.label,
              }, {
                id: 'value',
                header: 'Value',
                minWidth: 100,
                maxWidth: 200,
                cell: item => typeof item.value === 'boolean' ? (item.value ? 'True' : 'False') : typeof item.value === 'object' ? JSON.stringify(item.value) : item.value,
                editConfig: {
                  editingCell: (item, { currentValue, setValue }) => {
                    const handleChange = (value) => {
                      setValue(value);
                      updateComponentProperty(item.path, value, true);
                    };
                    switch (item.type) {
                      case 'textarea':
                        return <Textarea value={currentValue || item.value} onChange={({ detail }) => handleChange(detail.value)} rows={4} />;
                      case 'text':
                        return <Input value={currentValue || item.value} onChange={({ detail }) => handleChange(detail.value)} />;
                      case 'checkbox':
                        const selectedBool = currentValue ?? item.value;
                        return (
                          <Select
                            selectedOption={{ label: selectedBool ? 'True' : 'False', value: selectedBool }}
                            onChange={({ detail }) => handleChange(detail.selectedOption.value)}
                            options={[
                              { label: 'True', value: true },
                              { label: 'False', value: false }
                            ]}
                          />
                        );
                      case 'select':
                        return <Select selectedOption={{ label: currentValue || item.value, value: currentValue || item.value }} onChange={({ detail }) => handleChange(detail.selectedOption.value)} options={item.options || []} />;
                      default:
                        return null;
                    }
                  },
                },
              }]}
              items={selectedComponent.editable_fields?.filter(field => field.type !== 'optionList').map(field => ({
                label: field.label,
                value: get(selectedComponent.props, field.path) || '',
                type: field.type,
                options: field.options || [],
                path: field.path,
              }))}
              submitEdit={() => { }}
              ariaLabels={{ tableLabel: 'Component Properties Table' }}
            />
          </Box>
        </>
      )}

  {Boolean(selectedComponent?.has_options) && selectedComponent.editable_fields?.map((field) => {
        if (field.type !== 'optionList') return null;
        const options = get(selectedComponent.props, field.path) || [];
        const schema = getSchema();

        return (
          <React.Fragment key={field.path}>
            <Header variant="h3">Options Properties</Header>
            <Container padding="m">
              <SpaceBetween size="m">
                <FormField label="Options Source">
                  <Select
                    selectedOption={{
                      label:
                        currentMode === 'dynamic' ? 'Code Table: Dynamic' :
                          currentMode === 'snapshot' ? 'Code Table: Snapshot' :
                            'Static (manually entered)',
                      value: currentMode,
                    }}
                    onChange={({ detail }) => handleOptionModeChange(detail.selectedOption.value, field)}
                    options={[
                      { label: 'Static (manually entered)', value: 'static' },
                      { label: 'Dynamic (from endpoint at runtime', value: 'dynamic' },
                      { label: 'Snapshot (fill static from endpoint now)', value: 'snapshot' },
                    ]}
                  />
                </FormField>

                {(currentMode === 'dynamic' || currentMode === 'snapshot') && (
                  <>
                    {currentMode === 'dynamic' && (
                      <FormField label="Select Data Source (Dynamic)">
                        <Select
                          selectedOption={
                            selectedEndpoint
                              ? {
                                label: availableDataSources.find(ds => ds.endpoint === selectedEndpoint)?.label || '',
                                value: selectedEndpoint,
                              }
                              : null
                          }
                          onChange={({ detail }) => handleEndpointChange(detail.selectedOption.value, field)}
                          options={[
                            { label: 'Select a data source...', value: null }, // Placeholder option
                            ...availableDataSources.map(ds => ({
                              label: ds.label,
                              value: ds.endpoint,
                            })),
                          ]}
                          placeholder="Select a data source..." // Ensure placeholder is shown
                        />
                      </FormField>
                    )}
                    {currentMode === 'snapshot' && (
                      <FormField label="Select Data Source (Snapshot)">
                        <Select
                          selectedOption={null}
                          onChange={({ detail }) => handleSnapshotFetch(detail.selectedOption.value, field)}
                          options={availableDataSources.map(ds => ({ label: ds.label, value: ds.endpoint }))}
                        />
                      </FormField>
                    )}
                  </>
                )}

                {(currentMode === 'static') && (
                  <Table
                    variant='embedded'
                    columnDefinitions={[
                      ...schema.map(key => ({
                        id: key,
                        header: key,
                        cell: item => item[key],
                        editConfig: {
                          editingCell: (item, { currentValue, setValue }) => (
                            <Input
                              value={currentValue || item[key]}
                              onChange={({ detail }) => {
                                setValue(detail.value);
                                const updated = [...options];
                                updated[options.indexOf(item)][key] = detail.value;
                                updateComponentProperty(field.path, updated, true);
                              }}
                            />
                          ),
                        },
                      })),
                      {
                        id: 'actions',
                        header: 'Actions',
                        cell: item => (
                          <Button iconName="close" variant="icon" onClick={() => handleRemoveOption(options.indexOf(item), field)} />
                        ),
                      },
                    ]}
                    items={options}
                    header={
                      <Header
                        variant='h3'
                        actions={
                          <Button iconName="add-plus" variant="icon" onClick={() => handleAddOption(field)}>Add Option</Button>
                        }
                      >
                      </Header>
                    }
                  />
                )}
              </SpaceBetween>
            </Container>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default PropertiesPanel;
