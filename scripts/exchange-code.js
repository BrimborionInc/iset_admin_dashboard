#!/usr/bin/env node
/**
 * Exchange a Cognito Hosted UI authorization code for tokens, then call /api/auth/me.
 * Usage: node scripts/exchange-code.js <code>
 */
const fs = require('fs');
const path = require('path');

async function main() {
  const code = process.argv[2] || process.env.CODE;
  if (!code) {
    console.error('Usage: node scripts/exchange-code.js <code>');
    process.exit(1);
  }

  // Load .env for CLIENT_ID if present
  try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch {}

  // Discover Cognito details from terraform state (single source of truth)
  const tfStatePath = path.resolve(__dirname, '..', 'infra', 'terraform', 'terraform.tfstate');
  let tf = null;
  try {
    tf = JSON.parse(fs.readFileSync(tfStatePath, 'utf8'));
  } catch (e) {
    console.warn('Warning: failed to read terraform.tfstate:', e.message);
  }

  const outputs = (tf && tf.outputs) || {};
  const domainPrefix = outputs.hosted_ui_domain?.value || process.env.COGNITO_DOMAIN;
  const region = (process.env.AWS_REGION || 'ca-central-1').trim();
  const clientId = process.env.COGNITO_CLIENT_ID || outputs.user_pool_client_id?.value;
  const redirectUri = process.env.COGNITO_REDIRECT_URI || 'http://localhost:3001/auth/callback';

  if (!domainPrefix || !clientId) {
    console.error('Missing Cognito details. Need hosted_ui_domain and client_id.');
    process.exit(2);
  }

  const tokenUrl = `https://${domainPrefix}.auth.${region}.amazoncognito.com/oauth2/token`;

  const form = new URLSearchParams();
  form.set('grant_type', 'authorization_code');
  form.set('client_id', clientId);
  form.set('code', code);
  form.set('redirect_uri', redirectUri);

  const fetchOpts = {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  };

  let tokens;
  try {
    const resp = await fetch(tokenUrl, fetchOpts);
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Token exchange failed: ${resp.status} ${resp.statusText} - ${txt}`);
    }
    tokens = await resp.json();
  } catch (e) {
    console.error(e.message || e);
    process.exit(3);
  }

  const idToken = tokens.id_token;
  if (!idToken) {
    console.error('No id_token in response');
    console.log(tokens);
    process.exit(4);
  }

  // Call the admin API probe
  const apiBase = process.env.API_BASE || 'http://localhost:5001';
  try {
    const meResp = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    const text = await meResp.text();
    console.log('STATUS /api/auth/me =', meResp.status);
    try { console.log(JSON.stringify(JSON.parse(text), null, 2)); }
    catch { console.log(text); }
  } catch (e) {
    console.error('Failed to call /api/auth/me:', e.message || e);
    process.exit(5);
  }
}

main();
