const { LiveApi } = require('swim-live-scraper/dist/apis/live_api');

async function verifyAthleteInRace() {
    const gameCode = "7026601";
    const programId = "199";
    const heat = "1";
    
    console.log(`Fetching results for Game: ${gameCode}, Program: ${programId}, Heat: ${heat}`);

    try {
        // Fetch results using the library as requested
        const results = await LiveApi.getRaceResults(gameCode, programId, heat, 9);
        
        if (!results || results.length === 0) {
            console.log("No results found.");
        } else {
            console.log("Results found:");
            results.forEach(athlete => {
                console.log(`- ${athlete.swimmer_name} (ID: ${athlete.swimmer_code})`);
            });
        }
    } catch (err) {
        console.error('Error fetching results:', err);
    }
}

verifyAthleteInRace();
