const { SwimLiveScraper } = require('swim-live-scraper');

async function testSearchKuritaSpecific() {
    const gameCode = "7026601";
    const athleteName = "栗田 絆有";
    console.log(`Searching for: ${athleteName} in game ${gameCode}`);

    try {
        const races = await SwimLiveScraper.getSearchedRaces(gameCode, athleteName, null, null);
        
        if (!races || races.length === 0) {
            console.log("No races found for this athlete in this game.");
        } else {
            console.log(`Found ${races.length} races.`);
            races.forEach(r => console.log(r.race_name));
        }

    } catch (err) {
        console.error('Error during search:', err);
    }
}

testSearchKuritaSpecific();
