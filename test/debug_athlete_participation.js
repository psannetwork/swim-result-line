const { SwimLiveScraper } = require('swim-live-scraper');

async function debugAthlete() {
  const targetSwimmerCode = '8872602';
  // Check a specific tournament known to be relevant or large
  const gameCode = '4826412'; // 第99回 関東学生選手権水泳競技大会 as an example
  const fullDate = '2026-07-30';

  console.log(`Deep debugging for ${targetSwimmerCode} in ${gameCode}...`);

  try {
    const raceList = await SwimLiveScraper.getRaceListByGameDate(gameCode, fullDate);
    console.log(`Total races found: ${raceList.length}`);

    // Inspect first few races to see structure
    for (let i = 0; i < Math.min(5, raceList.length); i++) {
        const race = raceList[i];
        console.log(`Checking race object:`, JSON.stringify(race, null, 2));
        
        // Assume for now we need a property to fetch results
        // Based on the error, 'race_code' is not it.
        // Let's see what property it has (e.g., 'program_id', 'id', etc.)
    }
  } catch (err) {
    console.error('Error during deep debug:', err);
  }
}

debugAthlete();
