const db = require('./src/lib/db');

try {
  const athletes = db.prepare('SELECT * FROM athletes').all();
  console.log('Registered athletes:', JSON.stringify(athletes, null, 2));
} catch (err) {
  console.error('Error reading athletes table:', err);
}
