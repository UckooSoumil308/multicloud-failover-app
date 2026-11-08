import pg from 'pg';

const { Pool } = pg;

// Global pool instance
let pool = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  } catch (err) {
    console.warn('Failed to initialize PostgreSQL pool with DATABASE_URL, using in-memory fallback:', err.message);
    pool = null;
  }
}

// In-memory fallback store when DATABASE_URL is not provided (local dev, CI, test runs)
let inMemoryLogs = [
  {
    id: 1,
    title: 'Cluster Provisioned: Azure Primary Region (F1 Free Linux Node 20)',
    created_by_cloud: 'AZURE-PRIMARY',
    server_hostname: 'azure-f1-worker-node',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 2,
    title: 'Standby Failover Target Synchronized: AWS Elastic Beanstalk Node 20',
    created_by_cloud: 'AWS-SECONDARY',
    server_hostname: 'aws-eb-node-t3micro',
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
];
let nextId = 3;

/**
 * Initializes the incident_logs table if PostgreSQL is configured.
 * Safely falls back if running without DATABASE_URL.
 */
export async function initDb() {
  if (!pool) {
    return { initialized: true, engine: 'in-memory-fallback' };
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_logs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_cloud TEXT NOT NULL,
        server_hostname TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    return { initialized: true, engine: 'postgresql' };
  } catch (error) {
    console.error('PostgreSQL table initialization error, falling back to in-memory:', error.message);
    return { initialized: false, engine: 'in-memory-fallback', error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Fetches recent records from PostgreSQL or in-memory fallback.
 * @param {number} limit 
 */
export async function getIncidentLogs(limit = 20) {
  if (pool) {
    try {
      const res = await pool.query(
        'SELECT id, title, created_by_cloud, server_hostname, created_at FROM incident_logs ORDER BY created_at DESC LIMIT $1;',
        [limit]
      );
      return { records: res.rows, engine: 'postgresql' };
    } catch (err) {
      console.warn('PostgreSQL query error, falling back to in-memory store:', err.message);
    }
  }

  // In-memory fallback
  const sorted = [...inMemoryLogs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return {
    records: sorted.slice(0, limit),
    engine: 'in-memory-fallback',
  };
}

/**
 * Inserts an incident log record into PostgreSQL or in-memory fallback.
 */
export async function insertIncidentLog({ title, created_by_cloud, server_hostname }) {
  if (pool) {
    try {
      const res = await pool.query(
        'INSERT INTO incident_logs (title, created_by_cloud, server_hostname) VALUES ($1, $2, $3) RETURNING id, title, created_by_cloud, server_hostname, created_at;',
        [title, created_by_cloud, server_hostname]
      );
      return { record: res.rows[0], engine: 'postgresql' };
    } catch (err) {
      console.warn('PostgreSQL insert error, writing to in-memory fallback:', err.message);
    }
  }

  // In-memory fallback
  const record = {
    id: nextId++,
    title,
    created_by_cloud,
    server_hostname,
    created_at: new Date().toISOString(),
  };
  inMemoryLogs.unshift(record);
  return { record, engine: 'in-memory-fallback' };
}

export { pool };

