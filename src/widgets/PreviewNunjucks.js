import React, { useState, useEffect } from 'react';
import { Box, Header } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import CodeView from '@cloudscape-design/code-view/code-view'; // Correct CodeView import
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard'; // Import CopyToClipboard

const PreviewNunjucks = ({ selectedBlockStep }) => {
  const [nunjucksContent, setNunjucksContent] = useState('');

  useEffect(() => {
    if (selectedBlockStep && selectedBlockStep.config_path) {
      const url = `${process.env.REACT_APP_API_BASE_URL}/api/get-njk-file?template_path=${selectedBlockStep.config_path}`;
      fetch(url)
        .then(response => response.text())
        .then(data => {
          console.log('Fetched Nunjucks file content:', data); // Log the full HTTP response body
          setNunjucksContent(data || '');
        })
        .catch(error => {
          console.error('Error fetching Nunjucks file:', error);
          setNunjucksContent('');
        });
    } else {
      setNunjucksContent('');
    }
  }, [selectedBlockStep]);

  if (!selectedBlockStep) {
    return (
      <BoardItem
        header={<Header variant="h2">Preview Nunjucks</Header>}
        i18nStrings={{
          dragHandleAriaLabel: 'Drag handle',
          dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
          resizeHandleAriaLabel: 'Resize handle',
          resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
        }}
      >
        <Box>Select a BlockStep to preview its Nunjucks template</Box>
      </BoardItem>
    );
  }

  return (
    <BoardItem
      header={<Header variant="h2">Nunjucks Code Preview</Header>}
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
    >
      <Box>
        <CodeView
          content={nunjucksContent} // Display the fetched Nunjucks content
          language="html" // Set the language for syntax highlighting
          lineNumbers // Enable line numbers
          wrapLines // Enable line wrapping
          actions={
            <CopyToClipboard
              copyButtonAriaLabel="Copy code"
              copyErrorText="Code failed to copy"
              copySuccessText="Code copied"
              textToCopy={nunjucksContent} // Content to copy
            />
          }
          ariaLabel="Nunjucks Code View"
        />
      </Box>
    </BoardItem>
  );
};

export default PreviewNunjucks;
