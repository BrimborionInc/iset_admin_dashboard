import React, { useEffect, useRef, useState } from 'react';
import { Box, Header, ButtonDropdown, SpaceBetween, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import PreviewIntakeStepWidgetHelp from '../helpPanelContents/previewIntakeStepWidgetHelp';

const PreviewIntakeStep = ({ selectedBlockStep, actions, toggleHelpPanel }) => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);
  const [frameH, setFrameH] = useState(420); // sensible default
  // Language selection for preview (default English). Designed to support more in future.
  const [lang, setLang] = useState(() => {
    try {
      return window.localStorage.getItem('preview.lang') || 'en';
    } catch (_) {
      return 'en';
    }
  });

  // Helper: flatten bilingual values like { en, fr } to a single string in the chosen lang
  const flattenByLang = (val, language = 'en') => {
    const isLangObj = (v) => v && typeof v === 'object' && (Object.prototype.hasOwnProperty.call(v, 'en') || Object.prototype.hasOwnProperty.call(v, 'fr'));
    if (val == null) return val;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
    if (Array.isArray(val)) return val.map(v => flattenByLang(v, language));
    if (isLangObj(val)) {
      const cand = val[language] ?? val.en ?? val.fr;
      return typeof cand === 'string' || typeof cand === 'number' ? String(cand) : '';
    }
    if (typeof val === 'object') {
      const out = Array.isArray(val) ? [] : {};
      for (const [k, v] of Object.entries(val)) out[k] = flattenByLang(v, language);
      return out;
    }
    return val;
  };

  useEffect(() => {
    let cancelled = false;
    const forceWhiteBg = (doc) => {
      try {
        // Additional override: GOV.UK does not provide combined inline+small class behaviour.
        // We add a rule so that when both modifiers are present, items lay out inline while retaining small control sizing.
        const styleTag = '<style>html,body{background:#f7f9fc !important;} body{padding:12px;}\n' +
          '.govuk-radios.govuk-radios--inline.govuk-radios--small .govuk-radios__item{display:inline-block;margin-right:20px;margin-bottom:0;vertical-align:top;}\n' +
          '.govuk-radios.govuk-radios--inline.govuk-radios--small .govuk-radios__item:last-child{margin-right:0;}\n' +
          '</style>';
        if (/<html[\s\S]*?>/i.test(doc)) {
          if (/<head[\s\S]*?>/i.test(doc)) {
            return doc.replace(/<\/head>/i, `${styleTag}</head>`);
          }
          return doc.replace(/<html([^>]*)>/i, `<html$1><head>${styleTag}</head>`);
        }
        // Not a full document; wrap it
        return `<!doctype html><html><head><meta charset="utf-8">${styleTag}</head><body>${doc}</body></html>`;
      } catch { return doc; }
    };
    async function run() {
      setError(null);
      setHtml('');
      if (!selectedBlockStep?.id) return;
      setLoading(true);
      try {
        // 1) fetch full step (includes components)
  const apiBase = process.env.REACT_APP_API_BASE_URL || '';
  const stepRes = await fetch(`${apiBase}/api/steps/${selectedBlockStep.id}`);
        if (!stepRes.ok) throw new Error(`Load step HTTP ${stepRes.status}`);
        const step = await stepRes.json();
        // Flatten bilingual fields to the selected language for preview rendering
        const components = Array.isArray(step.components) ? step.components.map(c => ({
          ...c,
          props: flattenByLang(c?.props || {}, lang)
        })) : [];
        // 2) render to HTML via server-side Nunjucks
  const prevRes = await fetch(`${apiBase}/api/preview/step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ components })
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
  }, [selectedBlockStep?.id, lang]);

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

  const langLabel = lang === 'fr' ? 'FR' : 'EN';
  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel && toggleHelpPanel(<PreviewIntakeStepWidgetHelp />, 'Preview', PreviewIntakeStepWidgetHelp.aiContext)}
            >
              Info
            </Link>
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown
                ariaLabel="Select language"
                items={[
                  { id: 'lang:en', text: 'English' },
                  { id: 'lang:fr', text: 'French' },
                ]}
                onItemClick={({ detail }) => {
                  const id = detail?.id;
                  if (typeof id === 'string' && id.startsWith('lang:')) {
                    const code = id.split(':')[1];
                    if (code && code !== lang) {
                      setLang(code);
                      try { window.localStorage.setItem('preview.lang', code); } catch (_) {}
                    }
                  }
                }}
              >
                {`Language: ${langLabel}`}
              </ButtonDropdown>
            </SpaceBetween>
          }
        >
          {title}
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Preview settings"
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
