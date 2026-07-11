const fs = require('fs');
const path = require('path');
const {
  loadAiRuntimeConfig,
  normalizeParams,
  resolveAiChatModel,
} = require('../../../../shared/ai/runtimeConfig');

describe('canonical AI runtime configuration', () => {
  test('DB overrides survive an environment restart and partial params preserve current values', async () => {
    const rows = [
      { k: 'ai.model', v: { model: 'openai/approved' } },
      { k: 'ai.params', v: { temperature: 0.2, top_p: null } },
      { k: 'ai.fallbacks', v: ['openai/fallback'] },
    ];
    const pool = { query: jest.fn(async () => [rows, []]) };
    const first = await loadAiRuntimeConfig(pool, {
      env: { OPENROUTER_MODEL: 'openai/deployment', OPENROUTER_TOP_P: '0.8' },
    });
    const restarted = await loadAiRuntimeConfig(pool, {
      env: { OPENROUTER_MODEL: 'openai/new-deployment', OPENROUTER_TOP_P: '0.8' },
    });
    expect(first).toEqual(restarted);
    expect(first).toMatchObject({
      model: 'openai/approved',
      params: { temperature: 0.2, top_p: 0.8 },
      fallbacks: ['openai/fallback'],
    });
    expect(normalizeParams({ temperature: 0.4 }, first.params)).toEqual({ ...first.params, temperature: 0.4 });
  });

  test('ordinary staff cannot override a model and invalid configured models fail closed', () => {
    const allowed = model => model === 'openai/approved';
    expect(resolveAiChatModel({ requestedModel: 'openai/other', runtimeModel: 'openai/approved', isAllowed: allowed }))
      .toEqual({ error: 'model_override_forbidden', status: 403 });
    expect(resolveAiChatModel({ requestedModel: 'openai/other', runtimeModel: 'openai/approved', isSystemAdministrator: true, isAllowed: allowed }))
      .toEqual({ error: 'unsupported_model', status: 400 });
    expect(resolveAiChatModel({ runtimeModel: 'vendor/unapproved', isAllowed: allowed }))
      .toEqual({ error: 'configured_model_not_allowed', status: 503 });
  });

  test('configuration requests are JSON and server updates only the canonical DB store', () => {
    const page = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/configurationSettings.js'), 'utf8');
    const server = fs.readFileSync(path.resolve(process.cwd(), 'isetadminserver.js'), 'utf8');
    for (const route of ['ai-params', 'ai-fallbacks']) {
      const start = page.indexOf(`/api/config/runtime/${route}`);
      const snippet = page.slice(start, start + 650);
      expect(snippet).toContain('"Content-Type": "application/json"');
      expect(snippet).toContain('body: JSON.stringify(');
    }
    const modelStart = server.indexOf("app.patch('/api/config/runtime/ai-model'");
    const modelEnd = server.indexOf("app.get('/api/config/runtime/ai-params'", modelStart);
    const routesEnd = server.indexOf("app.get('/api/access-control/matrix'", modelEnd);
    const mutationSource = server.slice(modelStart, routesEnd);
    expect(mutationSource).toContain("INSERT INTO iset_runtime_config");
    expect(mutationSource).not.toContain('persistEnvUpdates');
    expect(mutationSource).not.toContain('writeFileSync');
    expect(mutationSource).toContain('fallback_models_required');
  });
});
