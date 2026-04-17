import express from 'express';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { generateToken, authenticateToken } from './middleware/auth.js';

const sql = neon(process.env.DATABASE_URL);
const router = express.Router();

// Signup
router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${passwordHash}, ${name})
      RETURNING id, email, name, created_at
    `;

    const user = result[0];
    const token = generateToken(user);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = users[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const users = await sql`SELECT id, email, name, created_at FROM users WHERE id = ${req.user.id}`;
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============ KPI Routes ============

// Get all KPIs
router.get('/kpis', authenticateToken, async (req, res) => {
  try {
    const kpis = await sql`
      SELECT id, title, description, type, target, created_at, updated_at
      FROM kpis
      WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC
    `;
    res.json({ kpis });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({ error: 'Failed to get KPIs' });
  }
});

// Create KPI
router.post('/kpis', authenticateToken, async (req, res) => {
  try {
    const { title, description, type, target } = req.body;

    if (!title || !type || target === undefined) {
      return res.status(400).json({ error: 'Title, type, and target are required' });
    }

    if (!['number', 'percentage', 'boolean'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be number, percentage, or boolean' });
    }

    const result = await sql`
      INSERT INTO kpis (user_id, title, description, type, target)
      VALUES (${req.user.id}, ${title}, ${description || ''}, ${type}, ${target})
      RETURNING id, title, description, type, target, created_at
    `;

    res.status(201).json({ kpi: result[0] });
  } catch (error) {
    console.error('Create KPI error:', error);
    res.status(500).json({ error: 'Failed to create KPI' });
  }
});

// Update KPI
router.put('/kpis/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, type, target } = req.body;

    // Check ownership
    const existing = await sql`SELECT id FROM kpis WHERE id = ${id} AND user_id = ${req.user.id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    const result = await sql`
      UPDATE kpis
      SET title = COALESCE(${title}, title),
          description = COALESCE(${description}, description),
          type = COALESCE(${type}, type),
          target = COALESCE(${target}, target),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING id, title, description, type, target, updated_at
    `;

    res.json({ kpi: result[0] });
  } catch (error) {
    console.error('Update KPI error:', error);
    res.status(500).json({ error: 'Failed to update KPI' });
  }
});

// Delete KPI
router.delete('/kpis/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM kpis
      WHERE id = ${id} AND user_id = ${req.user.id}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    res.json({ message: 'KPI deleted successfully' });
  } catch (error) {
    console.error('Delete KPI error:', error);
    res.status(500).json({ error: 'Failed to delete KPI' });
  }
});

// ============ Entry Routes ============

// Get entries
router.get('/entries', authenticateToken, async (req, res) => {
  try {
    const { kpi_id, start, end } = req.query;

    let query = sql`
      SELECT e.id, e.kpi_id, e.date, e.value, e.created_at, e.updated_at,
             k.title as kpi_title, k.type, k.target
      FROM entries e
      JOIN kpis k ON e.kpi_id = k.id
      WHERE k.user_id = ${req.user.id}
    `;

    const params = [req.user.id];

    if (kpi_id) {
      query = sql`
        SELECT e.id, e.kpi_id, e.date, e.value, e.created_at, e.updated_at,
               k.title as kpi_title, k.type, k.target
        FROM entries e
        JOIN kpis k ON e.kpi_id = k.id
        WHERE k.user_id = ${req.user.id} AND e.kpi_id = ${kpi_id}
        ORDER BY e.date DESC
      `;
    } else if (start && end) {
      query = sql`
        SELECT e.id, e.kpi_id, e.date, e.value, e.created_at, e.updated_at,
               k.title as kpi_title, k.type, k.target
        FROM entries e
        JOIN kpis k ON e.kpi_id = k.id
        WHERE k.user_id = ${req.user.id} AND e.date BETWEEN ${start} AND ${end}
        ORDER BY e.date DESC
      `;
    } else {
      query = sql`
        SELECT e.id, e.kpi_id, e.date, e.value, e.created_at, e.updated_at,
               k.title as kpi_title, k.type, k.target
        FROM entries e
        JOIN kpis k ON e.kpi_id = k.id
        WHERE k.user_id = ${req.user.id}
        ORDER BY e.date DESC
      `;
    }

    const entries = await query;
    res.json({ entries });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Failed to get entries' });
  }
});

// Create/Update entry
router.post('/entries', authenticateToken, async (req, res) => {
  try {
    const { kpi_id, date, value } = req.body;

    if (!kpi_id || !date || value === undefined) {
      return res.status(400).json({ error: 'KPI ID, date, and value are required' });
    }

    // Check KPI ownership
    const kpi = await sql`SELECT id FROM kpis WHERE id = ${kpi_id} AND user_id = ${req.user.id}`;
    if (kpi.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    // Upsert entry
    const result = await sql`
      INSERT INTO entries (kpi_id, date, value)
      VALUES (${kpi_id}, ${date}, ${value})
      ON CONFLICT (kpi_id, date) DO UPDATE
      SET value = ${value}, updated_at = CURRENT_TIMESTAMP
      RETURNING id, kpi_id, date, value, created_at
    `;

    res.status(201).json({ entry: result[0] });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Delete entry
router.delete('/entries/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM entries e
      USING kpis k
      WHERE e.id = ${id} AND e.kpi_id = k.id AND k.user_id = ${req.user.id}
      RETURNING e.id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
