import React from 'react';
import { Alert } from '@cloudscape-design/components';

export default function AiConfigWidgetHelp() {
  return (
    <div>
      <h1>AI / LLM Configuration</h1>
      <p>Controls default Large Language Model (LLM) selection, inference parameters, and ordered fallback list used when the primary model fails with provider-side errors (typically 4xx).</p>
      <h2>Key Elements</h2>
      <ul>
        <li><strong>Default Model:</strong> Base model applied when no explicit per-request override is supplied.</li>
        <li><strong>Temperature:</strong> Creativity vs determinism trade-off (0 = deterministic; higher = more diverse).</li>
        <li><strong>Top P:</strong> Nucleus sampling boundary; lower restricts token probability mass.</li>
        <li><strong>Presence / Frequency Penalties:</strong> Mitigate repetition & encourage novel tokens.</li>
        <li><strong>Max Tokens:</strong> Hard cap; blank delegates to provider default.</li>
        <li><strong>Fallback Models:</strong> Ordered list attempted sequentially when the primary model returns an error.</li>
      </ul>
      <h2>Operational Guidance</h2>
      <ul>
        <li>Keep temperature ≤ 0.8 for system prompts requiring stable compliance.</li>
        <li>Use fallback models sparingly; monitor latency impact and audit failover frequency.</li>
        <li>Document any model change in change management artifacts if output quality affects regulated workflows.</li>
      </ul>
      <Alert header="Audit Note" type="info">Model and parameter changes should be traceable via deployment notes; current widget writes values immediately upon save actions.</Alert>
    </div>
  );
}
AiConfigWidgetHelp.aiContext = 'Widget help: AI / LLM Configuration parameters and fallback behavior.';
