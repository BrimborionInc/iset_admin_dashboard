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
    });
    const count = Number(process.argv[2] || 8);
    const [evals] = await pool.query("SELECT id, role FROM iset_evaluators WHERE role IN ('Program Administrator','Application Assessor')");
    let paId = evals.find(e => e.role === 'Program Administrator')?.id;
    let aaId = evals.find(e => e.role === 'Application Assessor')?.id;
    if (!paId) {
      const [r] = await pool.query("INSERT INTO iset_evaluators (name, email, role, status, created_at) VALUES ('Pat Admin','admin@example.com','Program Administrator','active',NOW())");
      paId = r.insertId;
    }
    if (!aaId) {
      const [r] = await pool.query("INSERT INTO iset_evaluators (name, email, role, status, created_at) VALUES ('Alex Assessor','assessor@example.com','Application Assessor','active',NOW())");
      aaId = r.insertId;
    }
    let created = 0;
    for (let i = 0; i < count; i++) {
      const applicantName = `Applicant Demo ${Date.now()}-${i}`;
      const applicantEmail = `applicant${Date.now()}_${i}@example.com`;
      const [userRes] = await pool.query("INSERT INTO user (name, email, created_at) VALUES (?,?,NOW())", [applicantName, applicantEmail]);
      const userId = userRes.insertId;
      const trackingId = `TRK-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const [appRes] = await pool.query("INSERT INTO iset_application (user_id, tracking_id, created_at) VALUES (?,?,NOW())", [userId, trackingId]);
      const applicationId = appRes.insertId;
      const assignedId = (i % 2 === 0) ? aaId : paId;
      await pool.query("INSERT INTO iset_case (application_id, assigned_to_user_id, status, priority, stage, opened_at) VALUES (?,?,?,?,?,NOW())", [applicationId, assignedId, 'open', 'medium', 'intake_review']);
      created++;
    }
    console.log(JSON.stringify({ seeded: created }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
