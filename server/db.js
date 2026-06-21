const Database = require('better-sqlite3');
const path = require('path');

const dbFile = process.env.DATABASE_FILE || 'imprint.db';
const dbPath = path.join(__dirname, dbFile);
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    state TEXT NOT NULL,
    city TEXT NOT NULL,
    ward TEXT NOT NULL,
    diet TEXT NOT NULL,
    commute TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    transport_kg REAL DEFAULT 0,
    food_kg REAL DEFAULT 0,
    energy_kg REAL DEFAULT 0,
    total_kg REAL DEFAULT 0,
    details TEXT, -- JSON string
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bill_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scan_date TEXT NOT NULL,
    type TEXT NOT NULL, -- electricity, gas, lpg, petrol, diesel
    provider TEXT NOT NULL,
    amount REAL DEFAULT 0,
    units REAL DEFAULT 0,
    co2_kg REAL DEFAULT 0,
    billing_period TEXT,
    image_name TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS receipt_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    scan_date TEXT NOT NULL,
    items TEXT NOT NULL, -- JSON array of items: { name, category, weight_kg, co2_kg }
    total_kg REAL DEFAULT 0,
    image_name TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ward_aggregates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_level TEXT NOT NULL, -- ward, city, state
    state TEXT NOT NULL,
    city TEXT DEFAULT '',
    ward TEXT DEFAULT '',
    avg_co2_kg REAL DEFAULT 0,
    total_users INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    tools_called TEXT, -- JSON array
    reasoning_trace TEXT,
    mood TEXT NOT NULL, -- happy, neutral, concerned
    message TEXT NOT NULL,
    suggested_action TEXT, -- JSON object or NULL
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key_pattern TEXT NOT NULL, -- e.g., 'weekend_food_spike'
    value TEXT, -- JSON or string
    last_surfaced TEXT,
    status TEXT, -- active, dismissed, resolved
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(user_id, key_pattern)
  );

  CREATE TABLE IF NOT EXISTS agent_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action_id TEXT NOT NULL,
    accepted INTEGER NOT NULL, -- 1 = accepted, 0 = dismissed
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  -- Index optimizations for efficiency
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);
  CREATE INDEX IF NOT EXISTS idx_bill_scans_user_date ON bill_scans(user_id, scan_date);
  CREATE INDEX IF NOT EXISTS idx_receipt_scans_user_date ON receipt_scans(user_id, scan_date);
  CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id);
  CREATE INDEX IF NOT EXISTS idx_agent_feedback_user ON agent_feedback(user_id);
`);

module.exports = db;
