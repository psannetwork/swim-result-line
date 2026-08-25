const { SwimLiveScraper } = require('swim-live-scraper');

async function test() {
  const athleteId = '8055332'; // データベースに登録されているIDの1つ

  try {
    console.log(`Searching for athlete by ID: ${athleteId}...`);
    // スクリプトライブラリにIDで検索するメソッドがあるか確認（一般的な推測）
    // もし searchAthletes がIDをサポートしていない場合、他に使えるメソッドがあるか確認が必要
    const results = await SwimLiveScraper.searchAthletes({ id: athleteId });
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
