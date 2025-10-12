"use strict";

let logged = false;

function resolveAwsCredentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('[aws] Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in environment (.env expected).');
  }

  if (!logged) {
    const prefix = accessKeyId.slice(0, 6);
    const hasSession = Boolean(sessionToken);
    console.log(`[aws] using env credentials: accessKeyId=${prefix}*** sessionToken=${hasSession ? 'yes' : 'no'}`);
    logged = true;
  }

  return sessionToken
    ? { accessKeyId, secretAccessKey, sessionToken }
    : { accessKeyId, secretAccessKey };
}

module.exports = { resolveAwsCredentials };
