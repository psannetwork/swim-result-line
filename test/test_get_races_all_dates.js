const { SwimLiveScraper } = require('swim-live-scraper');

async function test() {
  const gameCode = '2726304';
  // Try dates within 07.29 to 07.31
  const dates = ['2026-07-29', '2026-07-30', '2026-07-31'];

  for (const fullDate of dates) {
    try {
      console.log(`Fetching race list for game ${gameCode} on ${fullDate}...`);
      const raceList = await SwimLiveScraper.getRaceListByGameDate(gameCode, fullDate);
      console.log(`Race List count for ${fullDate}:`, raceList.length);
      if (raceList.length > 0) {
        console.log('Sample data:', JSON.stringify(raceList[0], null, 2));
      }
    } catch (err) {
      console.error(`Error for ${fullDate}:`, err.message);
    }
  }
}

test();
