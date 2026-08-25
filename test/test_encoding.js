const { SwimLiveScraper } = require('swim-live-scraper');

async function testSearchWithEncoding() {
    // UTF-8 normalization test
    const names = ["牛田　希", "牛田 希", "栗田　絆有", "栗田 絆有"];
    
    for (const name of names) {
        console.log(`--- Testing with: '${name}' (length: ${name.length}) ---`);
        try {
            const results = await SwimLiveScraper.searchAthletes({ name: name });
            if (!results || !results.data || results.data.length === 0) {
                console.log("No results found.");
            } else {
                console.log(`Found ${results.data.length} athletes.`);
            }
        } catch (err) {
            console.error(`Error:`, err.message);
        }
    }
}

testSearchWithEncoding();
