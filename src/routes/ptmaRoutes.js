const express = require('express');
const { requireSystemAdministrator } = require('../middleware/requireSystemAdministrator');

function mapPtmaRow(db) {
  return {
    id: db.id,
    full_name: db.iset_full_name,
    code: db.iset_code,
    status: db.iset_status,
    province: db.iset_province,
    indigenous_group: db.iset_indigenous_group,
    full_address: db.iset_full_address,
    agreement_id: db.iset_agreement_id,
    notes: db.iset_notes,
    website_url: db.website_url || null,
    contact_name: db.contact_name || null,
    contact_email: db.contact_email || null,
    contact_phone: db.contact_phone || null,
    contact_notes: db.contact_notes || null,
  };
}

function createPtmaRouter({ pool, authorize = requireSystemAdministrator } = {}) {
  if (!pool || typeof pool.query !== 'function') {
    throw new TypeError('createPtmaRouter requires a database pool');
  }
  if (typeof authorize !== 'function') {
    throw new TypeError('createPtmaRouter requires an authorization middleware');
  }

  const router = express.Router();
  router.use(authorize);

  router.get('/', async (req, res) => {
    try {
      const type = req.query.type;
      let whereClause = '';
      let params = [];
      if (type === 'PTMA' || type === 'Hub') {
        whereClause = 'WHERE type = ?';
        params = [type];
      }
      const [ptmas] = await pool.query(`
        SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
        FROM ptma
        ${whereClause}
      `, params);
      const [applicationCounts] = await pool.query(`
        SELECT ptma_id, COUNT(*) AS applications
        FROM iset_case
        WHERE ptma_id IS NOT NULL
        GROUP BY ptma_id
      `);
      const [openCaseCounts] = await pool.query(`
        SELECT ptma_id, COUNT(*) AS cases
        FROM iset_case
        WHERE ptma_id IS NOT NULL AND status IN ('submitted','open')
        GROUP BY ptma_id
      `);
      const applicationsMap = Object.fromEntries(applicationCounts.map(row => [row.ptma_id, row.applications]));
      const casesMap = Object.fromEntries(openCaseCounts.map(row => [row.ptma_id, row.cases]));
      return res.status(200).json(ptmas.map(row => ({
        ...mapPtmaRow(row),
        applications: applicationsMap[row.id] || 0,
        cases: casesMap[row.id] || 0,
      })));
    } catch (error) {
      console.error('Error fetching PTMAs:', error);
      return res.status(500).send({ message: 'Failed to fetch PTMAs' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const [ptmas] = await pool.query(`
        SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
        FROM ptma
        WHERE id = ?
      `, [req.params.id]);
      if (ptmas.length === 0) {
        return res.status(404).send({ message: 'PTMA not found' });
      }
      return res.status(200).json(mapPtmaRow(ptmas[0]));
    } catch (error) {
      console.error('Error fetching PTMA:', error);
      return res.status(500).send({ message: 'Failed to fetch PTMA' });
    }
  });

  router.post('/', async (req, res) => {
    const {
      location,
      iset_full_name,
      iset_code,
      iset_status,
      iset_province,
      iset_indigenous_group,
      iset_full_address,
      iset_agreement_id,
      iset_notes,
      website_url,
      contact_name,
      contact_email,
      contact_phone,
      contact_notes,
    } = req.body;
    try {
      const [result] = await pool.query(`
        INSERT INTO ptma (name, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [location, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes]);
      const [newPtma] = await pool.query(`
        SELECT id, name AS location, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
        FROM ptma
        WHERE id = ?
      `, [result.insertId]);
      return res.status(201).send(newPtma[0]);
    } catch (error) {
      console.error('Error creating PTMA:', error);
      return res.status(500).send({ message: 'Failed to create PTMA' });
    }
  });

  router.put('/:id', async (req, res) => {
    const {
      full_name,
      code,
      status,
      province,
      indigenous_group,
      full_address,
      agreement_id,
      notes,
      website_url,
      contact_name,
      contact_email,
      contact_phone,
      contact_notes,
    } = req.body;
    try {
      await pool.query(`
        UPDATE ptma SET
          iset_full_name = ?,
          iset_code = ?,
          iset_status = ?,
          iset_province = ?,
          iset_indigenous_group = ?,
          iset_full_address = ?,
          iset_agreement_id = ?,
          iset_notes = ?,
          website_url = ?,
          contact_name = ?,
          contact_email = ?,
          contact_phone = ?,
          contact_notes = ?
        WHERE id = ?
      `, [full_name, code, status, province, indigenous_group, full_address, agreement_id, notes, website_url, contact_name, contact_email, contact_phone, contact_notes, req.params.id]);
      const [updatedPtma] = await pool.query(`
        SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
        FROM ptma
        WHERE id = ?
      `, [req.params.id]);
      return res.status(200).json(mapPtmaRow(updatedPtma[0]));
    } catch (error) {
      console.error('Error updating PTMA:', error);
      return res.status(500).send({ message: 'Failed to update PTMA' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM ptma WHERE id = ?', [req.params.id]);
      return res.status(200).send({ message: 'PTMA deleted successfully' });
    } catch (error) {
      console.error('Error deleting PTMA:', error);
      return res.status(500).send({ message: 'Failed to delete PTMA' });
    }
  });

  return router;
}

module.exports = {
  createPtmaRouter,
  mapPtmaRow,
};
