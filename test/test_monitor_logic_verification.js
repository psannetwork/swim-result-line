const { SwimLiveScraper } = require('swim-live-scraper');
const db = require('./src/lib/db');
const { checkResults } = require('./src/lib/monitor');

async function testMonitor() {
  console.log('--- テスト開始 ---');

  // 1. 大会と選手を取得（適当な大会から）
  console.log('大会一覧を取得中...');
  const games = await SwimLiveScraper.getGames();
  if (!games || games.length === 0) {
    console.error('大会が見つかりませんでした。');
    return;
  }
  const targetGame = games[0]; // 最新の大会
  console.log(`対象大会: ${targetGame.game_name} (${targetGame.game_code})`);

  // 2. 選手を検索して登録（テスト用に2名）
  console.log('選手を検索中...');
  const searchResults = await SwimLiveScraper.searchAthletes({ name: '寺本' });
  const testAthletes = searchResults.data.slice(0, 2);
  
  if (testAthletes.length < 2) {
    console.warn('テストに必要な人数が確保できませんでした。');
  }

  // DBをクリアしてテスト用選手を登録
  db.prepare('DELETE FROM athletes').run();
  for (const athlete of testAthletes) {
    db.prepare('INSERT INTO athletes (id, name, user_id) VALUES (?, ?, ?)').run(athlete.swimmer_code, athlete.swimmer_name, 'test_user');
    console.log(`登録: ${athlete.swimmer_name} (ID: ${athlete.swimmer_code})`);
  }

  // 3. monitor.jsのcheckResultsを実行してみる
  console.log('checkResultsを実行...');
  try {
      await checkResults();
      console.log('checkResults実行完了');
  } catch (err) {
      console.error('checkResultsエラー:', err);
  }

  console.log('--- テスト終了 ---');
}

testMonitor();
