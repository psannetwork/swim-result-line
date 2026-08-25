const { SwimLiveScraper } = require('swim-live-scraper');

async function testSearch(name) {
    console.log(`Searching for: "${name}"`);
    try {
        const results = await SwimLiveScraper.searchAthletes({ name: name });
        console.log(`Results found: ${results.data ? results.data.length : 0}`);
        if (results.data) {
            results.data.forEach(a => console.log(` - ${a.swimmer_name} (ID: ${a.swimmer_code})`));
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

async function main() {
    await testSearch('栗田　絆有');
    await testSearch('栗田絆有');
}

main();
