const db = require('./db/index');

// Scraper用のレート制限を管理する
const scraperRateLimit = (limitPerMinute = 10) => {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  db.exec(`
    CREATE TABLE IF NOT EXISTS scraper_rate_limits (
      id TEXT PRIMARY KEY,
      last_minute_count INTEGER DEFAULT 0,
      last_reset_minute INTEGER
    );
  `);

  let record = db.prepare('SELECT * FROM scraper_rate_limits WHERE id = ?').get('global');

  if (!record) {
    record = {
      id: 'global',
      last_minute_count: 0,
      last_reset_minute: now
    };
    db.prepare('INSERT INTO scraper_rate_limits (id, last_minute_count, last_reset_minute) VALUES (?, ?, ?)').run(
      record.id, record.last_minute_count, record.last_reset_minute
    );
  }

  // Reset counter
  if (now - record.last_reset_minute > 60 * 1000) {
    record.last_minute_count = 0;
    record.last_reset_minute = now;
  }

  if (record.last_minute_count >= limitPerMinute) {
    return false;
  }

  db.prepare('UPDATE scraper_rate_limits SET last_minute_count = last_minute_count + 1, last_reset_minute = ? WHERE id = ?').run(
    record.last_reset_minute, 'global'
  );

  return true;
};

module.exports = scraperRateLimit;
