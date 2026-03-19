const fs = require('fs');

let content = fs.readFileSync('public/chart_helper.js', 'utf8');

const anchor = '// Helper functions for Tooltips and Formatting';
const targetStart = content.indexOf(anchor);
const showFnIndex = content.lastIndexOf('async function showMethodologyResults(lineName) {');

if (targetStart !== -1 && showFnIndex !== -1 && targetStart < showFnIndex) {
    // Cut out everything between the first "// Helper functions" and "async function showMethodologyResults"
    const before = content.substring(0, targetStart);
    const after = content.substring(showFnIndex);

    // Add exactly ONE clean copy of the helpers
    const cleanHelpers = `// Helper functions for Tooltips and Formatting
const formatCur = (val) => val != null && !isNaN(val) ? '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const formatNum = (val) => val != null && !isNaN(val) ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

const createTooltipHTML = (label, description = '', formula = '', align = 'left') => {
    let tooltipPos = 'left-0';
    let arrowPos = 'left-4';
    if (align === 'right') { tooltipPos = 'right-0'; arrowPos = 'right-4'; }
    else if (align === 'center') { tooltipPos = 'left-1/2 transform -translate-x-1/2'; arrowPos = 'left-1/2 transform -translate-x-1/2'; }

    return \`
        <div class="tooltip-container" style="position: relative; display: inline-flex; align-items: center; gap: 4px; cursor: default; width: max-content; max-width: 100%;">
            <span>\${label}</span>
            \${(description || formula) ? \`
                <div style="cursor: help; color: #9ca3af; transition: color 0.2s;" onmouseover="this.style.color='#3b82f6'" onmouseout="this.style.color='#9ca3af'">
                    <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div class="tooltip-content \${tooltipPos}" style="position: absolute; bottom: 100%; margin-bottom: 4px; display: none; width: 250px; padding: 12px; background: #1f2937; color: white; font-size: 12px; border-radius: 8px; font-weight: normal; text-transform: none; z-index: 50; white-space: normal; text-align: left; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
                    \${description ? \`<div style="color: #e5e7eb; line-height: 1.5;">\${description}</div>\` : ''}
                    \${formula ? \`
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #4b5563;">
                            <span style="display: block; color: #9ca3af; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; font-weight: 600;">Fórmula:</span>
                            <code style="display: block; background: #111827; padding: 8px; border-radius: 4px; color: #93c5fd; font-size: 11px; word-break: break-all; font-family: monospace; border: 1px solid #374151;">\${formula}</code>
                        </div>
                    \` : ''}
                </div>
            \` : ''}
        </div>
    \`;
};

`;

    const newContent = before + cleanHelpers + after;
    fs.writeFileSync('public/chart_helper.js', newContent);
    console.log("Successfully cleaned duplicate helpers.");
} else {
    console.log("Could not find anchor tags.");
}
