#!/usr/bin/env node

/**
 * Idempotent DEV fixture seeder for the live privacy-denial smoke harness.
 *
 * This intentionally creates synthetic rows in DEV only. It does not run as a
 * migration and should not be used for TEST/PROD data preparation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FIXTURE_DIR = path.join(process.cwd(), 'tmp');
const FIXTURE_ENV_PATH = path.join(FIXTURE_DIR, 'privacy-denial-fixtures.env');

main().catch(error => {
  console.error(`FAIL privacy denial fixture seed failed: ${error?.message || error}`);
  process.exit(1);
});

async function main() {
  const applicantAToken = requiredEnv('PRIVACY_DENIAL_APPLICANT_A_TOKEN');
  const applicantBToken = requiredEnv('PRIVACY_DENIAL_APPLICANT_B_TOKEN');
  const staffToken =
    envToken('PRIVACY_DENIAL_STAFF_TOKEN') ||
    envToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN') ||
    '';

  const applicantA = decodeJwtPayload(applicantAToken);
  const applicantB = decodeJwtPayload(applicantBToken);
  const staff = staffToken ? decodeJwtPayload(staffToken) : {};

  const connection = await mysql.createConnection(getDbConfig());
  try {
    await connection.beginTransaction();

    const regions = await fetchFixtureRegions(connection, staff);
    const outOfScopeStaff = await ensureStaffProfile(connection, {
      cognitoSub: 'privacy-denial-out-of-scope-staff',
      email: 'privacy-denial-out-of-scope-staff@example.invalid',
      role: 'ISET Coordinator',
      regionId: regions.outOfScopeRegionId,
    });
    const inScopeStaff = await ensureStaffProfile(connection, {
      cognitoSub: normalizeString(staff.sub) || 'privacy-denial-in-scope-staff',
      email: normalizeString(staff.email || staff['cognito:username']) || 'privacy-denial-in-scope-staff@example.invalid',
      role: canonicalRole(staff.role) || 'Regional Manager',
      regionId: regions.staffRegionId,
    });
    const outOfScopeStaffUserId = await ensureLocalUser(connection, {
      email: outOfScopeStaff.email,
      name: 'Privacy Denial Out-of-Scope Staff',
      cognitoSub: `local-${outOfScopeStaff.cognitoSub}`.slice(0, 64),
    });

    const applicantAFixture = await ensureApplicantFixture(connection, {
      label: 'A',
      tokenPayload: applicantA,
      ownerStaffProfileId: outOfScopeStaff.id,
      portfolioRegionId: regions.outOfScopeRegionId,
    });
    const applicantBFixture = await ensureApplicantFixture(connection, {
      label: 'B',
      tokenPayload: applicantB,
      ownerStaffProfileId: inScopeStaff.id,
      portfolioRegionId: regions.staffRegionId,
    });

    const portalDocumentId = await ensurePortalDocumentFixture(connection, applicantAFixture);
    const portalMessageId = await ensureApplicantMessageFixture(connection, {
      applicant: applicantAFixture,
      staffProfile: outOfScopeStaff,
      staffUserId: outOfScopeStaffUserId,
    });
    const adminDocumentId = await ensureAdminDocumentFixture(connection, {
      applicant: applicantAFixture,
      staffUserId: outOfScopeStaffUserId,
    });
    const paymentPacketId = await ensurePaymentPacketFixture(connection, {
      applicant: applicantAFixture,
      requesterUserId: outOfScopeStaffUserId,
    });

    await connection.commit();

    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
    fs.writeFileSync(
      FIXTURE_ENV_PATH,
      [
        `PRIVACY_DENIAL_PORTAL_DOCUMENT_ID=${portalDocumentId}`,
        `PRIVACY_DENIAL_PORTAL_MESSAGE_ID=${portalMessageId}`,
        `PRIVACY_DENIAL_ADMIN_CASE_ID=${applicantAFixture.caseId}`,
        `PRIVACY_DENIAL_ADMIN_APPLICATION_ID=${applicantAFixture.applicationId}`,
        `PRIVACY_DENIAL_ADMIN_DOCUMENT_ID=${adminDocumentId}`,
        `PRIVACY_DENIAL_PAYMENT_PACKET_ID=${paymentPacketId}`,
        '',
      ].join('\n')
    );

    console.log('Seeded privacy denial DEV fixtures:');
    console.log(`  applicant A user ${applicantAFixture.userId}, case ${applicantAFixture.caseId}, application ${applicantAFixture.applicationId}`);
    console.log(`  applicant B user ${applicantBFixture.userId}, case ${applicantBFixture.caseId}, application ${applicantBFixture.applicationId}`);
    console.log(`  portal document ${portalDocumentId}, portal message ${portalMessageId}`);
    console.log(`  admin document ${adminDocumentId}, payment packet ${paymentPacketId}`);
    console.log(`  wrote ${path.relative(process.cwd(), FIXTURE_ENV_PATH)}`);
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.end().catch(() => {});
  }
}

async function fetchFixtureRegions(connection, staffPayload) {
  const staffRegionId =
    positiveInteger(staffPayload.region_id) ||
    positiveInteger(staffPayload['custom:region_id']) ||
    11;
  const [[otherRegion]] = await connection.query(
    'SELECT region_id FROM canada_region WHERE region_id <> ? ORDER BY region_id ASC LIMIT 1',
    [staffRegionId]
  );
  if (!otherRegion) throw new Error('No out-of-scope canada_region row is available');
  return {
    staffRegionId,
    outOfScopeRegionId: positiveInteger(otherRegion.region_id),
  };
}

async function ensureApplicantFixture(connection, { label, tokenPayload, ownerStaffProfileId, portfolioRegionId }) {
  const cognitoSub = requiredString(tokenPayload.sub, `applicant ${label} token sub`);
  const email = requiredString(tokenPayload.username || tokenPayload.email, `applicant ${label} token username/email`).toLowerCase();
  const userId = await ensureLocalUser(connection, {
    email,
    name: `Privacy Denial Applicant ${label}`,
    cognitoSub,
  });
  const clientId = await ensureClient(connection, {
    label,
    cognitoSub,
    email,
  });
  const submissionId = await ensureSubmission(connection, {
    label,
    userId,
    email,
  });
  const caseId = await ensureCase(connection, {
    label,
    clientId,
    assignedStaffProfileId: ownerStaffProfileId,
    portfolioRegionId,
  });
  const applicationId = await ensureApplication(connection, {
    label,
    submissionId,
    clientId,
    caseId,
  });
  return { label, userId, clientId, submissionId, caseId, applicationId, email, cognitoSub };
}

async function ensureLocalUser(connection, { email, name, cognitoSub }) {
  const [[existingBySub]] = cognitoSub
    ? await connection.query('SELECT id FROM `user` WHERE cognito_sub = ? LIMIT 1', [cognitoSub])
    : [[]];
  if (existingBySub?.id) return Number(existingBySub.id);

  const [[existingByEmail]] = await connection.query('SELECT id FROM `user` WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
  if (existingByEmail?.id) {
    if (cognitoSub) {
      await connection.query(
        'UPDATE `user` SET cognito_sub = COALESCE(cognito_sub, ?), name = COALESCE(name, ?), email_verified = 1 WHERE id = ?',
        [cognitoSub, name, existingByEmail.id]
      );
    }
    return Number(existingByEmail.id);
  }

  const [result] = await connection.query(
    `INSERT INTO \`user\`
      (name, email, cognito_sub, email_verified, preferred_language, notification_preferences)
     VALUES (?, ?, ?, 1, 'en', JSON_OBJECT())`,
    [name, email, cognitoSub || null]
  );
  return Number(result.insertId);
}

async function ensureStaffProfile(connection, { cognitoSub, email, role, regionId }) {
  const [[existingBySub]] = await connection.query('SELECT id FROM staff_profiles WHERE cognito_sub = ? LIMIT 1', [cognitoSub]);
  const [[existingByEmail]] = existingBySub
    ? [[]]
    : await connection.query('SELECT id FROM staff_profiles WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
  const existing = existingBySub || existingByEmail || null;
  if (existing?.id) {
    await connection.query(
      `UPDATE staff_profiles
          SET cognito_sub = ?,
              email = ?,
              primary_role = ?,
              region_id = ?,
              display_name = COALESCE(display_name, ?),
              name = COALESCE(name, ?)
        WHERE id = ?`,
      [cognitoSub, email, role, regionId, email, email, existing.id]
    );
    return { id: Number(existing.id), cognitoSub, email, role, regionId };
  }

  const [result] = await connection.query(
    `INSERT INTO staff_profiles
      (cognito_sub, email, name, display_name, primary_role, status, region_id)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [cognitoSub, email, email, email, role, regionId]
  );
  return { id: Number(result.insertId), cognitoSub, email, role, regionId };
}

async function ensureClient(connection, { label, cognitoSub, email }) {
  const [[existingBySub]] = await connection.query(
    'SELECT id FROM client WHERE applicant_cognito_sub = ? LIMIT 1',
    [cognitoSub]
  );
  if (existingBySub?.id) return Number(existingBySub.id);

  const [[existingByEmail]] = await connection.query(
    'SELECT id FROM client WHERE LOWER(applicant_account_email) = LOWER(?) LIMIT 1',
    [email]
  );
  if (existingByEmail?.id) {
    await connection.query(
      `UPDATE client
          SET applicant_cognito_sub = COALESCE(applicant_cognito_sub, ?),
              applicant_cognito_username = COALESCE(applicant_cognito_username, ?),
              applicant_account_status = 'activated',
              applicant_account_email = ?
        WHERE id = ?`,
      [cognitoSub, email, email, existingByEmail.id]
    );
    return Number(existingByEmail.id);
  }

  const [result] = await connection.query(
    `INSERT INTO client
      (first_name, last_name, applicant_cognito_sub, applicant_cognito_username, applicant_account_status, applicant_account_email, applicant_activated_at)
     VALUES (?, ?, ?, ?, 'activated', ?, NOW())`,
    [`Privacy${label}`, 'Denial Fixture', cognitoSub, email, email]
  );
  return Number(result.insertId);
}

async function ensureSubmission(connection, { label, userId, email }) {
  const referenceNumber = `PRIVDENIAL-${label}-${userId}`;
  const [[existing]] = await connection.query(
    'SELECT id FROM iset_application_submission WHERE reference_number = ? LIMIT 1',
    [referenceNumber]
  );
  if (existing?.id) return Number(existing.id);

  const payload = {
    fixture: 'privacy-denial-smoke',
    label,
    email,
  };
  const [result] = await connection.query(
    `INSERT INTO iset_application_submission
      (user_id, workflow_id, reference_number, status, intake_payload, schema_snapshot, history, doc_refs, locale)
     VALUES (?, 'privacy-denial-smoke', ?, 'submitted', CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
    [userId, referenceNumber, JSON.stringify(payload), JSON.stringify({ fields: {} }), JSON.stringify([]), JSON.stringify([])]
  );
  return Number(result.insertId);
}

async function ensureCase(connection, { label, clientId, assignedStaffProfileId, portfolioRegionId }) {
  const caseNumber = `PRIVDENIAL-${label}-${clientId}`;
  const [[existing]] = await connection.query('SELECT id FROM iset_case WHERE case_number = ? LIMIT 1', [caseNumber]);
  if (existing?.id) {
    await connection.query(
      `UPDATE iset_case
          SET client_id = ?,
              assigned_staff_profile_id = ?,
              portfolio_region_id = ?,
              status = 'open',
              lifecycle_status = 'active',
              updated_at = NOW()
        WHERE id = ?`,
      [clientId, assignedStaffProfileId, portfolioRegionId, existing.id]
    );
    return Number(existing.id);
  }

  const [result] = await connection.query(
    `INSERT INTO iset_case
      (case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage, portfolio_region_id, opened_at, case_context_json)
     VALUES (?, ?, ?, 'open', 'active', 'privacy_denial_smoke', ?, NOW(), CAST(? AS JSON))`,
    [caseNumber, clientId, assignedStaffProfileId, portfolioRegionId, JSON.stringify({ fixture: 'privacy-denial-smoke', label })]
  );
  return Number(result.insertId);
}

async function ensureApplication(connection, { label, submissionId, clientId, caseId }) {
  const [[existing]] = await connection.query(
    'SELECT id FROM iset_application WHERE submission_id = ? LIMIT 1',
    [submissionId]
  );
  if (existing?.id) {
    await connection.query(
      `UPDATE iset_application
          SET client_id = ?,
              case_id = ?,
              status = 'active',
              lifecycle_status = 'submitted',
              updated_at = NOW()
        WHERE id = ?`,
      [clientId, caseId, existing.id]
    );
    return Number(existing.id);
  }

  const [result] = await connection.query(
    `INSERT INTO iset_application
      (submission_id, client_id, case_id, payload_json, status, lifecycle_status, awaiting_reason)
     VALUES (?, ?, ?, CAST(? AS JSON), 'active', 'submitted', 'none')`,
    [submissionId, clientId, caseId, JSON.stringify({ fixture: 'privacy-denial-smoke', label })]
  );
  return Number(result.insertId);
}

async function ensurePortalDocumentFixture(connection, applicant) {
  const filePath = `privacy-denial-smoke/applicant-${applicant.label.toLowerCase()}-portal-document.txt`;
  const [[existing]] = await connection.query(
    'SELECT id FROM iset_application_file WHERE file_path = ? LIMIT 1',
    [filePath]
  );
  if (existing?.id) {
    await connection.query(
      `UPDATE iset_application_file
          SET user_id = ?,
              original_filename = ?,
              document_type = 'privacy_denial_smoke',
              status = 'clean',
              virus_scan_status = 'clean',
              detected_mime = 'text/plain'
        WHERE id = ?`,
      [applicant.userId, `privacy-denial-applicant-${applicant.label}.txt`, existing.id]
    );
    return Number(existing.id);
  }
  const [result] = await connection.query(
    `INSERT INTO iset_application_file
      (user_id, file_path, original_filename, document_type, status, virus_scan_status, detected_mime, scan_notes)
     VALUES (?, ?, ?, 'privacy_denial_smoke', 'clean', 'clean', 'text/plain', 'privacy denial smoke fixture')`,
    [applicant.userId, filePath, `privacy-denial-applicant-${applicant.label}.txt`]
  );
  return Number(result.insertId);
}

async function ensureApplicantMessageFixture(connection, { applicant, staffProfile, staffUserId }) {
  const subject = `Privacy denial smoke applicant ${applicant.label}`;
  const [[existing]] = await connection.query(
    'SELECT id FROM messages WHERE case_id = ? AND subject = ? LIMIT 1',
    [applicant.caseId, subject]
  );
  let messageId = existing?.id ? Number(existing.id) : null;
  if (!messageId) {
    const [result] = await connection.query(
      `INSERT INTO messages
        (sender_actor_type, sender_user_id, sender_staff_profile_id, recipient_actor_type, recipient_user_id, recipient_staff_profile_id, case_id, application_id, subject, body, status, urgent)
       VALUES ('staff_profile', ?, ?, 'applicant_user', ?, NULL, ?, ?, ?, 'Privacy denial smoke fixture message.', 'unread', 0)`,
      [staffUserId, staffProfile.id, applicant.userId, applicant.caseId, applicant.applicationId, subject]
    );
    messageId = Number(result.insertId);
  }
  await connection.query(
    `INSERT INTO message_item (message_id, owner_user_id, folder, folder_before_deleted, read_at, deleted_at, purged_at)
     VALUES (?, ?, 'inbox', NULL, NULL, NULL, NULL)
     ON DUPLICATE KEY UPDATE folder = 'inbox', purged_at = NULL`,
    [messageId, applicant.userId]
  );
  return messageId;
}

async function ensureAdminDocumentFixture(connection, { applicant, staffUserId }) {
  const filePath = `privacy-denial-smoke/admin-document-${applicant.label.toLowerCase()}.pdf`;
  const [[existing]] = await connection.query(
    'SELECT id FROM iset_document WHERE file_path = ? LIMIT 1',
    [filePath]
  );
  if (existing?.id) {
    await connection.query(
      `UPDATE iset_document
          SET user_id = ?,
              applicant_user_id = ?,
              client_id = ?,
              application_id = ?,
              case_id = ?,
              source = 'manual_upload',
              status = 'active',
              visibility = 'internal'
        WHERE id = ?`,
      [staffUserId, applicant.userId, applicant.clientId, applicant.applicationId, applicant.caseId, existing.id]
    );
    return Number(existing.id);
  }
  const [result] = await connection.query(
    `INSERT INTO iset_document
      (user_id, applicant_user_id, client_id, application_id, case_id, source, file_name, file_path, mime_type, label, metadata, status, document_category, visibility)
     VALUES (?, ?, ?, ?, ?, 'manual_upload', ?, ?, 'application/pdf', 'Privacy denial smoke', CAST(? AS JSON), 'active', 'privacy_denial_smoke', 'internal')`,
    [
      staffUserId,
      applicant.userId,
      applicant.clientId,
      applicant.applicationId,
      applicant.caseId,
      `privacy-denial-admin-${applicant.label}.pdf`,
      filePath,
      JSON.stringify({ fixture: 'privacy-denial-smoke' }),
    ]
  );
  return Number(result.insertId);
}

async function ensurePaymentPacketFixture(connection, { applicant, requesterUserId }) {
  const [[existing]] = await connection.query(
    `SELECT id
       FROM payment_packet
      WHERE case_id = ?
        AND JSON_UNQUOTE(JSON_EXTRACT(COALESCE(metadata, JSON_OBJECT()), '$.fixture')) = 'privacy-denial-smoke'
      LIMIT 1`,
    [applicant.caseId]
  );
  if (existing?.id) {
    await connection.query(
      `UPDATE payment_packet
          SET client_id = ?,
              requester_user_id = ?,
              status = 'draft',
              metadata = CAST(? AS JSON),
              updated_at = NOW()
        WHERE id = ?`,
      [applicant.clientId, requesterUserId, JSON.stringify({ fixture: 'privacy-denial-smoke' }), existing.id]
    );
    return Number(existing.id);
  }
  const [result] = await connection.query(
    `INSERT INTO payment_packet
      (case_id, client_id, reporting_unit, status, requester_user_id, notes_internal, metadata)
     VALUES (?, ?, 'privacy-denial-smoke', 'draft', ?, 'Privacy denial smoke fixture', CAST(? AS JSON))`,
    [applicant.caseId, applicant.clientId, requesterUserId, JSON.stringify({ fixture: 'privacy-denial-smoke' })]
  );
  return Number(result.insertId);
}

function getDbConfig() {
  const host = normalizeString(process.env.DB_HOST);
  const user = normalizeString(process.env.DB_USER);
  const database = normalizeString(process.env.DB_NAME);
  if (!host || !user || !database) {
    throw new Error('DB_HOST, DB_USER, and DB_NAME are required');
  }
  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user,
    password: process.env.DB_PASS || '',
    database,
  };
}

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) throw new Error('Invalid JWT supplied');
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function requiredEnv(name) {
  const value = envToken(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function envToken(name) {
  return normalizeString(process.env[name]);
}

function requiredString(value, label) {
  const normalized = normalizeString(value);
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function canonicalRole(role) {
  const normalized = normalizeString(role).replace(/_/g, ' ');
  return normalized || null;
}
