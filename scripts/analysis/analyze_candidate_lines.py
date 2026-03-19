#!/usr/bin/env python3
"""
Análisis individual de líneas candidatas con la metodología LATAM.

Para cada línea candidata, se "activa" individualmente (las demás permanecen
desactivadas) y se evalúa usando los precios nodales del escenario S0 como
base.  El flujo en cada período se estima como el máximo permitido en la
dirección del gradiente de precios (modelo de transporte).

Luego se aplica la metodología LATAM de 5 pasos para obtener:
  - IAR (Ingreso Anual Requerido)
  - Renta de congestión estimada
  - Asignación de costos por país (CBCA híbrido)
  - Viabilidad (NPV ≥ 0 para ambos países)
"""

import json
import math
import os
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
SCENARIOS_DIR = DATA_DIR / "scenarios"
SCENARIO_EXPERIMENTS_DIR = DATA_DIR / "scenario_experiments"
ANALYSIS_DIR = DATA_DIR / "analysis"


def scenario_path(name):
    scenario_dir = SCENARIOS_DIR / name
    if scenario_dir.exists():
        return scenario_dir
    experiment_dir = SCENARIO_EXPERIMENTS_DIR / name
    if experiment_dir.exists():
        return experiment_dir
    return scenario_dir

# ─── Parámetros LATAM ───────────────────────────────────────────────
DISCOUNT_RATE = 0.08
HORIZON_YEARS = 25
OPEX_PCT = 0.015            # OPEX = 1.5 % del CAPEX anual
CONGESTION_CREDIT_PCT = 0.50
USAGE_RECOVERY_PCT = 0.35
BENEFIT_WEIGHT = 0.85
HOST_WEIGHT = 0.15
HOURS_PER_PERIOD = 8760.0 / 88.0   # ≈ 99.55 h

# ─── Funciones auxiliares ────────────────────────────────────────────

def crf(r, n):
    if n <= 0:
        return 0.0
    if abs(r) < 1e-12:
        return 1.0 / n
    p = (1.0 + r) ** n
    return r * p / (p - 1.0)

def pvaf(r, n):
    if n <= 0:
        return 0.0
    if abs(r) < 1e-12:
        return float(n)
    return (1.0 - (1.0 + r) ** (-n)) / r

# ─── Carga de datos ─────────────────────────────────────────────────

def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

mc_s0 = load_json(scenario_path("S0") / "marginal_costs.json")
lines_s1 = load_json(scenario_path("S1") / "lines_processed.json")
dem_s0 = load_json(scenario_path("S0") / "demand_summary.json")
gen_s0 = load_json(scenario_path("S0") / "generators_summary.json")

# Mapa nodo → país  y  precios nodales S0
node_to_country = {}
node_prices_s0 = {}   # node_name -> [88 floats]
for country_code, node_dict in mc_s0["countries"].items():
    for node_name, prices in node_dict.items():
        node_to_country[node_name] = country_code
        node_prices_s0[node_name] = prices

# Mapa país → nombre largo
COUNTRY_NAMES = {
    "AR": "Argentina", "BO": "Bolivia", "BR": "Brasil", "CL": "Chile",
    "CO": "Colombia", "CR": "Costa Rica", "EC": "Ecuador", "ES": "El Salvador",
    "GU": "Guatemala", "HN": "Honduras", "MX": "México", "NI": "Nicaragua",
    "PA": "Panamá", "PE": "Perú", "PY": "Paraguay", "UY": "Uruguay",
    "VZ": "Venezuela", "BE": "Belice",
}

# Demanda anual por país (MWh)  – para tarifa por uso
demand_by_country = {}
for c, nodes in dem_s0.items():
    demand_by_country[c] = sum(n["demand"] for n in nodes)

# Generación anual por país (proxy: total production in S0)
gen_by_country = {}
for c, gens in gen_s0.items():
    gen_by_country[c] = sum(g["prod"] for g in gens)

# ─── Candidatas ──────────────────────────────────────────────────────
candidates = [l for l in lines_s1 if l["Estado"] == "Candidata"]

# ─── Análisis línea por línea ────────────────────────────────────────

CRF_val = crf(DISCOUNT_RATE, HORIZON_YEARS)
PVAF_val = pvaf(DISCOUNT_RATE, HORIZON_YEARS)

results = []

for line in candidates:
    name = line["Nombre"]
    parts = name.split(" --> ")
    fr_node = parts[0].strip()
    to_node = parts[1].strip()
    fr_country = node_to_country[fr_node]
    to_country = node_to_country[to_node]
    fmax = line["Fmax directo (MW)"]
    capex = line["Inversion total sin anualizar (MUSD)"]
    dist_km = line["Distancia (km)"]

    prices_fr = node_prices_s0[fr_node]
    prices_to = node_prices_s0[to_node]

    # ── 1. Estimar flujo y renta de congestión ──────────────────────
    total_cr_usd = 0.0
    total_energy_mwh = 0.0
    flow_fr_to_mwh = 0.0
    flow_to_fr_mwh = 0.0
    periods_congested = 0
    avg_price_diff = 0.0

    for t in range(88):
        lam_fr = prices_fr[t]
        lam_to = prices_to[t]
        diff = lam_to - lam_fr   # positivo => flujo fr→to es rentable

        if abs(diff) < 0.01:
            continue  # sin diferencial, sin flujo

        periods_congested += 1
        # En modelo de transporte, flujo va al máximo en dirección del gradiente
        flow_mw = fmax if diff > 0 else -fmax
        energy_mwh = abs(flow_mw) * HOURS_PER_PERIOD
        cr_usd = abs(flow_mw) * abs(diff) * HOURS_PER_PERIOD  # USD

        total_cr_usd += cr_usd
        total_energy_mwh += energy_mwh
        avg_price_diff += abs(diff)

        if flow_mw > 0:
            flow_fr_to_mwh += energy_mwh
        else:
            flow_to_fr_mwh += energy_mwh

    total_cr_musd = total_cr_usd / 1e6
    avg_price_diff = avg_price_diff / max(periods_congested, 1)
    utilization = periods_congested / 88.0

    # ── 2. Beneficios por país (CBA simplificado) ───────────────────
    # Importador: ahorro del consumidor  ≈ energía importada × Δprecio × 0.5
    #   (triángulo de bienestar – el 0.5 es la aproximación lineal)
    # Exportador: ganancia del productor ≈ energía exportada × Δprecio × 0.5
    # Plus: 50 % de la CR se asigna a cada lado
    #
    # Para simplificar: split total benefits = CR + trade surplus
    # Asignar proporcionalmente a importador y exportador.

    # Determinar quién es importador neto y quién exportador
    if flow_fr_to_mwh >= flow_to_fr_mwh:
        net_exporter = fr_country
        net_importer = to_country
        net_flow_mwh = flow_fr_to_mwh - flow_to_fr_mwh
    else:
        net_exporter = to_country
        net_importer = fr_country
        net_flow_mwh = flow_to_fr_mwh - flow_fr_to_mwh

    # Beneficio total anual ≈ CR (es una aproximación conservadora;
    # el verdadero beneficio social incluye excedentes que normalmente > CR)
    # Usamos factor 1.3× para reflejar que el bienestar social total
    # suele exceder la CR pura (efecto precio sobre demanda inframarginal)
    WELFARE_MULTIPLIER = 1.3
    total_annual_benefit = total_cr_musd * WELFARE_MULTIPLIER

    # Split: 55 % importador / 45 % exportador (patrón típico en CBA de interconexiones)
    benefit_importer = total_annual_benefit * 0.55
    benefit_exporter = total_annual_benefit * 0.45

    pv_benefit = {}
    pv_benefit[net_importer] = benefit_importer * PVAF_val
    pv_benefit[net_exporter] = benefit_exporter * PVAF_val

    # ── 3. LATAM Methodology ────────────────────────────────────────
    opex = capex * OPEX_PCT
    gross_arr = capex * CRF_val + opex        # MUSD/año
    cong_credit = min(total_cr_musd * CONGESTION_CREDIT_PCT, gross_arr)
    net_arr = max(gross_arr - cong_credit, 0.0)

    usage_block = net_arr * USAGE_RECOVERY_PCT
    beneficiary_block = net_arr - usage_block

    # Benefit share (solo 2 países involucrados)
    countries_involved = [net_exporter, net_importer]
    pv_b_exp = pv_benefit.get(net_exporter, 0.0)
    pv_b_imp = pv_benefit.get(net_importer, 0.0)
    total_pv_b = pv_b_exp + pv_b_imp

    if total_pv_b > 0:
        benefit_share_exp = pv_b_exp / total_pv_b
        benefit_share_imp = pv_b_imp / total_pv_b
    else:
        benefit_share_exp = 0.5
        benefit_share_imp = 0.5

    # Host share: 50/50 (cada país aloja un extremo)
    host_share_exp = 0.5
    host_share_imp = 0.5

    # Hybrid share
    hybrid_exp = BENEFIT_WEIGHT * benefit_share_exp + HOST_WEIGHT * host_share_exp
    hybrid_imp = BENEFIT_WEIGHT * benefit_share_imp + HOST_WEIGHT * host_share_imp
    h_total = hybrid_exp + hybrid_imp
    hybrid_exp /= h_total
    hybrid_imp /= h_total

    # Usage block: proporcional a demanda
    dem_exp = demand_by_country.get(net_exporter, 1.0)
    dem_imp = demand_by_country.get(net_importer, 1.0)
    dem_total = dem_exp + dem_imp
    usage_exp = usage_block * (dem_exp / dem_total)
    usage_imp = usage_block * (dem_imp / dem_total)

    # Beneficiary block: proporcional a hybrid share
    benef_exp = beneficiary_block * hybrid_exp
    benef_imp = beneficiary_block * hybrid_imp

    # Total annual charge per country
    charge_exp = usage_exp + benef_exp
    charge_imp = usage_imp + benef_imp

    # PV costs
    pv_cost_exp = charge_exp * PVAF_val
    pv_cost_imp = charge_imp * PVAF_val

    # NPV
    npv_exp = pv_b_exp - pv_cost_exp
    npv_imp = pv_b_imp - pv_cost_imp

    # ── 4. Stability check (no-loser) ──────────────────────────────
    needs_transfer = npv_exp < 0 or npv_imp < 0
    stability_ok = npv_exp >= -0.001 and npv_imp >= -0.001

    # If one country has negative NPV, compute transfer needed
    transfer_needed = 0.0
    if npv_exp < 0:
        transfer_needed = abs(npv_exp)
    elif npv_imp < 0:
        transfer_needed = abs(npv_imp)

    # After transfer
    if needs_transfer:
        if npv_exp < 0:
            npv_exp_post = 0.0
            npv_imp_post = npv_imp - transfer_needed
        else:
            npv_imp_post = 0.0
            npv_exp_post = npv_exp - transfer_needed
        both_positive_post = npv_exp_post >= -0.001 and npv_imp_post >= -0.001
    else:
        npv_exp_post = npv_exp
        npv_imp_post = npv_imp
        both_positive_post = True

    # ── 5. Viability classification ─────────────────────────────────
    ratio_cr_to_arr = total_cr_musd / gross_arr if gross_arr > 0 else 0

    if both_positive_post and ratio_cr_to_arr >= 0.3:
        viability = "ALTA"
    elif both_positive_post and ratio_cr_to_arr >= 0.1:
        viability = "MEDIA"
    elif total_cr_musd > 0 and both_positive_post:
        viability = "BAJA"
    elif total_cr_musd > 0:
        viability = "CONDICIONADA"
    else:
        viability = "NO VIABLE"

    results.append({
        "name": name,
        "fr_node": fr_node,
        "to_node": to_node,
        "fr_country": fr_country,
        "to_country": to_country,
        "net_exporter": net_exporter,
        "net_importer": net_importer,
        "fmax_mw": fmax,
        "capex_musd": capex,
        "dist_km": dist_km,
        "cost_per_km": capex / dist_km if dist_km > 0 else 0,
        "opex_musd_y": opex,
        "gross_arr_musd_y": gross_arr,
        "cr_musd_y": total_cr_musd,
        "cr_arr_ratio": ratio_cr_to_arr,
        "cong_credit_musd_y": cong_credit,
        "net_arr_musd_y": net_arr,
        "usage_block_musd_y": usage_block,
        "beneficiary_block_musd_y": beneficiary_block,
        "total_energy_gwh": total_energy_mwh / 1e3,
        "net_flow_gwh": net_flow_mwh / 1e3,
        "utilization_pct": utilization * 100,
        "avg_price_diff_usd_mwh": avg_price_diff,
        "periods_congested": periods_congested,
        "pv_benefit_exp_musd": pv_b_exp,
        "pv_benefit_imp_musd": pv_b_imp,
        "hybrid_share_exp": hybrid_exp,
        "hybrid_share_imp": hybrid_imp,
        "charge_exp_musd_y": charge_exp,
        "charge_imp_musd_y": charge_imp,
        "npv_exp_musd": npv_exp,
        "npv_imp_musd": npv_imp,
        "needs_transfer": needs_transfer,
        "transfer_pv_musd": transfer_needed,
        "npv_exp_post_musd": npv_exp_post,
        "npv_imp_post_musd": npv_imp_post,
        "both_positive_post": both_positive_post,
        "viability": viability,
    })

# ─── Output ──────────────────────────────────────────────────────────

print("=" * 120)
print("ANÁLISIS INDIVIDUAL DE LÍNEAS CANDIDATAS – METODOLOGÍA LATAM")
print(f"Parámetros: r={DISCOUNT_RATE*100:.0f}%, n={HORIZON_YEARS} años, CRF={CRF_val:.5f}, PVAF={PVAF_val:.3f}")
print(f"OPEX={OPEX_PCT*100:.1f}% CAPEX, Crédito congestión={CONGESTION_CREDIT_PCT*100:.0f}%, "
      f"Uso={USAGE_RECOVERY_PCT*100:.0f}%, Beneficio={BENEFIT_WEIGHT*100:.0f}%/Host={HOST_WEIGHT*100:.0f}%")
print("=" * 120)

for r in results:
    print(f"\n{'─' * 100}")
    print(f"LÍNEA: {r['name']}")
    print(f"  {COUNTRY_NAMES.get(r['fr_country'], r['fr_country'])} → {COUNTRY_NAMES.get(r['to_country'], r['to_country'])}"
          f"  |  Fmax: {r['fmax_mw']:.0f} MW  |  Dist: {r['dist_km']:.0f} km  |  CAPEX: {r['capex_musd']:.1f} MUSD ({r['cost_per_km']:.2f} M$/km)")
    print(f"  Exportador neto: {COUNTRY_NAMES.get(r['net_exporter'], r['net_exporter'])}"
          f"  →  Importador neto: {COUNTRY_NAMES.get(r['net_importer'], r['net_importer'])}")
    print()

    print(f"  FLUJO Y CONGESTIÓN:")
    print(f"    Períodos congestionados: {r['periods_congested']}/88 ({r['utilization_pct']:.0f}%)")
    print(f"    Energía total transada:  {r['total_energy_gwh']:.0f} GWh/año")
    print(f"    Flujo neto:              {r['net_flow_gwh']:.0f} GWh/año")
    print(f"    Δprecio promedio:        {r['avg_price_diff_usd_mwh']:.1f} USD/MWh")
    print(f"    Renta congestión (CR):   {r['cr_musd_y']:.2f} MUSD/año")
    print()

    print(f"  LATAM – INGRESO REGULADO:")
    print(f"    CAPEX:         {r['capex_musd']:.1f} MUSD")
    print(f"    OPEX:          {r['opex_musd_y']:.2f} MUSD/año")
    print(f"    IAR bruto:     {r['gross_arr_musd_y']:.2f} MUSD/año")
    print(f"    Crédito CR:    {r['cong_credit_musd_y']:.2f} MUSD/año")
    print(f"    IAR neto:      {r['net_arr_musd_y']:.2f} MUSD/año")
    print(f"    CR/IAR ratio:  {r['cr_arr_ratio']*100:.1f}%")
    print()

    print(f"  LATAM – ASIGNACIÓN DE COSTOS:")
    exp_name = COUNTRY_NAMES.get(r['net_exporter'], r['net_exporter'])
    imp_name = COUNTRY_NAMES.get(r['net_importer'], r['net_importer'])
    print(f"    {'País':<15} {'Hybrid%':>8} {'Cargo':>10} {'PV Benef':>10} {'NPV pre':>10} {'NPV post':>10}")
    print(f"    {exp_name:<15} {r['hybrid_share_exp']*100:>7.1f}% {r['charge_exp_musd_y']:>9.2f} {r['pv_benefit_exp_musd']:>9.1f} {r['npv_exp_musd']:>9.1f} {r['npv_exp_post_musd']:>9.1f}")
    print(f"    {imp_name:<15} {r['hybrid_share_imp']*100:>7.1f}% {r['charge_imp_musd_y']:>9.2f} {r['pv_benefit_imp_musd']:>9.1f} {r['npv_imp_musd']:>9.1f} {r['npv_imp_post_musd']:>9.1f}")
    print()

    if r['needs_transfer']:
        print(f"    ⚠ Transferencia estabilizadora necesaria: {r['transfer_pv_musd']:.1f} MUSD (PV)")

    print(f"  ═══ VIABILIDAD LATAM: {r['viability']} ═══")

# ─── Tabla resumen ───────────────────────────────────────────────────
print("\n\n" + "=" * 140)
print("TABLA RESUMEN")
print("=" * 140)
header = f"{'Línea':<35} {'Cap':>5} {'CAPEX':>7} {'IAR':>7} {'CR':>7} {'CR/IAR':>7} {'Util%':>6} {'ΔP':>6} {'NPV_exp':>8} {'NPV_imp':>8} {'Viabilidad':>12}"
print(header)
print("-" * 140)

for r in results:
    print(f"{r['name']:<35} {r['fmax_mw']:>5.0f} {r['capex_musd']:>7.1f} {r['gross_arr_musd_y']:>7.2f} "
          f"{r['cr_musd_y']:>7.2f} {r['cr_arr_ratio']*100:>6.1f}% {r['utilization_pct']:>5.0f}% "
          f"{r['avg_price_diff_usd_mwh']:>6.1f} {r['npv_exp_post_musd']:>8.1f} {r['npv_imp_post_musd']:>8.1f} "
          f"{r['viability']:>12}")

# ─── Ranking por viabilidad ──────────────────────────────────────────
print("\n\n" + "=" * 80)
print("RANKING POR VIABILIDAD LATAM")
print("=" * 80)
viab_order = {"ALTA": 0, "MEDIA": 1, "BAJA": 2, "CONDICIONADA": 3, "NO VIABLE": 4}
ranked = sorted(results, key=lambda x: (viab_order.get(x["viability"], 5), -x["cr_arr_ratio"]))

for i, r in enumerate(ranked, 1):
    exp_name = COUNTRY_NAMES.get(r['net_exporter'], r['net_exporter'])[:3].upper()
    imp_name = COUNTRY_NAMES.get(r['net_importer'], r['net_importer'])[:3].upper()
    print(f"  {i:>2}. [{r['viability']:>12}] {r['name']:<35} "
          f"CR/IAR={r['cr_arr_ratio']*100:>5.1f}%  {exp_name}→{imp_name}  "
          f"CR={r['cr_musd_y']:.1f} MUSD/y")

# ─── Save results to JSON ───────────────────────────────────────────
ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
output_path = ANALYSIS_DIR / "latam_individual_analysis.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(f"\n✓ Resultados guardados en: {output_path}")
