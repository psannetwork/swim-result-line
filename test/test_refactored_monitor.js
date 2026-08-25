const { SwimLiveScraper } = require('swim-live-scraper');
const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');

async function testComprehensiveMonitoring() {
    const athleteName = "佐々木優羽";
    const normalizedTargetName = athleteName.replace(/\s+/g, '');
    console.log(`--- Starting Test for: ${athleteName} ---`);

    try {
        const foundRaces = await SwimLiveScraper.searchAthleteAcrossGames(athleteName);
        if (!foundRaces || foundRaces.length === 0) {
            console.log("No races found.");
            return;
        }

        console.log(`Found ${foundRaces.length} potential races.`);

        for (const race of foundRaces) {
            console.log(`\nChecking: Game ${race.game_code}, Program ${race.program_id}, Heat ${race.heat}`);
            
            const entryList = await LiveApi.getRaceResults(race.game_code, race.program_id, race.heat, 9);
            
            if (!entryList || !Array.isArray(entryList)) {
                console.log("-> Skipping.");
                continue;
            }

            // データ構造のデバッグ: 最初の結果の内容
            // console.log("Sample entry:", JSON.stringify(entryList[0], null, 2));

            // 参加者検索: リレーの場合、swimmer1_name, swimmer2_name... をチェックする必要がある
            const foundParticipant = entryList.find(e => {
                const names = [e.swimmer_name, e.swimmer1_name, e.swimmer2_name, e.swimmer3_name, e.swimmer4_name];
                return names.some(n => n && n.replace(/\s+/g, '').includes(normalizedTargetName));
            });

            if (!foundParticipant) {
                console.log("-> Athlete not found in participant names.");
                continue;
            }

            console.log(`-> SUCCESS: Athlete found in results! Time: ${foundParticipant.result_time}`);
        }
    } catch (err) {
        console.error('Test error:', err);
    }
}

testComprehensiveMonitoring();
