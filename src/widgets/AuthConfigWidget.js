import React from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Tabs,
  SpaceBetween,
  Box,
  ColumnLayout,
  FormField,
  Input,
  Alert,
  Badge,
  Select,
  Checkbox,
  Toggle,
  Button,
  StatusIndicator,
  Header,
  Link,
  ButtonDropdown
} from '@cloudscape-design/components';
import boardItemI18nStrings from './common';

export default function AuthConfigWidget({
  actions,
  metadata,
  toggleHelpPanel,
  headerActions,
  runtime,
  canEditAuth,
  authSessionAdminEdits,
  setAuthSessionAdminEdits,
  authSessionPublicEdits,
  setAuthSessionPublicEdits,
  authPolicyAdminOriginal,
  authPolicyPublicOriginal,
  authPolicyAdminEdits,
  setAuthPolicyAdminEdits,
  authPolicyPublicEdits,
  setAuthPolicyPublicEdits,
  savingAuthSessionScope,
  savingAuthPolicyScope,
  syncingFederationScope,
  setSyncingFederationScope,
  sessionDirty,
  policyDirty,
  setClaimsModalContent,
  setShowClaimsModal,
  fetchJSON,
  setError,
  authTab,
  setAuthTab
}) {
  const authSingle = runtime?.auth || null;

  const handleOpenHelp = () => {
    if (!toggleHelpPanel) return;
    const HelpComponent = metadata?.helpComponent;
    if (!HelpComponent) return;
    const title = metadata?.helpTitle || metadata?.title || 'Authentication';
    const context = metadata?.aiContext || '';
    toggleHelpPanel(<HelpComponent />, title, context);
  };

  const infoLink =
    metadata?.helpComponent && toggleHelpPanel ? (
      <Link variant="info" onClick={handleOpenHelp}>
        Info
      </Link>
    ) : undefined;

  const formatTokenDisplay = (tokenInfo) => {
    if (!tokenInfo) return 'Unavailable';
    const { raw, unit, seconds } = tokenInfo;
    if (raw != null && unit) {
      const plural = raw === 1 ? '' : 's';
      const base = `${raw} ${unit}${plural}`;
      if (seconds != null) {
        return `${base} (${seconds} seconds)`;
      }
      return base;
    }
    if (seconds != null) {
      if (seconds % 86400 === 0) return `${seconds / 86400} days (${seconds} seconds)`;
      if (seconds % 3600 === 0) return `${seconds / 3600} hours (${seconds} seconds)`;
      if (seconds % 60 === 0) return `${seconds / 60} minutes (${seconds} seconds)`;
      return `${seconds} seconds`;
    }
    return 'Unavailable';
  };

  const settingsMenu =
    actions && typeof actions.removeItem === 'function' ? (
      <ButtonDropdown
        ariaLabel="Authentication widget settings"
        variant="icon"
        items={[{ id: 'remove', text: 'Remove widget' }]}
        onItemClick={({ detail }) => {
          if (detail.id === 'remove') {
            actions.removeItem();
          }
        }}
      />
    ) : undefined;

  if (!authSingle) {
    return (
      <BoardItem
        header={
          <Header variant="h2" info={infoLink} actions={headerActions}>
            {metadata?.title || 'Authentication'}
          </Header>
        }
        settings={settingsMenu}
        i18nStrings={boardItemI18nStrings}
      >
        <Box fontSize="body-s" color="text-status-inactive">
          Auth configuration unavailable.
        </Box>
      </BoardItem>
    );
  }

  const authAdmin = runtime?.authAdmin || authSingle?.admin || authSingle;
  const authPublic = runtime?.authPublic || authSingle?.public || authSingle;

  const scopeLookup = scope => {
    const authObj = scope === 'admin' ? authAdmin : authPublic;
    return {
      authObj,
      sessionEdits: scope === 'admin' ? authSessionAdminEdits : authSessionPublicEdits,
      setSessionEdits: scope === 'admin' ? setAuthSessionAdminEdits : setAuthSessionPublicEdits,
      policyOriginal: scope === 'admin' ? authPolicyAdminOriginal : authPolicyPublicOriginal,
      policyEdits: scope === 'admin' ? authPolicyAdminEdits : authPolicyPublicEdits,
      setPolicyEdits: scope === 'admin' ? setAuthPolicyAdminEdits : setAuthPolicyPublicEdits,
      savingSession: !!savingAuthSessionScope[scope],
      savingPolicy: !!savingAuthPolicyScope[scope],
      syncingFederation: !!syncingFederationScope[scope]
    };
  };

  const maskClientId = raw => {
    if (!raw) return '';
    if (raw.includes('*')) return raw;
    if (raw.length <= 4) return `${raw[0]}*`;
    return `${raw.slice(0, 4)}${'*'.repeat(Math.max(1, raw.length - 6))}${raw.slice(-2)}`;
  };

  const handleSyncFederation = async scope => {
    const { policyEdits } = scopeLookup(scope);
    if (!policyEdits) return;
    try {
      setSyncingFederationScope(prev => ({ ...prev, [scope]: true }));
      const response = await fetchJSON('/api/config/runtime/auth-federation-sync', { method: 'POST' });
      const lastSync = response.lastSync || new Date().toISOString();
      const setPolicy = scope === 'admin' ? setAuthPolicyAdminEdits : setAuthPolicyPublicEdits;
      setPolicy(prev => ({
        ...prev,
        federation: { ...(prev.federation || {}), lastSync }
      }));
    } catch (error) {
      setError(error.message);
    } finally {
      setSyncingFederationScope(prev => ({ ...prev, [scope]: false }));
    }
  };

  const handleViewClaims = authObj => {
    const mapping = authObj?.claimsMapping || authObj?.claims_map || authObj?.customClaimsMapping || null;
    if (mapping) {
      try {
        setClaimsModalContent(JSON.stringify(mapping, null, 2));
      } catch {
        setClaimsModalContent('Could not serialize claims mapping.');
      }
    } else {
      setClaimsModalContent('No claims mapping available.');
    }
    setShowClaimsModal(true);
  };

  const renderSessionSection = scope => {
    const { sessionEdits, setSessionEdits, savingSession, authObj } = scopeLookup(scope);
    if (!sessionEdits) {
      return null;
    }
    const dirty = sessionDirty[scope];
    const idleValue = sessionEdits.frontendIdle;
    const absoluteValue = sessionEdits.absolute;
    const tokenFieldsReadonly = scope === 'public';
    const readonlyTokenData = tokenFieldsReadonly ? authObj?.cognitoTokens || null : null;
    const idleExceedsAbsolute =
      idleValue !== '' &&
      idleValue != null &&
      absoluteValue !== '' &&
      absoluteValue != null &&
      Number(idleValue) > Number(absoluteValue);

    const updateField = (field, rawValue) => {
      setSessionEdits(prev => ({
        ...prev,
        [field]: rawValue === '' ? '' : Number(rawValue)
      }));
    };

    const items = [
      (
        <Box key="session-heading" fontSize="heading-xs" variant="h4">
          Session / Token Lifetimes {dirty && <Badge color="blue">Unsaved</Badge>}
        </Box>
      ),
      (
        <ColumnLayout key="session-grid" columns={5} variant="text-grid">
          <FormField
            key="frontendIdle"
            label="Frontend idle timeout"
            description="Inactivity timeout before logout"
            constraintText="Seconds"
          >
            <Input
              type="number"
              value={sessionEdits.frontendIdle === '' ? '' : String(sessionEdits.frontendIdle)}
              onChange={({ detail }) => updateField('frontendIdle', detail.value)}
              disabled={!canEditAuth || savingSession}
              placeholder="default"
            />
          </FormField>
          <FormField
            key="absolute"
            label="Absolute session limit"
            description="Maximum session lifetime"
            constraintText="Seconds"
          >
            <Input
              type="number"
              value={sessionEdits.absolute === '' ? '' : String(sessionEdits.absolute)}
              onChange={({ detail }) => updateField('absolute', detail.value)}
              disabled={!canEditAuth || savingSession}
              placeholder="default"
            />
          </FormField>
          <FormField
            key="access"
            label="Access token"
            description="JWT access token lifetime"
            constraintText={tokenFieldsReadonly ? undefined : 'Seconds'}
          >
            {tokenFieldsReadonly ? (
              <SpaceBetween size="xxs">
                <Box fontSize="body-m">{formatTokenDisplay(readonlyTokenData?.access)}</Box>
                <Box fontSize="body-s" color="text-status-inactive">
                  Managed in Cognito
                </Box>
              </SpaceBetween>
            ) : (
              <Input
                type="number"
                value={sessionEdits.access === '' ? '' : String(sessionEdits.access)}
                onChange={({ detail }) => updateField('access', detail.value)}
                disabled={!canEditAuth || savingSession}
                placeholder="default"
              />
            )}
          </FormField>
          <FormField
            key="id"
            label="ID token"
            description="ID token lifetime"
            constraintText={tokenFieldsReadonly ? undefined : 'Seconds'}
          >
            {tokenFieldsReadonly ? (
              <SpaceBetween size="xxs">
                <Box fontSize="body-m">{formatTokenDisplay(readonlyTokenData?.id)}</Box>
                <Box fontSize="body-s" color="text-status-inactive">
                  Managed in Cognito
                </Box>
              </SpaceBetween>
            ) : (
              <Input
                type="number"
                value={sessionEdits.id === '' ? '' : String(sessionEdits.id)}
                onChange={({ detail }) => updateField('id', detail.value)}
                disabled={!canEditAuth || savingSession}
                placeholder="default"
              />
            )}
          </FormField>
          <FormField
            key="refresh"
            label="Refresh token"
            description="Refresh token maximum age"
            constraintText={tokenFieldsReadonly ? undefined : 'Seconds'}
          >
            {tokenFieldsReadonly ? (
              <SpaceBetween size="xxs">
                <Box fontSize="body-m">{formatTokenDisplay(readonlyTokenData?.refresh)}</Box>
                <Box fontSize="body-s" color="text-status-inactive">
                  Managed in Cognito
                </Box>
              </SpaceBetween>
            ) : (
              <Input
                type="number"
                value={sessionEdits.refresh === '' ? '' : String(sessionEdits.refresh)}
                onChange={({ detail }) => updateField('refresh', detail.value)}
                disabled={!canEditAuth || savingSession}
                placeholder="default"
              />
            )}
          </FormField>
        </ColumnLayout>
      )
    ];
    if (idleExceedsAbsolute) {
      items.push(
        <Alert key="session-alert" type="warning" header="Idle timeout exceeds absolute session lifetime">
          Set the idle timeout lower than the absolute session limit to avoid immediate logouts.
        </Alert>
      );
    }
    if (dirty && canEditAuth && !savingSession) {
      items.push(
        <Box key="session-dirty" fontSize="body-s" color="text-status-info">
          Pending edits — use Save or Cancel in the widget header to apply changes.
        </Box>
      );
    }
    return <SpaceBetween size="s">{items}</SpaceBetween>;
  };

  const renderPasswordPolicyControls = (scope, policyEdits, setPolicyEdits, disabled) => {
    const updatePasswordPolicy = (field, value) => {
      setPolicyEdits(prev => ({
        ...prev,
        passwordPolicy: {
          ...(prev.passwordPolicy || {}),
          [field]: value
        }
      }));
    };

    return (
      <ColumnLayout columns={5} variant="text-grid">
        <FormField key="requireUpper" label="Require uppercase characters">
          <Checkbox
            checked={!!policyEdits.passwordPolicy.requireUpper}
            onChange={({ detail }) => updatePasswordPolicy('requireUpper', detail.checked)}
            disabled={disabled}
          >
            Uppercase letters
          </Checkbox>
        </FormField>
        <FormField key="requireLower" label="Require lowercase characters">
          <Checkbox
            checked={!!policyEdits.passwordPolicy.requireLower}
            onChange={({ detail }) => updatePasswordPolicy('requireLower', detail.checked)}
            disabled={disabled}
          >
            Lowercase letters
          </Checkbox>
        </FormField>
        <FormField key="requireNumber" label="Require numbers">
          <Checkbox
            checked={!!policyEdits.passwordPolicy.requireNumber}
            onChange={({ detail }) => updatePasswordPolicy('requireNumber', detail.checked)}
            disabled={disabled}
          >
            Numeric characters
          </Checkbox>
        </FormField>
        <FormField key="requireSymbol" label="Require symbols">
          <Checkbox
            checked={!!policyEdits.passwordPolicy.requireSymbol}
            onChange={({ detail }) => updatePasswordPolicy('requireSymbol', detail.checked)}
            disabled={disabled}
          >
            Symbol characters
          </Checkbox>
        </FormField>
        <FormField key="pkceRequired" label="PKCE required">
          <Toggle
            checked={!!policyEdits.pkceRequired}
            onChange={({ detail }) =>
              setPolicyEdits(prev => ({
                ...prev,
                pkceRequired: detail.checked
              }))
            }
            disabled={disabled}
          >
            PKCE
          </Toggle>
        </FormField>
      </ColumnLayout>
    );
  };

  const boolLabel = (value) => (value ? 'Enabled' : 'Disabled');

  const renderPolicySection = scope => {
    const { policyEdits, setPolicyEdits, savingPolicy, syncingFederation, authObj } = scopeLookup(scope);
    const readonlyPolicy = scope === 'public' ? authObj?.cognitoPolicy : null;
    if (scope === 'public' && readonlyPolicy) {
      const pw = readonlyPolicy.passwordPolicy || {};
      const mfa = readonlyPolicy.mfa || {};
      return (
        <SpaceBetween size="s">
          <Box fontSize="heading-xs" variant="h4">
            Authentication policy (managed in Cognito)
          </Box>
          <SpaceBetween size="xxs">
            <Box>
              <strong>MFA mode:</strong> {mfa.mode || 'unknown'}
            </Box>
            <Box>
              SMS MFA: {boolLabel(mfa.smsEnabled)} · Software token MFA: {boolLabel(mfa.softwareTokenEnabled)}
            </Box>
          </SpaceBetween>
          <SpaceBetween size="xxs">
            <Box>
              <strong>Password policy</strong>
            </Box>
            <Box>Minimum length: {pw.minLength != null ? pw.minLength : 'unknown'}</Box>
            <Box>Requires uppercase: {boolLabel(pw.requireUpper)}</Box>
            <Box>Requires lowercase: {boolLabel(pw.requireLower)}</Box>
            <Box>Requires number: {boolLabel(pw.requireNumber)}</Box>
            <Box>Requires symbol: {boolLabel(pw.requireSymbol)}</Box>
            {pw.temporaryPasswordValidityDays != null && (
              <Box>Temporary password validity: {pw.temporaryPasswordValidityDays} day(s)</Box>
            )}
          </SpaceBetween>
        </SpaceBetween>
      );
    }
    if (!policyEdits) return null;

    const dirty = policyDirty[scope];
    const passwordPolicy = policyEdits.passwordPolicy || {};
    const lockoutConfig = policyEdits.lockout || {};
    const charClassCount =
      (passwordPolicy.requireUpper ? 1 : 0) +
      (passwordPolicy.requireLower ? 1 : 0) +
      (passwordPolicy.requireNumber ? 1 : 0) +
      (passwordPolicy.requireSymbol ? 1 : 0);
    const passwordWeak = (passwordPolicy.minLength || 0) < 12 || charClassCount < 3;

    const setSimpleField = (field, value) => {
      setPolicyEdits(prev => ({
        ...prev,
        [field]: value
      }));
    };

    const updateLockout = (field, value) => {
      setPolicyEdits(prev => ({
        ...prev,
        lockout: {
          ...(prev.lockout || {}),
          [field]: value
        }
      }));
    };

    const items = [
      (
        <Box key="policy-heading" fontSize="heading-xs" variant="h4">
          Authentication policy {dirty && <Badge color="blue">Unsaved</Badge>}
        </Box>
      ),
      passwordWeak ? (
        <Alert key="policy-weak" type="warning" header="Password policy below recommended guardrails">
          Recommended: minimum length 12 and at least three character classes.
        </Alert>
      ) : null,
      (
        <ColumnLayout key="policy-grid" columns={3} variant="text-grid">
          <FormField key="mfaMode" label="MFA requirement">
            <Select
              selectedOption={
                policyEdits.mfaMode ? { label: policyEdits.mfaMode, value: policyEdits.mfaMode } : null
              }
              onChange={({ detail }) => setSimpleField('mfaMode', detail.selectedOption?.value || 'optional')}
              options={[
                { label: 'optional', value: 'optional' },
                { label: 'required', value: 'required' },
                { label: 'disabled', value: 'disabled' }
              ]}
              disabled={!canEditAuth || savingPolicy}
              placeholder="Select MFA mode"
            />
          </FormField>
          <FormField key="minLength" label="Minimum password length" constraintText="Minimum 8, recommended 12">
            <Input
              type="number"
              value={String(passwordPolicy.minLength ?? '')}
              onChange={({ detail }) => setSimpleField('passwordPolicy', {
                ...passwordPolicy,
                minLength: detail.value === '' ? 0 : Number(detail.value)
              })}
              disabled={!canEditAuth || savingPolicy}
            />
          </FormField>
          <FormField key="lockoutThreshold" label="Lockout threshold" constraintText="Recommended 5–10 attempts">
            <Input
              type="number"
              value={String(lockoutConfig.threshold ?? '')}
              onChange={({ detail }) =>
                updateLockout('threshold', detail.value === '' ? 0 : Number(detail.value))
              }
              disabled={!canEditAuth || savingPolicy}
            />
          </FormField>
          <FormField
            key="lockoutDuration"
            label="Lockout duration (seconds)"
            constraintText="Recommended 300+ seconds"
          >
            <Input
              type="number"
              value={String(lockoutConfig.durationSeconds ?? '')}
              onChange={({ detail }) =>
                updateLockout('durationSeconds', detail.value === '' ? 0 : Number(detail.value))
              }
              disabled={!canEditAuth || savingPolicy}
            />
          </FormField>
        </ColumnLayout>
      )
    ];

    const passwordControls = renderPasswordPolicyControls(scope, policyEdits, setPolicyEdits, !canEditAuth || savingPolicy);
    if (passwordControls) {
      items.push(<React.Fragment key="policy-password-controls">{passwordControls}</React.Fragment>);
    }

    if (policyEdits.lockout && policyEdits.lockout.threshold > 10) {
      items.push(
        <Alert key="policy-lockout-threshold" type="warning" header="Lockout threshold above recommended range">
          Consider keeping the threshold between 5 and 10 attempts.
        </Alert>
      );
    }
    if (policyEdits.lockout && policyEdits.lockout.durationSeconds < 300) {
      items.push(
        <Alert key="policy-lockout-duration" type="warning" header="Lockout duration below best practice">
          Durations shorter than 300 seconds reduce brute-force protection.
        </Alert>
      );
    }
    if (policyEdits.federation?.providers?.length > 0) {
      items.push(
        <SpaceBetween key="policy-federation" size="xxs">
          <Box key="federation-heading" fontSize="heading-xs" variant="h4">
            Federation providers
          </Box>
          {policyEdits.federation.providers.map((provider, index) => (
            <Box key={`federation-${index}`} fontSize="body-s">
              {provider}
            </Box>
          ))}
          <Box key="federation-last-sync" fontSize="body-s" color="text-status-inactive">
            Last sync: {policyEdits.federation.lastSync || 'n/a'}
          </Box>
          {canEditAuth && (
            <Button
              key="federation-sync-button"
              size="small"
              loading={syncingFederation}
              onClick={() => handleSyncFederation(scope)}
            >
              Sync federation
            </Button>
          )}
        </SpaceBetween>
      );
    }
    if (scope === 'admin' && (authObj?.claimsMapping || authObj?.claims_map || authObj?.customClaimsMapping)) {
      items.push(
        <Button key="policy-view-claims" iconName="view" onClick={() => handleViewClaims(authObj)}>
          View claims mapping
        </Button>
      );
    }
    if (dirty && canEditAuth && !savingPolicy) {
      items.push(
        <Box key="policy-dirty" fontSize="body-s" color="text-status-info">
          Pending edits — use Save or Cancel in the widget header to apply changes.
        </Box>
      );
    }

    return <SpaceBetween size="s">{items.filter(Boolean)}</SpaceBetween>;
  };

  const renderRedirectSection = scope => {
    const { authObj } = scopeLookup(scope);
    if (!authObj) return null;
    const redirects = authObj.redirects || {};
    const callbackUris = Array.isArray(redirects.callback) ? redirects.callback : [];
    const logoutUris = Array.isArray(redirects.postLogout) ? redirects.postLogout : [];
    if (callbackUris.length === 0 && logoutUris.length === 0) {
      return null;
    }
    const items = [
      (
        <Box key="redirect-heading" fontSize="heading-xs" variant="h4">
          Redirect URIs
        </Box>
      )
    ];
    if (callbackUris.length > 0) {
      items.push(
        <FormField key="redirect-callback" label="Callback URIs" description="Registered OAuth2 redirect endpoints">
          <SpaceBetween size="xxs">
            {callbackUris.map((uri, index) => (
              <Box key={`callback-${index}`} fontSize="body-s" style={{ wordBreak: 'break-all' }}>
                {uri}
              </Box>
            ))}
          </SpaceBetween>
        </FormField>
      );
    }
    if (logoutUris.length > 0) {
      items.push(
        <FormField key="redirect-logout" label="Post logout URIs" description="IdP redirect destinations after sign-out">
          <SpaceBetween size="xxs">
            {logoutUris.map((uri, index) => (
              <Box key={`logout-${index}`} fontSize="body-s" style={{ wordBreak: 'break-all' }}>
                {uri}
              </Box>
            ))}
          </SpaceBetween>
        </FormField>
      );
    }
    return <SpaceBetween size="s">{items}</SpaceBetween>;
  };

  const renderScopeOverview = scope => {
    const { authObj } = scopeLookup(scope);
    if (!authObj) {
      return (
        <StatusIndicator type="stopped">
          Configuration unavailable for {scope === 'admin' ? 'admin' : 'public'} scope.
        </StatusIndicator>
      );
    }
    const issuer = authObj.issuer || authObj.iss;
    const domain = authObj.domain || authObj.domainUrl;
    const region = authObj.region || authObj.awsRegion;
    const clientId = maskClientId(authObj.clientIdMasked || authObj.clientId);
    const scopeList = Array.isArray(authObj.scopes)
      ? authObj.scopes
      : typeof authObj.scopes === 'string'
        ? authObj.scopes.split(/[\s,]+/)
        : [];

    const items = [
      (
        <Box key="provider">
          Provider:{' '}
          <strong>{authObj.provider || (scope === 'admin' ? 'Admin IdP' : 'Public IdP')}</strong>
        </Box>
      )
    ];
    if (issuer) {
      items.push(
        <Box key="issuer">
          Issuer:{' '}
          <span style={{ wordBreak: 'break-all' }}>
            {issuer}
          </span>
        </Box>
      );
    }
    if (domain) {
      items.push(<Box key="domain">Domain: {domain}</Box>);
    }
    if (region) {
      items.push(<Box key="region">Region: {region}</Box>);
    }
    if (clientId) {
      items.push(<Box key="client">Client ID: {clientId}</Box>);
    }
    if (scopeList.length > 0) {
      items.push(<Box key="scopes">Scopes: {scopeList.join(', ')}</Box>);
    }
    if (authObj.devBypass) {
      items.push(
        <StatusIndicator key="dev-bypass" type="warning">
          Dev authentication bypass active
        </StatusIndicator>
      );
    }
    if (authObj.audit && (authObj.audit.updatedAt || authObj.audit.updatedBy)) {
      items.push(
        <Box key="audit" fontSize="body-s" color="text-status-inactive">
          Last change: {authObj.audit.updatedAt || 'unknown'}
          {authObj.audit.updatedBy ? ` by ${authObj.audit.updatedBy}` : ''}
        </Box>
      );
    }
    return <SpaceBetween size="xxs">{items}</SpaceBetween>;
  };

  const buildTabContent = scope => (
    (() => {
      const sections = [];
      const overview = renderScopeOverview(scope);
      if (overview) {
        sections.push(<React.Fragment key={`${scope}-overview`}>{overview}</React.Fragment>);
      }
      const session = renderSessionSection(scope);
      if (session) {
        sections.push(<React.Fragment key={`${scope}-session`}>{session}</React.Fragment>);
      }
      const policy = renderPolicySection(scope);
      if (policy) {
        sections.push(<React.Fragment key={`${scope}-policy`}>{policy}</React.Fragment>);
      }
      const redirects = renderRedirectSection(scope);
      if (redirects) {
        sections.push(<React.Fragment key={`${scope}-redirects`}>{redirects}</React.Fragment>);
      }
      return <SpaceBetween size="l">{sections}</SpaceBetween>;
    })()
  );

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description={metadata?.description}
          info={infoLink}
          actions={headerActions}
        >
          {metadata?.title || 'Authentication'}
        </Header>
      }
      settings={settingsMenu}
      i18nStrings={boardItemI18nStrings}
    >
      <Tabs
        activeTabId={authTab}
        onChange={({ detail }) => setAuthTab(detail.activeTabId)}
        tabs={[
          { id: 'admin', label: 'Admin', content: buildTabContent('admin') },
          { id: 'public', label: 'Applicants', content: buildTabContent('public') }
        ]}
      />
    </BoardItem>
  );
}
