import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  SpaceBetween,
  Box,
  Button,
  ButtonDropdown,
  Link,
  ExpandableSection
} from '@cloudscape-design/components';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import { boardItemI18nStrings } from './common';
import { apiFetch } from '../../../auth/apiClient';
import CodeView from '@cloudscape-design/code-view/code-view';
import xmlHighlight from '@cloudscape-design/code-view/highlight/xml';

const INITIAL_PAYLOAD_STATE = {
  fetching: false,
  xml: null,
  checksum: null,
  storageKey: null,
  generatedAt: null,
  error: null
};

const parsePayloadSnapshot = payload => {
  if (!payload) return { xml: null };
  if (typeof payload === 'string') {
    if (payload.trim().startsWith('<')) {
      return { xml: payload };
    }
    try {
      const parsed = JSON.parse(payload);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.xml === 'string') {
          return { xml: parsed.xml, checksum: parsed.checksum, storageKey: parsed.storageKey, generatedAt: parsed.generatedAt };
        }
        return { xml: JSON.stringify(parsed, null, 2) };
      }
    } catch {
      return { xml: payload };
    }
    return { xml: payload };
  }
  if (typeof payload === 'object') {
    if (typeof payload.xml === 'string') {
      return {
        xml: payload.xml,
        checksum: payload.checksum,
        storageKey: payload.storageKey,
        generatedAt: payload.generatedAt
      };
    }
    try {
      return { xml: JSON.stringify(payload, null, 2) };
    } catch {
      return { xml: String(payload) };
    }
  }
  return { xml: String(payload) };
};

const isXmlString = value => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.endsWith('>');
};

const NODE_TYPES = {
  ELEMENT: 1,
  TEXT: 3,
  CDATA: 4,
  COMMENT: 8,
  PROCESSING_INSTRUCTION: 7
};

const formatXml = value => {
  if (!isXmlString(value)) return value;
  try {
    const fallbackFormat = () => {
      try {
        const compact = value
          .replace(/\r?\n|\r/g, '')
          .replace(/>\s+</g, '><')
          .replace(/\s{2,}/g, ' ')
          .replace(/(>)(<)(\/*)/g, '$1\n$2');
        const lines = compact.split('\n');
        let depth = 0;
        const indentUnit = '  ';
        const formatted = [];
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          if (/^<\/.+>/.test(line)) {
            depth = Math.max(depth - 1, 0);
          }
          const indent = indentUnit.repeat(depth);
          formatted.push(`${indent}${line}`);
          if (
            /^<[^!?/][^>]*>$/.test(line) &&
            !line.endsWith('/>')
          ) {
            depth += 1;
          }
        }
        return formatted.join('\n');
      } catch (err) {
        console.warn('[esdc] xml fallback format failed', err);
        return value;
      }
    };

    const trimmed = value.trim();
    let declaration = null;
    if (trimmed.startsWith('<?xml')) {
      const end = trimmed.indexOf('?>');
      if (end !== -1) {
        declaration = trimmed.slice(0, end + 2);
      }
    }

    if (typeof window !== 'undefined' && typeof window.DOMParser === 'function') {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(value, 'application/xml');
      if (doc && doc.getElementsByTagName('parsererror').length === 0) {
        const lines = [];
        if (declaration) {
          lines.push(declaration);
        }
        const indentUnit = '  ';
        const formatNode = (node, depth) => {
          if (!node) return;
          const indent = indentUnit.repeat(depth);
          if (node.nodeType === NODE_TYPES.TEXT) {
            const text = (node.nodeValue || '').trim();
            if (text) {
              lines.push(`${indent}${text}`);
            }
            return;
          }
          if (node.nodeType === NODE_TYPES.CDATA) {
            const text = node.nodeValue || '';
            lines.push(`${indent}<![CDATA[${text}]]>`);
            return;
          }
          if (node.nodeType !== NODE_TYPES.ELEMENT) {
            return;
          }
          const name = node.nodeName;
          const attributes = Array.from(node.attributes || [])
            .map(attr => `${attr.name}="${attr.value}"`)
            .join(' ');
          const openTag = attributes ? `<${name} ${attributes}>` : `<${name}>`;
          const children = Array.from(node.childNodes || []).filter(child => {
            if (!child) return false;
            if (child.nodeType === NODE_TYPES.COMMENT) return false;
            if (child.nodeType === NODE_TYPES.TEXT) {
              return (child.nodeValue || '').trim().length > 0;
            }
            return true;
          });
          if (children.length === 0) {
            lines.push(`${indent}${openTag.replace(/>$/, `></${name}>`)}`);
            return;
          }
          if (
            children.length === 1 &&
            children[0].nodeType === NODE_TYPES.TEXT
          ) {
            const text = (children[0].nodeValue || '').trim();
            lines.push(`${indent}${openTag}${text}</${name}>`);
            return;
          }
          if (
            children.length === 1 &&
            children[0].nodeType === NODE_TYPES.CDATA
          ) {
            const text = children[0].nodeValue || '';
            lines.push(`${indent}${openTag}<![CDATA[${text}]]></${name}>`);
            return;
          }
          lines.push(`${indent}${openTag}`);
          children.forEach(child => formatNode(child, depth + 1));
          lines.push(`${indent}</${name}>`);
        };

        Array.from(doc.childNodes || []).forEach(node => {
          if (node.nodeType === NODE_TYPES.TEXT) {
            const text = (node.nodeValue || '').trim();
            if (text) lines.push(text);
          } else if (node.nodeType === NODE_TYPES.PROCESSING_INSTRUCTION && !declaration) {
            lines.unshift(`<?${node.target} ${node.data}?>`);
          } else if (node.nodeType === NODE_TYPES.ELEMENT) {
            formatNode(node, 0);
          }
        });

        return lines.join('\n');
      }
    }

    return fallbackFormat();
  } catch (err) {
    console.warn('[esdc] xml format failed', err);
    return value;
  }
};

const EsdcPayloadPreviewWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel,
  submission,
  loading,
  onRefresh
}) => {
  const [payloadState, setPayloadState] = useState(INITIAL_PAYLOAD_STATE);
  const [preparing, setPreparing] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const lastAutoPreparedRef = useRef(null);

  const infoLink = useMemo(() => {
    if (!metadata?.helpComponent || !toggleHelpPanel) {
      return undefined;
    }
    return (
      <Link
        variant="info"
        onFollow={event => {
          event.preventDefault();
          const helpContent = React.createElement(metadata.helpComponent);
          toggleHelpPanel(helpContent, metadata.helpTitle ?? 'ESDC payload preview', metadata.aiContext ?? '');
        }}
      >
        Info
      </Link>
    );
  }, [metadata?.helpComponent, metadata?.helpTitle, metadata?.aiContext, toggleHelpPanel]);

  useEffect(() => {
    let cancelled = false;

    if (!submission?.id) {
      setPayloadState(INITIAL_PAYLOAD_STATE);
      return () => {
        cancelled = true;
      };
    }

    setPayloadState(prev => ({
      ...prev,
      fetching: true,
      error: null
    }));

    const loadPayload = async () => {
      try {
        const resp = await apiFetch(`/api/esdc/participants/${submission.id}/payload`);
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || body.message || `Failed to load payload (${resp.status})`);
        }
        const data = await resp.json();
        if (cancelled) return;
        const parsed = parsePayloadSnapshot(data?.payload ?? null);
        setPayloadState({
          fetching: false,
          xml: parsed.xml,
          checksum: data?.checksum ?? parsed.checksum ?? null,
          storageKey: data?.storageKey ?? parsed.storageKey ?? null,
          generatedAt: parsed.generatedAt ?? null,
          error: null
        });
      } catch (err) {
        if (cancelled) return;
        setPayloadState(prev => ({
          ...prev,
          fetching: false,
          error: err.message || 'Failed to load payload snapshot.'
        }));
      }
    };

    loadPayload();

    return () => {
      cancelled = true;
    };
  }, [submission?.id, submission?.payload_checksum, reloadCounter]);

  const fallbackSnapshot = submission?.payload_snapshot || null;
  const fallbackParsed = useMemo(() => parsePayloadSnapshot(fallbackSnapshot), [fallbackSnapshot]);

  const rawPayloadText = payloadState.xml ?? fallbackParsed.xml ?? null;

  const previewText = useMemo(() => {
    if (!rawPayloadText) return null;
    if (isXmlString(rawPayloadText)) {
      return formatXml(rawPayloadText);
    }
    return rawPayloadText;
  }, [rawPayloadText]);

  const canonicalText = rawPayloadText ?? previewText ?? null;

  const displayStorageKey = payloadState.storageKey ?? fallbackParsed.storageKey ?? submission?.payload_storage_key ?? null;
  const displayChecksum = payloadState.checksum ?? fallbackParsed.checksum ?? submission?.payload_checksum ?? null;

  const formattedGeneratedAt = useMemo(() => {
    const generatedAt = payloadState.generatedAt ?? fallbackParsed.generatedAt ?? null;
    if (!generatedAt) return null;
    const date = new Date(generatedAt);
    if (Number.isNaN(date.getTime())) return generatedAt;
    return date.toLocaleString();
  }, [payloadState.generatedAt, fallbackParsed.generatedAt]);

const handlePrepare = useCallback(async ({ auto = false, token = null } = {}) => {
    if (!submission?.id || preparing) return;
    setPreparing(true);
    setPayloadState(prev => ({
      ...prev,
      fetching: true,
      error: null
    }));
    try {
      const resp = await apiFetch(`/api/esdc/participants/${submission.id}/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        const message = body.error || body.message || `Failed to prepare payload (${resp.status})`;
        throw new Error(message);
      }
      const data = await resp.json();
      const parsed = parsePayloadSnapshot(data?.payload ?? null);
      setPayloadState({
        fetching: false,
        xml: parsed.xml,
        checksum: data?.checksum ?? parsed.checksum ?? null,
        storageKey: data?.storageKey ?? parsed.storageKey ?? null,
        generatedAt: parsed.generatedAt ?? null,
        error: null
      });
      setReloadCounter(counter => counter + 1);
      if (typeof onRefresh === 'function') {
        onRefresh();
      }
      if (auto && data?.submission?.last_validated_at) {
        lastAutoPreparedRef.current = `${data.submission.id}:${data.submission.last_validated_at}`;
      }
    } catch (err) {
      setPayloadState(prev => ({
        ...prev,
        fetching: false,
        error: err.message || 'Failed to prepare payload.'
      }));
      if (auto) {
        // prevent immediate retry loop; allow next validation change to trigger
        lastAutoPreparedRef.current = token || lastAutoPreparedRef.current;
      }
    } finally {
      setPreparing(false);
    }
  }, [submission?.id, onRefresh, preparing]);

  useEffect(() => {
    if (!submission?.id) return;
    if (preparing) return;
    if (submission.readiness_status !== 'ready') return;
    if (submission.payload_checksum || submission.payload_snapshot) return;
    const token = `${submission.id}:${submission.last_validated_at || ''}`;
    if (token && token === lastAutoPreparedRef.current) return;
    lastAutoPreparedRef.current = token;
    handlePrepare({ auto: true, token });
  }, [
    submission?.id,
    submission?.readiness_status,
    submission?.payload_checksum,
    submission?.payload_snapshot,
    submission?.last_validated_at,
    preparing,
    handlePrepare
  ]);

  const handleDownload = () => {
    if (!canonicalText || typeof window === 'undefined') return;
    try {
      const blob = new Blob([canonicalText], { type: 'text/xml;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `esdc-participant-${submission?.case_id || 'payload'}.xml`;
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('[esdc] download payload failed', err);
    }
  };

  const isLoadingSnapshot = payloadState.fetching || preparing;

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={(
            <Button
              variant="primary"
              onClick={() => handlePrepare()}
              loading={preparing}
              disabled={!submission?.id}
            >
              Prepare payload
            </Button>
          )}
        >
          Payload preview
        </Header>
      )}
      settings={typeof actions.removeItem === 'function' ? (
        <ButtonDropdown
          ariaLabel="Payload preview settings"
          variant="icon"
          items={[{ id: 'remove', text: 'Remove widget' }]}
          onItemClick={({ detail }) => {
            if (detail?.id === 'remove') {
              actions.removeItem();
            }
          }}
        />
      ) : undefined}
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {loading && (
          <Box>Loading participant.</Box>
        )}
        {!loading && isLoadingSnapshot && (
          <Box>{preparing ? 'Preparing payload...' : 'Loading payload snapshot.'}</Box>
        )}
        {payloadState.error && !isLoadingSnapshot && (
          <Box color="text-status-critical">{payloadState.error}</Box>
        )}
        {!loading && !isLoadingSnapshot && !previewText && !payloadState.error && (
          <Box color="text-body-secondary">
            No payload snapshot has been generated yet. Use the prepare action after validation to populate the XML preview.
          </Box>
        )}
        {previewText && (
          <ExpandableSection headerText="Client payload" defaultExpanded>
            <CodeView
              content={previewText}
              language="xml"
              wrapLines
              highlight={xmlHighlight}
              ariaLabel="Participant payload XML"
              actions={(
                <CopyToClipboard
                  copyButtonAriaLabel="Copy payload XML"
                  copyErrorText="Copy failed"
                  copySuccessText="Payload copied"
                  textToCopy={canonicalText || ''}
                  disabled={!canonicalText}
                />
              )}
            />
          </ExpandableSection>
        )}
        <SpaceBetween size="xs" direction="horizontal">
          <ButtonDropdown
            ariaLabel="Payload actions"
            variant="primary"
            disabled={!canonicalText}
            items={[
              { id: 'download', text: 'Download XML', disabled: !canonicalText }
            ]}
            onItemClick={({ detail }) => {
              if (detail?.id === 'download') {
                handleDownload();
              }
            }}
          >
            Actions
          </ButtonDropdown>
        </SpaceBetween>
        {(formattedGeneratedAt || displayStorageKey || displayChecksum) && (
          <Box color="text-body-secondary">
            {formattedGeneratedAt && <Box>Generated: {formattedGeneratedAt}</Box>}
            {displayStorageKey && <Box>Storage key: {displayStorageKey}</Box>}
            {displayChecksum && <Box>Checksum: {displayChecksum}</Box>}
          </Box>
        )}
      </SpaceBetween>
    </BoardItem>
  );
};

export default EsdcPayloadPreviewWidget;
