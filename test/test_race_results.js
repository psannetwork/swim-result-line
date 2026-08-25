const { SwimLiveScraper } = require('swim-live-scraper');

async function testRaceResults() {
    console.log('--- レース結果取得テスト開始 ---');

    try {
        // 1. 適当な大会を取得
        const games = await SwimLiveScraper.getGames();
        if (!games || games.length === 0) {
            console.error('大会が見つかりません');
            return;
        }
        const gameCode = games[0].game_code;
        console.log(`対象大会: ${games[0].game_name} (${gameCode})`);

        // 2. その大会のレースリストを取得（適当な1件）
        // 実際にはAPIでリストを取得する必要があるが、ここではテスト用にgetRaceListByGameDateを使う
        const raceList = await SwimLiveScraper.getRaceListByGameDate(gameCode, '2026-08-23'); // 日付は適宜修正
        if (!raceList || raceList.length === 0) {
            console.log('レースリストが見つかりません（開催期間外かも）');
            return;
        }
        
        const targetRace = raceList[0];
        console.log(`対象レース: ${targetRace.race_name} (ProgramID: ${targetRace.program_id}, Heat: ${targetRace.heat})`);

        // 3. レース結果を取得（SwimLiveScraperクラス経由で試す）
        console.log('レース結果を取得中...');
        const results = await SwimLiveScraper.getRaceResults(gameCode, targetRace.program_id, targetRace.heat);
        
        console.log(`取得できた結果数: ${Array.isArray(results) ? results.length : '取得失敗'}`);
        if (results && results.length > 0) {
            console.log('取得データ例:', JSON.stringify(results[0], null, 2));
        }

    } catch (err) {
        console.error('エラー:', err);
    }
    
    console.log('--- レース結果取得テスト終了 ---');
}

testRaceResults();
