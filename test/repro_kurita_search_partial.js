const { SwimLiveScraper } = require('swim-live-scraper');

async function testSearchKuritaPartial() {
    const athleteNamePartial = "栗田";
    console.log(`Searching for: ${athleteNamePartial}`);

    try {
        const results = await SwimLiveScraper.searchAthletes({ name: athleteNamePartial });
        
        if (!results || !results.data || results.data.length === 0) {
            console.log("No results found using searchAthletes (partial).");
        } else {
            console.log(`Found ${results.data.length} athletes.`);
            results.data.forEach(a => console.log(a.swimmer_name));
        }

    } catch (err) {
        console.error('Error during search:', err);
    }
}

testSearchKuritaPartial();
