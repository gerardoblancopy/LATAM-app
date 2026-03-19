import sys

js_code = """
// Function to load and display Methodology Results (Cost-Benefit Analysis) for a specific line
async function showMethodologyResults(lineName) {
    if (!lineName) return;

    const modalId = 'methodology-results-modal';
    let modal = createModal(modalId, 2100); // High z-index to be on top

    modal.innerHTML = '';
    modal.style.width = '95%';
    modal.style.maxWidth = '1200px';
    modal.style.height = '90vh';
    modal.style.overflowY = 'auto';
    modal.style.padding = '0';
    modal.style.backgroundColor = '#f8f9fa';

    // Header
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background-color: white;
        border-bottom: 1px solid #e5e7eb;
        position: sticky;
        top: 0;
        z-index: 10;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = `Resultados de Metodología - Línea: ${lineName}`;
    title.style.cssText = "margin: 0; font-size: 1.5rem; color: #1f2937; font-weight: 600;";

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #6b7280;
        line-height: 1; padding: 0 5px; border-radius: 4px;
    `;
    closeBtn.onmouseover = () => closeBtn.style.backgroundColor = '#f3f4f6';
    closeBtn.onmouseout = () => closeBtn.style.backgroundColor = 'transparent';
    closeBtn.onclick = () => modal.style.display = 'none';

    headerContainer.appendChild(title);
    headerContainer.appendChild(closeBtn);
    modal.appendChild(headerContainer);

    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = "padding: 20px;";
    contentContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">Cargando y procesando datos (S0 y S1)... <br> <span style="font-size: 2rem;">&#8987;</span></div>';
    modal.appendChild(contentContainer);

    // Close other modals if open
    ['energy-chart-modal', 'flow-chart-modal', 'gen-chart-modal', 'mc-chart-modal', 'tx-investment-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });

    modal.style.display = 'flex';

    // Helper functions for fetching and processing
    const fetchJson = async (url) => {
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
    };

    try {
        // Fetch all required data in parallel
        const [genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1] = await Promise.all([
            fetchJson('/api/generators?scenario=S0'),
            fetchJson('/api/generators?scenario=S1'),
            fetchJson('/api/demand?scenario=S0'),
            fetchJson('/api/demand?scenario=S1'),
            fetchJson('/api/flows?scenario=S0'),
            fetchJson('/api/flows?scenario=S1'),
            fetchJson('/api/marginal-costs?scenario=S0'),
            fetchJson('/api/marginal-costs?scenario=S1')
        ]);

        if (!genS0 || !genS1 || !demS0 || !demS1 || !flowS1 || !mcS0 || !mcS1) {
            throw new Error("No se pudo cargar la data completa para S0 o S1. Asegúrese de correr ambos escenarios.");
        }

        // We target BO and BR since the line is BO_ESTE -> BR_SUDESTE/CO
        const targetCountries = ['BO', 'BR'];

        // Aggregate data per country
        const aggregateData = (genData, demData) => {
            const result = {};
            targetCountries.forEach(country => {
                let genProfit = 0;
                let genRevenue = 0;
                let varCost = 0;
                let prod = 0;
                let cap = 0;

                if (genData[country]) {
                    genData[country].forEach(g => {
                        genProfit += (g.profit || 0);
                        genRevenue += (g.rev || 0);
                        varCost += (g.total_var_cost || 0);
                        prod += (g.prod || 0);
                        cap += (g.capmax || 0) + (g.inv_pot_MW || 0);
                    });
                }

                let demandCost = 0;
                let demandMW = 0;
                if (demData[country]) {
                    demData[country].forEach(d => {
                        demandCost += (d.demand_cost || 0);
                        demandMW += (d.demand || 0);
                    });
                }

                result[country] = {
                    genProfit, genRevenue, varCost, prod, cap,
                    demandCost, demandMW,
                    payTotal: demandCost,
                    revTotal: genRevenue
                };
            });
            return result;
        };

        const sinTotals = aggregateData(genS0, demS0);
        const conTotals = aggregateData(genS1, demS1);

        // Calculate Delta values
        const deltaTable = targetCountries.map(country => {
            const sin = sinTotals[country];
            const con = conTotals[country];
            const deltaProfitGen = con.genProfit - sin.genProfit;
            const ahorroDem = sin.demandCost - con.demandCost;
            const netoAgentes = deltaProfitGen + ahorroDem;
            
            return {
                country,
                deltaProfitGen,
                ahorroDem,
                netoAgentes,
                sin, con
            };
        });

        // Determine winners and losers
        let winnerNet = deltaTable[0];
        let loserNet = deltaTable[0];
        
        deltaTable.forEach(row => {
            if (row.netoAgentes > winnerNet.netoAgentes) winnerNet = row;
            if (row.netoAgentes < loserNet.netoAgentes) loserNet = row;
        });

        // Calculate Congestion Rent for S1
        let congestionRentS1 = 0;
        let lmpFrom = [];
        let lmpTo = [];

        // Try to find the line from the list to get nodes
        // Alternatively, since we know it's BO_ESTE -> BR_SUDESTE/CO:
        const parsedNodes = lineName.split(' --> ');
        if (parsedNodes.length === 2 && flowS1.flows && flowS1.flows[lineName]) {
            const fromNodeName = parsedNodes[0].trim();
            const toNodeName = parsedNodes[1].trim();
            
            // LMPs are mapped by country, then node.
            // Search globally
            const findNodeLMPs = (mcData, nodeName) => {
                for (const cntry in mcData.countries) {
                    if (mcData.countries[cntry][nodeName]) {
                        return mcData.countries[cntry][nodeName];
                    }
                }
                return null;
            };

            lmpFrom = findNodeLMPs(mcS1, fromNodeName);
            lmpTo = findNodeLMPs(mcS1, toNodeName);
            const lineFlows = flowS1.flows[lineName];

            if (lmpFrom && lmpTo && lineFlows) {
                for (let i = 0; i < lineFlows.length; i++) {
                    const lmpF = lmpFrom[i] || 0;
                    const lmpT = lmpTo[i] || 0;
                    const f = lineFlows[i] || 0;
                    congestionRentS1 += f * (lmpT - lmpF);
                }
            }
        }

        // Format Utilities
        const formatCur = (val) => val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
        const formatNum = (val) => val != null ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

        // Render HTML
        contentContainer.innerHTML = `
            <style>
                .res-card { background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); margin-bottom: 24px; overflow: hidden; }
                .res-card-header { padding: 16px 20px; font-weight: 600; font-size: 1.1rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }
                .res-card-body { padding: 20px; }
                .res-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
                .res-table th { background-color: #f9fafb; padding: 12px 16px; color: #4b5563; font-weight: 500; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
                .res-table td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #1f2937; }
                .res-table tr:hover { background-color: #f9fafb; }
                .stat-box { padding: 16px; border-radius: 6px; flex: 1; min-width: 200px; }
                .stat-title { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
                .stat-value { font-size: 1.5rem; font-weight: 700; }
                .stat-sub { font-size: 0.85rem; margin-top: 4px; opacity: 0.9; }
            </style>

            <!-- Delta Analysis -->
            <div class="res-card" style="border-top: 4px solid #6366f1;">
                <div class="res-card-header" style="background-color: #fefefe;">
                    <span>🏆 Winners vs Losers (CON - SIN)</span>
                </div>
                <div class="res-card-body">
                    <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
                        <div class="stat-box" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;">
                            <div class="stat-title">Best Scenario (Winner)</div>
                            <div class="stat-value">${winnerNet.country}</div>
                            <div class="stat-sub">Net Benefit: ${formatCur(winnerNet.netoAgentes)}</div>
                        </div>
                        <div class="stat-box" style="background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b;">
                            <div class="stat-title">Worst Scenario (Loser)</div>
                            <div class="stat-value">${loserNet.country}</div>
                            <div class="stat-sub">Net Benefit: ${formatCur(loserNet.netoAgentes)}</div>
                        </div>
                    </div>

                    <div style="overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
                        <table class="res-table">
                            <thead>
                                <tr>
                                    <th>Country</th>
                                    <th>Δ Gen Profit (CON-SIN)</th>
                                    <th>Δ Dem Savings (SIN-CON)</th>
                                    <th>Net Benefit</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${deltaTable.map(row => `
                                    <tr>
                                        <td style="font-weight: 500;">${row.country}</td>
                                        <td>${formatCur(row.deltaProfitGen)}</td>
                                        <td>${formatCur(row.ahorroDem)}</td>
                                        <td style="font-weight: bold; color: ${row.netoAgentes >= 0 ? '#15803d' : '#b91c1c'};">${formatCur(row.netoAgentes)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="margin-top: 16px; padding: 12px 16px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; color: #1e3a8a; font-size: 0.9rem;">
                        <span style="font-weight: 600;">Δ Congestion Rent (System):</span> ${formatCur(congestionRentS1)} <span style="opacity: 0.8;">(Not assigned to agents)</span>
                    </div>
                </div>
            </div>

            <!-- Detailed Results CON -->
            <div class="res-card">
                <div class="res-card-header bg-gray-50">
                    Detailed Results (CON Case - Connected S1)
                </div>
                <div class="res-card-body">
                    <h3 style="font-size: 1rem; color: #374151; margin-bottom: 12px; font-weight: 600;">Generator & Demand Totals by Country</h3>
                    <div style="overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
                        <table class="res-table">
                            <thead>
                                <tr>
                                    <th>Country</th>
                                    <th>Total Capacity (MW)</th>
                                    <th>Total Gen Prod (MWh)</th>
                                    <th>Gen Revenue</th>
                                    <th>Total Var Cost</th>
                                    <th>Total Profit</th>
                                    <th>Demand (MWh)</th>
                                    <th>Demand Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${deltaTable.map(row => `
                                    <tr>
                                        <td style="font-weight: 500;">${row.country}</td>
                                        <td>${formatNum(row.con.cap)}</td>
                                        <td>${formatNum(row.con.prod)}</td>
                                        <td>${formatCur(row.con.genRevenue)}</td>
                                        <td>${formatCur(row.con.varCost)}</td>
                                        <td style="font-weight: bold; color: #15803d;">${formatCur(row.con.genProfit)}</td>
                                        <td>${formatNum(row.con.demandMW)}</td>
                                        <td>${formatCur(row.con.demandCost)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Detailed Results SIN -->
            <div class="res-card">
                <div class="res-card-header bg-gray-50">
                    Detailed Results (SIN Case - Isolated S0)
                </div>
                <div class="res-card-body">
                    <h3 style="font-size: 1rem; color: #374151; margin-bottom: 12px; font-weight: 600;">Generator & Demand Totals by Country</h3>
                    <div style="overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 6px;">
                        <table class="res-table">
                            <thead>
                                <tr>
                                    <th>Country</th>
                                    <th>Total Capacity (MW)</th>
                                    <th>Total Gen Prod (MWh)</th>
                                    <th>Gen Revenue</th>
                                    <th>Total Var Cost</th>
                                    <th>Total Profit</th>
                                    <th>Demand (MWh)</th>
                                    <th>Demand Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${deltaTable.map(row => `
                                    <tr>
                                        <td style="font-weight: 500;">${row.country}</td>
                                        <td>${formatNum(row.sin.cap)}</td>
                                        <td>${formatNum(row.sin.prod)}</td>
                                        <td>${formatCur(row.sin.genRevenue)}</td>
                                        <td>${formatCur(row.sin.varCost)}</td>
                                        <td style="font-weight: bold; color: #15803d;">${formatCur(row.sin.genProfit)}</td>
                                        <td>${formatNum(row.sin.demandMW)}</td>
                                        <td>${formatCur(row.sin.demandCost)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        contentContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #dc2626;">Error cargando datos: ${e.message}</div>`;
        console.error(e);
    }
}
"""

with open(r'public\chart_helper.js', 'a', encoding='utf-8') as f:
    f.write(js_code)

print("Function appended successfully")
