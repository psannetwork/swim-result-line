const { SwimLiveScraper } = require('swim-live-scraper');

async function testAthleteToRaceMapping() {
  console.log('--- 選手名からレース情報の取得テスト開始 ---');

  try {
    const athleteName = '七呂　理瑚'; // 前回のテストで取得できた選手名
    console.log(`選手名: ${athleteName}`);

    // 1. 全大会を横断検索
    const foundRaces = await SwimLiveScraper.searchAthleteAcrossGames(athleteName);
    
    if (!foundRaces || foundRaces.length === 0) {
      console.log('この選手の参加情報は見つかりませんでした。');
      return;
    }

    // 2. 最初の参加レースの詳細を表示
    const race = foundRaces[0];
    console.log(`参加大会: ${race.game_name}`);
    console.log(`種目: ${race.race_name}`);
    console.log(`組: ${race.heat}, レーン: ${race.lane}`);

  } catch (err) {
    console.error('エラー発生:', err);
  }
  
  console.log('--- テスト終了 ---');
}

testAthleteToRaceMapping();
