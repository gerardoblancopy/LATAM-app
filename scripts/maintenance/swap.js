const fs = require('fs');

const file = 'public/chart_helper.js';
let content = fs.readFileSync(file, 'utf8');

// The block for Ex-Post Semestrales
const exPostStartStr = '<div style="margin-bottom: 24px;">';
const exPostHeaderStr = 'Análisis Adicional: 3 Modelos Ex-Post Semestrales';

// The block for Peajes, Rentas
const peajesStartStr = '<div style="display: flex; gap: 20px;">';
const peajesHeaderStr = 'Peajes, Rentas y CURTR Semestral';

const exPostIndex = content.indexOf(exPostStartStr, content.indexOf(exPostHeaderStr) - 100);
const peajesIndex = content.indexOf(peajesStartStr, content.indexOf(peajesHeaderStr) - 100);

// we know how it's structured from our previous write_to_file
const exPostBlockLength = peajesIndex - exPostIndex;
const exPostBlock = content.substring(exPostIndex, peajesIndex);

// Let's find where peajes block ends. It ends with </div>\\n        \\`;
const peajesEndIndex = content.indexOf('        `;', peajesIndex);
const peajesBlock = content.substring(peajesIndex, peajesEndIndex);

if (exPostIndex > -1 && peajesIndex > -1 && peajesEndIndex > -1) {
    const contentBefore = content.substring(0, exPostIndex);
    const contentAfter = content.substring(peajesEndIndex);

    // Swap them!
    const newContent = contentBefore + peajesBlock + '\n            ' + exPostBlock + contentAfter;

    fs.writeFileSync(file, newContent);
    console.log('Swapped successfully!');
} else {
    console.log('Could not find the blocks');
    console.log(exPostIndex, peajesIndex, peajesEndIndex);
}
