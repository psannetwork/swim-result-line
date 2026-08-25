const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');

async function inspectResults() {
  try {
    console.log('Fetching results...');
    const results = await LiveApi.getRaceResults('7026601', '206', '1', 9);
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

inspectResults();
