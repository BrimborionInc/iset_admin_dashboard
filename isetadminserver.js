const path = require('path');
const { maskName } = require('./src/utils/utils'); // Update the import statement
const nunjucks = require("nunjucks");

// Configure Nunjucks to use GOV.UK Frontend components
nunjucks.configure("node_modules/govuk-frontend/dist/", {
  autoescape: true,
  watch: false,
  noCache: true,
});

// Define the generateGUID function
const generateGUID = () => {
  return Math.random().toString(36).substring(2, 11).toUpperCase();
};

// Use dynamic path based on the environment
const dotenvPath = process.env.NODE_ENV === 'production'
  ? '/home/ec2-user/admin-dashboard/.env'  // Path for production
  : path.resolve(__dirname, '.env');  // Use local .env for development

require('dotenv').config({ path: dotenvPath });

console.log("Loaded .env from:", dotenvPath);  // Debugging log
console.log("CORS Allowed Origin:", process.env.ALLOWED_ORIGIN);

// Set a default value for ALLOWED_ORIGIN in development if not set in .env
if (process.env.NODE_ENV !== 'production' && !process.env.ALLOWED_ORIGIN) {
  process.env.ALLOWED_ORIGIN = 'http://localhost:3000';  // Default for dev
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5001; // Use port from .env

app.use(bodyParser.json());

app.use('/api/', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});


const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

const pool = mysql.createPool(dbConfig);

/**
 * GET /api/intake-officers
 *
 * Returns all evaluators (both roles) with their PTMA assignments (if any).
 * - Only active evaluators are included.
 * - If an evaluator has multiple PTMAs, they appear once per PTMA.
 * - If an evaluator has no PTMA, ptma fields are null and label is 'Not assigned to a PTMA'.
 */
app.get('/api/intake-officers', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id AS evaluator_id,
        e.name AS evaluator_name,
        e.email AS evaluator_email,
        e.role AS evaluator_role,
        p.id AS ptma_id,
        p.name AS ptma_name,
        p.iset_code AS ptma_code,
        p.iset_full_name AS ptma_full_name,
        p.iset_status AS ptma_status,
        p.iset_province AS ptma_province,
        p.iset_indigenous_group AS ptma_indigenous_group,
        IFNULL(p.name, 'Not assigned to a PTMA') AS ptma_label
      FROM iset_evaluators e
      LEFT JOIN iset_evaluator_ptma ep ON e.id = ep.evaluator_id AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())
      LEFT JOIN ptma p ON ep.ptma_id = p.id
      WHERE e.status = 'active'
      ORDER BY e.name, p.name
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching intake officers:', error);
    res.status(500).json({ error: 'Failed to fetch intake officers' });
  }
});


/**
 * POST /api/cases
 *
 * Creates a new ISET case for a submitted application and assigns it to a specific evaluator (from iset_evaluators).
 *
 * Expected JSON body:
 * {
 *   application_id: number,          // ID from iset_application
 *   assigned_to_user_id: number,     // Evaluator (iset_evaluators.id)
 *   ptma_id: number | null,          // PTMA (ptma.id) or null
 *   priority: 'low' | 'medium' | 'high' (optional) // Defaults to 'medium'
 * }
 *
 * Behavior:
 * - Checks if a case already exists for the given application_id.
 * - If so, returns 409 Conflict.
 * - If not, inserts a new row into iset_case with:
 *     - status: 'open'
 *     - stage: 'intake_review'
 *     - opened_at: now (default in schema)
 *     - priority: provided or 'medium'
 *     - application_id, assigned_to_user_id, ptma_id as given
 */
app.post('/api/cases', async (req, res) => {
  const { application_id, assigned_to_user_id, ptma_id = null, priority = 'medium' } = req.body;

  if (!application_id || !assigned_to_user_id) {
    return res.status(400).json({ error: 'Missing required fields: application_id and assigned_to_user_id' });
  }

  try {
    // Check for existing case
    const [existing] = await pool.query(
      `SELECT id FROM iset_case WHERE application_id = ?`,
      [application_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'A case already exists for this application.' });
    }

    // Create new case (assigned_to_user_id now refers to iset_evaluators.id)
    const [result] = await pool.query(
      `INSERT INTO iset_case (
        application_id, assigned_to_user_id, ptma_id, status, priority, stage, opened_at
      ) VALUES (?, ?, ?, 'open', ?, 'intake_review', NOW())`,
      [application_id, assigned_to_user_id, ptma_id, priority]
    );

    const case_id = result.insertId;

    // Get applicant user_id for this application
    const [[appRow]] = await pool.query(
      'SELECT user_id FROM iset_application WHERE id = ?',
      [application_id]
    );
    if (!appRow) {
      return res.status(500).json({ error: 'Application not found after case creation' });
    }
    const applicant_user_id = appRow.user_id;

    // Get all files for this application/applicant
    const [files] = await pool.query(
      'SELECT * FROM iset_application_file WHERE user_id = ? AND file_path IS NOT NULL',
      [applicant_user_id]
    );

    // Insert each file into iset_case_document
    for (const file of files) {
      await pool.query(
        `INSERT INTO iset_case_document (case_id, uploaded_by_user_id, file_name, file_path, label, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          case_id,
          file.user_id,
          file.original_filename,
          file.file_path,
          file.document_type,
          file.uploaded_at || new Date()
        ]
      );
    }

    // Remove the files from iset_application_file
    if (files.length > 0) {
      const fileIds = files.map(f => f.id);
      await pool.query(
        `DELETE FROM iset_application_file WHERE id IN (${fileIds.map(() => '?').join(',')})`,
        fileIds
      );
    }

    // Log case assignment event
    const event_type = 'case_assigned';
    // Fetch evaluator name and PTMA code for event message
    let evaluatorName = '';
    let ptmaCode = '';
    try {
      const [[evalRow]] = await pool.query(
        'SELECT name FROM iset_evaluators WHERE id = ?',
        [assigned_to_user_id]
      );
      evaluatorName = evalRow ? evalRow.name : '';
      if (ptma_id) {
        const [[ptmaRow]] = await pool.query(
          'SELECT iset_code FROM ptma WHERE id = ?',
          [ptma_id]
        );
        ptmaCode = ptmaRow ? ptmaRow.iset_code : '';
      }
    } catch (e) {
      evaluatorName = '';
      ptmaCode = '';
    }
    const event_data = {
      message: `Case assigned to ${evaluatorName} of ${ptmaCode} with priority ${priority}`,
      application_id,
      assigned_to_user_id,
      assigned_to_user_name: evaluatorName,
      ptma_id,
      ptma_code: ptmaCode,
      priority,
      timestamp: new Date().toISOString()
    };
    await pool.query(
      'INSERT INTO iset_case_event (case_id, user_id, event_type, event_data, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [case_id, applicant_user_id, event_type, JSON.stringify(event_data)]
    );

    res.status(201).json({ message: 'Case created', case_id });
  } catch (error) {
    console.error('Error creating case:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * GET /api/case-assignment/unassigned-applications
 *
 * Returns a list of applications that have been submitted but not yet assigned
 * to a case (i.e. no record exists in the iset_case table for them).
 *
 * Each result includes:
 * - application_id
 * - submission timestamp
 * - applicant name and email
 * - program type
 */
app.get('/api/case-assignment/unassigned-applications', async (req, res) => {
  try {
    // Run a query to find all submitted applications that don't yet have a case
    const [rows] = await pool.query(`
      SELECT 
        a.id AS application_id,
        a.created_at AS submitted_at,
        u.name AS applicant_name,
        u.email,
        a.tracking_id
      FROM iset_application a
      JOIN user u ON a.user_id = u.id
      LEFT JOIN iset_case c ON a.id = c.application_id
      WHERE c.id IS NULL
      ORDER BY a.created_at DESC;
    `);

    // Send results to the frontend
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching unassigned applications:', err);
    res.status(500).json({ error: 'Failed to fetch unassigned applications' });
  }
});


/**
 * GET /api/tasks
 *
 * Returns all open tasks assigned to the authenticated caseworker (hard‑coded to user_id = 18 for now).
 *
 * Response fields:
 * - id
 * - case_id
 * - title
 * - description
 * - due_date
 * - priority
 * - status
 * - source
 * - remind_at
 * - snoozed_until
 * - repeat_interval_days
 * - tracking_id
 */
app.get('/api/tasks', async (req, res) => {
  const userId = 18; // replace with req.user.id when auth is active
  try {
    const [rows] = await pool.query(
      `SELECT
         t.id,
         t.case_id,
         t.title,
         t.description,
         t.due_date,
         t.priority,
         t.status,
         t.source,
         t.remind_at,
         t.snoozed_until,
         t.repeat_interval_days,
         a.tracking_id  -- Include tracking_id from iset_application
       FROM iset_case_task t
       JOIN iset_case c ON t.case_id = c.id
       JOIN iset_application a ON c.application_id = a.id
       WHERE t.assigned_to_user_id = ? 
         AND t.status IN ('open', 'in_progress')
       ORDER BY 
         t.priority = 'high' DESC,
         t.due_date < CURDATE() DESC,
         t.due_date ASC`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});


///Casework Task Scheduler
const generateSystemTasks = async () => {
  try {
    // Fetch all 'documents_overdue' events
    const [events] = await pool.query(
      `SELECT e.id, e.case_id, e.event_type, e.event_data, e.created_at, a.tracking_id
       FROM iset_case_event e
       JOIN iset_case c ON e.case_id = c.id
       JOIN iset_application a ON c.application_id = a.id
       WHERE e.event_type = 'documents_overdue'`
    );

    for (const event of events) {
      const { case_id, event_data, tracking_id } = event;
      const data =
        typeof event_data === 'string' ? JSON.parse(event_data) : event_data || {};

      // Check if a task already exists for this case
      const [existingTask] = await pool.query(
        `SELECT id FROM iset_case_task WHERE case_id = ? AND title = 'Request missing documents' AND status != 'completed'`,
        [case_id]
      );

      if (existingTask.length === 0) {
        // No task exists, create a new one
        const title = 'Request missing documents';
        const description = `Follow up with applicant to submit ${data.missing.join(', ')}`;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 2); // Due in 2 days

        await pool.query(
          `INSERT INTO iset_case_task (
            case_id, assigned_to_user_id, title, description, due_date, priority, status, source, created_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            case_id,
            18, // Assign to caseworker 18, you can modify this based on case assignment logic
            title,
            description,
            dueDate,
            'high',
            'open',
            'system',
            null // If system-generated, created_by_user_id can be NULL
          ]
        );

        console.log(`Task created for case ${tracking_id}: ${title}`);
      }
    }
  } catch (err) {
    console.error('Error generating system tasks:', err);
  }
};

app.get('/api/applicants/:id/documents', async (req, res) => {
  const applicantId = req.params.id;
  try {
    // Query all documents uploaded by this user (applicant), regardless of case_id
    const [rows] = await pool.query(
      `SELECT id, case_id, uploaded_by_user_id, file_name, file_path, label, uploaded_at
       FROM iset_case_document
       WHERE uploaded_by_user_id = ?
       ORDER BY uploaded_at DESC`,
      [applicantId]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching applicant documents:', error);
    res.status(500).json({ error: 'Failed to fetch applicant documents' });
  }
});

/**
 * GET /api/cases
 *
 * Returns all ISET cases with:
 * - Full case data from iset_case
 * - Assigned evaluator's name and email (from iset_evaluators)
 * - Linked application's tracking ID and submitted_at timestamp
 * - Applicant name and email (from user)
 * - PTMA assignments for the evaluator (if any, as a comma-separated string)
 */
app.get('/api/cases', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.application_id,
        c.assigned_to_user_id,
        c.status,
        c.priority,
        c.stage,
        c.program_type,
        c.case_summary,
        c.opened_at,
        c.closed_at,
        c.last_activity_at,

        e.name AS assigned_user_name,
        e.email AS assigned_user_email,
        GROUP_CONCAT(p.iset_code SEPARATOR ', ') AS assigned_user_ptmas,

        a.tracking_id,
        a.created_at AS submitted_at,
        applicant.name AS applicant_name,
        applicant.email AS applicant_email

      FROM iset_case c
      JOIN iset_evaluators e ON c.assigned_to_user_id = e.id
      LEFT JOIN iset_evaluator_ptma ep ON e.id = ep.evaluator_id AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())
      LEFT JOIN ptma p ON ep.ptma_id = p.id
      JOIN iset_application a ON c.application_id = a.id
      JOIN user applicant ON a.user_id = applicant.id
      GROUP BY c.id
      ORDER BY c.last_activity_at DESC
    `);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});


// Get a single case by case id
app.get('/api/cases/:id', async (req, res) => {
  const caseId = req.params.id;
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.application_id,
        c.assigned_to_user_id,
        c.status,
        c.priority,
        c.stage,
        c.program_type,
        c.case_summary,
        c.opened_at,
        c.closed_at,
        c.last_activity_at,

        u.name AS assigned_user_name,
        u.email AS assigned_user_email,
        p.name AS assigned_user_ptma_name,

        a.tracking_id,
        a.created_at AS submitted_at,
        applicant.name AS applicant_name,
        applicant.email AS applicant_email,
        applicant.id AS applicant_user_id

      FROM iset_case c
      JOIN user u ON c.assigned_to_user_id = u.id
      LEFT JOIN ptma p ON u.ptma_id = p.id
      JOIN iset_application a ON c.application_id = a.id
      JOIN user applicant ON a.user_id = applicant.id
      WHERE c.id = ?
      LIMIT 1
    `, [caseId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching case:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});


/**
 * GET /api/case-events
 *
 * Returns recent case-related events for the authenticated caseworker (user_id = 18).
 *
 * Query Parameters:
 * - unread=true        → Only return unread events
 * - type=event_type    → Filter by specific event type (optional)
 * - limit=25           → Max number of events to return (default: 25)
 *
 * Response fields:
 * - id, case_id, event_type, event_data, is_read, created_at
 * - tracking_id        → from iset_application
 * - label              → from iset_event_type
 * - alert_variant      → from iset_event_type (info, success, warning, error)
 */
app.get('/api/case-events', async (req, res) => {
  const userId = req.query.user_id;
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;
  if (!userId) {
    return res.status(400).json({ error: 'Missing user_id parameter' });
  }
  try {
    const [rows] = await pool.query(`
      SELECT
        e.id AS event_id,
        e.case_id,
        e.user_id,
        e.event_type,
        et.label AS event_type_label,
        et.alert_variant,
        e.event_data,
        e.is_read,
        e.created_at,
        a.tracking_id,
        u.name AS user_name
      FROM iset_case_event e
      LEFT JOIN iset_case c ON e.case_id = c.id
      LEFT JOIN iset_application a ON c.application_id = a.id
      JOIN iset_event_type et ON e.event_type = et.event_type
      JOIN user u ON e.user_id = u.id
      WHERE e.user_id = ?
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching case events for user:', error);
    res.status(500).json({ error: 'Failed to fetch case events for user' });
  }
});


/**
 * PUT /api/case-events/:id/read
 *
 * Marks a specific case event as read for the authenticated user (hardcoded to user_id = 18).
 *
 * Path Parameter:
 * - :id → the ID of the event to update
 *
 * Behavior:
 * - Updates `is_read` to true if the event belongs to the current user.
 *
 * Response:
 * - 200 OK with success message
 * - 403 Forbidden if the event does not belong to the user
 * - 404 Not Found if the event ID doesn’t exist
 */
app.put('/api/case-events/:id/read', async (req, res) => {
  const userId = 18;
  const eventId = req.params.id;

  try {
    const [rows] = await pool.query(
      'SELECT id FROM iset_case_event WHERE id = ? AND user_id = ?',
      [eventId, userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized or event not found' });
    }

    await pool.query(
      'UPDATE iset_case_event SET is_read = TRUE WHERE id = ?',
      [eventId]
    );

    res.status(200).json({ message: 'Event marked as read' });
  } catch (err) {
    console.error('Error updating event read status:', err);
    res.status(500).json({ error: 'Failed to update event status' });
  }
});


/**
 * POST /api/case-events
 *
 * Request body:
 * {
 *   user_id: number (required),
 *   case_id: number | null (nullable),
 *   event_type: string (required, must match iset_event_type),
 *   event_data: object (required, valid JSON)
 * }
 *
 * Response: { id, message }
 */
app.post('/api/case-events', async (req, res) => {
  const { user_id, case_id = null, event_type, event_data } = req.body;
  if (!user_id || !event_type || typeof event_data === 'undefined' ) {
    return res.status(400).json({ error: 'Missing required fields: user_id, event_type, event_data' });
  }
  try {
    // Validate event_type exists in iset_event_type
    const [eventTypeRows] = await pool.query('SELECT event_type FROM iset_event_type WHERE event_type = ?', [event_type]);
    if (eventTypeRows.length === 0) {
      return res.status(400).json({ error: 'Invalid event_type' });
    }
    // Insert event
    const [result] = await pool.query(
      'INSERT INTO iset_case_event (case_id, user_id, event_type, event_data, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
      [case_id, user_id, event_type, JSON.stringify(event_data)]
    );
    res.status(201).json({ id: result.insertId, message: 'Event created' });
  } catch (error) {
    console.error('Error creating case event:', error);
    res.status(500).json({ error: 'Failed to create case event' });
  }
});


/**
 * POST /api/counter-session
 * 
 * Starts a new counter session for a user at a given counter.
 * 
 * - Only one active session is allowed per counter at a time.
 * - If the counter is already in use (no logout_time recorded), the request will fail.
 * - A successful request creates a new row in the counter_session table.
 * 
 * Expected request body:
 * {
 *   "userId": 123,       // ID of the user (staff member)
 *   "counterId": 5       // ID of the counter they are logging into
 * }
 */
app.post('/api/counter-session', async (req, res) => {
  const { userId, counterId } = req.body;

  try {
    // Step 1: Check if there is an existing active session for this counter
    const [existing] = await pool.query(
      'SELECT id FROM counter_session WHERE counter_id = ? AND logout_time IS NULL',
      [counterId]
    );

    // Step 2: If there is an active session, reject the request
    if (existing.length > 0) {
      return res.status(409).send({ message: 'This counter is already in use.' });
    }

    // Step 3: Insert new session into the counter_session table
    await pool.query(
      'INSERT INTO counter_session (counter_id, user_id) VALUES (?, ?)',
      [counterId, userId]
    );

    // Step 4: Return success
    res.status(201).send({ message: 'Counter session started successfully.' });
  } catch (error) {
    // Log the error for debugging
    console.error('Error starting counter session:', error);
    // Return error response
    res.status(500).send({ message: 'Failed to start counter session', error: error.message });
  }
});

/**
 * GET /api/counter-session/active?userId=1
 * 
 * Returns the currently active counter session for the given user, if one exists.
 * 
 * Response:
 * {
 *   counterId: 1,
 *   counterName: "Booth 1",
 *   locationId: 1,
 *   loginTime: "2025-04-03T14:18:00Z"
 * }
 */
app.get('/api/counter-session/active', async (req, res) => {
  const { userId } = req.query;

  try {
    const [rows] = await pool.query(`
      SELECT cs.counter_id AS counterId, c.name AS counterName, c.location_id AS locationId, cs.login_time AS loginTime
      FROM counter_session cs
      JOIN counter c ON cs.counter_id = c.id
      WHERE cs.user_id = ? AND cs.logout_time IS NULL
      ORDER BY cs.login_time DESC
      LIMIT 1
    `, [userId]);

    if (rows.length === 0) {
      return res.status(404).send({ message: 'No active session found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching active session:', error);
    res.status(500).send({ message: 'Failed to fetch session' });
  }
});


/**
 * DELETE /api/counter-session/:counterId
 * 
 * Signs out the currently active session for the specified counter.
 * 
 * - Updates the latest active session (logout_time IS NULL) to mark it as ended.
 * - Safe to call even if no session is currently active.
 */

/**
 * GET /api/counters
 * 
 * Fetches a list of all counters from the system.
 * 
 * Each counter has:
 * - id: the internal identifier
 * - name: display name (e.g. "Booth 1", "Counter A")
 * 
 * This endpoint is used by the Counter Sign-In widget to populate the dropdown
 * of available counters at a location.
 */
app.get('/api/counters', async (req, res) => {
  try {
    // Query the database for all counters (id and name)
    const [rows] = await pool.query('SELECT id, name FROM counter');

    // Return the result as JSON
    res.json(rows);
  } catch (error) {
    // Log any errors and return a 500 status
    console.error('Error fetching counters:', error);
    res.status(500).send({ message: 'Failed to fetch counters' });
  }
});


app.delete('/api/counter-session/:counterId', async (req, res) => {
  const counterId = req.params.counterId;

  try {
    // Step 1: Update the latest active session by setting logout_time
    const [result] = await pool.query(`
      UPDATE counter_session
      SET logout_time = NOW()
      WHERE counter_id = ? AND logout_time IS NULL
    `, [counterId]);

    if (result.affectedRows > 0) {
      res.status(200).send({ message: 'Counter session ended successfully' });
    } else {
      res.status(200).send({ message: 'No active session to end' });
    }

  } catch (error) {
    console.error('Error ending counter session:', error);
    res.status(500).send({ message: 'Failed to end counter session', error: error.message });
  }
});


// New endpoint to return list of option data sources
app.get('/api/option-data-sources', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, label, endpoint FROM option_data_sources ORDER BY label');
    res.json(rows);
  } catch (error) {
    console.error('Failed to fetch option data sources:', error);
    res.status(500).json({ error: 'Failed to retrieve option data sources' });
  }
});


app.get('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;

  try {
    console.log(`Fetching BlockStep with ID: ${id}`);

    const [rows] = await pool.query(
      'SELECT id, name, type, config_path, status FROM blockstep WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      console.warn(`BlockStep with ID ${id} not found.`);
      return res.status(404).json({ message: 'BlockStep not found' });
    }

    const blockStep = rows[0];

    // Don't try to read or parse .njk here; let frontend load it via /api/load-njk-template
    blockStep.components = []; // Ensure components key exists, even if unused

    res.status(200).json(blockStep);
  } catch (error) {
    console.error('Error fetching BlockStep:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// GET endpoint to retrieve all BlockSteps from the database
app.get('/api/blocksteps', async (req, res) => {
  try {
    // Query the database for all BlockSteps
    const [blocksteps] = await pool.query(
      'SELECT id, name, type, config_path, status FROM blockstep'
    );

    // Return the fetched BlockSteps as JSON
    res.status(200).json(blocksteps);
  } catch (error) {
    // Log and return an error if the query fails
    console.error('Error fetching blocksteps:', error);
    res.status(500).json({ message: 'Failed to fetch blocksteps' });
  }
});

app.post('/api/blocksteps', async (req, res) => {
  const { name, status, components, njkContent } = req.body;

  if (!name || !components || components.length === 0 || !njkContent) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Generate slug for file name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const configPath = `blocksteps/blockstep_${slug}_v1.njk`;
  const jsonPath = configPath.replace('.njk', '.json');

  try {
    // Insert DB row
    const [result] = await pool.query(`
      INSERT INTO blockstep (name, type, config_path, status)
      VALUES (?, 'nunjucks', ?, ?)
    `, [name, configPath, status]);

    const newId = result.insertId;

    // Write Nunjucks file
    fs.writeFileSync(path.join(__dirname, configPath), njkContent, 'utf8');

    // Write JSON file
    fs.writeFileSync(path.join(__dirname, jsonPath), JSON.stringify({ name, status, components }, null, 2), 'utf8');

    res.status(201).json({ id: newId });
  } catch (err) {
    console.error('Error creating new blockstep:', err);
    res.status(500).json({ message: 'Failed to create blockstep' });
  }
});

app.put('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;

  if (!name || !status) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    await pool.query(`
      UPDATE blockstep
      SET name = ?, status = ?
      WHERE id = ?
    `, [name, status, id]);

    res.status(200).json({ message: 'BlockStep updated successfully' });
  } catch (err) {
    console.error('Error updating BlockStep:', err);
    res.status(500).json({ message: 'Failed to update BlockStep' });
  }
});

app.delete('/api/blocksteps/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the blockstep record to get file paths
    const [rows] = await pool.query('SELECT config_path FROM blockstep WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'BlockStep not found' });
    }

    const { config_path } = rows[0];
    const jsonPath = config_path.replace('.njk', '.json');

    // Delete the blockstep record from the database
    await pool.query('DELETE FROM blockstep WHERE id = ?', [id]);

    // Delete the associated files
    const njkFullPath = path.join(__dirname, config_path);
    const jsonFullPath = path.join(__dirname, jsonPath);

    if (fs.existsSync(njkFullPath)) fs.unlinkSync(njkFullPath);
    if (fs.existsSync(jsonFullPath)) fs.unlinkSync(jsonFullPath);

    res.status(200).json({ message: 'BlockStep and associated files deleted successfully.' });
  } catch (error) {
    console.error('Error deleting BlockStep:', error);
    res.status(500).json({ message: 'Failed to delete BlockStep.' });
  }
});

app.get('/api/render-nunjucks', (req, res) => {
  const { template_path } = req.query;

  if (!template_path) {
    console.error('template_path query parameter is required');
    return res.status(400).json({ error: 'template_path query parameter is required' });
  }

  const filePath = path.join(__dirname, template_path);
  console.log('Reading Nunjucks template from:', filePath);

  fs.readFile(filePath, 'utf8', (err, template) => {
    if (err) {
      console.error('Error reading Nunjucks template:', err);
      return res.status(500).json({ error: 'Failed to load Nunjucks template' });
    }

    try {
      // Render the Nunjucks template
      const renderedHtml = nunjucks.renderString(template);
      res.send(renderedHtml);
    } catch (renderError) {
      console.error('Error rendering Nunjucks template:', renderError);
      res.status(500).json({ error: 'Failed to render Nunjucks template' });
    }
  });
});

// GET /api/load-njk-template
// This endpoint loads the raw contents of a Nunjucks (.njk) template file from disk.
//
// It is used by the Modify Intake Step UI to preview the saved template exactly as it was last written.
// The frontend sends the file path (relative to the project root) using the `?path=` query parameter.
// The server reads the file as plain text and returns its contents without parsing.
//
// Example request:
//   GET /api/load-njk-template?path=blocksteps/blockstep_request-extra-time_v1.njk
//
// Returns:
//   200 OK with text/plain body if successful
//   400 if `path` is missing
//   500 if the file cannot be read

app.get('/api/load-njk-template', (req, res) => {
  const { path: templatePath } = req.query;

  if (!templatePath) {
    console.error('Missing template path');
    return res.status(400).send('Missing template path');
  }

  const fullPath = path.join(__dirname, templatePath);
  console.log('Loading Nunjucks template from:', fullPath);

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    console.error('Error reading .njk file:', err.message);
    res.status(500).send('Could not read template file');
  }
});

app.get('/api/search-users', async (req, res) => {
  const { query } = req.query;
  try {
    const [users] = await pool.query(`
      SELECT id, name, email, phone_number
      FROM user
      WHERE name LIKE ? OR email LIKE ? OR phone_number LIKE ?
    `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    res.status(200).send(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).send({ message: 'Failed to search users' });
  }
});


//This is probably safe to remove. It was from when I stoed jsons, not nunjucks.
app.get('/api/blockstep-json', (req, res) => {
  const { config_path } = req.query;

  if (!config_path) {
    console.error('config_path query parameter is required'); // Add logging
    return res.status(400).json({ error: 'config_path query parameter is required' });
  }

  const filePath = path.join(__dirname, config_path);
  console.log('Reading BlockStep JSON from:', filePath); // Add logging

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading BlockStep JSON:', err); // Add logging
      return res.status(500).json({ error: 'Failed to load BlockStep JSON' });
    }

    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch (parseError) {
      console.error('Error parsing JSON file:', parseError); // Add logging
      res.status(500).json({ error: 'Invalid JSON format' });
    }
  });
});


// Save slot search criteria to a separate variable
let slotSearchCriteria = {};
let appointmentData = {};

app.post('/api/save-slot-search-criteria', (req, res) => {
  slotSearchCriteria = { ...req.body };
  appointmentData = { ...appointmentData, ...req.body };
  res.status(200).send({ message: 'Slot search criteria and appointment data saved successfully' });
});

app.get('/api/get-slot-search-criteria', (req, res) => {
  res.status(200).send(slotSearchCriteria);
});

app.get('/api/get-appointment', (req, res) => {
  res.status(200).send(appointmentData);
});

app.get('/api/services', async (req, res) => {
  try {
    const [services] = await pool.query('SELECT id, name FROM service_type');
    res.status(200).send(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).send({ message: 'Failed to fetch services' });
  }
});

app.get('/api/templates', (req, res) => {
  console.log('Received request to fetch templates'); // Add logging

  const templatesDir = path.join(__dirname, 'templates');
  console.log('Templates directory:', templatesDir); // Add logging

  fs.readdir(templatesDir, (err, files) => {
    if (err) {
      console.error('Error reading templates directory:', err);
      return res.status(500).json({ message: 'Failed to load templates' });
    }

    console.log('Files in templates directory:', files); // Add logging

    const templates = files.filter(file => file.endsWith('.json')).map(file => {
      const filePath = path.join(templatesDir, file);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const templateData = JSON.parse(fileContents);
      return {
        id: file.replace('.json', ''),  // Use filename as ID
        name: templateData.name,
        type: templateData.type,
        status: templateData.status,
        language: templateData.language || '',  // Ensure language is a string
        subject: templateData.subject || ''  // Ensure subject is a string
      };
    });

    console.log('Templates to send:', templates); // Add logging

    res.status(200).json(templates);
  });
});

app.get('/api/templates/:templateId', (req, res) => {
  const templateId = req.params.templateId;
  const templatePath = path.join(__dirname, 'templates', `${templateId}.json`);

  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ message: 'Template not found' });
  }

  fs.readFile(templatePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading template file:', err);
      return res.status(500).json({ message: 'Failed to load template' });
    }

    res.status(200).json(JSON.parse(data));
  });
});

app.post('/api/templates/:templateId', (req, res) => {
  const templateId = req.params.templateId;
  const templateData = req.body;

  if (!templateData.name || !templateData.type || !templateData.content || !templateData.subject) {
    return res.status(400).json({ message: 'Missing required template fields' });
  }

  // Generate filename using template name and timestamp
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
  const filename = `${templateData.name.replace(/\s+/g, '')}_${timestamp}.json`;
  const templatePath = path.join(__dirname, 'templates', filename);

  fs.writeFile(templatePath, JSON.stringify(templateData, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error saving template:', err);
      return res.status(500).json({ message: 'Failed to save template' });
    }

    res.status(200).json({ message: 'Template saved successfully', templateId });
  });
});

app.delete('/api/templates/:templateId', (req, res) => {
  const templateId = req.params.templateId;
  const templatePath = path.join(__dirname, 'templates', `${templateId}.json`);

  // Check if the file exists
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ message: 'Template not found' });
  }

  // Delete the file
  fs.unlink(templatePath, (err) => {
    if (err) {
      console.error('Error deleting template:', err);
      return res.status(500).json({ message: 'Failed to delete template' });
    }

    res.status(200).json({ message: 'Template deleted successfully', templateId });
  });
});

app.get('/api/admin/messages', async (req, res) => {
  try {
    console.log("Fetching messages...");  // 🔴 Log request start

    const [messages] = await pool.query(`
          SELECT id, sender_id, recipient_id, subject, body, status, deleted, urgent, created_at 
          FROM messages
          ORDER BY urgent DESC, created_at DESC
      `);

    console.log("Messages fetched:", messages);  // 🔴 Log retrieved messages

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);  // 🔴 Log error details
    res.status(500).json({ error: error.message });  // 🔴 Send error details in response
  }
});


app.post('/api/admin/messages', async (req, res) => {
  const { sender_id, recipient_id, subject, body, urgent } = req.body;

  if (!sender_id || !recipient_id || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [result] = await pool.query(`
          INSERT INTO messages (sender_id, recipient_id, subject, body, status, deleted, urgent, created_at)
          VALUES (?, ?, ?, ?, 'unread', FALSE, ?, NOW())
      `, [sender_id, recipient_id, subject, body, urgent]);

    res.status(201).json({ message: 'Message sent', messageId: result.insertId });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  try {
    const [services] = await pool.query(`
      SELECT st.id, st.name
      FROM location_service_link ls
      JOIN service_type st ON ls.service_id = st.id
      WHERE ls.location_id = ?
    `, [locationId]);
    res.status(200).send(services);
  } catch (error) {
    console.error('Error fetching location services:', error);
    res.status(500).send({ message: 'Failed to fetch location services' });
  }
});

app.post('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const serviceIds = req.body;

  try {
    // Delete existing services for the location
    await pool.query('DELETE FROM location_service_link WHERE location_id = ?', [locationId]);

    // Insert new services for the location
    const values = serviceIds.map(serviceId => [locationId, serviceId]);
    await pool.query('INSERT INTO location_service_link (location_id, service_id) VALUES ?', [values]);

    res.status(200).send({ message: 'Services updated successfully' });
  } catch (error) {
    console.error('Error updating location services:', error);
    res.status(500).send({ message: 'Failed to update location services' });
  }
});

app.put('/api/location-services/:locationId', async (req, res) => {
  const { locationId } = req.params;
  const serviceIds = req.body;

  try {
    // Delete existing services for the location
    await pool.query('DELETE FROM location_service_link WHERE location_id = ?', [locationId]);

    // Insert new services for the location
    const values = serviceIds.map(serviceId => [locationId, serviceId]);
    await pool.query('INSERT INTO location_service_link (location_id, service_id) VALUES ?', [values]);

    res.status(200).send({ message: 'Services updated successfully' });
  } catch (error) {
    console.error('Error updating location services:', error);
    res.status(500).send({ message: 'Failed to update location services' });
  }
});

app.get('/api/appointments', async (req, res) => {
  try {
    const { country, location, service } = req.query;
    console.log('Received query parameters:', req.query); // Debugging log

    let query = `
SELECT 
    a.id, 
    u.name, 
    s.date, 
    s.time, 
    a.status, 
    st.name AS serviceType, 
    l.name AS location
FROM appointment a
JOIN user u ON a.user_id = u.id
JOIN booking b ON a.id = b.appointment_id
JOIN slot s ON b.slot_id = s.id  -- Direct join with slot using slot_id from booking
JOIN service_type st ON a.serviceType = st.id
JOIN location l ON s.location_id = l.id
WHERE 1=1;
    `;

    if (country && country !== 'all') {
      query += ` AND l.country_id = ${mysql.escape(country)}`;
    }

    if (location && location !== 'all') {
      query += ` AND l.id = ${mysql.escape(location)}`;
    }

    if (service && service !== 'all') {
      query += ` AND st.name = ${mysql.escape(service)}`;
    }

    console.log('Constructed SQL query:', query); // Debugging log

    const [appointments] = await pool.query(query);

    // Mask the name field
    const maskedAppointments = appointments.map(appointment => {
      const nameParts = appointment.name.split(' ');
      const maskedName = nameParts.map(part => {
        if (part.length <= 2) return part;
        return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
      }).join(' ');
      return { ...appointment, name: maskedName };
    });

    res.status(200).send(maskedAppointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).send({ message: 'Failed to fetch appointments' });
  }
});

app.get('/api/appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;
  try {
    const [appointment] = await pool.query(`
SELECT 
    a.id, 
    u.name, 
    s.date, 
    s.time, 
    a.status, 
    st.name AS serviceType, 
    l.name AS location
FROM appointment a
JOIN user u ON a.user_id = u.id
JOIN booking b ON a.id = b.appointment_id
JOIN slot s ON b.slot_id = s.id  -- Direct join with slot using slot_id from booking
JOIN service_type st ON a.serviceType = st.id
JOIN location l ON s.location_id = l.id
WHERE a.id = ?;
    `, [appointmentId]);

    if (appointment.length === 0) {
      return res.status(404).send({ message: 'Appointment not found' });
    }

    res.status(200).send(appointment[0]);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).send({ message: 'Failed to fetch appointment' });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  const appointmentId = req.params.id;
  const { status } = req.body;

  try {
    // Update the status in the appointment table
    await pool.query('UPDATE appointment SET status = ? WHERE id = ?', [status, appointmentId]);

    if (status === 'serving') {
      // Update the service_start_time in the queue table
      await pool.query('UPDATE queue SET service_start_time = ? WHERE appointment_id = ?', [new Date(), appointmentId]);
    } else if (status === 'package' || status === 'complete') {
      // Update the service_end_time in the queue table
      await pool.query('UPDATE queue SET service_end_time = ? WHERE appointment_id = ?', [new Date(), appointmentId]);
    } else if (status === 'booked') {
      // Delete the record from the queue table
      await pool.query('DELETE FROM queue WHERE appointment_id = ?', [appointmentId]);
    }

    res.status(200).send({ message: 'Appointment status updated successfully' });
  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).send({ message: 'Failed to update appointment status' });
  }
});

app.delete('/api/queue/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM queue WHERE appointment_id = ?', [appointmentId]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ message: 'Queue record not found' });
    }

    res.status(200).send({ message: 'Queue record deleted successfully' });
  } catch (error) {
    console.error('Error deleting queue record:', error);
    res.status(500).send({ message: 'Failed to delete queue record' });
  }
});

const formatDateTime = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
};

app.put('/api/queue', async (req, res) => {
  const { appointmentId, service_start_time, service_end_time, status } = req.body;

  try {
    const formattedStartTime = formatDateTime(service_start_time);
    const formattedEndTime = formatDateTime(service_end_time);

    const [result] = await pool.query(`
      UPDATE queue 
      SET 
        service_start_time = COALESCE(?, service_start_time), 
        service_end_time = COALESCE(?, service_end_time), 
        status = COALESCE(?, status)
      WHERE appointment_id = ?
    `, [formattedStartTime, formattedEndTime, status, appointmentId]);

    if (result.affectedRows === 0) {
      return res.status(404).send({ message: 'Queue record not found' });
    }

    res.status(200).send({ message: 'Queue record updated successfully' });
  } catch (error) {
    console.error('Error updating queue record:', error);
    res.status(500).send({ message: 'Failed to update queue record' });
  }
});

// --- PTMA Endpoints ---

// List all PTMAs
app.get('/api/ptmas', async (req, res) => {
  try {
    const [ptmas] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
    `);
    // Map DB fields to API fields for each PTMA
    const mapped = ptmas.map(db => ({
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
      contact_notes: db.contact_notes || null
    }));
    res.status(200).json(mapped);
  } catch (error) {
    console.error('Error fetching PTMAs:', error);
    res.status(500).send({ message: 'Failed to fetch PTMAs' });
  }
});

// Get PTMA by ID
app.get('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
  try {
    const [ptmas] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    if (ptmas.length === 0) {
      return res.status(404).send({ message: 'PTMA not found' });
    }
    // Map DB fields to API fields
    const db = ptmas[0];
    res.status(200).json({
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
      contact_notes: db.contact_notes || null
    });
  } catch (error) {
    console.error('Error fetching PTMA:', error);
    res.status(500).send({ message: 'Failed to fetch PTMA' });
  }
});

// Create PTMA
app.post('/api/ptmas', async (req, res) => {
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
    contact_notes
  } = req.body;
  try {
    const [result] = await pool.query(`
      INSERT INTO ptma (name, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [location, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes]);
    const ptmaId = result.insertId;
    const [newPtma] = await pool.query(`
      SELECT id, name AS location, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    res.status(201).send(newPtma[0]);
  } catch (error) {
    console.error('Error creating PTMA:', error);
    res.status(500).send({ message: 'Failed to create PTMA' });
  }
});

// Update PTMA
app.put('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
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
    contact_notes
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
    `, [full_name, code, status, province, indigenous_group, full_address, agreement_id, notes, website_url, contact_name, contact_email, contact_phone, contact_notes, ptmaId]);
    const [updatedPtma] = await pool.query(`
      SELECT id, iset_full_name, iset_code, iset_status, iset_province, iset_indigenous_group, iset_full_address, iset_agreement_id, iset_notes, website_url, contact_name, contact_email, contact_phone, contact_notes
      FROM ptma
      WHERE id = ?
    `, [ptmaId]);
    const db = updatedPtma[0];
    res.status(200).json({
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
      contact_notes: db.contact_notes || null
    });
  } catch (error) {
    console.error('Error updating PTMA:', error);
    res.status(500).send({ message: 'Failed to update PTMA' });
  }
});

// Delete PTMA
app.delete('/api/ptmas/:id', async (req, res) => {
  const ptmaId = req.params.id;
  try {
    await pool.query('DELETE FROM ptma WHERE id = ?', [ptmaId]);
    res.status(200).send({ message: 'PTMA deleted successfully' });
  } catch (error) {
    console.error('Error deleting PTMA:', error);
    res.status(500).send({ message: 'Failed to delete PTMA' });
  }
});

// Get evaluators for a PTMA
app.get('/api/ptmas/:ptmaId/evaluators', async (req, res) => {
  const { ptmaId } = req.params;
  try {
    const [evaluators] = await pool.query(`
      SELECT u.id, u.name, u.email, r.RoleName AS role
      FROM user u
      JOIN user_role_link ur ON u.id = ur.UserID
      JOIN role r ON ur.RoleID = r.RoleID
      WHERE r.RoleName = 'Intake Officer' AND u.ptma_id = ?
      ORDER BY u.name
    `, [ptmaId]);
    res.status(200).json(evaluators);
  } catch (error) {
    console.error('Error fetching evaluators for PTMA:', error);
    res.status(500).json({ error: 'Failed to fetch evaluators' });
  }
});
// --- End PTMA Endpoints ---

// Get full iset_application by application_id
app.get('/api/applications/:id', async (req, res) => {
  const applicationId = req.params.id;
  try {
    // Get application data
    const [[application]] = await pool.query(
      'SELECT * FROM iset_application WHERE id = ?',
      [applicationId]
    );
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get case info (if exists)
    const [[caseRow]] = await pool.query(
      `SELECT id, assigned_to_user_id, status, priority, stage, program_type, case_summary, opened_at, closed_at, last_activity_at, ptma_id FROM iset_case WHERE application_id = ?`,
      [applicationId]
    );

    let evaluator = null;
    let ptma = null;
    if (caseRow) {
      // Get evaluator info
      const [[evalRow]] = await pool.query(
        'SELECT id, name, email, role, status FROM iset_evaluators WHERE id = ?',
        [caseRow.assigned_to_user_id]
      );
      evaluator = evalRow || null;
      // Get PTMA info directly from iset_case.ptma_id
      if (caseRow.ptma_id) {
        const [[ptmaRow]] = await pool.query(
          'SELECT id, name, iset_code FROM ptma WHERE id = ?',
          [caseRow.ptma_id]
        );
        ptma = ptmaRow || null;
      }
    }

    res.status(200).json({ ...application, assigned_evaluator: evaluator, ptma, case: caseRow || null });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

/**
 * GET /api/applications/:id/ptma
 *
 * Returns the PTMA(s) for the assigned evaluator of the given application, or null if not assigned.
 */
app.get('/api/applications/:id/ptma', async (req, res) => {
  const applicationId = req.params.id;
  try {
    // Get assigned evaluator for this application (via iset_case)
    const [[caseRow]] = await pool.query(
      'SELECT assigned_to_user_id FROM iset_case WHERE application_id = ?',
      [applicationId]
    );
    if (!caseRow) {
      return res.status(200).json({ ptmas: [] });
    }
    // Get all current PTMA assignments for this evaluator
    const [ptmaRows] = await pool.query(
      `SELECT p.id, p.name, p.iset_code, p.iset_full_name, p.iset_status, p.iset_province, p.iset_indigenous_group
       FROM iset_evaluator_ptma ep
       JOIN ptma p ON ep.ptma_id = p.id
       WHERE ep.evaluator_id = ? AND (ep.unassigned_at IS NULL OR ep.unassigned_at > CURDATE())`,
      [caseRow.assigned_to_user_id]
    );
    res.status(200).json({ ptmas: ptmaRows });
  } catch (error) {
    console.error('Error fetching ptma for application:', error);
    res.status(500).json({ error: 'Failed to fetch ptma for application' });
  }
});

// Update case_summary for a given application
app.put('/api/applications/:id/ptma-case-summary', async (req, res) => {
  const applicationId = req.params.id;
  const { case_summary } = req.body;
  if (!case_summary) {
    return res.status(400).json({ error: 'Missing case_summary in request body' });
  }
  try {
    // Update the case_summary in iset_case for the given application_id
    const [result] = await pool.query(
      'UPDATE iset_case SET case_summary = ? WHERE application_id = ?',
      [case_summary, applicationId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Case not found for this application' });
    }
    // Return the updated case_summary (and optionally the full case row)
    const [[updatedCase]] = await pool.query(
      'SELECT case_summary FROM iset_case WHERE application_id = ?',
      [applicationId]
    );
    res.status(200).json({ case_summary: updatedCase.case_summary });
  } catch (error) {
    console.error('Error updating case summary:', error);
    res.status(500).json({ error: 'Failed to update case summary' });
  }
});

// Serve uploaded files statically for document viewing (corrected path)
app.use('/uploads', express.static('X:/ISET/ISET-intake/uploads'));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log(`CORS allowed origin: ${corsOptions.origin}`);
});

// Get all events for a specific case (with user name, event type label, and alert variant)
app.get('/api/cases/:case_id/events', async (req, res) => {
  const caseId = req.params.case_id;
  const { limit = 50, offset = 0 } = req.query;
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.id AS event_id,
        e.case_id,
        e.event_type,
        et.label AS event_type_label,
        et.alert_variant,
        e.event_data,
        e.created_at,
        u.id AS user_id,
        u.name AS user_name
      FROM iset_case_event e
      JOIN user u ON e.user_id = u.id
      JOIN iset_event_type et ON e.event_type = et.event_type
      WHERE e.case_id = ?
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, [caseId, Number(limit), Number(offset)]);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching case events:', error);
    res.status(500).json({ error: 'Failed to fetch case events' });
  }
});


/**
 * POST /api/purge-cases
 *
 * Deletes all rows from iset_case_document, iset_case_event, iset_case_note, iset_case_task, then iset_case.
 * Used for demo reset purposes only.
 */
app.post('/api/purge-cases', async (req, res) => {
  try {
    // Delete from child tables first due to foreign key constraints
    await pool.query('DELETE FROM iset_case_document');
    await pool.query('DELETE FROM iset_case_event');
    await pool.query('DELETE FROM iset_case_note');
    await pool.query('DELETE FROM iset_case_task');
    await pool.query('DELETE FROM iset_case');
    res.status(200).json({ message: 'All cases and related data purged.' });
  } catch (error) {
    console.error('Error purging cases:', error);
    res.status(500).json({ error: 'Failed to purge cases' });
  }
});

