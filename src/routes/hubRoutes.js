const express = require('express');
const { requireSystemAdministrator } = require('../middleware/requireSystemAdministrator');

function mapHubRow(row = {}) {
  return {
    id: row.id,
    full_name: row.iset_full_name,
    code: row.iset_code,
    status: row.iset_status,
    province: row.iset_province,
    indigenous_group: row.iset_indigenous_group,
    full_address: row.iset_full_address,
    agreement_id: row.iset_agreement_id,
    notes: row.iset_notes,
    website_url: row.website_url || null,
    contact_name: row.contact_name || null,
    contact_email: row.contact_email || null,
    contact_phone: row.contact_phone || null,
    contact_notes: row.contact_notes || null,
    applications: 0,
    cases: 0,
  };
}

const HUB_COLUMNS = `id, iset_full_name, iset_code, iset_status, iset_province,
  iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes,
  website_url, contact_name, contact_email, contact_phone, contact_notes`;

const HUB_UPDATE_COLUMNS = Object.freeze({
  full_name: 'iset_full_name',
  code: 'iset_code',
  status: 'iset_status',
  province: 'iset_province',
  indigenous_group: 'iset_indigenous_group',
  full_address: 'iset_full_address',
  agreement_id: 'iset_agreement_id',
  notes: 'iset_notes',
  website_url: 'website_url',
  contact_name: 'contact_name',
  contact_email: 'contact_email',
  contact_phone: 'contact_phone',
  contact_notes: 'contact_notes',
});

function createHubRouter({ pool, authorize = requireSystemAdministrator } = {}) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('createHubRouter requires a database pool');
  if (typeof authorize !== 'function') throw new TypeError('createHubRouter requires authorization middleware');
  const router = express.Router();
  router.use(authorize);

  router.get('/', async (_req, res) => {
    try {
      const [rows] = await pool.query(`SELECT ${HUB_COLUMNS} FROM ptma WHERE type = 'Hub' ORDER BY iset_full_name, id`);
      return res.json((rows || []).map(mapHubRow));
    } catch (error) {
      console.error('[hubs] list failed', error);
      return res.status(500).json({ error: 'hubs_fetch_failed' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const [[row]] = await pool.query(`SELECT ${HUB_COLUMNS} FROM ptma WHERE id = ? AND type = 'Hub' LIMIT 1`, [req.params.id]);
      if (!row) return res.status(404).json({ error: 'hub_not_found' });
      return res.json(mapHubRow(row));
    } catch (error) {
      console.error('[hubs] detail failed', error);
      return res.status(500).json({ error: 'hub_fetch_failed' });
    }
  });

  router.put('/:id', async (req, res) => {
    const body = req.body || {};
    const updates = Object.entries(HUB_UPDATE_COLUMNS)
      .filter(([field]) => Object.prototype.hasOwnProperty.call(body, field));
    if (!updates.length) return res.status(400).json({ error: 'hub_update_empty' });
    try {
      await pool.query(
        `UPDATE ptma SET ${updates.map(([, column]) => `${column} = ?`).join(', ')}
         WHERE id = ? AND type = 'Hub'`,
        [...updates.map(([field]) => body[field]), req.params.id]
      );
      const [[row]] = await pool.query(`SELECT ${HUB_COLUMNS} FROM ptma WHERE id = ? AND type = 'Hub' LIMIT 1`, [req.params.id]);
      if (!row) return res.status(404).json({ error: 'hub_not_found' });
      return res.json(mapHubRow(row));
    } catch (error) {
      console.error('[hubs] update failed', error);
      return res.status(500).json({ error: 'hub_update_failed' });
    }
  });

  return router;
}

module.exports = { createHubRouter, mapHubRow };
