export const LEGACY_MANUAL_INTAKE_DRAFT_KEY = 'manual-application-intake-runtime.v2';

function normalized(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function compactHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function fingerprintManualIntakeQuery(value) {
  const query = normalized(value);
  return query ? compactHash(query) : '';
}

export function fingerprintManualIntakeIdentity(identity = {}) {
  const canonical = [
    identity.firstName,
    identity.lastName,
    identity.preferredName,
    identity.email,
    identity.phone,
    identity.province,
    identity.dateOfBirth || identity.dob,
    identity.sin,
  ].map(normalized).join('|');
  return canonical.replace(/\|/g, '') ? compactHash(canonical) : '';
}

export function bindManualIntakeSelection(item, { queryFingerprint, identityFingerprint, generation }) {
  if (!item || typeof item !== 'object') return null;
  return {
    ...item,
    selectionContext: {
      queryFingerprint: String(queryFingerprint || ''),
      identityFingerprint: String(identityFingerprint || ''),
      generation: Number(generation) || 0,
    },
  };
}

export function manualIntakeSelectionIsCurrent(selection, context = {}) {
  const selectedContext = selection?.selectionContext;
  if (!selection?.clientId || !selectedContext) return false;
  return (
    selectedContext.queryFingerprint === String(context.queryFingerprint || '') &&
    selectedContext.identityFingerprint === String(context.identityFingerprint || '') &&
    selectedContext.generation === (Number(context.generation) || 0)
  );
}

export function purgeLegacyManualIntakeDraft(storage = null) {
  const resolvedStorage = storage || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  if (!resolvedStorage || typeof resolvedStorage.removeItem !== 'function') return false;
  try {
    resolvedStorage.removeItem(LEGACY_MANUAL_INTAKE_DRAFT_KEY);
    return true;
  } catch (_) {
    return false;
  }
}
