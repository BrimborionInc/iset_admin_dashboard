'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function sha256Files(root, files) {
  const hash = crypto.createHash('sha256');
  files.slice().sort().forEach(relative => {
    const filename = path.join(root, relative);
    hash.update(relative.split(path.sep).join('/'));
    hash.update('\0');
    hash.update(fs.readFileSync(filename));
    hash.update('\0');
  });
  return hash.digest('hex');
}

function validateInventory(inventory) {
  const errors = [];
  if (inventory?.schemaVersion !== 1) errors.push('inventory schemaVersion must be 1');
  const checks = inventory?.checks || {};
  const domains = Array.isArray(inventory?.domains) ? inventory.domains : [];
  const domainIds = new Set();
  domains.forEach(domain => {
    if (!domain?.id) errors.push('domain id is required');
    else if (domainIds.has(domain.id)) errors.push(`duplicate domain id: ${domain.id}`);
    else domainIds.add(domain.id);
    if (domain?.selection !== undefined && domain.selection !== 'change-triggered-development') {
      errors.push(`domain ${domain.id} has invalid selection ${domain.selection}`);
    }
    Object.entries(domain?.matches || {}).forEach(([repo, patterns]) => {
      if (!inventory?.repositories?.[repo]) errors.push(`domain ${domain.id} references unknown repository ${repo}`);
      (patterns || []).forEach(pattern => {
        try { new RegExp(pattern, 'u'); } catch (error) { errors.push(`domain ${domain.id} has invalid regex ${pattern}: ${error.message}`); }
      });
    });
  });
  const referencedChecks = new Set([
    ...(inventory?.alwaysRequired?.dev || []),
    ...(inventory?.alwaysRequired?.test || []),
  ]);
  domains.forEach(domain => {
    (domain.dependsOn || []).forEach(dependency => {
      if (!domainIds.has(dependency)) errors.push(`domain ${domain.id} depends on unknown domain ${dependency}`);
    });
    (domain.devChecks || []).forEach(id => referencedChecks.add(id));
    (domain.testChecks || []).forEach(id => referencedChecks.add(id));
  });
  referencedChecks.forEach(id => {
    if (!checks[id]) errors.push(`unknown check id: ${id}`);
  });
  Object.entries(checks).forEach(([id, check]) => {
    if (!['dev', 'test', 'both'].includes(check.stage)) errors.push(`check ${id} has invalid stage`);
    if (!check.type && (!Array.isArray(check.command) || !check.command.length)) errors.push(`check ${id} needs a command or type`);
    if (check.cwd && !inventory?.repositories?.[check.cwd]) errors.push(`check ${id} has unknown cwd ${check.cwd}`);
  });
  (inventory?.operationRules || []).forEach((rule, index) => {
    try { new RegExp(rule.pattern, 'u'); } catch (error) { errors.push(`operation rule ${index} has invalid regex: ${error.message}`); }
    (rule.domains || []).forEach(domain => {
      if (!domainIds.has(domain)) errors.push(`operation rule ${index} references unknown domain ${domain}`);
    });
  });

  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(domains.map(domain => [domain.id, domain]));
  function visit(id, trail = []) {
    if (visiting.has(id)) {
      errors.push(`domain dependency cycle: ${[...trail, id].join(' -> ')}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    (byId.get(id)?.dependsOn || []).forEach(dependency => visit(dependency, [...trail, id]));
    visiting.delete(id);
    visited.add(id);
  }
  domains.forEach(domain => visit(domain.id));
  return errors;
}

function resolveDomains(inventory, changedFiles, full = false) {
  const domains = inventory.domains || [];
  const matched = new Set();
  const unmatched = [];
  if (full) {
    domains
      .filter(domain => domain.id !== 'documentation-only' && domain.selection !== 'change-triggered-development')
      .forEach(domain => matched.add(domain.id));
    return { domainIds: Array.from(matched).sort(), unmatched };
  }

  Object.entries(changedFiles || {}).forEach(([repo, files]) => {
    (files || []).forEach(filename => {
      const fileMatches = domains.filter(domain => (domain.matches?.[repo] || []).some(pattern => new RegExp(pattern, 'u').test(filename)));
      if (!fileMatches.length) unmatched.push({ repo, file: filename });
      fileMatches.forEach(domain => matched.add(domain.id));
    });
  });

  const byId = new Map(domains.map(domain => [domain.id, domain]));
  function includeDependencies(id) {
    (byId.get(id)?.dependsOn || []).forEach(dependency => {
      if (!matched.has(dependency)) {
        matched.add(dependency);
        includeDependencies(dependency);
      }
    });
  }
  Array.from(matched).forEach(includeDependencies);
  return { domainIds: Array.from(matched).sort(), unmatched };
}

function requiredChecksFor(inventory, stage, domainIds) {
  const checkIds = new Set(inventory.alwaysRequired?.[stage] || []);
  const field = stage === 'test' ? 'testChecks' : 'devChecks';
  const byId = new Map((inventory.domains || []).map(domain => [domain.id, domain]));
  (domainIds || []).forEach(id => (byId.get(id)?.[field] || []).forEach(checkId => checkIds.add(checkId)));
  return Array.from(checkIds);
}

function resolveOperationDomains(inventory, operations) {
  const domains = new Set();
  const unmatched = [];
  for (const operation of operations || []) {
    const rules = (inventory.operationRules || []).filter(rule => new RegExp(rule.pattern, 'u').test(operation));
    if (!rules.length) unmatched.push(operation);
    rules.forEach(rule => (rule.domains || []).forEach(domain => domains.add(domain)));
  }
  const byId = new Map((inventory.domains || []).map(domain => [domain.id, domain]));
  function includeDependencies(id) {
    (byId.get(id)?.dependsOn || []).forEach(dependency => {
      if (!domains.has(dependency)) {
        domains.add(dependency);
        includeDependencies(dependency);
      }
    });
  }
  Array.from(domains).forEach(includeDependencies);
  return { domainIds: Array.from(domains).sort(), unmatched };
}

function sourceComponents(domainIds, changedFiles) {
  const repos = new Set(Object.entries(changedFiles || {}).filter(([, files]) => files.length).map(([repo]) => repo));
  if (repos.has('shared')) {
    repos.add('admin');
    repos.add('portal');
  }
  if ((domainIds || []).some(id => ['schema-readiness', 'notifications-workers'].includes(id))) {
    repos.add('admin');
    repos.add('portal');
    repos.add('shared');
  }
  return Array.from(repos).filter(repo => ['admin', 'portal', 'shared'].includes(repo)).sort();
}

function createEvidenceId(evidence) {
  const copy = { ...evidence };
  delete copy.evidenceId;
  return sha256Json(copy);
}

function validateEvidenceIntegrity(evidence) {
  if (!evidence || evidence.schemaVersion !== 1) return ['qualification evidence schemaVersion must be 1'];
  const expected = createEvidenceId(evidence);
  return expected === evidence.evidenceId ? [] : ['qualification evidence checksum mismatch'];
}

function validateQualificationEvidence({
  evidence,
  expectedStage,
  currentSource,
  inventorySha256,
  schemaSha256,
  requiredComponents = [],
  now = new Date(),
}) {
  const errors = validateEvidenceIntegrity(evidence);
  if (evidence?.stage !== expectedStage) errors.push(`qualification stage must be ${expectedStage}`);
  if (evidence?.decision !== 'GO') errors.push(`qualification decision is ${evidence?.decision || 'missing'}, expected GO`);
  if (evidence?.inventorySha256 !== inventorySha256) errors.push('qualification inventory checksum does not match current inventory');
  if (evidence?.candidate?.schemaSha256 !== schemaSha256) errors.push('qualification schema checksum does not match current migrations');
  const expiresAt = Date.parse(evidence?.expiresAt || '');
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) errors.push('qualification evidence is expired or has no valid expiry');
  (evidence?.requiredChecks || []).forEach(id => {
    const result = (evidence.checks || []).find(check => check.id === id);
    if (!result) errors.push(`qualification evidence is missing required check ${id}`);
    else if (result.status !== 'passed') errors.push(`qualification check ${id} is ${result.status}`);
  });
  const evidenceSource = evidence?.candidate?.source || {};
  Object.entries(currentSource || {}).forEach(([repo, state]) => {
    if (!requiredComponents.includes(repo)) return;
    const accepted = evidenceSource[repo];
    if (!accepted) errors.push(`qualification evidence has no source state for ${repo}`);
    else if (accepted.gitHead !== state.gitHead || accepted.treeFingerprint !== state.treeFingerprint) {
      errors.push(`qualification source does not match current ${repo} tree`);
    }
  });
  requiredComponents.forEach(repo => {
    if (!(evidence?.candidate?.components || []).includes(repo)) errors.push(`qualification scope does not include ${repo}`);
  });
  return errors;
}

module.exports = {
  createEvidenceId,
  requiredChecksFor,
  resolveDomains,
  resolveOperationDomains,
  sha256Files,
  sha256Json,
  sourceComponents,
  validateEvidenceIntegrity,
  validateInventory,
  validateQualificationEvidence,
};
