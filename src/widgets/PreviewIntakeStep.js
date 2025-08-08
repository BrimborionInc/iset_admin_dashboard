import React, { useEffect, useState } from 'react';
import '../css/govuk-frontend.min.css';
import { Box, Header, ButtonDropdown } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const PreviewBlockStep = ({ selectedBlockStep, actions }) => {
  const [renderedHtml, setRenderedHtml] = useState(null);

  useEffect(() => {
    if (selectedBlockStep && selectedBlockStep.config_path) {
      const url = `${process.env.REACT_APP_API_BASE_URL}/api/render-nunjucks?template_path=${selectedBlockStep.config_path}`;

      fetch(url)
        .then(response => response.text())
        .then(html => {
          const styledHtml = `<div style="background-color: #f5f3e5; padding: 10px; border: 1px solid black;">${html}</div>`;
          setRenderedHtml(styledHtml);
        })
        .catch(error => {
          console.error('Error fetching rendered template:', error);
        });
    }
  }, [selectedBlockStep]);

  useEffect(() => {
    if (!renderedHtml) return;

    const loadOptions = async (element, type) => {
      const endpoint = element.getAttribute('data-options-endpoint');
      if (!endpoint) return;

      try {
        const apiBase = process.env.REACT_APP_API_BASE_URL;
        const response = await fetch(`${apiBase}${endpoint}`);
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) return;

        let markup = '';
        if (type === 'select') {
          markup = data.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
          element.innerHTML = markup;
        } else if (type === 'radio') {
          markup = data.map(item => `
            <div class="govuk-radios__item">
              <input class="govuk-radios__input" type="radio" name="${element.getAttribute('name')}" value="${item.id}" id="${element.getAttribute('id')}-${item.id}" />
              <label class="govuk-label govuk-radios__label" for="${element.getAttribute('id')}-${item.id}">${item.name}</label>
            </div>`).join('');
          element.innerHTML = markup;
        } else if (type === 'checkbox') {
          markup = data.map(item => `
            <div class="govuk-checkboxes__item">
              <input class="govuk-checkboxes__input" type="checkbox" name="${element.getAttribute('name')}" value="${item.id}" id="${element.getAttribute('id')}-${item.id}" />
              <label class="govuk-label govuk-checkboxes__label" for="${element.getAttribute('id')}-${item.id}">${item.name}</label>
            </div>`).join('');
          element.innerHTML = markup;
        }
      } catch (error) {
        console.error(`Error fetching options from ${endpoint}:`, error);
      }
    };

    const selectElements = document.querySelectorAll('select[data-options-endpoint]');
    selectElements.forEach(select => {
      if (select.options.length === 0) {
        loadOptions(select, 'select');
      }
    });

    const radioGroups = document.querySelectorAll('[data-options-endpoint].govuk-radios');
    radioGroups.forEach(group => loadOptions(group, 'radio'));

    const checkboxGroups = document.querySelectorAll('[data-options-endpoint].govuk-checkboxes');
    checkboxGroups.forEach(group => loadOptions(group, 'checkbox'));
  }, [renderedHtml]);

  if (!selectedBlockStep) {
    return (
      <BoardItem
        header={<Header variant="h2">Preview Intake Step</Header>}
        i18nStrings={{
          dragHandleAriaLabel: 'Drag handle',
          dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
          resizeHandleAriaLabel: 'Resize handle',
          resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
        }}
      >
        <Box> Select a BlockStep to preview </Box>
      </BoardItem>
    );
  }

  if (!renderedHtml) {
    return (
      <BoardItem
        header={<Header variant="h2">Preview: {selectedBlockStep.name}</Header>}
        i18nStrings={{
          dragHandleAriaLabel: 'Drag handle',
          dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
          resizeHandleAriaLabel: 'Resize handle',
          resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
        }}
      >
        <Box>Loading template...</Box>
      </BoardItem>
    );
  }

  return (
    <BoardItem
      header={<Header variant="h2">Preview: {selectedBlockStep.name}</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions.removeItem()}
        />
      }
    >
      <Box style={{ backgroundColor: "#f5f3e5" }}>
        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
      </Box>
    </BoardItem>
  );
};

export default PreviewBlockStep;
