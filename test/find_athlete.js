const { SwimLiveScraper } = require('swim-live-scraper');
const { getGames } = require('./src/lib/scraper/main');

async function findAthlete() {
  const targetSwimmerCode = '8872602';
  
  try {
    console.log('Fetching active games...');
    const games = await getGames();
    // 開催中に限らず全てチェック
    const targetGames = games;
    
    if (targetGames.length === 0) {
      console.log('No games found.');
      return;
    }

    for (const game of targetGames) {
      console.log(`Checking game: ${game.game_name} (${game.game_code})`);
      const datePart = game.period.split(' ')[0].replace('.', '-');
      const fullDate = `2026-${datePart}`;
      
      const raceList = await SwimLiveScraper.getRaceListByGameDate(game.game_code, fullDate);
      
      for (const race of raceList) {
        // レース詳細（スタートリスト等）を取得
        const startList = await SwimLiveScraper.getRaceResults(race.race_code); // Note: Start list and results might be same or similar endpoint depending on library structure
        
        const participant = startList.find(p => p.swimmer_code === targetSwimmerCode || (p.swimmer_code && p.swimmer_code.toString() === targetSwimmerCode));
        
        if (participant) {
          console.log('Found athlete!');
          console.log(`Tournament: ${game.game_name}`);
          console.log(`Race: ${race.race_name}`);
          console.log(`Lane: ${participant.lane || 'N/A'}`);
          console.log(`Heat: ${participant.heat || 'N/A'}`);
          return;
        }
      }
    }
    console.log('Athlete not found in any active games.');
  } catch (err) {
    console.error('Error:', err);
  }
}

findAthlete();
