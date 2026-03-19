const fs = require('fs');

const file = 'public/chart_helper.js';
let content = fs.readFileSync(file, 'utf8');

const target1 = `const [genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1] = await Promise.all([
            fetchJson('/api/generators?scenario=S0'), fetchJson('/api/generators?scenario=S1'),
            fetchJson('/api/demand?scenario=S0'), fetchJson('/api/demand?scenario=S1'),
            fetchJson('/api/flows?scenario=S0'), fetchJson('/api/flows?scenario=S1'),
            fetchJson('/api/marginal-costs?scenario=S0'), fetchJson('/api/marginal-costs?scenario=S1')
        ]);`;

const target1_replace = `const [genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1, transS1] = await Promise.all([
            fetchJson('/api/generators?scenario=S0'), fetchJson('/api/generators?scenario=S1'),
            fetchJson('/api/demand?scenario=S0'), fetchJson('/api/demand?scenario=S1'),
            fetchJson('/api/flows?scenario=S0'), fetchJson('/api/flows?scenario=S1'),
            fetchJson('/api/marginal-costs?scenario=S0'), fetchJson('/api/marginal-costs?scenario=S1'),
            fetchJson('/api/transmission-investment?scenario=' + targetScenario)
        ]);`;

const target2 = `globalData = { genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1 };`;
const target2_replace = `globalData = { genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1 };
        
        // Populate specific input variables based on line's configuration
        if (transS1) {
            const lineConfig = transS1.find(t => t['Nombre línea'] === lineName);
            if (lineConfig && lineConfig['Costo_unitario'] != null) {
                const capexVal = Number(lineConfig['Costo_unitario']);
                siepacInputs.capex = capexVal;
                asiaInputs.capex_usd = capexVal;
            }
        }`;

let newContent = content.replace(target1, target1_replace);
newContent = newContent.replace(target2, target2_replace);

if (newContent !== content) {
    fs.writeFileSync(file, newContent);
    console.log("Replaced successfully and fetched capext dynamically!");
} else {
    console.log("Could not match the targets to replace");
}
