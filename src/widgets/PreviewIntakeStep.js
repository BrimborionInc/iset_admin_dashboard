import React, { useEffect, useRef, useState } from 'react';
import { Box, Header, ButtonDropdown } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

const PreviewIntakeStep = ({ selectedBlockStep, actions }) => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);
  const [frameH, setFrameH] = useState(420); // sensible default

  useEffect(() => {
    let cancelled = false;
    const forceWhiteBg = (doc) => {
      try {
        if (/<html[\s\S]*?>/i.test(doc)) {
          if (/<head[\s\S]*?>/i.test(doc)) {
            return doc.replace(/<\/head>/i, '<style>html,body{background:#fff !important;}</style></head>');
          }
          return doc.replace(/<html([^>]*)>/i, '<html$1><head><style>html,body{background:#fff !important;}</style></head>');
        }
        // Not a full document; wrap it
        return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{background:#fff !important;}</style></head><body>${doc}</body></html>`;
      } catch { return doc; }
    };
    async function run() {
      setError(null);
      setHtml('');
      if (!selectedBlockStep?.id) return;
      setLoading(true);
      try {
        // 1) fetch full step (includes components)
        const stepRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/steps/${selectedBlockStep.id}`);
        if (!stepRes.ok) throw new Error(`Load step HTTP ${stepRes.status}`);
        const step = await stepRes.json();
        // 2) render to HTML via server-side Nunjucks
        const prevRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/preview/step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ components: step.components || [] })
        });
        const doc = await prevRes.text();
        if (!prevRes.ok) throw new Error(`Preview HTTP ${prevRes.status}`);
        if (!cancelled) setHtml(forceWhiteBg(doc));
      } catch (e) {
        if (!cancelled) setError(String(e.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [selectedBlockStep?.id]);

  // Make iframe height follow the card size
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      // leave a little breathing room for padding
      setFrameH(Math.max(260, Math.floor(cr.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const title = selectedBlockStep ? `Preview: ${selectedBlockStep.name}` : 'Preview Intake Step';

  return (
    <BoardItem
      header={<Header variant="h2">{title}</Header>}
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
          onItemClick={() => actions?.removeItem?.()}
        />
      }
    >
      {!selectedBlockStep ? (
        <Box>Select a step to preview</Box>
      ) : loading ? (
        <Box>Loading preview…</Box>
      ) : error ? (
        <Box color="text-status-error">Failed to render: {error}</Box>
      ) : (
    <Box
          ref={wrapRef}
          style={{
            border: '1px solid #e1e3e6',
            borderRadius: 6,
            overflow: 'hidden',
      background: '#fff',     // ensure parent is white as well
      height: '100%',         // allow BoardItem to drive height
      minHeight: 320          // but don’t collapse when the card is small
          }}
        >
          <iframe
            title="Preview"
            style={{ width: '100%', height: `${frameH}px`, border: 0, display: 'block' }}
            srcDoc={html}
          />
        </Box>
      )}
    </BoardItem>
  );
};

export default PreviewIntakeStep;
