// Local wrapper to import portal renderer registry without CRA cross-project transpile issues.
// We require the compiled JS through Node's resolution. Because CRA limits transpilation to src/, importing
// a sibling project's source file directly can fail Babel JSX transform. We lazy-require so tests/build succeed.
// eslint-disable-next-line import/no-anonymous-default-export
export default (() => {
  try {
    // Use vendored copy inside src to avoid CRA restriction on relative imports outside src
    // eslint-disable-next-line global-require
    const mod = require('./component-lib/portalRenderers');
    return mod.registry || {};
  } catch (e) {
    console.warn('[portal-renderer-registry-missing]', e?.message || e);
    return {};
  }
})();
