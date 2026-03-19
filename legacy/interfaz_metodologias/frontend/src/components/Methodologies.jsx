import React, { useState, useEffect } from 'react';
import LatamHybridTab from './LatamHybridTab';

const TooltipLabel = ({ label, description, formula, align = 'left' }) => {
    let tooltipPos = 'left-0';
    let arrowPos = 'left-4';
    if (align === 'right') {
        tooltipPos = 'right-0';
        arrowPos = 'right-4';
    } else if (align === 'center') {
        tooltipPos = 'left-1/2 -translate-x-1/2';
        arrowPos = 'left-1/2 -translate-x-1/2';
    }

    return (
        <div className="group relative inline-flex items-center gap-1 cursor-default w-max max-w-full">
            <span>{label}</span>
            {(description || formula) && (
                <div className="cursor-help text-oirse-text-muted hover:text-oirse-accent transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            )}
            {(description || formula) && (
                <div className={`absolute z-50 bottom-full mb-1 hidden group-hover:block w-64 md:w-80 p-3 bg-oirse-bg-primary text-oirse-text-primary text-xs rounded-lg shadow-oirse-lg font-normal normal-case whitespace-normal text-left border border-oirse-border ${tooltipPos}`}>
                    {description && <div className="text-oirse-text-secondary leading-relaxed">{description}</div>}
                    {formula && (
                        <div className="mt-2 pt-2 border-t border-oirse-border">
                            <span className="block text-oirse-text-muted text-[10px] uppercase mb-1 font-semibold tracking-wider">Fórmula:</span>
                            <code className="block bg-oirse-bg-secondary p-2 rounded text-oirse-accent-hover text-[11px] break-words font-mono border border-oirse-border">
                                {formula}
                            </code>
                        </div>
                    )}
                    <div className={`absolute top-full border-4 border-transparent border-t-oirse-bg-primary ${arrowPos}`}></div>
                </div>
            )}
        </div>
    );
};

const AsiaTab = ({ results, params }) => {
    const lineOptions = params ? Object.keys(params.LINES) : [];
    const [selectedLine, setSelectedLine] = useState(lineOptions.length > 0 ? lineOptions[0] : '');

    const defaultAsiaInputs = {
        capex_usd: 939644790.0,
        life_years: 25,
        r_annual: 0.06,
        om_frac_annual: 0.015,
        hours_year: 8760
    };

    const [allAsiaInputs, setAllAsiaInputs] = useState({});
    const asiaInputs = allAsiaInputs[selectedLine] || defaultAsiaInputs;

    const [miles, setMiles] = useState({});
    useEffect(() => {
        if (params && params.LINES) {
            const initialMiles = {};
            Object.keys(params.LINES).forEach(l => {
                initialMiles[l] = l === 'L_CHL_PER' ? 300 : (l === 'L_CHL_ARG' ? 200 : 100);
            });
            setMiles(prev => Object.keys(prev).length ? prev : initialMiles); // only init once
        }
    }, [params]);

    const [mwMileRule, setMwMileRule] = useState('importer_pays');
    const [useServed, setUseServed] = useState(false);
    const [projectToYear, setProjectToYear] = useState(false);
    const [expostMethodSwitch, setExpostMethodSwitch] = useState('stamp');

    const handleInput = (e) => {
        if (!selectedLine) return;
        const { name, value } = e.target;
        setAllAsiaInputs(prev => {
            const currentLineInputs = prev[selectedLine] || { ...defaultAsiaInputs };
            return {
                ...prev,
                [selectedLine]: { ...currentLineInputs, [name]: value === '' ? '' : Number(value) }
            };
        });
    };

    const handleMileInput = (e, line) => {
        const val = e.target.value;
        setMiles(prev => ({ ...prev, [line]: val === '' ? '' : Number(val) }));
    };

    const calculateAsia = () => {
        if (!results || !results.con || !results.con.df_cr || !selectedLine || Object.keys(miles).length === 0) return null;

        const res = results.con;

        // 1) Finanzas
        const r = Number(asiaInputs.r_annual);
        const n = Number(asiaInputs.life_years);
        const capex = Number(asiaInputs.capex_usd);
        const om = Number(asiaInputs.om_frac_annual);
        const h = Number(asiaInputs.hours_year);

        const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        const annuity = capex * (factor || 0); // fallback if r is 0
        const arr = annuity + (capex * om);
        const rr_h = h > 0 ? arr / h : 0;

        const hoursMultiplier = projectToYear ? h : 1;
        const target_rr = projectToYear ? arr : rr_h;

        // 2) Demanda
        const D_by_node = {};
        const served_by_node = {};
        if (res.df_dem) {
            res.df_dem.forEach(d => {
                D_by_node[d.node] = d.D;
                served_by_node[d.node] = d.served;
            });
        }

        // 3) Flujos
        const flows_by_line = {};
        if (res.df_cr) {
            res.df_cr.forEach(cr => { flows_by_line[cr.line] = cr.F; });
        }
        Object.keys(params.LINES).forEach(l => {
            if (flows_by_line[l] === undefined) flows_by_line[l] = 0;
        });

        const selFr = params.LINES[selectedLine].fr;
        const selTo = params.LINES[selectedLine].to;

        // 4) Postage Stamp (Por Línea Seleccionada - Solo Nodos Extremos)
        const baseDem = useServed ? served_by_node : D_by_node;

        const dem_fr = (baseDem[selFr] || 0) * hoursMultiplier;
        const dem_to = (baseDem[selTo] || 0) * hoursMultiplier;
        const totalDem = dem_fr + dem_to;

        const stamp_tariff = totalDem > 0 ? target_rr / totalDem : 0;

        const stamp_pay_country = {};
        Object.values(params.NODES).forEach(c => stamp_pay_country[c] = 0);

        const cFr = params.NODES[selFr];
        const cTo = params.NODES[selTo];

        if (cFr) stamp_pay_country[cFr] += dem_fr * stamp_tariff;
        if (cTo) stamp_pay_country[cTo] += dem_to * stamp_tariff;

        // 5) MW-Mile (Por Línea Seleccionada)
        const selF_hourly = flows_by_line[selectedLine] || 0;
        const selF = selF_hourly * hoursMultiplier;
        const selL = miles[selectedLine] || 0;
        const mwm_unit = (Math.abs(selF) >= 1e-9 && selL > 0) ? target_rr / (Math.abs(selF) * selL) : 0;

        // El cargo por MW-Mile por defecto debe converger estrictamente al costo total requerido (RR).
        const selCost = (Math.abs(selF) >= 1e-9 && selL > 0) ? target_rr : 0;

        const mwm_pay_country = {};
        Object.values(params.NODES).forEach(c => mwm_pay_country[c] = 0);

        let exporter_node, importer_node;
        if (selF > 0) { exporter_node = selFr; importer_node = selTo; }
        else { exporter_node = selTo; importer_node = selFr; }

        const exp_c = params.NODES[exporter_node];
        const imp_c = params.NODES[importer_node];

        if (selCost > 0) {
            if (mwMileRule === "importer_pays" && imp_c) mwm_pay_country[imp_c] += selCost;
            else if (mwMileRule === "exporter_pays" && exp_c) mwm_pay_country[exp_c] += selCost;
            else if (mwMileRule === "split_50_50") {
                if (exp_c) mwm_pay_country[exp_c] += selCost * 0.5;
                if (imp_c) mwm_pay_country[imp_c] += selCost * 0.5;
            }
        }

        let c_exp = exp_c;
        let c_imp = imp_c;

        const dem_by_country = {};
        Object.values(params.NODES).forEach(c => dem_by_country[c] = 0);
        if (cFr) dem_by_country[cFr] += dem_fr;
        if (cTo) dem_by_country[cTo] += dem_to;

        return {
            capex, annuity, arr, rr_h, r, n, om, h, totalDem, selL,
            stamp_tariff, stamp_pay_country, dem_by_country, target_rr, hoursMultiplier, projectToYear,
            mwm_unit, mwm_line_cost: { [selectedLine]: selCost }, mwm_pay_country,
            c_exp, c_imp, selF: Math.abs(selF), selCost
        };
    };

    const out = calculateAsia();

    const getExpostMatrixAsia = (caseType, peajeMethod) => {
        const res = caseType === 'con' ? results?.con : results?.sin;
        if (!res) return null;

        let c_exp, c_imp;
        if (caseType === 'sin') {
            c_exp = params.NODES[params.LINES[selectedLine].fr];
            c_imp = params.NODES[params.LINES[selectedLine].to];
        } else {
            if (out) {
                c_exp = out.c_exp;
                c_imp = out.c_imp;
            } else {
                const flows_cr = {};
                if (res.df_cr) {
                    res.df_cr.forEach(cr => { flows_cr[cr.line] = cr.F; });
                }
                const selF_con = flows_cr[selectedLine] || 0;
                if (selF_con > 0) {
                    c_exp = params.NODES[params.LINES[selectedLine].fr];
                    c_imp = params.NODES[params.LINES[selectedLine].to];
                } else {
                    c_exp = params.NODES[params.LINES[selectedLine].to];
                    c_imp = params.NODES[params.LINES[selectedLine].fr];
                }
            }
        }
        if (!c_exp || !c_imp) return null;

        const hoursMultiplier = out ? out.hoursMultiplier : 1;
        const unitSuffix = out && out.projectToYear ? '/año' : '/hora';

        let peaje_exp = 0, peaje_imp = 0;
        if (caseType === 'con' && out) {
            const pay_obj = peajeMethod === 'stamp' ? out.stamp_pay_country : out.mwm_pay_country;
            peaje_exp = pay_obj[c_exp] || 0;
            peaje_imp = pay_obj[c_imp] || 0;
        }

        const stats_exp = { op: 0, profit: 0, dem: 0 };
        const stats_imp = { op: 0, profit: 0, dem: 0 };

        const getStats = (c, statsObj) => {
            const gens = res.df_gen ? res.df_gen.filter(r => r.country === c) : [];
            const dems = res.df_dem ? res.df_dem.filter(r => r.country === c) : [];
            statsObj.op = (gens.reduce((sum, r) => sum + (r.var_cost || 0), 0) + dems.reduce((sum, r) => sum + (r.cost_ens || 0), 0)) * hoursMultiplier;
            statsObj.profit = gens.reduce((sum, r) => sum + (r.profit || 0), 0) * hoursMultiplier;
            statsObj.dem = dems.reduce((sum, r) => sum + (r.dem_total_cost || 0), 0) * hoursMultiplier;
        };
        getStats(c_exp, stats_exp);
        getStats(c_imp, stats_imp);

        let cr_exp = 0, cr_imp = 0;
        if (caseType === 'con' && res.df_cr) {
            res.df_cr.forEach(r => {
                if (!r.F || Math.abs(r.F) < 1e-9 || !params.LINES[r.line]) return;
                const exporter = r.F > 0 ? params.LINES[r.line].fr : params.LINES[r.line].to;
                const exp_c = params.NODES[exporter];
                if (exp_c === c_exp) cr_exp += (r.CR * hoursMultiplier);
                if (exp_c === c_imp) cr_imp += (r.CR * hoursMultiplier);
            });
        }

        return {
            caseType: caseType.toUpperCase(),
            method: peajeMethod,
            c_exp, c_imp,
            ben_soc_exp: stats_exp.op + peaje_exp,
            ben_soc_imp: stats_imp.op + peaje_imp,
            ben_gen_exp: stats_exp.profit + cr_exp - peaje_exp,
            ben_gen_imp: stats_imp.profit + cr_imp - peaje_imp,
            cos_dem_exp: stats_exp.dem + peaje_exp,
            cos_dem_imp: stats_imp.dem + peaje_imp,
            bs_exp_factors: { op: stats_exp.op, peaje: peaje_exp },
            bs_imp_factors: { op: stats_imp.op, peaje: peaje_imp },
            bg_exp_factors: { profit: stats_exp.profit, cr: cr_exp, peaje: peaje_exp },
            bg_imp_factors: { profit: stats_imp.profit, cr: cr_imp, peaje: peaje_imp },
            cd_exp_factors: { dem: stats_exp.dem, peaje: peaje_exp },
            cd_imp_factors: { dem: stats_imp.dem, peaje: peaje_imp },
            unitSuffix
        };
    };

    const exPostCon = getExpostMatrixAsia('con', expostMethodSwitch);
    const exPostSin = getExpostMatrixAsia('sin', expostMethodSwitch);

    const formatCurr = (val) => val ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

    const renderExpostTableAsia = (data) => {
        if (!data) return null;
        return (
            <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                <h4 className="bg-gray-100 text-gray-700 font-bold px-4 py-3 border-b border-gray-200 uppercase text-sm tracking-widest text-center flex justify-between items-center">
                    <span>Caso {data.caseType}</span>
                    <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-1 rounded">{data.method === 'stamp' ? 'Postage Stamp' : 'MW-Mile'}</span>
                </h4>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-purple-50 text-purple-900">
                        <tr>
                            <th className="px-4 py-3 text-left">Modelo Ex-Post ($ {data.unitSuffix})</th>
                            <th className="px-4 py-3 text-right">Exp: {data.c_exp}</th>
                            <th className="px-4 py-3 text-right">Imp: {data.c_imp}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="1. Costo de Operación" description="Costo operativo del país más el pago de peaje (según el método activo)." formula="Costo_Op_País + Peaje" />
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="center" label={`$${formatCurr(data.ben_soc_exp)}`} formula={`Costo_Op: $${formatCurr(data.bs_exp_factors.op)} ${data.caseType === 'CON' ? `| + Peaje: $${formatCurr(data.bs_exp_factors.peaje)}` : ''}`} />
                                </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="right" label={`$${formatCurr(data.ben_soc_imp)}`} formula={`Costo_Op: $${formatCurr(data.bs_imp_factors.op)} ${data.caseType === 'CON' ? `| + Peaje: $${formatCurr(data.bs_imp_factors.peaje)}` : ''}`} />
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="2. Beneficio Generador" description="La suma del beneficio neto del generador (profit) más su renta de congestión adjudicada deduciendo su correspondiente Peaje." formula="Σ Profit + CR_asignada_pais - Peaje" />
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="center" label={`$${formatCurr(data.ben_gen_exp)}`} formula={`Profit: $${formatCurr(data.bg_exp_factors.profit)} ${data.caseType === 'CON' ? `| + Renta_CR: $${formatCurr(data.bg_exp_factors.cr)} | - Peaje: $${formatCurr(data.bg_exp_factors.peaje)}` : ''}`} />
                                </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="right" label={`$${formatCurr(data.ben_gen_imp)}`} formula={`Profit: $${formatCurr(data.bg_imp_factors.profit)} ${data.caseType === 'CON' ? `| + Renta_CR: $${formatCurr(data.bg_imp_factors.cr)} | - Peaje: $${formatCurr(data.bg_imp_factors.peaje)}` : ''}`} />
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="3. Costo de Demanda" description="La suma de los pagos netos de la demanda del país más el pago de Peaje ASIA derivado." formula="Σ Costo_Demanda_País + Peaje" />
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="center" label={`$${formatCurr(data.cos_dem_exp)}`} formula={`Costo_Demanda: $${formatCurr(data.cd_exp_factors.dem)} ${data.caseType === 'CON' ? `| + Peaje: $${formatCurr(data.cd_exp_factors.peaje)}` : ''}`} />
                                </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="right" label={`$${formatCurr(data.cos_dem_imp)}`} formula={`Costo_Demanda: $${formatCurr(data.cd_imp_factors.dem)} ${data.caseType === 'CON' ? `| + Peaje: $${formatCurr(data.cd_imp_factors.peaje)}` : ''}`} />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    const renderWinnersLosersTableAsia = (conData, sinData) => {
        if (!conData || !sinData) return null;

        const getSinVal = (country, metric_exp, metric_imp) => {
            if (sinData.c_exp === country) return sinData[metric_exp];
            if (sinData.c_imp === country) return sinData[metric_imp];
            return 0; // Should not reach here if countries match
        };

        const sin_soc_exp_matched = getSinVal(conData.c_exp, 'ben_soc_exp', 'ben_soc_imp');
        const sin_soc_imp_matched = getSinVal(conData.c_imp, 'ben_soc_exp', 'ben_soc_imp');

        const sin_gen_exp_matched = getSinVal(conData.c_exp, 'ben_gen_exp', 'ben_gen_imp');
        const sin_gen_imp_matched = getSinVal(conData.c_imp, 'ben_gen_exp', 'ben_gen_imp');

        const sin_dem_exp_matched = getSinVal(conData.c_exp, 'cos_dem_exp', 'cos_dem_imp');
        const sin_dem_imp_matched = getSinVal(conData.c_imp, 'cos_dem_exp', 'cos_dem_imp');

        const delta_soc_exp = conData.ben_soc_exp - sin_soc_exp_matched;
        const delta_soc_imp = conData.ben_soc_imp - sin_soc_imp_matched;

        const delta_gen_exp = conData.ben_gen_exp - sin_gen_exp_matched;
        const delta_gen_imp = conData.ben_gen_imp - sin_gen_imp_matched;

        const delta_dem_exp = conData.cos_dem_exp - sin_dem_exp_matched;
        const delta_dem_imp = conData.cos_dem_imp - sin_dem_imp_matched;

        const getStatus = (val, conVal, sinVal, isCost = false) => {
            const effectiveVal = isCost ? -val : val;
            let label = <span className="text-gray-500 font-bold">Neutral</span>;
            if (effectiveVal > 1e-6) label = <span className="text-green-600 font-bold">Ganador (+${formatCurr(Math.abs(val))})</span>;
            else if (effectiveVal < -1e-6) label = <span className="text-red-600 font-bold">Perdedor (-${formatCurr(Math.abs(val))})</span>;

            return (
                <div className="flex justify-end overflow-visible">
                    <TooltipLabel align="center" label={label} formula={`Caso_CON: $${formatCurr(conVal)} | Caso_SIN: $${formatCurr(sinVal)}`} />
                </div>
            );
        };

        return (
            <div className="overflow-visible shadow-sm rounded-lg border border-gray-200 lg:col-span-2 mt-6">
                <h4 className="bg-indigo-50 text-indigo-800 font-bold px-4 py-3 border-b border-indigo-100 uppercase text-sm tracking-widest text-center flex flex-col gap-2 items-center">
                    <span>Ganadores y Perdedores por País (Δ CON - SIN)</span>
                </h4>
                <table className="min-w-full divide-y divide-gray-200 text-sm overflow-visible">
                    <thead className="bg-indigo-100 text-indigo-900">
                        <tr>
                            <th className="px-4 py-3 text-left">Modelo Ex-Post ($ {conData.unitSuffix})</th>
                            <th className="px-4 py-3 text-right">Exp: {conData.c_exp}</th>
                            <th className="px-4 py-3 text-right">Imp: {conData.c_imp}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="1. Costo de Operación (Δ)" description="Variación del Costo de Operación Total entre el caso interconectado y el aislado. Al ser un 'Costo', una reducción (CON < SIN) implica que es Ganador." />
                            </td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_soc_exp, conData.ben_soc_exp, sin_soc_exp_matched, true)}</td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_soc_imp, conData.ben_soc_imp, sin_soc_imp_matched, true)}</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="2. Beneficio Generador (Δ)" description="Variación del Beneficio neto del Generador al conectarse." />
                            </td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_gen_exp, conData.ben_gen_exp, sin_gen_exp_matched)}</td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_gen_imp, conData.ben_gen_imp, sin_gen_imp_matched)}</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="3. Costo de Demanda (Δ)" description="Variación del Costo total de la Demanda al conectarse. Al ser un 'Costo', una reducción (CON < SIN) implica que es Ganador." />
                            </td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_dem_exp, conData.cos_dem_exp, sin_dem_exp_matched, true)}</td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_dem_imp, conData.cos_dem_imp, sin_dem_imp_matched, true)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Selección y Configuración (ASIA)</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Línea de Transmisión Analizada:</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 font-medium"
                            value={selectedLine}
                            onChange={(e) => setSelectedLine(e.target.value)}
                        >
                            {lineOptions.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Asignación Contractual (MW-Mile):</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 font-medium"
                            value={mwMileRule}
                            onChange={(e) => setMwMileRule(e.target.value)}
                        >
                            <option value="importer_pays">Importador Paga (100%)</option>
                            <option value="exporter_pays">Exportador Paga (100%)</option>
                            <option value="split_50_50">Split (50% - 50%)</option>
                        </select>
                    </div>
                    <div className="flex flex-col justify-end gap-2">
                        <label className="flex items-center space-x-3 cursor-pointer p-2 border border-blue-200 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 rounded" checked={projectToYear} onChange={e => setProjectToYear(e.target.checked)} />
                            <span className="text-sm font-semibold text-blue-800">
                                <TooltipLabel label="Proyectar a 1 Año" description="Calcula los cargos, flujos y demandas multiplicados por las Horas/Año configuradas, llevando el análisis Ex-post de valores horarios a resultados anualizados." />
                            </span>
                        </label>
                        <label className="flex items-center space-x-3 cursor-pointer p-2 border border-gray-200 rounded hover:bg-gray-50">
                            <input type="checkbox" className="form-checkbox h-5 w-5 text-blue-600 rounded" checked={useServed} onChange={e => setUseServed(e.target.checked)} />
                            <span className="text-sm font-semibold text-gray-700">
                                <TooltipLabel
                                    label="Usar Demanda Servida (Postage Stamp)"
                                    description="Si está marcado, la tarifa de sello postal se calcula y se cobra tomando en cuenta solo la demanda efectivamente servida (es decir Demanda - Energía No Suministrada). Si está desmarcado, se usarán los compromisos de las demandas brutas totales de cada país asumiendo que el peaje es independiente de los cortes (ENS)."
                                />
                            </span>
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {Object.keys(asiaInputs).map(k => {
                        const dictDesc = {
                            capex_usd: 'Costo total de capital de la línea o sistema (USD).',
                            life_years: 'Años de vida útil para la amortización.',
                            r_annual: 'Tasa de descuento anual (%).',
                            om_frac_annual: 'Fracción del CAPEX correspondiente a O&M anual.',
                            hours_year: 'Horas operativas en el año para llevar el costo a base horaria.'
                        };
                        return (
                            <div key={k} className="bg-gray-50 p-2 rounded border border-gray-200">
                                <label className="block text-xs text-gray-500 font-bold mb-1"><TooltipLabel label={k} description={dictDesc[k]} /></label>
                                <input type="number" name={k} value={asiaInputs[k]} onChange={handleInput} className="w-full p-1 border-b focus:outline-none focus:border-blue-500 text-sm bg-transparent" />
                            </div>
                        )
                    })}
                </div>

                <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-bold text-gray-700 mb-3">Distancias por Línea (Millas)</h4>
                    <div className="flex gap-4 flex-wrap">
                        {lineOptions.map(l => (
                            <div key={l} className="bg-blue-50 p-2 rounded border border-blue-100 w-32">
                                <label className="block text-xs text-blue-700 font-bold mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{l}</label>
                                <input type="number" value={miles[l] || 0} onChange={(e) => handleMileInput(e, l)} className="w-full p-1 border-b border-blue-200 focus:outline-none focus:border-blue-500 text-sm bg-transparent" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {out ? ((() => {
                const unitCost = out.projectToYear ? '/año' : '/h';
                const unitEner = out.projectToYear ? 'MWh' : 'MW';
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Panel Izquierdo: Parametros Financieros */}
                        <div className="bg-white p-6 rounded-lg shadow-lg border-t-4 border-indigo-500 flex flex-col">
                            <h3 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Parámetros Financieros (Sistema)</h3>
                            <table className="w-full text-sm divide-y divide-gray-200 mb-6 flex-grow">
                                <tbody className="divide-y divide-gray-100">
                                    <tr>
                                        <td className="py-2 text-gray-600 font-medium">Anualidad (CAPEX):</td>
                                        <td className="py-2 text-right">
                                            <div className="flex justify-end overflow-visible">
                                                <TooltipLabel align="left" label={`$${formatCurr(out.annuity)} /año`} formula={`CAPEX: $${formatCurr(out.capex)} * Factor_Recuperación(r=${(out.r * 100).toFixed(2)}%, n=${out.n})`} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 text-gray-600 font-medium overflow-visible"><TooltipLabel label="Ingreso Requerido Anual (ARR)" description="Costo total de la inversión a recuperar por año incluyendo la amortización anualizada y los gastos de operación." formula="Anualidad + CAPEX * O&M" /></td>
                                        <td className="py-2 text-right">
                                            <div className="flex justify-end overflow-visible">
                                                <TooltipLabel align="left" label={<span className="font-semibold text-blue-700">${formatCurr(out.arr)} /año</span>} formula={`Anualidad: $${formatCurr(out.annuity)} + O&M_Anual: $${formatCurr(out.capex * out.om)}`} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 text-gray-600 font-medium overflow-visible"><TooltipLabel label="Revenue Requirement Horario (RR)" description="Ingreso Requerido llevado a base horaria que debe ser sufragado en los peajes ex-post por hora." formula="ARR / Horas_Año" /></td>
                                        <td className="py-2 text-right">
                                            <div className="flex justify-end overflow-visible">
                                                <TooltipLabel align="left" label={<span className="font-bold text-indigo-700 bg-indigo-50 px-2 rounded">${formatCurr(out.rr_h)} /h</span>} formula={`ARR: $${formatCurr(out.arr)} / ${out.h} h`} />
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                                <h4 className="text-center font-bold text-gray-700 border-b border-gray-200 pb-2 mb-3">Costos Base</h4>
                                <div className="flex justify-between items-center text-sm py-1">
                                    <span className="text-gray-600 font-medium"><TooltipLabel label="Tarifa Stamp" description="Costo unitario uniforme para la demanda de todo el sistema." formula="RR_Deseado / Demanda" /></span>
                                    <div className="font-mono bg-white px-2 py-1 rounded border shadow-sm">
                                        <TooltipLabel align="right" label={`$${out.stamp_tariff.toFixed(6)} /MWh`} formula={`Ingreso Req: $${formatCurr(out.target_rr)}${unitCost} / Demanda: ${formatCurr(out.totalDem)} ${unitEner}`} />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm py-1">
                                    <span className="text-gray-600 font-medium"><TooltipLabel label="Tarifa Unitaria MW-Mile" description="Costo unitario por MW transportado a través de cada milla." formula="RR_Deseado / (|Flujo_Linea| * Millas_Linea)" /></span>
                                    <div className="font-mono bg-white px-2 py-1 rounded border shadow-sm">
                                        <TooltipLabel align="right" label={`$${out.mwm_unit.toFixed(6)}`} formula={out.selF > 0 && out.selL > 0 ? `Ingreso Req: $${formatCurr(out.target_rr)}${unitCost} / (|Flujo|: ${formatCurr(out.selF)} ${unitEner} * Millas: ${out.selL})` : 'Flujo nulo o Distancia Cero'} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Panel Derecho: Resultados Ex-post por País */}
                        <div className="bg-white p-6 rounded-lg shadow-lg border-t-4 border-purple-500">
                            <h3 className="text-2xl font-bold text-gray-800 mb-2">Asignación ASIA: <span className="text-purple-600">{selectedLine}</span></h3>
                            <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded border w-max">Exportador: <strong className="text-gray-700">{out.c_exp}</strong> &nbsp;|&nbsp; Importador: <strong className="text-gray-700">{out.c_imp}</strong> &nbsp;|&nbsp; Flujo: <strong>{formatCurr(out.selF)} {unitEner}</strong></p>

                            <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-purple-50 text-purple-900">
                                        <tr>
                                            <th className="px-4 py-3 text-left">País de la Transacción</th>
                                            <th className="px-4 py-3 text-right">Postage Stamp (${unitCost})</th>
                                            <th className="px-4 py-3 text-right">MW-Mile Paga (${unitCost})</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {[out.c_exp, out.c_imp].filter(Boolean).map(c => (
                                            <tr key={c} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-gray-700">{c} {c === out.c_exp ? '(Exp)' : '(Imp)'}</td>
                                                <td className="px-4 py-3 text-right text-gray-600">
                                                    <div className="flex justify-end overflow-visible">
                                                        <TooltipLabel align="center" label={`$${formatCurr(out.stamp_pay_country[c])}`} formula={`Demanda: ${formatCurr(out.dem_by_country[c])} ${unitEner} * Tarifa: $${out.stamp_tariff.toFixed(4)}/MWh`} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-purple-700">
                                                    <div className="flex justify-end overflow-visible">
                                                        <TooltipLabel align="right" label={`$${formatCurr(out.mwm_pay_country[c])}`} formula={out.mwm_pay_country[c] > 0 ? `Regla Contractual Asigna Cargo Lineal Completo o Mitad a este País` : `N/A`} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                                            <td className="px-4 py-3 font-semibold text-gray-800">Costo atribuido a la línea</td>
                                            <td colSpan={2} className="px-4 py-3 text-right font-bold text-gray-800">
                                                <div className="flex justify-end overflow-visible">
                                                    <TooltipLabel align="right" label={`$${formatCurr(out.selCost)} ${unitCost}`} formula={`Costo Atribuido Directo = Ingreso Requerido = $${formatCurr(out.target_rr)}${unitCost}`} />
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 p-3 bg-purple-50 border border-purple-100 rounded text-xs text-purple-800">
                                <strong>Resultados Sistémicos: </strong> Al evaluar los peajes en toda la latitud de la red, el sistema reporta una recaudación MW-Mile global de <strong>${formatCurr(Object.values(out.mwm_pay_country).reduce((a, b) => a + b, 0))}</strong> igualando el RR Operativo.
                            </div>
                        </div>

                        {/* Ex Post ASIA 3 Models Section */}
                        <div className="lg:col-span-2 mt-4 bg-white p-6 rounded-lg shadow-lg border-t-4 border-indigo-500">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-800">Análisis Adicional: 3 Modelos Ex-Post (ASIA)</h3>
                                    <p className="text-sm text-gray-600 mt-1">Evalúa la posición de los agentes incorporando el impacto del Peaje ASIA seleccionado.</p>
                                </div>
                                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                                    <button
                                        onClick={() => setExpostMethodSwitch('stamp')}
                                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${expostMethodSwitch === 'stamp' ? 'bg-purple-600 text-white shadow' : 'text-gray-600 hover:text-purple-600'}`}
                                    >
                                        Sello Postal
                                    </button>
                                    <button
                                        onClick={() => setExpostMethodSwitch('mwm')}
                                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${expostMethodSwitch === 'mwm' ? 'bg-purple-600 text-white shadow' : 'text-gray-600 hover:text-purple-600'}`}
                                    >
                                        MW-Mile
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {renderExpostTableAsia(exPostCon)}
                                {renderExpostTableAsia(exPostSin)}
                                {renderWinnersLosersTableAsia(exPostCon, exPostSin)}
                            </div>
                        </div>
                    </div>
                );
            })()) : (
                <div className="p-8 text-center text-gray-500 italic bg-white rounded border border-gray-200 shadow-sm">
                    Ejecuta la simulación o comprueba que los parámetros existan para ver los resultados de ASIA.
                </div>
            )}
        </div>
    );
};

const EuropaTab = ({ results, params }) => {
    const lineOptions = params ? Object.keys(params.LINES) : [];
    const [selectedLine, setSelectedLine] = useState(lineOptions.length > 0 ? lineOptions[0] : '');

    const [europaInputs, setEuropaInputs] = useState({
        itc_rate_usd_per_mwh: 0.50,
        cid_split: 0.50,
        infra_fund_usd_per_hour: 0.0,
        infra_split_ft: 0.75,
        infra_split_fl: 0.25
    });
    const [expostMethodSwitch, setExpostMethodSwitch] = useState('A1');

    const handleInput = (e) => {
        const { name, value } = e.target;
        setEuropaInputs(prev => ({ ...prev, [name]: value === '' ? '' : Number(value) }));
    };

    const calculateEuropa = () => {
        if (!results || !results.con || !results.con.df_cr || !selectedLine) return null;

        const df_cr = results.con.df_cr;
        const df_lmp = results.con.lmp;
        if (!df_cr || !df_lmp) return null;

        // 1) Export/Import/NF
        const ex = {}; const im = {};
        Object.values(params.NODES).forEach(c => { ex[c] = 0; im[c] = 0; });

        df_cr.forEach(r => {
            if (!r.F || Math.abs(r.F) < 1e-9 || !params.LINES[r.line]) return;
            const c_fr = params.NODES[params.LINES[r.line].fr];
            const c_to = params.NODES[params.LINES[r.line].to];
            if (r.F >= 0) {
                ex[c_fr] += r.F;
                im[c_to] += r.F;
            } else {
                ex[c_to] += Math.abs(r.F);
                im[c_fr] += Math.abs(r.F);
            }
        });

        const trade = {};
        Object.values(params.NODES).forEach(c => {
            const nf = Math.abs(ex[c] - im[c]);
            const t = Math.min(ex[c], im[c]);
            trade[c] = { export_MW: ex[c], import_MW: im[c], NF_MW: nf, T_MW: t };
        });

        // 2) ITC
        const rate = Number(europaInputs.itc_rate_usd_per_mwh);
        const fund = Number(europaInputs.infra_fund_usd_per_hour);
        const splitFT = Number(europaInputs.infra_split_ft);
        const splitFL = Number(europaInputs.infra_split_fl);

        let T_total = 0;
        Object.values(trade).forEach(t => T_total += t.T_MW);

        const itc = {};
        Object.values(params.NODES).forEach(c => {
            itc[c] = { pay: trade[c].NF_MW * rate, income: 0, F_T: 0, F_L: 0 };
        });

        if (fund > 0 && T_total > 1e-9) {
            let denomFL = 0;
            const termFL = {};
            const L_MW = {};
            if (results.con.df_dem) {
                results.con.df_dem.forEach(d => {
                    L_MW[d.country] = (L_MW[d.country] || 0) + d.D;
                });
            }

            Object.values(params.NODES).forEach(c => {
                const load = L_MW[c] || 0;
                const T = trade[c].T_MW;
                const denom = load + T;
                termFL[c] = denom > 0 ? (T / denom) ** 2 : 0;
                denomFL += termFL[c];
            });

            Object.values(params.NODES).forEach(c => {
                const F_T = trade[c].T_MW / T_total;
                const F_L = denomFL > 1e-12 ? termFL[c] / denomFL : 0;
                itc[c].F_T = F_T;
                itc[c].F_L = F_L;
                itc[c].income = fund * (splitFT * F_T + splitFL * F_L);
            });
        }

        // 3) CID
        const cid_tso = {};
        Object.values(params.NODES).forEach(c => cid_tso[c] = 0);

        const lam_node = {};
        df_lmp.forEach(l => lam_node[l.node] = l.lambda);

        const cid_split = Number(europaInputs.cid_split);
        const cid_borders = [];

        df_cr.forEach(r => {
            if (!r.F || Math.abs(r.F) < 1e-9 || !params.LINES[r.line] || r.line === '-') return;
            const lineDef = params.LINES[r.line];
            const f_phys = Math.abs(r.F);
            let exp_node, imp_node;

            if (r.F >= 0) {
                exp_node = lineDef.fr; imp_node = lineDef.to;
            } else {
                exp_node = lineDef.to; imp_node = lineDef.fr;
            }

            const c_exp = params.NODES[exp_node];
            const c_imp = params.NODES[imp_node];
            const lam_exp = lam_node[exp_node] || 0;
            const lam_imp = lam_node[imp_node] || 0;
            const spread = lam_imp - lam_exp;

            const cid_total = f_phys * spread;
            const cid_exp = cid_split * cid_total;
            const cid_imp = (1 - cid_split) * cid_total;

            cid_tso[c_exp] += cid_exp;
            cid_tso[c_imp] += cid_imp;

            cid_borders.push({
                line: r.line, c_exp, c_imp, f_phys, spread, cid_total, cid_exp, cid_imp
            });
        });

        // 4) Settlement
        const settlement = {};
        Object.values(params.NODES).forEach(c => {
            settlement[c] = cid_tso[c] + itc[c].income - itc[c].pay;
        });

        // Current Line Focus
        let sel_c_exp = '', sel_c_imp = '';
        let selF = 0;
        const row = df_cr.find(r => r.line === selectedLine);
        if (row && params.LINES[selectedLine]) {
            selF = Math.abs(row.F);
            if (row.F >= 0) {
                sel_c_exp = params.NODES[params.LINES[selectedLine].fr];
                sel_c_imp = params.NODES[params.LINES[selectedLine].to];
            } else {
                sel_c_exp = params.NODES[params.LINES[selectedLine].to];
                sel_c_imp = params.NODES[params.LINES[selectedLine].fr];
            }
        }

        return {
            trade, itc, cid_tso, cid_borders, settlement,
            sel_c_exp, sel_c_imp, selF
        };
    };

    const out = calculateEuropa();

    const getExpostMatrixEuropa = (caseType, option) => {
        if (!results || !results[caseType]) return null;
        const res = results[caseType];

        let c_exp = '', c_imp = '';
        if (results.con && results.con.df_cr && params.LINES[selectedLine]) {
            const row = results.con.df_cr.find(r => r.line === selectedLine);
            if (row) {
                if (row.F >= 0) {
                    c_exp = params.NODES[params.LINES[selectedLine].fr];
                    c_imp = params.NODES[params.LINES[selectedLine].to];
                } else {
                    c_exp = params.NODES[params.LINES[selectedLine].to];
                    c_imp = params.NODES[params.LINES[selectedLine].fr];
                }
            }
        }
        if (!c_exp || !c_imp) return null;

        const getStats = (c, statsObj) => {
            const gens = res.df_gen ? res.df_gen.filter(r => r.country === c) : [];
            const dems = res.df_dem ? res.df_dem.filter(r => r.country === c) : [];
            statsObj.op = gens.reduce((sum, r) => sum + (r.var_cost || 0), 0) + dems.reduce((sum, r) => sum + (r.cost_ens || 0), 0);
            statsObj.profit = gens.reduce((sum, r) => sum + (r.profit || 0), 0);
            statsObj.dem = dems.reduce((sum, r) => sum + (r.dem_total_cost || 0), 0);
        };
        const stats_exp = {}; const stats_imp = {};
        getStats(c_exp, stats_exp); getStats(c_imp, stats_imp);

        const ex = {}; const im = {};
        Object.values(params.NODES).forEach(c => { ex[c] = 0; im[c] = 0; });
        if (res.df_cr) {
            res.df_cr.forEach(r => {
                if (!r.F || Math.abs(r.F) < 1e-9 || !params.LINES[r.line] || r.line === '-') return;
                const c_fr = params.NODES[params.LINES[r.line].fr];
                const c_to = params.NODES[params.LINES[r.line].to];
                if (r.F >= 0) { ex[c_fr] += r.F; im[c_to] += r.F; }
                else { ex[c_to] += Math.abs(r.F); im[c_fr] += Math.abs(r.F); }
            });
        }
        const nf_exp = Math.abs(ex[c_exp] - im[c_exp]);
        const nf_imp = Math.abs(ex[c_imp] - im[c_imp]);

        const rate = Number(europaInputs.itc_rate_usd_per_mwh);
        const itc_pay_exp = nf_exp * rate;
        const itc_pay_imp = nf_imp * rate;

        const cid_split = Number(europaInputs.cid_split);
        const lam_node = {};
        if (res.lmp) res.lmp.forEach(l => lam_node[l.node] = l.lambda);

        let cid_inc_exp = 0, cid_inc_imp = 0;
        if (res.df_cr) {
            res.df_cr.forEach(r => {
                if (!r.F || Math.abs(r.F) < 1e-9 || !params.LINES[r.line] || r.line === '-') return;
                const lineDef = params.LINES[r.line];
                const f_phys = Math.abs(r.F);
                let e_node, i_node;
                if (r.F >= 0) { e_node = lineDef.fr; i_node = lineDef.to; }
                else { e_node = lineDef.to; i_node = lineDef.fr; }

                const cur_c_exp = params.NODES[e_node];
                const cur_c_imp = params.NODES[i_node];
                const spread = (lam_node[i_node] || 0) - (lam_node[e_node] || 0);

                const c_total = f_phys * spread;
                if (cur_c_exp === c_exp) cid_inc_exp += cid_split * c_total;
                if (cur_c_imp === c_exp) cid_inc_exp += (1 - cid_split) * c_total;
                if (cur_c_exp === c_imp) cid_inc_imp += cid_split * c_total;
                if (cur_c_imp === c_imp) cid_inc_imp += (1 - cid_split) * c_total;
            });
        }

        const peaje_charge_exp = option === 'A1' ? itc_pay_exp : (itc_pay_exp - cid_inc_exp);
        const peaje_charge_imp = option === 'A1' ? itc_pay_imp : (itc_pay_imp - cid_inc_imp);

        const ben_soc_exp = stats_exp.op + peaje_charge_exp;
        const ben_soc_imp = stats_imp.op + peaje_charge_imp;

        const ben_gen_exp = option === 'A1' ? (stats_exp.profit - itc_pay_exp + cid_inc_exp) : (stats_exp.profit - peaje_charge_exp);
        const ben_gen_imp = option === 'A1' ? (stats_imp.profit - itc_pay_imp + cid_inc_imp) : (stats_imp.profit - peaje_charge_imp);

        const cos_dem_exp = stats_exp.dem + peaje_charge_exp;
        const cos_dem_imp = stats_imp.dem + peaje_charge_imp;

        let tau_exp = nf_exp > 1e-12 ? (peaje_charge_exp / nf_exp) : 0;
        let tau_imp = nf_imp > 1e-12 ? (peaje_charge_imp / nf_imp) : 0;

        return {
            caseType: caseType.toUpperCase(),
            method: option,
            c_exp, c_imp,
            tau_exp, tau_imp,
            ben_soc_exp, ben_soc_imp,
            ben_gen_exp, ben_gen_imp,
            cos_dem_exp, cos_dem_imp
        };
    };

    const exPostCon = getExpostMatrixEuropa('con', expostMethodSwitch);
    const exPostSin = getExpostMatrixEuropa('sin', expostMethodSwitch);

    const formatCurr = (val) => val ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

    const renderExpostTableEuropa = (data) => {
        if (!data) return null;
        return (
            <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                <h4 className="bg-gray-100 text-gray-700 font-bold px-4 py-3 border-b border-gray-200 uppercase text-sm tracking-widest text-center flex justify-between items-center">
                    <span>Caso {data.caseType}</span>
                    <span className="text-xs font-mono bg-green-100 text-green-700 px-2 py-1 rounded">
                        Opción {data.method} - tau(Exp): ${data.tau_exp.toFixed(2)} | tau(Imp): ${data.tau_imp.toFixed(2)}
                    </span>
                </h4>
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-green-50 text-green-900">
                        <tr>
                            <th className="px-4 py-3 text-left">Modelo Ex-Post</th>
                            <th className="px-4 py-3 text-right">Exp: {data.c_exp}</th>
                            <th className="px-4 py-3 text-right">Imp: {data.c_imp}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="1. Beneficio Social" description="Costo operativo del país más el Peaje equivalente." formula="C_op + Peaje_Equivalente" />
                            </td>
                            <td className="px-4 py-2 text-right">${formatCurr(data.ben_soc_exp)}</td>
                            <td className="px-4 py-2 text-right">${formatCurr(data.ben_soc_imp)}</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="2. Beneficio Generador" description={data.method === 'A1' ? "Beneficio del generador menos el pago ITC más los ingresos de congestión adjudicados (CID)." : "Beneficio del generador deduciendo el Peaje Integrado Neto A2."} formula={data.method === 'A1' ? "Σ Profit_Generador - ITC_Pay + CID_Income" : "Σ Profit_Generador - Peaje_A2"} />
                            </td>
                            <td className="px-4 py-2 text-right">${formatCurr(data.ben_gen_exp)}</td>
                            <td className="px-4 py-2 text-right">${formatCurr(data.ben_gen_imp)}</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="3. Costo de Demanda" description="La suma de los pagos de demanda del país más el Peaje equivalente." formula="Costo_Demanda + Peaje_Equivalente" />
                            </td>
                            <td className="px-4 py-2 text-right">${formatCurr(data.cos_dem_exp)}</td>
                            <td className="px-4 py-2 text-right">${formatCurr(data.cos_dem_imp)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Selección y Configuración (EUROPA / ENTSO-E)</h3>

                <div className="grid grid-cols-1 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Línea de Transmisión Analizada:</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 font-medium"
                            value={selectedLine}
                            onChange={(e) => setSelectedLine(e.target.value)}
                        >
                            {lineOptions.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {Object.keys(europaInputs).map(k => {
                        const dictDesc = {
                            itc_rate_usd_per_mwh: 'Tarifa de Porte (ITC Rate). Cargo aplicado al flujo neto comercializado (USD/MWh).',
                            cid_split: 'Reparto Renta (CID). Proporción de la renta fronteriza adjudicada al TSO exportador (0 a 1).',
                            infra_fund_usd_per_hour: 'Fondo de Infraestructura. Compensación adicional a repartir por el Tránsito (USD/h). Cero si no aplica.',
                            infra_split_ft: 'Proporción del fondo que se reparte por volumen de TRÁNSITO (FT).',
                            infra_split_fl: 'Proporción del fondo que se reparte por factor de CARGA + TRÁNSITO (FL).'
                        };
                        return (
                            <div key={k} className="bg-gray-50 p-2 rounded border border-gray-200">
                                <label className="block text-xs text-gray-500 font-bold mb-1"><TooltipLabel label={k} description={dictDesc[k]} /></label>
                                <input type="number" name={k} value={europaInputs[k]} onChange={handleInput} step="0.01" className="w-full p-1 border-b focus:outline-none focus:border-blue-500 text-sm bg-transparent" />
                            </div>
                        )
                    })}
                </div>
            </div>

            {out && out.sel_c_exp ? (
                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-lg border-t-4 border-green-500">
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">Liquidación de TSO Ex-Post: <span className="text-green-600">{selectedLine}</span></h3>
                        <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded border w-max">Exportador (TSO A): <strong className="text-gray-700">{out.sel_c_exp}</strong> &nbsp;|&nbsp; Importador (TSO B): <strong className="text-gray-700">{out.sel_c_imp}</strong> &nbsp;|&nbsp; Flujo Físico: <strong>{formatCurr(out.selF)} MW</strong></p>

                        <div className="shadow-sm rounded-lg border border-gray-200 overflow-visible">
                            <table className="min-w-full divide-y divide-gray-200 text-sm overflow-visible">
                                <thead className="bg-green-50 text-green-900">
                                    <tr>
                                        <th className="px-4 py-3 text-left">País / TSO</th>
                                        <th className="px-4 py-3 text-right font-medium overflow-visible">
                                            <TooltipLabel label="Flujo Neto (NF)" description="Magnitud física neta de intercambio del país. Balance agregado absoluto (Exportaciones - Importaciones)." formula="|ΣExp - ΣImp|" />
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium overflow-visible">
                                            <TooltipLabel label="Tránsito (T)" description="Volumen de energía que atraviesa la red del país sin ser consumida. El mínimo entre sus inyecciones y retiros transfronterizos." formula="min(ΣExp, ΣImp)" />
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium overflow-visible">
                                            <TooltipLabel label="Pago ITC ($/h)" description="Cuota por compensación inter-TSO que asume el país en base a su Flujo Neto." formula="ITC_Rate * NF" />
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium overflow-visible">
                                            <TooltipLabel label="Ingreso ITC Infra ($/h)" description="Ingreso proveniente del fondo global de infraestructura, repartido mediante métricas de red." formula="Fondo * (FT*Tránsito_T + FL*Carga_L)" />
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium overflow-visible">
                                            <TooltipLabel label="Ingreso CID ($/h)" description="Recaudación transfronteriza fraccionada originada por las transferencias internacionales (Renta de Congestión)." formula="Σ (CID_Split * |Flujo| * Spread_Nodos)" />
                                        </th>
                                        <th className="px-4 py-3 text-right font-bold text-green-800 overflow-visible">
                                            <TooltipLabel label="Liquidación Final ($/h)" description="Balance comercial operativo global consolidado para el TSO." formula="Ingreso_CID + Ingreso_ITC - Pago_ITC" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {[out.sel_c_exp, out.sel_c_imp].filter(Boolean).map(c => (
                                        <tr key={c} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-semibold text-gray-700">{c} {c === out.sel_c_exp ? '(Exp)' : '(Imp)'}</td>
                                            <td className="px-4 py-3 text-right">{formatCurr(out.trade[c].NF_MW)} MW</td>
                                            <td className="px-4 py-3 text-right">{formatCurr(out.trade[c].T_MW)} MW</td>
                                            <td className="px-4 py-3 text-right text-red-600">-${formatCurr(out.itc[c].pay)}</td>
                                            <td className="px-4 py-3 text-right text-blue-600">${formatCurr(out.itc[c].income)}</td>
                                            <td className="px-4 py-3 text-right text-blue-600">${formatCurr(out.cid_tso[c])}</td>
                                            <td className="px-4 py-3 text-right font-bold text-green-700">${formatCurr(out.settlement[c])}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 border-t-2 border-gray-300">
                                        <td className="px-4 py-3 font-semibold text-gray-800 text-right pr-4" colSpan={6}>Balance Total Operativo del Sistema ENTSO-E (Ex-Post)</td>
                                        <td className="px-4 py-3 text-right font-bold text-gray-800">${formatCurr(Object.values(out.settlement).reduce((a, b) => a + b, 0))} /h</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded text-xs text-green-800">
                            <strong>Mecanismo de Compensación ENTSO-E (Europa): </strong> La liquidación final deduce la cuota por uso de la red proporcional a sus extracciones netas evaluadas (Pago ITC), y suma la renta de congestión adjudicada de sus diferentes fronteras (Ingreso CID) junto con los ingresos compensatorios provenientes del fondo de infraestructura (Ingreso ITC).
                        </div>
                    </div>

                    {/* Ex Post EUROPA 3 Models Section */}
                    {results && results.cba_europa && (
                        <div className="mt-4 bg-white p-6 rounded-lg shadow-lg border-t-4 border-indigo-500">
                            <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">Análisis Adicional: 3 Modelos Ex-Post (EUROPA) y CBCA</h3>

                            {/* Anual Results */}
                            <div className="mb-8">
                                <h4 className="text-xl font-bold text-gray-700 mb-4">Impactos Anuales (MUSD/año)</h4>
                                <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-indigo-50 text-indigo-900">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">País</th>
                                                <th className="px-4 py-3 text-right font-semibold">Δ CS</th>
                                                <th className="px-4 py-3 text-right font-semibold">Δ PS</th>
                                                <th className="px-4 py-3 text-right font-semibold">Δ SEW (sin CR)</th>
                                                <th className="px-4 py-3 text-right font-semibold">CO2</th>
                                                <th className="px-4 py-3 text-right font-semibold">SoS</th>
                                                <th className="px-4 py-3 text-right font-semibold text-blue-800">Beneficios A</th>
                                                <th className="px-4 py-3 text-right font-semibold">CR Asignada</th>
                                                <th className="px-4 py-3 text-right font-semibold text-blue-800">Beneficios B</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {results.cba_europa.annual.map(row => (
                                                <tr key={row.country} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 font-medium text-gray-800">{row.country}</td>
                                                    <td className="px-4 py-2 text-right">{formatCurr(row.Delta_CS_MUSDy)}</td>
                                                    <td className="px-4 py-2 text-right">{formatCurr(row.Delta_PS_MUSDy)}</td>
                                                    <td className="px-4 py-2 text-right">{formatCurr(row.Delta_SEW_noCR_MUSDy)}</td>
                                                    <td className="px-4 py-2 text-right text-gray-600">{formatCurr(row.CO2_MUSDy)}</td>
                                                    <td className="px-4 py-2 text-right text-gray-600">{formatCurr(row.SoS_MUSDy)}</td>
                                                    <td className="px-4 py-2 text-right font-bold text-blue-700">{formatCurr(row.Benefits_A_noCR_MUSDy)}</td>
                                                    <td className="px-4 py-2 text-right text-purple-600">{formatCurr(row.CR_alloc_MUSDy)}</td>
                                                    <td className="px-4 py-2 text-right font-bold text-blue-700">{formatCurr(row.Benefits_B_withCR_MUSDy)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Summary Models */}
                            <div className="mb-8">
                                <h4 className="text-xl font-bold text-gray-700 mb-4">Tabla Resumen de Modelos Ex-Post (CON - SIN) en MUSD/año</h4>
                                <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-100 text-gray-800">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold">Modelo</th>
                                                <th className="px-4 py-3 text-right font-semibold">CHILE</th>
                                                <th className="px-4 py-3 text-right font-semibold">PERU</th>
                                                <th className="px-4 py-3 text-right font-semibold">ARGENTINA</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {results.cba_europa.summary_models.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-4 py-2 font-medium text-gray-800">{row.modelo}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{formatCurr(row.CHILE)}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{formatCurr(row.PERU)}</td>
                                                    <td className="px-4 py-2 text-right font-mono">{formatCurr(row.ARGENTINA)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* PV and CBCA */}
                            <div>
                                <h4 className="text-xl font-bold text-gray-700 mb-4">Valor Presente (PV) y CBCA (MUSD)</h4>
                                <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-green-50 text-green-900 border-b-2 border-green-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold" rowSpan="2">País</th>
                                                <th className="px-4 py-2 text-center font-semibold border-b border-green-200" colSpan="3">Enfoque A (Sin CR)</th>
                                                <th className="px-4 py-2 text-center font-semibold border-b border-green-200 border-l border-green-200" colSpan="3">Enfoque B (Con CR Asignada)</th>
                                            </tr>
                                            <tr>
                                                <th className="px-4 py-2 text-right text-xs">PV Ben A</th>
                                                <th className="px-4 py-2 text-right text-xs">Costo A</th>
                                                <th className="px-4 py-2 text-right text-xs">NPV A</th>
                                                <th className="px-4 py-2 text-right text-xs border-l border-green-200">PV Ben B</th>
                                                <th className="px-4 py-2 text-right text-xs">Costo B</th>
                                                <th className="px-4 py-2 text-right text-xs">NPV B</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {results.cba_europa.pv.map(row => (
                                                <tr key={row.country} className="hover:bg-green-50">
                                                    <td className="px-4 py-2 font-medium text-gray-800 border-r border-gray-100">{row.country}</td>

                                                    <td className="px-4 py-2 text-right">{formatCurr(row.PV_Benefits_A_noCR_MUSD)}</td>
                                                    <td className="px-4 py-2 text-right text-red-600">{formatCurr(row.CBCA_Cost_A_MUSD)}</td>
                                                    <td className={`px-4 py-2 text-right font-bold ${row.CBCA_NPV_A_MUSD >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {formatCurr(row.CBCA_NPV_A_MUSD)}
                                                    </td>

                                                    <td className="px-4 py-2 text-right border-l border-gray-200">{formatCurr(row.PV_Benefits_B_withCR_MUSD)}</td>
                                                    <td className="px-4 py-2 text-right text-red-600">{formatCurr(row.CBCA_Cost_B_MUSD)}</td>
                                                    <td className={`px-4 py-2 text-right font-bold ${row.CBCA_NPV_B_MUSD >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {formatCurr(row.CBCA_NPV_B_MUSD)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                                    <div className="bg-gray-50 border border-gray-200 rounded p-2"><strong>CAPEX Base:</strong> {formatCurr(results.cba_europa.scalar_summary.CAPEX_base_MUSD)} MUSD</div>
                                    <div className="bg-gray-50 border border-gray-200 rounded p-2"><strong>PV OPEX:</strong> {formatCurr(results.cba_europa.scalar_summary.PV_OPEX_MUSD)} MUSD</div>
                                    <div className="bg-gray-50 border border-gray-200 rounded p-2"><strong>NPV Social Total:</strong> <span className={results.cba_europa.scalar_summary.NPV_social_total_MUSD >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{formatCurr(results.cba_europa.scalar_summary.NPV_social_total_MUSD)} MUSD</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-8 text-center text-gray-500 italic bg-white rounded border border-gray-200 shadow-sm">
                    Ejecuta la simulación para ver los resultados de EUROPA.
                </div>
            )}
        </div>
    );
};

const SiepacTab = ({ results, params }) => {
    const lineOptions = params ? Object.keys(params.LINES) : [];
    const [selectedLine, setSelectedLine] = useState(lineOptions.length > 0 ? lineOptions[0] : '');

    const lineDef = selectedLine && params ? params.LINES[selectedLine] : null;
    const countryA = lineDef ? params.NODES[lineDef.fr] : '';
    const countryB = lineDef ? params.NODES[lineDef.to] : '';

    const [countryTarget, setCountryTarget] = useState('');
    const [expostTimeScale, setExpostTimeScale] = useState('semestral');
    useEffect(() => {
        if (countryA) setCountryTarget(countryA);
    }, [countryA, selectedLine]);

    const defaultRegInputs = {
        capex: 939644790.0,
        life_years: 25,
        r_annual: 0.06,
        om_frac_annual: 0.015,
        CVTn_sem_USD: 0.0,
        SCF_USD: 0.0,
        SCE_USD: 0.0,
        IVDT_USD: 0.0,
        alpha_R: 0.70,
        alpha_I: 0.30
    };

    const [allRegInputs, setAllRegInputs] = useState({});

    const regInputs = allRegInputs[selectedLine] || defaultRegInputs;

    const handleInput = (e) => {
        if (!selectedLine) return;
        const { name, value } = e.target;
        setAllRegInputs(prev => {
            const currentLineInputs = prev[selectedLine] || { ...defaultRegInputs };
            return {
                ...prev,
                [selectedLine]: { ...currentLineInputs, [name]: value === '' ? '' : Number(value) }
            };
        });
    };

    const calculateSiepac = () => {
        if (!results || !results.con || !results.con.df_cr || !selectedLine || !countryTarget) return null;

        const df_cr = results.con.df_cr;
        const row = df_cr.find(r => r.line === selectedLine);
        if (!row) return null;

        const fr = row.from;
        const to = row.to;
        const C = params.LINES[selectedLine].fmax;
        const F = row.F;

        const lmp_fr = row.lam_from || 0;
        const lmp_to = row.lam_to || 0;

        let exporter_node, importer_node, lmp_exp, lmp_imp;
        if (F >= 0) {
            exporter_node = fr; importer_node = to;
            lmp_exp = lmp_fr; lmp_imp = lmp_to;
        } else {
            exporter_node = to; importer_node = fr;
            lmp_exp = lmp_to; lmp_imp = lmp_fr;
        }

        const exporter_country = params.NODES[exporter_node];
        const importer_country = params.NODES[importer_node];

        const participates = (exporter_country === countryTarget) || (importer_country === countryTarget);

        const CVT_h = Math.abs(F) * Math.abs(lmp_imp - lmp_exp);

        const capex = Number(regInputs.capex) || 0;
        const r = Number(regInputs.r_annual) || 0;
        const n_years = Number(regInputs.life_years) || 1;
        const om_frac = Number(regInputs.om_frac_annual) || 0;
        const pow_ = Math.pow(1.0 + r, n_years);
        const A_annuity = r > 0 ? (capex * (r * pow_) / (pow_ - 1.0)) : (capex / n_years);
        const OM_annual = capex * om_frac;
        const IAR_annual = A_annuity + OM_annual;

        const CVTn_sem = Number(regInputs.CVTn_sem_USD) || 0;
        const SCF = Number(regInputs.SCF_USD) || 0;
        const SCE = Number(regInputs.SCE_USD) || 0;
        const IVDT = Number(regInputs.IVDT_USD) || 0;
        const IR = (IAR_annual / 2.0) + (SCF - SCE) - CVTn_sem - IVDT;

        const uso = C > 0 ? Math.min(Math.abs(F) / C, 1.0) : 0.0;
        const P = IR * uso;
        const CC = IR * (1.0 - uso);

        const hours_semester = 24 * 30 * 6; // 4320 hours
        const target_gens = results.con.df_gen ? results.con.df_gen.filter(g => g.country === countryTarget) : [];
        const target_dems = results.con.df_dem ? results.con.df_dem.filter(d => d.country === countryTarget) : [];
        const Ig_MW_hour = target_gens.reduce((sum, g) => sum + (g.P || 0), 0);
        const Rc_MW_hour = target_dems.reduce((sum, d) => sum + (d.served || 0), 0);
        const Ig = Ig_MW_hour * hours_semester || 1;
        const Rc = Rc_MW_hour * hours_semester || 1;

        const alpha_R = Number(regInputs.alpha_R) || 0;
        const alpha_I = Number(regInputs.alpha_I) || 0;

        const IR_total = P + CC;
        const MR = IR_total * alpha_R;
        const MI = IR_total * alpha_I;

        const CURTRC = MR / Rc;
        const CURTRG = MI / Ig;

        return {
            line: selectedLine, C_MW: C, F_MW: F, exporter_node, importer_node,
            exporter_country, importer_country, lmp_exp, lmp_imp,
            CVT_h, IR, uso, P, CC, MR, MI, CURTRC, CURTRG,
            countryTarget, participates,
            // Detalle numerico
            iar_factors: {
                annuity: A_annuity, om: OM_annual, iar_total: IAR_annual,
                scf: SCF, sce: SCE, cvtn: CVTn_sem, ivdt: IVDT
            },
            tariffs_factors: {
                ir_total: IR_total, alpha_R, alpha_I, Rc, Ig
            }
        };
    };

    const calculateExpostModels = (caseType) => {
        if (!results || !results[caseType] || !results[caseType].df_cr || !selectedLine) return null;

        const res = results[caseType];
        const lineDef = params.LINES[selectedLine];
        const fr = lineDef.fr;
        const to = lineDef.to;
        const C = lineDef.fmax;

        let F = 0;
        let CR = 0;
        let lmp_fr = 0, lmp_to = 0;

        const lmp_fr_row = res.lmp.find(r => r.node === fr);
        const lmp_to_row = res.lmp.find(r => r.node === to);
        lmp_fr = lmp_fr_row ? lmp_fr_row.lambda : 0;
        lmp_to = lmp_to_row ? lmp_to_row.lambda : 0;

        let F_con = 0;
        const row_con = results['con'].df_cr.find(r => r.line === selectedLine);
        if (row_con) {
            F_con = row_con.F;
        }

        F = caseType === 'con' ? F_con : 0;

        let exporter_node, importer_node, lmp_exp, lmp_imp;
        if (F_con < 0) {
            // Reversa direccionalmente según el resultado base(CON), esto alínea también el caso SIN visualmente
            exporter_node = to; importer_node = fr;
            lmp_exp = lmp_to; lmp_imp = lmp_fr;
        } else {
            exporter_node = fr; importer_node = to;
            lmp_exp = lmp_fr; lmp_imp = lmp_to;
        }

        const c_exp = params.NODES[exporter_node];
        const c_imp = params.NODES[importer_node];
        const f_abs = Math.abs(F);
        const CR_abs = f_abs * Math.abs(lmp_imp - lmp_exp);

        const hours_semester = 24 * 30 * 6; // 4320 horas

        const getCountryStats = (country) => {
            const gens = res.df_gen ? res.df_gen.filter(r => r.country === country) : [];
            const dems = res.df_dem ? res.df_dem.filter(r => r.country === country) : [];

            const Ig_MW_hour = gens.reduce((sum, r) => sum + (r.P || 0), 0);
            const Rc_MW_hour = dems.reduce((sum, r) => sum + (r.served || 0), 0);

            const var_cost_h = gens.reduce((sum, r) => sum + (r.var_cost || 0), 0);
            const profit_h = gens.reduce((sum, r) => sum + (r.profit || 0), 0);

            const pay_dem_h = dems.reduce((sum, r) => sum + (r.pay_dem || 0), 0);
            const cost_ens_h = dems.reduce((sum, r) => sum + (r.cost_ens || 0), 0);

            const op_cost_h = var_cost_h + cost_ens_h;

            return {
                Ig_MW_hour,
                Rc_MW_hour,
                Ig_sem: Ig_MW_hour * hours_semester,
                Rc_sem: Rc_MW_hour * hours_semester,
                op_cost_h,
                profit_h,
                pay_dem_h
            };
        };

        const stats_exp = getCountryStats(c_exp);
        const stats_imp = getCountryStats(c_imp);

        const capex = Number(regInputs.capex) || 0;
        const r = Number(regInputs.r_annual) || 0;
        const n_years = Number(regInputs.life_years) || 1;
        const om_frac = Number(regInputs.om_frac_annual) || 0;
        const pow_ = Math.pow(1.0 + r, n_years);
        const A_annuity = r > 0 ? (capex * (r * pow_) / (pow_ - 1.0)) : (capex / n_years);
        const OM_annual = capex * om_frac;
        const IAR_annual = A_annuity + OM_annual;

        const CVTn_sem = Number(regInputs.CVTn_sem_USD) || 0;
        const SCF = Number(regInputs.SCF_USD) || 0;
        const SCE = Number(regInputs.SCE_USD) || 0;
        const IVDT = Number(regInputs.IVDT_USD) || 0;
        const IR = (IAR_annual / 2.0) + (SCF - SCE) - CVTn_sem - IVDT;

        const alpha_R = Number(regInputs.alpha_R) || 0;
        const alpha_I = Number(regInputs.alpha_I) || 0;

        const MR = IR * alpha_R;
        const MI = IR * alpha_I;

        // Calculamos las tarifas para cada país extremo en función de sus propios retiros e inyecciones proyectados!
        const CURTRC_exp = stats_exp.Rc_sem > 0 ? MR / stats_exp.Rc_sem : 0;
        const CURTRG_exp = stats_exp.Ig_sem > 0 ? MI / stats_exp.Ig_sem : 0;

        const CURTRC_imp = stats_imp.Rc_sem > 0 ? MR / stats_imp.Rc_sem : 0;

        const peaje_iny_exp_USD = CURTRG_exp * f_abs;
        const peaje_ret_imp_USD = CURTRC_imp * f_abs;

        // Modelo 1: Costo de Operación (costo_op + peaje * |F|)
        const ben_soc_exp = stats_exp.op_cost_h + peaje_iny_exp_USD;
        // Importador usa el peaje de retiro
        const ben_soc_imp = stats_imp.op_cost_h + peaje_ret_imp_USD;

        // Modelo 2: Beneficio Generador
        // Exportador descuenta peaje inyección por exportar, y suma la renta de congestión adjudicada a nivel inyección
        const ben_gen_exp = stats_exp.profit_h - peaje_iny_exp_USD + CR_abs * alpha_I;
        // El Importador retiene íntegramente sus profit locales (no afectan por este flujo especifico)
        const ben_gen_imp = stats_imp.profit_h;

        // Modelo 3: Costo de la Demanda
        const cos_dem_exp = stats_exp.pay_dem_h;
        // Importador paga un extra compensatorio (peaje de retiro) pero percibe descuento de la renta proporcional a retiros
        const cos_dem_imp = stats_imp.pay_dem_h + peaje_ret_imp_USD - CR_abs * alpha_R;

        return {
            caseType: caseType.toUpperCase(),
            c_exp,
            c_imp,
            ben_soc_exp, ben_soc_imp,
            ben_gen_exp, ben_gen_imp,
            cos_dem_exp, cos_dem_imp,
            Rc_sem_exp: stats_exp.Rc_sem,
            Ig_sem_exp: stats_exp.Ig_sem,
            Rc_hour_exp: stats_exp.Rc_MW_hour,
            Ig_hour_exp: stats_exp.Ig_MW_hour,
            Rc_sem_imp: stats_imp.Rc_sem,
            Ig_sem_imp: stats_imp.Ig_sem,
            Rc_hour_imp: stats_imp.Rc_MW_hour,
            Ig_hour_imp: stats_imp.Ig_MW_hour,
            // Detalle numérico
            bs_exp_factors: { op: stats_exp.op_cost_h, peaje: peaje_iny_exp_USD },
            bs_imp_factors: { op: stats_imp.op_cost_h, peaje: peaje_ret_imp_USD },
            bg_exp_factors: { profit: stats_exp.profit_h, peaje: peaje_iny_exp_USD, renta: CR_abs * alpha_I },
            bg_imp_factors: { profit: stats_imp.profit_h },
            cd_exp_factors: { pay: stats_exp.pay_dem_h },
            cd_imp_factors: { pay: stats_imp.pay_dem_h, peaje: peaje_ret_imp_USD, renta: CR_abs * alpha_R }
        };
    };

    const out = calculateSiepac();
    const exPostCon = calculateExpostModels('con');
    const exPostSin = calculateExpostModels('sin');

    const formatCurr = (val) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const renderExpostTable = (data) => {
        if (!data) return null;
        const isSem = expostTimeScale === 'semestral';
        const lbl_rc = isSem ? 'Rc_sem' : 'Rc_hour';
        const lbl_ig = isSem ? 'Ig_sem' : 'Ig_hour';
        const str_per = isSem ? 'Semestrales' : 'Horarios';

        return (
            <div className="overflow-visible shadow-sm rounded-lg border border-gray-200">
                <h4 className="bg-gray-100 text-gray-700 font-bold px-4 py-3 border-b border-gray-200 uppercase text-sm tracking-widest text-center flex flex-col gap-2 items-center">
                    <span>Caso {data.caseType}</span>
                    <div className="flex flex-wrap justify-center gap-2 text-[10px] sm:text-[11px] font-mono normal-case overflow-visible tracking-tight leading-tight">
                        <span className="bg-blue-100 text-blue-800 px-1.5 py-1 rounded flex items-center gap-1 overflow-visible">
                            <TooltipLabel label={`${lbl_rc} (${data.c_exp.substring(0, 3)}/${data.c_imp.substring(0, 3)}):`} description={`Retiros Cargables ${str_per} (Demanda). Demanda base ponderada para cubrir los costos fijos.`} formula={isSem ? "Σ(Demanda_Servida_1h) * 4320" : "Σ(Demanda_Servida_1h)"} />
                            {formatCurr(isSem ? data.Rc_sem_exp : data.Rc_hour_exp)} / {formatCurr(isSem ? data.Rc_sem_imp : data.Rc_hour_imp)} {isSem ? 'MWh' : 'MW'}
                        </span>
                        <span className="bg-blue-100 text-blue-800 px-1.5 py-1 rounded flex items-center gap-1 overflow-visible">
                            <TooltipLabel label={`${lbl_ig} (${data.c_exp.substring(0, 3)}/${data.c_imp.substring(0, 3)}):`} description={`Inyecciones Totales ${str_per} (Generador). Despacho ponderado de generación base para cubrir los costos fijos.`} formula={isSem ? "Σ(Generación_1h) * 4320" : "Σ(Generación_1h)"} />
                            {formatCurr(isSem ? data.Ig_sem_exp : data.Ig_hour_exp)} / {formatCurr(isSem ? data.Ig_sem_imp : data.Ig_hour_imp)} {isSem ? 'MWh' : 'MW'}
                        </span>
                    </div>
                </h4>
                <table className="min-w-full divide-y divide-gray-200 text-sm overflow-visible">
                    <thead className="bg-blue-50 text-gray-600">
                        <tr>
                            <th className="px-4 py-3 text-left">Modelo Ex-Post</th>
                            <th className="px-4 py-3 text-right">Exp: {data.c_exp}</th>
                            <th className="px-4 py-3 text-right">Imp: {data.c_imp}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="1. Costo de Operación" description="Costo de operación del país más el pago de peaje (Inyección o Retiro) según corresponda por el flujo de la línea." formula="Costo_Op_País + Peaje * |Flujo|" />
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="center" label={`$${formatCurr(data.ben_soc_exp)}`} formula={`Costo_Op: $${formatCurr(data.bs_exp_factors.op)} | Peaje_Iny: $${formatCurr(data.bs_exp_factors.peaje)}`} />
                                </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="right" label={`$${formatCurr(data.ben_soc_imp)}`} formula={`Costo_Op: $${formatCurr(data.bs_imp_factors.op)} | Peaje_Ret: $${formatCurr(data.bs_imp_factors.peaje)}`} />
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="2. Beneficio Generador" description="La suma del beneficio del generador (profit) menos el pago de peaje inyección por exportar más la renta de congestión atribuible (α_inyecciones)." formula="Σ Profit - Peaje_Iny * |Flujo| + CR * α_inyecciones" />
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="center" label={`$${formatCurr(data.ben_gen_exp)}`} formula={`Profit: $${formatCurr(data.bg_exp_factors.profit)} | - Peaje_Iny: $${formatCurr(data.bg_exp_factors.peaje)} | + Renta_Iny: $${formatCurr(data.bg_exp_factors.renta)}`} />
                                </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="right" label={`$${formatCurr(data.ben_gen_imp)}`} formula={`Profit_Neto: $${formatCurr(data.bg_imp_factors.profit)}`} />
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="3. Costo de Demanda" description="La suma de los pagos de demanda del país más el pago de peaje de retiro por importar descontando la renta de congestión atribuible (α_retiros)." formula="Σ Pago_Demanda + Peaje_Ret * |Flujo| - CR * α_retiros" />
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="center" label={`$${formatCurr(data.cos_dem_exp)}`} formula={`Pago_Demanda_Neto: $${formatCurr(data.cd_exp_factors.pay)}`} />
                                </div>
                            </td>
                            <td className="px-4 py-2 text-right">
                                <div className="flex justify-end overflow-visible">
                                    <TooltipLabel align="right" label={`$${formatCurr(data.cos_dem_imp)}`} formula={`Pago_Demanda: $${formatCurr(data.cd_imp_factors.pay)} | + Peaje_Ret: $${formatCurr(data.cd_imp_factors.peaje)} | - Renta_Ret: $${formatCurr(data.cd_imp_factors.renta)}`} />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    const renderWinnersLosersTable = (conData, sinData) => {
        if (!conData || !sinData) return null;

        const getSinVal = (country, metric_exp, metric_imp) => {
            if (sinData.c_exp === country) return sinData[metric_exp];
            if (sinData.c_imp === country) return sinData[metric_imp];
            return 0; // Should not reach here if countries match
        };

        const sin_soc_exp_matched = getSinVal(conData.c_exp, 'ben_soc_exp', 'ben_soc_imp');
        const sin_soc_imp_matched = getSinVal(conData.c_imp, 'ben_soc_exp', 'ben_soc_imp');

        const sin_gen_exp_matched = getSinVal(conData.c_exp, 'ben_gen_exp', 'ben_gen_imp');
        const sin_gen_imp_matched = getSinVal(conData.c_imp, 'ben_gen_exp', 'ben_gen_imp');

        const sin_dem_exp_matched = getSinVal(conData.c_exp, 'cos_dem_exp', 'cos_dem_imp');
        const sin_dem_imp_matched = getSinVal(conData.c_imp, 'cos_dem_exp', 'cos_dem_imp');

        const delta_soc_exp = conData.ben_soc_exp - sin_soc_exp_matched;
        const delta_soc_imp = conData.ben_soc_imp - sin_soc_imp_matched;

        const delta_gen_exp = conData.ben_gen_exp - sin_gen_exp_matched;
        const delta_gen_imp = conData.ben_gen_imp - sin_gen_imp_matched;

        const delta_dem_exp = conData.cos_dem_exp - sin_dem_exp_matched;
        const delta_dem_imp = conData.cos_dem_imp - sin_dem_imp_matched;

        const getStatus = (val, conVal, sinVal, isCost = false) => {
            const effectiveVal = isCost ? -val : val;
            let label = <span className="text-gray-500 font-bold">Neutral</span>;
            if (effectiveVal > 1e-6) label = <span className="text-green-600 font-bold">Ganador (+${formatCurr(Math.abs(val))})</span>;
            else if (effectiveVal < -1e-6) label = <span className="text-red-600 font-bold">Perdedor (-${formatCurr(Math.abs(val))})</span>;

            return (
                <div className="flex justify-end overflow-visible">
                    <TooltipLabel align="center" label={label} formula={`Caso_CON: $${formatCurr(conVal)} | Caso_SIN: $${formatCurr(sinVal)}`} />
                </div>
            );
        };

        return (
            <div className="overflow-visible shadow-sm rounded-lg border border-gray-200 lg:col-span-2">
                <h4 className="bg-indigo-50 text-indigo-800 font-bold px-4 py-3 border-b border-indigo-100 uppercase text-sm tracking-widest text-center flex flex-col gap-2 items-center">
                    <span>Ganadores y Perdedores por País (Δ CON - SIN)</span>
                </h4>
                <table className="min-w-full divide-y divide-gray-200 text-sm overflow-visible">
                    <thead className="bg-indigo-100 text-indigo-900">
                        <tr>
                            <th className="px-4 py-3 text-left">Modelo Ex-Post</th>
                            <th className="px-4 py-3 text-right">Exp: {conData.c_exp}</th>
                            <th className="px-4 py-3 text-right">Imp: {conData.c_imp}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="1. Costo de Operación (Δ)" description="Variación del Costo de Operación Total entre el caso interconectado y el aislado. Al ser de naturaleza costo, una reducción (CON < SIN) implica que es Ganador." />
                            </td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_soc_exp, conData.ben_soc_exp, sin_soc_exp_matched, true)}</td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_soc_imp, conData.ben_soc_imp, sin_soc_imp_matched, true)}</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="2. Beneficio Generador (Δ)" description="Variación del Beneficio neto del Generador al conectarse." />
                            </td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_gen_exp, conData.ben_gen_exp, sin_gen_exp_matched)}</td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_gen_imp, conData.ben_gen_imp, sin_gen_imp_matched)}</td>
                        </tr>
                        <tr>
                            <td className="px-4 py-2 font-medium overflow-visible">
                                <TooltipLabel label="3. Costo de Demanda (Δ)" description="Variación del Costo total de la Demanda al conectarse. OJO: Un 'Ganador' aquí significa que la demanda ahorró dinero, es decir, el Costo disminuyó (CON < SIN)." />
                            </td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_dem_exp, conData.cos_dem_exp, sin_dem_exp_matched, true)}</td>
                            <td className="px-4 py-2 text-right">{getStatus(delta_dem_imp, conData.cos_dem_imp, sin_dem_imp_matched, true)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Selección de Tramo (SIEPAC)</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Línea de Transmisión:</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            value={selectedLine}
                            onChange={(e) => setSelectedLine(e.target.value)}
                        >
                            {lineOptions.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">País Objetivo (Peaje Ex-Post):</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            value={countryTarget}
                            onChange={(e) => setCountryTarget(e.target.value)}
                        >
                            {countryA && <option value={countryA}>{countryA}</option>}
                            {countryB && countryB !== countryA && <option value={countryB}>{countryB}</option>}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-700 mb-4 border-b border-gray-300 pb-2">Parámetros SIEPAC Semestrales</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
                    {Object.entries(regInputs).map(([k, v]) => {
                        const dictDesc = {
                            capex: { desc: 'Capital Expenditure Total (USD).' },
                            life_years: { desc: 'Vida Útil de la Inversión (Años).' },
                            r_annual: { desc: 'Tasa de descuento o retorno anual (r). Ejemplo: 0.06 = 6%.' },
                            om_frac_annual: { desc: 'Fracción del CAPEX asignada para Operación y Mantenimiento Anual. Ej: 0.015 = 1.5%.' },
                            CVTn_sem_USD: { desc: 'Costo Variable de Transmisión No Asignable y otros ingresos no provenientes de la remuneración principal, para deducir al semestre.' },
                            SCF_USD: { desc: 'Saldo a favor de Compensaciones originado por liquidaciones anteriores correspondientes al país.' },
                            SCE_USD: { desc: 'Saldo en contra de Compensaciones (Multas, etc) correspondientes al país.' },
                            IVDT_USD: { desc: 'Ingreso por Venta de Derechos Financieros de Transmisión del enlace en consideración.' },
                            alpha_R: { desc: 'Proporción del Costo (Ingreso Requerido) asignado a los Retiros de demanda. Factor (0 a 1).' },
                            alpha_I: { desc: 'Proporción del Costo (Ingreso Requerido) asignado a las Inyecciones de generación. Factor (0 a 1).' }
                        };
                        const paramsInf = dictDesc[k];
                        return (
                            <div key={k} className="bg-white p-3 rounded border shadow-sm flex flex-col justify-end relative">
                                <label className="block text-xs text-gray-500 font-bold mb-2 z-10">
                                    <TooltipLabel label={k} description={paramsInf?.desc} />
                                </label>
                                <input
                                    type="number"
                                    name={k}
                                    value={v}
                                    onChange={handleInput}
                                    className="w-full p-1 border-b focus:outline-none focus:border-blue-500 text-sm"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {out ? (
                <div className="bg-white p-6 rounded-lg shadow-lg border-t-4 border-blue-500">
                    <h3 className="text-2xl font-bold text-gray-800 mb-6">Resultados SIEPAC: {out.line} ({out.countryTarget})</h3>

                    {!out.participates && (
                        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 font-semibold">
                            ⚠️ Nota: El País Objetivo seleccionado ({out.countryTarget}) no es un extremo de esta línea.
                        </div>
                    )}

                    <div className="overflow-x-auto shadow-sm rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left">Paso / Métrica</th>
                                    <th className="px-4 py-3 text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                <tr className="bg-blue-50"><td className="px-4 py-3 font-semibold" colSpan={2}>Datos del Modelo</td></tr>
                                <tr><td className="px-4 py-2 font-medium">Exportador</td><td className="px-4 py-2 text-right">{out.exporter_country} (Nodo: {out.exporter_node}) | LMP: ${formatCurr(out.lmp_exp)}</td></tr>
                                <tr><td className="px-4 py-2 font-medium">Importador</td><td className="px-4 py-2 text-right">{out.importer_country} (Nodo: {out.importer_node}) | LMP: ${formatCurr(out.lmp_imp)}</td></tr>
                                <tr><td className="px-4 py-2 font-medium">Capacidad de la Línea (C)</td><td className="px-4 py-2 text-right">{out.C_MW} MW</td></tr>
                                <tr><td className="px-4 py-2 font-medium">Flujo (F)</td><td className="px-4 py-2 text-right">{formatCurr(Math.abs(out.F_MW))} MW</td></tr>

                                <tr className="bg-blue-50"><td className="px-4 py-3 font-semibold" colSpan={2}>Resultados SIEPAC</td></tr>
                                <tr><td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="A) CVT horario" description="Costo Variable de Transmisión horario asociado al aprovechamiento y pérdidas en el diferencial de LMP." formula="|Flujo| * |LMP_Importador - LMP_Exportador|" /></td><td className="px-4 py-2 text-right">${formatCurr(out.CVT_h)} /h</td></tr>
                                <tr>
                                    <td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="B) IR Semestral" description="Ingreso Requerido Asignable del semestre a reportar, deduciendo otros ingresos y balances de periodos pasados." formula="(IAR / 2) + SCF - SCE - CVTn - IVDT" /></td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex justify-end overflow-visible">
                                            <TooltipLabel align="right" label={`$${formatCurr(out.IR)}`} formula={`(IAR_Anual: $${formatCurr(out.iar_factors.iar_total)} / 2) + SCF: $${formatCurr(out.iar_factors.scf)} - SCE: $${formatCurr(out.iar_factors.sce)} - CVTn: $${formatCurr(out.iar_factors.cvtn)} - IVDT: $${formatCurr(out.iar_factors.ivdt)}`} />
                                        </div>
                                    </td>
                                </tr>
                                <tr><td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="C) Fracción de Uso" description="Nivel de aprovechamiento de capacidad térmica u operativa del enlace de la red de transmisión estudiada." formula="Flujo / Capacidad_Máxima" /></td><td className="px-4 py-2 text-right">{(out.uso * 100).toFixed(2)}%</td></tr>
                                <tr>
                                    <td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="C) Peaje (P)" description="Beneficio o Pago derivado proporcionalmente del uso estricto y útil transmitido por el enlace (Peaje Ex-Post)." formula="IR_Semestral * Fracción_De_Uso" /></td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex justify-end overflow-visible">
                                            <TooltipLabel align="right" label={<span className="text-blue-600 font-semibold">${formatCurr(out.P)}</span>} formula={`IR_Semestral: $${formatCurr(out.IR)} * Fracción_Uso: ${(out.uso).toFixed(4)}`} />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="C) Cargo Complementario (CC)" description="Pago por soporte y confiabilidad sistémica para el cubrimiento de la porción de inversión sub-utilizada de la infraestructura." formula="IR_Semestral * (1 - Fracción_De_Uso)" /></td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex justify-end overflow-visible">
                                            <TooltipLabel align="right" label={<span className="text-indigo-600 font-semibold">${formatCurr(out.CC)}</span>} formula={`IR_Semestral: $${formatCurr(out.IR)} * (1 - Fracción_Uso): ${(1 - out.uso).toFixed(4)}`} />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="D) MR (Asignado Retiros)" description="Monto a Recuperar correspondiente al sector de la Demanda." formula="(Peaje + Cargo_Complementario) * alpha_R" /></td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex justify-end overflow-visible">
                                            <TooltipLabel align="right" label={`$${formatCurr(out.MR)}`} formula={`(Peaje + CC): $${formatCurr(out.tariffs_factors.ir_total)} * α_Retiros: ${out.tariffs_factors.alpha_R}`} />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="D) MI (Asignado Inyecciones)" description="Monto a Recuperar correspondiente al sector de Generación." formula="(Peaje + Cargo_Complementario) * alpha_I" /></td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex justify-end overflow-visible">
                                            <TooltipLabel align="right" label={`$${formatCurr(out.MI)}`} formula={`(Peaje + CC): $${formatCurr(out.tariffs_factors.ir_total)} * α_Inyecciones: ${out.tariffs_factors.alpha_I}`} />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="D) Tarifa Retiro (CURTRC)" description="Cargo Unitario Real por Uso de la RTE a ser pagado por los Agentes de Demanda en sus retiros cargables." formula="MR / RC_Semestrales" /></td>
                                    <td className="px-4 py-2 text-right font-mono bg-gray-100 rounded px-2">
                                        <div className="flex justify-end overflow-visible">
                                            <TooltipLabel align="right" label={`$${formatCurr(out.CURTRC)} / MWh`} formula={`MR: $${formatCurr(out.MR)} / Rc_sem: ${formatCurr(out.tariffs_factors.Rc)} MWh`} />
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-2 font-medium overflow-visible"><TooltipLabel label="D) Tarifa Inyección (CURTRG)" description="Cargo Unitario Real por Uso de la RTE a ser pagado por los Agentes Generadores en base a su inyección." formula="MI / Ig_Semestrales" /></td>
                                    <td className="px-4 py-2 text-right font-mono bg-gray-100 rounded px-2">
                                        <div className="flex justify-end overflow-visible">
                                            <TooltipLabel align="right" label={`$${formatCurr(out.CURTRG)} / MWh`} formula={`MI: $${formatCurr(out.MI)} / Ig_sem: ${formatCurr(out.tariffs_factors.Ig)} MWh`} />
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">Análisis Adicional: 3 Modelos Ex-Post</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    Estos resultados evalúan las posiciones de <strong>Costo de Operación, Beneficio del Generador y Costo de la Demanda ({out.line})</strong> para los dos países extremos de esta línea utilizando tarifas computadas derivadas de sus inyecciones/retiros particulares.
                                </p>
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
                                <button
                                    onClick={() => setExpostTimeScale('hora')}
                                    className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${expostTimeScale === 'hora' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:text-blue-600'}`}
                                >
                                    Por Hora
                                </button>
                                <button
                                    onClick={() => setExpostTimeScale('semestral')}
                                    className={`px-4 py-2 text-xs font-bold rounded-md transition-colors ${expostTimeScale === 'semestral' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:text-blue-600'}`}
                                >
                                    Semestral
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6 mb-6">
                            {renderExpostTable(exPostCon)}
                            {renderExpostTable(exPostSin)}
                            <div className="lg:col-span-2">
                                {renderWinnersLosersTable(exPostCon, exPostSin)}
                            </div>
                        </div>
                    </div>

                </div>
            ) : (
                <div className="p-8 text-center text-gray-500 italic bg-white rounded border border-gray-200">
                    Ejecuta la simulación o comprueba que los datos existan para ver los resultados.
                </div>
            )}
        </div>
    );
};

const Methodologies = ({ results, params }) => {
    const [subTab, setSubTab] = useState('siepac');

    return (
        <div className="oirse-methodologies space-y-6">
            <h2 className="text-3xl font-bold text-oirse-text-primary">Metodologías Ex-Post</h2>

            <div className="flex border-b border-oirse-border mb-6 bg-oirse-bg-surface rounded-t-xl px-2">
                <button
                    onClick={() => setSubTab('siepac')}
                    className={`px-6 py-3 font-semibold text-lg transition-colors border-b-2 ${subTab === 'siepac' ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-oirse-text-muted hover:text-oirse-text-primary'}`}
                >
                    SIEPAC
                </button>
                <button
                    onClick={() => setSubTab('asia')}
                    className={`px-6 py-3 font-semibold text-lg transition-colors border-b-2 ${subTab === 'asia' ? 'border-indigo-400 text-indigo-300' : 'border-transparent text-oirse-text-muted hover:text-oirse-text-primary'}`}
                >
                    ASIA
                </button>
                <button
                    onClick={() => setSubTab('europa')}
                    className={`px-6 py-3 font-semibold text-lg transition-colors border-b-2 ${subTab === 'europa' ? 'border-purple-400 text-purple-300' : 'border-transparent text-oirse-text-muted hover:text-oirse-text-primary'}`}
                >
                    EUROPA
                </button>
                <button
                    onClick={() => setSubTab('latam')}
                    className={`px-6 py-3 font-semibold text-lg transition-colors border-b-2 ${subTab === 'latam' ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-oirse-text-muted hover:text-oirse-text-primary'}`}
                >
                    LATAM HIBRIDO
                </button>
            </div>

            <div>
                {subTab === 'siepac' && <SiepacTab results={results} params={params} />}
                {subTab === 'asia' && <AsiaTab results={results} params={params} />}
                {subTab === 'europa' && <EuropaTab results={results} params={params} />}
                {subTab === 'latam' && <LatamHybridTab results={results} />}
            </div>
        </div>
    );
};

export default Methodologies;
