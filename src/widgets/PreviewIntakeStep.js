import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Header, ButtonDropdown, SpaceBetween, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import PreviewIntakeStepWidgetHelp from '../helpPanelContents/previewIntakeStepWidgetHelp';
import { apiFetch } from '../auth/apiClient';

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

  const buildTransformedHtml = useCallback((doc) => {
    // Try to inject script before </body> in a case-insensitive, whitespace-tolerant way.
    const injection = `\n<script>(function(){function x(){try{var roots=document.querySelectorAll('[data-component-type="signature-ack"], .signature-ack');if(!roots.length){return;}roots.forEach(function(root){if(root.__sigTransformed) return; root.__sigTransformed=true; var input=root.querySelector('input[type=text]'); if(!input) return; var btn=root.querySelector('button'); if(!btn){var b=document.createElement('button'); b.type='button'; b.className='govuk-button govuk-button--secondary'; b.textContent='Sign'; b.disabled=true; btn=b; root.appendChild(btn);} var wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.gap='12px'; var box=input; box.style.width='100%'; box.style.background='#fff'; box.style.border='2px solid #0b0c0c'; box.style.borderRadius='6px'; box.style.padding='14px 16px'; box.style.boxShadow='0 1px 2px rgba(0,0,0,0.08)'; var holder=document.createElement('div'); holder.style.flex='0 0 34%'; holder.style.minWidth='260px'; box.parentNode.insertBefore(wrap, box); holder.appendChild(box); wrap.appendChild(holder); btn.style.margin='0'; wrap.appendChild(btn);});}catch(e){/* silent */}} if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',x);}else{x();} setTimeout(x,60); setTimeout(x,250);})();</script>`;
    const bodyCloseRegex = /<\/body>\s*$/i;
    if (bodyCloseRegex.test(doc)) {
      return doc.replace(bodyCloseRegex, injection + '</body>');
    }
    return doc + injection; // fallback append
  }, []);

  // Expose a runtime (iframe onload) transformation as a safety net if injection fails
  const runtimeTransform = useCallback((iframe) => {
    if (!iframe?.contentDocument) return;
    try {
      const d = iframe.contentDocument;
      const roots = d.querySelectorAll('[data-component-type="signature-ack"], .signature-ack, .govuk-form-group');
      roots.forEach(root => {
        if (root.__sigTransformed) return;
        const input = root.querySelector('input[type=text]');
        if (!input) return;
        // Heuristic: only treat as signature if placeholder or name suggests
        const nameAttr = (input.getAttribute('name')||'').toLowerCase();
        const placeholder = (input.getAttribute('placeholder')||'').toLowerCase();
        if (!root.matches('[data-component-type="signature-ack"], .signature-ack') && !nameAttr.includes('signature') && !placeholder.includes('signature')) return;
        root.__sigTransformed = true;
        let btn = root.querySelector('button');
        if (!btn) {
          btn = d.createElement('button');
          btn.type = 'button';
          btn.className = 'govuk-button govuk-button--secondary';
          btn.textContent = 'Sign';
          btn.disabled = true;
          root.appendChild(btn);
        }
        const wrap = d.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '12px';
        const holder = d.createElement('div');
        holder.style.flex = '0 0 34%';
        holder.style.minWidth = '260px';
        const box = input;
        box.style.width = '100%';
        box.style.background = '#fff';
        box.style.border = '2px solid #0b0c0c';
        box.style.borderRadius = '6px';
        box.style.padding = '14px 16px';
        box.style.boxShadow = '0 1px 2px rgba(0,0,0,0.08)';
        box.parentNode.insertBefore(wrap, box);
        holder.appendChild(box);
        wrap.appendChild(holder);
        btn.style.margin = '0';
        wrap.appendChild(btn);
      });
    } catch (_) { /* silent */ }
  }, []);

  const iframeRef = useRef(null);

  useEffect(() => {
    let cancelled = false; // fetch + render lifecycle guard
    async function run() {
      setError(null);
      setHtml('');
      if (!selectedBlockStep?.id) return;
      setLoading(true);
      try {
        // 1) fetch full step (includes components) via authenticated apiFetch
        const stepRes = await apiFetch(`/api/steps/${selectedBlockStep.id}`);
        if (!stepRes.ok) throw new Error(`Load step HTTP ${stepRes.status}`);
        const step = await stepRes.json();
        // Flatten bilingual fields to the selected language for preview rendering
        const components = Array.isArray(step.components) ? step.components.map(c => {
          const flatProps = flattenByLang(c?.props || {}, lang) || {};
          const tKey = String(c.templateKey || c.template_key || c.type || '').toLowerCase();
          if (['radio','radios','checkbox','checkboxes'].includes(tKey)) {
            const base = (tKey === 'checkbox' || tKey === 'checkboxes') ? 'govuk-checkboxes' : 'govuk-radios';
            const cls = String(flatProps.classes || '').trim();
            if (!cls.split(/\s+/).some(cn => cn === base)) {
              flatProps.classes = (base + (cls ? ' ' + cls : ''));
            }
          }
          // Summary-list preview support: synthesize rows from included if authoring config present
          if (tKey === 'summary-list') {
            const included = Array.isArray(flatProps.included) ? flatProps.included : [];
            const hasRows = Array.isArray(flatProps.rows) && flatProps.rows.length;
            if (!hasRows) {
              if (included.length) {
                flatProps.rows = included.map(r => {
                  // Determine label: override -> snapshot bilingual -> key
                  let labelText = '';
                  if (r) {
                    if (typeof r.labelOverride === 'string') labelText = r.labelOverride;
                    else if (r.labelOverride && typeof r.labelOverride === 'object') labelText = r.labelOverride[lang] || r.labelOverride.en || r.labelOverride.fr || '';
                    if (!labelText) {
                      if (lang === 'fr' && r.labelFr) labelText = r.labelFr;
                      else if (lang === 'en' && r.labelEn) labelText = r.labelEn;
                      else labelText = r.labelEn || r.labelFr || r.key || '';
                    }
                  }
                  return { key: { text: labelText }, value: { text: '' } };
                });
              } else {
                flatProps.rows = [ { key: { text: 'No fields selected' }, value: { text: '' } } ];
              }
            }
          }
          return { ...c, props: flatProps };
        }) : [];
        // 2) render to HTML via server-side Nunjucks
  const prevRes = await apiFetch('/api/preview/step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ components })
        });
        const doc = await prevRes.text(); // server returns full GOV.UK-wrapped document
        if (!prevRes.ok) throw new Error(`Preview HTTP ${prevRes.status}`);
        if (!cancelled) {
          const transformed = buildTransformedHtml(doc);
          setHtml(transformed);
        }
      } catch (e) {
        if (!cancelled) setError(String(e.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [selectedBlockStep?.id, lang, buildTransformedHtml]);

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
            ref={iframeRef}
            title="Preview"
            style={{ width: '100%', height: `${frameH}px`, border: 0, display: 'block' }}
            srcDoc={html}
            onLoad={() => runtimeTransform(iframeRef.current)}
          />
        </Box>
      )}
    </BoardItem>
  );
};

export default PreviewIntakeStep;
