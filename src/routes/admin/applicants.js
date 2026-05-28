const express = require('express');
const router = express.Router();

const { requireRole } = require('../../middleware/authz');
const {
  changeApplicantAccountEmail,
  ensureApplicantAccountForClient,
  fetchActorStaffProfileId,
  fetchApplicantAccountRows,
  fetchApplicantAccountSummary,
  fetchPortalApplicantUsers,
  sendApplicantActivationInvitation,
} = require('../../lib/applicantAccountService');

function getDbPoolFromRequest(req) {
  const pool = req?.app?.locals?.pool;
  return pool && typeof pool.query === 'function' ? pool : null;
}

function sendRouteError(res, err, fallbackError) {
  const code = err?.code || fallbackError;
  const message = err?.message || 'Request failed';

  switch (code) {
    case 'client_not_found':
      return res.status(404).json({ error: code, message });
    case 'missing_applicant_pool':
    case 'missing_recipient_email':
    case 'applicant_email_missing':
    case 'invalid_account_email':
    case 'account_email_conflict':
    case 'account_not_created':
    case 'account_already_activated':
      return res.status(400).json({ error: code, message });
    default:
      return res.status(500).json({ error: fallbackError, message });
  }
}

router.get(
  '/applicants',
  requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager', 'ISET Coordinator'),
  async (req, res) => {
    try {
      const pool = getDbPoolFromRequest(req);
      if (!pool) {
        return res.status(500).json({ error: 'db_unavailable', message: 'Database pool unavailable.' });
      }

      const q = typeof req.query?.q === 'string' ? req.query.q : '';
      const status = typeof req.query?.status === 'string' ? req.query.status : '';
      const rows = await fetchApplicantAccountRows(pool, { q, status });
      return res.json({ source: 'client+cases', users: rows });
    } catch (err) {
      console.warn('[admin-applicants] list failed:', err?.message || err);
      return sendRouteError(res, err, 'admin_applicants_failed');
    }
  }
);

router.get(
  '/applicants/portal-users',
  requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager', 'ISET Coordinator'),
  async (req, res) => {
    try {
      const pool = getDbPoolFromRequest(req);
      if (!pool) {
        return res.status(500).json({ error: 'db_unavailable', message: 'Database pool unavailable.' });
      }

      const q = typeof req.query?.q === 'string' ? req.query.q : '';
      const rows = await fetchPortalApplicantUsers(pool, { q });
      return res.json({ source: 'user', users: rows });
    } catch (err) {
      console.warn('[admin-applicants] portal-user list failed:', err?.message || err);
      return sendRouteError(res, err, 'admin_portal_applicants_failed');
    }
  }
);

router.get(
  '/applicants/summary',
  requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager', 'ISET Coordinator'),
  async (req, res) => {
    try {
      const pool = getDbPoolFromRequest(req);
      if (!pool) {
        return res.status(500).json({ error: 'db_unavailable', message: 'Database pool unavailable.' });
      }

      const metrics = await fetchApplicantAccountSummary(pool);
      return res.json({ source: 'client', metrics });
    } catch (err) {
      console.warn('[admin-applicants] summary failed:', err?.message || err);
      return sendRouteError(res, err, 'admin_applicant_summary_failed');
    }
  }
);

router.post(
  '/applicants/:clientId/create-account',
  requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager', 'ISET Coordinator'),
  async (req, res) => {
    try {
      const pool = getDbPoolFromRequest(req);
      if (!pool) {
        return res.status(500).json({ error: 'db_unavailable', message: 'Database pool unavailable.' });
      }

      const clientId = Number(req.params.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        return res.status(400).json({ error: 'invalid_client_id', message: 'A valid client id is required.' });
      }

      const actorStaffProfileId = await fetchActorStaffProfileId(pool, req);
      const row = await ensureApplicantAccountForClient(pool, {
        clientId,
        actorStaffProfileId,
        source: 'manual_dashboard',
      });
      return res.json({ ok: true, user: row });
    } catch (err) {
      console.warn('[admin-applicants] create-account failed:', err?.message || err);
      return sendRouteError(res, err, 'admin_applicant_create_failed');
    }
  }
);

router.patch(
  '/applicants/:clientId/account-email',
  requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager', 'ISET Coordinator'),
  async (req, res) => {
    try {
      const pool = getDbPoolFromRequest(req);
      if (!pool) {
        return res.status(500).json({ error: 'db_unavailable', message: 'Database pool unavailable.' });
      }

      const clientId = Number(req.params.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        return res.status(400).json({ error: 'invalid_client_id', message: 'A valid client id is required.' });
      }

      const actorStaffProfileId = await fetchActorStaffProfileId(pool, req);
      const row = await changeApplicantAccountEmail(pool, {
        clientId,
        email: req.body?.email,
        actorStaffProfileId,
        source: 'case_header',
      });
      return res.json({ ok: true, user: row });
    } catch (err) {
      console.warn('[admin-applicants] account-email failed:', err?.message || err);
      return sendRouteError(res, err, 'admin_applicant_email_failed');
    }
  }
);

router.post(
  '/applicants/:clientId/send-activation',
  requireRole('System Administrator', 'NWAC Administrator', 'Regional Manager', 'ISET Coordinator'),
  async (req, res) => {
    try {
      const pool = getDbPoolFromRequest(req);
      if (!pool) {
        return res.status(500).json({ error: 'db_unavailable', message: 'Database pool unavailable.' });
      }

      const clientId = Number(req.params.clientId);
      if (!Number.isInteger(clientId) || clientId <= 0) {
        return res.status(400).json({ error: 'invalid_client_id', message: 'A valid client id is required.' });
      }

      const actorStaffProfileId = await fetchActorStaffProfileId(pool, req);
      const row = await sendApplicantActivationInvitation(pool, {
        clientId,
        actorStaffProfileId,
      });
      return res.json({ ok: true, user: row });
    } catch (err) {
      console.warn('[admin-applicants] send-activation failed:', err?.message || err);
      return sendRouteError(res, err, 'admin_applicant_invite_failed');
    }
  }
);

module.exports = router;
