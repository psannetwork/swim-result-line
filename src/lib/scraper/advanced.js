const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache

// Basic rate limiter
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getGamesWithCache() {
  const cached = cache.get('games');
  if (cached) return cached;

  // Simulate or wrap with rate limiting if necessary, 
  // but let's assume LiveApi.getGames() is safe to call directly 
  // and we'll implement delay in the loop.
  const games = await LiveApi.getGames();
  cache.set('games', games);
  return games;
}

async function findAthleteInAllRaces(targetSwimmerCode) {
  const games = await getGamesWithCache();
  
  for (const game of games) {
    console.log(`Checking game: ${game.game_name} (${game.game_code})`);
    
    // 1. Get Dates
    const dates = await LiveApi.getSelectDateList(game.game_code);
    if (!dates || !dates.length) continue;

    for (const date of dates) {
      await delay(500); // Rate limit delay
      
      // 2. Get Races
      const raceList = await LiveApi.getRaceListByGameDate(game.game_code, date.game_date);
      if (!raceList) continue;

      for (const race of raceList) {
        // 3. Check Results
        // Try multiple statuses as suggested
        const statuses = [0, 1, 2]; // Assuming 0=BEFORE_START, 1=IN_PROGRESS, 2=RESULT or similar
        for (const status of statuses) {
            try {
                const results = await LiveApi.getRaceResults(game.game_code, race.program_id, race.heat, status);
                if (!results || !results.entry_list) continue;
                
                const participant = results.entry_list.find(p => p.swimmer_code == targetSwimmerCode);
                
                if (participant) {
                    return {
                        tournament: game.game_name,
                        race: race.race_name,
                        lane: participant.lane,
                        heat: race.heat
                    };
                }
            } catch (e) {
                // Ignore errors for specific statuses
            }
        }
      }
    }
  }
  return null;
}

module.exports = { findAthleteInAllRaces };
