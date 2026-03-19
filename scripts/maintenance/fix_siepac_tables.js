const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'public', 'chart_helper.js');
let content = fs.readFileSync(targetFile, 'utf8');

const anchor = 'function renderSiepac() {';
const startIndex = content.indexOf(anchor);

if (startIndex === -1) {
    console.error("Could not find function renderSiepac() {");
    process.exit(1);
}

// Ensure we slice up to the very end of showMethodologyResults
let contentBefore = content.substring(0, startIndex);

const updatedSiepacLogic = `function renderSiepac() {
        let capex = siepacInputs.capex; let r = siepacInputs.r_annual; let n = siepacInputs.life_years; let om = siepacInputs.om_frac_annual;
        let pow_ = Math.pow(1 + r, n); let A_annuity = r > 0 ? (capex * (r * pow_) / (pow_ - 1)) : (capex / n);
        let IAR_annual = A_annuity + (capex * om);

        let ir = (IAR_annual / 2) + (siepacInputs.SCF_USD - siepacInputs.SCE_USD) - siepacInputs.CVTn_sem_USD - siepacInputs.IVDT_USD;

        const conFlows = globalData.flowS1.flows && globalData.flowS1.flows[lineName] ? globalData.flowS1.flows[lineName] : [];
        let F = conFlows.length > 0 ? (conFlows.reduce((a, b) => a + b, 0) / conFlows.length) : 0;
        let C = 8000; // Simulated Fmax si es que no viene (podria extraerse de la topologia)
        let f_abs = Math.abs(F);
        let uso = Math.min(f_abs / C, 1.0);
        
        let P = ir * uso; // Uso Charge
        let CC = ir * (1 - uso); // Complementary Charge
        let MR = P + CC; // Total required to be compensated

        let hours_semester = 4320;
        let aR = siepacInputs.alpha_R; let aI = siepacInputs.alpha_I;
        let MR_allocated = MR * aR; let MI_allocated = MR * aI;

        // País Exportador o Importador basado en F Neto Promedio
        let expC = F >= 0 ? globalData.expCountry : globalData.impCountry;
        let impC = F >= 0 ? globalData.impCountry : globalData.expCountry;

        // Renta Congestion S1 y S0 (que siempre es 0 asumo)
        let CR_CON = calculateCongestionRentLocally(globalData.mcS1, globalData.flowS1, expNode, impNode, lineName) * hours_semester;

        const calculateExPostSIEPAC = (isCon) => {
            let statsE = getCountryStats(expC, isCon ? globalData.genS1 : globalData.genS0, isCon ? globalData.demS1 : globalData.demS0);
            let statsI = getCountryStats(impC, isCon ? globalData.genS1 : globalData.genS0, isCon ? globalData.demS1 : globalData.demS0);
            
            let Rc_sem_E = (statsE.demandMW || 1) * hours_semester;
            let Ig_sem_E = (statsE.prod || 1) * hours_semester;
            let Rc_sem_I = (statsI.demandMW || 1) * hours_semester;

            let curtrc_exp = Rc_sem_E > 0 ? MR_allocated / Rc_sem_E : 0;
            let curtrg_exp = Ig_sem_E > 0 ? MI_allocated / Ig_sem_E : 0;
            let curtrc_imp = Rc_sem_I > 0 ? MR_allocated / Rc_sem_I : 0;

            let peaje_iny_exp_USD = isCon ? curtrg_exp * f_abs : 0;
            let peaje_ret_imp_USD = isCon ? curtrc_imp * f_abs : 0;

            let op_cost_h_e = statsE.opCost * hours_semester;
            let op_cost_h_i = statsI.opCost * hours_semester;
            let profit_h_e = statsE.genProfit * hours_semester;
            let profit_h_i = statsI.genProfit * hours_semester;
            let demand_cost_h_e = statsE.demandCost * hours_semester;
            let demand_cost_h_i = statsI.demandCost * hours_semester;

            let CR_abs = isCon ? CR_CON : 0;

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
                curtrc_exp, curtrg_exp, curtrc_imp
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

        contentContainer.innerHTML = \`
            <div class="res-card">
                <div class="res-card-header" style="background:#7c2d12; color:white;">Configuración Semestral Central Americana (SIEPAC)</div>
                <div class="res-card-body" style="background:#f9fafb;">
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; align-items:flex-end;">
                        <div style="flex:1; min-width: 130px"><span class="form-label">CAPEX (USD)</span><input type="number" id="sie_capex" class="form-input" value="\${siepacInputs.capex}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label">Años Vida (n)</span><input type="number" id="sie_n" class="form-input" value="\${siepacInputs.life_years}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label">Tasa Ret. (r)</span><input type="number" id="sie_r" class="form-input" value="\${siepacInputs.r_annual}" step="0.01"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label">O&M Frac.</span><input type="number" id="sie_om" class="form-input" value="\${siepacInputs.om_frac_annual}" step="0.001"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label">Alpha R (Ret)</span><input type="number" id="sie_alphaR" class="form-input" value="\${siepacInputs.alpha_R}" step="0.01"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label">Alpha I (Iny)</span><input type="number" id="sie_alphaI" class="form-input" value="\${siepacInputs.alpha_I}" step="0.01"></div>
                        
                        <div style="flex:1; min-width: 120px"><span class="form-label">CVT Semestral ($)</span><input type="number" id="sie_cvt" class="form-input" value="\${siepacInputs.CVTn_sem_USD}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label">SCF ($)</span><input type="number" id="sie_scf" class="form-input" value="\${siepacInputs.SCF_USD}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label">SCE ($)</span><input type="number" id="sie_sce" class="form-input" value="\${siepacInputs.SCE_USD}"></div>
                        <div style="flex:1; min-width: 100px"><span class="form-label">IVDT ($)</span><input type="number" id="sie_ivdt" class="form-input" value="\${siepacInputs.IVDT_USD}"></div>
                        <div style="flex: 100%; text-align: right; margin-top: 10px;">
                            <button id="sie_recalc" style="padding: 10px 24px; background:#eab308; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;" onmouseover="this.style.background='#ca8a04'" onmouseout="this.style.background='#eab308'">Recalcular SIEPAC</button>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <h3 style="margin-bottom: 12px; font-size: 1.25rem; font-weight: 600; color: #1e3a8a;">Análisis Adicional: 3 Modelos Ex-Post Semestrales</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 16px;">
                    
                    <!-- CASO SIN -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #9ca3af;">
                        <div class="res-card-header" style="background: #f3f4f6;">1. Caso Base (SIN)</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica Semestral</th><th style="padding: 8px 12px; font-size: 0.8em;">Exp: \${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;">Imp: \${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Operación País</td><td style="padding: 8px 12px; font-size: 0.85em;">\${formatCur(sinData.ben_soc_exp)}</td><td style="padding: 8px 12px; font-size: 0.85em;">\${formatCur(sinData.ben_soc_imp)}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Beneficio Generador País</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">\${formatCur(sinData.ben_gen_exp)}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">\${formatCur(sinData.ben_gen_imp)}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Demanda País</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">\${formatCur(sinData.cos_dem_exp)}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">\${formatCur(sinData.cos_dem_imp)}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- CASO CON -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #3b82f6;">
                        <div class="res-card-header" style="background: #eff6ff; color: #1e3a8a;">2. Caso Interconectado (CON)</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica Semestral</th><th style="padding: 8px 12px; font-size: 0.8em;">Exp: \${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;">Imp: \${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Operación + Peaje</td><td style="padding: 8px 12px; font-size: 0.85em;">\${formatCur(conData.ben_soc_exp)}</td><td style="padding: 8px 12px; font-size: 0.85em;">\${formatCur(conData.ben_soc_imp)}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Ben Gen + Renta - Peaje</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">\${formatCur(conData.ben_gen_exp)}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">\${formatCur(conData.ben_gen_imp)}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Demanda + Peaje - Renta</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">\${formatCur(conData.cos_dem_exp)}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">\${formatCur(conData.cos_dem_imp)}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- DELTAS -->
                    <div class="res-card" style="margin-bottom: 0; border-top: 4px solid #8b5cf6;">
                        <div class="res-card-header" style="background: #f5f3ff; color: #4c1d95;">3. Ganadores y perdedores (Δ)</div>
                        <div class="res-card-body" style="padding: 0;">
                            <table class="res-table">
                                <thead><tr><th style="padding: 8px 12px; font-size: 0.8em;">Métrica Semestral</th><th style="padding: 8px 12px; font-size: 0.8em;">Exp: \${expC}</th><th style="padding: 8px 12px; font-size: 0.8em;">Imp: \${impC}</th></tr></thead>
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Operación</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: \${deltaBsE < 0 ? 'bold':'normal'}; color:\${deltaBsE < 0 ? '#16a34a' : '#ef4444'}">\${deltaBsE < 0 ? 'Ganador' : 'Perdedor'} (\${formatCur(-deltaBsE)})</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: \${deltaBsI < 0 ? 'bold':'normal'}; color:\${deltaBsI < 0 ? '#16a34a' : '#ef4444'}">\${deltaBsI < 0 ? 'Ganador' : 'Perdedor'} (\${formatCur(-deltaBsI)})</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Beneficio Generador</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: \${deltaBgE > 0 ? 'bold':'normal'}; color:\${deltaBgE > 0 ? '#16a34a' : '#ef4444'}">\${deltaBgE > 0 ? 'Ganador' : 'Perdedor'} (+\${formatCur(deltaBgE)})</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: \${deltaBgI > 0 ? 'bold':'normal'}; color:\${deltaBgI > 0 ? '#16a34a' : '#ef4444'}">\${deltaBgI > 0 ? 'Ganador' : 'Perdedor'} (+\${formatCur(deltaBgI)})</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Demanda</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: \${deltaCdE < 0 ? 'bold':'normal'}; color:\${deltaCdE < 0 ? '#16a34a' : '#ef4444'}">\${deltaCdE < 0 ? 'Ganador' : 'Perdedor'} (\${formatCur(-deltaCdE)})</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: \${deltaCdI < 0 ? 'bold':'normal'}; color:\${deltaCdI < 0 ? '#16a34a' : '#ef4444'}">\${deltaCdI < 0 ? 'Ganador' : 'Perdedor'} (\${formatCur(-deltaCdI)})</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 20px;">
                <div class="res-card" style="flex:1; border-top: 4px solid #eab308;">
                    <div class="res-card-header">Peajes, Rentas y CURTR Semestral</div>
                    <div class="res-card-body">
                        <table class="res-table">
                            <tr style="background:#fefce8;"><td style="font-weight:bold; color:#854d0e;">Ingreso Req Semestre (IR):</td><td align="right" style="font-weight:bold; color:#854d0e; font-size:1.1em">\${formatCur(ir)}</td></tr>
                            <tr><td>CARGO POR USO (P):</td><td align="right; font-weight:bold">\${formatCur(P)}</td></tr>
                            <tr><td>CARGO COMPL. (CC):</td><td align="right; font-weight:bold">\${formatCur(CC)}</td></tr>
                            <tr style="background:#fbfccb;"><td style="font-weight:bold;">Total Peaje a Asignar (P+CC):</td><td align="right" style="font-weight:bold;">\${formatCur(MR)}</td></tr>
                            <tr><td>MR (Asig. a Retiros):</td><td align="right">\${formatCur(MR_allocated)}</td></tr>
                            <tr><td>MI (Asig. a Inyecciones):</td><td align="right">\${formatCur(MI_allocated)}</td></tr>
                            <tr style="background:#f8fafc;"><td style="font-weight:bold;">CURTR C (Costo Unit. Retiros)</td><td align="right">\${formatCur(conData.curtrc_imp)} /MWh</td></tr>
                            <tr style="background:#f8fafc;"><td style="font-weight:bold;">CURTR G (Costo Unit. Inyecciones)</td><td align="right">\${formatCur(conData.curtrg_exp)} /MWh</td></tr>
                            <tr style="background:#eff6ff;"><td style="font-weight:bold; color:#1d4ed8;">Renta Congestión Total (Semestral)</td><td align="right; font-weight:bold; color:#1d4ed8;">\${formatCur(CR_CON)}</td></tr>
                        </table>
                    </div>
                </div>
            </div>
        \`;

        document.getElementById('sie_recalc').onclick = () => {
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
            renderSiepac();
        };
    }

}
`;

contentBefore += updatedSiepacLogic;

fs.writeFileSync(targetFile, contentBefore);
console.log('Successfully re-rendered 3 tables in SIEPAC.');
