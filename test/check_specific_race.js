const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');

async function checkSpecificRace() {
  const targetSwimmerCode = '8872602';
  const gameCode = '4726201';
  const programId = '6';
  const heat = '1';
  const raceStatus = 0; // 0 for start list?

  try {
    console.log(`Checking race: game=${gameCode}, program=${programId}, heat=${heat}, status=${raceStatus}`);
    const results = await LiveApi.getRaceResults(gameCode, programId, heat, raceStatus);
    
    // 取得できたデータを表示して確認
    console.log('Results structure:', JSON.stringify(results, null, 2));

    if (results && results.entry_list) {
      const participant = results.entry_list.find(p => 
          p.swimmer_code == targetSwimmerCode || 
          (p.swimmer_code && p.swimmer_code.toString() === targetSwimmerCode)
      );
      
      if (participant) {
        console.log('FOUND ATHLETE!');
        console.log(JSON.stringify(participant, null, 2));
      } else {
        console.log('Athlete not found in this specific race.');
      }
    } else {
      console.log('No entry_list found in response.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSpecificRace();
