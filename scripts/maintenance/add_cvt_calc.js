const fs = require('fs');

const file = 'public/chart_helper.js';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        globalData = { genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1 };`;
const replacementStr = `        globalData = { genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1 };

        // Calculate initial CVT Semestral automatically
        let calc_cvt = 0;
        let lmpFrom = []; let lmpTo = [];
        const findNodeLMPs = (d, nName) => {
            for (const cntry in d.countries) { if (d.countries[cntry][nName]) return d.countries[cntry][nName]; }
            return null;
        };
        lmpFrom = findNodeLMPs(mcS1, expNode);
        lmpTo = findNodeLMPs(mcS1, impNode);
        const lFlows = flowS1.flows && flowS1.flows[lineName] ? flowS1.flows[lineName] : [];

        if (lmpFrom && lmpTo && lFlows.length > 0) {
            for (let i = 0; i < lFlows.length; i++) {
                const lmpF = lmpFrom[i] || 0; const lmpT = lmpTo[i] || 0; const f = lFlows[i] || 0;
                calc_cvt += Math.abs(f * (lmpT - lmpF));
            }
        }
        siepacInputs.CVTn_sem_USD = calc_cvt;`;

let newContent = content.replace(targetStr, replacementStr);

if (newContent !== content) {
    fs.writeFileSync(file, newContent);
    console.log("Successfully appended CVT calculation.");
} else {
    console.log("Failed to find target string for CVT.");
}
