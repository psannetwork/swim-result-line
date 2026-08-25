const axios = require('axios');

async function testDirectSearch() {
    const url = "https://result.swim.or.jp/api/v1/athletes";
    const params = {
        member_group_code: 99,
        school_class_code: 99,
        gender_code: 99,
        entry_group_name: "",
        name: "牛田 希"
    };

    console.log(`--- Requesting: ${url} ---`);
    try {
        const response = await axios.get(url, { params });
        if (response.data && response.data.data && response.data.data.length > 0) {
            console.log(`Found ${response.data.data.length} athletes.`);
            response.data.data.forEach(a => console.log(`  - ${a.swimmer_name} (ID: ${a.swimmer_code})`));
        } else {
            console.log("No results found.");
        }
    } catch (err) {
        console.error(`Error:`, err.message);
    }
}

testDirectSearch();
