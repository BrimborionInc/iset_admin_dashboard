// Post Confirmation Lambda: ensure applicant DB record provisioning (stub)
// Trigger: Cognito User Pool Post Confirmation (after user signs up & verifies email)
// Current behavior: Log event and (optionally) invoke a provisioning webhook if configured.
// Future enhancement: Direct MySQL insert (requires VPC + secrets) once infrastructure ready.

const https = require('https');

exports.handler = async (event) => {
  try {
    const userAttributes = event?.request?.userAttributes || {};
    const email = userAttributes.email;
    const sub = userAttributes.sub;
    const locale = userAttributes['locale'] || 'en';

    const hookUrl = process.env.PROVISIONING_WEBHOOK_URL; // e.g., portal backend endpoint
    if (hookUrl) {
      await postJson(hookUrl, { sub, email, locale });
    } else {
      console.log('PostConfirmation stub invoked', { sub, email, locale });
    }
  } catch (err) {
    console.error('PostConfirmation handler error (non-fatal to signup)', err);
  }
  return event; // never throw to avoid blocking confirmation
};

function postJson(urlString, body) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const data = JSON.stringify(body);
      const req = https.request({
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname + (url.search || ''),
        port: url.port || 443,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      }, res => {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) return resolve();
          console.warn('Provisioning webhook non-2xx', res.statusCode, buf);
          resolve(); // non-fatal
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    } catch (e) { reject(e); }
  });
}
