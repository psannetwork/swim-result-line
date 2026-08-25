const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');

async function debugRace() {
    try {
        const gameCode = '7026601';
        const programId = '194';
        const heat = '4';
        const results = await LiveApi.getRaceResults(gameCode, programId, heat, 9);
        console.log(JSON.stringify(results[0], null, 2));
    } catch (err) {
        console.error(err);
    }
}

debugRace();
