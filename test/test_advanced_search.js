const { SwimLiveScraper } = require('swim-live-scraper');

async function testAdvancedSearch() {
    // Attempting to search with the specific parameters requested
    const params = {
        name: "牛田 希",
        member_group_code: 99,
        school_class_code: 99,
        gender_code: 99
    };
    
    console.log(`--- Searching with params: ${JSON.stringify(params)} ---`);
    try {
        const results = await SwimLiveScraper.searchAthletes(params);
        if (!results || !results.data || results.data.length === 0) {
            console.log("No results found.");
        } else {
            console.log(`Found ${results.data.length} athletes.`);
            results.data.forEach(a => console.log(`  - ${a.swimmer_name} (ID: ${a.swimmer_code})`));
        }
    } catch (err) {
        console.error(`Error:`, err.message);
    }
}

testAdvancedSearch();
