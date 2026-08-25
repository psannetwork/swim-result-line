const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');

async function debugIndividualRace() {
    try {
        // 例として200mIMのレースデータを取得してみる
        // 本来は正しいゲームコード/プログラムIDが必要だが、調査用にスキーマを確認
        const results = await LiveApi.getRaceResults('7026601', '194', '1', 9); // 仮のID
        if (results && results.length > 0) {
            console.log(JSON.stringify(results[0], null, 2));
        }
    } catch (err) {
        console.error(err);
    }
}

debugIndividualRace();
