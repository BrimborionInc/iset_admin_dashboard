const mysql = require('mysql2/promise');
// Load .env (same logic as server)
try {
  const path = require('path');
  const dotenvPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '..', '.env.production')
    : path.join(__dirname, '..', '.env');
  require('dotenv').config({ path: dotenvPath });
} catch (_) {}
(async () => {
  try {
    const pool = await mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'iset',
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4_general_ci',
    });
    const count = Number(process.argv[2] || 8);
    const [evals] = await pool.query("SELECT id, primary_role AS role FROM staff_profiles WHERE primary_role IN ('Program Administrator','Application Assessor','ISET Coordinator')");
    let paId = evals.find(e => e.role === 'Program Administrator')?.id;
    let aaId = evals.find(e => e.role === 'Application Assessor' || e.role === 'ISET Coordinator')?.id;
    if (!paId) {
      const [r] = await pool.query("INSERT INTO staff_profiles (display_name, name, email, primary_role, status, created_at, updated_at) VALUES ('Pat Admin','Pat Admin','admin@example.com','Program Administrator','active',NOW(),NOW())");
      paId = r.insertId;
    }
    if (!aaId) {
      const [r] = await pool.query("INSERT INTO staff_profiles (display_name, name, email, primary_role, status, created_at, updated_at) VALUES ('Alex Assessor','Alex Assessor','assessor@example.com','Application Assessor','active',NOW(),NOW())");
      aaId = r.insertId;
    }
    let created = 0;
    for (let i = 0; i < count; i++) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const stamp = Date.now();
        const applicantName = `Applicant Demo ${stamp}-${i}`;
        const applicantEmail = `applicant${stamp}_${i}@example.com`;
        const [userRes] = await conn.query("INSERT INTO user (name, email, created_at) VALUES (?,?,NOW())", [applicantName, applicantEmail]);
        const trackingId = `TRK-${stamp}-${Math.floor(Math.random()*1000)}`;
        const firstName = 'Applicant';
        const lastName = `Demo ${stamp}-${i}`;
        const [clientRes] = await conn.query(
          "INSERT INTO client (last_name, first_name, initials, created_at, updated_at) VALUES (?,?,?,?,?)",
          [lastName, firstName, 'AD', new Date(), new Date()]
        );
        const clientId = clientRes.insertId;
        const assignedId = (i % 2 === 0) ? aaId : paId;
        const [caseRes] = await conn.query(
          "INSERT INTO iset_case (client_id, assigned_staff_profile_id, status, lifecycle_status, priority, stage, opened_at, created_at, updated_at) VALUES (?,?,?,?,?,?,NOW(),NOW(),NOW())",
          [clientId, assignedId, 'open', 'intake', 'medium', 'intake_review']
        );
        const caseId = caseRes.insertId;
        await conn.query(
          "INSERT INTO iset_application (client_id, case_id, payload_json, status, lifecycle_status, awaiting_reason, version, created_at, updated_at) VALUES (?,?,?,?,?,?,?,NOW(),NOW())",
          [
            clientId,
            caseId,
            JSON.stringify({
              source: 'seed_dev_cases',
              tracking_id: trackingId,
              applicant_user_id: userRes.insertId,
            }),
            'active',
            'submitted',
            'none',
            1,
          ]
        );
        await conn.commit();
        created++;
      } catch (rowErr) {
        try { await conn.rollback(); } catch (_) {}
        throw rowErr;
      } finally {
        conn.release();
      }
    }
    console.log(JSON.stringify({ seeded: created }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
