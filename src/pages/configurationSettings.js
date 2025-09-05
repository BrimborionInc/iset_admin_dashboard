import React, { useEffect, useState, useCallback } from 'react';
import { Button, SpaceBetween, Box, Select, FormField, StatusIndicator, Toggle, ColumnLayout, Input, Multiselect, Header, Badge, Checkbox, Modal, Tabs, Alert } from '@cloudscape-design/components';
import { Board, BoardItem } from '@cloudscape-design/board-components';
import { getIdTokenClaims, getRoleFromClaims, isIamOn, hasValidSession } from '../auth/cognito';
import { apiFetch } from '../auth/apiClient';

// Centralized JSON fetch using apiFetch (ensures correct API base + auth headers)
async function fetchJSON(path, opts) {
  const res = await apiFetch(path, opts);
  const text = await res.text();
  if (!res.ok) {
    // Attempt to parse json error, else include snippet
    try { const j = JSON.parse(text); throw new Error(j.error || j.message || `Request failed ${res.status}`); } catch {
      const snippet = text.slice(0, 120).replace(/\s+/g,' ').trim();
      throw new Error(`Request failed ${res.status}: ${snippet || 'no body'}`);
    }
  };
  try { return JSON.parse(text); } catch {
    const looksHtml = /<!doctype html/i.test(text);
    throw new Error(looksHtml ? 'Received HTML instead of JSON (check API base/port or proxy config)' : 'Invalid JSON response');
  }
}

// Local placeholder list until dynamic fetch resolves
const STATIC_MODEL_PLACEHOLDERS = [
  { label: 'OpenAI GPT-5 (default)', value: 'openai/gpt-5' },
  { label: 'Mistral 7B Instruct (fallback)', value: 'mistralai/mistral-7b-instruct' },
  { label: 'GPT-4.1 Mini', value: 'openai/gpt-4.1-mini' },
];

export default function ConfigurationSettings() {
  const [runtime, setRuntime] = useState(null);
  const [security, setSecurity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiModel, setAiModel] = useState(null);
  const [modelOptions, setModelOptions] = useState(STATIC_MODEL_PLACEHOLDERS);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [savingParams, setSavingParams] = useState(false);
  const [savingFallbacks, setSavingFallbacks] = useState(false);
  const [params, setParams] = useState({ temperature: 0.7, top_p: 1, max_tokens: '', presence_penalty: 0, frequency_penalty: 0 });
  const [fallbacks, setFallbacks] = useState([]); // array of {label,value}
  const [error, setError] = useState(null);
  const [role, setRole] = useState('');
  const [darkMode, setDarkMode] = useState(false); // placeholder formerly on visual settings
  // Auth Phase 4 multi-scope state: separate Admin vs Applicants ("public")
  // Each scope gets its own session/token TTL edits and policy edits
  const [authSessionAdminOriginal, setAuthSessionAdminOriginal] = useState(null);
  const [authSessionAdminEdits, setAuthSessionAdminEdits] = useState(null);
  const [authSessionPublicOriginal, setAuthSessionPublicOriginal] = useState(null);
  const [authSessionPublicEdits, setAuthSessionPublicEdits] = useState(null);
  const [savingAuthSessionScope, setSavingAuthSessionScope] = useState({}); // { admin: bool, public: bool }
  const [authPolicyAdminOriginal, setAuthPolicyAdminOriginal] = useState(null);
  const [authPolicyAdminEdits, setAuthPolicyAdminEdits] = useState(null);
  const [authPolicyPublicOriginal, setAuthPolicyPublicOriginal] = useState(null);
  const [authPolicyPublicEdits, setAuthPolicyPublicEdits] = useState(null);
  const [savingAuthPolicyScope, setSavingAuthPolicyScope] = useState({}); // { admin: bool, public: bool }
  const [syncingFederationScope, setSyncingFederationScope] = useState({}); // { admin: bool, public: bool }
  const [authTab, setAuthTab] = useState('admin');
  // Auth Phase 4 state (claims mapping viewer)
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [claimsModalContent, setClaimsModalContent] = useState('');

  // Derive role (lightweight; no backend enforcement here yet)
  useEffect(() => {
      function deriveRole() {
        if (isIamOn() && hasValidSession()) {
          try {
            const claims = getIdTokenClaims();
            const r = getRoleFromClaims(claims) || '';
            setRole(r);
            return;
          } catch {/* ignore */}
        }
        try {
          const signedOut = sessionStorage.getItem('simulateSignedOut') === 'true';
          if (signedOut) { setRole('Signed Out'); return; }
          const raw = sessionStorage.getItem('currentRole');
          if (raw) {
            const obj = JSON.parse(raw);
            if (obj && obj.value) { setRole(obj.value); return; }
          }
        } catch {/* ignore */}
        setRole('Program Administrator');
      }
      deriveRole();
  }, []);

  // Capability gates
  const canEditAI = role === 'System Administrator';
  const canEditAuth = role === 'System Administrator';
  const visibility = security?.visibility;
  const canSeeAny = visibility === 'admin' || visibility === 'restricted';
  const fullyAdmin = visibility === 'admin';

  // Layout items
  const defaultBoardItems = React.useMemo(() => ([
    { id: 'ai', columnSpan: 2, rowSpan: 4, data: { type: 'ai' } },
    { id: 'auth', columnSpan: 2, rowSpan: 4, data: { type: 'auth' } },
  { id: 'linkage', columnSpan: 2, rowSpan: 3, data: { type: 'linkage' } },
  { id: 'sessionAudit', columnSpan: 2, rowSpan: 3, data: { type: 'sessionAudit' } },
    { id: 'cors', columnSpan: 2, rowSpan: 4, data: { type: 'cors' } },
    { id: 'env', columnSpan: 2, rowSpan: 2, data: { type: 'env' } },
    { id: 'secrets', columnSpan: 2, rowSpan: 3, data: { type: 'secrets' } },
    { id: 'appearance', columnSpan: 2, rowSpan: 2, data: { type: 'appearance' } }
  ]), []);
  const [boardItems, setBoardItems] = useState(defaultBoardItems);
  const resetLayout = () => setBoardItems(defaultBoardItems);
  // Phase 5 linkage stats
  const [linkage, setLinkage] = useState(null);
  // Session audit stats
  const [auditStats, setAuditStats] = useState(null);
  const [auditRecent, setAuditRecent] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const fetchAudit = useCallback(async () => {
    setAuditLoading(true); setAuditError(null);
    try {
      const stats = await fetchJSON('/api/audit/session/stats');
      const recent = await fetchJSON('/api/audit/session/recent?limit=25');
      setAuditStats(stats);
      setAuditRecent(recent.sessions || []);
    } catch(e){ setAuditError(e.message); }
    finally { setAuditLoading(false); }
  }, []);
  useEffect(() => { fetchAudit(); }, [fetchAudit]);
  const [linkageError, setLinkageError] = useState(null);
  const [linkageLoading, setLinkageLoading] = useState(false);
  const fetchLinkage = useCallback(async () => {
    setLinkageLoading(true); setLinkageError(null);
    try {
      const data = await fetchJSON('/api/admin/linkage-stats');
      setLinkage(data);
    } catch (e) { setLinkageError(e.message); }
    finally { setLinkageLoading(false); }
  }, []);
  useEffect(() => { fetchLinkage(); }, [fetchLinkage]);

    // Missing helpers from prior corruption: load + AI save handlers
    const load = useCallback(async () => {
      setLoading(true); setError(null);
      try {
        const [r, s] = await Promise.all([
          fetchJSON('/api/config/runtime'),
          fetchJSON('/api/config/security')
        ]);
        setRuntime(r); setSecurity(s);
        if (r?.ai?.model) {
          setAiModel({ label: r.ai.model, value: r.ai.model });
        }
        if (r?.ai?.params) {
          // Sanitize null/undefined values to avoid rendering "null" in number inputs
          const cleaned = {};
          const defaults = { temperature: 0.7, top_p: 1, presence_penalty: 0, frequency_penalty: 0 };
          Object.entries(r.ai.params).forEach(([k, v]) => {
            if (v === null || v === undefined) {
              if (k === 'max_tokens') cleaned[k] = ''; else cleaned[k] = defaults[k] != null ? defaults[k] : '';
            } else {
              cleaned[k] = v;
            }
          });
          setParams(p => ({ ...p, ...cleaned }));
        }
        if (Array.isArray(r?.ai?.fallbackModels)) {
          setFallbacks(r.ai.fallbackModels.map(m => ({ label: m, value: m })));
        }
        // Initialize auth scope originals if available
        const tokenTtl = r?.auth?.tokenTtl || {};
        const sessionTemplate = t => ({ access: t.access || '', id: t.id || '', refresh: t.refresh || '', frontendIdle: t.frontendIdle || '', absolute: t.absolute || '' });
        const ttlCommon = sessionTemplate(tokenTtl);
        setAuthSessionAdminOriginal(ttlCommon); setAuthSessionAdminEdits(ttlCommon);
        setAuthSessionPublicOriginal(ttlCommon); setAuthSessionPublicEdits(ttlCommon);
        const policyTemplate = auth => ({
          mfaMode: auth?.mfa?.mode || auth?.mfaMode || 'off',
          pkceRequired: !!(auth?.pkceRequired),
          passwordPolicy: {
            minLength: auth?.passwordPolicy?.minLength || 8,
            requireUpper: !!auth?.passwordPolicy?.requireUpper,
            requireLower: !!auth?.passwordPolicy?.requireLower,
            requireNumber: !!auth?.passwordPolicy?.requireNumber,
              requireSymbol: !!auth?.passwordPolicy?.requireSymbol
          },
          lockout: {
            threshold: auth?.lockout?.threshold || 5,
            durationSeconds: auth?.lockout?.durationSeconds || 900
          },
          federation: {
            providers: auth?.federation?.providers || [],
            lastSync: auth?.federation?.lastSync || null
          },
          // Public-only fields appear on both templates (default if absent) but only rendered for Applicants tab
          maxPasswordResetsPerDay: auth?.maxPasswordResetsPerDay != null ? auth.maxPasswordResetsPerDay : 5,
          anomalyProtection: auth?.anomalyProtection || 'standard'
        });
        const baseAuth = r?.auth || {};
        const adminPolicy = policyTemplate(baseAuth);
        const publicPolicy = policyTemplate(baseAuth);
        setAuthPolicyAdminOriginal(adminPolicy); setAuthPolicyAdminEdits(adminPolicy);
        setAuthPolicyPublicOriginal(publicPolicy); setAuthPolicyPublicEdits(publicPolicy);
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, []);

  useEffect(() => { load(); }, [load]);

    async function saveModel() {
      if (!aiModel) return; setSavingModel(true); setError(null);
      try {
        const body = { model: aiModel.value };
        const r = await fetchJSON('/api/config/runtime/ai-model', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        setRuntime(o => ({ ...(o||{}), ai: { ...(o?.ai||{}), model: r.model || body.model } }));
      } catch (e) { setError(e.message); } finally { setSavingModel(false); }
    }
    async function saveParams() {
      setSavingParams(true); setError(null);
      try {
        const body = { params };
        const r = await fetchJSON('/api/config/runtime/ai-params', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        setRuntime(o => ({ ...(o||{}), ai: { ...(o?.ai||{}), params: r.params || body.params } }));
      } catch (e) { setError(e.message); } finally { setSavingParams(false); }
    }
    async function saveFallbacks() {
      setSavingFallbacks(true); setError(null);
      try {
        const body = { fallbackModels: fallbacks.map(f => f.value) };
        const r = await fetchJSON('/api/config/runtime/ai-fallbacks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        setRuntime(o => ({ ...(o||{}), ai: { ...(o?.ai||{}), fallbackModels: r.fallbackModels || body.fallbackModels } }));
      } catch (e) { setError(e.message); } finally { setSavingFallbacks(false); }
    }

  function numberInput(key, min, max, step = 'any') {
    const raw = params[key];
    const value = raw === null || raw === undefined ? '' : raw === '' ? '' : String(raw);
    return (
      <Input
        type="number"
        value={value}
        step={step}
        onChange={e => {
          const v = e.detail.value;
          setParams(p => ({ ...p, [key]: v === '' ? '' : Number(v) }));
        }}
        disabled={!canEditAI}
        inputMode="decimal"
        ariaLabel={key}
        placeholder="auto"
        constraintText={`Range ${min} to ${max}`}
      />
    );
  }

  // Auth rendering (separate to keep switch simple)
  function renderAuth() {
    const authSingle = runtime?.auth || null;
    if (!authSingle) return <Box fontSize="body-s" color="text-status-inactive">Auth configuration unavailable.</Box>;
    const authAdmin = runtime?.authAdmin || authSingle?.admin || authSingle;
    const authPublic = runtime?.authPublic || authSingle?.public || authSingle;
    function maskClient(id) { if (!id) return ''; if (id.includes('*')) return id; if (id.length <= 6) return id[0] + '*'.repeat(Math.max(0, id.length - 2)) + id.slice(-1); return id.slice(0,4)+'*'.repeat(id.length-6)+id.slice(-2); }
    const scopeState = scope => ({
      authObj: scope === 'admin' ? authAdmin : authPublic,
      sessionOriginal: scope === 'admin' ? authAdmin : authPublic,
      sessionEdits: scope === 'admin' ? authSessionAdminEdits : authSessionPublicEdits,
      setSessionEdits: scope === 'admin' ? setAuthSessionAdminEdits : setAuthSessionPublicEdits,
        policyOriginal: scope === 'admin' ? authPolicyAdminOriginal : authPolicyPublicOriginal,
      policyEdits: scope === 'admin' ? authPolicyAdminEdits : authPolicyPublicEdits,
      setPolicyEdits: scope === 'admin' ? setAuthPolicyAdminEdits : setAuthPolicyPublicEdits,
      savingSession: !!savingAuthSessionScope[scope],
      savingPolicy: !!savingAuthPolicyScope[scope],
      syncingFederation: !!syncingFederationScope[scope]
    });
    const ttlInput = (scope, field, label, help) => {
      const { sessionEdits, setSessionEdits, savingSession } = scopeState(scope);
      if (!sessionEdits) return null;
      return (
        <FormField label={label} description={help} constraintText="Seconds (integer)">
          <Input
            type="number"
            value={sessionEdits[field] === '' ? '' : String(sessionEdits[field])}
            onChange={e => setSessionEdits(ed => ({ ...ed, [field]: e.detail.value === '' ? '' : Number(e.detail.value) }))}
            disabled={!canEditAuth || savingSession}
            placeholder="default"
          />
        </FormField>
      );
    };
    const isSessionDirty = scope => {
      const { sessionOriginal, sessionEdits } = scopeState(scope);
      return !!(sessionOriginal && sessionEdits && (
        sessionOriginal.access !== sessionEdits.access ||
        sessionOriginal.id !== sessionEdits.id ||
        sessionOriginal.refresh !== sessionEdits.refresh ||
  sessionOriginal.frontendIdle !== sessionEdits.frontendIdle ||
  sessionOriginal.absolute !== sessionEdits.absolute
      ));
    };
    const isPolicyDirty = scope => {
      const { policyOriginal, policyEdits } = scopeState(scope);
      return !!(policyOriginal && policyEdits && (
        policyOriginal.mfaMode !== policyEdits.mfaMode ||
        policyOriginal.pkceRequired !== policyEdits.pkceRequired ||
        policyOriginal.passwordPolicy.minLength !== policyEdits.passwordPolicy.minLength ||
        policyOriginal.passwordPolicy.requireUpper !== policyEdits.passwordPolicy.requireUpper ||
        policyOriginal.passwordPolicy.requireLower !== policyEdits.passwordPolicy.requireLower ||
        policyOriginal.passwordPolicy.requireNumber !== policyEdits.passwordPolicy.requireNumber ||
        policyOriginal.passwordPolicy.requireSymbol !== policyEdits.passwordPolicy.requireSymbol ||
        policyOriginal.lockout.threshold !== policyEdits.lockout.threshold ||
  policyOriginal.lockout.durationSeconds !== policyEdits.lockout.durationSeconds ||
  policyOriginal.maxPasswordResetsPerDay !== policyEdits.maxPasswordResetsPerDay ||
  policyOriginal.anomalyProtection !== policyEdits.anomalyProtection
      ));
    };
    const saveSession = async scope => {
      if (!isSessionDirty(scope)) return;
      const { sessionEdits } = scopeState(scope);
      if (!sessionEdits) return;
      try {
        setSavingAuthSessionScope(s => ({ ...s, [scope]: true }));
        const body = { tokenTtl: sessionEdits };
        const pathBase = '/api/config/runtime/auth-session';
        let resp;
        try {
          resp = await fetchJSON(`${pathBase}?scope=${scope}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
        } catch (e) {
          if (/404/.test(e.message)) resp = await fetchJSON(pathBase, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); else throw e;
        }
        setRuntime(r => ({ ...(r||{}), auth:{ ...(r?.auth||{}), tokenTtl:{ ...(resp?.tokenTtl||sessionEdits) } } }));
        if (scope === 'admin') setAuthSessionAdminOriginal(sessionEdits); else setAuthSessionPublicOriginal(sessionEdits);
      } catch(e) { setError(e.message); } finally {
        setSavingAuthSessionScope(s => ({ ...s, [scope]: false }));
      }
    };
    const discardSession = scope => {
      if (scope === 'admin' && authSessionAdminOriginal) setAuthSessionAdminEdits(authSessionAdminOriginal);
      if (scope === 'public' && authSessionPublicOriginal) setAuthSessionPublicEdits(authSessionPublicOriginal);
    };
    const savePolicy = async scope => {
      if (!isPolicyDirty(scope)) return;
      const { policyEdits } = scopeState(scope);
      if (!policyEdits) return;
      try {
        setSavingAuthPolicyScope(s => ({ ...s, [scope]: true }));
        const body = { mfa:{ mode: policyEdits.mfaMode }, passwordPolicy: policyEdits.passwordPolicy, lockout: policyEdits.lockout, pkceRequired: policyEdits.pkceRequired };
        if (scope === 'public') {
          body.maxPasswordResetsPerDay = policyEdits.maxPasswordResetsPerDay;
          body.anomalyProtection = policyEdits.anomalyProtection;
        }
        const pathBase = '/api/config/runtime/auth-policy';
        let resp;
        try {
          resp = await fetchJSON(`${pathBase}?scope=${scope}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
        } catch (e) {
          if (/404/.test(e.message)) resp = await fetchJSON(pathBase, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)}); else throw e;
        }
  setRuntime(r => ({ ...(r||{}), auth:{ ...(r?.auth||{}), mfa: resp?.mfa || { mode: body.mfa.mode }, passwordPolicy: resp?.passwordPolicy || body.passwordPolicy, lockout: resp?.lockout || body.lockout, pkceRequired: resp?.pkceRequired !== undefined ? resp.pkceRequired : body.pkceRequired } }));
        if (scope === 'admin') setAuthPolicyAdminOriginal(policyEdits); else setAuthPolicyPublicOriginal(policyEdits);
      } catch(e) { setError(e.message); } finally {
        setSavingAuthPolicyScope(s => ({ ...s, [scope]: false }));
      }
    };
    const discardPolicy = scope => {
      if (scope === 'admin' && authPolicyAdminOriginal) setAuthPolicyAdminEdits(authPolicyAdminOriginal);
      if (scope === 'public' && authPolicyPublicOriginal) setAuthPolicyPublicEdits(authPolicyPublicOriginal);
    };
    const syncFederation = async scope => {
      const { policyEdits } = scopeState(scope);
      if (!policyEdits) return;
      try {
        setSyncingFederationScope(s => ({ ...s, [scope]: true }));
        const resp = await fetchJSON('/api/config/runtime/auth-federation-sync', { method:'POST' });
        const lastSync = resp.lastSync || new Date().toISOString();
        const setPolicyEditsFn = scope === 'admin' ? setAuthPolicyAdminEdits : setAuthPolicyPublicEdits;
        setPolicyEditsFn(p => ({ ...p, federation: { ...p.federation, lastSync } }));
      } catch(e) { setError(e.message); } finally {
        setSyncingFederationScope(s => ({ ...s, [scope]: false }));
      }
    };
    const openClaimsModal = () => {
      const mapping = authAdmin.claimsMapping || authAdmin.claims_map || authAdmin.customClaimsMapping || null;
      if (mapping) {
        try { setClaimsModalContent(JSON.stringify(mapping, null, 2)); } catch { setClaimsModalContent('Could not serialize claims mapping.'); }
      } else setClaimsModalContent('No claims mapping available.');
      setShowClaimsModal(true);
    };
    const renderSession = scope => {
      const dirty = isSessionDirty(scope);
      const { sessionEdits } = scopeState(scope);
      if (!sessionEdits) return null;
      const saving = !!savingAuthSessionScope[scope];
      return (
        <SpaceBetween size="xs">
          <Box fontSize="heading-xs" variant="h4">Session / Token Lifetimes {dirty && <Badge color="blue">Unsaved</Badge>}</Box>
          <ColumnLayout columns={5} variant="text-grid">
            {ttlInput(scope,'access','Access Token','JWT access TTL')}
            {ttlInput(scope,'id','ID Token','ID token TTL')}
            {ttlInput(scope,'refresh','Refresh Token','Refresh token max age')}
            {ttlInput(scope,'frontendIdle','Frontend Idle','Inactivity logout threshold')}
            {ttlInput(scope,'absolute','Absolute Session','Max session lifetime')}
          </ColumnLayout>
          {sessionEdits.absolute && sessionEdits.frontendIdle && Number(sessionEdits.frontendIdle) > Number(sessionEdits.absolute) && (
            <Alert type="warning" header="Idle timeout exceeds absolute session">Idle timeout should be lower than absolute session lifetime.</Alert>
          )}
          {canEditAuth && (
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => saveSession(scope)} loading={saving} disabled={!dirty || saving}>Save TTLs</Button>
              <Button variant="link" onClick={() => discardSession(scope)} disabled={!dirty || saving}>Discard</Button>
            </SpaceBetween>
          )}
        </SpaceBetween>
      );
    };
    const renderPolicy = scope => {
      const dirty = isPolicyDirty(scope);
      const { policyEdits, syncingFederation } = scopeState(scope);
      if (!policyEdits) return null;
      const saving = !!savingAuthPolicyScope[scope];
      const charClasses = ['requireUpper','requireLower','requireNumber','requireSymbol'].filter(k => policyEdits.passwordPolicy[k]).length;
      const pwWeak = policyEdits.passwordPolicy.minLength < 12 || charClasses < 3;
      return (
        <SpaceBetween size="xs">
          <Box fontSize="heading-xs" variant="h4">Authentication Policy {dirty && <Badge color="blue">Unsaved</Badge>}</Box>
          {pwWeak && (
            <Alert statusIconAriaLabel="Warning" type="warning" header="Password policy below recommended guardrails">
              Recommended: min length 12+, at least 3 of 4 character categories, lockout threshold 5-10 attempts.
            </Alert>
          )}
          <ColumnLayout columns={4} variant="text-grid">
            <FormField label="MFA Mode" description="off / optional / required">
              <Select
                selectedOption={policyEdits.mfaMode ? { label: policyEdits.mfaMode, value: policyEdits.mfaMode } : null}
                onChange={e => canEditAuth && scopeState(scope).setPolicyEdits(p => ({ ...p, mfaMode: e.detail.selectedOption?.value || '' }))}
                options={['off','optional','required'].map(v => ({ label: v, value: v }))}
                disabled={!canEditAuth || saving}
                placeholder="Select mode"
              />
            </FormField>
            <FormField label="Min Password Length">
              <Input type="number" value={String(policyEdits.passwordPolicy.minLength)} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, passwordPolicy: { ...p.passwordPolicy, minLength: Number(e.detail.value)||0 } }))} disabled={!canEditAuth || saving} />
            </FormField>
            <FormField label="Lockout Threshold" description="Failed attempts">
              <Input type="number" value={String(policyEdits.lockout.threshold)} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, lockout: { ...p.lockout, threshold: Number(e.detail.value)||0 } }))} disabled={!canEditAuth || saving} />
            </FormField>
            <FormField label="Lockout Duration" description="Seconds">
              <Input type="number" value={String(policyEdits.lockout.durationSeconds)} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, lockout: { ...p.lockout, durationSeconds: Number(e.detail.value)||0 } }))} disabled={!canEditAuth || saving} />
            </FormField>
          </ColumnLayout>
          <ColumnLayout columns={scope === 'public' ? 7 : 5} variant="text-grid">
            <FormField label="Uppercase" description="Require upper-case letter"><Checkbox checked={policyEdits.passwordPolicy.requireUpper} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, passwordPolicy: { ...p.passwordPolicy, requireUpper: e.detail.checked } }))} disabled={!canEditAuth || saving}>Uppercase</Checkbox></FormField>
            <FormField label="Lowercase"><Checkbox checked={policyEdits.passwordPolicy.requireLower} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, passwordPolicy: { ...p.passwordPolicy, requireLower: e.detail.checked } }))} disabled={!canEditAuth || saving}>Lowercase</Checkbox></FormField>
            <FormField label="Number"><Checkbox checked={policyEdits.passwordPolicy.requireNumber} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, passwordPolicy: { ...p.passwordPolicy, requireNumber: e.detail.checked } }))} disabled={!canEditAuth || saving}>Number</Checkbox></FormField>
            <FormField label="Symbol"><Checkbox checked={policyEdits.passwordPolicy.requireSymbol} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, passwordPolicy: { ...p.passwordPolicy, requireSymbol: e.detail.checked } }))} disabled={!canEditAuth || saving}>Symbol</Checkbox></FormField>
            <FormField label="PKCE Required"><Toggle checked={policyEdits.pkceRequired} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, pkceRequired: e.detail.checked }))} disabled={!canEditAuth || saving}>PKCE</Toggle></FormField>
            {scope === 'public' && (
              <FormField label="Max Password Resets / Day" description="Public scope only">
                <Input type="number" value={String(policyEdits.maxPasswordResetsPerDay)} onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, maxPasswordResetsPerDay: Number(e.detail.value)||0 }))} disabled={!canEditAuth || saving} />
              </FormField>
            )}
            {scope === 'public' && (
              <FormField label="Anomaly Protection" description="Risk-based adaptive security">
                <Select
                  selectedOption={policyEdits.anomalyProtection ? { label: policyEdits.anomalyProtection, value: policyEdits.anomalyProtection } : null}
                  onChange={e => scopeState(scope).setPolicyEdits(p => ({ ...p, anomalyProtection: e.detail.selectedOption?.value || 'standard' }))}
                  options={['standard','strict'].map(v => ({ label: v, value: v }))}
                  disabled={!canEditAuth || saving}
                  placeholder="Select"
                />
              </FormField>
            )}
          </ColumnLayout>
          {/* Guardrail alerts placed after form fields for layout clarity */}
          {scope === 'public' && policyEdits.maxPasswordResetsPerDay > 20 && (
            <Alert type="warning" header="High password reset allowance">Consider lowering max daily resets to reduce enumeration risk.</Alert>
          )}
          {policyEdits.lockout.threshold > 10 && (
            <Alert type="warning" header="Lockout threshold higher than guideline">CCCS heuristic recommends 5-10 attempts before lockout.</Alert>
          )}
          {policyEdits.lockout.durationSeconds < 300 && (
            <Alert type="warning" header="Lockout duration below 300s">Short duration reduces effectiveness of brute force mitigation.</Alert>
          )}
          {policyEdits.federation.providers.length > 0 && (
            <SpaceBetween size="xxs">
              <Box fontSize="heading-xs" variant="h4">Federation Providers</Box>
              <SpaceBetween size="xxs">{policyEdits.federation.providers.map((pv, idx) => <Box key={`prov-${idx}-${pv}` } fontSize="body-s">{pv}</Box>)}</SpaceBetween>
              <Box fontSize="body-s" color="text-status-inactive">Last Sync: {policyEdits.federation.lastSync || 'n/a'}</Box>
              {canEditAuth && (
                <Button size="small" onClick={() => syncFederation(scope)} loading={syncingFederation}>Sync Federation</Button>
              )}
            </SpaceBetween>
          )}
          {scope === 'admin' && (authAdmin.claimsMapping || authAdmin.claims_map || authAdmin.customClaimsMapping) && (
            <Button onClick={openClaimsModal} variant="normal" iconName="view">View Claims Mapping</Button>
          )}
          {canEditAuth && (
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => savePolicy(scope)} loading={saving} disabled={!dirty || saving}>Save Policy</Button>
              <Button variant="link" onClick={() => discardPolicy(scope)} disabled={!dirty || saving}>Discard</Button>
            </SpaceBetween>
          )}
        </SpaceBetween>
      );
    };
    const ScopeSummary = ({ scope }) => {
      const { authObj } = scopeState(scope);
      if (!authObj) return <Box fontSize="body-s" color="text-status-inactive">Unavailable</Box>;
      const issuer = authObj.issuer || authObj.iss;
      const domain = authObj.domain || authObj.domainUrl || '';
      const region = authObj.region || authObj.awsRegion || '';
      const scopes = Array.isArray(authObj.scopes) ? authObj.scopes : (typeof authObj.scopes === 'string' ? authObj.scopes.split(/[\s,]+/) : []);
      const rawClientId = authObj.clientIdMasked || authObj.clientId || '';
      const redirects = authObj.redirects || {};
      const callbackUris = Array.isArray(redirects.callback) ? redirects.callback : [];
      const logoutUris = Array.isArray(redirects.postLogout) ? redirects.postLogout : [];
      const clientIdDisplay = maskClient(rawClientId);
      return (
        <SpaceBetween size="xs">
          <SpaceBetween size="xxs">
            <Box>Provider: <strong>{authObj.provider || 'Unknown'}</strong></Box>
            {issuer && <Box>Issuer: <span style={{wordBreak:'break-all'}}>{issuer}</span></Box>}
            {domain && <Box>Domain: {domain}</Box>}
            {region && <Box>Region: {region}</Box>}
            {rawClientId && <Box>Client ID: {clientIdDisplay}</Box>}
            {!!scopes.length && <Box>Scopes: {scopes.join(', ')}</Box>}
            {authObj.devBypass && <StatusIndicator type="warning">Dev auth bypass active</StatusIndicator>}
            {authObj.audit && (authObj.audit.updatedAt || authObj.audit.updatedBy) && (
              <Box fontSize="body-s" color="text-status-inactive">Last Change: {authObj.audit.updatedAt || 'unknown'}{authObj.audit.updatedBy ? ` by ${authObj.audit.updatedBy}` : ''}</Box>
            )}
          </SpaceBetween>
          {renderSession(scope)}
          {renderPolicy(scope)}
          {(callbackUris.length > 0 || logoutUris.length > 0) && (
            <SpaceBetween size="xs">
              <Box fontSize="heading-xs" variant="h4">Redirect URIs</Box>
              {callbackUris.length > 0 && (
                <FormField label="Callback URIs" description="Registered OAuth2 redirect endpoints (read-only)">
                  <SpaceBetween size="xxs">
                    {callbackUris.map((u, idx) => <Box key={`cb-${idx}`} fontSize="body-s" style={{wordBreak:'break-all'}}>{u}</Box>)}
                  </SpaceBetween>
                </FormField>
              )}
              {logoutUris.length > 0 && (
                <FormField label="Post Logout URIs" description="Where the IdP may redirect after sign-out">
                  <SpaceBetween size="xxs">
                    {logoutUris.map((u, idx) => <Box key={`lo-${idx}`} fontSize="body-s" style={{wordBreak:'break-all'}}>{u}</Box>)}
                  </SpaceBetween>
                </FormField>
              )}
            </SpaceBetween>
          )}
        </SpaceBetween>
      );
    };
    return (
      <Tabs
        activeTabId={authTab}
        onChange={e => setAuthTab(e.detail.activeTabId)}
        tabs={[
          { id: 'admin', label: 'Admin', content: <ScopeSummary scope="admin" /> },
          { id: 'public', label: 'Applicants', content: <ScopeSummary scope="public" /> }
        ]}
      />
    );
  }

  function renderBoardContent(type) {
    switch (type) {
      case 'ai':
        return (
          <SpaceBetween size="s">
            <FormField label="Default Model" description="Primary model used when no per-request override is provided.">
              <Select
                selectedOption={aiModel}
                onChange={e => canEditAI && setAiModel(e.detail.selectedOption)}
                options={modelOptions}
                filteringType="auto"
                statusType={modelsLoading ? 'loading' : 'finished'}
                disabled={!canEditAI}
                placeholder="Select model"
              />
            </FormField>
            {canEditAI && <Button loading={savingModel} onClick={saveModel} disabled={!aiModel}>Save Model</Button>}
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Temperature" description="0=deterministic, higher=creative">{numberInput('temperature', 0, 2, 0.1)}</FormField>
              <FormField label="Top P" description="Nucleus sampling">{numberInput('top_p', 0, 1, 0.01)}</FormField>
              <FormField label="Max Tokens" description="Blank for provider default">
                <Input type="number" value={params.max_tokens === '' ? '' : String(params.max_tokens)} onChange={e => setParams(p => ({ ...p, max_tokens: e.detail.value === '' ? '' : Number(e.detail.value) }))} disabled={!canEditAI} placeholder="auto" />
              </FormField>
            </ColumnLayout>
            <ColumnLayout columns={3} variant="text-grid">
              <FormField label="Presence Penalty" description="Encourage new topics">{numberInput('presence_penalty', -2, 2, 0.1)}</FormField>
              <FormField label="Frequency Penalty" description="Reduce repetition">{numberInput('frequency_penalty', -2, 2, 0.1)}</FormField>
              <FormField label="Fallback Models" description="Tried in order if primary returns an error (4xx).">
                <Multiselect selectedOptions={fallbacks} onChange={e => canEditAI && setFallbacks(e.detail.selectedOptions)} options={modelOptions.filter(o => !aiModel || o.value !== aiModel.value)} placeholder="Select fallback models" disabled={!canEditAI} tokenLimit={5} />
              </FormField>
            </ColumnLayout>
            {canEditAI && (
              <SpaceBetween direction="horizontal" size="xs">
                <Button loading={savingParams} onClick={saveParams}>Save Parameters</Button>
                <Button loading={savingFallbacks} onClick={saveFallbacks}>Save Fallbacks</Button>
              </SpaceBetween>
            )}
          </SpaceBetween>
        );
      case 'auth':
        return renderAuth();
      case 'linkage':
        return (
          <SpaceBetween size="s">
            {linkageError && <Alert type="error" header="Linkage stats error">{linkageError}</Alert>}
            <SpaceBetween size="xxs">
              <Box fontSize="heading-xs" variant="h4">Applicant Identity Linkage</Box>
              {linkageLoading && <StatusIndicator type="loading">Loading</StatusIndicator>}
              {linkage && (
                <ColumnLayout columns={5} variant="text-grid">
                  <FormField label="Total Users"><Box>{linkage.total}</Box></FormField>
                  <FormField label="Linked (Cognito)"><Box>{linkage.linked}</Box></FormField>
                  <FormField label="Coverage %"><StatusIndicator type={linkage.coveragePct >= 99 ? 'success' : linkage.coveragePct >= 95 ? 'info' : 'pending'}>{linkage.coveragePct}%</StatusIndicator></FormField>
                  <FormField label="Legacy With Password"><StatusIndicator type={linkage.legacyWithPassword === 0 ? 'success' : linkage.legacyWithPassword < 10 ? 'info' : 'warning'}>{linkage.legacyWithPassword}</StatusIndicator></FormField>
                  <FormField label="Active (7d)"><Box>{linkage.recentActive7d}</Box></FormField>
                </ColumnLayout>
              )}
              {linkage && (
                <SpaceBetween size="xxs">
                  {linkage.coveragePct < 99 && (
                    <Alert type="info" header="Linkage Coverage Below Target">Password column removal gated until 99%+ linked.</Alert>
                  )}
                  {linkage.legacyWithPassword > 0 && (
                    <Alert type="warning" header="Legacy Password Hashes Present">Run backfill and confirm audit script passes before dropping column.</Alert>
                  )}
                  {linkage.coveragePct >= 99 && linkage.legacyWithPassword === 0 && (
                    <Alert type="success" header="Ready for Password Column Drop">Meets readiness checklist (coverage ≥99%, zero legacy hashes).</Alert>
                  )}
                </SpaceBetween>
              )}
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={fetchLinkage} loading={linkageLoading}>Refresh</Button>
              </SpaceBetween>
            </SpaceBetween>
          </SpaceBetween>
        );
      case 'sessionAudit':
        return (
          <SpaceBetween size="s">
            {auditError && <Alert type="error" header="Session audit error">{auditError}</Alert>}
            <SpaceBetween size="xxs">
              <Box fontSize="heading-xs" variant="h4">Session Audit</Box>
              {auditLoading && <StatusIndicator type="loading">Loading</StatusIndicator>}
              {auditStats && (
                <ColumnLayout columns={4} variant="text-grid">
                  <FormField label="Total Sessions"><Box>{auditStats.total}</Box></FormField>
                  <FormField label="Active Users 24h"><Box>{auditStats.activeUsers24h}</Box></FormField>
                  <FormField label="Rows (24h)"><Box>{auditStats.rows24h}</Box></FormField>
                  <FormField label="Newest Seen"><Box>{auditStats.newest ? new Date(auditStats.newest).toLocaleString() : '—'}</Box></FormField>
                </ColumnLayout>
              )}
              {auditRecent.length > 0 && (
                <FormField label="Recent Sessions">
                  <SpaceBetween size="xxs">
                    {auditRecent.map(s => (
                      <Box key={s.session_key} fontSize="body-s" color="text-status-inactive">
                        {s.user_id} · {new Date(s.last_seen_at).toLocaleTimeString()} · {s.session_key.slice(0,10)}…
                      </Box>
                    ))}
                  </SpaceBetween>
                </FormField>
              )}
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={fetchAudit} loading={auditLoading}>Refresh</Button>
                <Button iconName="close" onClick={async () => { try { await fetchJSON('/api/audit/session/prune?days=60', { method:'POST' }); fetchAudit(); } catch(e){ setAuditError(e.message);} }} disabled={auditLoading}>Prune &lt;60d</Button>
              </SpaceBetween>
            </SpaceBetween>
          </SpaceBetween>
        );
      case 'cors':
        return runtime && (<SpaceBetween size="xs">{(runtime.cors?.allowedOrigins || []).map(o => <Box key={o}>{o}</Box>)}</SpaceBetween>);
      case 'env':
        return runtime && <Box>NODE_ENV: {runtime.env?.nodeEnv}</Box>;
      case 'secrets':
        return security && canSeeAny ? (
          <SpaceBetween size="xs">
            {security.secrets.map(s => (
              <Box key={s.key}>{s.key}: {s.present ? s.masked : <i>missing</i>}</Box>
            ))}
            {!fullyAdmin && <Box fontSize="body-s" color="text-status-info">Additional privileges required to view fuller detail.</Box>}
          </SpaceBetween>
        ) : <Box fontSize="body-s" color="text-status-inactive">Insufficient role to view secrets.</Box>;
      case 'appearance':
        return (
          <SpaceBetween size="s">
            <Box fontSize="body-s" color="text-status-info">Dark mode preference (scaffold only).</Box>
            <Toggle checked={darkMode} onChange={e => setDarkMode(e.detail.checked)}>Dark Mode</Toggle>
          </SpaceBetween>
        );
      default:
        return <Box>Unknown widget</Box>;
    }
  }

  const boardI18n = {
    empty: 'No widgets',
    loading: 'Loading',
    columnAriaLabel: i => `Column ${i + 1}`,
    itemPositionAnnouncement: e => {
      const { currentIndex, currentColumn, currentRow } = e;
      return `Item moved to position ${currentIndex + 1}, column ${currentColumn + 1}, row ${currentRow + 1}`;
    },
    liveAnnouncementDndStarted: e => `Picked up item at position ${e.position + 1}.`,
    liveAnnouncementDndItemReordered: e => `Item moved from position ${e.initialPosition + 1} to ${e.currentPosition + 1}.`,
    liveAnnouncementDndItemResized: e => `Item resized to ${e.size.width} by ${e.size.height}.`,
    liveAnnouncementDndItemInserted: e => `Item inserted at position ${e.position + 1}.`,
    liveAnnouncementDndCommitted: e => `Drag and drop committed. Final position ${e.finalPosition != null ? e.finalPosition + 1 : 'unchanged'}.`,
    liveAnnouncementDndDiscarded: () => 'Drag and drop canceled.',
    liveAnnouncementItemRemoved: e => `Removed item at position ${e.position + 1}.`,
  };
  const boardItemI18n = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Press Space or Enter to start dragging the widget',
    dragHandleAriaDescriptionInactive: 'Drag not active',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Press Space or Enter to start resizing the widget',
    resizeHandleAriaDescriptionInactive: 'Resize not active',
    removeItemAriaLabel: 'Remove widget',
    editItemAriaLabel: 'Edit widget',
    dragInactiveItemAriaLabel: 'Draggable widget',
    dragActiveItemAriaLabel: 'Dragging widget',
    resizeInactiveItemAriaLabel: 'Resizable widget',
    resizeActiveItemAriaLabel: 'Resizing widget'
  };

  return (
    <>
      {error && <Box color="text-status-error">{error}</Box>}
      <SpaceBetween size="s">
        <Board
          items={boardItems}
          renderItem={(item, actions) => (
            <BoardItem
              header={
                <Header
                  variant="h2"
                  actions={(() => {
                    if (item.id === 'ai') {
                      return (
                        <SpaceBetween direction="horizontal" size="xs">
                          {runtime?.ai?.model && (
                            <Badge color="blue">{runtime.ai.model}</Badge>
                          )}
                          {runtime?.ai?.enabled != null && (
                            runtime.ai.enabled ? <Badge color="green">Enabled</Badge> : <Badge color="red">Disabled</Badge>
                          )}
                        </SpaceBetween>
                      );
                    }
                    if (item.id === 'auth') {
                      const auth = runtime?.auth || {};
                      const mfaMode = auth.mfa?.mode || auth.mfaMode;
                      const devBypass = !!auth.devBypass;
                      const ssoEnabled = auth.ssoEnabled || auth.sso?.enabled;
                      return (
                        <SpaceBetween direction="horizontal" size="xs">
                          {auth.provider && <Badge color="blue">{auth.provider}</Badge>}
                          {mfaMode && <Badge color="purple">MFA: {mfaMode.toLowerCase()}</Badge>}
                          {ssoEnabled && <Badge color="green">SSO</Badge>}
                          {devBypass && <Badge color="red">Dev Bypass</Badge>}
                          {auth.issuer && (
                            <Button
                              variant="inline-icon"
                              iconName="copy"
                              ariaLabel="Copy issuer URL"
                              onClick={() => navigator?.clipboard?.writeText(auth.issuer).catch(()=>{})}
                            />
                          )}
                          {(auth.issuer || auth.jwksUri) && (
                            <Button
                              variant="inline-icon"
                              iconName="external"
                              ariaLabel="Open JWKS"
                              onClick={() => {
                                const jwks = auth.jwksUri || (auth.issuer ? auth.issuer.replace(/\/$/, '') + '/.well-known/jwks.json' : null);
                                if (jwks) window.open(jwks, '_blank', 'noopener');
                              }}
                            />
                          )}
                          <Button
                            variant="inline-icon"
                            iconName="refresh"
                            ariaLabel="Refresh auth config"
                            onClick={load}
                          />
                        </SpaceBetween>
                      );
                    }
                    return null;
                  })()}
                >
                  {item.id === 'ai'
                    ? 'AI / LLM Configuration'
                    : item.id === 'auth'
                      ? 'Authentication'
                      : item.id === 'linkage'
                        ? 'Cognito Linkage Readiness'
                      : item.id === 'cors'
                        ? 'CORS / Origins'
                        : item.id === 'env'
                          ? 'Environment'
                          : item.id === 'appearance'
                            ? 'Appearance & Theme'
                            : item.id.charAt(0).toUpperCase() + item.id.slice(1)}
                </Header>
              }
              i18nStrings={boardItemI18n}
              {...actions}
            >
              {renderBoardContent(item.data.type)}
            </BoardItem>
          )}
          onItemsChange={e => {
            // Deduplicate by id to avoid duplicate key warnings from accidental duplicates
            const seen = new Set();
            const deduped = [];
            for (const it of e.detail.items) {
              if (!seen.has(it.id)) { seen.add(it.id); deduped.push(it); }
            }
            setBoardItems(deduped);
          }}
          i18nStrings={boardI18n}
          empty={<Box>No widgets</Box>}
          ariaLabel="Configuration widgets board"
        />
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={resetLayout} variant="link">Reset Layout</Button>
        </SpaceBetween>
      </SpaceBetween>
      {showClaimsModal && (
        <Modal
          onDismiss={() => setShowClaimsModal(false)}
          visible={true}
          header="Claims Mapping"
          closeAriaLabel="Close claims mapping"
          size="large"
          footer={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => navigator?.clipboard?.writeText(claimsModalContent).catch(()=>{})} variant="primary">Copy JSON</Button>
              <Button onClick={() => setShowClaimsModal(false)}>Close</Button>
            </SpaceBetween>
          }
        >
          <Box as="pre" fontSize="body-s" style={{ maxHeight: '60vh', overflow: 'auto', margin: 0 }}>{claimsModalContent}</Box>
        </Modal>
      )}
    </>
  );
}