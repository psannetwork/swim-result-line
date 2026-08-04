const db = require('./db');

const rateLimit = (userId) => {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      user_id TEXT PRIMARY KEY,
      last_minute_count INTEGER DEFAULT 0,
      last_day_count INTEGER DEFAULT 0,
      last_reset_minute INTEGER,
      last_reset_day INTEGER
    );
  `);

  let record = db.prepare('SELECT * FROM rate_limits WHERE user_id = ?').get(userId);

  if (!record) {
    record = {
      user_id: userId,
      last_minute_count: 0,
      last_day_count: 0,
      last_reset_minute: now,
      last_reset_day: now
    };
    db.prepare('INSERT INTO rate_limits (user_id, last_minute_count, last_day_count, last_reset_minute, last_reset_day) VALUES (?, ?, ?, ?, ?)').run(
      userId, record.last_minute_count, record.last_day_count, record.last_reset_minute, record.last_reset_day
    );
  }

  // Reset counters
  if (now - record.last_reset_minute > 60 * 1000) {
    record.last_minute_count = 0;
    record.last_reset_minute = now;
  }
  if (now - record.last_reset_day > 24 * 60 * 60 * 1000) {
    record.last_day_count = 0;
    record.last_reset_day = now;
  }

  const limitPerMinute = parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 5;
  const limitPerDay = parseInt(process.env.RATE_LIMIT_PER_DAY) || 30;

  if (record.last_minute_count >= limitPerMinute || record.last_day_count >= limitPerDay) {
    return false;
  }

  db.prepare('UPDATE rate_limits SET last_minute_count = last_minute_count + 1, last_day_count = last_day_count + 1, last_reset_minute = ?, last_reset_day = ? WHERE user_id = ?').run(
    record.last_reset_minute, record.last_reset_day, userId
  );

  return true;
};

module.exports = rateLimit;
