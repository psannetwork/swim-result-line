const { SwimLiveScraper } = require('swim-live-scraper');

async function testSearchFailures() {
    const targets = ["牛田 希", "栗田 絆有", "栗田絆有", "牛田"];
    
    for (const name of targets) {
        console.log(`--- Searching for: '${name}' ---`);
        try {
            const results = await SwimLiveScraper.searchAthletes({ name: name });
            if (!results || !results.data || results.data.length === 0) {
                console.log("No results found.");
            } else {
                console.log(`Found ${results.data.length} athletes.`);
                results.data.slice(0, 3).forEach(a => console.log(`  - ${a.swimmer_name} (ID: ${a.swimmer_code})`));
            }
        } catch (err) {
            console.error(`Error searching for '${name}':`, err.message);
        }
    }
}

testSearchFailures();
