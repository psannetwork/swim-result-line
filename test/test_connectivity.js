const { SwimLiveScraper } = require('swim-live-scraper');

async function testConnectivity() {
  console.log('--- 接続テスト開始 ---');

  // 1. 大会一覧取得テスト
  console.log('大会一覧を取得中...');
  try {
    const games = await SwimLiveScraper.getGames();
    console.log(`大会数: ${games ? games.length : 0}`);
    if (games && games.length > 0) {
        console.log(`最新大会: ${games[0].game_name}`);
    }
  } catch (err) {
    console.error('getGamesエラー:', err.message);
  }

  // 2. 小さな検索テスト（タイムアウトの切り分け）
  console.log('\n選手検索テスト中...');
  try {
    // タイムアウトを回避するため、まずは単純な検索を試す
    const results = await SwimLiveScraper.searchAthletes({ name: '寺本' });
    console.log(`検索結果数: ${results.data ? results.data.length : 0}`);
  } catch (err) {
    console.error('searchAthletesエラー:', err.message);
  }

  console.log('\n--- 接続テスト終了 ---');
}

testConnectivity();
