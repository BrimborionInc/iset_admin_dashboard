import React, { useState, useEffect } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Grid, Box, Header, Button, Input, FormField, Container, SpaceBetween, Alert, Select } from "@cloudscape-design/components";
import { useParams, useHistory } from "react-router-dom";
import { generateNunjucksFromComponents, generateRemoteStaticNunjucksFromComponents } from '../utils/nunjucksBuilder';
import PropertiesPanel from './PropertiesPanel.js';

const setComponentConfigValue = (path, value, selectedComponent) => {
  if (!selectedComponent || !selectedComponent.props) return;
  const keys = path.split('.');
  let current = selectedComponent.props;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) current[keys[i]] = {};
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
};

const ComponentItem = ({ component, onAdd }) => {
  return (
    <div
      style={{ padding: "8px", border: "1px solid #ccc", cursor: "pointer" }}
      onClick={() => {
        onAdd(component);
      }}
    >
      {component.label}
    </div>
  );
};

const PreviewArea = ({ components, setComponents, handleSelectComponent, selectedComponent, template }) => {
  const moveComponent = (dragIndex, hoverIndex) => {
    setComponents((prevComponents) => {
      if (
        dragIndex < 0 ||
        hoverIndex < 0 ||
        dragIndex >= prevComponents.length ||
        hoverIndex >= prevComponents.length
      ) {
        return prevComponents; // Ensure valid indices
      }

      const updatedComponents = [...prevComponents];
      const [movedItem] = updatedComponents.splice(dragIndex, 1);
      updatedComponents.splice(hoverIndex, 0, movedItem);

      return updatedComponents;
    });
  };

  return (
    <div style={{ minHeight: "200px", border: "2px dashed #ccc", padding: "10px", backgroundColor: "#f5f3e5" }}>
      {components.map((comp, index) => (
        <DraggablePreviewItem
          key={comp.type + index}
          index={index}
          comp={comp}
          moveComponent={moveComponent}
          setComponents={setComponents}
          handleSelectComponent={handleSelectComponent}
          selectedComponent={selectedComponent}
        />
      ))}
    </div>
  );
};

const DraggablePreviewItem = ({ comp, index, moveComponent, setComponents, handleSelectComponent, selectedComponent }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "REORDER_COMPONENT",
    item: { index },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  const [, drop] = useDrop(() => ({
    accept: "REORDER_COMPONENT",
    hover: (draggedItem) => {
      if (draggedItem.index !== index && draggedItem.index !== undefined) {
        moveComponent(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  }));

  const handleDelete = (e) => {
    e.stopPropagation();
    setComponents((prev) => {
      const updatedComponents = prev.filter((_, i) => i !== index);
      if (selectedComponent?.index === index) {
        handleSelectComponent(null);
      }
      return updatedComponents;
    });
  };

  const handleClick = () => {
    handleSelectComponent(index);
  };

  const getClassName = (type) => {
    switch (type) {
      case "header":
        return "govuk-caption-l";
      case "question":
        return "govuk-heading-l";
      case "hint":
        return "govuk-hint";
      case "select":
        return "govuk-form-group";
      case "radio":
        return "govuk-form-group";
      default:
        return "";
    }
  };

  const [renderedHtml, setRenderedHtml] = useState("");

  useEffect(() => {
    const render = async () => {
      const template = generateNunjucksFromComponents([comp]);
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/render-njk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template, props: comp.props }),
        });
        const html = await response.text();
        setRenderedHtml(html);
      } catch (err) {}
    };
    render();
  }, [comp]);

  return (
    <div
      ref={(node) => drag(drop(node))}
      style={{
        marginBottom: "10px",
        border: "1px solid #000",
        padding: "8px",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: isDragging ? "#f0f0f0" : "white",
        cursor: "grab",
        backgroundColor: selectedComponent?.index === index ? "#e0e0e0" : "white",
      }}
      onClick={(e) => {
        if (selectedComponent?.index !== index) {
          handleSelectComponent(index);
        }
        e.stopPropagation();
      }}
    >
      <div style={{ padding: "5px", fontWeight: "bold", userSelect: "none" }}>⠿</div>
      <div className={getClassName(comp.type)} onClick={handleClick} style={{ flex: 1 }}>
        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      </div>
      <Button onClick={handleDelete} iconName="close" variant="icon" />
    </div>
  );
};

const ModifyComponent = () => {
  const [components, setComponents] = useState([]);
  const [initialComponents, setInitialComponents] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configPath, setConfigPath] = useState("");
  const { id } = useParams();
  const history = useHistory();
  const [template, setTemplate] = useState('');
  const [alert, setAlert] = useState(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [initialName, setInitialName] = useState('');
  const [initialStatus, setInitialStatus] = useState('');

  useEffect(() => {
    if (id === 'new') {
      setComponents([]);
      setName('Untitled BlockStep');
      setStatus('active');
      setConfigPath('');
      setInitialComponents([]);
      setInitialName('Untitled BlockStep');
      setInitialStatus('active');
      setLoading(false);
    } else if (id) {
      const fetchBlockStepDetails = async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/blocksteps/${id}`);

          if (!response.ok) {
            throw new Error(`Failed to fetch BlockStep details: ${response.statusText}`);
          }

          const data = await response.json();

          if (!data.config_path) {
            throw new Error("No config_path found in BlockStep data.");
          }

          setConfigPath(data.config_path);
          setName(data.name);
          setStatus(data.status);
          setInitialName(data.name);
          setInitialStatus(data.status);

          const jsonPath = data.config_path.replace('.njk', '.json');
          try {
            const jsonRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/load-blockstep-json?path=${encodeURIComponent(jsonPath)}`);
            if (!jsonRes.ok) {
              throw new Error(`Failed to load JSON: ${jsonRes.statusText}`);
            }
            const jsonData = await jsonRes.json();
            setComponents(jsonData.components || []);
            setInitialComponents(jsonData.components || []);
            setLoading(false);
            return;
          } catch (jsonError) {}

          setLoading(false);
        } catch (error) {
          setLoading(false);
        }
      };

      fetchBlockStepDetails();
    }
  }, [id]);

  useEffect(() => {
    const fetchAvailableComponents = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/govuk-components`);
        const data = await response.json();

        const parsed = data
          .filter((component) => component.status === 'active')
          .map((c) => ({
            ...c,
            props: typeof c.props === 'string' ? JSON.parse(c.props) : c.props,
          }));

        setAvailableComponents(parsed);
      } catch (error) {}
    };

    fetchAvailableComponents();
  }, []);

  const handleSelectComponent = (index) => {
    setSelectedComponent(
      index !== null
        ? {
            ...components[index],
            index,
            props: {
              ...components[index].props,
              items: components[index].props?.items ?? [],
              mode: components[index].props?.props?.mode || "static",
              endpoint: components[index].props?.props?.endpoint || null,
            },
          }
        : null
    );
  };

  function setNestedProp(obj, path, value) {
    if (!path) return;
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => {
      if (!acc[part]) acc[part] = {};
      return acc[part];
    }, obj);
    target[last] = value;
  }

  const updateComponentProperty = (path, value, isNested = false) => {
    if (!selectedComponent) return;

    setComponents((prevComponents) => {
      const newComponents = prevComponents.map((comp, idx) => {
        if (idx !== selectedComponent.index) return comp;

        const updatedProps = { ...comp.props };

        if (isNested) {
          setNestedProp(updatedProps, path, value);
        } else {
          updatedProps[path] = value;
        }

        return { ...comp, props: updatedProps };
      });

      setSelectedComponent((prev) => {
        if (!prev) return null;
        return {
          ...newComponents[selectedComponent.index],
          index: selectedComponent.index,
        };
      });

      return newComponents;
    });

    setInitialComponents([]);
  };

  const handleSaveTemplate = async () => {
    if (!components || components.length === 0) {
      setAlert({ type: 'error', message: "No components to save." });
      return;
    }

    const updatedTemplate = await generateRemoteStaticNunjucksFromComponents(components);

    if (id === 'new') {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/blocksteps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status, components, njkContent: updatedTemplate }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`Failed to create new BlockStep: ${result.message}`);
        }

        setAlert({ type: 'success', message: "New BlockStep created successfully!" });
        history.push(`/modify-component/${result.id}`);
      } catch (error) {
        setAlert({ type: 'error', message: "Failed to create new BlockStep." });
      }
    } else {
      if (!configPath) {
        return;
      }

      try {
        let newConfigPath = configPath;
        const jsonPath = configPath.replace('.njk', '.json');

        // Check if the name has changed and rename files if necessary
        if (name !== initialName) {
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          newConfigPath = `blocksteps/blockstep_${slug}_v1.njk`;
          const newJsonPath = newConfigPath.replace('.njk', '.json');

          // Rename the Nunjucks file
          await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/save-njk-file`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ template_path: newConfigPath, content: updatedTemplate }),
          });

          // Rename the JSON file
          await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/save-blockstep-json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json_path: newJsonPath, content: JSON.stringify({ name, status, components }, null, 2) }),
          });

          // Update the database entry with the new config path
          await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/blocksteps/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, status, config_path: newConfigPath }),
          });

          setConfigPath(newConfigPath); // Update the local state
        } else {
          // Save the Nunjucks file
          await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/save-njk-file`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ template_path: configPath, content: updatedTemplate }),
          });

          // Save the JSON file
          await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/save-blockstep-json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json_path: jsonPath, content: JSON.stringify({ name, status, components }, null, 2) }),
          });

          // Update the database entry if status has changed
          if (status !== initialStatus) {
            await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/blocksteps/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, status }),
            });
          }
        }

        setAlert({ type: 'success', message: "Template and components JSON saved successfully!" });
      } catch (error) {
        setAlert({ type: 'error', message: "Failed to save template or components JSON." });
      }
    }
  };

  const handleCancel = () => {
    history.push('/manage-components');
  };

  const hasChanges = JSON.stringify(components) !== JSON.stringify(initialComponents) || name !== initialName || status !== initialStatus;

  return (
    <DndProvider backend={HTML5Backend}>
      <Container
        header={
          <Header
            variant="h2"
            description="Modify the intake step components"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={handleCancel}>Cancel</Button>
                <Button onClick={handleSaveTemplate} disabled={!hasChanges}>Save Changes</Button>
              </SpaceBetween>
            }
          >
            Modify Intake Step
          </Header>
        }
      >
        {alert && (
          <Alert
            dismissible
            statusIconAriaLabel={alert.type === 'success' ? 'Success' : 'Error'}
            type={alert.type}
            onDismiss={() => setAlert(null)}
          >
            {alert.message}
          </Alert>
        )}
        <Grid gridDefinition={[{ colspan: 2 }, { colspan: 6 }, { colspan: 4 }]}>
          <Box padding="m">
            <Header variant="h3">Library</Header>
            {availableComponents.map((comp, index) => (
              <ComponentItem
                key={index}
                component={comp}
                onAdd={(component) => {
                  const defaultProps = {
                    ...component.props,
                    items: component.props?.items ?? []
                  };
                  const newComponent = { ...component, props: defaultProps };
                  setComponents((prev) => [...prev, newComponent]);
                }}
              />
            ))}
          </Box>

          <Box padding="m">
            <Header variant="h3">Working Area</Header>

            {!loading && (
              <PreviewArea
                components={components}
                setComponents={setComponents}
                handleSelectComponent={handleSelectComponent}
                selectedComponent={selectedComponent}
                template={template}
              />
            )}
          </Box>

          <Box padding="m">
            <PropertiesPanel
              selectedComponent={selectedComponent}
              updateComponentProperty={updateComponentProperty}
              pageProperties={{ name, status }}
              setPageProperties={({ name, status }) => {
                setName(name);
                setStatus(status);
                setInitialComponents([]);
              }}
            />
          </Box>
        </Grid>
      </Container>
    </DndProvider>
  );
};
export { setComponentConfigValue };
export default ModifyComponent;
