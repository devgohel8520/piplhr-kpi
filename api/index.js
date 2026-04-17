import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Initialize database tables
async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS kpis (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(100) NOT NULL,
      description TEXT,
      type VARCHAR(20) NOT NULL CHECK (type IN ('number', 'percentage', 'boolean')),
      target DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      value DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(kpi_id, date)
    )
  `;
}

// Auth middleware
function authenticateToken(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { error: 'Access token required', status: 401 };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { user: decoded };
  } catch (error) {
    return { error: 'Invalid or expired token', status: 403 };
  }
}

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

export async function GET(request) {
  await initDb();

  const url = new URL(request.url);
  const path = url.pathname;

  // Health check
  if (path === '/api/health') {
    return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // Auth check
  const auth = authenticateToken(request);
  if (auth.error) return errorResponse(auth.error, auth.status);

  // Get KPIs
  if (path === '/api/kpis') {
    const kpis = await sql`
      SELECT id, title, description, type, target, created_at, updated_at
      FROM kpis WHERE user_id = ${auth.user.id}
      ORDER BY created_at DESC
    `;
    return jsonResponse({ kpis });
  }

  // Get entries
  if (path === '/api/entries') {
    const { start, end, kpi_id } = Object.fromEntries(url.searchParams);

    let entries;
    if (kpi_id) {
      entries = await sql`
        SELECT e.id, e.kpi_id, e.date, e.value, e.created_at, e.updated_at,
               k.title as kpi_title, k.type, k.target
        FROM entries e
        JOIN kpis k ON e.kpi_id = k.id
        WHERE k.user_id = ${auth.user.id} AND e.kpi_id = ${kpi_id}
        ORDER BY e.date DESC
      `;
    } else if (start && end) {
      entries = await sql`
        SELECT e.id, e.kpi_id, e.date, e.value, e.created_at, e.updated_at,
               k.title as kpi_title, k.type, k.target
        FROM entries e
        JOIN kpis k ON e.kpi_id = k.id
        WHERE k.user_id = ${auth.user.id} AND e.date BETWEEN ${start} AND ${end}
        ORDER BY e.date DESC
      `;
    } else {
      entries = await sql`
        SELECT e.id, e.kpi_id, e.date, e.value, e.created_at, e.updated_at,
               k.title as kpi_title, k.type, k.target
        FROM entries e
        JOIN kpis k ON e.kpi_id = k.id
        WHERE k.user_id = ${auth.user.id}
        ORDER BY e.date DESC
      `;
    }
    return jsonResponse({ entries });
  }

  return errorResponse('Not found', 404);
}

export async function POST(request) {
  await initDb();

  const url = new URL(request.url);
  const path = url.pathname;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  // Signup
  if (path === '/api/auth/signup') {
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return errorResponse('Email, password, and name are required', 400);
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return errorResponse('Email already registered', 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${passwordHash}, ${name})
      RETURNING id, email, name, created_at
    `;

    const user = result[0];
    const token = generateToken(user);

    return jsonResponse({ user: { id: user.id, email: user.email, name: user.name }, token }, 201);
  }

  // Login
  if (path === '/api/auth/login') {
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    const user = users[0];

    if (!user) {
      return errorResponse('Invalid credentials', 401);
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return errorResponse('Invalid credentials', 401);
    }

    const token = generateToken(user);
    return jsonResponse({ user: { id: user.id, email: user.email, name: user.name }, token });
  }

  // Get current user
  if (path === '/api/auth/me') {
    const auth = authenticateToken(request);
    if (auth.error) return errorResponse(auth.error, auth.status);

    const users = await sql`SELECT id, email, name, created_at FROM users WHERE id = ${auth.user.id}`;
    if (users.length === 0) {
      return errorResponse('User not found', 404);
    }
    return jsonResponse({ user: users[0] });
  }

  // Create KPI
  if (path === '/api/kpis') {
    const auth = authenticateToken(request);
    if (auth.error) return errorResponse(auth.error, auth.status);

    const { title, description, type, target } = body;

    if (!title || !type || target === undefined) {
      return errorResponse('Title, type, and target are required', 400);
    }

    if (!['number', 'percentage', 'boolean'].includes(type)) {
      return errorResponse('Invalid type', 400);
    }

    const result = await sql`
      INSERT INTO kpis (user_id, title, description, type, target)
      VALUES (${auth.user.id}, ${title}, ${description || ''}, ${type}, ${target})
      RETURNING id, title, description, type, target, created_at
    `;

    return jsonResponse({ kpi: result[0] }, 201);
  }

  // Create entry
  if (path === '/api/entries') {
    const auth = authenticateToken(request);
    if (auth.error) return errorResponse(auth.error, auth.status);

    const { kpi_id, date, value } = body;

    if (!kpi_id || !date || value === undefined) {
      return errorResponse('KPI ID, date, and value are required', 400);
    }

    const kpi = await sql`SELECT id FROM kpis WHERE id = ${kpi_id} AND user_id = ${auth.user.id}`;
    if (kpi.length === 0) {
      return errorResponse('KPI not found', 404);
    }

    const result = await sql`
      INSERT INTO entries (kpi_id, date, value)
      VALUES (${kpi_id}, ${date}, ${value})
      ON CONFLICT (kpi_id, date) DO UPDATE SET value = ${value}, updated_at = CURRENT_TIMESTAMP
      RETURNING id, kpi_id, date, value, created_at
    `;

    return jsonResponse({ entry: result[0] }, 201);
  }

  return errorResponse('Not found', 404);
}

export async function PUT(request) {
  await initDb();

  const url = new URL(request.url);
  const path = url.pathname;

  const auth = authenticateToken(request);
  if (auth.error) return errorResponse(auth.error, auth.status);

  // Update KPI
  const kpiMatch = path.match(/^\/api\/kpis\/(\d+)$/);
  if (kpiMatch) {
    const id = kpiMatch[1];
    let body = {};
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { title, description, type, target } = body;

    const existing = await sql`SELECT id FROM kpis WHERE id = ${id} AND user_id = ${auth.user.id}`;
    if (existing.length === 0) {
      return errorResponse('KPI not found', 404);
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

    return jsonResponse({ kpi: result[0] });
  }

  return errorResponse('Not found', 404);
}

export async function DELETE(request) {
  await initDb();

  const url = new URL(request.url);
  const path = url.pathname;

  const auth = authenticateToken(request);
  if (auth.error) return errorResponse(auth.error, auth.status);

  // Delete KPI
  const kpiMatch = path.match(/^\/api\/kpis\/(\d+)$/);
  if (kpiMatch) {
    const id = kpiMatch[1];

    const result = await sql`
      DELETE FROM kpis WHERE id = ${id} AND user_id = ${auth.user.id} RETURNING id
    `;

    if (result.length === 0) {
      return errorResponse('KPI not found', 404);
    }

    return jsonResponse({ message: 'KPI deleted successfully' });
  }

  // Delete entry
  const entryMatch = path.match(/^\/api\/entries\/(\d+)$/);
  if (entryMatch) {
    const id = entryMatch[1];

    const result = await sql`
      DELETE FROM entries e
      USING kpis k
      WHERE e.id = ${id} AND e.kpi_id = k.id AND k.user_id = ${auth.user.id}
      RETURNING e.id
    `;

    if (result.length === 0) {
      return errorResponse('Entry not found', 404);
    }

    return jsonResponse({ message: 'Entry deleted successfully' });
  }

  return errorResponse('Not found', 404);
}
