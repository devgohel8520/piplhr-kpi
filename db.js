import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL);

export async function initDatabase() {
  try {
    // Create users table
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

    // Create KPIs table
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

    // Create entries table
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

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_kpis_user_id ON kpis(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_entries_kpi_id ON entries(kpi_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date)`;

    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
}

export { sql };
