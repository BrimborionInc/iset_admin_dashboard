function parseJson(value, fallback = {}) {
  if (!value) return { ...fallback };
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : { ...fallback };
  } catch (_) {
    return { ...fallback };
  }
}

function toDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function allocationApplyError(code, details = null) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}

function normalizeEvidenceEntry(allocationId, entry, index) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { id: `alloc-${allocationId}-ev-${index}`, label: entry, href: null, attachments: [] };
  }
  if (typeof entry !== 'object') return null;
  return {
    id: entry.id || `alloc-${allocationId}-ev-${index}`,
    label: entry.label || entry.id || String(entry),
    href: entry.href || null,
    type: entry.type || null,
    attachments: Array.isArray(entry.attachments) ? entry.attachments : [],
  };
}

function mergeEvidence(metadata, allocationId, entries) {
  const existing = (Array.isArray(metadata.evidence) ? metadata.evidence : [])
    .map((entry, index) => normalizeEvidenceEntry(allocationId, entry, index))
    .filter(Boolean);
  const incoming = entries
    .map((entry, index) => normalizeEvidenceEntry(allocationId, entry, index + existing.length))
    .filter(Boolean);
  metadata.evidence = [...existing, ...incoming];
}

function appendMetadataEntry(metadata, field, entry) {
  const current = Array.isArray(metadata[field]) ? metadata[field].slice() : [];
  current.push(entry);
  metadata[field] = current;
}

async function applyBudgetAllocationExactlyOnce({
  pool,
  allocationId,
  appliedAtOverride = null,
} = {}) {
  if (!pool || typeof pool.getConnection !== 'function') {
    throw new TypeError('applyBudgetAllocationExactlyOnce requires a database pool');
  }
  const id = Number(allocationId);
  if (!Number.isFinite(id) || id <= 0) throw allocationApplyError('invalid_allocation_id');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[allocation]] = await connection.query(
      `SELECT id, source_pot_id, dest_pot_id, amount, status, metadata, approved_at
         FROM budget_allocation
        WHERE id = ?
        LIMIT 1
        FOR UPDATE`,
      [id]
    );
    if (!allocation) throw allocationApplyError('allocation_not_found');
    if (allocation.status === 'applied') {
      await connection.commit();
      return { outcome: 'already_applied', allocationId: id };
    }
    if (allocation.status !== 'approved') {
      throw allocationApplyError('invalid_status_transition', { status: allocation.status || null });
    }

    const amount = Number(allocation.amount || 0);
    const sourcePotId = Number(allocation.source_pot_id);
    const destinationPotId = Number(allocation.dest_pot_id);
    if (!Number.isFinite(amount) || amount <= 0) throw allocationApplyError('invalid_amount');
    if (!Number.isFinite(sourcePotId) || !Number.isFinite(destinationPotId) || sourcePotId === destinationPotId) {
      throw allocationApplyError('invalid_pot_ids');
    }

    const potIds = [sourcePotId, destinationPotId].sort((left, right) => left - right);
    const [potRows] = await connection.query(
      `SELECT id, name, adjusted_amount, committed_amount, actual_amount, metadata
         FROM budget_pot
        WHERE id IN (?, ?)
        ORDER BY id
        FOR UPDATE`,
      potIds
    );
    const potMap = new Map((potRows || []).map(row => [Number(row.id), row]));
    const sourcePot = potMap.get(sourcePotId);
    const destinationPot = potMap.get(destinationPotId);
    if (!sourcePot || !destinationPot) throw allocationApplyError('allocation_pot_not_found');

    const availableFor = pot =>
      Number(pot.adjusted_amount || 0) -
      Number(pot.committed_amount || 0) -
      Number(pot.actual_amount || 0);
    const beforeBalances = {
      source: availableFor(sourcePot),
      destination: availableFor(destinationPot),
    };
    if (!Number.isFinite(beforeBalances.source) || !Number.isFinite(beforeBalances.destination)) {
      throw allocationApplyError('allocation_pot_balance_invalid');
    }
    if (beforeBalances.source < amount) {
      throw allocationApplyError('allocation_source_authority_insufficient', {
        available: beforeBalances.source,
        amount,
      });
    }
    const afterBalances = {
      source: beforeBalances.source - amount,
      destination: beforeBalances.destination + amount,
    };

    const appliedAt = appliedAtOverride instanceof Date
      ? appliedAtOverride
      : appliedAtOverride
        ? new Date(appliedAtOverride)
        : new Date();
    if (Number.isNaN(appliedAt.getTime())) throw allocationApplyError('invalid_applied_at');
    const metadata = parseJson(allocation.metadata);
    const appliedBy = metadata.appliedBy || metadata.approvedBy || metadata.requestedBy || 'Finance';
    const approvalOwner = Array.isArray(metadata.approvers) && metadata.approvers.length
      ? metadata.approvers.join(', ')
      : appliedBy;
    const evidence = Array.isArray(metadata.evidence) ? metadata.evidence : [];
    const sourceMetadata = parseJson(sourcePot.metadata);
    const destinationMetadata = parseJson(destinationPot.metadata);
    const adjustmentDate = toDateOnly(appliedAt);

    appendMetadataEntry(sourceMetadata, 'adjustments', {
      id: `alloc-${id}-out`,
      date: adjustmentDate,
      type: 'Transfer out',
      amount: -amount,
      reason: `Transfer to ${destinationPot.name || destinationPotId}`,
      user: appliedBy,
    });
    appendMetadataEntry(destinationMetadata, 'adjustments', {
      id: `alloc-${id}-in`,
      date: adjustmentDate,
      type: 'Transfer in',
      amount,
      reason: `Transfer from ${sourcePot.name || sourcePotId}`,
      user: appliedBy,
    });
    const approvalDate = toDateOnly(allocation.approved_at || appliedAt);
    appendMetadataEntry(sourceMetadata, 'approvals', {
      id: `alloc-${id}`,
      type: 'Transfer approved',
      date: approvalDate,
      owner: approvalOwner,
    });
    appendMetadataEntry(destinationMetadata, 'approvals', {
      id: `alloc-${id}`,
      type: 'Transfer approved',
      date: approvalDate,
      owner: approvalOwner,
    });
    mergeEvidence(sourceMetadata, id, evidence);
    mergeEvidence(destinationMetadata, id, evidence);

    await connection.query(
      'UPDATE budget_pot SET adjusted_amount = adjusted_amount - ?, metadata = ? WHERE id = ?',
      [amount, JSON.stringify(sourceMetadata), sourcePotId]
    );
    await connection.query(
      'UPDATE budget_pot SET adjusted_amount = adjusted_amount + ?, metadata = ? WHERE id = ?',
      [amount, JSON.stringify(destinationMetadata), destinationPotId]
    );
    const appliedMetadata = {
      ...metadata,
      evidence: evidence.map((entry, index) => normalizeEvidenceEntry(id, entry, index)).filter(Boolean),
      beforeBalances,
      afterBalances,
      appliedBy,
      appliedAtEffective: appliedAt.toISOString(),
      scheduledApplyAt: null,
    };
    const [claimResult] = await connection.query(
      `UPDATE budget_allocation
          SET status = 'applied', metadata = ?, applied_at = ?, updated_at = NOW()
        WHERE id = ? AND status = 'approved'`,
      [JSON.stringify(appliedMetadata), appliedAt, id]
    );
    if (Number(claimResult?.affectedRows || 0) !== 1) {
      throw allocationApplyError('allocation_claim_lost');
    }
    await connection.commit();
    return { outcome: 'applied', allocationId: id };
  } catch (error) {
    try { await connection.rollback(); } catch (_) {}
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { applyBudgetAllocationExactlyOnce };
