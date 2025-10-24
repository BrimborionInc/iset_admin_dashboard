import React, { useEffect, useState } from 'react';
import { Box, Header, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import CodeView from '@cloudscape-design/code-view/code-view';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import PreviewNunjucksWidgetHelp from '../helpPanelContents/previewNunjucksWidgetHelp';
import { apiFetch } from '../auth/apiClient';

const PreviewStepJson = ({ selectedBlockStep, toggleHelpPanel }) => {
  const [json, setJson] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!selectedBlockStep?.id) { setJson(''); return; }
      setLoading(true);
      try {
  const res = await apiFetch(`/api/steps/${selectedBlockStep.id}`);
        const data = await res.json();
        if (!cancelled) setJson(JSON.stringify(data, null, 2));
      } catch (e) {
        if (!cancelled) setJson(`/* Failed to load: ${String(e)} */`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [selectedBlockStep?.id]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel && toggleHelpPanel(<PreviewNunjucksWidgetHelp />, 'Step JSON', PreviewNunjucksWidgetHelp.aiContext)}
            >
              Info
            </Link>
          }
        >
          Step JSON
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
    >
      {!selectedBlockStep ? (
        <Box>Select a step to inspect its JSON</Box>
      ) : loading ? (
        <Box>Loading…</Box>
      ) : (
        <CodeView
          content={json}
          language="json"
          lineNumbers
          wrapLines
          actions={
            <CopyToClipboard
              copyButtonAriaLabel="Copy JSON"
              copyErrorText="Copy failed"
              copySuccessText="Copied"
              textToCopy={json}
            />
          }
          ariaLabel="Step JSON"
        />
      )}
    </BoardItem>
  );
};

export default PreviewStepJson;
