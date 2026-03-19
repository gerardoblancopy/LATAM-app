const fs = require('fs');

const file = 'public/chart_helper.js';
let content = fs.readFileSync(file, 'utf8');

// I will split the template literal around the two divs and recombine them.
const split1 = '<div style="margin-bottom: 24px;">\\n                <h3 style="margin-bottom: 12px; font-size: 1.25rem; font-weight: 600; color: #1e3a8a;">Análisis Adicional';
const split2 = '<div style="display: flex; gap: 20px;">\\n                <div class="res-card" style="flex:1; border-top: 4px solid #eab308;">\\n                    <div class="res-card-header">Peajes, Rentas y CURTR Semestral</div>';

const expostRegex = /<div style="margin-bottom: 24px;">\s*<h3 style="margin-bottom: 12px; font-size: 1.25rem; font-weight: 600; color: #1e3a8a;">Análisis Adicional[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;

const peajesRegex = /<div style="display: flex; gap: 20px;">\s*<div class="res-card" style="flex:1; border-top: 4px solid #eab308;">\s*<div class="res-card-header">Peajes, Rentas y CURTR Semestral<\/div>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const expostMatch = content.match(expostRegex);
const peajesMatch = content.match(peajesRegex);

if (expostMatch && peajesMatch) {
    // Cut both
    let newContent = content.replace(expostMatch[0], '');
    newContent = newContent.replace(peajesMatch[0], 'SPLIT_HERE');

    // Put Peajes FIRST, then ExPost
    const combined = peajesMatch[0] + '\\n\\n            ' + expostMatch[0];
    newContent = newContent.replace('SPLIT_HERE', combined);

    fs.writeFileSync(file, newContent);
    console.log('Successfully swapped!');
} else {
    console.log('Failed to match Regex blocks.');
    console.log('Expost:', !!expostMatch, 'Peajes:', !!peajesMatch);
}
