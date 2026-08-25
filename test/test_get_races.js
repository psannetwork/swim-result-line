const { SwimLiveScraper } = require('swim-live-scraper');

async function test() {
  const gameCode = '2726304'; // 大阪高校新人水泳競技大会
  const fullDate = '2026-07-29'; // 開催期間に基づいて指定

  try {
    console.log(`Fetching race list for game ${gameCode} on ${fullDate}...`);
    const raceList = await SwimLiveScraper.getRaceListByGameDate(gameCode, fullDate);
    console.log('Race List:', JSON.stringify(raceList.slice(0, 5), null, 2)); // 最初の5件のみ表示
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
