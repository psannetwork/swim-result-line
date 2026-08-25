const db = require('./index');

async function isResultNotified(raceId) {
  const row = db.prepare(
    'SELECT 1 FROM result_notifications WHERE race_id = ? LIMIT 1'
  ).get(raceId);
  return !!row;
}

async function saveResultNotification(raceId) {
  db.prepare(
    'INSERT OR IGNORE INTO result_notifications (race_id, notified_at) VALUES (?, CURRENT_TIMESTAMP)'
  ).run(raceId);
}

module.exports = { isResultNotified, saveResultNotification };
