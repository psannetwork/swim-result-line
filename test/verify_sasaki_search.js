const { SwimLiveScraper } = require('swim-live-scraper');
const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');

async function testSearchSasaki() {
    const athleteName = "佐々木優羽";
    console.log(`Searching for: ${athleteName}`);

    try {
        // 1. 名前で全大会を横断検索
        const foundRaces = await SwimLiveScraper.searchAthleteAcrossGames(athleteName);
        
        if (!foundRaces || foundRaces.length === 0) {
            console.log("No races found for this athlete.");
            return;
        }

        console.log(`Found ${foundRaces.length} races.`);

        for (const race of foundRaces) {
            console.log(`Checking race: ${race.game_name || 'Unknown'} - ${race.race_name || 'Unknown'}`);
            console.log(`Game Code: ${race.game_code}, Program ID: ${race.program_id}, Heat: ${race.heat}`);
            
            // 2. 結果が確定しているか確認 (status 9)
            const entryList = await LiveApi.getRaceResults(race.game_code, race.program_id, race.heat, 9);
            
            if (!entryList || !Array.isArray(entryList) || entryList.length === 0) {
                console.log("-> No results found (or race not finished).");
            } else {
                console.log("-> Results found!");
                const athleteEntry = entryList.find(e => e.swimmer_name && e.swimmer_name.includes(athleteName));
                if (athleteEntry) {
                    console.log(`-> Athlete found in results: ${athleteEntry.swimmer_name}, Time: ${athleteEntry.record || 'N/A'}`);
                } else {
                    console.log("-> Athlete not found in entry list (maybe under a different name format?).");
                }
            }
        }
    } catch (err) {
        console.error('Error during search:', err);
    }
}

testSearchSasaki();
