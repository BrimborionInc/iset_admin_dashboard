#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const SIGNED_FORM_TYPES = [
  {
    documentType: 'ei_consent',
    payloadKeys: ['consent']
  },
  {
    documentType: 'iset_client_info_release',
    payloadKeys: [
      'auth_froici_sing',
      'auth_froici_sign',
      'authorization_for_release_of_iset_client_information'
    ]
  },
  {
    documentType: 'client_acknowledgement',
    payloadKeys: ['sig_caofs']
  },
  {
    documentType: 'indigenous_declaration',
    payloadKeys: ['indigenous_declaration']
  },
  {
    documentType: 'conflict_of_interest',
    payloadKeys: ['conflict_applicant_signature']
  }
];

const SIGNED_FORM_TYPE_SET = new Set(SIGNED_FORM_TYPES.map(item => item.documentType));

function parseArgs(argv) {
  const args = {
    mode: 'dry-run',
    portalRoot: process.env.PORTAL_ROOT || path.resolve(process.cwd(), '..', 'ISET-intake'),
    envFile: process.env.ENV_FILE || null,
    limit: null,
    delayMs: 250,
    references: [],
    applicationIds: [],
    json: true
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };
    if (arg === '--mode') {
      args.mode = next();
    } else if (arg === '--dry-run') {
      args.mode = 'dry-run';
    } else if (arg === '--apply') {
      args.mode = 'apply';
    } else if (arg === '--portal-root') {
      args.portalRoot = next();
    } else if (arg === '--env-file') {
      args.envFile = next();
    } else if (arg === '--limit') {
      args.limit = Number.parseInt(next(), 10);
    } else if (arg === '--delay-ms') {
      args.delayMs = Number.parseInt(next(), 10);
    } else if (arg === '--reference') {
      args.references.push(next());
    } else if (arg === '--application-id') {
      args.applicationIds.push(Number.parseInt(next(), 10));
    } else if (arg === '--text') {
      args.json = false;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['dry-run', 'apply'].includes(args.mode)) {
    throw new Error('--mode must be dry-run or apply');
  }
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  if (!Number.isInteger(args.delayMs) || args.delayMs < 0) {
    throw new Error('--delay-ms must be a non-negative integer');
  }
  args.applicationIds = args.applicationIds.filter(Number.isInteger);
  args.references = args.references.map(value => String(value || '').trim()).filter(Boolean);
  args.portalRoot = path.resolve(args.portalRoot);
  if (!args.envFile) {
    args.envFile = path.join(args.portalRoot, '.env');
  }
  args.envFile = path.resolve(args.envFile);
  return args;
}

function printUsage() {
  console.log(`Usage:
  node scripts/repair-missing-portal-signed-form-docs.js --dry-run --portal-root /opt/nwac/portal --env-file /opt/nwac/portal/.env
  node scripts/repair-missing-portal-signed-form-docs.js --apply --reference ISET-20260409-A85F59

Repairs missing portal-generated signed-form PDFs by regenerating them from
iset_application_submission.intake_payload and inserting missing iset_document
rows. Existing active documents are skipped.`);
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] || '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function safeJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function boolValue(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

function getSignedField(payload, payloadKeys) {
  if (!payload || typeof payload !== 'object') return null;
  for (const key of payloadKeys) {
    const value = payload[key];
    if (value && typeof value === 'object' && boolValue(value.signed)) return value;
  }
  return null;
}

function deriveApplicantName(payload, row) {
  if (payload && typeof payload === 'object') {
    const first = payload['first-name'] || payload.first_name || null;
    const last = payload['last-name'] || payload.last_name || null;
    const combined = [first, last].filter(Boolean).join(' ').trim();
    const preferred =
      payload['preferred-name'] ||
      payload.preferred_name ||
      payload['preferred-name-header'] ||
      null;
    const consentName = payload?.consent?.name || payload?.indigenous_declaration?.name || null;
    const fromPayload = (combined || preferred || consentName || '').trim();
    if (fromPayload) return fromPayload;
  }
  const fromClient = [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim();
  return fromClient || 'Applicant';
}

function sanitizeName(name) {
  const base = String(name || 'file')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base.slice(0, 80) || 'file';
}

function generateObjectKey(userId, fileName) {
  const prefix = process.env.OBJECT_KEY_PREFIX || 'uploads/';
  const now = new Date();
  const parts = [
    prefix.replace(/\/*$/, ''),
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    userId || 'applicant'
  ];
  return `${parts.join('/')}/${crypto.randomUUID()}-${sanitizeName(fileName)}`;
}

function createS3Client(portalRequire) {
  const { S3Client } = portalRequire('@aws-sdk/client-s3');
  const endpoint = process.env.OBJECT_ENDPOINT || undefined;
  const forcePathStyleEnv = process.env.OBJECT_FORCE_PATH_STYLE;
  const forcePathStyle = forcePathStyleEnv !== undefined
    ? !['false', '0', 'no', 'off'].includes(String(forcePathStyleEnv).toLowerCase())
    : Boolean(endpoint);
  const region = process.env.OBJECT_REGION || process.env.AWS_REGION || 'ca-central-1';
  const credentials = process.env.OBJECT_ACCESS_KEY && process.env.OBJECT_SECRET_KEY
    ? { accessKeyId: process.env.OBJECT_ACCESS_KEY, secretAccessKey: process.env.OBJECT_SECRET_KEY }
    : undefined;
  const options = { region };
  if (endpoint) options.endpoint = endpoint;
  if (forcePathStyle) options.forcePathStyle = true;
  if (credentials) options.credentials = credentials;
  return new S3Client(options);
}

async function uploadPdf({ portalRequire, s3Client, portalRoot, buffer, fileName, userId }) {
  const normalized = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const key = generateObjectKey(userId, fileName);
  const driver = process.env.UPLOAD_DRIVER || (process.env.UPLOAD_MODE === 's3' ? 's3' : 'fs');
  if (driver === 's3') {
    if (!process.env.OBJECT_BUCKET) throw new Error('OBJECT_BUCKET is required for s3 uploads');
    const { PutObjectCommand } = portalRequire('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.OBJECT_BUCKET,
      Key: key,
      Body: normalized,
      ContentType: 'application/pdf'
    }));
  } else {
    const target = path.join(portalRoot, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, normalized);
  }
  return {
    key,
    size: normalized.length,
    checksum: crypto.createHash('sha256').update(normalized).digest('hex')
  };
}

async function fetchPortalApplications(pool, args) {
  const where = [`JSON_UNQUOTE(JSON_EXTRACT(a.payload_json, '$.source')) = 'submission_auto_ingest'`];
  const params = [];
  if (args.references.length) {
    where.push(`s.reference_number IN (${args.references.map(() => '?').join(',')})`);
    params.push(...args.references);
  }
  if (args.applicationIds.length) {
    where.push(`a.id IN (${args.applicationIds.map(() => '?').join(',')})`);
    params.push(...args.applicationIds);
  }
  const limitSql = args.limit ? ' LIMIT ?' : '';
  if (args.limit) params.push(args.limit);
  const [rows] = await pool.query(
    `SELECT
        a.id AS application_id,
        a.case_id,
        a.client_id,
        a.status AS application_status,
        a.lifecycle_status,
        s.id AS submission_id,
        s.user_id AS applicant_user_id,
        s.reference_number,
        s.submitted_at,
        s.intake_payload,
        cl.first_name,
        cl.last_name
       FROM iset_application a
       JOIN iset_application_submission s ON s.id = a.submission_id
       LEFT JOIN client cl ON cl.id = a.client_id
      WHERE ${where.join(' AND ')}
      ORDER BY s.submitted_at, a.id${limitSql}`,
    params
  );
  return rows;
}

async function fetchExistingSignedDocs(pool, row) {
  const [rows] = await pool.query(
    `SELECT id, document_category, status, source, label, file_name, file_path, created_at, updated_at
       FROM iset_document
      WHERE document_category IN (${SIGNED_FORM_TYPES.map(() => '?').join(',')})
        AND status = 'active'
        AND (
          application_id = ?
          OR (application_id IS NULL AND case_id = ?)
          OR (application_id IS NULL AND case_id IS NULL AND client_id = ? AND applicant_user_id = ?)
        )`,
    [
      ...SIGNED_FORM_TYPES.map(item => item.documentType),
      row.application_id,
      row.case_id,
      row.client_id,
      row.applicant_user_id
    ]
  );
  return new Map(rows.map(doc => [doc.document_category, doc]));
}

async function insertGeneratedDocument(pool, { row, pdf, upload, runId }) {
  const label = (pdf.documentLabel || '').trim() || pdf.fileName;
  const metadata = JSON.stringify({
    label,
    document_type: pdf.documentType || null,
    generated_kind: 'signed_form',
    repaired_by: 'repair-missing-portal-signed-form-docs',
    repair_run_id: runId,
    source_submission_id: row.submission_id,
    source_reference_number: row.reference_number,
    signed_by: pdf.signedBy || null,
    signed_at: pdf.signedAt || null
  });
  const sql = `
    INSERT INTO iset_document (
      applicant_user_id,
      client_id,
      application_id,
      case_id,
      user_id,
      source,
      file_name,
      file_path,
      mime_type,
      label,
      metadata,
      size_bytes,
      checksum_sha256,
      status,
      document_category
    )
    VALUES (?,?,?,?,?, 'application_submission', ?, ?, 'application/pdf', ?, ?, ?, ?, 'active', ?)
    ON DUPLICATE KEY UPDATE
      applicant_user_id = VALUES(applicant_user_id),
      client_id = COALESCE(VALUES(client_id), client_id),
      application_id = VALUES(application_id),
      case_id = VALUES(case_id),
      user_id = VALUES(user_id),
      source = VALUES(source),
      label = VALUES(label),
      metadata = VALUES(metadata),
      mime_type = VALUES(mime_type),
      size_bytes = VALUES(size_bytes),
      checksum_sha256 = VALUES(checksum_sha256),
      document_category = VALUES(document_category),
      status = 'active',
      updated_at = NOW()
  `;
  await pool.query(sql, [
    row.applicant_user_id || null,
    row.client_id || null,
    row.application_id || null,
    row.case_id || null,
    row.applicant_user_id || null,
    pdf.fileName,
    upload.key,
    label,
    metadata,
    upload.size || null,
    upload.checksum || null,
    pdf.documentType || null
  ]);
  const [[inserted]] = await pool.query('SELECT id FROM iset_document WHERE file_path = ? LIMIT 1', [upload.key]);
  return inserted?.id || null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv);
  loadEnvFile(args.envFile);

  const portalRequire = createRequire(path.join(args.portalRoot, 'package.json'));
  const mysql = portalRequire('mysql2/promise');
  const { generateSignedFormPdfs } = portalRequire(path.join(args.portalRoot, 'pdf', 'signaturePdfs.js'));
  const s3Client = createS3Client(portalRequire);

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    namedPlaceholders: false
  });

  const runId = `signed-form-repair-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const summary = {
    mode: args.mode,
    runId,
    portalRoot: args.portalRoot,
    envFile: args.envFile,
    scannedApplications: 0,
    affectedApplications: 0,
    missingDocuments: 0,
    createdDocuments: 0,
    skippedExistingDocuments: 0,
    byDocumentType: Object.fromEntries(SIGNED_FORM_TYPES.map(item => [item.documentType, { missing: 0, created: 0 }])),
    affected: [],
    created: [],
    errors: []
  };

  try {
    const rows = await fetchPortalApplications(pool, args);
    summary.scannedApplications = rows.length;

    for (const row of rows) {
      const payload = safeJson(row.intake_payload, {});
      const existingDocs = await fetchExistingSignedDocs(pool, row);
      const missingTypes = [];
      const signedTypes = [];
      for (const formType of SIGNED_FORM_TYPES) {
        const signedField = getSignedField(payload, formType.payloadKeys);
        if (!signedField) continue;
        signedTypes.push(formType.documentType);
        if (existingDocs.has(formType.documentType)) {
          summary.skippedExistingDocuments += 1;
          continue;
        }
        missingTypes.push(formType.documentType);
      }
      if (!missingTypes.length) continue;

      summary.affectedApplications += 1;
      summary.missingDocuments += missingTypes.length;
      for (const docType of missingTypes) {
        summary.byDocumentType[docType].missing += 1;
      }
      summary.affected.push({
        applicationId: Number(row.application_id),
        caseId: row.case_id == null ? null : Number(row.case_id),
        clientId: row.client_id == null ? null : Number(row.client_id),
        applicantUserId: row.applicant_user_id == null ? null : Number(row.applicant_user_id),
        referenceNumber: row.reference_number,
        submittedAt: row.submitted_at,
        clientName: deriveApplicantName(payload, row),
        signedTypes,
        missingTypes
      });

      if (args.mode !== 'apply') continue;

      try {
        const pdfs = await generateSignedFormPdfs({
          applicationId: row.application_id,
          applicantName: deriveApplicantName(payload, row),
          answers: payload,
          submissionTimestamp: row.submitted_at,
          documentTypes: missingTypes
        });
        const pdfsByType = new Map((pdfs || []).map(pdf => [pdf.documentType, pdf]));
        for (const docType of missingTypes) {
          const pdf = pdfsByType.get(docType);
          if (!pdf?.buffer || !pdf.fileName || !SIGNED_FORM_TYPE_SET.has(pdf.documentType)) {
            throw new Error(`pdf_generation_missing:${row.reference_number}:${docType}`);
          }
          const upload = await uploadPdf({
            portalRequire,
            s3Client,
            portalRoot: args.portalRoot,
            buffer: pdf.buffer,
            fileName: pdf.fileName,
            userId: row.applicant_user_id
          });
          const documentId = await insertGeneratedDocument(pool, { row, pdf, upload, runId });
          summary.createdDocuments += 1;
          summary.byDocumentType[docType].created += 1;
          summary.created.push({
            documentId,
            applicationId: Number(row.application_id),
            caseId: row.case_id == null ? null : Number(row.case_id),
            referenceNumber: row.reference_number,
            documentType: docType,
            fileName: pdf.fileName,
            filePath: upload.key,
            sizeBytes: upload.size
          });
        }
      } catch (error) {
        summary.errors.push({
          applicationId: Number(row.application_id),
          referenceNumber: row.reference_number,
          message: error?.message || String(error)
        });
      }

      if (args.delayMs > 0) {
        await sleep(args.delayMs);
      }
    }
  } finally {
    await pool.end();
  }

  const output = args.json ? JSON.stringify(summary, null, 2) : summary;
  console.log(output);
  if (summary.errors.length) {
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    error: error?.message || String(error),
    stack: error?.stack || null
  }, null, 2));
  process.exit(1);
});
