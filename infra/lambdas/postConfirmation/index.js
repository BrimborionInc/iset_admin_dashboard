/* eslint-disable no-console */
const https = require('https');
const url = require('url');

const {
  PROVISIONING_WEBHOOK_URL,
  PROVISIONING_WEBHOOK_SECRET
} = process.env;

function postJson(targetUrl, payload, attempt=1) {
  return new Promise((resolve,reject)=>{
    const u = url.parse(targetUrl);
    const body = JSON.stringify(payload);
    const opts = {
      hostname: u.hostname,
      path: u.path,
      port: u.port || 443,
      method: 'POST',
      protocol: u.protocol,
      headers: {
        'Content-Type':'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Webhook-Secret': PROVISIONING_WEBHOOK_SECRET || ''
      },
      timeout: 5000
    };
    const req = https.request(opts, res=>{
      let data=''; res.on('data', c=>data+=c);
      res.on('end', ()=>{
        if (res.statusCode >=200 && res.statusCode<300) return resolve();
        reject(new Error(`status ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', ()=>{ req.destroy(new Error('timeout')); });
    req.write(body); req.end();
  }).catch(err=>{
    if (attempt >=3) throw err;
    const delay = Math.pow(2, attempt) * 500;
    return new Promise(r=>setTimeout(r, delay)).then(()=>postJson(targetUrl,payload,attempt+1));
  });
}

exports.handler = async (event) => {
  if (!PROVISIONING_WEBHOOK_URL) {
    console.log('No provisioning webhook configured');
    return event;
  }
  try {
    const userAttr = {};
    (event.request.userAttributes || {}).locale && (userAttr.locale = event.request.userAttributes.locale);
    const payload = {
      sub: event.userName,
      email: event.request.userAttributes.email,
      locale: userAttr.locale || 'en'
    };
    await postJson(PROVISIONING_WEBHOOK_URL, payload);
    console.log('Provisioning webhook success for', payload.sub);
  } catch(e){
    console.error('Provisioning webhook failed', e.message);
  }
  return event;
};
