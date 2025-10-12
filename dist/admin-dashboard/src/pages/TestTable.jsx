import * as React from "react";
import Table from "@cloudscape-design/components/table";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import Checkbox from "@cloudscape-design/components/checkbox";
import Header from "@cloudscape-design/components/header";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";

export default function PropertiesPanelTable() {
  const [items, setItems] = React.useState([
    { id: "legend", label: "Legend Text", type: "text", value: "What service do you require?" },
    { id: "hint", label: "Hint Text", type: "text", value: "You can only choose one" },
    { id: "heading", label: "Is Page Heading", type: "checkbox", value: true },
    {
      id: "class",
      label: "CSS Classes",
      type: "select",
      value: "",
      options: [
        { label: "(none)", value: "" },
        { label: "govuk-fieldset", value: "govuk-fieldset" },
        { label: "govuk-form-group", value: "govuk-form-group" }
      ]
    }
  ]);

  const [radioOptions, setRadioOptions] = React.useState([
    { id: "1", text: "Option 1", value: "1" },
    { id: "2", text: "Option 2", value: "2" }
  ]);

  const updateValue = (index, newValue) => {
    const updated = [...items];
    updated[index].value = newValue;
    setItems(updated);
  };

  const updateRadioOption = (index, field, newValue) => {
    const updated = [...radioOptions];
    updated[index][field] = newValue;
    setRadioOptions(updated);
  };

  const removeRadioOption = (index) => {
    const updated = radioOptions.filter((_, i) => i !== index);
    setRadioOptions(updated);
  };

  const addRadioOption = () => {
    const newOption = { id: `${radioOptions.length + 1}`, text: "", value: "" };
    setRadioOptions([...radioOptions, newOption]);
  };

  return (
    <Box padding="m">
      <Table
        renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
          `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
        }
        ariaLabels={{
          activateEditLabel: (column, item) => `Edit ${item.label} ${column.header}`,
          cancelEditLabel: column => `Cancel editing ${column.header}`,
          submitEditLabel: column => `Submit editing ${column.header}`,
          tableLabel: "Properties Table with inline editing"
        }}
        columnDefinitions={[
          {
            id: "label",
            header: "Property",
            cell: item => item.label,
            isRowHeader: true
          },
          {
            id: "value",
            header: "Value",
            cell: item => (typeof item.value === "object" ? JSON.stringify(item.value) : item.value),
            editConfig: {
              ariaLabel: "Value",
              editIconAriaLabel: "editable",
              editingCell: (item, { currentValue, setValue }) => {
                switch (item.type) {
                  case "text":
                    return (
                      <Input
                        autoFocus
                        value={currentValue ?? item.value}
                        onChange={event => setValue(event.detail.value)}
                      />
                    );
                  case "checkbox":
                    return (
                      <Checkbox
                        checked={currentValue ?? item.value}
                        onChange={event => setValue(event.detail.checked)}
                      />
                    );
                  case "select":
                    return (
                      <Select
                        autoFocus
                        selectedOption={
                          item.options.find(o => o.value === (currentValue ?? item.value)) || { label: "", value: "" }
                        }
                        onChange={event => setValue(event.detail.selectedOption.value)}
                        options={item.options}
                      />
                    );
                  default:
                    return null;
                }
              }
            }
          }
        ]}
        items={items}
        submitEdit={async (item, column, newValue) => {
          const index = items.findIndex(i => i.id === item.id);
          updateValue(index, newValue);
        }}
        header={<Header variant="h3">Component Properties</Header>}
      />

      <Box margin={{ top: "m" }}>
        <Table
          renderAriaLive={({ firstIndex, lastIndex, totalItemsCount }) =>
            `Displaying items ${firstIndex} to ${lastIndex} of ${totalItemsCount}`
          }
          ariaLabels={{
            activateEditLabel: (column, item) => `Edit ${item.text} ${column.header}`,
            cancelEditLabel: column => `Cancel editing ${column.header}`,
            submitEditLabel: column => `Submit editing ${column.header}`,
            tableLabel: "Radio Options Table with inline editing"
          }}
          columnDefinitions={[
            {
              id: "text",
              header: "Text",
              cell: item => item.text || "",
              editConfig: {
                ariaLabel: "Text",
                editIconAriaLabel: "editable",
                editingCell: (item, { currentValue, setValue }) => (
                  <Input
                    autoFocus
                    value={currentValue ?? item.text}
                    onChange={event => setValue(event.detail.value)}
                  />
                )
              }
            },
            {
              id: "value",
              header: "Value",
              cell: item => item.value || "",
              editConfig: {
                ariaLabel: "Value",
                editIconAriaLabel: "editable",
                editingCell: (item, { currentValue, setValue }) => (
                  <Input
                    autoFocus
                    value={currentValue ?? item.value}
                    onChange={event => setValue(event.detail.value)}
                  />
                )
              }
            },
            {
              id: "actions",
              header: "",
              cell: (item) => (
                <Button
                  iconName="close"
                  variant="icon"
                  onClick={() => {
                    const index = radioOptions.findIndex(option => option.id === item.id);
                    removeRadioOption(index);
                  }}
                  ariaLabel={`Remove option ${item.text}`}
                />
              ),
              minWidth: 50 // Make the column narrow
            }
          ]}
          items={radioOptions}
          submitEdit={async (item, column, newValue) => {
            const index = radioOptions.findIndex(i => i.id === item.id);
            updateRadioOption(index, column.id, newValue);
          }}
          header={
            <Header
              variant="h3"
              actions={
                <Button onClick={addRadioOption} variant="primary">
                  Add Option
                </Button>
              }
            >
              Radio Options
            </Header>
          }
          empty={
            <Box textAlign="center" color="inherit">
              <b>No options</b>
            </Box>
          }
        />
      </Box>
    </Box>
  );
}
