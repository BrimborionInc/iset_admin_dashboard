const registry = new Map();

function register(keys, entry) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const key of list) {
    if (typeof key !== 'string') continue;
    registry.set(key.trim().toLowerCase(), entry);
  }
}

function normalise(val) {
  return typeof val === 'string' ? val.trim().toLowerCase() : '';
}

register(['signature-ack', 'signature_ack', 'signatureack'], {
  macro: { file: 'signature-ack.njk', name: 'signatureAck' },
  prepareProps: (comp) => {
    const base = comp && typeof comp === 'object' ? comp : {};
    const props = base.props && typeof base.props === 'object' ? { ...base.props } : {};
    if (base.value !== undefined && props.value === undefined) {
      props.value = base.value;
    }
    if (!props.name && (base.storageKey || base.id)) {
      props.name = base.storageKey || base.id;
    }
    return props;
  }
});

function getRenderer({ templateKey, type }) {
  const candidateKeys = [templateKey, type];
  for (const candidate of candidateKeys) {
    const norm = normalise(candidate);
    if (!norm) continue;
    const entry = registry.get(norm);
    if (entry) return entry;
  }
  return null;
}

module.exports = { getRenderer };
