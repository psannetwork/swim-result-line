const { checkResults } = require('../src/lib/monitor');
const db = require('../src/lib/db/index');

// Use a known athlete for testing the mapping
const targetId = '9449376';
const targetName = '七呂　理瑚';
db.prepare('INSERT OR REPLACE INTO athletes (id, name, user_id) VALUES (?, ?, ?)').run(targetId, targetName, 'test_user');

async function test() {
    try {
        await checkResults();
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
