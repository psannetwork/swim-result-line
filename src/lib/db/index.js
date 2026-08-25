const Database = require('better-sqlite3');
const path = require('path');

// プロジェクトのルートディレクトリに配置するようにパスを修正
const dbPath = path.join(__dirname, '../../..', 'swim.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS athletes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS games (
    game_code TEXT PRIMARY KEY,
    game_name TEXT NOT NULL,
    period TEXT NOT NULL,
    status_label TEXT NOT NULL,
    last_updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS races (
    game_code TEXT NOT NULL,
    program_id TEXT NOT NULL,
    heat TEXT NOT NULL,
    race_name TEXT NOT NULL,
    PRIMARY KEY (game_code, program_id, heat),
    FOREIGN KEY (game_code) REFERENCES games(game_code)
  );
  CREATE TABLE IF NOT EXISTS notifications (
      athlete_id TEXT NOT NULL,
      race_code TEXT NOT NULL,
      notified_at INTEGER NOT NULL,
      PRIMARY KEY (athlete_id, race_code)
  );
  CREATE TABLE IF NOT EXISTS result_notifications (
    race_id TEXT PRIMARY KEY,
    notified_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

`);

module.exports = db;
