const toPositiveInteger = value => {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const splitPathHash = path => {
  const hashIndex = path.indexOf('#');
  if (hashIndex < 0) return { pathWithoutHash: path, hash: '' };
  return {
    pathWithoutHash: path.slice(0, hashIndex),
    hash: path.slice(hashIndex),
  };
};

/**
 * Preserve exact repeat-application scope on an existing internal workspace path.
 * Existing query parameters and fragments are retained; a stale applicationId is replaced.
 */
export const appendExactApplicationIdToWorkspacePath = (path, applicationId) => {
  if (typeof path !== 'string' || !path.trim()) return path || null;
  const exactApplicationId = toPositiveInteger(applicationId);
  if (!exactApplicationId) return path;

  const { pathWithoutHash, hash } = splitPathHash(path);
  const queryIndex = pathWithoutHash.indexOf('?');
  const pathname = queryIndex < 0 ? pathWithoutHash : pathWithoutHash.slice(0, queryIndex);
  const query = queryIndex < 0 ? '' : pathWithoutHash.slice(queryIndex + 1);
  const params = new URLSearchParams(query);
  params.set('applicationId', String(exactApplicationId));

  return `${pathname}?${params.toString()}${hash}`;
};

export const preserveWorkQueueApplicationScope = (path, item = {}) => {
  const caseId = toPositiveInteger(item?.case_id ?? item?.caseId);
  const applicationId = toPositiveInteger(item?.application_id ?? item?.applicationId);
  if (!caseId || !applicationId) return path;
  return appendExactApplicationIdToWorkspacePath(path, applicationId);
};
