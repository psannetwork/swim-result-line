const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'swim.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS athletes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
      athlete_id TEXT NOT NULL,
      game_code TEXT NOT NULL,
      notified_at INTEGER NOT NULL,
      PRIMARY KEY (athlete_id, game_code)
  );
`);

module.exports = db;
