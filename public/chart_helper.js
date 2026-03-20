const OIRSE_THEME = {
    bgPrimary: '#0f1117',
    bgSurface: '#1c1f2e',
    bgElevated: '#242838',
    border: '#2e3348',
    textPrimary: '#edf0f5',
    textSecondary: '#b0b8cc',
    textMuted: '#8891a8',
    accent: '#6366f1',
    accentHover: '#818cf8',
    green: '#34d399',
    red: '#f87171',
    amber: '#fbbf24',
    cyan: '#22d3ee',
    shadow: '0 14px 40px rgba(0, 0, 0, 0.55)'
};

const CHART_DARK_DEFAULTS = {
    color: OIRSE_THEME.textSecondary,
    borderColor: OIRSE_THEME.border,
    tooltipBg: 'rgba(15, 17, 23, 0.96)',
    tooltipText: OIRSE_THEME.textPrimary
};

let oirseModalStylesMounted = false;

function ensureOirseModalStyles() {
    if (oirseModalStylesMounted) return;
    const style = document.createElement('style');
    style.id = 'oirse-chart-modal-styles';
    style.innerHTML = `
        .oirse-modal {
            color: ${OIRSE_THEME.textPrimary};
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: ${OIRSE_THEME.bgSurface} !important;
            border: 1px solid ${OIRSE_THEME.border} !important;
        }
        .oirse-modal h1, .oirse-modal h2, .oirse-modal h3, .oirse-modal h4 {
            color: ${OIRSE_THEME.textPrimary} !important;
        }
        .oirse-modal button {
            background: ${OIRSE_THEME.bgElevated};
            color: ${OIRSE_THEME.textPrimary};
            border: 1px solid ${OIRSE_THEME.border};
            border-radius: 6px;
            transition: all 0.2s ease;
        }
        .oirse-modal button:hover {
            border-color: ${OIRSE_THEME.accentHover};
            box-shadow: 0 0 0 1px ${OIRSE_THEME.accentHover}33;
        }
        .oirse-modal .mono,
        .oirse-modal td,
        .oirse-modal .font-mono {
            font-family: "Fira Code", "SF Mono", "Cascadia Code", monospace !important;
            font-variant-numeric: tabular-nums;
        }
        .oirse-modal table {
            background: ${OIRSE_THEME.bgSurface} !important;
            color: ${OIRSE_THEME.textPrimary} !important;
            border-color: ${OIRSE_THEME.border} !important;
        }
        .oirse-modal thead tr,
        .oirse-modal thead th {
            background: ${OIRSE_THEME.bgElevated} !important;
            color: ${OIRSE_THEME.textSecondary} !important;
            border-color: ${OIRSE_THEME.border} !important;
        }
        .oirse-modal tbody tr:nth-child(odd) {
            background: ${OIRSE_THEME.bgSurface} !important;
        }
        .oirse-modal tbody tr:nth-child(even) {
            background: #202437 !important;
        }
        .oirse-modal tbody td {
            border-color: ${OIRSE_THEME.border} !important;
        }
        .oirse-modal input,
        .oirse-modal select {
            background: ${OIRSE_THEME.bgElevated} !important;
            color: ${OIRSE_THEME.textPrimary} !important;
            border: 1px solid ${OIRSE_THEME.border} !important;
        }
    `;
    document.head.appendChild(style);
    oirseModalStylesMounted = true;
}

function applyChartDarkDefaults() {
    if (!window.Chart || window.__oirseChartDarkApplied) return;
    const defaults = window.Chart.defaults;
    defaults.plugins = defaults.plugins || {};
    defaults.plugins.legend = defaults.plugins.legend || {};
    defaults.plugins.legend.labels = defaults.plugins.legend.labels || {};
    defaults.plugins.tooltip = defaults.plugins.tooltip || {};
    defaults.color = CHART_DARK_DEFAULTS.color;
    defaults.borderColor = CHART_DARK_DEFAULTS.borderColor;
    defaults.plugins.legend.labels.color = CHART_DARK_DEFAULTS.color;
    defaults.plugins.tooltip.backgroundColor = CHART_DARK_DEFAULTS.tooltipBg;
    defaults.plugins.tooltip.titleColor = CHART_DARK_DEFAULTS.tooltipText;
    defaults.plugins.tooltip.bodyColor = CHART_DARK_DEFAULTS.tooltipText;
    defaults.plugins.tooltip.borderColor = OIRSE_THEME.border;
    defaults.plugins.tooltip.borderWidth = 1;
    window.__oirseChartDarkApplied = true;
}

// Helper to create a modal with a specific ID and content structure
function createModal(modalId, zIndex) {
    ensureOirseModalStyles();
    applyChartDarkDefaults();
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'oirse-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${OIRSE_THEME.bgSurface};
            padding: 20px;
            box-shadow: ${OIRSE_THEME.shadow};
            z-index: ${zIndex};
            border: 1px solid ${OIRSE_THEME.border};
            border-radius: 8px;
            display: none;
            flex-direction: column;
        `;
        document.body.appendChild(modal);
    } else {
        modal.classList.add('oirse-modal');
    }
    return modal;
}

// Function to load and display generation chart by Country
function showGenerationChart(countryName) {
    if (!countryName) return;

    const modalId = 'gen-chart-modal';
    let modal = createModal(modalId, 2000); // z-index 2000

    // Reset content to ensure clean state
    modal.innerHTML = '';
    modal.style.width = '90%';
    modal.style.maxWidth = '1000px';
    modal.style.height = '600px';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        align-self: flex-end;
        padding: 5px 10px;
        margin-bottom: 10px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => {
        if (window.myGenChart) { window.myGenChart.destroy(); window.myGenChart = null; }
        modal.style.display = 'none';
    };

    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = "flex-grow: 1; position: relative;";

    const canvas = document.createElement('canvas');
    canvas.id = 'gen-chart-canvas';
    canvasContainer.appendChild(canvas);

    modal.appendChild(closeBtn);
    modal.appendChild(canvasContainer);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    fetch('/api/generation?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0'))
        .then(res => {
            if (!res.ok) throw new Error("No available generation data");
            return res.json();
        })
        .then(data => {
            const countryData = data.countries[countryName];
            if (!countryData) {
                alert(`No hay datos de generación para el país: ${countryName}`);
                modal.style.display = 'none';
                return;
            }

            const timeSteps = data.time_steps;
            const generation = countryData.generation;
            const demand = countryData.demand;

            // Define colors mapping
            const techColors = {
                'Hydro Pasada': '#5DADE2',
                'Bioenergía': '#A9DFBF',
                'Geotérmica': '#E74C3C',
                'Hydro Embalse': '#3498DB',
                'Solar': '#F4D03F',
                'Eolica': '#388E3C',
                'Nuclear': '#1F618D',
                'Carbón': '#000000',
                'Gas CC': '#7B241C',
                'Gas CA': '#A93226',
                'Diesel': '#808080',
                'BESS Descarga': '#00BCD4',
                'BESS Carga': '#ADD8E6',
                'Loss Load': '#2F4F4F'
            };

            // Define specific stacking order (bottom to top)
            const stackOrder = [
                'Hydro Pasada', 'Bioenergía', 'Geotérmica', 'Hydro Embalse',
                'Solar', 'Eolica', 'Nuclear', 'Carbón', 'Gas CC', 'Gas CA',
                'Diesel', 'BESS Descarga', 'Loss Load'
            ];

            // Prepare datasets
            const datasets = [];

            const getOrderIndex = (tech) => {
                const idx = stackOrder.indexOf(tech);
                return idx === -1 ? 999 : idx;
            };

            const sortedTechs = Object.keys(generation).sort((a, b) => {
                return getOrderIndex(a) - getOrderIndex(b);
            });

            sortedTechs.forEach(tech => {
                let label = tech; // Use exact name for label
                let dataPoints = generation[tech];
                let color = techColors[tech] || '#' + Math.floor(Math.random() * 16777215).toString(16);

                // Special handling for BESS Carga
                if (tech === 'BESS Carga') {
                    dataPoints = dataPoints.map(v => -Math.abs(v));
                }

                datasets.push({
                    label: label,
                    data: dataPoints,
                    backgroundColor: color,
                    borderColor: color,
                    borderWidth: 1,
                    fill: true,
                    pointRadius: 0,
                    tension: 0, // No smoothing
                    order: 1, // Draw below demand
                    stack: 'generation_stack' // Group all generation areas
                });
            });

            // Add Demand Line LAST to ensure it renders on top
            if (demand && demand.length > 0) {
                datasets.push({
                    label: 'Demanda',
                    data: demand,
                    type: 'line', // Line chart on top of stack
                    borderColor: 'black',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0, // No smoothing, straight lines
                    order: 0, // 0 = Highest priority (Topmost layer in Chart.js)
                    stack: 'demand_stack' // Separate stack so it doesn't add to generation
                });
            }

            const ctx = document.getElementById('gen-chart-canvas').getContext('2d');

            if (window.myGenChart) { window.myGenChart.destroy(); window.myGenChart = null; }

            window.myGenChart = new Chart(ctx, {
                type: 'line', // Base type must be line to support stacked area + line
                data: {
                    labels: timeSteps,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: 'Hora' },
                            grid: { display: false }
                        },
                        y: {
                            stacked: true, // Enable stacking
                            title: { display: true, text: 'Generación [MW]' }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: `Generación por Tecnología - ${countryName}`
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            itemSort: function (a, b) {
                                return b.datasetIndex - a.datasetIndex;
                            }
                        },
                        legend: {
                            position: 'bottom',
                            reverse: true
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });

        })
        .catch(err => {
            console.error(err);
            alert("Error cargando curva de generación. Verifica si el modelo fue ejecutado.");
            modal.style.display = 'none';
        });
}


// Function to load and display flow chart
function showFlowChart(lineNames) {
    if (!lineNames) return;
    const names = Array.isArray(lineNames) ? lineNames : [lineNames];
    if (names.length === 0) return;

    const modalId = 'flow-chart-modal';
    let modal = createModal(modalId, 2001); // z-index 2001

    modal.innerHTML = '';
    modal.style.width = '80%';
    modal.style.maxWidth = '800px';
    modal.style.height = '500px';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        align-self: flex-end;
        padding: 5px 10px;
        margin-bottom: 10px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => {
        if (window.myFlowChart) { window.myFlowChart.destroy(); window.myFlowChart = null; }
        modal.style.display = 'none';
    };

    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = "flex-grow: 1; position: relative;";

    const canvas = document.createElement('canvas');
    canvas.id = 'flow-chart-canvas';
    canvasContainer.appendChild(canvas);

    modal.appendChild(closeBtn);
    modal.appendChild(canvasContainer);

    // Close other modals if open
    ['energy-chart-modal', 'gen-chart-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    fetch('/api/flows?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0'))
        .then(response => {
            if (!response.ok) throw new Error("No flow data available");
            return response.json();
        })
        .then(data => {
            const timeSteps = data.time_steps;
            const datasets = [];

            const colors = [
                'rgb(75, 192, 192)', 'rgb(255, 99, 132)', 'rgb(54, 162, 235)',
                'rgb(255, 206, 86)', 'rgb(153, 102, 255)', 'rgb(255, 159, 64)'
            ];

            names.forEach((name, index) => {
                const flows = data.flows[name];
                if (flows) {
                    datasets.push({
                        label: `${name} [MW]`,
                        data: flows,
                        borderColor: colors[index % colors.length],
                        backgroundColor: colors[index % colors.length],
                        tension: 0.1,
                        borderWidth: 2,
                        pointRadius: 2,
                        fill: false
                    });
                } else {
                    console.warn(`No flow data for line: ${name}`);
                }
            });

            if (datasets.length === 0) {
                alert('No hay datos de flujo para las líneas seleccionadas.');
                modal.style.display = 'none';
                return;
            }

            const ctx = document.getElementById('flow-chart-canvas').getContext('2d');

            if (window.myFlowChart) { window.myFlowChart.destroy(); window.myFlowChart = null; }

            window.myFlowChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: timeSteps,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        x: {
                            title: { display: true, text: 'Periodo' }
                        },
                        y: {
                            title: { display: true, text: 'Flujo [MW]' },
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        title: { display: true, text: `Comparación de Flujos de Potencia` },
                        tooltip: { mode: 'index', intersect: false }
                    }
                }
            });
        })
        .catch(error => {
            console.error('Error loading flow data:', error);
            alert('No se pudieron cargar los datos de flujo. Asegúrese de haber ejecutado el modelo primero.');
            modal.style.display = 'none';
        });
}

// Function to load and display Energy Summary (TWh) Bar Chart and Table by Country
function showEnergySummary(countryName) {
    if (!countryName) return;

    const modalId = 'energy-chart-modal';
    let modal = createModal(modalId, 2002); // z-index 2002

    modal.innerHTML = '';
    modal.style.width = '90%';
    modal.style.maxWidth = '1000px';
    modal.style.height = '85vh'; // Slightly taller
    modal.style.overflowY = 'hidden'; // Main modal hidden, internal containers scroll

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        align-self: flex-end;
        padding: 5px 10px;
        margin-bottom: 5px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => {
        if (window.myEnergyChart) { window.myEnergyChart.destroy(); window.myEnergyChart = null; }
        modal.style.display = 'none';
    };

    // Structure: Flex column
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = "flex-grow: 1; display: flex; flex-direction: column; gap: 10px; overflow: hidden;";

    // Table Area (Top, Flex 1 but limit height)
    const tableContainer = document.createElement('div');
    tableContainer.id = 'energy-table-container';
    tableContainer.style.cssText = `flex: 1; overflow-y: auto; padding: 10px; background: ${OIRSE_THEME.bgElevated}; border-radius: 4px; min-height: 200px; border: 1px solid ${OIRSE_THEME.border};`;

    // Chart Area (Bottom, Flex 1 for Treemap)
    const chartContainer = document.createElement('div');
    chartContainer.style.cssText = `flex: 1; padding: 10px; background: ${OIRSE_THEME.bgSurface}; border-radius: 4px; border: 1px solid ${OIRSE_THEME.border}; min-height: 250px; position: relative;`;

    const canvas = document.createElement('canvas');
    canvas.id = 'energy-treemap-canvas';
    chartContainer.appendChild(canvas);

    contentContainer.appendChild(tableContainer);
    contentContainer.appendChild(chartContainer);

    modal.appendChild(closeBtn);
    modal.appendChild(contentContainer);

    // Close other modals if open
    ['gen-chart-modal', 'flow-chart-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    fetch('/api/generation?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0'))
        .then(res => res.json())
        .then(data => {
            const summaryData = data.energy_summary ? data.energy_summary[countryName] : null;
            if (!summaryData) {
                alert(`No hay resumen de energía para: ${countryName}. Asegúrate de ejecutar el modelo nuevamente.`);
                modal.style.display = 'none';
                return;
            }

            // Color Mapping
            const techColors = {
                'Hydro Pasada': '#5DADE2',
                'Bioenergía': '#A9DFBF',
                'Geotérmica': '#E74C3C',
                'Hydro Embalse': '#3498DB',
                'Solar': '#F4D03F',
                'Eolica': '#388E3C',
                'Nuclear': '#1F618D',
                'Carbón': '#000000',
                'Gas CC': '#7B241C',
                'Gas CA': '#A93226',
                'Diesel': '#808080',
                'BESS Descarga': '#00BCD4',
                'Loss Load': '#2F4F4F',
                'Generic': '#999999'
            };

            // Prepare Table HTML
            let tableHtml = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <h3 style="margin: 0; color: ${OIRSE_THEME.textPrimary};">Detalle de Energía - ${countryName}</h3>
                    <span style="font-size: 0.9em; color: ${OIRSE_THEME.textSecondary};"> (Valores en TWh)</span>
                </div>
                <table style="width:100%; border-collapse: collapse; font-family: 'Inter', sans-serif; font-size: 13px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); background: ${OIRSE_THEME.bgSurface}; color: ${OIRSE_THEME.textPrimary};">
                    <thead>
                        <tr style="background-color: ${OIRSE_THEME.bgElevated}; text-align: left; color: ${OIRSE_THEME.textSecondary};">
                            <th style="padding: 10px; border-bottom: 1px solid ${OIRSE_THEME.border};">Tecnología / Ítem</th>
                            <th style="padding: 10px; border-bottom: 1px solid ${OIRSE_THEME.border}; text-align: right;">Energía (TWh)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Data Processing for Table and Chart
            const keys = Object.keys(summaryData);
            const totalKeys = keys.filter(k => k.includes('DEMANDA') || k.includes('GX'));
            const normalKeys = keys.filter(k => !k.includes('DEMANDA') && !k.includes('GX') && k !== 'Country');

            normalKeys.sort();
            totalKeys.sort((a, b) => {
                if (a.includes('GX') && b.includes('DEMANDA')) return -1;
                if (a.includes('DEMANDA') && b.includes('GX')) return 1;
                return 0;
            });

            const sortedKeys = [...normalKeys, ...totalKeys];
            const treemapData = []; // For Chart

            sortedKeys.forEach(key => {
                const val = summaryData[key];
                const techName = key.replace(' (TWh)', '').trim();

                // Formatting
                let valFormatted = val;
                if (typeof val === 'number') {
                    valFormatted = val.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                }

                const isTotal = totalKeys.includes(key);
                const rowStyle = isTotal
                    ? `font-weight: bold; background-color: #1f2538; border-top: 1px solid ${OIRSE_THEME.border};`
                    : `border-bottom: 1px solid ${OIRSE_THEME.border};`;

                if (key === 'Country') return;

                tableHtml += `
                    <tr style="${rowStyle}">
                        <td style="padding: 8px 10px;">${techName}</td>
                        <td style="padding: 8px 10px; text-align: right; font-family: 'Fira Code', monospace; font-size: 14px;">${valFormatted}</td>
                    </tr>
                `;

                // Collect Data for Treemap
                // Exclude: Totals, Country, Zero values, and specific items (Loss Load usually not in generation mix visualization unless requested)
                // User asked for "rectangular chart proportional to value". Usually refers to Generation Mix.
                if (!isTotal && techName !== 'BESS Carga' && val > 0.001) {
                    treemapData.push({
                        category: techName,
                        value: val
                    });
                }
            });

            tableHtml += `</tbody></table>`;

            // Inject Table
            const displayContainer = document.getElementById('energy-table-container');
            if (displayContainer) displayContainer.innerHTML = tableHtml;

            // Render Treemap Chart
            const ctx = document.getElementById('energy-treemap-canvas').getContext('2d');

            if (window.myEnergyChart) { window.myEnergyChart.destroy(); window.myEnergyChart = null; }

            window.myEnergyChart = new Chart(ctx, {
                type: 'treemap',
                data: {
                    datasets: [{
                        tree: treemapData,
                        key: 'value',
                        groups: ['category'],
                        backgroundColor: (ctx) => {
                            if (ctx.type !== 'data') return 'transparent';
                            const item = ctx.raw._data; // standard treemap data access
                            const cat = item.category || item.label;
                            return techColors[cat] || techColors['Generic'];
                        },
                        labels: {
                            display: true,
                            formatter: (ctx) => {
                                if (ctx.type !== 'data') return;
                                const item = ctx.raw._data;
                                return [item.category, item.value.toFixed(2) + ' TWh'];
                            },
                            color: 'white',
                            font: { size: 12, weight: 'bold' }
                        },
                        borderWidth: 1,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `Composición Energética - ${countryName} (Treemap)`,
                            font: { size: 14 }
                        },
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: (items) => items[0].raw._data.category,
                                label: (item) => {
                                    const v = item.raw._data.value;
                                    return v.toFixed(3) + ' TWh';
                                }
                            }
                        }
                    }
                }
            });

        })
        .catch(err => {
            console.error(err);
            alert("Error cargando resumen de energía.");
            modal.style.display = 'none';
        });
}

// Function to load and display marginal costs chart by Country
function showMarginalCostsChart(countryName) {
    if (!countryName) return;

    const modalId = 'mc-chart-modal';
    let modal = createModal(modalId, 2003); // z-index 2003

    modal.innerHTML = '';
    modal.style.width = '90%';
    modal.style.maxWidth = '1000px';
    modal.style.height = '600px';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        align-self: flex-end;
        padding: 5px 10px;
        margin-bottom: 10px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => {
        if (window.myMcChart) { window.myMcChart.destroy(); window.myMcChart = null; }
        modal.style.display = 'none';
    };

    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = "flex-grow: 1; position: relative;";

    const canvas = document.createElement('canvas');
    canvas.id = 'mc-chart-canvas';
    canvasContainer.appendChild(canvas);

    modal.appendChild(closeBtn);
    modal.appendChild(canvasContainer);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    fetch('/api/marginal-costs?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0'))
        .then(res => {
            if (!res.ok) throw new Error("No available marginal costs data");
            return res.json();
        })
        .then(data => {
            const countryData = data.countries[countryName];
            if (!countryData) {
                alert(`No hay datos de costos marginales para el país: ${countryName}`);
                modal.style.display = 'none';
                return;
            }

            const timeSteps = data.time_steps;
            const datasets = [];

            // Random colors for different nodes
            const getRandomColor = () => {
                const r = Math.floor(Math.random() * 200);
                const g = Math.floor(Math.random() * 200);
                const b = Math.floor(Math.random() * 200);
                return `rgb(${r}, ${g}, ${b})`;
            };

            for (const [nodeName, mcValues] of Object.entries(countryData)) {

                // Exclude arrays where all elements are null/NaN effectively
                const hasValidData = mcValues.some(val => val !== null && !isNaN(val));
                if (!hasValidData) continue;

                datasets.push({
                    label: `Nodo ${nodeName}`,
                    data: mcValues,
                    borderColor: getRandomColor(),
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                    spanGaps: true, // Connect lines across null values
                    tension: 0
                });
            }

            if (datasets.length === 0) {
                alert(`No hay nodos con costos marginales en el país: ${countryName}`);
                modal.style.display = 'none';
                return;
            }

            const ctx = document.getElementById('mc-chart-canvas').getContext('2d');

            if (window.myMcChart) { window.myMcChart.destroy(); window.myMcChart = null; }

            window.myMcChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: timeSteps,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: 'Hora' },
                            grid: { display: false }
                        },
                        y: {
                            title: { display: true, text: 'Costo Marginal [$]' }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: `Costo Marginal por barra - ${countryName}`
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        },
                        legend: {
                            position: 'right'
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });

        })
        .catch(err => {
            console.error(err);
            alert("Error cargando curva de costos marginales. Verifica si el modelo fue ejecutado.");
            modal.style.display = 'none';
        });
}

/* previous code ends before this function block */

// Function to load and display marginal costs chart for nodes of a transmission line
function showLineMarginalCostsChart(line) {
    if (!line || !line.start.node || !line.end.node) return;

    let modal = createModal('mc-chart-modal', 2003); // z-index 2003

    modal.innerHTML = '';
    modal.style.width = '90%';
    modal.style.maxWidth = '1000px';
    modal.style.height = '750px';
    modal.style.flexDirection = 'column';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        align-self: flex-end;
        padding: 5px 10px;
        margin-bottom: 10px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => {
        if (window.myMcChart) { window.myMcChart.destroy(); window.myMcChart = null; }
        modal.style.display = 'none';
    };

    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = 'flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; gap: 15px;';

    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = "flex-basis: 75%; flex-shrink: 0; position: relative;";

    const canvas = document.createElement('canvas');
    canvas.id = 'mc-chart-canvas';
    canvasContainer.appendChild(canvas);

    const tableContainer = document.createElement('div');
    tableContainer.id = 'mc-table-container';
    tableContainer.style.cssText = "flex-basis: 25%; overflow-y: auto; background: #fafafa; border: 1px solid #ddd; border-radius: 4px; padding: 10px;";

    contentWrapper.appendChild(canvasContainer);
    contentWrapper.appendChild(tableContainer);

    modal.appendChild(closeBtn);
    modal.appendChild(contentWrapper);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    Promise.all([
        fetch('/api/marginal-costs?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : Promise.reject("No available marginal costs data")),
        fetch('/api/flows?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : null).catch(() => null)
    ])
        .then(([data, flowData]) => {
            const timeSteps = data.time_steps;
            const datasets = [];

            const getRandomColor = () => {
                const r = Math.floor(Math.random() * 200);
                const g = Math.floor(Math.random() * 200);
                const b = Math.floor(Math.random() * 200);
                return `rgb(${r}, ${g}, ${b})`;
            };

            const nodesToFind = [
                { country: line.start.country, node: line.start.node },
                { country: line.end.country, node: line.end.node }
            ];

            let mcValues1 = [];
            let mcValues2 = [];

            nodesToFind.forEach((n, idx) => {
                if (data.countries[n.country] && data.countries[n.country][n.node]) {
                    const mcValues = data.countries[n.country][n.node];
                    if (idx === 0) mcValues1 = mcValues;
                    if (idx === 1) mcValues2 = mcValues;

                    const hasValidData = mcValues.some(val => val !== null && !isNaN(val));
                    if (hasValidData) {
                        datasets.push({
                            label: `Nodo ${n.node} (${n.country})`,
                            data: mcValues,
                            borderColor: getRandomColor(),
                            borderWidth: 2,
                            pointRadius: 0,
                            fill: false,
                            spanGaps: true,
                            tension: 0
                        });
                    }
                }
            });

            if (datasets.length === 0) {
                alert(`No hay datos de costos marginales para los nodos de la línea: ${line.start.node} / ${line.end.node}`);
                modal.style.display = 'none';
                return;
            }

            const ctx = document.getElementById('mc-chart-canvas').getContext('2d');

            if (window.myMcChart) { window.myMcChart.destroy(); window.myMcChart = null; }

            window.myMcChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: timeSteps,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: { display: true, text: 'Hora' },
                            grid: { display: false }
                        },
                        y: {
                            title: { display: true, text: 'Costo Marginal [$]' }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: `Costo Marginal - Nodos Interconectados Línea ${line.name}`
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        },
                        legend: {
                            position: 'right'
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });

            // Compute the Rent Table
            let rentValue = 0;
            if (flowData && flowData.flows && flowData.flows[line.name]) {
                const flows = flowData.flows[line.name];
                for (let i = 0; i < timeSteps.length; i++) {
                    const f = flows[i] || 0;
                    const c1 = mcValues1[i] || 0;
                    const c2 = mcValues2[i] || 0;
                    rentValue += Math.abs(f) * Math.abs(c1 - c2);
                }
                rentValue *= 100; // time division
            } else {
                rentValue = null;
            }

            const tContainer = document.getElementById('mc-table-container');
            tContainer.innerHTML = '';

            const table = document.createElement('table');
            table.style.cssText = "width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 0.9em;";
            table.innerHTML = `
                <thead>
                    <tr style="background-color: #f2f2f2; text-align: left;">
                        <th style="padding: 10px; border-bottom: 2px solid #ddd;">Línea de Transmisión</th>
                        <th style="padding: 10px; border-bottom: 2px solid #ddd; text-align: right;" title="Sumatoria en el tiempo de [ |Flujo(t)| * |CM_A(t) - CM_B(t)| ] * 100">Renta (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">${line.name}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">${rentValue !== null ? rentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Flujo no encontrado'}</td>
                    </tr>
                </tbody>
            `;
            tContainer.appendChild(table);

        })
        .catch(err => {
            console.error(err);
            alert("Error cargando curva de costos marginales o flujos.");
            modal.style.display = 'none';
        });
}

// Function to load and display generators summary
function showGeneratorsSummary(countryName) {
    if (!countryName) return;

    const modalId = 'gens-summary-modal';
    let modal = createModal(modalId, 2004); // high z-index

    modal.innerHTML = '';
    modal.style.width = '95%';
    modal.style.maxWidth = '1200px';
    modal.style.height = '80vh';
    modal.style.flexDirection = 'column';

    const headerContainer = document.createElement('div');
    headerContainer.style.display = 'flex';
    headerContainer.style.justifyContent = 'space-between';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.width = '100%';
    headerContainer.style.marginBottom = '15px';

    const title = document.createElement('h2');
    title.textContent = `Generadores - ${countryName}`;
    title.style.margin = '0';
    title.style.color = '#333';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        padding: 5px 15px;
        cursor: pointer;
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
    `;
    closeBtn.onclick = () => modal.style.display = 'none';

    headerContainer.appendChild(title);
    headerContainer.appendChild(closeBtn);
    modal.appendChild(headerContainer);

    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fafafa;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-family: sans-serif;
        font-size: 0.8em;
    `;

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr style="background-color: #f2f2f2; text-align: left;">
            <th title="Nombre de conexión del generador en el modelo." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Nombre del Nodo</th>
            <th title="Tipo de tecnología de generación del equipo." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Tecnología</th>
            <th title="Capacidad de diseño de la planta." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Potencia Máxima (MW)</th>
            <th title="Suma de nuevas inversiones en capacidad de diseño adicional." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Inversión (MW)</th>
            <th title="Suma de Costos de combustible, O&M y otros por nodo/tecnología." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Costo Variable (USD/MWh)</th>
            <th title="Suma total de la electricidad generada a lo largo del año." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Producción (MWh)</th>
            <th title="Suma anual del (Costo Marginal Horario x Producción Horaria) en dicho nodo." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Revenue (USD)</th>
            <th title="Costo Operativo Calculado = Producción Total MWh x Costo Variable USD/MWh." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Total Var Cost (USD)</th>
            <th title="Beneficio Operativo = Revenue - Total Var Cost." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Profit (USD)</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    modal.appendChild(tableContainer);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal', 'mc-chart-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    fetch('/api/generators?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0'))
        .then(res => {
            if (!res.ok) throw new Error("No data available");
            return res.json();
        })
        .then(data => {
            const gens = data[countryName] || [];

            if (gens.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" style="padding: 20px; text-align: center; color: #777;">No se encontraron generadores en ${countryName}</td></tr>`;
                return;
            }

            // Sort optionally by technology and name
            gens.sort((a, b) => a.tech.localeCompare(b.tech) || a.name.localeCompare(b.name));

            let sumCapmax = 0;
            let sumInv = 0;
            let sumProd = 0;
            let sumRev = 0;
            let sumVarCost = 0;
            let sumProfit = 0;

            gens.forEach((gen, index) => {
                sumCapmax += (gen.capmax || 0);
                sumInv += (gen.inv_pot_MW || 0);
                sumProd += (gen.prod || 0);
                sumRev += (gen.rev || 0);
                sumVarCost += (gen.total_var_cost || 0);
                sumProfit += (gen.profit || 0);

                const tr = document.createElement('tr');
                tr.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';

                tr.innerHTML = `
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">${gen.name}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">${gen.tech}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${gen.capmax.toFixed(2)}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${(gen.inv_pot_MW || 0).toFixed(2)}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${gen.cv.toFixed(2)}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${(gen.prod || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${(gen.rev || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${(gen.total_var_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${(gen.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                `;
                tbody.appendChild(tr);
            });

            const subtitle = document.createElement('h3');
            subtitle.textContent = 'Resumen';
            subtitle.style.marginTop = '20px';
            subtitle.style.marginBottom = '10px';
            subtitle.style.color = '#333';
            subtitle.style.flexShrink = '0';
            modal.appendChild(subtitle);

            const summaryTableContainer = document.createElement('div');
            summaryTableContainer.style.cssText = `
                flex-shrink: 0;
                margin-top: 5px;
                margin-bottom: 15px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fafafa;
                overflow-x: auto;
            `;

            const summaryTable = document.createElement('table');
            summaryTable.style.cssText = `
                width: 100%;
                border-collapse: collapse;
                font-family: sans-serif;
                font-size: 0.9em;
            `;

            summaryTable.innerHTML = `
                <thead>
                    <tr style="background-color: #dcedc8; text-align: left;">
                        <th title="País al cual pertenecen los indicadores mostrados." style="padding: 12px 10px; border-bottom: 2px solid #ddd; cursor: help;">País</th>
                        <th title="Suma de las potencias base de todos los generadores en ese país." style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right; cursor: help;">Capacidad Max Instalada (MW)</th>
                        <th title="Nuevas inversiones resultantes de la expansión." style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right; cursor: help;">Inversión (MW)</th>
                        <th title="Magnitud de MWh producidos al año en toda la jurisdicción." style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right; cursor: help;">Producción Total (MWh)</th>
                        <th title="Suma de los ingresos (Revenue) en USD de todos los nodos en este pais." style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right; cursor: help;">Total Revenue (USD)</th>
                        <th title="Suma de los costos operativos de todos sus equipos." style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right; cursor: help;">Total Var Cost (USD)</th>
                        <th title="Ganancia acumulada del conjunto de equipos dentro del territorio." style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right; cursor: help;">Total Profit (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px 10px; font-weight: bold; border-bottom: 1px solid #ddd;">${countryName}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumCapmax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumInv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumProd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumVarCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            `;
            summaryTableContainer.appendChild(summaryTable);
            modal.appendChild(summaryTableContainer);

        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="8" style="padding: 20px; text-align: center; color: red;">Error cargando datos. Verifica si el modelo extrajo los generadores.</td></tr>`;
        });
}

function showStorageSummary(countryName) {
    if (!countryName) return;

    const modalId = 'storage-summary-modal';
    let modal = createModal(modalId, 2004); // high z-index

    modal.innerHTML = '';
    modal.style.width = '60%';
    modal.style.maxWidth = '600px';
    modal.style.height = '60vh';
    modal.style.flexDirection = 'column';

    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
        margin-bottom: 20px;
    `;

    const title = document.createElement('h2');
    title.textContent = `Resumen de Almacenamiento (BESS) - ${countryName}`;
    title.style.margin = '0';
    title.style.color = '#333';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '❌';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 1.2em;
        cursor: pointer;
        padding: 5px;
    `;
    closeBtn.onclick = () => {
        modal.style.display = 'none';
        modal.innerHTML = '';
    };
    header.appendChild(closeBtn);

    modal.appendChild(header);

    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fafafa;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-family: sans-serif;
        font-size: 0.9em;
    `;

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr style="background-color: #f2f2f2; text-align: left;">
            <th title="Nombre del nodo de almacenamiento" style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Nombre del Nodo</th>
            <th title="Capacidad de diseño existente en la ubicación." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Capacidad Existente (MW)</th>
            <th title="Nuevas inversiones o expansión de capacidad en el nodo." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Nuevas Inversiones (MW)</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    modal.appendChild(tableContainer);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal', 'mc-chart-modal', 'demand-summary-modal', 'trans-summary-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m && m.id !== modalId) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    fetch('/api/storage?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0'))
        .then(res => {
            if (!res.ok) throw new Error("No data available");
            return res.json();
        })
        .then(data => {
            const storages = data[countryName] || [];

            if (storages.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: #777;">No se encontró almacenamiento en ${countryName}</td></tr>`;
                return;
            }

            let sumCapmax = 0;
            let sumInv = 0;

            storages.forEach((st, index) => {
                sumCapmax += (st.capmax || 0);
                sumInv += (st.inv_pot_MW || 0);

                const tr = document.createElement('tr');
                tr.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';

                tr.innerHTML = `
                    <td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${st.name}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: right;">${(st.capmax || 0).toFixed(2)}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: right;">${(st.inv_pot_MW || 0).toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });

            const summaryTableContainer = document.createElement('div');
            summaryTableContainer.style.cssText = `
                flex-shrink: 0;
                margin-top: 15px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fafafa;
                overflow-x: auto;
            `;

            const summaryTable = document.createElement('table');
            summaryTable.style.cssText = `
                width: 100%;
                border-collapse: collapse;
                font-family: sans-serif;
                font-size: 0.9em;
            `;

            summaryTable.innerHTML = `
                <thead>
                    <tr style="background-color: #dcedc8; text-align: left;">
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd;">Total Nacional</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Capacidad Existente (MW)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Nuevas Inversiones (MW)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px 10px; font-weight: bold; border-bottom: 1px solid #ddd;">${countryName}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumCapmax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumInv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            `;
            summaryTableContainer.appendChild(summaryTable);
            modal.appendChild(summaryTableContainer);

        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: red;">Error cargando datos. Verifica si el modelo extrajo el almacenamiento.</td></tr>`;
        });
}

function showDemandSummary(countryName) {
    if (!countryName) return;

    const modalId = 'demand-summary-modal';
    let modal = createModal(modalId, 2005); // high z-index

    modal.innerHTML = '';
    modal.style.width = '60%';
    modal.style.maxWidth = '600px';
    modal.style.height = '60vh';
    modal.style.flexDirection = 'column';

    const headerContainer = document.createElement('div');
    headerContainer.style.display = 'flex';
    headerContainer.style.justifyContent = 'space-between';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.width = '100%';
    headerContainer.style.marginBottom = '15px';

    const title = document.createElement('h2');
    title.textContent = `Resumen de la demanda - ${countryName}`;
    title.style.margin = '0';
    title.style.color = '#333';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        padding: 5px 15px;
        cursor: pointer;
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
    `;
    closeBtn.onclick = () => modal.style.display = 'none';

    headerContainer.appendChild(title);
    headerContainer.appendChild(closeBtn);
    modal.appendChild(headerContainer);

    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fafafa;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-family: sans-serif;
        font-size: 0.9em;
    `;

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr style="background-color: #f2f2f2; text-align: left;">
            <th title="Nombre del nodo dentro del modelo" style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Nombre del Nodo</th>
            <th title="Suma total de demanda en la serie de tiempo para este nodo" style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right; cursor: help;">Demanda en MWh</th>
            <th title="Suma (Demanda * Costo Marginal * 100) en el espacio temporal." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right; cursor: help;">Demand Cost (USD)</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    modal.appendChild(tableContainer);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal', 'mc-chart-modal', 'gens-summary-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    fetch('/api/demand?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0'))
        .then(res => {
            if (!res.ok) throw new Error("No data available");
            return res.json();
        })
        .then(data => {
            const nodes = data[countryName] || [];

            if (nodes.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: #777;">No se encontró demanda para ${countryName}</td></tr>`;
                return;
            }

            nodes.sort((a, b) => a.node.localeCompare(b.node));

            let sumDemand = 0;
            let sumDemandCost = 0;

            nodes.forEach((item, index) => {
                sumDemand += (item.demand || 0);
                sumDemandCost += (item.demand_cost || 0);

                const tr = document.createElement('tr');
                tr.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';

                tr.innerHTML = `
                    <td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${item.node}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: right;">${(item.demand || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: right;">${(item.demand_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                `;
                tbody.appendChild(tr);
            });

            // Summary Table
            const summaryTableContainer = document.createElement('div');
            summaryTableContainer.style.cssText = `
                flex-shrink: 0;
                margin-top: 15px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fafafa;
                overflow-x: auto;
            `;

            const summaryTable = document.createElement('table');
            summaryTable.style.cssText = `
                width: 100%;
                border-collapse: collapse;
                font-family: sans-serif;
                font-size: 0.9em;
            `;

            summaryTable.innerHTML = `
                <thead>
                    <tr style="background-color: #dcedc8; text-align: left;">
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd;">País</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Demanda País MWh</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Demand Cost (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px 10px; font-weight: bold; border-bottom: 1px solid #ddd;">${countryName}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumDemand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumDemandCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            `;
            summaryTableContainer.appendChild(summaryTable);
            modal.appendChild(summaryTableContainer);

        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="3" style="padding: 20px; text-align: center; color: red;">Error cargando datos de demanda. Verifica si el backend la leyó.</td></tr>`;
        });
}

function showTransmissionSummary(countryCode) {
    if (!countryCode) return;

    const modalId = 'trans-summary-modal';
    let modal = createModal(modalId, 2006); // high z-index

    modal.innerHTML = '';
    modal.style.width = '70%';
    modal.style.maxWidth = '800px';
    modal.style.height = '65vh';
    modal.style.flexDirection = 'column';

    const headerContainer = document.createElement('div');
    headerContainer.style.display = 'flex';
    headerContainer.style.justifyContent = 'space-between';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.width = '100%';
    headerContainer.style.marginBottom = '15px';

    const title = document.createElement('h2');
    title.textContent = `Resumen de Transmisión - Líneas Nacionales (${countryCode})`;
    title.style.margin = '0';
    title.style.color = '#333';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        padding: 5px 15px;
        cursor: pointer;
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
    `;
    closeBtn.onclick = () => modal.style.display = 'none';

    headerContainer.appendChild(title);
    headerContainer.appendChild(closeBtn);
    modal.appendChild(headerContainer);

    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fafafa;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-family: sans-serif;
        font-size: 0.9em;
    `;

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr style="background-color: #f2f2f2; text-align: left;">
            <th title="Nombre de la línea de transmisión interna." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Línea de Transmisión Nacional</th>
            <th title="Suma anual del (Valor Absoluto Flujo x Valor Absoluto Diferencia de Costos Marginales) x 100." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right; cursor: help;">Renta por Congestión (USD)</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    modal.appendChild(tableContainer);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal', 'mc-chart-modal', 'gens-summary-modal', 'demand-summary-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    Promise.all([
        fetch('/api/lines?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : []),
        fetch('/api/marginal-costs?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : null).catch(() => null),
        fetch('/api/flows?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : null).catch(() => null)
    ])
        .then(([lines, mcData, flowData]) => {
            let nationalLines = lines.filter(l => l.start && l.end && l.start.country === countryCode && l.end.country === countryCode);

            if (nationalLines.length === 0) {
                tbody.innerHTML = `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #777;">No se encontraron líneas de transmisión nacionales para ${countryCode}</td></tr>`;
                return;
            }

            let totalRent = 0;
            let validLinesCount = 0;
            const timeStepsArray = mcData && mcData.time_steps ? mcData.time_steps : [];

            nationalLines.forEach((line, index) => {
                let rentValue = 0;
                let foundData = false;

                if (mcData && flowData && flowData.flows && flowData.flows[line.name]) {
                    const flows = flowData.flows[line.name];

                    let mcValues1 = [];
                    let mcValues2 = [];

                    if (mcData.countries[line.start.country]) mcValues1 = mcData.countries[line.start.country][line.start.node] || [];
                    if (mcData.countries[line.end.country]) mcValues2 = mcData.countries[line.end.country][line.end.node] || [];

                    if (mcValues1.length > 0 && mcValues2.length > 0 && flows.length > 0) {
                        foundData = true;
                        for (let i = 0; i < timeStepsArray.length; i++) {
                            const f = flows[i] || 0;
                            const c1 = mcValues1[i] || 0;
                            const c2 = mcValues2[i] || 0;
                            rentValue += Math.abs(f) * Math.abs(c1 - c2);
                        }
                        rentValue *= 100;
                        totalRent += rentValue;
                    }
                }

                const tr = document.createElement('tr');
                tr.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';

                let rentText = foundData ? rentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Datos inconsistentes';

                tr.innerHTML = `
                <td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${line.name}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: right;">${rentText}</td>
            `;
                tbody.appendChild(tr);
                if (foundData) validLinesCount++;
            });

            if (validLinesCount === 0 && nationalLines.length > 0) {
                tbody.innerHTML = `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #d32f2f;">Se hallaron líneas nacionales, pero existen problemas cargando sus flujos o costos marginales.</td></tr>`;
            }

            const summaryTableContainer = document.createElement('div');
            summaryTableContainer.style.cssText = `
            flex-shrink: 0;
            margin-top: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fafafa;
            overflow-x: auto;
        `;

            const summaryTable = document.createElement('table');
            summaryTable.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-family: sans-serif;
            font-size: 0.9em;
        `;

            summaryTable.innerHTML = `
            <thead>
                <tr style="background-color: #dcedc8; text-align: left;">
                    <th style="padding: 12px 10px; border-bottom: 2px solid #ddd;">País</th>
                    <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Renta de Congestión Nacional (USD)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 12px 10px; font-weight: bold; border-bottom: 1px solid #ddd;">${countryCode}</td>
                    <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${totalRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        `;
            summaryTableContainer.appendChild(summaryTable);
            modal.appendChild(summaryTableContainer);

            // --- INTERNATIONAL LINES SECTION --- //
            const titleInt = document.createElement('h3');
            titleInt.textContent = `Líneas Internacionales (${countryCode})`;
            titleInt.style.margin = '20px 0 10px 0';
            titleInt.style.color = '#333';
            modal.appendChild(titleInt);

            const intTableContainer = document.createElement('div');
            intTableContainer.style.cssText = `
            flex-grow: 1;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #fafafa;
        `;

            const intTable = document.createElement('table');
            intTable.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-family: sans-serif;
            font-size: 0.9em;
        `;

            const intThead = document.createElement('thead');
            intThead.innerHTML = `
            <tr style="background-color: #f2f2f2; text-align: left;">
                <th title="Nombre de la línea de transmisión internacional conectando a este país." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; cursor: help;">Línea de Transmisión Int.</th>
                <th title="Suma anual del (Valor Absoluto Flujo x Valor Absoluto Diferencia de Costos Marginales) x 100." style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right; cursor: help;">Renta por Congestión (USD)</th>
            </tr>
        `;
            intTable.appendChild(intThead);

            const intTbody = document.createElement('tbody');
            intTable.appendChild(intTbody);
            intTableContainer.appendChild(intTable);
            modal.appendChild(intTableContainer);

            let internationalLines = lines.filter(l => l.start && l.end &&
                ((l.start.country === countryCode && l.end.country !== countryCode) ||
                    (l.end.country === countryCode && l.start.country !== countryCode)));

            if (internationalLines.length === 0) {
                intTbody.innerHTML = `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #777;">No se encontraron interconexiones internacionales para ${countryCode}</td></tr>`;
            } else {
                let totalIntRent = 0;
                let validIntLinesCount = 0;

                internationalLines.forEach((line, index) => {
                    let rentValue = 0;
                    let foundData = false;

                    if (mcData && flowData && flowData.flows && flowData.flows[line.name]) {
                        const flows = flowData.flows[line.name];

                        let mcValues1 = [];
                        let mcValues2 = [];

                        if (mcData.countries[line.start.country]) mcValues1 = mcData.countries[line.start.country][line.start.node] || [];
                        if (mcData.countries[line.end.country]) mcValues2 = mcData.countries[line.end.country][line.end.node] || [];

                        if (mcValues1.length > 0 && mcValues2.length > 0 && flows.length > 0) {
                            foundData = true;
                            for (let i = 0; i < timeStepsArray.length; i++) {
                                const f = flows[i] || 0;
                                const c1 = mcValues1[i] || 0;
                                const c2 = mcValues2[i] || 0;
                                rentValue += Math.abs(f) * Math.abs(c1 - c2);
                            }
                            rentValue *= 100;
                            totalIntRent += rentValue;
                        }
                    }

                    const tr = document.createElement('tr');
                    tr.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';

                    let rentText = foundData ? rentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Datos inconsistentes';

                    tr.innerHTML = `
                    <td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${line.name}</td>
                    <td style="padding: 8px 10px; border-bottom: 1px solid #ddd; text-align: right;">${rentText}</td>
                `;
                    intTbody.appendChild(tr);
                    if (foundData) validIntLinesCount++;
                });

                if (validIntLinesCount === 0 && internationalLines.length > 0) {
                    intTbody.innerHTML = `<tr><td colspan="2" style="padding: 20px; text-align: center; color: #d32f2f;">Se hallaron líneas internacionales, pero existen problemas cargando sus flujos o costos marginales.</td></tr>`;
                }

                // International Summary Table
                const intSummaryTableContainer = document.createElement('div');
                intSummaryTableContainer.style.cssText = `
                flex-shrink: 0;
                margin-top: 15px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #fafafa;
                overflow-x: auto;
            `;

                const intSummaryTable = document.createElement('table');
                intSummaryTable.style.cssText = `
                width: 100%;
                border-collapse: collapse;
                font-family: sans-serif;
                font-size: 0.9em;
            `;

                intSummaryTable.innerHTML = `
                <thead>
                    <tr style="background-color: #ffe0b2; text-align: left;">
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd;">País</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Renta de Congestión Internacional (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px 10px; font-weight: bold; border-bottom: 1px solid #ddd;">${countryCode}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${totalIntRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            `;
                intSummaryTableContainer.appendChild(intSummaryTable);
                modal.appendChild(intSummaryTableContainer);
            }

        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="2" style="padding: 20px; text-align: center; color: red;">Error cargando datos de transmisión.</td></tr>`;
        });
}

function showCountrySummary(countryCode) {
    if (!countryCode) return;

    const modalId = 'country-summary-modal';
    let modal = createModal(modalId, 2007);

    modal.innerHTML = '';
    modal.style.width = '70%';
    modal.style.maxWidth = '900px';
    modal.style.height = 'auto';
    modal.style.maxHeight = '90vh';
    modal.style.flexDirection = 'column';

    const headerContainer = document.createElement('div');
    headerContainer.style.display = 'flex';
    headerContainer.style.justifyContent = 'space-between';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.width = '100%';
    headerContainer.style.marginBottom = '15px';

    const title = document.createElement('h2');
    title.textContent = `Resumen General del País (${countryCode})`;
    title.style.margin = '0';
    title.style.color = OIRSE_THEME.textPrimary;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        padding: 6px 14px;
        cursor: pointer;
        background-color: ${OIRSE_THEME.bgElevated};
        color: ${OIRSE_THEME.textPrimary};
        border: 1px solid ${OIRSE_THEME.border};
        border-radius: 6px;
    `;
    closeBtn.onclick = () => modal.style.display = 'none';

    headerContainer.appendChild(title);
    headerContainer.appendChild(closeBtn);
    modal.appendChild(headerContainer);

    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
    `;
    modal.appendChild(contentContainer);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal', 'mc-chart-modal', 'gens-summary-modal', 'demand-summary-modal', 'trans-summary-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    Promise.all([
        fetch('/api/generators?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : {}),
        fetch('/api/demand?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : {}),
        fetch('/api/lines?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : []),
        fetch('/api/marginal-costs?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : null).catch(() => null),
        fetch('/api/flows?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0')).then(res => res.ok ? res.json() : null).catch(() => null)
    ])
        .then(([genData, demData, lines, mcData, flowData]) => {

            // 1. Resumen de Generación
            const gens = genData[countryCode] || [];
            let sumCapmax = 0, sumInv = 0, sumProd = 0, sumRev = 0, sumVarCost = 0, sumProfit = 0;
            gens.forEach(gen => {
                sumCapmax += (gen.capmax || 0);
                sumInv += (gen.inv_pot_MW || 0);
                sumProd += (gen.prod || 0);
                sumRev += (gen.rev || 0);
                sumVarCost += (gen.total_var_cost || 0);
                sumProfit += (gen.profit || 0);
            });

            const genTableContainer = document.createElement('div');
            genTableContainer.style.cssText = "border: 1px solid #ddd; border-radius: 4px; background: #fafafa; overflow-x: auto;";
            genTableContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 0.9em;">
                <thead>
                    <tr style="background-color: #dcedc8; text-align: left;">
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd;">País (Generación)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Capacidad Max Instalada (MW)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Inversión (MW)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Producción Total (MWh)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Revenue (USD)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Var Cost (USD)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Profit (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px 10px; font-weight: bold; border-bottom: 1px solid #ddd;">${countryCode}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumCapmax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumInv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumProd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumVarCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            </table>
        `;
            contentContainer.appendChild(genTableContainer);

            // 2. Resumen de Demanda
            const nodes = demData[countryCode] || [];
            let sumDemand = 0, sumDemandCost = 0;
            nodes.forEach(item => {
                sumDemand += (item.demand || 0);
                sumDemandCost += (item.demand_cost || 0);
            });

            const demTableContainer = document.createElement('div');
            demTableContainer.style.cssText = "border: 1px solid #ddd; border-radius: 4px; background: #fafafa; overflow-x: auto;";
            demTableContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 0.9em;">
                <thead>
                    <tr style="background-color: #e1bee7; text-align: left;">
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd;">País (Demanda)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Demanda País MWh</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Demand Cost (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px 10px; font-weight: bold; border-bottom: 1px solid #ddd;">${countryCode}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumDemand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${sumDemandCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            </table>
        `;
            contentContainer.appendChild(demTableContainer);

            // 3. Renta por Congestión Internacional
            let internationalLines = lines.filter(l => l.start && l.end &&
                ((l.start.country === countryCode && l.end.country !== countryCode) ||
                    (l.end.country === countryCode && l.start.country !== countryCode)));

            let totalIntRent = 0;
            const timeStepsArray = mcData && mcData.time_steps ? mcData.time_steps : [];

            internationalLines.forEach(line => {
                if (mcData && flowData && flowData.flows && flowData.flows[line.name]) {
                    const flows = flowData.flows[line.name];
                    let mcValues1 = [];
                    let mcValues2 = [];

                    if (mcData.countries[line.start.country]) mcValues1 = mcData.countries[line.start.country][line.start.node] || [];
                    if (mcData.countries[line.end.country]) mcValues2 = mcData.countries[line.end.country][line.end.node] || [];

                    if (mcValues1.length > 0 && mcValues2.length > 0 && flows.length > 0) {
                        let rentValue = 0;
                        for (let i = 0; i < timeStepsArray.length; i++) {
                            const f = flows[i] || 0;
                            const c1 = mcValues1[i] || 0;
                            const c2 = mcValues2[i] || 0;
                            rentValue += Math.abs(f) * Math.abs(c1 - c2);
                        }
                        totalIntRent += (rentValue * 100);
                    }
                }
            });

            const intTableContainer = document.createElement('div');
            intTableContainer.style.cssText = "border: 1px solid #ddd; border-radius: 4px; background: #fafafa; overflow-x: auto;";
            intTableContainer.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 0.9em;">
                <thead>
                    <tr style="background-color: #ffe0b2; text-align: left;">
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd;">País (Transmisión Ext.)</th>
                        <th style="padding: 12px 10px; border-bottom: 2px solid #ddd; text-align: right;">Total Renta de Congestión Internacional (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 12px 10px; font-weight: bold; border-bottom: 1px solid #ddd;">${countryCode}</td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: bold; border-bottom: 1px solid #ddd;">${totalIntRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                </tbody>
            </table>
        `;
            contentContainer.appendChild(intTableContainer);

            const kpiStrip = document.createElement('div');
            kpiStrip.style.cssText = 'display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;';
            kpiStrip.innerHTML = `
                <div class="kpi-card kpi-card--cyan"><div class="kpi-label">Capacidad Total</div><div class="kpi-value">${sumCapmax.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</div><div class="kpi-label">MW</div></div>
                <div class="kpi-card kpi-card--green"><div class="kpi-label">Profit Generación</div><div class="kpi-value">$${sumProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div class="kpi-label">USD</div></div>
                <div class="kpi-card kpi-card--amber"><div class="kpi-label">Costo Demanda</div><div class="kpi-value">$${sumDemandCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div class="kpi-label">USD</div></div>
                <div class="kpi-card kpi-card--purple"><div class="kpi-label">Renta Congestión Int.</div><div class="kpi-value">$${totalIntRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div class="kpi-label">USD</div></div>
            `;
            contentContainer.prepend(kpiStrip);

        })
        .catch(err => {
            console.error(err);
            contentContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">Error cargando el resumen general.</div>`;
        });
}

function showTxInvestmentSummary() {
    const modalId = 'tx-summary-modal';
    let modal = createModal(modalId, 2010);

    modal.innerHTML = '';
    modal.style.width = '90%';
    modal.style.maxWidth = '1200px';
    modal.style.height = '80vh';
    modal.style.flexDirection = 'column';

    const headerContainer = document.createElement('div');
    headerContainer.style.display = 'flex';
    headerContainer.style.justifyContent = 'space-between';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.width = '100%';
    headerContainer.style.marginBottom = '15px';

    const title = document.createElement('h2');
    title.textContent = `Inversiones en Transmisión`;
    title.style.margin = '0';
    title.style.color = '#333';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Cerrar';
    closeBtn.style.cssText = `
        padding: 5px 15px;
        cursor: pointer;
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
    `;
    closeBtn.onclick = () => modal.style.display = 'none';

    headerContainer.appendChild(title);
    headerContainer.appendChild(closeBtn);
    modal.appendChild(headerContainer);

    const tableContainer = document.createElement('div');
    tableContainer.style.cssText = `
        flex-grow: 1;
        overflow-y: auto;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fafafa;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        font-family: sans-serif;
        font-size: 0.8em;
    `;

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr style="background-color: #f2f2f2; text-align: left;">
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee;">Nombre línea</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee;">Desde</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee;">Hacia</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee;">From</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee;">To</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right;">Fmax</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right;">Fmax_inv</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right;">inv_MW</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right;">Decision</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right;">Costo_unitario</th>
            <th style="padding: 10px; border-bottom: 2px solid #ddd; position: sticky; top: 0; background: #eee; text-align: right;">Costo_total_USD</th>
        </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    modal.appendChild(tableContainer);

    modal.style.display = 'flex';

    fetch('/api/tx-investment?scenario=' + (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S0'))
        .then(res => {
            if (!res.ok) throw new Error("No data available");
            return res.json();
        })
        .then(data => {
            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="11" style="padding: 20px; text-align: center; color: #777;">No se encontraron líneas</td></tr>`;
                return;
            }

            data.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.style.backgroundColor = index % 2 === 0 ? '#fff' : '#f9f9f9';
                tr.innerHTML = `
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">${item['Nombre línea']}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">${item['Desde']}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">${item['Hacia']}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">${item['From']}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd;">${item['To']}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${item['Fmax'] !== undefined ? item['Fmax'] : '-'}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${item['Fmax_inv'] !== undefined ? item['Fmax_inv'] : '-'}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${item['inv_MW'] !== undefined ? item['inv_MW'] : '-'}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${item['Decision'] !== undefined ? item['Decision'] : '-'}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${item['Costo_unitario'] !== undefined ? Number(item['Costo_unitario']).toLocaleString() : '-'}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: right;">${item['Costo_total_USD'] !== undefined ? Number(item['Costo_total_USD']).toLocaleString() : '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="11" style="padding: 20px; text-align: center; color: red;">Error cargando datos de inversión en transmisión. Asegúrese de haber ejecutado el modelo.</td></tr>`;
        });
}


// Helper functions for Tooltips and Formatting
const formatCur = (val) => val != null && !isNaN(val) ? '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const formatNum = (val) => val != null && !isNaN(val) ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

const createTooltipHTML = (label, description = '', formula = '', align = 'left') => {
    let positionStyle = 'left: 0;';
    if (align === 'right') { positionStyle = 'right: 0; left: auto;'; }
    else if (align === 'center') { positionStyle = 'left: 50%; transform: translateX(-50%);'; }

    return `
        <div class="tooltip-container" style="position: relative; display: inline-flex; align-items: center; gap: 4px; cursor: default; flex-wrap: wrap;">
            <span>${label}</span>
            ${(description || formula) ? `
                <div style="cursor: help; color: #9ca3af; transition: color 0.2s;" onmouseover="this.style.color='#3b82f6'" onmouseout="this.style.color='#9ca3af'">
                    <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div class="tooltip-content" style="position: absolute; bottom: 100%; margin-bottom: 4px; display: none; width: 250px; padding: 12px; background: #1f2937; color: white; font-size: 12px; border-radius: 8px; font-weight: normal; text-transform: none; z-index: 100; white-space: normal; text-align: left; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); ${positionStyle}">
                    ${description ? `<div style="color: #e5e7eb; line-height: 1.5;">${description}</div>` : ''}
                    ${formula ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #4b5563;">
                            <span style="display: block; color: #9ca3af; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; font-weight: 600;">Fórmula:</span>
                            <code style="display: block; background: #111827; padding: 8px; border-radius: 4px; color: #93c5fd; font-size: 11px; word-break: break-all; font-family: monospace; border: 1px solid #374151;">${formula}</code>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `;
};

async function showMethodologyResults(lineName) {
    if (!lineName) return;

    const modalId = 'methodology-results-modal';
    let modal = createModal(modalId, 2100);

    modal.innerHTML = '';
    const isMobile = window.innerWidth <= 560;
    modal.style.width = isMobile ? '100%' : '95%';
    modal.style.maxWidth = isMobile ? '100%' : '1300px';
    modal.style.height = isMobile ? '100vh' : '90vh';
    modal.style.overflowY = 'auto';
    modal.style.padding = '0';
    modal.style.borderRadius = isMobile ? '0' : '8px';
    modal.style.backgroundColor = OIRSE_THEME.bgPrimary;

    // Helper Styles for Tooltip Hover (since React uses group-hover)
    const styleBlock = document.createElement('style');
    styleBlock.innerHTML = `
        .tooltip-container:hover .tooltip-content { display: block !important; }
        .res-card { background: ${OIRSE_THEME.bgSurface}; border-radius: 12px; box-shadow: ${OIRSE_THEME.shadow}; margin-bottom: 24px; border: 1px solid ${OIRSE_THEME.border}; }
        .res-card-header { padding: 16px 20px; font-weight: 700; font-size: 1.06rem; border-bottom: 1px solid ${OIRSE_THEME.border}; display: flex; align-items: center; gap: 8px; background-color: ${OIRSE_THEME.bgElevated}; color: ${OIRSE_THEME.textPrimary}; border-top-left-radius: 12px; border-top-right-radius: 12px; }
        .res-card-body { padding: 20px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .res-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; color: ${OIRSE_THEME.textPrimary}; }
        .res-table th { background-color: ${OIRSE_THEME.bgElevated}; padding: 12px 16px; color: ${OIRSE_THEME.textSecondary}; font-weight: 700; border-bottom: 1px solid ${OIRSE_THEME.border}; white-space: nowrap; }
        .res-table td { padding: 12px 16px; border-bottom: 1px solid ${OIRSE_THEME.border}; color: ${OIRSE_THEME.textPrimary}; font-family: "Fira Code", "SF Mono", "Cascadia Code", monospace; font-variant-numeric: tabular-nums; }
        .res-table tr:hover { background-color: #2a2f42 !important; }
        .stat-box { padding: 14px 16px; border-radius: 10px; flex: 1; min-width: 200px; border-left: 3px solid ${OIRSE_THEME.cyan}; backdrop-filter: blur(12px); transition: all 0.2s ease; }
        .stat-box:hover { transform: translateY(-1px); box-shadow: 0 0 16px rgba(99,102,241,0.16); }
        .stat-box > div:first-child { letter-spacing: 0.06em; text-transform: uppercase; font-size: 0.72rem; font-weight: 700; opacity: 0.78; }
        .stat-box > div:last-child { font-family: "Fira Code", "SF Mono", "Cascadia Code", monospace; font-size: 1.45rem; font-weight: 800; margin-top: 6px; }
        .form-input { width: 100%; padding: 8px 10px; border: 1px solid ${OIRSE_THEME.border}; border-radius: 6px; font-size: 0.9rem; appearance: none; background: ${OIRSE_THEME.bgElevated}; color: ${OIRSE_THEME.textPrimary}; }
        .form-input:focus { outline: none; border-color: ${OIRSE_THEME.accent}; box-shadow: 0 0 0 1px ${OIRSE_THEME.accent}; }
        .form-label { display: block; font-size: 0.78rem; font-weight: 700; color: ${OIRSE_THEME.textSecondary}; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em; }
        .tab-btn { padding: 12px 24px; font-weight: 700; font-size: 0.95rem; border-bottom: 3px solid transparent; cursor: pointer; color: ${OIRSE_THEME.textMuted}; background: none; border-top: none; border-left: none; border-right: none; transition: all 0.2s; }
        .tab-btn:hover { color: ${OIRSE_THEME.textPrimary}; }
        .tab-btn.active { color: ${OIRSE_THEME.accentHover}; border-bottom-color: ${OIRSE_THEME.accent}; }
        .res-card-header[style*="#f3f4f6"],
        .res-card-header[style*="#eff6ff"],
        .res-card-header[style*="#f5f3ff"],
        .res-card-header[style*="#f9fafb"] { background: ${OIRSE_THEME.bgElevated} !important; color: ${OIRSE_THEME.textPrimary} !important; }
        .res-card-body[style*="#f9fafb"] { background: ${OIRSE_THEME.bgSurface} !important; }
        tr[style*="#dcedc8"],
        tr[style*="#e1bee7"],
        tr[style*="#ffe0b2"] { background: #202437 !important; color: ${OIRSE_THEME.textPrimary} !important; }
        .res-note-card {
            padding: 12px;
            border-radius: 6px;
            background: linear-gradient(160deg, #22273a 0%, #1b2032 100%);
            border: 1px solid #39405a;
            color: ${OIRSE_THEME.textSecondary};
            line-height: 1.45;
        }
        .res-note-card strong {
            color: ${OIRSE_THEME.textPrimary};
        }

        /* Mobile responsive */
        @media (max-width: 560px) {
            .res-card { border-radius: 8px; margin-bottom: 14px; }
            .res-card-header { padding: 10px 12px; font-size: 0.82rem; gap: 6px; border-radius: 8px 8px 0 0; }
            .res-card-body { padding: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
            .res-table { font-size: 0.7rem; min-width: 420px; }
            .res-table th { padding: 6px 7px; font-size: 0.62rem; white-space: nowrap; }
            .res-table td { padding: 6px 7px; font-size: 0.68rem; white-space: nowrap; }
            .stat-box { padding: 8px 10px; min-width: 110px; }
            .stat-box > div:first-child { font-size: 0.55rem; }
            .stat-box > div:last-child { font-size: 0.9rem; }
            .tab-btn { padding: 8px 12px; font-size: 0.75rem; }
            .form-input { padding: 6px 8px; font-size: 0.8rem; }
            .form-label { font-size: 0.65rem; margin-bottom: 4px; }
            .res-note-card { padding: 10px; font-size: 0.82rem; }
        }
    `;
    modal.appendChild(styleBlock);

    // Header Structure
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: ${isMobile ? '10px 12px' : '15px 20px'}; background-color: ${OIRSE_THEME.bgElevated}; border-bottom: 1px solid ${OIRSE_THEME.border}; position: sticky; top: 0; z-index: 10; box-shadow: 0 8px 18px rgba(0,0,0,0.35);`;
    const title = document.createElement('h2');
    title.textContent = isMobile ? lineName : `Resultados de Metodologías - Línea: ${lineName}`;
    title.style.cssText = `margin: 0; font-size: ${isMobile ? '1rem' : '1.4rem'}; color: ${OIRSE_THEME.textPrimary}; font-weight: 700;`;
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `background: ${OIRSE_THEME.bgSurface}; border: 1px solid ${OIRSE_THEME.border}; font-size: ${isMobile ? '1.4rem' : '1.8rem'}; cursor: pointer; color: ${OIRSE_THEME.textSecondary}; line-height: 1; padding: 0 8px; border-radius: 6px;`;
    closeBtn.onclick = () => modal.style.display = 'none';
    headerContainer.appendChild(title);
    headerContainer.appendChild(closeBtn);
    modal.appendChild(headerContainer);

    // Tabs Nav
    const tabsContainer = document.createElement('div');
    tabsContainer.style.cssText = `display: flex; flex-wrap: wrap; background: ${OIRSE_THEME.bgSurface}; border-bottom: 1px solid ${OIRSE_THEME.border}; padding: 0 ${isMobile ? '8px' : '20px'}; gap: ${isMobile ? '0' : '0'};`;
    modal.appendChild(tabsContainer);

    // Content Area
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = `padding: ${isMobile ? '12px 10px' : '20px'};`;
    contentContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: ${OIRSE_THEME.textSecondary};">Cargando y procesando datos (S0 y S1)... <br> <span style="font-size: 2rem;">⏳</span></div>`;
    modal.appendChild(contentContainer);

    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal', 'mc-chart-modal', 'tx-investment-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });
    modal.style.display = 'flex';

    // Global Dataset Variables
    let parsedNodes = lineName.split(' --> ');
    let expNode = parsedNodes[0] ? parsedNodes[0].trim() : '';
    let impNode = parsedNodes[1] ? parsedNodes[1].trim() : '';
    let expCountry = expNode.split('_')[0]; // Simple heuristic: 'BO_ESTE' -> 'BO' 
    let impCountry = impNode.split('_')[0]; // 'BR_SUDESTE/CO' -> 'BR'

    let globalData = {}; // To store fetched S0/S1 data
    let latamMarginalData = null;

    // ----- STATE FOR TABS -----
    // ASIA STATE
    let asiaInputs = { capex_usd: 939644790.0, life_years: 25, r_annual: 0.06, om_frac_annual: 0.015, hours_year: 8760 };
    let asiaMilesLine = 100;
    let asiaMwMileRule = 'importer_pays';
    let asiaProjectToYear = false;
    let asiaExpostMethod = 'stamp';
    let asiaExpostMUSD = true;

    // EUROPA STATE
    let europaInputs = { itc_rate_usd_per_mwh: 0.50, cid_split: 0.50, infra_fund_usd_per_hour: 0.0, infra_split_ft: 0.75, infra_split_fl: 0.25 };
    window.europaExpostMethod = 'A1';
    window.europaProjectToYear = false;
    window.europaDiscRate = 0.04; // Consistent with implementation_plan
    window.europaHorizon = 25;
    window.europaCo2Total = 15000000;
    window.europaSosTotal = 500000;

    // SIEPAC STATE
    let siepacInputs = { capex: 939644790.0, life_years: 25, r_annual: 0.06, om_frac_annual: 0.015, CVTn_sem_USD: 0.0, CVTn_s1_USD: 0.0, CVTn_s2_USD: 0.0, selected_semester: 1, SCF_USD: 0.0, SCE_USD: 0.0, IVDT_USD: 0.0, alpha_R: 0.70, alpha_I: 0.30 };
    let siepacTargetCountry = expCountry; // default
    let latamInputs = { capex_usd: 939644790.0, life_years: 25, r_annual: 0.06, om_frac_annual: 0.015, expected_cr_usd: null, realized_iar_usd: null, realized_cr_usd: null, fund_initial_usd: 0.0 };

    const createTooltipHTML = (label, description = '', formula = '', align = 'left') => {
        let positionStyle = 'left: 0;';
        if (align === 'right') { positionStyle = 'right: 0; left: auto;'; }
        else if (align === 'center') { positionStyle = 'left: 50%; transform: translateX(-50%);'; }

        return `
        <div class="tooltip-container" style="position: relative; display: inline-flex; align-items: center; gap: 4px; cursor: default; flex-wrap: wrap;">
            <span>${label}</span>
            ${(description || formula) ? `
                <div style="cursor: help; color: #9ca3af; transition: color 0.2s;" onmouseover="this.style.color='#3b82f6'" onmouseout="this.style.color='#9ca3af'">
                    <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div class="tooltip-content" style="position: absolute; bottom: 100%; margin-bottom: 4px; display: none; width: 250px; padding: 12px; background: #1f2937; color: white; font-size: 12px; border-radius: 8px; font-weight: normal; text-transform: none; z-index: 100; white-space: normal; text-align: left; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); ${positionStyle}">
                    ${description ? `<div style="color: #e5e7eb; line-height: 1.5;">${description}</div>` : ''}
                    ${formula ? `
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #4b5563;">
                            <span style="display: block; color: #9ca3af; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; font-weight: 600;">Fórmula:</span>
                            <code style="display: block; background: #111827; padding: 8px; border-radius: 4px; color: #93c5fd; font-size: 11px; word-break: break-all; font-family: monospace; border: 1px solid #374151;">${formula}</code>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `;
    };

    let siepacExpostMUSD = true;

    // Fetch and Process Logic
    try {
        const fetchJson = async (url) => { const res = await fetch(url); return res.ok ? res.json() : null; };

        let targetScenario = (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S1');
        const marginalLatam = await fetchJson('/api/latam-marginal-analysis');
        const precomputedLatam = marginalLatam && marginalLatam.lines
            ? marginalLatam.lines.find(row => row.name === lineName)
            : null;
        const baselineScenario = precomputedLatam
            ? (marginalLatam.baselineScenario || 'S0_LATAM_BASE')
            : 'S0';
        const conScenario = precomputedLatam
            ? (precomputedLatam.scenario || targetScenario || 'S1')
            : (targetScenario || 'S1');

        let [genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1, transS1, linesS1] = await Promise.all([
            fetchJson('/api/generators?scenario=' + baselineScenario), fetchJson('/api/generators?scenario=' + conScenario),
            fetchJson('/api/demand?scenario=' + baselineScenario), fetchJson('/api/demand?scenario=' + conScenario),
            fetchJson('/api/flows?scenario=' + baselineScenario), fetchJson('/api/flows?scenario=' + conScenario),
            fetchJson('/api/marginal-costs?scenario=' + baselineScenario), fetchJson('/api/marginal-costs?scenario=' + conScenario),
            fetchJson('/api/transmission-investment?scenario=' + conScenario),
            fetchJson('/api/lines?scenario=' + conScenario)
        ]);

        // Fallback to S0/S1 if precomputed scenario folders don't exist
        if ((!genS1 || !demS1 || !flowS1 || !mcS1) && (baselineScenario !== 'S0' || conScenario !== 'S1')) {
            console.warn(`Precomputed scenarios (${baselineScenario}/${conScenario}) not found, falling back to S0/S1`);
            [genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1, transS1, linesS1] = await Promise.all([
                fetchJson('/api/generators?scenario=S0'), fetchJson('/api/generators?scenario=S1'),
                fetchJson('/api/demand?scenario=S0'), fetchJson('/api/demand?scenario=S1'),
                fetchJson('/api/flows?scenario=S0'), fetchJson('/api/flows?scenario=S1'),
                fetchJson('/api/marginal-costs?scenario=S0'), fetchJson('/api/marginal-costs?scenario=S1'),
                fetchJson('/api/transmission-investment?scenario=S1'),
                fetchJson('/api/lines?scenario=S1')
            ]);
        }

        if (!genS1 || !demS1 || !flowS1 || !mcS1) throw new Error("Datos incompletos para el caso base o S1.");

        globalData = { genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1, transS1, lines: linesS1, baselineScenario, conScenario };

        // Calculate initial CVT Semestral automatically
        let lmpFrom = []; let lmpTo = [];
        const findNodeLMPs = (d, nName) => {
            for (const cntry in d.countries) { if (d.countries[cntry][nName]) return d.countries[cntry][nName]; }
            return null;
        };
        lmpFrom = findNodeLMPs(mcS1, expNode);
        lmpTo = findNodeLMPs(mcS1, impNode);
        const lFlows = flowS1.flows && flowS1.flows[lineName] ? flowS1.flows[lineName] : [];

        if (lmpFrom && lmpTo && lFlows.length > 0) {
            let halfCount = Math.floor(lFlows.length / 2);
            let division_horas = lFlows.length > 0 ? (8760 / lFlows.length) : 100;
            let cvt_s1 = 0; let cvt_s2 = 0;

            for (let i = 0; i < lFlows.length; i++) {
                const lmpF = lmpFrom[i] || 0; const lmpT = lmpTo[i] || 0; const f = lFlows[i] || 0;
                const value = Math.abs(f * (lmpT - lmpF)) * division_horas;
                if (i < halfCount) cvt_s1 += value;
                else cvt_s2 += value;
            }
            siepacInputs.CVTn_s1_USD = cvt_s1;
            siepacInputs.CVTn_s2_USD = cvt_s2;
            siepacInputs.CVTn_sem_USD = cvt_s1;
        } else {
            siepacInputs.CVTn_s1_USD = 0;
            siepacInputs.CVTn_s2_USD = 0;
            siepacInputs.CVTn_sem_USD = 0;
        }

        // Populate specific input variables based on line's configuration
        siepacInputs.line_capacity_MW = 8000;
        let pMUSD = null;
        if (globalData.lines) {
            const meta = globalData.lines.find(l => l.name === lineName);
            if (meta) {
                siepacInputs.line_capacity_MW = Math.max(meta.fmaxDirect || 0, meta.fmaxInverse || 0);
                if (meta.inversionMUSD != null) {
                    pMUSD = meta.inversionMUSD * 1000000;
                    asiaInputs.capex_usd = pMUSD;
                    siepacInputs.capex = pMUSD;
                }
            }
        }

        if (transS1) {
            const lineConfig = transS1.find(t => t['Nombre línea'] === lineName);
            if (lineConfig) {
                if (lineConfig['Capex_SIEPAC_MUSD'] != null && lineConfig['Capex_SIEPAC_MUSD'] > 0) {
                    siepacInputs.capex = Number(lineConfig['Capex_SIEPAC_MUSD']) * 1000000;
                } else if (lineConfig['Costo_unitario'] != null) {
                    siepacInputs.capex = Number(lineConfig['Costo_unitario']);
                }
                if (pMUSD == null && lineConfig['Costo_unitario'] != null) {
                    asiaInputs.capex_usd = Number(lineConfig['Costo_unitario']);
                }
                if (lineConfig['inv_MW'] != null && lineConfig['inv_MW'] > 0) {
                    siepacInputs.line_capacity_MW = Number(lineConfig['inv_MW']);
                }
            }
        }

        let sum_abs_f = 0;
        if (lFlows.length > 0) {
            for (let f of lFlows) { sum_abs_f += Math.abs(f); }
            let calc_frac = sum_abs_f / (siepacInputs.line_capacity_MW * lFlows.length);
            siepacInputs.frac_uso = Math.min(calc_frac, 1.0);
        } else {
            siepacInputs.frac_uso = 0;
        }

        // Derive Country mappings directly from the Demand records
        let demandMapping = {}; // country -> node
        if (demS1 && Object.keys(demS1).length > 0) {
            Object.keys(demS1).forEach(country => {
                demS1[country].forEach(d => { demandMapping[d.node] = country; });
            });
            // Try to resolve exact countries for the line using the demand mapping
            if (demandMapping[expNode]) expCountry = demandMapping[expNode];
            if (demandMapping[impNode]) impCountry = demandMapping[impNode];
        }

        globalData.expCountry = expCountry;
        globalData.impCountry = impCountry;
        siepacTargetCountry = expCountry;
        globalData.nodes = { [expNode]: expCountry, [impNode]: impCountry };
        latamMarginalData = (marginalLatam && marginalLatam.lines) ? marginalLatam : null;

        latamInputs.capex_usd = siepacInputs.capex;

        renderTabs();

    } catch (e) {
        contentContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #dc2626;">Error cargando datos: ${e.message}</div>`;
        console.error(e);
    }

    // --- TAB RENDERING LOGIC ---

    function renderTabs() {
        const tabs = ['Resumen_General', 'ASIA', 'EUROPA', 'SIEPAC', 'LATAM_HIBRIDO'];
        let activeTab = 'Resumen_General'; // Default

        const renderNav = () => {
            tabsContainer.innerHTML = '';
            tabs.forEach(t => {
                const btn = document.createElement('button');
                btn.className = `tab-btn ${activeTab === t ? 'active' : ''}`;
                btn.textContent = t.replace('_', ' ');
                btn.onclick = () => { activeTab = t; renderNav(); renderActiveTab(); };
                tabsContainer.appendChild(btn);
            });
        };

        const renderActiveTab = () => {
            contentContainer.innerHTML = '';
            if (activeTab === 'Resumen_General') renderGeneralResumen();
            else if (activeTab === 'ASIA') renderAsia();
            else if (activeTab === 'EUROPA') renderEuropa();
            else if (activeTab === 'SIEPAC') renderSiepac();
            else if (activeTab === 'LATAM_HIBRIDO') renderLatam();
        };

        renderNav();
        renderActiveTab();
    }

    // --- HELPER: Country Aggregate Stats ---
    function getCountryStats(country, genData, demData) {
        let stats = { genProfit: 0, genRevenue: 0, varCost: 0, prod: 0, cap: 0, demandCost: 0, demandEns: 0, demandMW: 0 };
        if (genData && genData[country]) {
            genData[country].forEach(g => {
                stats.genProfit += (g.profit || 0); stats.genRevenue += (g.rev || 0);
                stats.varCost += (g.total_var_cost || 0); stats.prod += (g.prod || 0);
                stats.cap += (g.capmax || 0) + (g.inv_pot_MW || 0);
            });
        }
        if (demData && demData[country]) {
            demData[country].forEach(d => {
                // Approximate ENS from existing data if not explicit
                stats.demandCost += (d.demand_cost || 0);
                stats.demandMW += (d.demand || 0);
            });
        }
        // Operation cost = VarCost + ENS_Cost (We use demandCost loosely here if ENS not separated)
        stats.opCost = stats.varCost;
        return stats;
    }

    function calculateCongestionRentLocally(mcData, flowData, fromN, toN, lName) {
        let rent = 0;
        let lmpFrom = []; let lmpTo = [];
        const findNodeLMPs = (d, nName) => {
            if (!d || !d.countries) return null;
            for (const cntry in d.countries) {
                if (d.countries[cntry] && d.countries[cntry][nName]) return d.countries[cntry][nName];
            }
            return null;
        };
        lmpFrom = findNodeLMPs(mcData, fromN);
        lmpTo = findNodeLMPs(mcData, toN);
        const lFlows = flowData[lName] || (flowData.flows && flowData.flows[lName]) || [];

        if (lmpFrom && lmpTo && lFlows.length > 0) {
            let division_horas = lFlows.length > 0 ? (8760 / lFlows.length) : 100;
            for (let i = 0; i < lFlows.length; i++) {
                const lmpF = lmpFrom[i] || 0; const lmpT = lmpTo[i] || 0; const f = lFlows[i] || 0;
                rent += f * (lmpT - lmpF) * division_horas;
            }
        }
        return rent;
    }

    function getSystemCountries() {
        const countrySet = new Set();
        [globalData.genS0, globalData.genS1, globalData.demS0, globalData.demS1].forEach(dataset => {
            if (!dataset) return;
            Object.keys(dataset).forEach(country => countrySet.add(country));
        });
        return Array.from(countrySet).sort();
    }

    const latamMoneyEps = 1;

    function getCountryBenefitRows() {
        return getSystemCountries().map(country => {
            const sin = getCountryStats(country, globalData.genS0, globalData.demS0);
            const con = getCountryStats(country, globalData.genS1, globalData.demS1);
            const deltaProducer = con.genProfit - sin.genProfit;
            const deltaDemandCost = con.demandCost - sin.demandCost;
            const annualBenefit = deltaProducer - deltaDemandCost;

            return {
                country,
                sin,
                con,
                deltaProducer,
                deltaDemandCost,
                annualBenefit,
                positiveBenefit: Math.max(annualBenefit, 0)
            };
        }).filter(row => Math.abs(row.annualBenefit) > latamMoneyEps);
    }

    // ==========================================================
    // TAB 1: RESUMEN GENERAL
    // ==========================================================
    function renderGeneralResumen() {
        const targetCountries = [globalData.expCountry, globalData.impCountry];
        const sinTotals = {}; const conTotals = {};

        targetCountries.forEach(c => {
            sinTotals[c] = getCountryStats(c, globalData.genS0, globalData.demS0);
            conTotals[c] = getCountryStats(c, globalData.genS1, globalData.demS1);
        });

        const deltaTable = targetCountries.map(country => {
            const sin = sinTotals[country]; const con = conTotals[country];
            const deltaProfitGen = con.genProfit - sin.genProfit;
            const deltaDem = con.demandCost - sin.demandCost;
            const netoAgentes = deltaProfitGen - deltaDem;
            return { country, deltaProfitGen, deltaDem, netoAgentes, sin, con };
        });

        let winnerNet = deltaTable[0]; let loserNet = deltaTable[0];
        deltaTable.forEach(row => {
            if (row.netoAgentes > winnerNet.netoAgentes) winnerNet = row;
            if (row.netoAgentes < loserNet.netoAgentes) loserNet = row;
        });

        const congestionRentS1 = calculateCongestionRentLocally(globalData.mcS1, globalData.flowS1, expNode, impNode, lineName);

        contentContainer.innerHTML = `
            <div class="res-card" style="border-top: 4px solid #6366f1;">
                <div class="res-card-header"><span>🏆 Ganadores vs Perdedores (CON - SIN)</span></div>
                <div class="res-card-body">
                    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                        <div class="stat-box" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;">
                            <div class="stat-title">Mejor Escenario (Ganador)</div>
                            <div style="font-size: 1.5rem; font-weight: 700;">${winnerNet.country}</div>
                            <div style="font-size: 0.85rem;">Beneficio Neto: ${formatCur(winnerNet.netoAgentes)}</div>
                        </div>
                        <div class="stat-box" style="background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b;">
                            <div class="stat-title">Peor Escenario (Perdedor)</div>
                            <div style="font-size: 1.5rem; font-weight: 700;">${loserNet.country}</div>
                            <div style="font-size: 0.85rem;">Beneficio Neto: ${formatCur(loserNet.netoAgentes)}</div>
                        </div>
                    </div>
                    <table class="res-table">
                        <thead><tr><th>País</th><th>Δ Profit Gen (CON-SIN)</th><th>Δ Costo Dem (CON-SIN)</th><th>Beneficio Neto</th></tr></thead>
                        <tbody>${deltaTable.map(r => `
                            <tr><td>${r.country}</td><td>${formatCur(r.deltaProfitGen)}</td><td>${formatCur(r.deltaDem)}</td>
                            <td style="font-weight: bold; color: ${r.netoAgentes >= 0 ? '#15803d' : '#b91c1c'}">${formatCur(r.netoAgentes)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                    <div style="margin-top: 16px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; color: #1e3a8a;">
                        <strong>Δ Renta Congestión (Línea):</strong> ${formatCur(congestionRentS1)} <span style="opacity:0.8">(No asignado a agentes aquí)</span>
                    </div>
                </div>
            </div>
            
            <div class="res-card">
                <div class="res-card-header">Detalle Ex-Post (CON - Conectado S1)</div>
                <div class="res-card-body">
                    <table class="res-table">
                        <thead><tr><th>País</th><th>Capacidad (MW)</th><th>Generación (MWh)</th><th>Revenue Gen</th><th>Costo Var</th><th>Profit Gen</th><th>Demanda (MWh)</th><th>Costo Demanda</th></tr></thead>
                        <tbody>${deltaTable.map(r => `
                            <tr><td>${r.country}</td><td>${formatNum(r.con.cap)}</td><td>${formatNum(r.con.prod)}</td>
                            <td>${formatCur(r.con.genRevenue)}</td><td>${formatCur(r.con.varCost)}</td>
                            <td style="font-weight:bold; color:#15803d">${formatCur(r.con.genProfit)}</td>
                            <td>${formatNum(r.con.demandMW)}</td><td>${formatCur(r.con.demandCost)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // ==========================================================
    // TAB 2: ASIA METHODOLOGY
    // ==========================================================
    function renderAsia() {
        const targetCountries = [globalData.expCountry, globalData.impCountry];
        const conFlows = globalData.flowS1.flows && globalData.flowS1.flows[lineName] ? globalData.flowS1.flows[lineName] : [];
        let totalFlowS1 = conFlows.reduce((a, b) => a + b, 0);

        let sum_abs_f = 0;
        let num_periods = conFlows.length > 0 ? conFlows.length : 1;
        if (conFlows.length > 0) {
            for (let f of conFlows) { sum_abs_f += Math.abs(f); }
        }
        let division_horas = conFlows.length > 0 ? (8760 / conFlows.length) : 100;
        let selF_MWh = sum_abs_f * division_horas; // Energia total de la simulacion

        let sim_hours = num_periods * division_horas; // ej. 4300
        let hours_year = asiaInputs.hours_year || 8760;
        let ratio_anualizacion = sim_hours > 0 ? hours_year / sim_hours : 1;

        // Finances
        let r = asiaInputs.r_annual; let n = asiaInputs.life_years; let capex = asiaInputs.capex_usd;
        let om = asiaInputs.om_frac_annual;

        let pow_ = Math.pow(1 + r, n);
        let factor = r > 0 ? (r * pow_) / (pow_ - 1) : (1 / n);
        let annuity = capex * factor;
        let arr = annuity + (capex * om); // Anual
        let rr_sim = ratio_anualizacion > 0 ? arr / ratio_anualizacion : arr;

        let target_rr = asiaProjectToYear ? arr : rr_sim;
        let energyMultiplier = asiaProjectToYear ? ratio_anualizacion : 1;
        let unitSuffix = asiaProjectToYear ? 'Anual' : 'Simulación';

        let expC = totalFlowS1 >= 0 ? globalData.expCountry : globalData.impCountry;
        let impC = totalFlowS1 >= 0 ? globalData.impCountry : globalData.expCountry;

        let statsExp = getCountryStats(expC, globalData.genS1, globalData.demS1);
        let statsImp = getCountryStats(impC, globalData.genS1, globalData.demS1);

        let demFr = (statsExp.demandMW || 1) * energyMultiplier;
        let demTo = (statsImp.demandMW || 1) * energyMultiplier;
        let totalDem = demFr + demTo;
        let stamp_tariff = totalDem > 0 ? target_rr / totalDem : 0;

        let stamp_pay_country = { [expC]: demFr * stamp_tariff, [impC]: demTo * stamp_tariff };

        let selF_Mult = selF_MWh * energyMultiplier;
        let selL = asiaMilesLine;
        let mwm_unit = (selF_Mult > 0 && selL > 0) ? target_rr / (selF_Mult * selL) : 0;
        let selCost = (selF_Mult > 0 && selL > 0) ? target_rr : 0;

        let mwm_pay_country = { [expC]: 0, [impC]: 0 };

        if (selCost > 0) {
            if (asiaMwMileRule === 'importer_pays') mwm_pay_country[impC] = selCost;
            else if (asiaMwMileRule === 'exporter_pays') mwm_pay_country[expC] = selCost;
            else if (asiaMwMileRule === 'split_50_50') { mwm_pay_country[expC] = selCost * 0.5; mwm_pay_country[impC] = selCost * 0.5; }
        }

        const calculateExPostASIA = (isCon, method) => {
            let statsE = getCountryStats(expC, isCon ? globalData.genS1 : globalData.genS0, isCon ? globalData.demS1 : globalData.demS0);
            let statsI = getCountryStats(impC, isCon ? globalData.genS1 : globalData.genS0, isCon ? globalData.demS1 : globalData.demS0);

            let mOpE = statsE.opCost * energyMultiplier; let mOpI = statsI.opCost * energyMultiplier;
            let mPrE = statsE.genProfit * energyMultiplier; let mPrI = statsI.genProfit * energyMultiplier;
            let mDmE = statsE.demandCost * energyMultiplier; let mDmI = statsI.demandCost * energyMultiplier;

            let peE = 0, peI = 0;
            if (isCon) {
                peE = method === 'stamp' ? stamp_pay_country[expC] : mwm_pay_country[expC];
                peI = method === 'stamp' ? stamp_pay_country[impC] : mwm_pay_country[impC];
            }

            let crE = 0, crI = 0;
            if (isCon) {
                let rent = calculateCongestionRentLocally(globalData.mcS1, globalData.flowS1, expNode, impNode, lineName) * energyMultiplier;
                crE = rent * 0.5; crI = rent * 0.5;
            }

            return {
                bsE: mOpE + peE, bsI: mOpI + peI, bgE: mPrE + crE - peE, bgI: mPrI + crI - peI, cdE: mDmE + peE, cdI: mDmI + peI,
                mOpE, mOpI, mPrE, mPrI, mDmE, mDmI, peE, peI, crE, crI
            };
        };

        const conData = calculateExPostASIA(true, asiaExpostMethod);
        const sinData = calculateExPostASIA(false, asiaExpostMethod);

        let deltaBsE = conData.bsE - sinData.bsE; let deltaBsI = conData.bsI - sinData.bsI;
        let deltaBgE = conData.bgE - sinData.bgE; let deltaBgI = conData.bgI - sinData.bgI;
        let deltaCdE = conData.cdE - sinData.cdE; let deltaCdI = conData.cdI - sinData.cdI;

        const formatExpost = (val) => val != null && !isNaN(val) ? (asiaExpostMUSD ? (val / 1000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '-';

        contentContainer.innerHTML = `
            <div class="res-card">
                <div class="res-card-header" style="background:#1e3a8a; color:white;">Configuración Financiera (ASIA)</div>
                <div class="res-card-body" style="background:#f9fafb;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items:center;">
                        <div style="flex:1"><span class="form-label" title="Capital Expenditure: costo total de inversión de la línea de interconexión en dólares estadounidenses.">CAPEX (USD) ℹ️</span><input type="number" id="asia_capex" class="form-input" value="${asiaInputs.capex_usd}"></div>
                        <div style="flex:1"><span class="form-label" title="Vida útil del proyecto en años. Se usa junto con la tasa de descuento para calcular el Factor de Recuperación de Capital (CRF) y la anualidad del CAPEX.">Años ℹ️</span><input type="number" id="asia_n" class="form-input" value="${asiaInputs.life_years}"></div>
                        <div style="flex:1"><span class="form-label" title="Tasa de descuento anual. Se usa para calcular el CRF: r·(1+r)^n / ((1+r)^n - 1), que convierte el CAPEX en una anualidad equivalente.">Tasa (r) ℹ️</span><input type="number" id="asia_r" class="form-input" value="${asiaInputs.r_annual}" step="0.01"></div>
                        <div style="flex:1"><span class="form-label" title="Fracción anual del CAPEX destinada a Operación y Mantenimiento. Ej: 0.02 = 2% del CAPEX por año.">O&M Frac ℹ️</span><input type="number" id="asia_om" class="form-input" value="${asiaInputs.om_frac_annual}" step="0.01"></div>
                        <div style="flex:1"><span class="form-label" title="Longitud de la línea de transmisión en millas. Se utiliza en el método MW-Mile para ponderar el costo por distancia recorrida por el flujo.">Millas Carga ℹ️</span><input type="number" id="asia_miles" class="form-input" value="${asiaMilesLine}"></div>

                        <div style="flex:1"><span class="form-label" title="Regla de asignación de costos MW-Mile: quién paga el cargo por uso de la red. Importador Paga: 100% al importador. Exportador Paga: 100% al exportador. 50/50: se divide equitativamente.">Regla MW-Mile ℹ️</span><select id="asia_rule" class="form-input">
                            <option value="importer_pays" ${asiaMwMileRule === 'importer_pays' ? 'selected' : ''}>Importador Paga</option>
                            <option value="exporter_pays" ${asiaMwMileRule === 'exporter_pays' ? 'selected' : ''}>Exportador Paga</option>
                            <option value="split_50_50" ${asiaMwMileRule === 'split_50_50' ? 'selected' : ''}>50% / 50%</option>
                        </select></div>
                        <div style="flex:1"><span class="form-label" title="Método de análisis ex-post. Sello Postal: tarifa fija por MWh independiente de la distancia. MW-Mile: tarifa proporcional al flujo y la distancia de la línea utilizada.">Método Análisis ℹ️</span><select id="asia_method" class="form-input">
                            <option value="stamp" ${asiaExpostMethod === 'stamp' ? 'selected' : ''}>Sello Postal</option>
                            <option value="mwm" ${asiaExpostMethod === 'mwm' ? 'selected' : ''}>MW-Mile</option>
                        </select></div>
                        <label style="display:flex; align-items:center; gap:5px; font-size:13px; font-weight:bold; height:100%;" title="Si está activado, el CAPEX total se convierte en una anualidad equivalente usando el CRF (tasa r y vida n años). Si no, se usa el CAPEX total sin anualizar.">
                            <input type="checkbox" id="asia_ptoyear" ${asiaProjectToYear ? 'checked' : ''}> Anualizado ℹ️
                        </label>
                        <button id="asia_recalc" style="padding: 6px 16px; background:#2563eb; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onmouseover="this.style.background='#1d4ed8'" onmouseout="this.style.background='#2563eb'">Recalcular</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 20px;">
                <div class="res-card" style="flex: 1; border-top: 4px solid #3b82f6;">
                    <div class="res-card-header">Target Financiero y Asignación ASIA</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <tr><td>Anualidad CAPEX:</td><td align="right" style="font-weight:bold">${createTooltipHTML(formatCur(annuity) + ' /año', 'Anualidad CAPEX', 'CAPEX * Factor_Recuperación(' + (r * 100).toFixed(1) + '%, ' + n + ' años)', 'left')}</td></tr>
                            <tr><td>ARR (Req Anual Completo):</td><td align="right" style="font-weight:bold">${createTooltipHTML(formatCur(arr) + ' /año', 'Total Anual (ARR)', 'Anualidad + Costos O&M (' + (om * 100).toFixed(1) + '%)', 'left')}</td></tr>
                            <tr style="background:#e0e7ff;"><td style="color:#1e40af; font-weight:bold;">RR Objetivo (Base):</td><td align="right" style="font-weight:bold; color:#1e40af">${createTooltipHTML(formatCur(target_rr) + (asiaProjectToYear ? ' /año' : ' /simulación'), 'Target Financiero (RR)', asiaProjectToYear ? 'Toma el ARR Anual (Proyección 8760h)' : 'ARR Anual / Ratio Anualización (' + formatNum(ratio_anualizacion) + ')', 'left')}</td></tr>
                            <tr><td>Tarifa Stamp:</td><td align="right">${createTooltipHTML(formatCur(stamp_tariff) + ' /MWh', 'Tarifa Sello Postal', 'RR_Objetivo / (' + formatNum(totalDem) + ' MWh Demanda)', 'left')}</td></tr>
                            <tr><td>Asignación País (Stamp):</td><td align="right" style="font-size:0.9em; line-height:1.4;">
                                ${expC}: ${createTooltipHTML(formatCur(stamp_pay_country[expC]), 'Asignación ' + expC, formatNum(demFr) + ' MWh Demanda * Tarifa Stamp', 'left')}<br>
                                ${impC}: ${createTooltipHTML(formatCur(stamp_pay_country[impC]), 'Asignación ' + impC, formatNum(demTo) + ' MWh Demanda * Tarifa Stamp', 'left')}
                            </td></tr>
                            <tr><td>Tarifa MW-Mile Unitaria:</td><td align="right">${createTooltipHTML(formatCur(mwm_unit) + ' /MW-Mile', 'Tarifa MW-Milla', 'RR_Objetivo / (' + formatNum(selF_Mult) + ' MWh * ' + selL + ' Millas)', 'left')}</td></tr>
                            <tr><td>Asignación País (MW-Mile):</td><td align="right" style="font-size:0.9em; line-height:1.4;">
                                ${expC}: ${createTooltipHTML(formatCur(mwm_pay_country[expC]), 'Cargo MW-Milla', asiaMwMileRule.includes('exporter') || asiaMwMileRule.includes('50_50') ? 'Se asigna pago según regla' : 'No paga bajo esta regla', 'left')}<br>
                                ${impC}: ${createTooltipHTML(formatCur(mwm_pay_country[impC]), 'Cargo MW-Milla', asiaMwMileRule.includes('importer') || asiaMwMileRule.includes('50_50') ? 'Se asigna pago según regla' : 'No paga bajo esta regla', 'left')}
                            </td></tr>
                        </table>
                    </div>
                </div>

                <div style="flex: 1.5; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <h3 style="margin:0; font-size:1.1rem; color:#1e3a8a;">Análisis Adicional: 3 Modelos Ex-Post</h3>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:0.9em; font-weight:bold; color: #1e3a8a;">Mostrar en:</span>
                            <select id="asia_expost_unit" style="padding:4px; font-weight:bold; cursor:pointer; color: #1e3a8a; border: 1px solid #93c5fd; border-radius: 4px;" onchange="asiaExpostMUSD = this.value === 'MUSD'; document.getElementById('asia_recalc').click();">
                                <option value="MUSD" ${asiaExpostMUSD ? 'selected' : ''}>MUSD</option>
                                <option value="USD" ${!asiaExpostMUSD ? 'selected' : ''}>USD</option>
                            </select>
                        </div>
                    </div>

                    <!-- CASO SIN -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #9ca3af;">
                        <div class="res-card-header" style="background: #f3f4f6;">${createTooltipHTML('1. Caso Base (SIN)', 'Situación del país considerando que no opera ninguna interconexión', 'Flujo de Línea (F) = 0')}</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica ${unitSuffix} ${asiaExpostMUSD ? '(MUSD)' : '(USD)'}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Imp: ${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Costo Operación País', 'Costo variable total de generación para atender la demanda')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatExpost(sinData.bsE), 'Costo Operación', formatExpost(sinData.mOpE) + ' (OpCost)', 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatExpost(sinData.bsI), 'Costo Operación', formatExpost(sinData.mOpI) + ' (OpCost)', 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Beneficio Generador País', 'Ingresos por venta de energía menos el costo de operación de las plantas')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatExpost(sinData.bgE), 'Beneficio Generador', formatExpost(sinData.mPrE) + ' (Profit)', 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatExpost(sinData.bgI), 'Beneficio Generador', formatExpost(sinData.mPrI) + ' (Profit)', 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Costo Demanda País', 'Costo al que la demanda total del país compra la energía')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatExpost(sinData.cdE), 'Costo Demanda', formatExpost(sinData.mDmE) + ' (DemCost)', 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatExpost(sinData.cdI), 'Costo Demanda', formatExpost(sinData.mDmI) + ' (DemCost)', 'right')}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- CASO CON -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #3b82f6;">
                        <div class="res-card-header" style="background: #eff6ff; color: #1e3a8a;">${createTooltipHTML('2. Caso Interconectado (CON)', 'Caso considerando peaje de transmisión ASIA (' + asiaExpostMethod.toUpperCase() + ') y renta', 'F(CON) + Peaje ASIA + Renta')}</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica ${unitSuffix} ${asiaExpostMUSD ? '(MUSD)' : '(USD)'}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Imp: ${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Costo Operación + Peaje', 'Costo de operación interno sumado al peaje asignado a ese país bajo la regla activa', 'Costo_Op_País + Peaje')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatExpost(conData.bsE), 'OpCost + Peaje', formatExpost(conData.mOpE) + ' + ' + formatExpost(conData.peE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatExpost(conData.bsI), 'OpCost + Peaje', formatExpost(conData.mOpI) + ' + ' + formatExpost(conData.peI), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Ben Gen + Renta - Peaje', 'Beneficio del generador sumando la renta país y deduciendo su peaje correspondiente', 'Profit - Peaje + Renta')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatExpost(conData.bgE), 'Profit - Peaje + Renta', formatExpost(conData.mPrE) + ' - ' + formatExpost(conData.peE) + ' + ' + formatExpost(conData.crE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatExpost(conData.bgI), 'Profit - Peaje + Renta', formatExpost(conData.mPrI) + ' - ' + formatExpost(conData.peI) + ' + ' + formatExpost(conData.crI), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Demanda + Peaje', 'La demanda asume todo el peaje ASIA en este caso', 'Demanda + Peaje')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatExpost(conData.cdE), 'DemCost + Peaje', formatExpost(conData.mDmE) + ' + ' + formatExpost(conData.peE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatExpost(conData.cdI), 'DemCost + Peaje', formatExpost(conData.mDmI) + ' + ' + formatExpost(conData.peI), 'right')}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- DELTAS -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #8b5cf6;">
                        <div class="res-card-header" style="background: #f5f3ff; color: #4c1d95;">${createTooltipHTML('3. Ganadores y perdedores (Δ)', 'Diferencial neto del beneficio/coste (Ganan si costo baja o profit sube)')}</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica ${unitSuffix} ${asiaExpostMUSD ? '(MUSD)' : '(USD)'}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Imp: ${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Operación</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBsE < 0 ? 'bold' : 'normal'}; color:${deltaBsE < 0 ? '#16a34a' : '#ef4444'}">${deltaBsE < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaBsE) + ')', 'Δ Costo (CON - SIN)', formatExpost(conData.bsE) + ' - ' + formatExpost(sinData.bsE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBsI < 0 ? 'bold' : 'normal'}; color:${deltaBsI < 0 ? '#16a34a' : '#ef4444'}">${deltaBsI < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaBsI) + ')', 'Δ Costo (CON - SIN)', formatExpost(conData.bsI) + ' - ' + formatExpost(sinData.bsI), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Beneficio Generador</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBgE > 0 ? 'bold' : 'normal'}; color:${deltaBgE > 0 ? '#16a34a' : '#ef4444'}">${deltaBgE > 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaBgE) + ')', 'Δ Beneficio (CON - SIN)', formatExpost(conData.bgE) + ' - ' + formatExpost(sinData.bgE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBgI > 0 ? 'bold' : 'normal'}; color:${deltaBgI > 0 ? '#16a34a' : '#ef4444'}">${deltaBgI > 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaBgI) + ')', 'Δ Beneficio (CON - SIN)', formatExpost(conData.bgI) + ' - ' + formatExpost(sinData.bgI), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Demanda</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaCdE < 0 ? 'bold' : 'normal'}; color:${deltaCdE < 0 ? '#16a34a' : '#ef4444'}">${deltaCdE < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaCdE) + ')', 'Δ Costo (CON - SIN)', formatExpost(conData.cdE) + ' - ' + formatExpost(sinData.cdE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaCdI < 0 ? 'bold' : 'normal'}; color:${deltaCdI < 0 ? '#16a34a' : '#ef4444'}">${deltaCdI < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaCdI) + ')', 'Δ Costo (CON - SIN)', formatExpost(conData.cdI) + ' - ' + formatExpost(sinData.cdI), 'right')}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('asia_recalc').onclick = () => {
            asiaInputs.capex_usd = Number(document.getElementById('asia_capex').value);
            asiaInputs.life_years = Number(document.getElementById('asia_n').value);
            asiaInputs.r_annual = Number(document.getElementById('asia_r').value);
            asiaInputs.om_frac_annual = Number(document.getElementById('asia_om').value);
            asiaMilesLine = Number(document.getElementById('asia_miles').value);
            asiaMwMileRule = document.getElementById('asia_rule').value;
            asiaExpostMethod = document.getElementById('asia_method').value;
            asiaProjectToYear = document.getElementById('asia_ptoyear').checked;
            renderAsia();
        };
    }

    function renderEuropa() {
        try {
            if (typeof window.europaExpostMUSD === 'undefined') window.europaExpostMUSD = true;
            if (typeof window.europaDiscRate === 'undefined') window.europaDiscRate = 0.04;
            if (typeof window.europaHorizon === 'undefined') window.europaHorizon = 25;
            if (typeof window.europaCo2Total === 'undefined') window.europaCo2Total = 0;
            if (typeof window.europaSosTotal === 'undefined') window.europaSosTotal = 0;

            if (!globalData || !globalData.flowS1) throw new Error("Datos de flujo S1 no disponibles.");
            
            const conFlows = (globalData.flowS1.flows && globalData.flowS1.flows[lineName]) ? globalData.flowS1.flows[lineName] : [];
            let sum_abs_f = 0; let sum_raw_f = 0;
            if (conFlows.length > 0) {
                for (let f of conFlows) { sum_abs_f += Math.abs(f); sum_raw_f += f; }
            }
            let division_horas = conFlows.length > 0 ? (8760 / conFlows.length) : 100;
            let sum_abs_f_MWh = sum_abs_f * division_horas;

            let projFactor = (window.europaProjectToYear && conFlows.length > 0) ? (8760 / (conFlows.length * division_horas)) : 1;
            let unitPrefix = window.europaExpostMUSD ? 'MUSD' : 'USD';
            let unitSuffix = window.europaProjectToYear ? `(${unitPrefix}/Año)` : `(${unitPrefix})`;

            const formatCur = (val) => val != null && !isNaN(val) ? (window.europaExpostMUSD ? (val / 1000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '0.00';
            const formatNum = (val) => val ? val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0';

            let nf_MWh_anual = sum_abs_f_MWh * projFactor;
            let expC = sum_raw_f >= 0 ? globalData.expCountry : globalData.impCountry;
            let impC = sum_raw_f >= 0 ? globalData.impCountry : globalData.expCountry;

            let rate = europaInputs.itc_rate_usd_per_mwh;
            let cid_split = europaInputs.cid_split;
            let fund = europaInputs.infra_fund_usd_per_hour;

            let itc_pay_e = nf_MWh_anual * rate;
            let itc_pay_i = nf_MWh_anual * rate;

            let rent = calculateCongestionRentLocally(globalData.mcS1, globalData.flowS1, expNode, impNode, lineName);
            let rent_total = rent * division_horas * projFactor;

            let cid_e = rent_total * cid_split;
            let cid_i = rent_total * (1 - cid_split);

            let base_hours = window.europaProjectToYear ? 8760 : (conFlows.length * division_horas);
            let itc_inc_e = fund * base_hours * 0.5;
            let itc_inc_i = fund * base_hours * 0.5;

            let set_e = cid_e + itc_inc_e - itc_pay_e;
            let set_i = cid_i + itc_inc_i - itc_pay_i;

            let peajeChargeE = 0; let peajeChargeI = 0;
            let rentAdjE = 0; let rentAdjI = 0;
            if (window.europaExpostMethod === 'A1') {
                peajeChargeE = itc_pay_e; peajeChargeI = itc_pay_i;
                rentAdjE = cid_e; rentAdjI = cid_i;
            } else {
                peajeChargeE = itc_pay_e - cid_e; peajeChargeI = itc_pay_i - cid_i;
            }

            // --- Comprehensive CBA Calculations ---
            const allCountries = [expC, impC];
            const CBA_CO2_SHARES = { "CL": 1/3, "PE": 1/3, "AR": 1/3, "BO": 0, "BR": 0 }; // Default shares using codes
            const CBA_SOS_SHARES = { "CL": 1/3, "PE": 1/3, "AR": 1/3, "BO": 0, "BR": 0 };

            const r_disc = window.europaDiscRate;
            const n_years = window.europaHorizon;
            const pvaf = r_disc > 0 ? (1 - Math.pow(1 + r_disc, -n_years)) / r_disc : n_years;

            let annualImpacts = allCountries.map(c => {
                let s0 = getCountryStats(c, globalData.genS0, globalData.demS0);
                let s1 = getCountryStats(c, globalData.genS1, globalData.demS1);
                
                // ΔCS = -(P1 - P0) * D0. 
                // In our data, s.demandCost is already (P * D). 
                // Since D is inelastic D1=D0, ΔCS = s0.demandCost - s1.demandCost
                let deltaCS = (s0.demandCost - s1.demandCost) * projFactor;
                let deltaPS = (s1.genProfit - s0.genProfit) * projFactor;
                
                let co2 = (window.europaCo2Total * 1000000 * (CBA_CO2_SHARES[c] || 0)) * projFactor;
                let sos = (window.europaSosTotal * 1000000 * (CBA_SOS_SHARES[c] || 0)) * projFactor;
                
                let cr_alloc = 0;
                if (c === expC) cr_alloc = cid_e;
                if (c === impC) cr_alloc = cid_i;
                
                let benefitsA = deltaCS + deltaPS + co2 + sos;
                let benefitsB = benefitsA + cr_alloc;
                
                return { country: c, deltaCS, deltaPS, co2, sos, benefitsA, benefitsB, cr_alloc };
            });

            // NPV and PV
            let capex_base = 0;
            if (globalData.transS1) {
                const config = globalData.transS1.find(t => t['Nombre línea'] === lineName);
                if (config) capex_base = Number(config['Costo_unitario'] || config['Costo_total_USD'] || 0);
            }
            if (capex_base === 0) capex_base = 1400000000; // Fallback to 1400 MUSD

            let pv_benefits_A_total = annualImpacts.reduce((sum, row) => sum + row.benefitsA, 0) * pvaf;
            let pv_benefits_B_total = annualImpacts.reduce((sum, row) => sum + row.benefitsB, 0) * pvaf;
            
            let pv_opex = (capex_base * 0.015) * pvaf; // Assuming 1.5% O&M
            let pv_cost_total = capex_base + pv_opex;

            let pvData = annualImpacts.map(row => {
                let pvBenA = row.benefitsA * pvaf;
                let pvBenB = row.benefitsB * pvaf;
                let shareA = pv_benefits_A_total !== 0 ? pvBenA / pv_benefits_A_total : 0;
                let shareB = pv_benefits_B_total !== 0 ? pvBenB / pv_benefits_B_total : 0;
                let costA = shareA * pv_cost_total;
                let costB = shareB * pv_cost_total;
                return { 
                    country: row.country, 
                    pvBenA, costA, npvA: pvBenA - costA,
                    pvBenB, costB, npvB: pvBenB - costB
                };
            }).filter(d => d.pvBenA !== 0 || d.pvBenB !== 0);

            // Generate Data for 3 Ex-Post Models (SIN vs CON vs Deltas)
            let s0_e = getCountryStats(expC, globalData.genS0, globalData.demS0);
            let s1_e = getCountryStats(expC, globalData.genS1, globalData.demS1);
            let s0_i = getCountryStats(impC, globalData.genS0, globalData.demS0);
            let s1_i = getCountryStats(impC, globalData.genS1, globalData.demS1);

            let sinDataEur = {
                bsE: (s0_e.opCost || 0) * projFactor, bsI: (s0_i.opCost || 0) * projFactor,
                bgE: (s0_e.genProfit || 0) * projFactor, bgI: (s0_i.genProfit || 0) * projFactor,
                cdE: (s0_e.demandCost || 0) * projFactor, cdI: (s0_i.demandCost || 0) * projFactor
            };

            let conDataEur = {
                bsE: (s1_e.opCost || 0) * projFactor, bsI: (s1_i.opCost || 0) * projFactor,
                bgE: (s1_e.genProfit || 0) * projFactor, bgI: (s1_i.genProfit || 0) * projFactor,
                cdE: (s1_e.demandCost || 0) * projFactor, cdI: (s1_i.demandCost || 0) * projFactor
            };

            let deltaBsE_Eur = conDataEur.bsE - sinDataEur.bsE;
            let deltaBsI_Eur = conDataEur.bsI - sinDataEur.bsI;
            let deltaBgE_Eur = conDataEur.bgE - sinDataEur.bgE;
            let deltaBgI_Eur = conDataEur.bgI - sinDataEur.bgI;
            let deltaCdE_Eur = conDataEur.cdE - sinDataEur.cdE;
            let deltaCdI_Eur = conDataEur.cdI - sinDataEur.cdI;

            contentContainer.innerHTML = `
            <div class="res-card">
                <div class="res-card-header" style="background:#064e3b; color:white; display:flex; justify-content:space-between; align-items:center;">
                    <span>Configuración ENTSO-E (EUROPA) Ampliada</span>
                    <div style="font-size:0.85em; display:flex; gap:8px; align-items:center;">
                        <span>Unidad:</span>
                        <select id="eur_expost_unit" style="padding:4px; font-weight:bold; cursor:pointer;" onchange="window.europaExpostMUSD = (this.value === 'MUSD'); document.getElementById('eur_recalc').click();">
                            <option value="MUSD" ${window.europaExpostMUSD ? 'selected' : ''}>MUSD</option>
                            <option value="USD" ${!window.europaExpostMUSD ? 'selected' : ''}>USD</option>
                        </select>
                    </div>
                </div>
                <div class="res-card-body" style="background:#f9fafb;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 12px; align-items:flex-end;">
                        <div><span class="form-label" title="Inter-TSO Compensation: tarifa por MWh de tránsito que paga el país importador al país de tránsito por uso de su red de transmisión.">Rate ITC ($/MWh) ℹ️</span><input type="number" id="eur_itc" class="form-input" value="${europaInputs.itc_rate_usd_per_mwh}" step="0.01"></div>
                        <div><span class="form-label" title="Cross-border Infrastructure Development Split: proporción de asignación de costos entre exportador (E) e importador (I). Valor 0.5 = 50/50.">CID Split (E/I) ℹ️</span><input type="number" id="eur_cid" class="form-input" value="${europaInputs.cid_split}" step="0.01"></div>
                        <div><span class="form-label" title="Fondo de Infraestructura: contribución horaria ($/h) destinada a financiar nuevas interconexiones transfronterizas.">Fondo Infra ($/h) ℹ️</span><input type="number" id="eur_fund" class="form-input" value="${europaInputs.infra_fund_usd_per_hour}"></div>
                        <div><span class="form-label" title="Tasa de descuento anual utilizada para calcular el Valor Presente Neto (VPN) de los beneficios y costos del proyecto.">Descuento (r) ℹ️</span><input type="number" id="eur_r" class="form-input" value="${window.europaDiscRate}" step="0.01"></div>
                        <div><span class="form-label" title="Horizonte de evaluación del proyecto en años. Se usa junto con la tasa de descuento para calcular el factor de anualidad (CRF) y el VPN.">Horizonte (años) ℹ️</span><input type="number" id="eur_n" class="form-input" value="${window.europaHorizon}"></div>
                        <div><span class="form-label" title="Beneficio anual por reducción de emisiones de CO2 (en MUSD/año). Módulo no-mercado del marco ENTSO-E para valorar externalidades ambientales.">CO2 (MUSD/año) ℹ️</span><input type="number" id="eur_co2" class="form-input" value="${window.europaCo2Total}"></div>
                        <div><span class="form-label" title="Security of Supply: beneficio anual por mejora en la seguridad de suministro (MUSD/año). Módulo no-mercado que valora la reducción del riesgo de desabastecimiento.">SoS (MUSD/año) ℹ️</span><input type="number" id="eur_sos" class="form-input" value="${window.europaSosTotal}"></div>
                        <div style="display:flex; align-items:center; gap:5px; padding-bottom:10px;" title="Si está activado, el CAPEX total se convierte en una anualidad equivalente usando la tasa de descuento y el horizonte (fórmula CRF). Si no, se usa el CAPEX total sin anualizar."><input type="checkbox" id="eur_ptoyear" ${window.europaProjectToYear ? 'checked' : ''}> Anualizar ℹ️</div>
                        <button id="eur_recalc" style="padding: 10px; background:#10b981; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">Aplicar</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 20px; margin-top:20px;">
                <!-- 3 EX-POST MODELS -->
                <div style="margin-bottom: 0px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin-bottom: 0; font-size: 1.25rem; font-weight: 600; color: #1e3a8a;">Análisis de Ganadores y Perdedores (SIN vs CON)</h3>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 16px;">
                        <!-- CASO SIN -->
                        <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #9ca3af;">
                            <div class="res-card-header" style="background: #f3f4f6;">${createTooltipHTML('1. Caso Base (SIN)', 'Situación del país considerando que no opera ninguna interconexión', 'Flujo de Línea (F) = 0')}</div>
                            <div class="res-card-body" style="padding: 0;">
                                <table class="res-table">
                                    <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica ${unitSuffix}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Imp: ${impC}</th></tr></thead>
                                    <tbody>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Costo Operación País', 'Costo variable total de generación para atender la demanda')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(sinDataEur.bsE), 'Costo Operación', formatCur(sinDataEur.bsE) + ' (OpCost)', 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(sinDataEur.bsI), 'Costo Operación', formatCur(sinDataEur.bsI) + ' (OpCost)', 'right')}</td></tr>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Beneficio Generador País', 'Ingresos por venta de energía menos el costo de operación de las plantas')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(sinDataEur.bgE), 'Beneficio Generador', formatCur(sinDataEur.bgE) + ' (Profit)', 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(sinDataEur.bgI), 'Beneficio Generador', formatCur(sinDataEur.bgI) + ' (Profit)', 'right')}</td></tr>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Costo Demanda País', 'Costo al que la demanda total del país compra la energía')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(sinDataEur.cdE), 'Costo Demanda', formatCur(sinDataEur.cdE) + ' (DemCost)', 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(sinDataEur.cdI), 'Costo Demanda', formatCur(sinDataEur.cdI) + ' (DemCost)', 'right')}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- CASO CON -->
                        <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #3b82f6;">
                            <div class="res-card-header" style="background: #eff6ff; color: #1e3a8a;">${createTooltipHTML('2. Caso Interconectado (CON)', 'Caso analizando el bloque SIN vs CON directamente (CBA ENTSO-E)', 'F(CON)')}</div>
                            <div class="res-card-body" style="padding: 0;">
                                <table class="res-table">
                                    <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica ${unitSuffix}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Imp: ${impC}</th></tr></thead>
                                    <tbody>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Costo Operación País', 'Costo de operación interno en interconexión')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(conDataEur.bsE), 'OpCost', formatCur(conDataEur.bsE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(conDataEur.bsI), 'OpCost', formatCur(conDataEur.bsI), 'right')}</td></tr>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Beneficio Generador País', 'Beneficio del generador considerando interconexión')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(conDataEur.bgE), 'Profit', formatCur(conDataEur.bgE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(conDataEur.bgI), 'Profit', formatCur(conDataEur.bgI), 'right')}</td></tr>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML('Costo Demanda País', 'Costo para la demanda en interconexión')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(conDataEur.cdE), 'DemCost', formatCur(conDataEur.cdE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(conDataEur.cdI), 'DemCost', formatCur(conDataEur.cdI), 'right')}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- DELTAS -->
                        <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #8b5cf6;">
                            <div class="res-card-header" style="background: #f5f3ff; color: #4c1d95;">${createTooltipHTML('3. Ganadores y perdedores (Δ)', 'Diferencial neto del beneficio/coste (Ganan si costo baja o profit sube)')}</div>
                            <div class="res-card-body" style="padding: 0;">
                                <table class="res-table">
                                    <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica ${unitSuffix}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;" align="right">Imp: ${impC}</th></tr></thead>
                                    <tbody>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Operación</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBsE_Eur < 0 ? 'bold' : 'normal'}; color:${deltaBsE_Eur < 0 ? '#16a34a' : '#ef4444'}">${deltaBsE_Eur < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(deltaBsE_Eur) + ')', 'Δ Costo (CON - SIN)', formatCur(conDataEur.bsE) + ' - ' + formatCur(sinDataEur.bsE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBsI_Eur < 0 ? 'bold' : 'normal'}; color:${deltaBsI_Eur < 0 ? '#16a34a' : '#ef4444'}">${deltaBsI_Eur < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(deltaBsI_Eur) + ')', 'Δ Costo (CON - SIN)', formatCur(conDataEur.bsI) + ' - ' + formatCur(sinDataEur.bsI), 'right')}</td></tr>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Beneficio Generador</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBgE_Eur > 0 ? 'bold' : 'normal'}; color:${deltaBgE_Eur > 0 ? '#16a34a' : '#ef4444'}">${deltaBgE_Eur > 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(deltaBgE_Eur) + ')', 'Δ Beneficio (CON - SIN)', formatCur(conDataEur.bgE) + ' - ' + formatCur(sinDataEur.bgE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBgI_Eur > 0 ? 'bold' : 'normal'}; color:${deltaBgI_Eur > 0 ? '#16a34a' : '#ef4444'}">${deltaBgI_Eur > 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(deltaBgI_Eur) + ')', 'Δ Beneficio (CON - SIN)', formatCur(conDataEur.bgI) + ' - ' + formatCur(sinDataEur.bgI), 'right')}</td></tr>
                                        <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Demanda</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaCdE_Eur < 0 ? 'bold' : 'normal'}; color:${deltaCdE_Eur < 0 ? '#16a34a' : '#ef4444'}">${deltaCdE_Eur < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(deltaCdE_Eur) + ')', 'Δ Costo (CON - SIN)', formatCur(conDataEur.cdE) + ' - ' + formatCur(sinDataEur.cdE), 'right')}</td><td align="right" style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaCdI_Eur < 0 ? 'bold' : 'normal'}; color:${deltaCdI_Eur < 0 ? '#16a34a' : '#ef4444'}">${deltaCdI_Eur < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(deltaCdI_Eur) + ')', 'Δ Costo (CON - SIN)', formatCur(conDataEur.cdI) + ' - ' + formatCur(sinDataEur.cdI), 'right')}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TSO SETTLEMENT -->
                <div class="res-card" style="border-top: 4px solid #10b981;">
                    <div class="res-card-header">Liquidación TSO (Cálculos Centralizados)</div>
                    <div class="res-card-body">
                        <table class="res-table text-right">
                            <thead><tr><th style="text-align:left;">TSO País</th><th>Pago ITC</th><th>Ingreso CID</th><th>Ingreso Infra</th><th>Liq. Final Ex-Post</th></tr></thead>
                            <tbody>
                                <tr><td style="text-align:left; font-weight:bold;">${expC} (Exp)</td><td style="color:#dc2626;">-${formatCur(itc_pay_e)}</td><td style="color:#2563eb;">${formatCur(cid_e)}</td><td style="color:#2563eb;">${formatCur(itc_inc_e)}</td><td style="font-weight:bold;">${formatCur(set_e)}</td></tr>
                                <tr><td style="text-align:left; font-weight:bold;">${impC} (Imp)</td><td style="color:#dc2626;">-${formatCur(itc_pay_i)}</td><td style="color:#2563eb;">${formatCur(cid_i)}</td><td style="color:#2563eb;">${formatCur(itc_inc_i)}</td><td style="font-weight:bold;">${formatCur(set_i)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ANNUAL IMPACTS -->
                <div class="res-card" style="border-top: 4px solid #3b82f6;">
                    <div class="res-card-header">Impactos Anuales (CBA Europa) ${unitSuffix}</div>
                    <div class="res-card-body" style="overflow-x:auto;">
                        <table class="res-table text-right">
                            <thead><tr><th style="text-align:left;">País</th><th>Δ CS</th><th>Δ PS</th><th>CO2</th><th>SoS</th><th>Δ SEW (A)</th><th>CR Alloc</th><th>Benefits (B)</th></tr></thead>
                            <tbody>
                                ${annualImpacts.filter(r => r.benefitsA !== 0 || r.benefitsB !== 0).map(r => `
                                    <tr>
                                        <td style="text-align:left; font-weight:bold;">${r.country}</td>
                                        <td>${formatCur(r.deltaCS)}</td>
                                        <td>${formatCur(r.deltaPS)}</td>
                                        <td>${formatCur(r.co2)}</td>
                                        <td>${formatCur(r.sos)}</td>
                                        <td style="font-weight:bold;">${formatCur(r.benefitsA)}</td>
                                        <td>${formatCur(r.cr_alloc)}</td>
                                        <td style="font-weight:bold; color:#15803d;">${formatCur(r.benefitsB)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- PV AND CBCA -->
                <div class="res-card" style="border-top: 4px solid #8b5cf6;">
                    <div class="res-card-header">Valor Presente (PV) y CBCA (MUSD en Horizonte)</div>
                    <div class="res-card-body" style="overflow-x:auto;">
                        <table class="res-table text-right">
                            <thead style="background:#f5f3ff;">
                                <tr><th style="text-align:left;" rowspan="2">País</th><th colspan="3" style="text-align:center;">Enfoque A (Sin CR)</th><th colspan="3" style="text-align:center; border-left:1px solid #ddd;">Enfoque B (Con CR)</th></tr>
                                <tr><th>PV Ben A</th><th>Exp. Cost A</th><th>NPV A</th><th style="border-left:1px solid #ddd;">PV Ben B</th><th>Exp. Cost B</th><th>NPV B</th></tr>
                            </thead>
                            <tbody>
                                ${pvData.map(r => `
                                    <tr>
                                        <td style="text-align:left; font-weight:bold;">${r.country}</td>
                                        <td>${formatCur(r.pvBenA)}</td><td style="color:#dc2626;">${formatCur(r.costA)}</td><td style="font-weight:bold; color:${r.npvA >= 0 ? '#15803d' : '#dc2626'}">${formatCur(r.npvA)}</td>
                                        <td style="border-left:1px solid #ddd;">${formatCur(r.pvBenB)}</td><td style="color:#dc2626;">${formatCur(r.costB)}</td><td style="font-weight:bold; color:${r.npvB >= 0 ? '#15803d' : '#dc2626'}">${formatCur(r.npvB)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div style="margin-top:15px; font-size:0.9em; color:#6b7280; display:flex; gap:20px;">
                            <span><strong>CAPEX:</strong> ${formatCur(capex_base)}</span>
                            <span><strong>PV OPEX:</strong> ${formatCur(pv_opex)}</span>
                            <span><strong>PVAF:</strong> ${pvaf.toFixed(2)}</span>
                            <span style="color:#111827;"><strong>NPV Proyecto:</strong> ${formatCur(pv_benefits_B_total - pv_cost_total)}</span>
                        </div>
                    </div>
                </div>
            </div>
            `;

            document.getElementById('eur_recalc').onclick = () => {
                europaInputs.itc_rate_usd_per_mwh = Number(document.getElementById('eur_itc').value);
                europaInputs.cid_split = Number(document.getElementById('eur_cid').value);
                europaInputs.infra_fund_usd_per_hour = Number(document.getElementById('eur_fund').value);
                window.europaDiscRate = Number(document.getElementById('eur_r').value);
                window.europaHorizon = Number(document.getElementById('eur_n').value);
                window.europaCo2Total = Number(document.getElementById('eur_co2').value);
                window.europaSosTotal = Number(document.getElementById('eur_sos').value);
                window.europaProjectToYear = document.getElementById('eur_ptoyear').checked;
                renderEuropa();
            };
        } catch (err) {
            console.error("Error in renderEuropa:", err);
            contentContainer.innerHTML = `<div style="padding:20px; color:#dc2626; background:#fee2e2; border-radius:8px;">
                <strong>Error en Metodología EUROPA:</strong> ${err.message}
            </div>`;
        }
    }

    function renderLatam() {
        try {
            const eps = latamMoneyEps;
            const toNumber = (value, fallback = 0) => {
                const num = Number(value);
                return Number.isFinite(num) ? num : fallback;
            };
            const uniqueCountries = (values) => Array.from(new Set((values || []).filter(Boolean)));
            const fmtMUSD = (value) => (toNumber(value, 0) / 1000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const fmtPct = (value) => `${(100 * toNumber(value, 0)).toFixed(1)}%`;
            const formatSignedMUSD = (value) => {
                const num = toNumber(value, 0) / 1000000;
                const sign = num > 0 ? '+' : '';
                return `${sign}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            };
            const statusCard = (label, active, positiveLabel = 'Sí', negativeLabel = 'No', toneWhenActive = 'success') => {
                const activePalette = toneWhenActive === 'danger'
                    ? { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b' }
                    : (toneWhenActive === 'warning'
                        ? { bg: '#fff7ed', border: '#fdba74', color: '#9a3412' }
                        : { bg: '#ecfdf5', border: '#86efac', color: '#166534' });
                const inactivePalette = { bg: '#f8fafc', border: '#cbd5e1', color: '#475569' };
                const palette = active ? activePalette : inactivePalette;
                return `
                <div class="stat-box" style="background:${palette.bg}; border:1px solid ${palette.border}; color:${palette.color};">
                    <div style="font-size:0.82em; font-weight:700;">${label}</div>
                    <div style="font-size:1.25rem; font-weight:700; margin-top:6px;">${active ? positiveLabel : negativeLabel}</div>
                </div>
            `;
            };

            const precomputedLatam = latamMarginalData && latamMarginalData.lines
                ? latamMarginalData.lines.find(row => row.name === lineName)
                : null;
            const allBenefitRows = precomputedLatam ? (precomputedLatam.benefitRows || []) : getCountryBenefitRows();
            const benefitMap = new Map(allBenefitRows.map(row => [row.country, row]));
            const signatoryCountries = precomputedLatam
                ? uniqueCountries(precomputedLatam.signatoryCountries || [precomputedLatam.fromCountry, precomputedLatam.toCountry])
                : uniqueCountries([expCountry, impCountry]);
            const positiveBenefitRows = allBenefitRows.filter(row => row.annualBenefit > eps);
            const shadowCountries = precomputedLatam
                ? uniqueCountries(precomputedLatam.shadowCountries || [...signatoryCountries, ...positiveBenefitRows.map(row => row.country)])
                : uniqueCountries([
                    ...signatoryCountries,
                    ...positiveBenefitRows.map(row => row.country)
                ]);

            const lineMeta = (globalData.lines || []).find(line => line.name === lineName) || {};
            const conFlows = (globalData.flowS1.flows && globalData.flowS1.flows[lineName]) ? globalData.flowS1.flows[lineName] : [];
            const divisionHours = conFlows.length > 0 ? (8760 / conFlows.length) : 100;
            let sumAbs = 0;
            conFlows.forEach(flow => {
                sumAbs += Math.abs(toNumber(flow, 0));
            });
            const fallbackUseFraction = (lineMeta.fmaxDirect || lineMeta.fmaxInverse || 0) > 0 && conFlows.length > 0
                ? Math.min(1, sumAbs / ((lineMeta.fmaxDirect || lineMeta.fmaxInverse) * conFlows.length))
                : 0;
            const useFraction = precomputedLatam ? toNumber(precomputedLatam.useFraction, fallbackUseFraction) : fallbackUseFraction;

            if (precomputedLatam && (!Number.isFinite(Number(latamInputs.capex_usd)) || Number(latamInputs.capex_usd) === siepacInputs.capex)) {
                latamInputs.capex_usd = toNumber(precomputedLatam.capexUSD, siepacInputs.capex);
            }

            const capex = Math.max(0, toNumber(latamInputs.capex_usd, precomputedLatam ? precomputedLatam.capexUSD : 0));
            const r = Math.max(0, toNumber(latamInputs.r_annual, 0));
            const n = Math.max(1, toNumber(latamInputs.life_years, 1));
            const om = Math.max(0, toNumber(latamInputs.om_frac_annual, 0));
            const pow = Math.pow(1 + r, n);
            const crf = r > 0 ? (r * pow) / (pow - 1) : (1 / n);
            const projectedIar = capex * crf + (capex * om);
            const modeledCR = precomputedLatam
                ? Math.max(0, toNumber(precomputedLatam.modeledCRUSDPerYear, 0))
                : Math.max(0, calculateCongestionRentLocally(globalData.mcS1, globalData.flowS1, expNode, impNode, lineName));
            const expectedCR = latamInputs.expected_cr_usd == null ? modeledCR : Math.max(0, toNumber(latamInputs.expected_cr_usd, modeledCR));
            const realizedIAR = latamInputs.realized_iar_usd == null ? projectedIar : Math.max(0, toNumber(latamInputs.realized_iar_usd, projectedIar));
            const realizedCR = latamInputs.realized_cr_usd == null ? modeledCR : Math.max(0, toNumber(latamInputs.realized_cr_usd, modeledCR));
            const fundInitial = toNumber(latamInputs.fund_initial_usd, 0);
            const projectedResidual = Math.max(0, projectedIar - expectedCR);
            const realizedResidual = Math.max(0, realizedIAR - realizedCR);
            const fundDelta = projectedResidual - realizedResidual;
            const fundBalanceRaw = fundInitial + fundDelta;
            const fundFinal = Math.max(0, fundBalanceRaw);
            const uncoveredShortfall = Math.max(0, -fundBalanceRaw);

            const getBenefitRow = (country) => benefitMap.get(country) || {
                country,
                deltaProducer: 0,
                deltaDemandCost: 0,
                annualBenefit: 0,
                positiveBenefit: 0
            };

            const buildSettlement = (scopeCountries) => {
                const scope = uniqueCountries([...signatoryCountries, ...(scopeCountries || [])]);
                const rows = scope.map(country => {
                    const row = getBenefitRow(country);
                    return {
                        country,
                        deltaProducer: toNumber(row.deltaProducer, 0),
                        deltaDemandCost: toNumber(row.deltaDemandCost, 0),
                        annualBenefit: toNumber(row.annualBenefit, 0),
                        positiveBenefit: Math.max(toNumber(row.annualBenefit, 0), 0),
                        demandLoss: Math.max(toNumber(row.deltaDemandCost, 0), 0),
                        domesticWinners: Math.max(toNumber(row.deltaProducer, 0), 0),
                        isSignatory: signatoryCountries.includes(country)
                    };
                });

                const positiveTotal = rows.reduce((sum, row) => sum + row.positiveBenefit, 0);
                const fallbackShare = rows.length > 0 ? (1 / rows.length) : 0;

                rows.forEach(row => {
                    row.cbcaShare = positiveTotal > eps ? row.positiveBenefit / positiveTotal : fallbackShare;
                    row.initialCharge = row.cbcaShare * projectedResidual;
                    row.netBeforeRegional = row.annualBenefit - row.initialCharge;
                    row.regionalReceived = 0;
                    row.regionalPaid = 0;
                    row.regionalAppliedToDemand = 0;
                    row.domesticComp = 0;
                    row.externalTopUpReceived = 0;
                    row.externalTopUpPaid = 0;
                });

                const deficitRows = rows.filter(row => row.netBeforeRegional < -eps);
                const surplusRows = rows.filter(row => row.netBeforeRegional > eps);
                const deficitTotal = deficitRows.reduce((sum, row) => sum + Math.abs(row.netBeforeRegional), 0);
                const surplusTotal = surplusRows.reduce((sum, row) => sum + row.netBeforeRegional, 0);
                const regionalTransfer = Math.min(deficitTotal, surplusTotal);

                if (regionalTransfer > eps && deficitTotal > eps && surplusTotal > eps) {
                    deficitRows.forEach(row => {
                        row.regionalReceived = regionalTransfer * (Math.abs(row.netBeforeRegional) / deficitTotal);
                    });
                    surplusRows.forEach(row => {
                        row.regionalPaid = regionalTransfer * (row.netBeforeRegional / surplusTotal);
                    });
                }

                rows.forEach(row => {
                    row.regionalNet = row.regionalReceived - row.regionalPaid;
                    row.netAfterRegional = row.netBeforeRegional + row.regionalNet;
                    row.regionalAppliedToDemand = Math.min(row.demandLoss, row.regionalReceived);
                    row.lossAfterRegional = Math.max(0, row.demandLoss - row.regionalAppliedToDemand);
                    row.domesticComp = Math.min(row.lossAfterRegional, row.domesticWinners);
                    row.lossAfterDomestic = Math.max(0, row.lossAfterRegional - row.domesticComp);
                });

                const externalNeedRows = rows.filter(row => row.lossAfterDomestic > eps);
                const externalPayerRows = rows.filter(row => row.lossAfterDomestic <= eps && row.netAfterRegional > eps);
                const externalNeedTotal = externalNeedRows.reduce((sum, row) => sum + row.lossAfterDomestic, 0);
                const externalAvailableTotal = externalPayerRows.reduce((sum, row) => sum + row.netAfterRegional, 0);
                const externalTopUp = Math.min(externalNeedTotal, externalAvailableTotal);

                if (externalTopUp > eps && externalNeedTotal > eps && externalAvailableTotal > eps) {
                    externalNeedRows.forEach(row => {
                        row.externalTopUpReceived = externalTopUp * (row.lossAfterDomestic / externalNeedTotal);
                    });
                    externalPayerRows.forEach(row => {
                        row.externalTopUpPaid = externalTopUp * (row.netAfterRegional / externalAvailableTotal);
                    });
                }

                rows.forEach(row => {
                    row.demandFinalLoss = Math.max(0, row.lossAfterDomestic - row.externalTopUpReceived);
                    row.netAfterCountry = row.netAfterRegional + row.externalTopUpReceived - row.externalTopUpPaid;
                });

                rows.sort((a, b) => {
                    if (a.isSignatory !== b.isSignatory) return a.isSignatory ? -1 : 1;
                    return b.annualBenefit - a.annualBenefit;
                });

                const signatoryRows = rows.filter(row => row.isSignatory);
                const signatoryRegionalPass = signatoryRows.every(row => row.netAfterRegional >= -eps);
                const signatoryCountryPass = signatoryRows.every(row => row.demandFinalLoss <= eps);
                const requiresExternalTopUp = signatoryRows.some(row => row.externalTopUpReceived > eps || row.externalTopUpPaid > eps);

                return {
                    rows,
                    positiveTotal,
                    deficitTotal,
                    surplusTotal,
                    regionalTransfer,
                    externalTopUp,
                    signatoryRows,
                    signatoryRegionalPass,
                    signatoryCountryPass,
                    requiresExternalTopUp
                };
            };

            const obligatory = buildSettlement(signatoryCountries);
            const shadow = buildSettlement(shadowCountries);
            const obligatoryPass = obligatory.signatoryRegionalPass && obligatory.signatoryCountryPass;
            const shadowPass = shadow.signatoryRegionalPass && shadow.signatoryCountryPass;
            const regionalizationOnly = !obligatoryPass && shadowPass;
            const noViable = !obligatoryPass && !shadowPass;
            const finalClassification = obligatoryPass
                ? 'Viable bilateralmente'
                : (regionalizationOnly ? 'Viable solo con regionalización' : 'No viable económicamente');

            const comparisonRows = [
                {
                    scheme: 'ENTSO-E / CBCA',
                    solves: 'Alinea el residual con beneficios regionales medidos ex ante.',
                    pros: 'Aporta disciplina allocativa y lenguaje técnico común para justificar quién paga.',
                    cons: 'Exige más institucionalidad y más armonización de datos de la que hoy existe en LATAM.'
                },
                {
                    scheme: 'SIEPAC',
                    solves: 'Asegura ingreso regulado y aporta una lógica de estabilización intertemporal.',
                    pros: 'Hace financiables activos estratégicos aun cuando el uso observado es bajo o volátil.',
                    cons: 'No define por sí solo cómo repartir un residual muy asimétrico entre países.'
                },
                {
                    scheme: 'Itaipú / costo de servicio',
                    solves: 'Garantiza recuperación de costos bajo tratado binacional fuerte.',
                    pros: 'Aporta estabilidad de largo plazo para activos singulares de gran escala.',
                    cons: 'Es rígido y no escala bien a una red de múltiples corredores.'
                },
                {
                    scheme: 'SINEA / Colombia-Panamá',
                    solves: 'Muestra factibilidad de avanzar con gobernanza incremental.',
                    pros: 'Es más realista para LATAM que intentar copiar de inmediato el modelo europeo.',
                    cons: 'Todavía no resuelve completamente la remuneración del nuevo CAPEX transfronterizo.'
                },
                {
                    scheme: 'Asia / PPA take-or-pay',
                    solves: 'Cierra financiamiento con contratos previsibles.',
                    pros: 'Recuerda que sin ingresos previsibles no hay bancabilidad.',
                    cons: 'No ofrece una arquitectura regional transparente ni escalable.'
                }
            ];

            const topSpillovers = precomputedLatam && Array.isArray(precomputedLatam.topSpillovers)
                ? precomputedLatam.topSpillovers
                : positiveBenefitRows
                    .filter(row => !signatoryCountries.includes(row.country))
                    .sort((a, b) => b.annualBenefit - a.annualBenefit)
                    .slice(0, 5);

            const renderRegionalRows = (settlement, labelThirdCountries) => settlement.rows.map(row => `
                <tr>
                    <td style="font-weight:700;">${row.country}${row.isSignatory ? ' (firmante)' : labelThirdCountries}</td>
                    <td style="color:${row.annualBenefit >= 0 ? '#15803d' : '#b91c1c'};">${formatSignedMUSD(row.annualBenefit)}</td>
                    <td>${fmtPct(row.cbcaShare)}</td>
                    <td>${fmtMUSD(row.initialCharge)}</td>
                    <td style="color:${row.regionalNet >= 0 ? '#15803d' : '#b91c1c'};">${formatSignedMUSD(row.regionalNet)}</td>
                    <td style="font-weight:700; color:${row.netAfterRegional >= 0 ? '#15803d' : '#b91c1c'};">${formatSignedMUSD(row.netAfterRegional)}</td>
                </tr>
            `).join('');

            const renderDomesticRows = (settlement) => settlement.signatoryRows.map(row => `
                <tr>
                    <td style="font-weight:700;">${row.country}</td>
                    <td style="color:${row.demandLoss > 0 ? '#b91c1c' : '#166534'};">${fmtMUSD(row.demandLoss)}</td>
                    <td>${fmtMUSD(row.regionalAppliedToDemand)}</td>
                    <td>${fmtMUSD(row.domesticComp)}</td>
                    <td style="color:${row.externalTopUpReceived > 0 ? '#0f766e' : '#6b7280'};">${fmtMUSD(row.externalTopUpReceived)}</td>
                    <td style="font-weight:700; color:${row.demandFinalLoss <= eps ? '#15803d' : '#b91c1c'};">${fmtMUSD(row.demandFinalLoss)}</td>
                </tr>
            `).join('');

            contentContainer.innerHTML = `
                <div class="res-card" style="border-top:4px solid #065f46;">
                    <div class="res-card-header" style="background:#064e3b; color:white;">Vista comparada: por qué LATAM pasa a una regla residual CBCA con doble no-loser</div>
                    <div class="res-card-body">
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin-bottom: 20px;">
                            <div class="stat-box" style="background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46;">
                                <div style="font-weight:700; margin-bottom:6px;">Bancabilidad</div>
                                <div style="font-size:0.92em;">SIEPAC aporta la lógica correcta: partir desde un ingreso requerido y no desde una renta de congestión incierta.</div>
                            </div>
                            <div class="stat-box" style="background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8;">
                                <div style="font-weight:700; margin-bottom:6px;">Disciplina allocativa</div>
                                <div style="font-size:0.92em;">Europa aporta el principio beneficiario-paga vía CBCA, pero no su institucionalidad completa.</div>
                            </div>
                            <div class="stat-box" style="background:#fff7ed; border:1px solid #fed7aa; color:#9a3412;">
                                <div style="font-weight:700; margin-bottom:6px;">Aceptabilidad política</div>
                                <div style="font-size:0.92em;">La doble regla no-loser evita que un país firmante o su demanda protegida queden perdedores.</div>
                            </div>
                            <div class="stat-box" style="background:#faf5ff; border:1px solid #e9d5ff; color:#6b21a8;">
                                <div style="font-weight:700; margin-bottom:6px;">Realismo institucional</div>
                                <div style="font-size:0.92em;">La vista obligatoria es bilateral; la vista sombra revela cuándo la línea solo cierra si se internalizan spillovers regionales.</div>
                            </div>
                        </div>

                        <table class="res-table">
                            <thead>
                                <tr>
                                    <th>Esquema</th>
                                    <th>Qué aporta</th>
                                    <th>Ventaja para LATAM</th>
                                    <th>Límite para LATAM</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${comparisonRows.map(row => `
                                    <tr>
                                        <td style="font-weight:700;">${row.scheme}</td>
                                        <td>${row.solves}</td>
                                        <td>${row.pros}</td>
                                        <td>${row.cons}</td>
                                    </tr>
                                `).join('')}
                                <tr style="background:#ecfdf5;">
                                    <td style="font-weight:700; color:#065f46;">LATAM</td>
                                    <td>Residual ex ante + CBCA + no-loser regional + no-loser doméstico + fondo anual.</td>
                                    <td>Es más simple de defender, más trazable en la app y más consistente con la gobernanza fragmentada de LATAM.</td>
                                    <td>Exige información confiable de beneficios y una disciplina clara de liquidación ex ante y ex post.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="res-card">
                    <div class="res-card-header" style="background:#f9fafb;">Supuestos operativos del corredor</div>
                    <div class="res-card-body" style="background:#f9fafb;">
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items:flex-end;">
                            <div><span class="form-label">CAPEX (USD)</span><input type="number" id="latam_capex" class="form-input" value="${capex}"></div>
                            <div><span class="form-label">Vida útil (años)</span><input type="number" id="latam_n" class="form-input" value="${n}"></div>
                            <div><span class="form-label">Tasa anual</span><input type="number" id="latam_r" class="form-input" value="${r}" step="0.01"></div>
                            <div><span class="form-label">O&M frac.</span><input type="number" id="latam_om" class="form-input" value="${om}" step="0.001"></div>
                            <div><span class="form-label">CR esperada (USD/año)</span><input type="number" id="latam_expected_cr" class="form-input" value="${expectedCR}"></div>
                            <div><span class="form-label">IAR realizado (USD/año)</span><input type="number" id="latam_realized_iar" class="form-input" value="${realizedIAR}"></div>
                            <div><span class="form-label">CR realizada (USD/año)</span><input type="number" id="latam_realized_cr" class="form-input" value="${realizedCR}"></div>
                            <div><span class="form-label">Saldo inicial fondo</span><input type="number" id="latam_fund_initial" class="form-input" value="${fundInitial}"></div>
                            <div style="display:flex; justify-content:flex-end; align-items:flex-end;">
                                <button id="latam_recalc" style="padding: 10px 18px; background:#047857; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onmouseover="this.style.background='#065f46'" onmouseout="this.style.background='#047857'">Recalcular</button>
                            </div>
                        </div>
                        <div style="margin-top:12px; padding:12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; color:#1e3a8a; font-size:0.92em;">
                            La regla normativa no depende de pesos arbitrarios. La app usa estos datos para calcular el residual ex ante, la vista bilateral obligatoria, la vista sombra regional y el fondo anual.${precomputedLatam ? ' Esta línea usa una corrida marginal precomputada con y sin el corredor activo.' : ''}
                        </div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div class="stat-box" style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534;">
                        <div style="font-size:0.85em; font-weight:700;">IAR estimado</div>
                        <div style="font-size:1.5rem; font-weight:700;">${fmtMUSD(projectedIar)}</div>
                        <div style="font-size:0.85em;">MUSD/año</div>
                    </div>
                    <div class="stat-box" style="background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8;">
                        <div style="font-size:0.85em; font-weight:700;">CR esperada</div>
                        <div style="font-size:1.5rem; font-weight:700;">${fmtMUSD(expectedCR)}</div>
                        <div style="font-size:0.85em;">Modelada S1: ${fmtMUSD(modeledCR)} MUSD/año</div>
                    </div>
                    <div class="stat-box" style="background:#fff7ed; border:1px solid #fed7aa; color:#9a3412;">
                        <div style="font-size:0.85em; font-weight:700;">Residual ex ante</div>
                        <div style="font-size:1.5rem; font-weight:700;">${fmtMUSD(projectedResidual)}</div>
                        <div style="font-size:0.85em;">IAR̂ - CR̂</div>
                    </div>
                    <div class="stat-box" style="background:#faf5ff; border:1px solid #e9d5ff; color:#6b21a8;">
                        <div style="font-size:0.85em; font-weight:700;">Clasificación final</div>
                        <div style="font-size:1.2rem; font-weight:700;">${finalClassification}</div>
                        <div style="font-size:0.85em;">Uso observado: ${fmtPct(useFraction)}</div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 24px;">
                    ${statusCard('Cumple no-loser regional', obligatory.signatoryRegionalPass)}
                    ${statusCard('Cumple no-loser country', obligatory.signatoryCountryPass)}
                    ${statusCard('Requiere top-up externo', obligatory.requiresExternalTopUp, 'Sí', 'No', 'warning')}
                    ${statusCard('Viable solo con regionalización', regionalizationOnly, 'Sí', 'No', 'warning')}
                    ${statusCard('No viable', noViable, 'Sí', 'No', 'danger')}
                </div>

                <div class="res-card" style="border-top: 4px solid #0f766e;">
                    <div class="res-card-header">Vista obligatoria: CBCA entre firmantes y no-loser regional</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <thead>
                                <tr>
                                    <th>País</th>
                                    <th>Beneficio país</th>
                                    <th>Share CBCA</th>
                                    <th>Cargo inicial</th>
                                    <th>Transferencia regional neta</th>
                                    <th>Saldo post-regional</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderRegionalRows(obligatory, '')}
                            </tbody>
                        </table>
                        <div style="margin-top:16px; padding:12px; background:${obligatoryPass ? '#ecfdf5' : '#fff7ed'}; border:1px solid ${obligatoryPass ? '#86efac' : '#fdba74'}; border-radius:6px; color:${obligatoryPass ? '#166534' : '#9a3412'};">
                            <strong>Lectura bilateral:</strong>
                            ${obligatoryPass
                                ? `la vista obligatoria entre ${signatoryCountries.join(' y ')} cierra con un residual de ${fmtMUSD(projectedResidual)} MUSD/año y cumple la regla no-loser regional.`
                                : `la vista obligatoria no alcanza a cerrar completamente la regla no-loser para los firmantes con el residual de ${fmtMUSD(projectedResidual)} MUSD/año.`}
                        </div>
                    </div>
                </div>

                <div class="res-card" style="border-top: 4px solid #7c3aed;">
                    <div class="res-card-header">Vista doméstica: demanda protegida, compensación local y top-up externo</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <thead>
                                <tr>
                                    <th>País firmante</th>
                                    <th>Pérdida demanda protegida</th>
                                    <th>Cubierto por transferencia regional</th>
                                    <th>Cubierto por generadores locales</th>
                                    <th>Top-up externo</th>
                                    <th>Pérdida final demanda</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderDomesticRows(obligatory)}
                            </tbody>
                        </table>
                        <div style="margin-top:16px; padding:12px; background:${obligatory.signatoryCountryPass ? '#ecfdf5' : '#fff7ed'}; border:1px solid ${obligatory.signatoryCountryPass ? '#86efac' : '#fdba74'}; border-radius:6px; color:${obligatory.signatoryCountryPass ? '#166534' : '#9a3412'};">
                            <strong>Lectura doméstica:</strong>
                            ${obligatory.signatoryCountryPass
                                ? `la demanda protegida de los firmantes queda neutralizada bajo la cascada regional -> generadores locales -> top-up externo.`
                                : `aún queda demanda protegida no compensada en la vista obligatoria, por lo que la línea no cumple completamente la regla no-loser country.`}
                        </div>
                    </div>
                </div>

                <div class="res-card" style="border-top: 4px solid #1d4ed8;">
                    <div class="res-card-header">Vista sombra regional: spillovers positivos y cierre ampliado</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <thead>
                                <tr>
                                    <th>País</th>
                                    <th>Beneficio país</th>
                                    <th>Share CBCA</th>
                                    <th>Cargo inicial</th>
                                    <th>Transferencia regional neta</th>
                                    <th>Saldo post-regional</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderRegionalRows(shadow, ' (spillover)')}
                            </tbody>
                        </table>
                        <div style="margin-top:16px; display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
                            <div class="res-note-card">
                                <strong>Firmantes del corredor:</strong><br>${signatoryCountries.join(', ')}
                            </div>
                            <div class="res-note-card">
                                <strong>Spillovers positivos fuera del eje físico:</strong><br>${topSpillovers.length > 0 ? topSpillovers.map(row => row.country).join(', ') : 'No relevantes en esta corrida'}
                            </div>
                            <div class="res-note-card">
                                <strong>Diagnóstico:</strong><br>${regionalizationOnly ? 'La línea solo cierra si se regionalizan beneficios de terceros.' : (shadowPass ? 'La regionalización confirma que los spillovers mejoran el cierre del corredor.' : 'Ni la vista ampliada logra cerrar completamente el corredor.')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="res-card" style="border-top: 4px solid #92400e;">
                    <div class="res-card-header">Fondo anual de compensación</div>
                    <div class="res-card-body">
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 16px;">
                            <div class="stat-box" style="background:#fffbeb; border:1px solid #fde68a; color:#92400e;">
                                <div style="font-size:0.82em; font-weight:700;">Residual proyectado</div>
                                <div style="font-size:1.4rem; font-weight:700;">${fmtMUSD(projectedResidual)}</div>
                                <div style="font-size:0.82em;">MUSD/año</div>
                            </div>
                            <div class="stat-box" style="background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8;">
                                <div style="font-size:0.82em; font-weight:700;">Residual realizado</div>
                                <div style="font-size:1.4rem; font-weight:700;">${fmtMUSD(realizedResidual)}</div>
                                <div style="font-size:0.82em;">MUSD/año</div>
                            </div>
                            <div class="stat-box" style="background:${fundDelta >= 0 ? '#ecfdf5' : '#fff7ed'}; border:1px solid ${fundDelta >= 0 ? '#86efac' : '#fdba74'}; color:${fundDelta >= 0 ? '#166534' : '#9a3412'};">
                                <div style="font-size:0.82em; font-weight:700;">Variación del fondo</div>
                                <div style="font-size:1.4rem; font-weight:700;">${formatSignedMUSD(fundDelta)}</div>
                                <div style="font-size:0.82em;">$\u0394F = R̂ - R$</div>
                            </div>
                            <div class="stat-box" style="background:${uncoveredShortfall > eps ? '#fee2e2' : '#f0fdf4'}; border:1px solid ${uncoveredShortfall > eps ? '#fca5a5' : '#bbf7d0'}; color:${uncoveredShortfall > eps ? '#991b1b' : '#166534'};">
                                <div style="font-size:0.82em; font-weight:700;">Saldo final / faltante</div>
                                <div style="font-size:1.2rem; font-weight:700;">${uncoveredShortfall > eps ? `${fmtMUSD(uncoveredShortfall)} MUSD faltantes` : `${fmtMUSD(fundFinal)} MUSD`}</div>
                                <div style="font-size:0.82em;">${uncoveredShortfall > eps ? 'Requiere liquidación regional extraordinaria' : 'Saldo remanente del fondo'}</div>
                            </div>
                        </div>
                        <div style="padding:12px; background:${uncoveredShortfall > eps ? '#fff7ed' : '#ecfdf5'}; border:1px solid ${uncoveredShortfall > eps ? '#fdba74' : '#86efac'}; border-radius:6px; color:${uncoveredShortfall > eps ? '#9a3412' : '#166534'};">
                            <strong>Regla del fondo:</strong>
                            ${uncoveredShortfall > eps
                                ? `el fondo no alcanza para absorber completamente la diferencia entre residual proyectado y residual realizado. El faltante debe pasar a liquidación regional extraordinaria bajo la asignación vigente del corredor.`
                                : `el fondo absorbe la diferencia entre residual proyectado y realizado sin necesidad de reabrir toda la asignación regional.`}
                        </div>
                    </div>
                </div>
            `;

            const latamRecalc = document.getElementById('latam_recalc');
            if (latamRecalc) {
                const readInputNumber = (id, fallback = null) => {
                    const element = document.getElementById(id);
                    const num = Number(element ? element.value : fallback);
                    return Number.isFinite(num) ? num : fallback;
                };

                latamRecalc.onclick = () => {
                    latamInputs.capex_usd = readInputNumber('latam_capex', capex);
                    latamInputs.life_years = readInputNumber('latam_n', n);
                    latamInputs.r_annual = readInputNumber('latam_r', r);
                    latamInputs.om_frac_annual = readInputNumber('latam_om', om);
                    latamInputs.expected_cr_usd = readInputNumber('latam_expected_cr', expectedCR);
                    latamInputs.realized_iar_usd = readInputNumber('latam_realized_iar', realizedIAR);
                    latamInputs.realized_cr_usd = readInputNumber('latam_realized_cr', realizedCR);
                    latamInputs.fund_initial_usd = readInputNumber('latam_fund_initial', fundInitial);
                    renderLatam();
                };
            }
        } catch (err) {
            console.error("Error in renderLatam:", err);
            contentContainer.innerHTML = `<div style="padding:20px; color:#dc2626; background:#fee2e2; border-radius:8px;">
                <strong>Error en Metodología LATAM HÍBRIDO:</strong> ${err.message}
            </div>`;
        }
    }

    // ==========================================================
    // TAB 4: SIEPAC METHODOLOGY
    // ==========================================================
    function renderSiepac() {
        console.log("--- renderSiepac Start ---");
        console.log("siepacInputs:", JSON.stringify(siepacInputs));

        const formatExpost = (val) => val != null && !isNaN(val) ? (siepacExpostMUSD ? (val / 1000000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '-';
        let capex = siepacInputs.capex; let r = siepacInputs.r_annual; let n = siepacInputs.life_years; let om = siepacInputs.om_frac_annual;
        let pow_ = Math.pow(1 + r, n); let A_annuity = r > 0 ? (capex * (r * pow_) / (pow_ - 1)) : (capex / n);
        let IAR_annual = A_annuity + (capex * om);

        let ir_raw = (IAR_annual / 2) + (siepacInputs.SCF_USD - siepacInputs.SCE_USD) - siepacInputs.CVTn_sem_USD - siepacInputs.IVDT_USD;
        let ir = Math.max(0, ir_raw);

        console.log("IR Calculation Detalle:", {
            IAR_annual: IAR_annual,
            IAR_sem: IAR_annual / 2,
            SCF: siepacInputs.SCF_USD,
            SCE: siepacInputs.SCE_USD,
            CVTn: siepacInputs.CVTn_sem_USD,
            IVDT: siepacInputs.IVDT_USD,
            ir_raw: ir_raw,
            ir: ir
        });

        const fullFlows = globalData.flowS1.flows && globalData.flowS1.flows[lineName] ? globalData.flowS1.flows[lineName] : [];
        let halfCount = Math.floor(fullFlows.length / 2);

        let conFlows = [];
        if (siepacInputs.selected_semester === 2) {
            conFlows = fullFlows.slice(halfCount);
        } else {
            conFlows = fullFlows.slice(0, halfCount);
        }

        let F = conFlows.length > 0 ? (conFlows.reduce((a, b) => a + b, 0) / conFlows.length) : 0;
        let sum_abs_f = 0;
        let sum_pos_f = 0;
        let sum_neg_f = 0;
        let num_periods = conFlows.length > 0 ? conFlows.length : 1;
        if (conFlows.length > 0) {
            for (let f of conFlows) {
                sum_abs_f += Math.abs(f);
                if (f > 0) sum_pos_f += f;
                else if (f < 0) sum_neg_f += Math.abs(f);
            }
        }

        let division_horas = fullFlows.length > 0 ? (8760 / fullFlows.length) : 100;
        let capacity = siepacInputs.line_capacity_MW || 8000;
        let sum_abs_f_MWh = sum_abs_f * division_horas; // Conversión real a MWh

        // Recalculate Fracción de Uso based on semester-specific flows
        let uso = 0;
        if (conFlows.length > 0) {
            uso = sum_abs_f / (capacity * conFlows.length);
            uso = Math.min(uso, 1.0);
        }

        let P = ir * uso; // Uso Charge
        let CC = ir * (1 - uso); // Complementary Charge
        let MR = P + CC; // Total required to be compensated

        let hours_semester = division_horas * conFlows.length;
        let aR = siepacInputs.alpha_R; let aI = siepacInputs.alpha_I;
        let MR_allocated = MR * aR; let MI_allocated = MR * aI;

        // País Exportador o Importador basado en F Neto Promedio
        let expC = F >= 0 ? globalData.expCountry : globalData.impCountry;
        let impC = F >= 0 ? globalData.impCountry : globalData.expCountry;

        // Renta Congestion S1 y S0 (que siempre es 0 asumo)
        let CR_CON = siepacInputs.CVTn_sem_USD;

        const calculateExPostSIEPAC = (isCon) => {
            let statsE = getCountryStats(expC, isCon ? globalData.genS1 : globalData.genS0, isCon ? globalData.demS1 : globalData.demS0);
            let statsI = getCountryStats(impC, isCon ? globalData.genS1 : globalData.genS0, isCon ? globalData.demS1 : globalData.demS0);

            let fraction_year = hours_semester / 8760;
            let Rc_sem_E = (statsE.demandMW || 1) * fraction_year;
            let Ig_sem_E = (statsE.prod || 1) * fraction_year;
            let Rc_sem_I = (statsI.demandMW || 1) * fraction_year;
            let Ig_sem_I = (statsI.prod || 1) * fraction_year;

            let curtrc_exp = Rc_sem_E > 0 ? MR_allocated / Rc_sem_E : 0;
            let curtrg_exp = Ig_sem_E > 0 ? MI_allocated / Ig_sem_E : 0;
            let curtrc_imp = Rc_sem_I > 0 ? MR_allocated / Rc_sem_I : 0;
            let curtrg_imp = Ig_sem_I > 0 ? MI_allocated / Ig_sem_I : 0;

            // Valores anuales directos tomados del output del modelo
            let op_cost_h_e = statsE.opCost;
            let op_cost_h_i = statsI.opCost;
            let profit_h_e = statsE.genProfit;
            let profit_h_i = statsI.genProfit;
            let demand_cost_h_e = statsE.demandCost;
            let demand_cost_h_i = statsI.demandCost;

            let ratio_anualizacion = 8760 / hours_semester; // Convertir lo semestral a anual
            let peaje_iny_exp_USD = (isCon ? curtrg_exp * sum_abs_f_MWh : 0) * ratio_anualizacion;
            let peaje_ret_imp_USD = (isCon ? curtrc_imp * sum_abs_f_MWh : 0) * ratio_anualizacion;

            let CR_abs = (isCon ? CR_CON : 0) * ratio_anualizacion;

            const ben_soc_exp = op_cost_h_e + peaje_iny_exp_USD;
            const ben_soc_imp = op_cost_h_i + peaje_ret_imp_USD;

            const ben_gen_exp = profit_h_e - peaje_iny_exp_USD + CR_abs * aI;
            const ben_gen_imp = profit_h_i;

            const cos_dem_exp = demand_cost_h_e;
            const cos_dem_imp = demand_cost_h_i + peaje_ret_imp_USD - CR_abs * aR;

            return {
                ben_soc_exp, ben_soc_imp,
                ben_gen_exp, ben_gen_imp,
                cos_dem_exp, cos_dem_imp,
                peaje_iny_exp_USD, peaje_ret_imp_USD,
                curtrc_exp, curtrg_exp, curtrc_imp, curtrg_imp,
                op_cost_h_e, op_cost_h_i,
                profit_h_e, profit_h_i,
                demand_cost_h_e, demand_cost_h_i,
                CR_abs
            };
        };

        const conData = calculateExPostSIEPAC(true);
        const sinData = calculateExPostSIEPAC(false);

        // Deltas
        let deltaBsE = conData.ben_soc_exp - sinData.ben_soc_exp;
        let deltaBsI = conData.ben_soc_imp - sinData.ben_soc_imp;
        let deltaBgE = conData.ben_gen_exp - sinData.ben_gen_exp;
        let deltaBgI = conData.ben_gen_imp - sinData.ben_gen_imp;
        let deltaCdE = conData.cos_dem_exp - sinData.cos_dem_exp;
        let deltaCdI = conData.cos_dem_imp - sinData.cos_dem_imp;

        let targetIsExp = siepacTargetCountry === expC;
        let target_curtrc = targetIsExp ? conData.curtrc_exp : conData.curtrc_imp;
        let target_curtrg = targetIsExp ? conData.curtrg_exp : conData.curtrg_imp;
        let target_stats = getCountryStats(siepacTargetCountry, globalData.genS1, globalData.demS1);
        let isTargetNodeA = (siepacTargetCountry === expCountry);
        let export_target_MWh = isTargetNodeA ? (sum_pos_f * division_horas) : (sum_neg_f * division_horas);
        let import_target_MWh = isTargetNodeA ? (sum_neg_f * division_horas) : (sum_pos_f * division_horas);

        let curtrc_calc_text = formatCur(MR_allocated) + ' / ' + formatNum(import_target_MWh || 1) + ' MWh';
        let curtrg_calc_text = formatCur(MI_allocated) + ' / ' + formatNum(export_target_MWh || 1) + ' MWh';

        target_curtrc = import_target_MWh > 0 ? MR_allocated / import_target_MWh : 0;
        target_curtrg = export_target_MWh > 0 ? MI_allocated / export_target_MWh : 0;

        contentContainer.innerHTML = `
                <div class="res-card">
                <div class="res-card-header" style="background:#7c2d12; color:white;">Configuración Semestral Central Americana (SIEPAC)</div>
                <div class="res-card-body" style="background:#f9fafb;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items:flex-end;">
                        <div style="flex:1; min-width: 150px">
                            <span class="form-label">País Objetivo</span>
                            <select id="sie_country" class="form-input">
                                <option value="${expCountry}" ${siepacTargetCountry === expCountry ? 'selected' : ''}>Exp: ${expCountry}</option>
                                <option value="${impCountry}" ${siepacTargetCountry === impCountry ? 'selected' : ''}>Imp: ${impCountry}</option>
                            </select>
                        </div>
                        <div style="flex:1; min-width: 130px"><span class="form-label" title="Capital Expenditure: costo total de inversión de la línea de interconexión en dólares.">CAPEX (USD) ℹ️</span><input type="number" id="sie_capex" class="form-input" value="${siepacInputs.capex}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label" title="Vida útil del proyecto en años. Usado para calcular el Factor de Recuperación de Capital (CRF) y la anualidad del CAPEX.">Años Vida (n) ℹ️</span><input type="number" id="sie_n" class="form-input" value="${siepacInputs.life_years}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label" title="Tasa de retorno anual regulada. Se usa para calcular el CRF: r·(1+r)^n / ((1+r)^n - 1) y determinar el cargo anual de transmisión.">Tasa Ret. (r) ℹ️</span><input type="number" id="sie_r" class="form-input" value="${siepacInputs.r_annual}" step="0.01"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label" title="Fracción anual del CAPEX destinada a Operación y Mantenimiento. Ej: 0.02 = 2% del CAPEX por año.">O&M Frac. ℹ️</span><input type="number" id="sie_om" class="form-input" value="${siepacInputs.om_frac_annual}" step="0.001"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label" title="Ponderador de retiro: fracción del cargo de transmisión asignada proporcionalmente al retiro de potencia (demanda) en cada nodo. Alpha_R + Alpha_I = 1.">Alpha R (Ret) ℹ️</span><input type="number" id="sie_alphaR" class="form-input" value="${siepacInputs.alpha_R}" step="0.01"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label" title="Ponderador de inyección: fracción del cargo de transmisión asignada proporcionalmente a la inyección de potencia (generación) en cada nodo. Alpha_R + Alpha_I = 1.">Alpha I (Iny) ℹ️</span><input type="number" id="sie_alphaI" class="form-input" value="${siepacInputs.alpha_I}" step="0.01"></div>

                        <div style="flex:1; min-width: 130px">
                            <span class="form-label" title="Semestre de liquidación para el cálculo del Cargo Variable de Transmisión (CVT). Los cargos se calculan semestralmente según la normativa SIEPAC.">Semestre ℹ️</span>
                            <select id="sie_sem_select" class="form-input">
                                <option value="1" ${siepacInputs.selected_semester === 1 ? 'selected' : ''}>1er Semestre</option>
                                <option value="2" ${siepacInputs.selected_semester === 2 ? 'selected' : ''}>2do Semestre</option>
                            </select>
                        </div>

                        <div style="flex:1; min-width: 120px"><span class="form-label" title="Cargo Variable de Transmisión semestral en USD. Componente variable del peaje de transmisión regional SIEPAC, calculado por semestre.">CVT Semestral ($) ℹ️</span><input type="number" id="sie_cvt" class="form-input" value="${siepacInputs.CVTn_sem_USD}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label" title="Servicio Complementario de Frecuencia: cargo por servicios de regulación de frecuencia provistos por generadores en el sistema regional.">SCF ($) ℹ️</span><input type="number" id="sie_scf" class="form-input" value="${siepacInputs.SCF_USD}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label" title="Servicio Complementario de Emergencia: cargo por reservas de emergencia y respaldo de potencia en el sistema regional SIEPAC.">SCE ($) ℹ️</span><input type="number" id="sie_sce" class="form-input" value="${siepacInputs.SCE_USD}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label" title="Ingreso Variable de Derechos de Transmisión: ingreso por derechos financieros de transmisión asociados a la congestión en la línea regional.">IVDT ($) ℹ️</span><input type="number" id="sie_ivdt" class="form-input" value="${siepacInputs.IVDT_USD}"></div>
                        <div style="flex: 100%; text-align: right; margin-top: 10px;">
                            <button id="sie_recalc" style="padding: 10px 24px; background:#eab308; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onmouseover="this.style.background='#ca8a04'" onmouseout="this.style.background='#eab308'">Recalcular SIEPAC</button>
                        </div>
                    </div>
                </div>
            </div>

            

            <div style="display: flex; gap: 20px;">
                <div class="res-card" style="flex:1; border-top: 4px solid #eab308;">
                    <div class="res-card-header">Peajes, Rentas y CURTR Semestral</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <tr style="background:#fefce8;"><td style="font-weight:bold; color:#854d0e;">${createTooltipHTML('Ingreso Req Semestre (IR):', 'Ingreso Requerido Asignable del semestre a reportar, deduciendo otros ingresos y balances de periodos pasados. Si es negativo, se asume cero.', 'MAX(0, (IAR / 2) + SCF - SCE - CVTn - IVDT)')}</td><td align="right" style="font-weight:bold; color:#854d0e; font-size:1.1em">${createTooltipHTML(formatCur(ir), 'Detalle del cálculo', 'Max(0, ' + formatCur(ir_raw) + ') = Max(0, (' + formatCur(IAR_annual) + ' / 2) + ' + formatCur(siepacInputs.SCF_USD) + ' - ' + formatCur(siepacInputs.SCE_USD) + ' - ' + formatCur(siepacInputs.CVTn_sem_USD) + ' - ' + formatCur(siepacInputs.IVDT_USD) + ')', 'right')}</td></tr>
                            <tr><td>${createTooltipHTML('Fracción de Uso:', 'Proporción promedio del uso absoluto de la línea frente a su capacidad nominal', 'Σ |Flujo| / (Capacidad * Horas)')}</td><td align="right; font-weight:bold">${createTooltipHTML(Number((uso || 0)).toFixed(4), 'Detalle del cálculo', formatNum(sum_abs_f_MWh) + ' MWh / (' + formatNum(capacity) + ' MW * ' + (num_periods * division_horas) + ' h)', 'right')}</td></tr>
                            <tr><td>${createTooltipHTML('CARGO POR USO (P):', 'Beneficio o Pago derivado proporcionalmente del uso estricto y útil transmitido por el enlace.', 'IR_Semestral * Fracción_De_Uso')}</td><td align="right; font-weight:bold">${createTooltipHTML(formatCur(P), 'Detalle del cálculo', formatCur(ir) + ' * ' + Number((uso || 0)).toFixed(4), 'right')}</td></tr>
                            <tr><td>${createTooltipHTML('CARGO COMPL. (CC):', 'Pago por soporte y confiabilidad sistémica para el cubrimiento de la porción de inversión sub-utilizada.', 'IR_Semestral * (1 - Fracción_De_Uso)')}</td><td align="right; font-weight:bold">${createTooltipHTML(formatCur(CC), 'Detalle del cálculo', formatCur(ir) + ' * (1 - ' + Number((uso || 0)).toFixed(4) + ')', 'right')}</td></tr>
                            <tr style="background:#fbfccb;"><td style="font-weight:bold;">${createTooltipHTML('Total Peaje a Asignar (P+CC):', 'Suma del Cargo por Uso y el Cargo Complementario.', 'Peaje + Cargo_Complementario')}</td><td align="right" style="font-weight:bold;">${createTooltipHTML(formatCur(MR), 'Detalle del cálculo', formatCur(P) + ' + ' + formatCur(CC), 'right')}</td></tr>
                            <tr><td>${createTooltipHTML('MR (Asig. a Retiros):', 'Monto a Recuperar correspondiente al sector de la Demanda.', 'Total_Peaje * alpha_R')}</td><td align="right">${createTooltipHTML(formatCur(MR_allocated), 'Detalle del cálculo', formatCur(MR) + ' * ' + aR, 'right')}</td></tr>
                            <tr><td>${createTooltipHTML('MI (Asig. a Inyecciones):', 'Monto a Recuperar correspondiente al sector de Generación.', 'Total_Peaje * alpha_I')}</td><td align="right">${createTooltipHTML(formatCur(MI_allocated), 'Detalle del cálculo', formatCur(MR) + ' * ' + aI, 'right')}</td></tr>
                            <tr style="background:#f4f4f5;"><td style="font-weight:bold;">${createTooltipHTML(`Exportación (${siepacTargetCountry})`, 'Flujo total de energía exportada por este país a través de la línea.', 'Suma de flujos exportados * 100')}</td><td align="right">${createTooltipHTML(formatNum(export_target_MWh) + ' MWh', 'Detalle', isTargetNodeA ? 'Suma de flujos positivos * 100' : 'Suma absoluta de flujos negativos * 100', 'right')}</td></tr>
                            <tr style="background:#f4f4f5;"><td style="font-weight:bold;">${createTooltipHTML(`Importación (${siepacTargetCountry})`, 'Flujo total de energía importada por este país a través de la línea.', 'Suma de flujos importados * 100')}</td><td align="right">${createTooltipHTML(formatNum(import_target_MWh) + ' MWh', 'Detalle', isTargetNodeA ? 'Suma absoluta de flujos negativos * 100' : 'Suma de flujos positivos * 100', 'right')}</td></tr>
                            <tr style="background:#f8fafc;"><td style="font-weight:bold;">${createTooltipHTML(`CURTR C (${siepacTargetCountry})`, `Cargo Unitario por Retiros de Transmisión Regional asignado a la Demanda.`, 'MR_Asignado / Importacion_País_MWh')}</td><td align="right">${createTooltipHTML(formatCur(target_curtrc) + ' /MWh', 'Detalle del cálculo', curtrc_calc_text, 'right')}</td></tr>
                            <tr style="background:#f8fafc;"><td style="font-weight:bold;">${createTooltipHTML(`CURTR G (${siepacTargetCountry})`, `Cargo Unitario por Inyecciones de Transmisión Regional asignado a Generación.`, 'MI_Asignado / Exportacion_País_MWh')}</td><td align="right">${createTooltipHTML(formatCur(target_curtrg) + ' /MWh', 'Detalle del cálculo', curtrg_calc_text, 'right')}</td></tr>
                            <tr style="background:#eff6ff;"><td style="font-weight:bold; color:#1d4ed8;">${createTooltipHTML('Renta Congestión Total (Semestral)', 'Dinero recolectado en el periodo debido a la diferencia de los precios y de los flujos de la línea', 'Σ |Flujo| * (LMP_Imp - LMP_Exp)')}</td><td align="right; font-weight:bold; color:#1d4ed8;">${createTooltipHTML(formatCur(CR_CON), 'Detalle del cálculo', 'Diferencial de Precios Locacionales * Flujos Horarios', 'right')}</td></tr>
                            <tr style="font-size: 0.9em; color: #64748b;"><td style="padding-left: 20px;">└─ Renta 1er Semestre:</td><td align="right">${formatCur(siepacInputs.CVTn_s1_USD || 0)}</td></tr>
                            <tr style="font-size: 0.9em; color: #64748b;"><td style="padding-left: 20px;">└─ Renta 2do Semestre:</td><td align="right">${formatCur(siepacInputs.CVTn_s2_USD || 0)}</td></tr>
                            <tr style="font-size: 0.9em; color: #64748b; font-weight: bold; border-top: 1px dashed #cbd5e1;"><td style="padding-left: 20px;">└─ Renta Anual Total:</td><td align="right">${formatCur((siepacInputs.CVTn_s1_USD || 0) + (siepacInputs.CVTn_s2_USD || 0))}</td></tr>
                        </table>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin-bottom: 0; font-size: 1.25rem; font-weight: 600; color: #1e3a8a;">Análisis Adicional: 3 Modelos Ex-Post Anuales</h3>
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <span style="font-size:0.9em; font-weight:bold; color: #1e3a8a;">Mostrar en:</span>
                        <select id="sie_expost_unit" style="padding:4px; font-weight:bold; cursor:pointer; color: #1e3a8a; border: 1px solid #93c5fd; border-radius: 4px;" onchange="siepacExpostMUSD = this.value === 'MUSD'; document.getElementById('sie_recalc').click();">
                            <option value="MUSD" ${siepacExpostMUSD ? 'selected' : ''}>MUSD</option>
                            <option value="USD" ${!siepacExpostMUSD ? 'selected' : ''}>USD</option>
                        </select>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 16px;">
                    
                    <!-- CASO SIN -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #9ca3af;">
                        <div class="res-card-header" style="background: #f3f4f6;">${createTooltipHTML('1. Caso Base (SIN)', 'Situación del país considerando que no opera ninguna interconexión transfronteriza y atiende la demanda aisladamente', 'Flujo de Línea (F) = 0')}</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica Anual</th><th style="padding: 8px 12px; font-size: 0.8em;">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;">Imp: ${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Operación País</td><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(sinData.ben_soc_exp), 'Costo Operación', formatCur(sinData.op_cost_h_e) + ' (OpCost)', 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(sinData.ben_soc_imp), 'Costo Operación', formatCur(sinData.op_cost_h_i) + ' (OpCost)', 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Beneficio Generador País</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(sinData.ben_gen_exp), 'Beneficio Generador', formatCur(sinData.profit_h_e) + ' (Profit)', 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(sinData.ben_gen_imp), 'Beneficio Generador', formatCur(sinData.profit_h_i) + ' (Profit)', 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Demanda País</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(sinData.cos_dem_exp), 'Costo Demanda', formatCur(sinData.demand_cost_h_e) + ' (DemCost)', 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(sinData.cos_dem_imp), 'Costo Demanda', formatCur(sinData.demand_cost_h_i) + ' (DemCost)', 'right')}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- CASO CON -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #3b82f6;">
                        <div class="res-card-header" style="background: #eff6ff; color: #1e3a8a;">${createTooltipHTML('2. Caso Interconectado (CON)', 'Situación del país despachado regionalmente y considerando su asignación correspondiente de rentas y peajes de la línea de transmisión', 'F(CON) + Peajes ExPost + Δ Rentas')}</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica Anual</th><th style="padding: 8px 12px; font-size: 0.8em;">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;">Imp: ${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Operación + Peaje</td><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(conData.ben_soc_exp), 'Costo Operación + PeajeIny', formatCur(conData.op_cost_h_e) + ' + ' + formatCur(conData.peaje_iny_exp_USD), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(conData.ben_soc_imp), 'Costo Operación + PeajeRet', formatCur(conData.op_cost_h_i) + ' + ' + formatCur(conData.peaje_ret_imp_USD), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Ben Gen + Renta - Peaje</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(conData.ben_gen_exp), 'Profit - PeajeIny + Renta(aI)', formatCur(conData.profit_h_e) + ' - ' + formatCur(conData.peaje_iny_exp_USD) + ' + ' + formatCur(conData.CR_abs * aI), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(conData.ben_gen_imp), 'Profit (sin asignación)', formatCur(conData.profit_h_i), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Demanda + Peaje - Renta</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(conData.cos_dem_exp), 'Demanda (sin asignación)', formatCur(conData.demand_cost_h_e), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(conData.cos_dem_imp), 'Demanda + PeajeRet - Renta(aR)', formatCur(conData.demand_cost_h_i) + ' + ' + formatCur(conData.peaje_ret_imp_USD) + ' - ' + formatCur(conData.CR_abs * aR), 'right')}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- DELTAS -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #8b5cf6;">
                        <div class="res-card-header" style="background: #f5f3ff; color: #4c1d95;">${createTooltipHTML('3. Ganadores y perdedores (Δ)', 'Diferencial neto del beneficio/coste entre los escenarios con interconexión frente al aislamiento', 'Valor CON vs Valor SIN')}</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica Anual ${siepacExpostMUSD ? '(MUSD)' : '(USD)'}</th><th style="padding: 8px 12px; font-size: 0.8em;">Exp: ${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;">Imp: ${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Operación</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBsE < 0 ? 'bold' : 'normal'}; color:${deltaBsE < 0 ? '#16a34a' : '#ef4444'}">${deltaBsE < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaBsE) + ')', 'Δ Costo (CON - SIN)', formatExpost(conData.ben_soc_exp) + ' - ' + formatExpost(sinData.ben_soc_exp), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBsI < 0 ? 'bold' : 'normal'}; color:${deltaBsI < 0 ? '#16a34a' : '#ef4444'}">${deltaBsI < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaBsI) + ')', 'Δ Costo (CON - SIN)', formatExpost(conData.ben_soc_imp) + ' - ' + formatExpost(sinData.ben_soc_imp), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Beneficio Generador</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBgE > 0 ? 'bold' : 'normal'}; color:${deltaBgE > 0 ? '#16a34a' : '#ef4444'}">${deltaBgE > 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaBgE) + ')', 'Δ Beneficio (CON - SIN)', formatExpost(conData.ben_gen_exp) + ' - ' + formatExpost(sinData.ben_gen_exp), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBgI > 0 ? 'bold' : 'normal'}; color:${deltaBgI > 0 ? '#16a34a' : '#ef4444'}">${deltaBgI > 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaBgI) + ')', 'Δ Beneficio (CON - SIN)', formatExpost(conData.ben_gen_imp) + ' - ' + formatExpost(sinData.ben_gen_imp), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Demanda</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaCdE < 0 ? 'bold' : 'normal'}; color:${deltaCdE < 0 ? '#16a34a' : '#ef4444'}">${deltaCdE < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaCdE) + ')', 'Δ Costo (CON - SIN)', formatExpost(conData.cos_dem_exp) + ' - ' + formatExpost(sinData.cos_dem_exp), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaCdI < 0 ? 'bold' : 'normal'}; color:${deltaCdI < 0 ? '#16a34a' : '#ef4444'}">${deltaCdI < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatExpost(deltaCdI) + ')', 'Δ Costo (CON - SIN)', formatExpost(conData.cos_dem_imp) + ' - ' + formatExpost(sinData.cos_dem_imp), 'right')}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            `;

        document.getElementById('sie_recalc').onclick = () => {
            siepacTargetCountry = document.getElementById('sie_country').value;
            siepacInputs.capex = Number(document.getElementById('sie_capex').value);
            siepacInputs.life_years = Number(document.getElementById('sie_n').value);
            siepacInputs.r_annual = Number(document.getElementById('sie_r').value);
            siepacInputs.om_frac_annual = Number(document.getElementById('sie_om').value);
            siepacInputs.alpha_R = Number(document.getElementById('sie_alphaR').value);
            siepacInputs.alpha_I = Number(document.getElementById('sie_alphaI').value);
            siepacInputs.CVTn_sem_USD = Number(document.getElementById('sie_cvt').value);
            siepacInputs.SCF_USD = Number(document.getElementById('sie_scf').value);
            siepacInputs.SCE_USD = Number(document.getElementById('sie_sce').value);
            siepacInputs.IVDT_USD = Number(document.getElementById('sie_ivdt').value);
            siepacInputs.selected_semester = Number(document.getElementById('sie_sem_select').value);

            console.log("On Recalc Click:", {
                captured_CVTn: siepacInputs.CVTn_sem_USD,
                semester_id: siepacInputs.selected_semester
            });

            renderSiepac();
        };

        const sieSemSelect = document.getElementById('sie_sem_select');
        if (sieSemSelect) {
            sieSemSelect.onchange = (e) => {
                let sem = Number(e.target.value);
                siepacInputs.selected_semester = sem;
                if (sem === 1) document.getElementById('sie_cvt').value = siepacInputs.CVTn_s1_USD;
                else if (sem === 2) document.getElementById('sie_cvt').value = siepacInputs.CVTn_s2_USD;
                document.getElementById('sie_recalc').click();
            };
        }
    }

}
