import React, { useEffect, useState } from 'react';
import { useDrop } from 'react-dnd';
import { generateNunjucksFromComponents } from '../utils/nunjucksBuilder';

const PreviewArea = ({ components, setComponents, handleSelectComponent, selectedComponent, template }) => {
  console.log("PreviewArea component mounted"); // Add this line

  const [renderedHtml, setRenderedHtml] = useState("");

  useEffect(() => {
    console.log("Received template in PreviewArea:", template); // Add this line
    const renderPreview = async () => {
      // If template is provided, use it; otherwise, generate it from components[]
      const templateToRender = template || generateNunjucksFromComponents(components);

      try {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/render-njk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template: templateToRender }),
        });
        const html = await response.text();
        console.log("Rendered HTML in PreviewArea:", html); // Add this line
        setRenderedHtml(html);
      } catch (err) {
        console.error("Failed to render Nunjucks preview in PreviewArea:", err);
      }
    };
    renderPreview();
  }, [components, template]); // Re-run whenever components or template changes

  const [, drop] = useDrop(() => ({
    accept: "COMPONENT",
    drop: (item) => {
      const defaultProps = {
        ...item.component.props,
        items: item.component.props?.items || []
      };
      const newComponent = { ...item.component, props: defaultProps };

      setComponents((prev) => {
        const updatedComponents = [...prev, newComponent];
        handleSelectComponent(updatedComponents.length - 1);
        return updatedComponents;
      });
    },
  }));

  return (
    <div ref={drop} style={{ minHeight: "200px", border: "2px dashed #ccc", padding: "10px", backgroundColor: "#f5f3e5" }}>
      <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </div>
  );
};

export default PreviewArea;
