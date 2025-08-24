import React, { useMemo } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Box, Header, SpaceBetween, ButtonDropdown, Grid, Input, FormField, Badge, Container, Button, Alert } from '@cloudscape-design/components';

// Phase 1: manual bilingual editing for common fields only (EN/FR)
// - input/text/textarea/password/number/email/phone: label.text, hint.text
// - radios/checkboxes: fieldset.legend.text, hint.text, items[].text
// - select: label.text, hint.text, items[].text
// - date-input: fieldset.legend.text, hint.text
// - file-upload: label.text, hint.text

const LANGS = ['en', 'fr'];

function getAtPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setAtPath(obj, path, value) {
  if (!obj || !path) return obj;
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  const last = parts.pop();
  let cur = obj;
  for (const p of parts) {
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[last] = value;
  return obj;
}

function ensureLangObject(val) {
  if (val == null) return { en: '', fr: '' };
  if (typeof val === 'string') return { en: val, fr: '' };
  const out = { en: '', fr: '' };
  if (typeof val === 'object') {
    out.en = typeof val.en === 'string' ? val.en : (typeof val.en === 'number' ? String(val.en) : (typeof val.text === 'string' ? val.text : ''));
    out.fr = typeof val.fr === 'string' ? val.fr : (typeof val.fr === 'number' ? String(val.fr) : '');
  }
  return out;
}

function isChoice(type) {
  const t = String(type || '').toLowerCase();
  return t === 'radio' || t === 'radios' || t === 'checkbox' || t === 'checkboxes' || t === 'select';
}

function isInputLike(type) {
  const t = String(type || '').toLowerCase();
  return ['input','text','email','number','password','phone','password-input','textarea','character-count'].includes(t);
}

function isDateLike(type) {
  const t = String(type || '').toLowerCase();
  return t === 'date' || t === 'date-input';
}

const TranslationsWidget = ({ actions, components = [], setComponents, asBoardItem = true }) => {
  // All authenticated API calls should use apiFetch wrapper
  // (lazy import to avoid circulars if any heavy deps load this widget early)
  const { apiFetch } = require('../auth/apiClient');
  const [translating, setTranslating] = React.useState(false);
  const [message, setMessage] = React.useState(null); // { type: 'success'|'error'|'info', text }
  // Compute coverage per language (simple: counts non-empty fields over total fields)
  const coverage = useMemo(() => {
    let total = 0; const filled = { en: 0, fr: 0 };
    components.forEach(c => {
      const type = String(c?.type || c?.template_key || '').toLowerCase();
      const p = c?.props || {};
      const push = (v) => {
        const o = ensureLangObject(v);
        total += 1;
        if (o.en && String(o.en).trim()) filled.en += 1;
        if (o.fr && String(o.fr).trim()) filled.fr += 1;
      };
      if (isInputLike(type)) {
        push(getAtPath(p, 'label.text'));
        push(getAtPath(p, 'hint.text'));
      } else if (isChoice(type)) {
        if (type === 'select') {
          push(getAtPath(p, 'label.text'));
        } else {
          push(getAtPath(p, 'fieldset.legend.text'));
        }
        push(getAtPath(p, 'hint.text'));
        const items = Array.isArray(p?.items) ? p.items : [];
        items.forEach(it => push(it?.text));
      } else if (isDateLike(type)) {
        push(getAtPath(p, 'fieldset.legend.text'));
        push(getAtPath(p, 'hint.text'));
      } else {
        // best-effort: try label.text then hint.text if present
        if (getAtPath(p, 'label.text') !== undefined) push(getAtPath(p, 'label.text'));
        if (getAtPath(p, 'hint.text') !== undefined) push(getAtPath(p, 'hint.text'));
  // also support static content components with top-level text/html
  if (getAtPath(p, 'text') !== undefined) push(getAtPath(p, 'text'));
  if (getAtPath(p, 'html') !== undefined) push(getAtPath(p, 'html'));
      }
    });
    const pct = (lang) => total ? Math.round((filled[lang] / total) * 100) : 100;
    return { total, filled, pct: { en: pct('en'), fr: pct('fr') } };
  }, [components]);

  const handleChange = (compIndex, path, lang, value) => {
    setComponents(prev => prev.map((c, idx) => {
      if (idx !== compIndex) return c;
      const props = { ...(c.props || {}) };
      const cur = getAtPath(props, path);
      const lng = ensureLangObject(cur);
      lng[lang] = value;
      setAtPath(props, path, lng);
      return { ...c, props };
    }));
  };

  const handleItemChange = (compIndex, itemIndex, lang, value) => {
    setComponents(prev => prev.map((c, idx) => {
      if (idx !== compIndex) return c;
      const props = { ...(c.props || {}) };
      const items = Array.isArray(props.items) ? [...props.items] : [];
      const it = { ...(items[itemIndex] || {}) };
      const lng = ensureLangObject(it.text);
      lng[lang] = value;
      it.text = lng;
      items[itemIndex] = it;
      props.items = items;
      return { ...c, props };
    }));
  };

  // Collect translation tasks for missing EN or FR fields
  const collectTasks = () => {
    const tasks = []; // { id, from: 'en'|'fr', to: 'en'|'fr', text: string }
    const addTasksFor = (ci, p, path) => {
      const v = getAtPath(p, path);
      const o = ensureLangObject(v);
      const en = (o.en && String(o.en).trim()) ? String(o.en).trim() : '';
      const fr = (o.fr && String(o.fr).trim()) ? String(o.fr).trim() : '';
      // Skip if both are empty
      if (!en && !fr) return;
      if (en && !fr) tasks.push({ id: `${ci}|${path}`, from: 'en', to: 'fr', text: en });
      if (fr && !en) tasks.push({ id: `${ci}|${path}`, from: 'fr', to: 'en', text: fr });
    };
    components.forEach((comp, ci) => {
      const type = String(comp?.type || comp?.template_key || '').toLowerCase();
      const p = comp?.props || {};
      if (isInputLike(type)) {
        addTasksFor(ci, p, 'label.text');
        addTasksFor(ci, p, 'hint.text');
      } else if (isChoice(type)) {
        if (type === 'select') addTasksFor(ci, p, 'label.text'); else addTasksFor(ci, p, 'fieldset.legend.text');
        addTasksFor(ci, p, 'hint.text');
  const items = Array.isArray(p?.items) ? p.items : [];
  items.forEach((it, ii) => addTasksFor(ci, p, `items.${ii}.text`));
      } else if (isDateLike(type)) {
        addTasksFor(ci, p, 'fieldset.legend.text');
        addTasksFor(ci, p, 'hint.text');
      } else {
        if (getAtPath(p, 'label.text') !== undefined) addTasksFor(ci, p, 'label.text');
        if (getAtPath(p, 'hint.text') !== undefined) addTasksFor(ci, p, 'hint.text');
  // include static content fields
  if (getAtPath(p, 'text') !== undefined) addTasksFor(ci, p, 'text');
  if (getAtPath(p, 'html') !== undefined) addTasksFor(ci, p, 'html');
      }
    });
    return tasks;
  };

  const extractJson = (s) => {
    if (!s || typeof s !== 'string') return null;
    try { return JSON.parse(s); } catch (_) {}
    const m = s.match(/```json\s*([\s\S]*?)```/i) || s.match(/```\s*([\s\S]*?)```/);
    if (m && m[1]) {
      try { return JSON.parse(m[1]); } catch (_) {}
    }
    // fallback: try to find first {...}
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const slice = s.slice(start, end + 1);
      try { return JSON.parse(slice); } catch (_) {}
    }
    return null;
  };

  const applyTranslations = (list) => {
    // list: [{ id, lang, text }]
    const byComp = new Map();
    for (const t of list) {
      if (!t || typeof t.id !== 'string' || !t.lang || typeof t.text !== 'string') continue;
      const [ciStr] = t.id.split('|');
      const ci = parseInt(ciStr, 10);
      if (!byComp.has(ci)) byComp.set(ci, []);
      byComp.get(ci).push(t);
    }
    setComponents(prev => prev.map((c, idx) => {
      const updates = byComp.get(idx);
      if (!updates || !updates.length) return c;
      const comp = { ...c };
      const p = { ...(comp.props || {}) };
      for (const u of updates) {
        const path = u.id.slice(String(idx).length + 1); // remove "{idx}|"
        const cur = getAtPath(p, path);
        const o = ensureLangObject(cur);
        if (u.lang === 'en') o.en = u.text; else if (u.lang === 'fr') o.fr = u.text;
        setAtPath(p, path, o);
      }
      comp.props = p;
      return comp;
    }));
  };

  const handleTranslateMissing = async () => {
    setMessage(null);
    const items = collectTasks();
    if (!items.length) {
      setMessage({ type: 'info', text: 'No missing fields detected.' });
      return;
    }
    setTranslating(true);
    try {
      const system = {
        role: 'system',
        content: 'You are a translation assistant. Translate between English and Canadian French. Preserve placeholders, numbers, punctuation, and option values. Respond ONLY with JSON matching the requested schema.'
      };
      const user = {
        role: 'user',
        content: JSON.stringify({
          instruction: 'For each item, translate text from `from` language to `to` language. Return JSON only: { "translations": [{ "id": string, "lang": "en"|"fr", "text": string }] }',
          items
        })
      };
  const res = await apiFetch(`/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [system, user] })
      });
      if (res.status === 501) {
        setMessage({ type: 'error', text: 'AI translation is disabled on the server. Configure the API key to enable it.' });
        setTranslating(false);
        return;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      const parsed = extractJson(content);
      const list = parsed?.translations;
      if (!Array.isArray(list) || !list.length) {
        setMessage({ type: 'error', text: 'Translation service returned an unexpected response.' });
        setTranslating(false);
        return;
      }
      const clean = list
        .filter(it => it && typeof it.id === 'string' && (it.lang === 'en' || it.lang === 'fr') && typeof it.text === 'string')
        .map(it => ({ id: it.id, lang: it.lang, text: it.text }));
      if (!clean.length) {
        setMessage({ type: 'error', text: 'No valid translations returned.' });
        setTranslating(false);
        return;
      }
      applyTranslations(clean);
      setMessage({ type: 'success', text: `Translated ${clean.length} field(s).` });
    } catch (e) {
      setMessage({ type: 'error', text: `Translation failed: ${e.message || String(e)}` });
    } finally {
      setTranslating(false);
    }
  };

  const content = (
    <SpaceBetween size="s">
      {components.map((comp, ci) => {
        const type = String(comp?.type || comp?.template_key || '').toLowerCase();
        const props = comp?.props || {};
        const rows = [];
        if (isInputLike(type) || type === 'select') {
          rows.push({ label: 'Label', path: 'label.text' });
          rows.push({ label: 'Hint', path: 'hint.text' });
        } else if (isChoice(type)) {
          if (type === 'select') {
            rows.push({ label: 'Label', path: 'label.text' });
          } else {
            rows.push({ label: 'Question', path: 'fieldset.legend.text' });
          }
          rows.push({ label: 'Hint', path: 'hint.text' });
        } else if (isDateLike(type)) {
          rows.push({ label: 'Legend', path: 'fieldset.legend.text' });
          rows.push({ label: 'Hint', path: 'hint.text' });
        } else {
          if (getAtPath(props, 'label.text') !== undefined) rows.push({ label: 'Label', path: 'label.text' });
          if (getAtPath(props, 'hint.text') !== undefined) rows.push({ label: 'Hint', path: 'hint.text' });
          // static content fields (e.g., inset-text, text-block)
          if (getAtPath(props, 'text') !== undefined) rows.push({ label: 'Text', path: 'text' });
          if (getAtPath(props, 'html') !== undefined) rows.push({ label: 'HTML', path: 'html' });
        }

        const items = Array.isArray(props.items) ? props.items : [];

        return (
          <Box key={ci} padding={{ top: 'xs', bottom: 's' }} border={{ side: 'bottom', color: 'divider' }}>
            <Header variant="h3">{comp?.label || comp?.type || 'Component'} <small style={{ color: '#6b7280' }}>({type})</small></Header>

            {rows.map((r, idx) => {
              const val = ensureLangObject(getAtPath(props, r.path));
              return (
                <Grid key={idx} gridDefinition={[{ colspan: 3 }, { colspan: 4 }, { colspan: 4 }]}>
                  <Box variant="div" padding={{ vertical: 'xs' }} style={{ alignSelf: 'center' }}>
                    <strong>{r.label}</strong>
                  </Box>
                  {LANGS.map(lang => (
                    <FormField key={lang} label={lang.toUpperCase()}>
                      <Input
                        value={String(val[lang] ?? '')}
                        onChange={({ detail }) => handleChange(ci, r.path, lang, detail.value)}
                      />
                    </FormField>
                  ))}
                </Grid>
              );
            })}

            {isChoice(type) && items.length > 0 && (
              <Box padding={{ top: 's' }}>
                <Header variant="h4">Options</Header>
                {items.map((it, ii) => {
                  const val = ensureLangObject(it?.text);
                  return (
                    <Grid key={ii} gridDefinition={[{ colspan: 3 }, { colspan: 4 }, { colspan: 4 }]}>
                      <Box variant="div" padding={{ vertical: 'xs' }} style={{ alignSelf: 'center' }}>
                        Value: <code>{String(it?.value ?? '')}</code>
                      </Box>
                      {LANGS.map(lang => (
                        <FormField key={lang} label={lang.toUpperCase()}>
                          <Input
                            value={String(val[lang] ?? '')}
                            onChange={({ detail }) => handleItemChange(ci, ii, lang, detail.value)}
                          />
                        </FormField>
                      ))}
                    </Grid>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
      {(!components || components.length === 0) && (
        <Box variant="div" color="text-status-inactive">No components to translate.</Box>
      )}
    </SpaceBetween>
  );

  const toolbar = (
    <SpaceBetween direction="horizontal" size="xs">
      <Badge color={coverage.pct.fr === 100 ? 'green' : 'normal'}>FR {coverage.pct.fr}%</Badge>
      <Badge color={coverage.pct.en === 100 ? 'green' : 'normal'}>EN {coverage.pct.en}%</Badge>
      <Button onClick={handleTranslateMissing} disabled={translating} variant="normal">
        {translating ? 'Translating…' : 'Translate'}
      </Button>
    </SpaceBetween>
  );

  const headerEl = (
    <Header variant="h3" actions={toolbar}>Translations</Header>
  );

  if (asBoardItem) {
    return (
      <BoardItem
        header={headerEl}
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
            onItemClick={() => actions?.removeItem && actions.removeItem()}
          />
        }
      >
        <SpaceBetween size="s">
          {message && (
            <Alert type={message.type === 'error' ? 'error' : (message.type === 'success' ? 'success' : 'info')} onDismiss={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
          {content}
        </SpaceBetween>
      </BoardItem>
    );
  }

  return (
    <Container header={headerEl}>
      <SpaceBetween size="s">
        {message && (
          <Alert type={message.type === 'error' ? 'error' : (message.type === 'success' ? 'success' : 'info')} onDismiss={() => setMessage(null)}>
            {message.text}
          </Alert>
        )}
        {content}
      </SpaceBetween>
    </Container>
  );
};

export default TranslationsWidget;
