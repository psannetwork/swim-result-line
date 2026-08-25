const { getGames } = require('../src/lib/scraper/main');

async function test() {
  try {
    console.log('Fetching games...');
    const games = await getGames();
    console.log('Games:', JSON.stringify(games, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
