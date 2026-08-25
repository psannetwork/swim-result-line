const { SwimLiveScraper } = require('swim-live-scraper');

async function testSearch(name) {
  console.log(`Searching for: ${name}`);
  try {
    const results = await SwimLiveScraper.searchAthletes({ name: name });
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

async function run() {
    await testSearch('栗田');
}
run();
