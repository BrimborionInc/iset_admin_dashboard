import React from 'react';

export default function CorsOriginsWidgetHelp() {
  return (
    <div>
      <h1>CORS / Origins</h1>
      <p>Displays server-permitted origins for cross-origin requests. Ensures front-end deployments interact only from vetted domains, mitigating XSRF and injection vectors from rogue origins.</p>
      <h2>Best Practices</h2>
      <ul>
        <li>Limit origins to explicit production, staging, and local development domains.</li>
        <li>Never use a wildcard (*) in regulated environments.</li>
        <li>Periodically audit to remove deprecated environments.</li>
      </ul>
    </div>
  );
}
CorsOriginsWidgetHelp.aiContext = 'Widget help: CORS allowed origins hardening guidance.';
