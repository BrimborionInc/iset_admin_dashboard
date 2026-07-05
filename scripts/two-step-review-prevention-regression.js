#!/usr/bin/env node
/*
 * Focused regression guard for the two-step review prevention fixes.
 *
 * This script imports the server in repair-export mode and stubs external I/O.
 * It verifies that generated intervention assessment documents create
 * iset_document_intervention links and that proposal compatibility syncing
 * preserves the original submitted_at during final-decision updates.
 */

const assert = require('assert');
const Module = require('module');

process.env.PATH_REPAIR_EXPORTS = '1';
process.env.ENABLE_DB_DIAG = 'false';

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '../ISET-intake/s3Provider' || request.endsWith('/ISET-intake/s3Provider')) {
    return {
      DRIVER: 's3',
      generateKey: (_owner, fileName) => `two-step-regression/${fileName}`,
      presignPut: async () => ({
        url: 'https://example.invalid/two-step-regression',
        headers: {},
      }),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const axios = require('axios');
axios.put = async () => ({ status: 200 });

const {
  pool,
  storeAssessmentPdfDocument,
  syncInterventionProposalCompatibility,
} = require('../isetadminserver');

function buildConnection() {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ sql, normalizedSql, params });

      if (normalizedSql.startsWith('SELECT a.id AS application_id')) {
        return [[{ application_id: 88 }]];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_document ')) {
        return [{ insertId: 9001 }];
      }
      if (normalizedSql.startsWith('DELETE FROM iset_document_intervention')) {
        return [{ affectedRows: 0 }];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_document_intervention')) {
        return [{ affectedRows: Array.isArray(params?.[0]) ? params[0].length : 0 }];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_intervention_proposal')) {
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query in regression guard: ${normalizedSql}`);
    },
  };
}

async function verifyGeneratedAssessmentLinksInterventions() {
  const connection = buildConnection();

  const documentId = await storeAssessmentPdfDocument({
    applicationId: 88,
    caseId: 44,
    clientId: 123,
    applicantUserId: 456,
    actorUserId: 789,
    interventionIds: [219, '219', 220, null, undefined, ''],
    trackingId: 'ISET-REGRESSION',
    pdfBuffer: Buffer.from('%PDF two-step regression'),
    documentType: 'case_assessment',
    label: 'Case manager assessment v2',
    fileNamePrefix: 'case-manager-assessment',
    versionNumber: 2,
    variant: 'submitted',
    archivePreviousActive: false,
    replaceExistingVersion: false,
    connection,
  });

  assert.strictEqual(documentId, 9001, 'assessment document insert id should be returned');

  const linkInsert = connection.calls.find(call =>
    call.normalizedSql.startsWith('INSERT INTO iset_document_intervention')
  );
  assert(linkInsert, 'generated intervention assessment document should insert document-intervention links');
  assert.deepStrictEqual(
    linkInsert.params[0].map(row => row.slice(0, 2)),
    [
      [9001, 219],
      [9001, 220],
    ],
    'document-intervention links should be deduplicated and tied to the inserted document id'
  );
}

async function verifyProposalSyncPreservesSubmittedAt() {
  const connection = buildConnection();

  await syncInterventionProposalCompatibility({
    id: 220,
    case_id: 50,
    action_plan_id: 13,
    status: 'approved',
    delivery_status: 'planned',
    intervention_code: '3',
    intervention_cost: 2500,
    created_by_staff_profile_id: 54,
    reviewed_by_staff_profile_id: 51,
    created_at: '2026-06-30 18:29:16',
    updated_at: '2026-06-30 19:21:05',
    reviewed_at: '2026-06-30 19:21:05',
    metadata_json: JSON.stringify({
      title: 'Two-step review regression proposal',
      review: { decisionNotes: 'Approved by Decision Maker.' },
    }),
  }, connection);

  const upsert = connection.calls.find(call =>
    call.normalizedSql.startsWith('INSERT INTO iset_intervention_proposal')
  );
  assert(upsert, 'proposal compatibility sync should run the proposal upsert');
  assert(
    upsert.sql.includes('ELSE iset_intervention_proposal.submitted_at'),
    'proposal compatibility upsert must preserve existing submitted_at outside draft/new-submitted transitions'
  );
  assert(
    upsert.sql.includes("WHEN VALUES(review_status) = 'draft' THEN NULL"),
    'proposal compatibility upsert must still clear submitted_at for draft rows'
  );
  assert(
    upsert.sql.includes("WHEN VALUES(review_status) = 'submitted'"),
    'proposal compatibility upsert must refresh submitted_at when a row newly enters submitted status'
  );
}

(async () => {
  try {
    await verifyGeneratedAssessmentLinksInterventions();
    await verifyProposalSyncPreservesSubmittedAt();
    console.log('two-step review prevention regression passed');
  } finally {
    if (pool && typeof pool.end === 'function') {
      pool.end();
    }
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
