import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Header, ButtonDropdown, SpaceBetween, Link, Button, Alert, Spinner } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import PreviewIntakeStepWidgetHelp from '../helpPanelContents/previewIntakeStepWidgetHelp';
import { apiFetch } from '../auth/apiClient';

const DEFAULT_FRAME_HEIGHT = 420;
const MIN_FRAME_HEIGHT = 260;
const CACHE_MAX_ENTRIES = 12;

const isLangObject = (val) => val && typeof val === 'object' && (Object.prototype.hasOwnProperty.call(val, 'en') || Object.prototype.hasOwnProperty.call(val, 'fr'));

const flattenValueByLang = (val, language) => {
  if (val == null) return val;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return val.map(item => flattenValueByLang(item, language));
  if (isLangObject(val)) {
    const candidate = val[language] ?? val.en ?? val.fr;
    return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : '';
  }
  if (typeof val === 'object') {
    const out = Array.isArray(val) ? [] : {};
    for (const [key, value] of Object.entries(val)) {
      out[key] = flattenValueByLang(value, language);
    }
    return out;
  }
  return val;
};

const PreviewIntakeStep = ({ selectedBlockStep, actions, toggleHelpPanel }) => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);
  const [frameH, setFrameH] = useState(DEFAULT_FRAME_HEIGHT);
  const controllerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [lang, setLang] = useState(() => {
    try {
      return window.localStorage.getItem('preview.lang') || 'en';
    } catch (_) {
      return 'en';
    }
  });

  const flattenProps = useCallback((value) => flattenValueByLang(value, lang), [lang]);

  const currentStepId = selectedBlockStep?.id ?? null;
  const cacheKey = currentStepId ? `${currentStepId}:${lang}` : null;

  const clearController = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const trimCache = useCallback(() => {
    const cache = cacheRef.current;
    if (cache.size <= CACHE_MAX_ENTRIES) return;
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }, []);

  const manualRefresh = useCallback(() => {
    if (!cacheKey) return;
    cacheRef.current.delete(cacheKey);
    setRefreshNonce(n => n + 1);
  }, [cacheKey]);

  useEffect(() => {
    if (!currentStepId) {
      clearController();
      setHtml('');
      setError(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    clearController();
    controllerRef.current = controller;

    const cached = cacheKey ? cacheRef.current.get(cacheKey) : null;
    if (cached?.html) {
      setHtml(cached.html);
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const stepResp = await apiFetch(`/api/steps/${currentStepId}`, { signal: controller.signal });
        const stepText = await stepResp.text();
        let stepPayload = null;
        try { stepPayload = stepText ? JSON.parse(stepText) : null; } catch { stepPayload = null; }
        if (!stepResp.ok || !stepPayload) {
          const message = (stepPayload && (stepPayload.error || stepPayload.message)) || `Failed to load step (HTTP ${stepResp.status})`;
          throw Object.assign(new Error(message), { code: stepResp.status, scope: 'load-step' });
        }

        const components = Array.isArray(stepPayload.components) ? stepPayload.components.map(component => {
          if (!component || typeof component !== 'object') return component;
          const flatProps = flattenProps(component.props || {}) || {};
          const templateKey = String(component.templateKey || component.template_key || component.type || '').toLowerCase();
          if (['radio', 'radios', 'checkbox', 'checkboxes'].includes(templateKey)) {
            const baseClass = (templateKey === 'checkbox' || templateKey === 'checkboxes') ? 'govuk-checkboxes' : 'govuk-radios';
            const cls = String(flatProps.classes || '').trim();
            if (!cls.split(/\s+/).some(cn => cn === baseClass)) {
              flatProps.classes = baseClass + (cls ? ` ${cls}` : '');
            }
          }
          if (templateKey === 'summary-list') {
            const included = Array.isArray(flatProps.included) ? flatProps.included : [];
            const hasRows = Array.isArray(flatProps.rows) && flatProps.rows.length;
            if (!hasRows) {
              if (included.length) {
                flatProps.rows = included.map(item => {
                  let labelText = '';
                  if (item) {
                    if (typeof item.labelOverride === 'string') labelText = item.labelOverride;
                    else if (item.labelOverride && typeof item.labelOverride === 'object') {
                      labelText = item.labelOverride[lang] || item.labelOverride.en || item.labelOverride.fr || '';
                    }
                    if (!labelText) {
                      if (lang === 'fr' && item.labelFr) labelText = item.labelFr;
                      else if (lang === 'en' && item.labelEn) labelText = item.labelEn;
                      else labelText = item.labelEn || item.labelFr || item.key || '';
                    }
                  }
                  return { key: { text: labelText }, value: { text: '' } };
                });
              } else {
                flatProps.rows = [{ key: { text: 'No fields selected' }, value: { text: '' } }];
              }
            }
          }
          return { ...component, props: flatProps };
        }) : [];

        const previewResp = await apiFetch('/api/preview/step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ components, stepId: currentStepId, language: lang }),
          signal: controller.signal,
        });

        const previewText = await previewResp.text();
        if (!previewResp.ok) {
          let errBody = null;
          try { errBody = previewText ? JSON.parse(previewText) : null; } catch (_) { errBody = null; }
          const message = (errBody && (errBody.error || errBody.message)) || previewText || `Preview failed (HTTP ${previewResp.status})`;
          throw Object.assign(new Error(message), {
            code: previewResp.status,
            scope: 'render-preview',
            componentId: errBody?.componentId || null,
          });
        }

        if (cancelled || controller.signal.aborted) return;

        if (cacheKey) {
          cacheRef.current.set(cacheKey, { html: previewText, timestamp: Date.now() });
          trimCache();
        }
        setHtml(previewText);
        setError(null);
        setFrameH(DEFAULT_FRAME_HEIGHT);
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        const header = err.scope === 'load-step' ? 'Unable to load intake step' : 'Preview rendering failed';
        const detail = err.message || 'An unknown error occurred.';
        console.error('[PreviewIntakeStep] Rendering error', {
          stepId: currentStepId,
          lang,
          scope: err.scope,
          code: err.code,
          componentId: err.componentId,
          detail,
        });
        setError({
          header,
          message: detail,
          componentId: err.componentId || null,
        });
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepId, lang, refreshNonce]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setFrameH(Math.max(MIN_FRAME_HEIGHT, Math.floor(rect.height)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver !== 'undefined') return;
    const el = wrapRef.current;
    if (!el) return;
    const nextHeight = Math.max(MIN_FRAME_HEIGHT, el.scrollHeight || el.offsetHeight || DEFAULT_FRAME_HEIGHT);
    setFrameH(nextHeight);
  }, [html]);

  useEffect(() => () => clearController(), [clearController]);

  const langLabel = lang === 'fr' ? 'FR' : 'EN';
  const languageItems = useMemo(() => ([
    { id: 'lang:en', text: 'English' },
    { id: 'lang:fr', text: 'French' },
  ]), []);

  const handleRetry = useCallback(() => {
    setError(null);
    manualRefresh();
  }, [manualRefresh]);

  const title = selectedBlockStep ? `Preview: ${selectedBlockStep.name}` : 'Preview Intake Step';

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
                ariaLabel={`Select preview language. Current ${langLabel}`}
                items={languageItems}
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
      ) : error ? (
        <Alert type="error" header={error.header}>
          <SpaceBetween size="s">
            <span>{error.message}</span>
            {error.componentId ? <Box variant="span">Component: {error.componentId}</Box> : null}
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={handleRetry} iconName="refresh" variant="primary">Retry</Button>
            </SpaceBetween>
          </SpaceBetween>
        </Alert>
      ) : (
        <Box
          ref={wrapRef}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: '#fff',
            height: '100%',
            minHeight: 320,
          }}
        >
          <iframe
            title="Preview"
            style={{ width: '100%', height: `${frameH}px`, border: 0, display: 'block' }}
            srcDoc={html}
          />
          {loading && (
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
              background="rgba(255,255,255,0.65)"
              style={{ gap: '0.5rem' }}
            >
              <Spinner />
              <span>Rendering preview…</span>
            </Box>
          )}
        </Box>
      )}
    </BoardItem>
  );
};

export default PreviewIntakeStep;
