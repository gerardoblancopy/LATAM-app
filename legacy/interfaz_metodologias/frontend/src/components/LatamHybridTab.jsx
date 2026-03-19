import React from 'react';

const formatCurrency = (value, digits = 2) =>
    value != null
        ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
        : '-';

const formatPercent = (value) =>
    value != null
        ? `${(Number(value) * 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
        : '-';

const formatNumber = (value, digits = 2) =>
    value != null
        ? Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
        : '-';

const ShareBar = ({ label, value, colorClass }) => (
    <div>
        <div className="flex items-center justify-between text-xs font-semibold text-oirse-text-muted mb-1">
            <span>{label}</span>
            <span>{formatPercent(value)}</span>
        </div>
        <div className="h-2 rounded-full bg-oirse-bg-primary overflow-hidden">
            <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.max(0, Math.min(100, Number(value || 0) * 100))}%` }} />
        </div>
    </div>
);

const KpiCard = ({ title, value, hint, accent }) => (
    <div className={`kpi-card-oirse ${accent}`}>
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-oirse-text-muted mb-2">{title}</div>
        <div className="text-2xl font-black tracking-tight oirse-number text-oirse-text-primary">{value}</div>
        <div className="text-xs mt-2 text-oirse-text-secondary">{hint}</div>
    </div>
);

const LatamHybridTab = ({ results }) => {
    const latam = results?.latam_hybrid;

    if (!latam) {
        return (
            <div className="rounded-3xl border border-dashed border-oirse-border bg-oirse-bg-surface p-10 text-center text-oirse-text-muted">
                Ejecuta la simulacion para calcular la propuesta LATAM hibrida.
            </div>
        );
    }

    const summary = latam.scalar_summary || {};
    const countries = latam.country_breakdown || [];
    const rules = latam.design_rules || [];

    return (
        <div className="space-y-8">
            <section className="rounded-[2rem] border border-oirse-border bg-gradient-to-br from-oirse-bg-surface to-oirse-bg-elevated p-8 shadow-oirse-lg iridescent-border">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center rounded-full bg-oirse-accent-dim px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-oirse-accent-hover">
                            Propuesta Regulatoria LATAM
                        </div>
                        <h3 className="mt-4 text-3xl font-black tracking-tight text-oirse-text-primary">
                            Remuneracion hibrida: recuperacion regulada tipo SIEPAC, reparto ex ante tipo CBCA y neutralidad para paises perdedores.
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-oirse-text-secondary">
                            Esta vista combina tres capas: ingreso permitido del activo, credito parcial de rentas de congestion y reasignacion del remanente por beneficios
                            economicos y exposicion fisica al activo. El objetivo es que la metodologia sea bancable, regionalmente justa y operable bajo instituciones menos
                            integradas que las europeas.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:w-[29rem]">
                        <KpiCard
                            title="IAR Bruto"
                            value={`${formatCurrency(summary.Gross_ARR_MUSDy)} MUSD/a`}
                            hint="Anualidad regulada antes de creditos"
                            accent="kpi-left-cyan"
                        />
                        <KpiCard
                            title="Renta CR"
                            value={`${formatCurrency(summary.Congestion_Credit_MUSDy)} MUSD/a`}
                            hint="Solo se acredita una parte para no depender de flujos volatiles"
                            accent="kpi-left-green"
                        />
                        <KpiCard
                            title="IAR Neto"
                            value={`${formatCurrency(summary.Net_ARR_MUSDy)} MUSD/a`}
                            hint="Base a repartir entre uso y beneficios"
                            accent="kpi-left-amber"
                        />
                        <KpiCard
                            title="Proteccion"
                            value={`${summary.Countries_Protected}/${summary.Countries_Total}`}
                            hint="Paises con NPV no negativo tras la salvaguarda"
                            accent="kpi-left-green"
                        />
                    </div>
                </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.75rem] border border-oirse-border bg-oirse-bg-surface p-6 shadow-oirse-md">
                    <div className="flex items-center justify-between border-b border-oirse-border pb-4">
                        <div>
                            <h4 className="text-xl font-bold text-oirse-text-primary">Revenue Stack</h4>
                            <p className="text-sm text-oirse-text-muted">Como se descompone el ingreso permitido bajo la propuesta.</p>
                        </div>
                        <div className="rounded-full bg-oirse-bg-elevated px-3 py-1 text-xs font-semibold text-oirse-text-secondary">
                            Caso ilustrativo de 3 paises
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div className="rounded-2xl bg-oirse-bg-elevated p-4 border border-oirse-border">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-oirse-text-secondary">Bloque por uso</span>
                                <span className="text-lg font-black text-oirse-text-primary oirse-number">{formatCurrency(summary.Usage_Block_MUSDy)} MUSD/a</span>
                            </div>
                            <p className="mt-2 text-sm text-oirse-text-muted">
                                Recuperado ex post con cargos a retiros e inyecciones, siguiendo la logica operacional del MER/SIEPAC.
                            </p>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-xl bg-oirse-bg-surface p-3 border border-oirse-border">
                                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-oirse-text-muted">Demanda</div>
                                    <div className="mt-1 text-xl font-black text-oirse-text-primary oirse-number">{formatCurrency(summary.Demand_Block_MUSDy)} MUSD/a</div>
                                    <div className="text-sm text-oirse-text-secondary oirse-number">{formatNumber(summary.Demand_Tariff_USD_per_MWh, 3)} USD/MWh</div>
                                </div>
                                <div className="rounded-xl bg-oirse-bg-surface p-3 border border-oirse-border">
                                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-oirse-text-muted">Generacion</div>
                                    <div className="mt-1 text-xl font-black text-oirse-text-primary oirse-number">{formatCurrency(summary.Generation_Block_MUSDy)} MUSD/a</div>
                                    <div className="text-sm text-oirse-text-secondary oirse-number">{formatNumber(summary.Generation_Tariff_USD_per_MWh, 3)} USD/MWh</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-emerald-500/10 p-4 border border-emerald-400/30">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-emerald-300">Bloque por beneficios</span>
                                <span className="text-lg font-black text-emerald-200 oirse-number">{formatCurrency(summary.Beneficiary_Block_MUSDy)} MUSD/a</span>
                            </div>
                            <p className="mt-2 text-sm text-emerald-300">
                                Asignado ex ante con una mezcla de participacion en beneficios CBA y exposicion territorial al activo.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-[1.75rem] border border-oirse-border bg-oirse-bg-surface p-6 shadow-oirse-md">
                    <h4 className="text-xl font-bold text-oirse-text-primary">Reglas de diseno</h4>
                    <div className="mt-5 space-y-3">
                        {rules.map((rule) => (
                            <div key={rule.step} className="rounded-2xl border border-oirse-border bg-oirse-bg-elevated p-4 border-l-4 border-l-oirse-accent">
                                <div className="text-sm font-bold text-oirse-text-primary">{rule.step}</div>
                                <div className="mt-1 text-sm leading-6 text-oirse-text-secondary">{rule.rule}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="rounded-[1.75rem] border border-oirse-border bg-oirse-bg-surface p-6 shadow-oirse-md">
                <div className="flex flex-col gap-2 border-b border-oirse-border pb-4">
                    <h4 className="text-xl font-bold text-oirse-text-primary">Asignacion por Pais</h4>
                    <p className="text-sm text-oirse-text-muted">
                        La tabla cruza beneficios presentes, reglas de reparto y transferencia de estabilidad. Un valor positivo en la columna de transferencia significa que el
                        pais recibe compensacion; un valor negativo implica que contribuye al fondo de neutralidad.
                    </p>
                </div>

                <div className="mt-6 grid gap-5 xl:grid-cols-3">
                    {countries.map((country) => (
                        <div key={country.country} className="rounded-[1.5rem] border border-oirse-border p-5 bg-oirse-bg-elevated">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-oirse-text-muted">Pais</div>
                                    <div className="mt-1 text-2xl font-black text-oirse-text-primary">{country.country}</div>
                                </div>
                                <div className={`rounded-full px-3 py-1 text-xs font-bold ${country.Host_Neutral ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                    {country.Host_Neutral ? 'Protegido' : 'Ajuste pendiente'}
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-oirse-bg-surface p-3 border border-oirse-border">
                                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-oirse-text-muted">PV Beneficios</div>
                                    <div className="mt-1 text-lg font-black text-oirse-text-primary oirse-number">{formatCurrency(country.PV_Benefits_MUSD)} MUSD</div>
                                </div>
                                <div className="rounded-xl bg-oirse-bg-surface p-3 border border-oirse-border">
                                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-oirse-text-muted">Cargo Final</div>
                                    <div className="mt-1 text-lg font-black text-oirse-text-primary oirse-number">{formatCurrency(country.Final_Charge_MUSDy)} MUSD/a</div>
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                <ShareBar label="Share beneficios" value={country.Benefit_Share} colorClass="bg-emerald-400" />
                                <ShareBar label="Share anfitrion" value={country.Host_Share} colorClass="bg-cyan-400" />
                                <ShareBar label="Share hibrido final" value={country.Hybrid_Share} colorClass="bg-amber-400" />
                            </div>

                            <div className="mt-5 space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-oirse-text-muted">Cargo por uso</span>
                                    <span className="font-semibold text-oirse-text-primary oirse-number">{formatCurrency(country.Usage_Charge_MUSDy)} MUSD/a</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-oirse-text-muted">Cargo por beneficios</span>
                                    <span className="font-semibold text-oirse-text-primary oirse-number">{formatCurrency(country.Beneficiary_Charge_MUSDy)} MUSD/a</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-oirse-text-muted">Transferencia de estabilidad</span>
                                    <span className={`font-semibold oirse-number ${country.Stability_Transfer_MUSDy >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                        {formatCurrency(country.Stability_Transfer_MUSDy)} MUSD/a
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-oirse-border">
                                    <span className="text-oirse-text-muted">NPV neto final</span>
                                    <span className={`font-black oirse-number ${country.PV_Net_Benefit_MUSD >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                                        {formatCurrency(country.PV_Net_Benefit_MUSD)} MUSD
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default LatamHybridTab;
