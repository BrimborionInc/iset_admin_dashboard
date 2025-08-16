#!/usr/bin/env node
const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 5001, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    const out = await get('/api/audit/parity-all?limit=0');
    const { summary, results } = out;
    console.log('Parity summary:', summary);
    const offenders = results.filter(r => !r.ok);
    if (offenders.length) {
      console.log('\nIssues found:');
      offenders.forEach(r => console.log(`- ${r.template_key}@v${r.version} [${r.type}]`, r.error || r.issues.join(', ')));
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    console.error('Parity audit failed:', e.message || e);
    process.exit(2);
  }
})();
