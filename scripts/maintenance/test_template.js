const siepacTargetCountry = 'P1';
const expC = 'P1';
const impC = 'P2';
const formatCur = (x) => '$' + x;
const createTooltipHTML = (x, y, z, w) => `[TOOLTIP: ${x} | ${y} | ${z} | ${w}]`;
const sinData = {
    ben_soc_exp: 10, ben_soc_imp: 10,
    ben_gen_exp: 10, ben_gen_imp: 10,
    cos_dem_exp: 10, cos_dem_imp: 10,
    op_cost_h_e: 10, op_cost_h_i: 10,
    profit_h_e: 10, profit_h_i: 10,
    demand_cost_h_e: 10, demand_cost_h_i: 10
};
const conData = { ...sinData, peaje_iny_exp_USD: 5, peaje_ret_imp_USD: 5, CR_abs: 5 };
const aI = 0.5, aR = 0.5;
const deltaBsE = 0, deltaBsI = 0, deltaBgE = 0, deltaBgI = 0, deltaCdE = 0, deltaCdI = 0;

try {
    const html = `
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Operación País</td><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(sinData.ben_soc_exp), 'Costo Operación', formatCur(sinData.op_cost_h_e) + ' (OpCost)', 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(sinData.ben_soc_imp), 'Costo Operación', formatCur(sinData.op_cost_h_i) + ' (OpCost)', 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Beneficio Generador País</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(sinData.ben_gen_exp), 'Beneficio Generador', formatCur(sinData.profit_h_e) + ' (Profit)', 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(sinData.ben_gen_imp), 'Beneficio Generador', formatCur(sinData.profit_h_i) + ' (Profit)', 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Demanda País</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(sinData.cos_dem_exp), 'Costo Demanda', formatCur(sinData.demand_cost_h_e) + ' (DemCost)', 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(sinData.cos_dem_imp), 'Costo Demanda', formatCur(sinData.demand_cost_h_i) + ' (DemCost)', 'right')}</td></tr>
                                </tbody>
`;
    console.log("Success SIN");
} catch (e) { console.error("Error SIN:", e); }

try {
    const html2 = `
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Costo Operación + Peaje</td><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(conData.ben_soc_exp), 'Costo Operación + PeajeIny', formatCur(conData.op_cost_h_e) + ' + ' + formatCur(conData.peaje_iny_exp_USD), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em;">${createTooltipHTML(formatCur(conData.ben_soc_imp), 'Costo Operación + PeajeRet', formatCur(conData.op_cost_h_i) + ' + ' + formatCur(conData.peaje_ret_imp_USD), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Ben Gen + Renta - Peaje</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(conData.ben_gen_exp), 'Profit - PeajeIny + Renta(aI)', formatCur(conData.profit_h_e) + ' - ' + formatCur(conData.peaje_iny_exp_USD) + ' + ' + formatCur(conData.CR_abs * aI), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#15803d;">${createTooltipHTML(formatCur(conData.ben_gen_imp), 'Profit (sin asignación)', formatCur(conData.profit_h_i), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Demanda + Peaje - Renta</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(conData.cos_dem_exp), 'Demanda (sin asignación)', formatCur(conData.demand_cost_h_e), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; color:#dc2626;">${createTooltipHTML(formatCur(conData.cos_dem_imp), 'Demanda + PeajeRet - Renta(aR)', formatCur(conData.demand_cost_h_i) + ' + ' + formatCur(conData.peaje_ret_imp_USD) + ' - ' + formatCur(conData.CR_abs * aR), 'right')}</td></tr>
                                </tbody>
`;
    console.log("Success CON");
} catch (e) { console.error("Error CON:", e); }

try {
    const html3 = `
                                <tbody>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Operación</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBsE < 0 ? 'bold' : 'normal'}; color:${deltaBsE < 0 ? '#16a34a' : '#ef4444'}">${deltaBsE < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(-deltaBsE) + ')', 'Ahorro (SIN - CON)', formatCur(sinData.ben_soc_exp) + ' - ' + formatCur(conData.ben_soc_exp), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBsI < 0 ? 'bold' : 'normal'}; color:${deltaBsI < 0 ? '#16a34a' : '#ef4444'}">${deltaBsI < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(-deltaBsI) + ')', 'Ahorro (SIN - CON)', formatCur(sinData.ben_soc_imp) + ' - ' + formatCur(conData.ben_soc_imp), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Beneficio Generador</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBgE > 0 ? 'bold' : 'normal'}; color:${deltaBgE > 0 ? '#16a34a' : '#ef4444'}">${deltaBgE > 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(+' + formatCur(deltaBgE) + ')', 'Ganancia (CON - SIN)', formatCur(conData.ben_gen_exp) + ' - ' + formatCur(sinData.ben_gen_exp), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaBgI > 0 ? 'bold' : 'normal'}; color:${deltaBgI > 0 ? '#16a34a' : '#ef4444'}">${deltaBgI > 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(+' + formatCur(deltaBgI) + ')', 'Ganancia (CON - SIN)', formatCur(conData.ben_gen_imp) + ' - ' + formatCur(sinData.ben_gen_imp), 'right')}</td></tr>
                                    <tr><td style="padding: 8px 12px; font-size: 0.85em;">Δ Costo Demanda</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaCdE < 0 ? 'bold' : 'normal'}; color:${deltaCdE < 0 ? '#16a34a' : '#ef4444'}">${deltaCdE < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(-deltaCdE) + ')', 'Ahorro (SIN - CON)', formatCur(sinData.cos_dem_exp) + ' - ' + formatCur(conData.cos_dem_exp), 'right')}</td><td style="padding: 8px 12px; font-size: 0.85em; font-weight: ${deltaCdI < 0 ? 'bold' : 'normal'}; color:${deltaCdI < 0 ? '#16a34a' : '#ef4444'}">${deltaCdI < 0 ? 'Ganador' : 'Perdedor'} ${createTooltipHTML('(' + formatCur(-deltaCdI) + ')', 'Ahorro (SIN - CON)', formatCur(sinData.cos_dem_imp) + ' - ' + formatCur(conData.cos_dem_imp), 'right')}</td></tr>
                                </tbody>
`;
    console.log("Success DELTA");
} catch (e) { console.error("Error DELTA:", e); }
