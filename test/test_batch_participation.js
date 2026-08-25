const { SwimLiveScraper } = require('swim-live-scraper');

async function testBatchParticipationRetrieval() {
  console.log('--- 大会参加者情報取得テスト開始 ---');

  try {
    const gameCode = '7026601';
    const raceList = await SwimLiveScraper.getRaceListByGameDate(gameCode, '2026-08-22');
    
    if (!raceList || raceList.length === 0) {
      console.log('レースデータが見つかりませんでした。');
      return;
    }

    const targetRace = raceList[0];
    console.log(`対象レース: ${targetRace.race_name} (Heat: ${targetRace.heat})`);
    
    const results = await SwimLiveScraper.getRaceResults(gameCode, targetRace.program_id, targetRace.heat, 9);

    if (!results || results.length === 0) {
      console.log('このレースの参加者データが見つかりません。');
      return;
    }

    const shuffled = results.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 20);

    console.log(`選出人数: ${selected.length}名`);
    
    selected.forEach((p, index) => {
      console.log(`[${index + 1}] ${p.swimmer_name || '不明'}`);
      console.log(`    レーン: ${p.lane}`);
      console.log(`    タイム: ${p.result_time || '記録なし'}`);
    });

  } catch (err) {
    console.error('エラー発生:', err);
  }
  
  console.log('--- 大会参加者情報取得テスト終了 ---');
}

testBatchParticipationRetrieval();
