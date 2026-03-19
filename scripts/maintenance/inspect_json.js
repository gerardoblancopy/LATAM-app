
const fs = require('fs');

try {
    const raw = fs.readFileSync('generation_results.json');
    const data = JSON.parse(raw);

    if (data.energy_summary) {
        console.log("Keys in energy_summary:", Object.keys(data.energy_summary));
        const sampleKey = Object.keys(data.energy_summary)[0];
        console.log(`Sample data for ${sampleKey}:`, data.energy_summary[sampleKey]);
    } else {
        console.log("energy_summary key NOT found");
    }

    if (data.countries) {
        console.log("Keys in countries:", Object.keys(data.countries));
    }

} catch (err) {
    console.error(err);
}
