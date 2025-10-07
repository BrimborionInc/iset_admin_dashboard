// Simple smoke test for Workflow CRUD API
// Usage: node scripts/test-workflows.js

const axios = require('axios');

(async () => {
  const base = (process.env.API_BASE || process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001').replace(/\/$/, '');
  const api = axios.create({ baseURL: base, headers: { 'Content-Type': 'application/json' } });
  try {
    // 1) List steps to choose some
    const stepsRes = await api.get('/api/steps');
    const payload = stepsRes.data || [];
    const steps = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.rows)
          ? payload.rows
          : [];
    if (steps.length < 2) {
      console.log('Not enough steps to create a workflow. Found:', steps.length);
      process.exit(0);
    }
    const ids = steps.slice(0, Math.min(5, steps.length)).map(s => s.id);

    // 2) Create workflow
    const now = new Date();
    const name = `Sample Workflow ${now.toISOString().replace(/[:.]/g, '-')}`;
    const body = {
      name,
      status: 'draft',
      steps: ids,
      start_step_id: ids[0],
      routes: [
        { source_step_id: ids[0], mode: 'linear', default_next_step_id: ids[1] },
        ids[2] ? { source_step_id: ids[1], mode: 'linear', default_next_step_id: ids[2] } : null
      ].filter(Boolean)
    };
    const createRes = await api.post('/api/workflows', body);
    const wfId = createRes.data.id;
    console.log('Created workflow id:', wfId);

    // 3) Read it back
    const detail = await api.get(`/api/workflows/${wfId}`);
    console.log('Workflow detail name:', detail.data.name);
    console.log('Steps count:', (detail.data.steps || []).length);
    console.log('Routes count:', (detail.data.routes || []).length);

    // 4) List all to confirm presence
    const list = await api.get('/api/workflows');
    const found = (list.data || []).find(w => w.id === wfId);
    console.log('List contains new workflow:', !!found);
  } catch (err) {
    console.error('Test failed:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
})();
