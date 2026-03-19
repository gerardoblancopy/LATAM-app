import React from 'react';

const ResultsViewer = ({ results }) => {
    if (!results) return <div className="text-oirse-text-muted italic p-4 text-center">No results yet. Run simulation to see data.</div>;

    const { sin, con, delta } = results;

    const Table = ({ data, columns }) => (
        <div className="overflow-x-auto shadow-oirse-sm rounded-lg border border-oirse-border mb-6 pb-8 -mb-8 bg-oirse-bg-surface"> {/* Negative margin and padding to allow tooltips to overflow safely */}
            <table className="min-w-full divide-y divide-oirse-border">
                <thead className="bg-oirse-bg-elevated relative z-10">
                    <tr>
                        {columns.map(col => (
                            <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-oirse-text-secondary uppercase tracking-wider group relative">
                                <div className="flex items-center gap-1 cursor-default w-max">
                                    <span>{col.label}</span>
                                    {(col.description || col.formula) && (
                                        <div className="cursor-help text-oirse-text-muted hover:text-oirse-accent transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                    )}
                                </div>
                                {(col.description || col.formula) && (
                                    <div className="absolute z-50 top-full left-4 mt-2 hidden group-hover:block w-72 p-3 bg-oirse-bg-primary text-oirse-text-primary text-xs rounded-lg shadow-oirse-lg normal-case font-normal whitespace-normal text-left border border-oirse-border">
                                        {col.description && <div className="text-oirse-text-secondary leading-relaxed">{col.description}</div>}
                                        {col.formula && (
                                            <div className="mt-2 pt-2 border-t border-oirse-border">
                                                <span className="block text-oirse-text-muted text-[10px] uppercase mb-1 font-semibold tracking-wider">Fórmula:</span>
                                                <code className="block bg-oirse-bg-secondary p-2 rounded text-oirse-accent-hover text-[11px] break-words font-mono border border-oirse-border">
                                                    {col.formula}
                                                </code>
                                            </div>
                                        )}
                                        <div className="absolute bottom-full left-4 border-4 border-transparent border-b-oirse-bg-primary"></div>
                                    </div>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-oirse-bg-surface divide-y divide-oirse-border text-sm text-oirse-text-primary relative z-0">
                    {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-oirse-bg-hover transition-colors">
                            {columns.map(col => (
                                <td key={col.key} className="px-4 py-3 whitespace-nowrap oirse-number">
                                    {col.format ? col.format(row[col.key]) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const formatCurrency = (val) => val != null ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-';
    const formatNum = (val) => val != null ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

    return (
        <div className="space-y-10">

            {/* --- DELTA ANALYSIS --- */}
            <section className="bg-oirse-bg-surface p-6 rounded-lg shadow-oirse-lg border border-oirse-border border-l-4 border-l-oirse-accent">
                <h2 className="text-2xl font-bold text-oirse-text-primary mb-6 flex items-center gap-2">
                    <span>🏆 Winners vs Losers (CON - SIN)</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-lg border-l-4 border-l-emerald-400">
                        <span className="text-emerald-300 font-semibold block text-sm">Best Scenario (Winner)</span>
                        <div className="text-xl font-bold text-emerald-200 mt-1">{delta.winner_net.country}</div>
                        <div className="text-sm text-emerald-300 oirse-number">Net Benefit: {formatCurrency(delta.winner_net.neto_solo_agentes)}</div>
                    </div>
                    <div className="p-4 bg-red-500/10 border border-red-400/30 rounded-lg border-l-4 border-l-red-400">
                        <span className="text-red-300 font-semibold block text-sm">Worst Scenario (Loser)</span>
                        <div className="text-xl font-bold text-red-200 mt-1">{delta.loser_net.country}</div>
                        <div className="text-sm text-red-300 oirse-number">Net Benefit: {formatCurrency(delta.loser_net.neto_solo_agentes)}</div>
                    </div>
                </div>

                <Table
                    data={delta.delta_table}
                    columns={[
                        { key: 'country', label: 'Country', description: 'País evaluado.' },
                        { key: 'delta_profit_GEN (CON-SIN)', label: 'Δ Gen Profit', format: formatCurrency, description: 'Diferencia en el beneficio de los generadores entre el escenario conectado y el aislado.', formula: 'Profit_GEN(CON) - Profit_GEN(SIN)' },
                        { key: 'ahorro_DEM (SIN-CON)', label: 'Δ Dem Savings', format: formatCurrency, description: 'Ahorro de la demanda al pasar de un escenario aislado a uno conectado.', formula: 'Pago_Demanda(SIN) - Pago_Demanda(CON)' },
                        { key: 'neto_solo_agentes', label: 'Net Benefit', format: formatCurrency, description: 'Beneficio neto para los agentes (generadores y demanda) del país. Muestra quién gana y quién pierde con la interconexión. No incluye la renta de congestión.', formula: 'Δ_Gen_Profit + Δ_Dem_Savings' },
                    ]}
                />

                <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-400/30 rounded text-cyan-300 text-sm">
                    <span className="font-semibold">Δ Congestion Rent (System):</span> {formatCurrency(delta.d_cr)} (Not assigned)
                </div>
            </section>


            {/* --- DETAILED RESULTS (CON) --- */}
            <section>
                <h2 className="text-2xl font-bold text-oirse-text-primary mb-4 border-b border-oirse-border pb-2">Detailed Results (CON Case - Connected)</h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2">LMP by Node ($/MWh)</h3>
                        <Table
                            data={con.lmp}
                            columns={[
                                { key: 'country', label: 'Country', description: 'País al que pertenece el nodo.' },
                                { key: 'node', label: 'Node', description: 'Nombre del nodo en el sistema eléctrico.' },
                                { key: 'lambda', label: 'LMP ($)', format: formatCurrency, description: 'Locational Marginal Price (Precio Marginal Local). Es el costo de suministrar 1 MW adicional de demanda en este nodo.', formula: 'Multiplicador de Lagrange de la restricción de balance nodal' },
                            ]}
                        />
                    </div>

                    <div>
                        <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2">Line Flows</h3>
                        <Table
                            data={con.df_cr}
                            columns={[
                                { key: 'line', label: 'Line', description: 'Nombre de la línea de transmisión.' },
                                { key: 'from', label: 'From', description: 'Nodo de origen de la línea.' },
                                { key: 'to', label: 'To', description: 'Nodo de destino de la línea.' },
                                { key: 'F', label: 'Flow (MW)', format: formatNum, description: 'Flujo de potencia activa por la línea.', formula: '1/X * (θ_from - θ_to)' },
                                { key: 'CR', label: 'Congestion Rent', format: formatCurrency, description: 'Renta de congestión generada por esta línea. Representa la diferencia de precios entre nodos multiplicada por el flujo.', formula: 'Flujo * (LMP_to - LMP_from)' },
                            ]}
                        />
                    </div>
                </div>

                <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2 mt-6">Generator Dispatch</h3>
                <Table
                    data={con.df_gen}
                    columns={[
                        { key: 'country', label: 'Country', description: 'País donde está ubicado el generador.' },
                        { key: 'g', label: 'Gen', description: 'Nombre del generador.' },
                        { key: 'pmax', label: 'Pmax (MW)', format: formatNum, description: 'Capacidad máxima de generación.' },
                        { key: 'c', label: 'Cost ($/MWh)', format: formatCurrency, description: 'Costo marginal de generación.' },
                        { key: 'P', label: 'Gen (MW)', format: formatNum, description: 'Potencia despachada por el generador.', formula: '0 <= P <= Pmax' },
                        { key: 'lambda', label: 'LMP', format: formatCurrency, description: 'Precio Marginal Local en el nodo del generador.' },
                        { key: 'revenue', label: 'Revenue', format: formatCurrency, description: 'Ingresos totales del generador por venta de energía.', formula: 'P * LMP' },
                        { key: 'var_cost', label: 'Total Var Cost', format: formatCurrency, description: 'Costo variable total de producción.', formula: 'P * Cost' },
                        { key: 'profit', label: 'Profit', format: formatCurrency, description: 'Beneficio económico neto del generador.', formula: 'Revenue - Total_Var_Cost' },
                    ]}
                />

                <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2 mt-6">Generator Costs by Node</h3>
                <Table
                    data={con.gen_node}
                    columns={[
                        { key: 'country', label: 'Country', description: 'País del nodo.' },
                        { key: 'node', label: 'Node', description: 'Nombre del nodo agregado.' },
                        { key: 'pmax', label: 'Total Installed (MW)', format: formatNum, description: 'Suma de la capacidad máxima instalada de los generadores en este nodo.', formula: 'Σ Pmax_gen' },
                        { key: 'P', label: 'Total Dispatched (MW)', format: formatNum, description: 'Suma de la potencia efectivamente despachada en este nodo.', formula: 'Σ P_gen' },
                        { key: 'revenue', label: 'Total Revenue', format: formatCurrency, description: 'Monto acumulado por ventas de energía de los generadores en el nodo.', formula: 'Σ Revenue_gen' },
                        { key: 'var_cost', label: 'Total Var Cost', format: formatCurrency, description: 'Costo total acumulado de producción de los generadores en el nodo.', formula: 'Σ Var_Cost_gen' },
                        { key: 'profit', label: 'Total Profit', format: formatCurrency, description: 'Beneficio total neto acumulado de los generadores en el nodo.', formula: 'Σ Profit_gen' },
                    ]}
                />

                <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2 mt-6">Demand Costs</h3>
                <Table
                    data={con.df_dem}
                    columns={[
                        { key: 'country', label: 'Country', description: 'País al que pertenece la demanda.' },
                        { key: 'node', label: 'Node', description: 'Nombre del nodo donde se ubica la demanda.' },
                        { key: 'lambda', label: 'LMP ($)', format: formatCurrency, description: 'Costo marginal de la barra (LMP).' },
                        { key: 'D', label: 'Demand (MW)', format: formatNum, description: 'Demanda requerida en el nodo.' },
                        { key: 'pay_dem', label: 'Demand Cost', format: formatCurrency, description: 'Costo total de la demanda pagado a precio marginal.', formula: 'Demanda_Abastecida * LMP' },
                    ]}
                />

                <div className="bg-oirse-bg-elevated border border-oirse-border p-4 rounded mt-8">
                    <h4 className="font-bold text-oirse-text-primary mb-2">Accounting Check (CON)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="block text-oirse-text-muted">Values Pay</span>
                            <span className="font-mono oirse-number">{formatCurrency(con.totals.pay_total)}</span>
                        </div>
                        <div>
                            <span className="block text-oirse-text-muted">Gen Revenue</span>
                            <span className="font-mono oirse-number">{formatCurrency(con.totals.rev_total)}</span>
                        </div>
                        <div>
                            <span className="block text-oirse-text-muted">Congestion Rent</span>
                            <span className="font-mono oirse-number">{formatCurrency(con.totals.cr_total)}</span>
                        </div>
                        <div>
                            <span className="block text-oirse-text-muted">Residual</span>
                            <span className={`font-mono oirse-number font-bold ${Math.abs(con.totals.residual) > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {formatNum(con.totals.residual)}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- DETAILED RESULTS (SIN) --- */}
            <section className="mt-10 border-t border-oirse-border pt-10">
                <h2 className="text-2xl font-bold text-oirse-text-primary mb-4 border-b border-oirse-border pb-2">Detailed Results (SIN Case - Isolated)</h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2">LMP by Node ($/MWh)</h3>
                        <Table
                            data={sin.lmp}
                            columns={[
                                { key: 'country', label: 'Country', description: 'País al que pertenece el nodo.' },
                                { key: 'node', label: 'Node', description: 'Nombre del nodo en el sistema eléctrico.' },
                                { key: 'lambda', label: 'LMP ($)', format: formatCurrency, description: 'Locational Marginal Price (Precio Marginal Local) en estado aislado.', formula: 'Multiplicador de Lagrange de la restricción de balance nodal' },
                            ]}
                        />
                    </div>

                    <div>
                        <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2">Line Flows (Disconnected)</h3>
                        <Table
                            data={sin.df_cr}
                            columns={[
                                { key: 'line', label: 'Line', description: 'Nombre de la línea de transmisión.' },
                                { key: 'from', label: 'From', description: 'Nodo de origen de la línea.' },
                                { key: 'to', label: 'To', description: 'Nodo de destino de la línea.' },
                                { key: 'F', label: 'Flow (MW)', format: formatNum, description: 'Flujo de potencia activa por la línea.', formula: '1/X * (θ_from - θ_to)' },
                                { key: 'CR', label: 'Congestion Rent', format: formatCurrency, description: 'Renta de congestión generada por esta línea.', formula: 'Flujo * (LMP_to - LMP_from)' },
                            ]}
                        />
                    </div>
                </div>

                <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2 mt-6">Generator Dispatch</h3>
                <Table
                    data={sin.df_gen}
                    columns={[
                        { key: 'country', label: 'Country', description: 'País donde está ubicado el generador.' },
                        { key: 'g', label: 'Gen', description: 'Nombre del generador.' },
                        { key: 'pmax', label: 'Pmax (MW)', format: formatNum, description: 'Capacidad máxima de generación.' },
                        { key: 'c', label: 'Cost ($/MWh)', format: formatCurrency, description: 'Costo marginal de generación.' },
                        { key: 'P', label: 'Gen (MW)', format: formatNum, description: 'Potencia despachada por el generador.', formula: '0 <= P <= Pmax' },
                        { key: 'lambda', label: 'LMP', format: formatCurrency, description: 'Precio Marginal Local en el nodo del generador.' },
                        { key: 'revenue', label: 'Revenue', format: formatCurrency, description: 'Ingresos totales del generador por venta de energía.', formula: 'P * LMP' },
                        { key: 'var_cost', label: 'Total Var Cost', format: formatCurrency, description: 'Costo variable total de producción.', formula: 'P * Cost' },
                        { key: 'profit', label: 'Profit', format: formatCurrency, description: 'Beneficio económico neto del generador.', formula: 'Revenue - Total_Var_Cost' },
                    ]}
                />

                <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2 mt-6">Generator Costs by Node</h3>
                <Table
                    data={sin.gen_node}
                    columns={[
                        { key: 'country', label: 'Country', description: 'País del nodo.' },
                        { key: 'node', label: 'Node', description: 'Nombre del nodo agregado.' },
                        { key: 'pmax', label: 'Total Installed (MW)', format: formatNum, description: 'Suma de la capacidad máxima instalada de los generadores en este nodo.', formula: 'Σ Pmax_gen' },
                        { key: 'P', label: 'Total Dispatched (MW)', format: formatNum, description: 'Suma de la potencia efectivamente despachada en este nodo.', formula: 'Σ P_gen' },
                        { key: 'revenue', label: 'Total Revenue', format: formatCurrency, description: 'Monto acumulado por ventas de energía de los generadores en el nodo.', formula: 'Σ Revenue_gen' },
                        { key: 'var_cost', label: 'Total Var Cost', format: formatCurrency, description: 'Costo total acumulado de producción de los generadores en el nodo.', formula: 'Σ Var_Cost_gen' },
                        { key: 'profit', label: 'Total Profit', format: formatCurrency, description: 'Beneficio total neto acumulado de los generadores en el nodo en estado aislado.', formula: 'Σ Profit_gen' },
                    ]}
                />

                <h3 className="font-semibold text-lg text-oirse-text-secondary mb-2 mt-6">Demand Costs</h3>
                <Table
                    data={sin.df_dem}
                    columns={[
                        { key: 'country', label: 'Country', description: 'País al que pertenece la demanda.' },
                        { key: 'node', label: 'Node', description: 'Nombre del nodo donde se ubica la demanda.' },
                        { key: 'lambda', label: 'LMP ($)', format: formatCurrency, description: 'Costo marginal de la barra (LMP) en estado aislado.' },
                        { key: 'D', label: 'Demand (MW)', format: formatNum, description: 'Demanda requerida en el nodo.' },
                        { key: 'pay_dem', label: 'Demand Cost', format: formatCurrency, description: 'Costo total de la demanda pagado a precio marginal.', formula: 'Demanda_Abastecida * LMP' },
                    ]}
                />

                <div className="bg-oirse-bg-elevated border border-oirse-border p-4 rounded mt-8">
                    <h4 className="font-bold text-oirse-text-primary mb-2">Accounting Check (SIN)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="block text-oirse-text-muted">Values Pay</span>
                            <span className="font-mono oirse-number">{formatCurrency(sin.totals.pay_total)}</span>
                        </div>
                        <div>
                            <span className="block text-oirse-text-muted">Gen Revenue</span>
                            <span className="font-mono oirse-number">{formatCurrency(sin.totals.rev_total)}</span>
                        </div>
                        <div>
                            <span className="block text-oirse-text-muted">Congestion Rent</span>
                            <span className="font-mono oirse-number">{formatCurrency(sin.totals.cr_total)}</span>
                        </div>
                        <div>
                            <span className="block text-oirse-text-muted">Residual</span>
                            <span className={`font-mono oirse-number font-bold ${Math.abs(sin.totals.residual) > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {formatNum(sin.totals.residual)}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    );
};

export default ResultsViewer;
