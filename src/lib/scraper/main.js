const { SwimLiveScraper } = require('swim-live-scraper');

let cachedGames = null;
let lastFetchTime = 0;

async function withTimeout(promise, ms = 5000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Scraper request timed out')), ms)
  );
  return Promise.race([promise, timeout]);
}

async function getGames() {
  if (cachedGames && (Date.now() - lastFetchTime < 3600000)) { // 1時間キャッシュ
      return cachedGames;
  }
  // タイムアウト付きで実行
  cachedGames = await withTimeout(SwimLiveScraper.getGames(), 8000);
  lastFetchTime = Date.now();
  return cachedGames;
}

async function getAthleteRaces(gameCode, athleteName) {
  try {
    return await withTimeout(SwimLiveScraper.getSearchedRaces(gameCode, athleteName, null, null), 8000);
  } catch (error) {
    console.error(`Error searching for ${athleteName} in game ${gameCode}:`, error);
    return [];
  }
}

module.exports = { getGames, getAthleteRaces };
