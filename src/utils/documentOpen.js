function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPendingMarkup(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Preparing document</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #1b1b1b; background: #f8fafc; }
    main { max-width: 560px; margin: 64px auto; padding: 24px 28px; background: #ffffff; border: 1px solid #d5dbdb; border-radius: 12px; }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { margin: 0; line-height: 1.5; color: #425466; }
  </style>
</head>
<body>
  <main>
    <h1>Preparing document</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
}

export function openPendingDocumentWindow(message = 'Please wait while PATH prepares the document preview.') {
  if (typeof window === 'undefined') return null;
  const popup = window.open('', '_blank');
  if (!popup) return null;
  try {
    popup.opener = null;
    popup.document.open();
    popup.document.write(renderPendingMarkup(message));
    popup.document.close();
  } catch (_) {
    // Ignore same-origin document writes that fail on stricter browsers.
  }
  return popup;
}

export function navigateDocumentWindow(popup, targetUrl) {
  if (!targetUrl || typeof window === 'undefined') return false;
  if (popup && !popup.closed) {
    try {
      popup.opener = null;
      popup.location.replace(targetUrl);
      return true;
    } catch (_) {
      // Fall through to a last-ditch open attempt below.
    }
  }
  return Boolean(window.open(targetUrl, '_blank', 'noopener,noreferrer'));
}

export function closePendingDocumentWindow(popup) {
  if (!popup || popup.closed) return;
  try {
    popup.close();
  } catch (_) {
    // Ignore close failures from browser policies.
  }
}
