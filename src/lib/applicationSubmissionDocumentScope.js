function normalizeSubmissionPayloadFilePath(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

function collectSubmissionPayloadFilePaths(payload) {
  const paths = new Set();
  const stack = [payload];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    if (typeof node !== 'object') continue;
    const filePath = normalizeSubmissionPayloadFilePath(node.filePath || node.file_path);
    if (filePath) paths.add(filePath);
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return Array.from(paths);
}

function createSubmissionPayloadFilePathSet(payload) {
  return new Set(collectSubmissionPayloadFilePaths(payload));
}

function hasScopedDocumentLink(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0;
}

function isSubmissionPayloadDocumentMatch(doc, submissionPayloadFilePaths) {
  if (!doc || typeof doc !== 'object') return false;
  if (!(submissionPayloadFilePaths instanceof Set) || submissionPayloadFilePaths.size === 0) return false;
  if (String(doc.source || '').trim().toLowerCase() !== 'application_submission') return false;
  if (hasScopedDocumentLink(doc.application_id) || hasScopedDocumentLink(doc.case_id) || hasScopedDocumentLink(doc.action_plan_id)) {
    return false;
  }
  const filePath = normalizeSubmissionPayloadFilePath(doc.file_path || doc.filePath);
  return Boolean(filePath) && submissionPayloadFilePaths.has(filePath);
}

module.exports = {
  collectSubmissionPayloadFilePaths,
  createSubmissionPayloadFilePathSet,
  isSubmissionPayloadDocumentMatch,
  normalizeSubmissionPayloadFilePath,
};
