const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');
const { getGames } = require('./src/lib/scraper/main');

async function findAthlete() {
  const targetSwimmerCode = '8872602';
  
  try {
    console.log('Fetching games...');
    const games = await getGames();
    
    for (const game of games) {
      console.log(`Checking game: ${game.game_name} (${game.game_code})`);
      const datePart = game.period.split(' ')[0].replace('.', '-');
      const fullDate = `2026-${datePart}`;
      
      const raceList = await require('swim-live-scraper').SwimLiveScraper.getRaceListByGameDate(game.game_code, fullDate);
      
      for (const race of raceList) {
        try {
          // LiveApi.getRaceResults を使用して詳細を取得
          // RaceStatus.RESULT は通常 9
          const results = await LiveApi.getRaceResults(game.game_code, race.program_id, race.heat, 9);
          
          if (results && results.entry_list) {
            const participant = results.entry_list.find(p => 
                p.swimmer_code == targetSwimmerCode || 
                (p.swimmer_code && p.swimmer_code.toString() === targetSwimmerCode)
            );
            
            if (participant) {
              console.log('FOUND ATHLETE!');
              console.log(`Tournament: ${game.game_name}`);
              console.log(`Race: ${race.race_name}`);
              console.log(`Heat: ${race.heat}`);
              console.log(`Lane: ${participant.lane || 'N/A'}`);
              return;
            }
          }
        } catch (e) {
          // 取得できないレースはスキップ
        }
      }
    }
    console.log('Athlete not found.');
  } catch (err) {
    console.error('Error:', err);
  }
}

findAthlete();
