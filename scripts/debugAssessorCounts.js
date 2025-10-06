const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'iset_intake'
  });

  const [staff] = await pool.query(`SELECT id, cognito_sub, email, primary_role, region_id FROM staff_profiles ORDER BY id DESC LIMIT 20`);
  console.log('Recent staff profiles:');
  console.table(staff);

  const assessors = staff.filter(row => (row.primary_role || '').toLowerCase().replace(/\s+/g, '') === 'applicationassessor');

  const [assessorSummary] = await pool.query(
    `SELECT sp.id, sp.email, COALESCE(c.total, 0) AS assigned_cases
       FROM staff_profiles sp
       LEFT JOIN (
         SELECT assigned_to_user_id, COUNT(*) AS total
           FROM iset_case
          WHERE assigned_to_user_id IS NOT NULL
          GROUP BY assigned_to_user_id
       ) c ON c.assigned_to_user_id = sp.id
      WHERE LOWER(REPLACE(sp.primary_role, ' ', '')) = 'applicationassessor'
      ORDER BY assigned_cases DESC, sp.id ASC`
  );

  console.log('\nAssessor assignment summary:');
  console.table(assessorSummary);

  for (const row of assessorSummary) {
    if (Number(row.assigned_cases) <= 0) continue;
    const [cases] = await pool.query(
      `SELECT id, status, assigned_to_user_id, updated_at
         FROM iset_case
        WHERE assigned_to_user_id = ?
        ORDER BY updated_at DESC
        LIMIT 10`,
      [row.id]
    );
    console.log(`\nCases for assessor ${row.id} (${row.email}):`);
    console.table(cases);
  }

  const preferredId = assessorSummary.find(row => Number(row.assigned_cases) > 0)?.id
    || assessorSummary[0]?.id
    || assessors.find(row => row.email && !row.email.endsWith('@placeholder.local'))?.id
    || assessors[0]?.id;
  if (!preferredId) {
    console.log('No assessor profile found in recent rows.');
    process.exit(0);
  }

  const assessorMeta = assessorSummary.find(row => row.id === preferredId)
    || assessors.find(row => row.id === preferredId)
    || { email: 'unknown', id: preferredId };

  const assessorId = assessorMeta.id;
  console.log(`\nInspecting cases for assessor ${assessorId} (${assessorMeta.email})`);
  const [cases] = await pool.query(
    `SELECT id, application_id, status, assigned_to_user_id, updated_at
     FROM iset_case
     WHERE assigned_to_user_id = ?
     ORDER BY updated_at DESC
     LIMIT 20`,
    [assessorId]
  );
  console.table(cases);

  const [assignmentSummary] = await pool.query(
    `SELECT assigned_to_user_id AS assignee, COUNT(*) AS total
       FROM iset_case
      WHERE assigned_to_user_id IS NOT NULL
      GROUP BY assigned_to_user_id
      ORDER BY total DESC
      LIMIT 20`
  );

  console.log('\nTop assignee counts:');
  console.table(assignmentSummary);

  const placeholders = ['docs requested','action required','pending info','pending information','info requested','information requested','on hold','on_hold'];
  const [agg] = await pool.query(
    `SELECT
        SUM(CASE WHEN assigned_to_user_id = ? THEN 1 ELSE 0 END) AS assigned,
        SUM(CASE WHEN assigned_to_user_id = ? AND status IS NOT NULL AND LOWER(status) IN (${placeholders.map(()=>'?' ).join(',')} ) THEN 1 ELSE 0 END) AS awaiting_applicant
     FROM iset_case`,
    [assessorId, assessorId, ...placeholders]
  );
  console.log('\nAggregate counts:');
  console.table(agg);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
