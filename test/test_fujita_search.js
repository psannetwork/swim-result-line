const { SwimLiveScraper } = require('swim-live-scraper');

async function main() {
  const name = '藤田奈央';
  console.log('Searching for:', name);
  try {
    const results = await SwimLiveScraper.searchAthletes({ name });
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

main().catch(console.error);
