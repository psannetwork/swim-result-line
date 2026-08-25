const { SwimLiveScraper } = require('swim-live-scraper');

async function testSearchKurita() {
    const athleteName = "栗田 絆有";
    console.log(`Searching for: ${athleteName}`);

    try {
        const results = await SwimLiveScraper.searchAthletes({ name: athleteName });
        
        if (!results || !results.data || results.data.length === 0) {
            console.log("No results found using searchAthletes.");
        } else {
            console.log(`Found ${results.data.length} athletes.`);
            results.data.forEach(a => console.log(a.swimmer_name));
        }

        const athleteNameWithoutSpace = "栗田絆有";
        console.log(`\nSearching for: ${athleteNameWithoutSpace}`);
        const results2 = await SwimLiveScraper.searchAthletes({ name: athleteNameWithoutSpace });
        
        if (!results2 || !results2.data || results2.data.length === 0) {
            console.log("No results found using searchAthletes (no space).");
        } else {
            console.log(`Found ${results2.data.length} athletes.`);
            results2.data.forEach(a => console.log(a.swimmer_name));
        }

    } catch (err) {
        console.error('Error during search:', err);
    }
}

testSearchKurita();
