const fs = require('fs');
const path = require('path');

const jsCode = `
// Helper functions for Tooltips and Formatting
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
                    <!-- css arrow handles the rest via global styles below -->
                </div>
            \` : ''}
        </div>
    \`;
};

// Main function to load and display Methodology Results for a specific line
async function showMethodologyResults(lineName) {
    if (!lineName) return;

    const modalId = 'methodology-results-modal';
    let modal = createModal(modalId, 2100);

    modal.innerHTML = '';
    modal.style.width = '95%';
    modal.style.maxWidth = '1300px';
    modal.style.height = '90vh';
    modal.style.overflowY = 'auto';
    modal.style.padding = '0';
    modal.style.backgroundColor = '#f8f9fa';

    // Helper Styles for Tooltip Hover (since React uses group-hover)
    const styleBlock = document.createElement('style');
    styleBlock.innerHTML = \`
        .tooltip-container:hover .tooltip-content { display: block !important; }
        .res-card { background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom: 24px; overflow: hidden; border: 1px solid #e5e7eb; }
        .res-card-header { padding: 16px 20px; font-weight: 600; font-size: 1.1rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 8px; background-color: #f9fafb; color: #1f2937; }
        .res-card-body { padding: 20px; }
        .res-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
        .res-table th { background-color: #f3f4f6; padding: 12px 16px; color: #374151; font-weight: 600; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
        .res-table td { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; color: #1f2937; }
        .res-table tr:hover { background-color: #f9fafb; }
        .stat-box { padding: 16px; border-radius: 6px; flex: 1; min-width: 200px; }
        .form-input { width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem; appearance: none; }
        .form-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
        .form-label { display: block; font-size: 0.8rem; font-weight: 600; color: #4b5563; margin-bottom: 6px; }
        .tab-btn { padding: 12px 24px; font-weight: 600; font-size: 1rem; border-bottom: 3px solid transparent; cursor: pointer; color: #6b7280; background: none; border-top: none; border-left: none; border-right: none; transition: all 0.2s; }
        .tab-btn:hover { color: #1f2937; }
        .tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }
    \`;
    modal.appendChild(styleBlock);

    // Header Structure
    const headerContainer = document.createElement('div');
    headerContainer.style.cssText = \`display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background-color: white; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.1);\`;
    const title = document.createElement('h2');
    title.textContent = \`Resultados de Metodologías - Línea: \${lineName}\`;
    title.style.cssText = "margin: 0; font-size: 1.5rem; color: #1f2937; font-weight: 600;";
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = "background: none; border: none; font-size: 1.8rem; cursor: pointer; color: #6b7280; line-height: 1; padding: 0 5px; border-radius: 4px;";
    closeBtn.onclick = () => modal.style.display = 'none';
    headerContainer.appendChild(title);
    headerContainer.appendChild(closeBtn);
    modal.appendChild(headerContainer);

    // Tabs Nav
    const tabsContainer = document.createElement('div');
    tabsContainer.style.cssText = "display: flex; background: white; border-bottom: 1px solid #e5e7eb; padding: 0 20px;";
    modal.appendChild(tabsContainer);

    // Content Area
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = "padding: 20px;";
    contentContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #6b7280;">Cargando y procesando datos (S0 y S1)... <br> <span style="font-size: 2rem;">⏳</span></div>';
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

    // ----- STATE FOR TABS -----
    // ASIA STATE
    let asiaInputs = { capex_usd: 939644790.0, life_years: 25, r_annual: 0.06, om_frac_annual: 0.015, hours_year: 8760 };
    let asiaMilesLine = 100;
    let asiaMwMileRule = 'importer_pays';
    let asiaProjectToYear = false;
    let asiaExpostMethod = 'stamp';
    
    // EUROPA STATE
    let europaInputs = { itc_rate_usd_per_mwh: 0.50, cid_split: 0.50, infra_fund_usd_per_hour: 0.0, infra_split_ft: 0.75, infra_split_fl: 0.25 };
    let europaExpostMethod = 'A1';

    // SIEPAC STATE
    let siepacInputs = { capex: 939644790.0, life_years: 25, r_annual: 0.06, om_frac_annual: 0.015, CVTn_sem_USD: 0.0, SCF_USD: 0.0, SCE_USD: 0.0, IVDT_USD: 0.0, alpha_R: 0.50, alpha_I: 0.50 };
    let siepacTargetCountry = expCountry; // default

    // Fetch and Process Logic
    try {
        const fetchJson = async (url) => { const res = await fetch(url); return res.ok ? res.json() : null; };
        
        let targetScenario = (document.getElementById('visualize-scenario') ? document.getElementById('visualize-scenario').value : 'S1');
        if(targetScenario !== 'S1') {
            console.warn("Using S1 as the default CON scenario, user selected: " + targetScenario);
        }

        const [genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1] = await Promise.all([
            fetchJson('/api/generators?scenario=S0'), fetchJson('/api/generators?scenario=S1'),
            fetchJson('/api/demand?scenario=S0'), fetchJson('/api/demand?scenario=S1'),
            fetchJson('/api/flows?scenario=S0'), fetchJson('/api/flows?scenario=S1'),
            fetchJson('/api/marginal-costs?scenario=S0'), fetchJson('/api/marginal-costs?scenario=S1')
        ]);

        if (!genS1 || !demS1 || !flowS1 || !mcS1) throw new Error("Datos incompletos para el caso base o S1.");

        globalData = { genS0, genS1, demS0, demS1, flowS0, flowS1, mcS0, mcS1 };
        
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

        renderTabs();

    } catch (e) {
        contentContainer.innerHTML = \`<div style="text-align: center; padding: 40px; color: #dc2626;">Error cargando datos: \${e.message}</div>\`;
        console.error(e);
    }

    // --- TAB RENDERING LOGIC ---

    function renderTabs() {
        const tabs = ['Resumen_General', 'ASIA', 'EUROPA', 'SIEPAC'];
        let activeTab = 'Resumen_General'; // Default

        const renderNav = () => {
            tabsContainer.innerHTML = '';
            tabs.forEach(t => {
                const btn = document.createElement('button');
                btn.className = \`tab-btn \${activeTab === t ? 'active' : ''}\`;
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
            for (const cntry in d.countries) { if (d.countries[cntry][nName]) return d.countries[cntry][nName]; }
            return null;
        };
        lmpFrom = findNodeLMPs(mcData, fromN);
        lmpTo = findNodeLMPs(mcData, toN);
        const lFlows = flowData[lName] || (flowData.flows && flowData.flows[lName]) || [];
        
        if (lmpFrom && lmpTo && lFlows.length > 0) {
            for (let i = 0; i < lFlows.length; i++) {
                const lmpF = lmpFrom[i] || 0; const lmpT = lmpTo[i] || 0; const f = lFlows[i] || 0;
                rent += f * (lmpT - lmpF);
            }
        }
        return rent;
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
            const ahorroDem = sin.demandCost - con.demandCost;
            const netoAgentes = deltaProfitGen + ahorroDem;
            return { country, deltaProfitGen, ahorroDem, netoAgentes, sin, con };
        });

        let winnerNet = deltaTable[0]; let loserNet = deltaTable[0];
        deltaTable.forEach(row => {
            if (row.netoAgentes > winnerNet.netoAgentes) winnerNet = row;
            if (row.netoAgentes < loserNet.netoAgentes) loserNet = row;
        });

        const congestionRentS1 = calculateCongestionRentLocally(globalData.mcS1, globalData.flowS1, expNode, impNode, lineName);

        contentContainer.innerHTML = \`
            <div class="res-card" style="border-top: 4px solid #6366f1;">
                <div class="res-card-header"><span>🏆 Ganadores vs Perdedores (CON - SIN)</span></div>
                <div class="res-card-body">
                    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                        <div class="stat-box" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;">
                            <div class="stat-title">Mejor Escenario (Ganador)</div>
                            <div style="font-size: 1.5rem; font-weight: 700;">\${winnerNet.country}</div>
                            <div style="font-size: 0.85rem;">Beneficio Neto: \${formatCur(winnerNet.netoAgentes)}</div>
                        </div>
                        <div class="stat-box" style="background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b;">
                            <div class="stat-title">Peor Escenario (Perdedor)</div>
                            <div style="font-size: 1.5rem; font-weight: 700;">\${loserNet.country}</div>
                            <div style="font-size: 0.85rem;">Beneficio Neto: \${formatCur(loserNet.netoAgentes)}</div>
                        </div>
                    </div>
                    <table class="res-table">
                        <thead><tr><th>País</th><th>Δ Profit Gen (CON-SIN)</th><th>Δ Ahorro Dem (SIN-CON)</th><th>Beneficio Neto</th></tr></thead>
                        <tbody>\${deltaTable.map(r => \`
                            <tr><td>\${r.country}</td><td>\${formatCur(r.deltaProfitGen)}</td><td>\${formatCur(r.ahorroDem)}</td>
                            <td style="font-weight: bold; color: \${r.netoAgentes >= 0 ? '#15803d' : '#b91c1c'}">\${formatCur(r.netoAgentes)}</td></tr>\`).join('')}
                        </tbody>
                    </table>
                    <div style="margin-top: 16px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; color: #1e3a8a;">
                        <strong>Δ Renta Congestión (Línea):</strong> \${formatCur(congestionRentS1)} <span style="opacity:0.8">(No asignado a agentes aquí)</span>
                    </div>
                </div>
            </div>
            
            <div class="res-card">
                <div class="res-card-header">Detalle Ex-Post (CON - Conectado S1)</div>
                <div class="res-card-body">
                    <table class="res-table">
                        <thead><tr><th>País</th><th>Capacidad (MW)</th><th>Generación (MWh)</th><th>Revenue Gen</th><th>Costo Var</th><th>Profit Gen</th><th>Demanda (MWh)</th><th>Costo Demanda</th></tr></thead>
                        <tbody>\${deltaTable.map(r => \`
                            <tr><td>\${r.country}</td><td>\${formatNum(r.con.cap)}</td><td>\${formatNum(r.con.prod)}</td>
                            <td>\${formatCur(r.con.genRevenue)}</td><td>\${formatCur(r.con.varCost)}</td>
                            <td style="font-weight:bold; color:#15803d">\${formatCur(r.con.genProfit)}</td>
                            <td>\${formatNum(r.con.demandMW)}</td><td>\${formatCur(r.con.demandCost)}</td></tr>\`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        \`;
    }

    // ==========================================================
    // TAB 2: ASIA METHODOLOGY
    // ==========================================================
    function renderAsia() {
        const targetCountries = [globalData.expCountry, globalData.impCountry];
        const conFlows = globalData.flowS1.flows && globalData.flowS1.flows[lineName] ? globalData.flowS1.flows[lineName] : [];
        let totalFlowS1 = conFlows.reduce((a, b) => a + b, 0);
        let averageFlowS1 = conFlows.length > 0 ? (totalFlowS1 / conFlows.length) : 0;
        
        let selF = Math.abs(averageFlowS1); // Hourly average flow

        // Finances
        let r = asiaInputs.r_annual; let n = asiaInputs.life_years; let capex = asiaInputs.capex_usd;
        let om = asiaInputs.om_frac_annual; let h = asiaInputs.hours_year;
        let pow_ = Math.pow(1 + r, n);
        let factor = pow_ / (pow_ - 1);
        let annuity = capex * factor;
        let arr = annuity + (capex * om);
        let rr_h = h > 0 ? arr / h : 0;

        let hoursMultiplier = asiaProjectToYear ? h : 1;
        let target_rr = asiaProjectToYear ? arr : rr_h;

        // Demands from S1
        let demFr = getCountryStats(globalData.expCountry, globalData.genS1, globalData.demS1).demandMW * hoursMultiplier;
        let demTo = getCountryStats(globalData.impCountry, globalData.genS1, globalData.demS1).demandMW * hoursMultiplier;
        let totalDem = demFr + demTo;
        let stamp_tariff = totalDem > 0 ? target_rr / totalDem : 0;

        let stamp_pay_country = {
            [globalData.expCountry]: demFr * stamp_tariff,
            [globalData.impCountry]: demTo * stamp_tariff
        };

        let selF_Mult = selF * hoursMultiplier;
        let selL = asiaMilesLine;
        let mwm_unit = (selF_Mult > 0 && selL > 0) ? target_rr / (selF_Mult * selL) : 0;
        let selCost = (selF_Mult > 0 && selL > 0) ? target_rr : 0;

        let mwm_pay_country = { [globalData.expCountry]: 0, [globalData.impCountry]: 0 };
        // Assuming Exp -> Imp based on total flow > 0
        let expC = totalFlowS1 >= 0 ? globalData.expCountry : globalData.impCountry;
        let impC = totalFlowS1 >= 0 ? globalData.impCountry : globalData.expCountry;

        if (selCost > 0) {
            if (asiaMwMileRule === 'importer_pays') mwm_pay_country[impC] = selCost;
            else if (asiaMwMileRule === 'exporter_pays') mwm_pay_country[expC] = selCost;
            else if (asiaMwMileRule === 'split_50_50') { mwm_pay_country[expC] = selCost * 0.5; mwm_pay_country[impC] = selCost * 0.5; }
        }

        // Evaluate Net EX POST Models
        const calculateExPostASIA = (isCon, method) => {
            let statsE = getCountryStats(expC, isCon ? globalData.genS1 : globalData.genS0, isCon ? globalData.demS1 : globalData.demS0);
            let statsI = getCountryStats(impC, isCon ? globalData.genS1 : globalData.genS0, isCon ? globalData.demS1 : globalData.demS0);
            
            // Adjust stats by hoursMultiplier roughly
            let mOpE = statsE.opCost * hoursMultiplier; let mOpI = statsI.opCost * hoursMultiplier;
            let mPrE = statsE.genProfit * hoursMultiplier; let mPrI = statsI.genProfit * hoursMultiplier;
            let mDmE = statsE.demandCost * hoursMultiplier; let mDmI = statsI.demandCost * hoursMultiplier;

            let peE = 0, peI = 0;
            if (isCon) {
                peE = method === 'stamp' ? stamp_pay_country[expC] : mwm_pay_country[expC];
                peI = method === 'stamp' ? stamp_pay_country[impC] : mwm_pay_country[impC];
            }

            let crE = 0, crI = 0; // Rent assigned (assuming simplified here for ASIA: half to each or exporter)
            if (isCon) { let rent = calculateCongestionRentLocally(globalData.mcS1, globalData.flowS1, expNode, impNode, lineName) * hoursMultiplier; crE = rent * 0.5; crI = rent * 0.5; }

            return {
                bsE: mOpE + peE, bsI: mOpI + peI,
                bgE: mPrE + crE - peE, bgI: mPrI + crI - peI,
                cdE: mDmE + peE, cdI: mDmI + peI,
                pE: peE, pI: peI
            };
        };

        const conData = calculateExPostASIA(true, asiaExpostMethod);
        const sinData = calculateExPostASIA(false, asiaExpostMethod);

        let deltaBsE = conData.bsE - sinData.bsE; let deltaBsI = conData.bsI - sinData.bsI;
        let deltaBgE = conData.bgE - sinData.bgE; let deltaBgI = conData.bgI - sinData.bgI;
        let deltaCdE = conData.cdE - sinData.cdE; let deltaCdI = conData.cdI - sinData.cdI;

        contentContainer.innerHTML = \`
            <div class="res-card">
                <div class="res-card-header" style="background:#1e3a8a; color:white;">Configuración Financiera (ASIA)</div>
                <div class="res-card-body" style="background:#f9fafb;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items:center;">
                        <div style="flex:1"><span class="form-label">CAPEX (USD)</span><input type="number" id="asia_capex" class="form-input" value="\${asiaInputs.capex_usd}"></div>
                        <div style="flex:1"><span class="form-label">Años</span><input type="number" id="asia_n" class="form-input" value="\${asiaInputs.life_years}"></div>
                        <div style="flex:1"><span class="form-label">Tasa (r)</span><input type="number" id="asia_r" class="form-input" value="\${asiaInputs.r_annual}" step="0.01"></div>
                        <div style="flex:1"><span class="form-label">O&M Frac</span><input type="number" id="asia_om" class="form-input" value="\${asiaInputs.om_frac_annual}" step="0.01"></div>
                        <div style="flex:1"><span class="form-label">Millas Carga</span><input type="number" id="asia_miles" class="form-input" value="\${asiaMilesLine}"></div>
                        
                        <div style="flex:1"><span class="form-label">Regla MW-Mile</span><select id="asia_rule" class="form-input">
                            <option value="importer_pays" \${asiaMwMileRule==='importer_pays'?'selected':''}>Importador Paga</option>
                            <option value="exporter_pays" \${asiaMwMileRule==='exporter_pays'?'selected':''}>Exportador Paga</option>
                            <option value="split_50_50" \${asiaMwMileRule==='split_50_50'?'selected':''}>50% / 50%</option>
                        </select></div>
                        <div style="flex:1"><span class="form-label">Método Análisis</span><select id="asia_method" class="form-input">
                            <option value="stamp" \${asiaExpostMethod==='stamp'?'selected':''}>Sello Postal</option>
                            <option value="mwm" \${asiaExpostMethod==='mwm'?'selected':''}>MW-Mile</option>
                        </select></div>
                        <label style="display:flex; align-items:center; gap:5px; font-size:13px; font-weight:bold; height:100%;">
                            <input type="checkbox" id="asia_ptoyear" \${asiaProjectToYear?'checked':''}> Anualizado
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
                            <tr><td>Anualidad CAPEX:</td><td align="right" style="font-weight:bold">\${formatCur(annuity)} /año</td></tr>
                            <tr><td>ARR (Req Anual Completo):</td><td align="right" style="font-weight:bold">\${formatCur(arr)} /año</td></tr>
                            <tr style="background:#e0e7ff;"><td style="color:#1e40af; font-weight:bold;">RR Objetivo (Base):</td><td align="right" style="font-weight:bold; color:#1e40af">\${formatCur(target_rr)} \${asiaProjectToYear?'/año':'/hora'}</td></tr>
                            <tr><td>Tarifa Stamp:</td><td align="right">\${formatCur(stamp_tariff)} /MWh</td></tr>
                            <tr><td>Asignación País (Stamp):</td><td align="right">\${expC}: \${formatCur(stamp_pay_country[expC])} <br> \${impC}: \${formatCur(stamp_pay_country[impC])}</td></tr>
                            <tr><td>Tarifa MW-Mile Unitaria:</td><td align="right">\${formatCur(mwm_unit)} /MW-Mile</td></tr>
                            <tr><td>Asignación País (MW-Mile):</td><td align="right">\${expC}: \${formatCur(mwm_pay_country[expC])} <br> \${impC}: \${formatCur(mwm_pay_country[impC])}</td></tr>
                        </table>
                    </div>
                </div>

                <div class="res-card" style="flex: 1.5; border-top: 4px solid #8b5cf6;">
                    <div class="res-card-header">Ganadores y Perdedores por País (Método Activo: \${asiaExpostMethod.toUpperCase()})</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <thead style="background:#f5f3ff;"><tr><th>Variación Ex-Post (Δ CON - SIN)</th><th>Exp: \${expC}</th><th>Imp: \${impC}</th></tr></thead>
                            <tbody>
                                <tr>
                                    <td>\${createTooltipHTML('1. Costo Operación (Δ)', 'Reducción en el costo (CON < SIN) = Ganador')}</td>
                                    <td><span style="color:\${deltaBsE < 0 ? '#16a34a' : '#ef4444'}; font-weight:\${deltaBsE < 0 ? 'bold':'normal'}">\${deltaBsE < 0 ? 'Ganador':'Perdedor'} (\${formatCur(-deltaBsE)})</span></td>
                                    <td><span style="color:\${deltaBsI < 0 ? '#16a34a' : '#ef4444'}; font-weight:\${deltaBsI < 0 ? 'bold':'normal'}">\${deltaBsI < 0 ? 'Ganador':'Perdedor'} (\${formatCur(-deltaBsI)})</span></td>
                                </tr>
                                <tr>
                                    <td>\${createTooltipHTML('2. Beneficio Generador (Δ)', 'Aumento en el beneficio (CON > SIN) = Ganador')}</td>
                                    <td><span style="color:\${deltaBgE > 0 ? '#16a34a' : '#ef4444'}; font-weight:\${deltaBgE > 0 ? 'bold':'normal'}">\${deltaBgE > 0 ? 'Ganador':'Perdedor'} (+\${formatCur(deltaBgE)})</span></td>
                                    <td><span style="color:\${deltaBgI > 0 ? '#16a34a' : '#ef4444'}; font-weight:\${deltaBgI > 0 ? 'bold':'normal'}">\${deltaBgI > 0 ? 'Ganador':'Perdedor'} (+\${formatCur(deltaBgI)})</span></td>
                                </tr>
                                <tr>
                                    <td>\${createTooltipHTML('3. Costo Demanda (Δ)', 'Reducción de costo de demanda (CON < SIN) = Ganador')}</td>
                                    <td><span style="color:\${deltaCdE < 0 ? '#16a34a' : '#ef4444'}; font-weight:\${deltaCdE < 0 ? 'bold':'normal'}">\${deltaCdE < 0 ? 'Ganador':'Perdedor'} (\${formatCur(-deltaCdE)})</span></td>
                                    <td><span style="color:\${deltaCdI < 0 ? '#16a34a' : '#ef4444'}; font-weight:\${deltaCdI < 0 ? 'bold':'normal'}">\${deltaCdI < 0 ? 'Ganador':'Perdedor'} (\${formatCur(-deltaCdI)})</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        \`;

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

    // ==========================================================
    // TAB 3: EUROPA METHODOLOGY (ENTSO-E)
    // ==========================================================
    function renderEuropa() {
        const conFlows = globalData.flowS1.flows && globalData.flowS1.flows[lineName] ? globalData.flowS1.flows[lineName] : [];
        let totalFlowS1 = conFlows.reduce((a, b) => a + b, 0);
        let selF = Math.abs(conFlows.length > 0 ? (totalFlowS1 / conFlows.length) : 0);

        let expC = totalFlowS1 >= 0 ? globalData.expCountry : globalData.impCountry;
        let impC = totalFlowS1 >= 0 ? globalData.impCountry : globalData.expCountry;

        // Simplify ITC/CID logic using parameters
        let rate = europaInputs.itc_rate_usd_per_mwh;
        let cid_split = europaInputs.cid_split;

        let nf_exp = selF; let nf_imp = selF; // Net flow simplified for line
        let t_exp = 0; let t_imp = 0; // Transit
        let itc_pay_e = nf_exp * rate; let itc_pay_i = nf_imp * rate;

        let rent = calculateCongestionRentLocally(globalData.mcS1, globalData.flowS1, expNode, impNode, lineName);
        let cid_e = rent * cid_split; let cid_i = rent * (1 - cid_split);

        let fund = europaInputs.infra_fund_usd_per_hour;
        let itc_inc_e = fund * 0.5; let itc_inc_i = fund * 0.5; // Stubbed split for infra fund

        let set_e = cid_e + itc_inc_e - itc_pay_e;
        let set_i = cid_i + itc_inc_i - itc_pay_i;

        // Ex-post models
        let tau_e = 0; let tau_i = 0;
        let peajeChargeE = 0; let peajeChargeI = 0;
        let rentAdjE = 0; let rentAdjI = 0;

        if (europaExpostMethod === 'A1') {
            peajeChargeE = itc_pay_e; peajeChargeI = itc_pay_i;
            rentAdjE = cid_e; rentAdjI = cid_i;
        } else {
            peajeChargeE = itc_pay_e - cid_e; peajeChargeI = itc_pay_i - cid_i;
        }

        tau_e = nf_exp > 0 ? peajeChargeE / nf_exp : 0;
        tau_i = nf_imp > 0 ? peajeChargeI / nf_imp : 0;

        let statsE = getCountryStats(expC, globalData.genS1, globalData.demS1);
        let statsI = getCountryStats(impC, globalData.genS1, globalData.demS1);

        let bsE = statsE.opCost + peajeChargeE; let bsI = statsI.opCost + peajeChargeI;
        let bgE = statsE.genProfit - itc_pay_e + rentAdjE; let bgI = statsI.genProfit - itc_pay_i + rentAdjI;
        let cdE = statsE.demandCost + peajeChargeE; let cdI = statsI.demandCost + peajeChargeI;

        contentContainer.innerHTML = \`
            <div class="res-card">
                <div class="res-card-header" style="background:#064e3b; color:white;">Configuración ENTSO-E (EUROPA)</div>
                <div class="res-card-body" style="background:#f9fafb;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items:flex-end;">
                        <div style="flex:1"><span class="form-label">Rate ITC ($/MWh)</span><input type="number" id="eur_itc" class="form-input" value="\${europaInputs.itc_rate_usd_per_mwh}" step="0.01"></div>
                        <div style="flex:1"><span class="form-label">CID Split (0-1)</span><input type="number" id="eur_cid" class="form-input" value="\${europaInputs.cid_split}" step="0.01"></div>
                        <div style="flex:1"><span class="form-label">Fondo Infra ($/h)</span><input type="number" id="eur_fund" class="form-input" value="\${europaInputs.infra_fund_usd_per_hour}"></div>
                        <div style="flex:1"><span class="form-label">Cálculo Ex-Post</span><select id="eur_opt" class="form-input">
                            <option value="A1" \${europaExpostMethod==='A1'?'selected':''}>Opción A1 (ITC Pay)</option>
                            <option value="A2" \${europaExpostMethod==='A2'?'selected':''}>Opción A2 (Peaje Neto (ITC-CID))</option>
                        </select></div>
                        <button id="eur_recalc" style="padding: 10px 16px; background:#10b981; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; height:36px;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">Aplicar</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 20px;">
                <div class="res-card" style="flex: 1.5; border-top: 4px solid #10b981;">
                    <div class="res-card-header">Liquidación TSO (Cálculos Centralizados ITC/CID)</div>
                    <div class="res-card-body">
                        <table class="res-table text-right">
                            <thead><tr>
                                <th style="text-align:left;">TSO País</th><th>Flujo Neto (NF)</th><th>Pago ITC</th><th>Ingreso CID</th><th>Ingreso Infra</th><th>Liq. Final Ex-Post</th>
                            </tr></thead>
                            <tbody>
                                <tr>
                                    <td style="text-align:left; font-weight:bold;">\${expC} (Exp)</td><td>\${formatNum(nf_exp)} MW</td>
                                    <td style="color:#dc2626;">-\${formatCur(itc_pay_e)}</td>
                                    <td style="color:#2563eb;">\${formatCur(cid_e)}</td>
                                    <td style="color:#2563eb;">\${formatCur(itc_inc_e)}</td>
                                    <td style="font-weight:bold; color:\${set_e<0?'#dc2626':'#15803d'}">\${formatCur(set_e)}</td>
                                </tr>
                                <tr>
                                    <td style="text-align:left; font-weight:bold;">\${impC} (Imp)</td><td>\${formatNum(nf_imp)} MW</td>
                                    <td style="color:#dc2626;">-\${formatCur(itc_pay_i)}</td>
                                    <td style="color:#2563eb;">\${formatCur(cid_i)}</td>
                                    <td style="color:#2563eb;">\${formatCur(itc_inc_i)}</td>
                                    <td style="font-weight:bold; color:\${set_i<0?'#dc2626':'#15803d'}">\${formatCur(set_i)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="res-card" style="flex: 1; border-top: 4px solid #8b5cf6;">
                    <div class="res-card-header">Resultados Ex-Post (TAU Equiv. Exp: $\${Number(tau_e).toFixed(2)}, Imp: $\${Number(tau_i).toFixed(2)})</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <thead><tr><th>Agente / Métrica</th><th>Exp: \${expC}</th><th>Imp: \${impC}</th></tr></thead>
                            <tbody>
                                <tr><td>\${createTooltipHTML('Beneficio Social', 'C_op + Peaje_Equiv')}</td><td>\${formatCur(bsE)}</td><td>\${formatCur(bsI)}</td></tr>
                                <tr><td>\${createTooltipHTML('Beneficio Generador', 'Profit Modificado')}</td><td>\${formatCur(bgE)}</td><td>\${formatCur(bgI)}</td></tr>
                                <tr><td>\${createTooltipHTML('Costo Demanda', 'Demanda + Peaje')}</td><td>\${formatCur(cdE)}</td><td>\${formatCur(cdI)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        \`;

        document.getElementById('eur_recalc').onclick = () => {
            europaInputs.itc_rate_usd_per_mwh = Number(document.getElementById('eur_itc').value);
            europaInputs.cid_split = Number(document.getElementById('eur_cid').value);
            europaInputs.infra_fund_usd_per_hour = Number(document.getElementById('eur_fund').value);
            europaExpostMethod = document.getElementById('eur_opt').value;
            renderEuropa();
        };
    }

    // ==========================================================
    // TAB 4: SIEPAC METHODOLOGY
    // ==========================================================
    function renderSiepac() {
        let capex = siepacInputs.capex; let r = siepacInputs.r_annual; let n = siepacInputs.life_years; let om = siepacInputs.om_frac_annual;
        let pow_ = Math.pow(1 + r, n); let A_annuity = r > 0 ? (capex * (r * pow_) / (pow_ - 1)) : (capex / n);
        let IAR_annual = A_annuity + (capex * om);

        let ir = (IAR_annual / 2) + (siepacInputs.SCF_USD - siepacInputs.SCE_USD) - siepacInputs.CVTn_sem_USD - siepacInputs.IVDT_USD;

        const conFlows = globalData.flowS1.flows && globalData.flowS1.flows[lineName] ? globalData.flowS1.flows[lineName] : [];
        let F = conFlows.length > 0 ? (conFlows.reduce((a, b) => a + b, 0) / conFlows.length) : 0;
        let C = 8000; // Simulated Fmax if not provided
        let f_abs = Math.abs(F);
        let uso = Math.min(f_abs / C, 1.0);
        
        let P = ir * uso; // Uso Charge
        let CC = ir * (1 - uso); // Complementary Charge

        let hours_semester = 4320;
        let aR = siepacInputs.alpha_R; let aI = siepacInputs.alpha_I;
        let MR = ir * aR; let MI = ir * aI;

        let stats = getCountryStats(siepacTargetCountry, globalData.genS1, globalData.demS1);
        let Rc = (stats.demandMW || 1) * hours_semester; // Semester projection
        let Ig = (stats.prod || 1) * hours_semester;

        let curtrc = Rc > 0 ? MR / Rc : 0; let curtrg = Ig > 0 ? MI / Ig : 0;

        let pRet = curtrc * f_abs; let pIny = curtrg * f_abs;
        
        // Ex-Post calculations (Semestral Base expected)
        let bsT = stats.opCost * hours_semester + pIny;
        let bgT = stats.genProfit * hours_semester - pIny;
        let cdT = stats.demandCost * hours_semester + pRet;

        contentContainer.innerHTML = \`
            <div class="res-card">
                <div class="res-card-header" style="background:#7c2d12; color:white;">Configuración Semestral Central Americana (SIEPAC)</div>
                <div class="res-card-body" style="background:#f9fafb;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items:flex-end;">
                        <div style="flex:1"><span class="form-label">CAPEX (USD)</span><input type="number" id="sie_capex" class="form-input" value="\${siepacInputs.capex}"></div>
                        <div style="flex:1"><span class="form-label">Alpha R (Retiros)</span><input type="number" id="sie_alphaR" class="form-input" value="\${siepacInputs.alpha_R}" step="0.01"></div>
                        <div style="flex:1"><span class="form-label">Alpha I (Inyecciones)</span><input type="number" id="sie_alphaI" class="form-input" value="\${siepacInputs.alpha_I}" step="0.01"></div>
                        <div style="flex:1"><span class="form-label">SCF ($)</span><input type="number" id="sie_scf" class="form-input" value="\${siepacInputs.SCF_USD}"></div>
                        <div style="flex:1"><span class="form-label">País Analizado</span><select id="sie_country" class="form-input">
                            <option value="\${globalData.expCountry}" \${siepacTargetCountry===globalData.expCountry?'selected':''}>País Obj: \${globalData.expCountry}</option>
                            <option value="\${globalData.impCountry}" \${siepacTargetCountry===globalData.impCountry?'selected':''}>País Obj: \${globalData.impCountry}</option>
                        </select></div>
                        <button id="sie_recalc" style="padding: 10px 16px; background:#eab308; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onmouseover="this.style.background='#ca8a04'" onmouseout="this.style.background='#eab308'">Recalcular</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 20px;">
                <div class="res-card" style="flex:1; border-top: 4px solid #eab308;">
                    <div class="res-card-header">Remuneración Semestral Asignada (\${siepacTargetCountry})</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <tr style="background:#fefce8;"><td style="font-weight:bold; color:#854d0e;">Ingreso Req Semestre (IR):</td><td align="right" style="font-weight:bold; color:#854d0e; font-size:1.1em">\${formatCur(ir)}</td></tr>
                            <tr><td>Factor de Uso (Flow / Cap)</td><td align="right">\${(uso*100).toFixed(2)}%</td></tr>
                            <tr><td>CARGO POR USO (P):</td><td align="right; font-weight:bold">\${formatCur(P)}</td></tr>
                            <tr><td>CARGO COMPL. (CC):</td><td align="right; font-weight:bold">\${formatCur(CC)}</td></tr>
                            <tr><td>MR (Asig. a Retiros):</td><td align="right">\${formatCur(MR)}</td></tr>
                            <tr><td>MI (Asig. a Inyecciones):</td><td align="right">\${formatCur(MI)}</td></tr>
                            <tr style="background:#f8fafc;"><td style="font-weight:bold; color:#0f172a">\${createTooltipHTML('CURTR C', 'Costo Unitario para Retiros Semestral')}</td><td align="right" style="font-weight:bold; color:#0f172a">\${formatCur(curtrc)} /MWh</td></tr>
                            <tr style="background:#f8fafc;"><td style="font-weight:bold; color:#0f172a">\${createTooltipHTML('CURTR G', 'Costo Unitario para Inyecciones Semestral')}</td><td align="right" style="font-weight:bold; color:#0f172a">\${formatCur(curtrg)} /MWh</td></tr>
                        </table>
                    </div>
                </div>

                <div class="res-card" style="flex:1; border-top: 4px solid #8b5cf6;">
                    <div class="res-card-header">Impacto Ex-Post Semestral (\${siepacTargetCountry})</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <thead><tr><th>Métrica (Integrando Peaje)</th><th>Valor Consolidado Semestral</th></tr></thead>
                            <tbody>
                                <tr><td>Costo Operación País</td><td align="right" style="font-weight:bold;">\${formatCur(bsT)}</td></tr>
                                <tr><td>Beneficio Generador País</td><td align="right" style="font-weight:bold; color:#15803d">\${formatCur(bgT)}</td></tr>
                                <tr><td>Costo Demanda Total</td><td align="right" style="font-weight:bold; color:#dc2626">\${formatCur(cdT)}</td></tr>
                            </tbody>
                        </table>
                        <div style="margin-top: 20px; font-size: 0.85em; color: #4b5563; padding: 12px; background: #f3f4f6; border-radius: 6px;">
                            <strong>Aviso:</strong> Para esta metodología se usan inyecciones proyectadas, tomando el valor de generación y demanda multiplicado por 4320 horas (1 Semestre).
                        </div>
                    </div>
                </div>
            </div>
        \`;

        document.getElementById('sie_recalc').onclick = () => {
            siepacInputs.capex = Number(document.getElementById('sie_capex').value);
            siepacInputs.alpha_R = Number(document.getElementById('sie_alphaR').value);
            siepacInputs.alpha_I = Number(document.getElementById('sie_alphaI').value);
            siepacInputs.SCF_USD = Number(document.getElementById('sie_scf').value);
            siepacTargetCountry = document.getElementById('sie_country').value;
            renderSiepac();
        };
    }

}
`;

const targetFile = path.join(__dirname, 'public', 'chart_helper.js');

let lines = fs.readFileSync(targetFile, 'utf8').split('\\n');

let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('async function showMethodologyResults')) {
        startIdx = i;
        break;
    }
}

if (startIdx !== -1) {
    if (startIdx > 0 && lines[startIdx - 1].includes('// Function to load and display')) {
        startIdx -= 1;
    }
    // retain anything before startIdx
    const newContent = lines.slice(0, startIdx).join('\\n') + '\\n' + jsCode;
    fs.writeFileSync(targetFile, newContent, 'utf8');
    console.log('Successfully updated chart_helper.js using Node script.');
} else {
    console.log('Could not find existing showMethodologyResults function to replace.');
}
