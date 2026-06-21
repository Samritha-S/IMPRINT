const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'imprint.db');
const db = new Database(dbPath);

try {
  const tableInfo = db.pragma('table_info(users)');
  const hasLanguage = tableInfo.some(column => column.name === 'language');
  
  if (!hasLanguage) {
    db.exec(`ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'en';`);
    console.log("Migration successful: Added 'language' column to users table.");
  } else {
    console.log("Migration skipped: 'language' column already exists.");
  }
} catch (err) {
  console.error("Migration failed:", err.message);
} finally {
  db.close();
}
