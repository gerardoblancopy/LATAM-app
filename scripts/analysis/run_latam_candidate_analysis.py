#!/usr/bin/env python3
import argparse
import csv
import json
import math
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
SCENARIOS_DIR = DATA_DIR / "scenarios"
SCENARIO_EXPERIMENTS_DIR = DATA_DIR / "scenario_experiments"
ANALYSIS_DIR = DATA_DIR / "analysis"
BASELINE_SCENARIO = "S0_LATAM_BASE"
OUTPUT_JSON = ANALYSIS_DIR / "latam_marginal_analysis.json"
OUTPUT_CSV = ANALYSIS_DIR / "latam_marginal_summary.csv"
RUN_LOGS_DIR = ANALYSIS_DIR / "latam_run_logs"

DEFAULT_CONFIG = {
    "year_obj": 2025,
    "costo_combustible": "Cst_med",
    "hidrologia": "H_media",
    "inversiones_intx": "Con_intx",
    "sincarbonCL": False,
    "inversiones_gx": "Sin_gx",
    "demanda_tipo": "Dem_base",
    "bloquear_invtx_nacional": True,
    "bloquear_invtx_existenteinternacional": True,
    "flux0_internacional_candidata": False,
}
MONEY_EPS = 1.0


def resolve_scenario_dir(scenario_name: str) -> Path:
    scenario_dir = SCENARIOS_DIR / scenario_name
    if scenario_dir.exists():
        return scenario_dir
    experiment_dir = SCENARIO_EXPERIMENTS_DIR / scenario_name
    if experiment_dir.exists():
        return experiment_dir
    return scenario_dir


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data):
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def run_model(config, reuse=False):
    scenario = config["escenario_ejecucion"]
    scenario_dir = resolve_scenario_dir(scenario)
    required = [
        scenario_dir / "generators_summary.json",
        scenario_dir / "demand_summary.json",
        scenario_dir / "flows_results.json",
        scenario_dir / "marginal_costs.json",
        scenario_dir / "lines_processed.json",
    ]
    if reuse and all(p.exists() for p in required):
        return

    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    RUN_LOGS_DIR.mkdir(exist_ok=True)
    log_path = RUN_LOGS_DIR / f"{scenario}.log"
    cmd = [sys.executable, str(PROJECT_ROOT / "data_processing.py"), json.dumps(config)]
    with log_path.open("w", encoding="utf-8") as log_file:
        subprocess.run(cmd, cwd=PROJECT_ROOT, stdout=log_file, stderr=subprocess.STDOUT, check=True)


def get_country_stats(country, gen_data, dem_data):
    stats = {
        "genProfit": 0.0,
        "genRevenue": 0.0,
        "varCost": 0.0,
        "prod": 0.0,
        "cap": 0.0,
        "demandCost": 0.0,
        "demandMW": 0.0,
    }
    for g in gen_data.get(country, []):
        stats["genProfit"] += float(g.get("profit", 0.0) or 0.0)
        stats["genRevenue"] += float(g.get("rev", 0.0) or 0.0)
        stats["varCost"] += float(g.get("total_var_cost", 0.0) or 0.0)
        stats["prod"] += float(g.get("prod", 0.0) or 0.0)
        stats["cap"] += float(g.get("capmax", 0.0) or 0.0) + float(g.get("inv_pot_MW", 0.0) or 0.0)
    for d in dem_data.get(country, []):
        stats["demandCost"] += float(d.get("demand_cost", 0.0) or 0.0)
        stats["demandMW"] += float(d.get("demand", 0.0) or 0.0)
    return stats


def get_system_countries(gen_s0, gen_s1, dem_s0, dem_s1):
    countries = set()
    for dataset in (gen_s0, gen_s1, dem_s0, dem_s1):
        countries.update(dataset.keys())
    return sorted(countries)


def find_node_lmps(mc_data, node_name):
    for country_nodes in mc_data.get("countries", {}).values():
        if node_name in country_nodes:
            return country_nodes[node_name]
    return None


def calculate_congestion_rent(mc_data, flow_data, from_node, to_node, line_name):
    lmp_from = find_node_lmps(mc_data, from_node)
    lmp_to = find_node_lmps(mc_data, to_node)
    flows = flow_data.get("flows", {}).get(line_name, [])
    if not lmp_from or not lmp_to or not flows:
        return 0.0
    division_hours = 8760.0 / len(flows)
    return sum((float(f or 0.0) * ((lmp_to[i] or 0.0) - (lmp_from[i] or 0.0)) * division_hours) for i, f in enumerate(flows))


def get_country_benefit_rows(gen_s0, gen_s1, dem_s0, dem_s1):
    rows = []
    for country in get_system_countries(gen_s0, gen_s1, dem_s0, dem_s1):
        sin_stats = get_country_stats(country, gen_s0, dem_s0)
        con_stats = get_country_stats(country, gen_s1, dem_s1)
        delta_producer = con_stats["genProfit"] - sin_stats["genProfit"]
        delta_demand_cost = con_stats["demandCost"] - sin_stats["demandCost"]
        annual_benefit = delta_producer - delta_demand_cost
        if abs(annual_benefit) > MONEY_EPS:
            rows.append({
                "country": country,
                "sin": sin_stats,
                "con": con_stats,
                "deltaProducer": delta_producer,
                "deltaDemandCost": delta_demand_cost,
                "annualBenefit": annual_benefit,
                "positiveBenefit": max(annual_benefit, 0.0),
            })
    return rows


def unique(seq):
    seen = []
    for item in seq:
        if item and item not in seen:
            seen.append(item)
    return seen


def build_settlement(signatory_countries, scope_countries, benefit_map, projected_residual):
    eps = MONEY_EPS
    scope = unique([*signatory_countries, *scope_countries])
    rows = []
    positive_total = 0.0
    for country in scope:
        row = benefit_map.get(country, {
            "country": country,
            "deltaProducer": 0.0,
            "deltaDemandCost": 0.0,
            "annualBenefit": 0.0,
        })
        annual_benefit = float(row.get("annualBenefit", 0.0) or 0.0)
        positive_benefit = max(annual_benefit, 0.0)
        positive_total += positive_benefit
        rows.append({
            "country": country,
            "deltaProducer": float(row.get("deltaProducer", 0.0) or 0.0),
            "deltaDemandCost": float(row.get("deltaDemandCost", 0.0) or 0.0),
            "annualBenefit": annual_benefit,
            "positiveBenefit": positive_benefit,
            "demandLoss": max(float(row.get("deltaDemandCost", 0.0) or 0.0), 0.0),
            "domesticWinners": max(float(row.get("deltaProducer", 0.0) or 0.0), 0.0),
            "isSignatory": country in signatory_countries,
        })

    fallback_share = 1.0 / len(rows) if rows else 0.0
    for row in rows:
        row["cbcaShare"] = row["positiveBenefit"] / positive_total if positive_total > eps else fallback_share
        row["initialCharge"] = row["cbcaShare"] * projected_residual
        row["netBeforeRegional"] = row["annualBenefit"] - row["initialCharge"]
        row["regionalReceived"] = 0.0
        row["regionalPaid"] = 0.0
        row["regionalAppliedToDemand"] = 0.0
        row["domesticComp"] = 0.0
        row["externalTopUpReceived"] = 0.0
        row["externalTopUpPaid"] = 0.0

    deficit_rows = [row for row in rows if row["netBeforeRegional"] < -eps]
    surplus_rows = [row for row in rows if row["netBeforeRegional"] > eps]
    deficit_total = sum(abs(row["netBeforeRegional"]) for row in deficit_rows)
    surplus_total = sum(row["netBeforeRegional"] for row in surplus_rows)
    regional_transfer = min(deficit_total, surplus_total)

    if regional_transfer > eps and deficit_total > eps and surplus_total > eps:
        for row in deficit_rows:
            row["regionalReceived"] = regional_transfer * (abs(row["netBeforeRegional"]) / deficit_total)
        for row in surplus_rows:
            row["regionalPaid"] = regional_transfer * (row["netBeforeRegional"] / surplus_total)

    for row in rows:
        row["regionalNet"] = row["regionalReceived"] - row["regionalPaid"]
        row["netAfterRegional"] = row["netBeforeRegional"] + row["regionalNet"]
        row["regionalAppliedToDemand"] = min(row["demandLoss"], row["regionalReceived"])
        row["lossAfterRegional"] = max(0.0, row["demandLoss"] - row["regionalAppliedToDemand"])
        row["domesticComp"] = min(row["lossAfterRegional"], row["domesticWinners"])
        row["lossAfterDomestic"] = max(0.0, row["lossAfterRegional"] - row["domesticComp"])

    external_need_rows = [row for row in rows if row["lossAfterDomestic"] > eps]
    external_payer_rows = [row for row in rows if row["lossAfterDomestic"] <= eps and row["netAfterRegional"] > eps]
    external_need_total = sum(row["lossAfterDomestic"] for row in external_need_rows)
    external_available_total = sum(row["netAfterRegional"] for row in external_payer_rows)
    external_top_up = min(external_need_total, external_available_total)

    if external_top_up > eps and external_need_total > eps and external_available_total > eps:
        for row in external_need_rows:
            row["externalTopUpReceived"] = external_top_up * (row["lossAfterDomestic"] / external_need_total)
        for row in external_payer_rows:
            row["externalTopUpPaid"] = external_top_up * (row["netAfterRegional"] / external_available_total)

    for row in rows:
        row["demandFinalLoss"] = max(0.0, row["lossAfterDomestic"] - row["externalTopUpReceived"])
        row["netAfterCountry"] = row["netAfterRegional"] + row["externalTopUpReceived"] - row["externalTopUpPaid"]

    rows.sort(key=lambda row: (not row["isSignatory"], -row["annualBenefit"]))
    signatory_rows = [row for row in rows if row["isSignatory"]]
    signatory_regional_pass = all(row["netAfterRegional"] >= -eps for row in signatory_rows)
    signatory_country_pass = all(row["demandFinalLoss"] <= eps for row in signatory_rows)
    requires_external_top_up = any((row["externalTopUpReceived"] > eps or row["externalTopUpPaid"] > eps) for row in signatory_rows)

    return {
        "rows": rows,
        "positiveTotal": positive_total,
        "deficitTotal": deficit_total,
        "surplusTotal": surplus_total,
        "regionalTransfer": regional_transfer,
        "externalTopUp": external_top_up,
        "signatoryRows": signatory_rows,
        "signatoryRegionalPass": signatory_regional_pass,
        "signatoryCountryPass": signatory_country_pass,
        "requiresExternalTopUp": requires_external_top_up,
    }


def line_capex_usd(line_meta, tx_rows, line_name):
    tx_row = next((row for row in tx_rows if row.get("Nombre línea") == line_name), None)
    if tx_row:
        capex_siepac = tx_row.get("Capex_SIEPAC_MUSD")
        if capex_siepac is not None and float(capex_siepac) > 0:
            return float(capex_siepac) * 1_000_000.0
        unit_cost = tx_row.get("Costo_unitario")
        if unit_cost is not None:
            return float(unit_cost)
    inversion_musd = line_meta.get("Inversion total sin anualizar (MUSD)")
    if inversion_musd is not None:
        return float(inversion_musd) * 1_000_000.0
    return 0.0


def analyze_line(line_meta, baseline, scenario_name):
    scenario_dir = resolve_scenario_dir(scenario_name)
    gen_s1 = load_json(scenario_dir / "generators_summary.json")
    dem_s1 = load_json(scenario_dir / "demand_summary.json")
    flow_s1 = load_json(scenario_dir / "flows_results.json")
    mc_s1 = load_json(scenario_dir / "marginal_costs.json")
    lines_s1 = load_json(scenario_dir / "lines_processed.json")
    tx_rows = load_json(scenario_dir / "tx_investment.json") if (scenario_dir / "tx_investment.json").exists() else []

    line_name = line_meta["Nombre"]
    from_node = line_meta["Nodo_ini"]
    to_node = line_meta["Nodo_fin"]
    exp_country = line_meta["pais_ini"]
    imp_country = line_meta["pais_fin"]
    fmax = float(line_meta["Fmax directo (MW)"] or 0.0)
    line_record = next((row for row in lines_s1 if row.get("Nombre") == line_name), line_meta)

    benefit_rows = get_country_benefit_rows(baseline["gen"], gen_s1, baseline["dem"], dem_s1)
    benefit_map = {row["country"]: row for row in benefit_rows}
    signatory_countries = unique([exp_country, imp_country])
    positive_benefit_rows = [row for row in benefit_rows if row["annualBenefit"] > MONEY_EPS]
    shadow_countries = unique(signatory_countries + [row["country"] for row in positive_benefit_rows])

    line_flows = flow_s1.get("flows", {}).get(line_name, [])
    modeled_cr = max(0.0, calculate_congestion_rent(mc_s1, flow_s1, from_node, to_node, line_name))
    sum_abs_flow = sum(abs(float(value or 0.0)) for value in line_flows)
    use_fraction = min(1.0, sum_abs_flow / (fmax * len(line_flows))) if fmax > 0 and line_flows else 0.0

    capex_usd = line_capex_usd(line_record, tx_rows, line_name)
    r = 0.06
    n = 25
    om = 0.015
    pow_term = (1.0 + r) ** n
    crf = (r * pow_term) / (pow_term - 1.0) if r > 0 else 1.0 / n
    projected_iar = capex_usd * crf + (capex_usd * om)
    expected_cr = modeled_cr
    projected_residual = max(0.0, projected_iar - expected_cr)
    realized_iar = projected_iar
    realized_cr = modeled_cr
    fund_initial = 0.0
    realized_residual = max(0.0, realized_iar - realized_cr)
    fund_delta = projected_residual - realized_residual
    fund_final_raw = fund_initial + fund_delta
    fund_final = max(0.0, fund_final_raw)
    uncovered_shortfall = max(0.0, -fund_final_raw)

    obligatory = build_settlement(signatory_countries, signatory_countries, benefit_map, projected_residual)
    shadow = build_settlement(signatory_countries, shadow_countries, benefit_map, projected_residual)
    obligatory_pass = obligatory["signatoryRegionalPass"] and obligatory["signatoryCountryPass"]
    shadow_pass = shadow["signatoryRegionalPass"] and shadow["signatoryCountryPass"]
    regionalization_only = (not obligatory_pass) and shadow_pass
    no_viable = (not obligatory_pass) and (not shadow_pass)
    final_classification = (
        "Viable bilateralmente" if obligatory_pass else
        "Viable solo con regionalización" if regionalization_only else
        "No viable económicamente"
    )

    spillovers = [row for row in shadow["rows"] if (not row["isSignatory"]) and row["annualBenefit"] > MONEY_EPS]
    spillovers.sort(key=lambda row: row["annualBenefit"], reverse=True)

    return {
        "lineId": int(line_meta["ID"]),
        "scenario": scenario_name,
        "name": line_name,
        "fromNode": from_node,
        "toNode": to_node,
        "fromCountry": exp_country,
        "toCountry": imp_country,
        "fmaxMW": fmax,
        "capexUSD": capex_usd,
        "lifeYears": n,
        "discountRate": r,
        "omFractionAnnual": om,
        "modeledCRUSDPerYear": modeled_cr,
        "projectedIARUSDPerYear": projected_iar,
        "projectedResidualUSDPerYear": projected_residual,
        "realizedIARUSDPerYear": realized_iar,
        "realizedCRUSDPerYear": realized_cr,
        "realizedResidualUSDPerYear": realized_residual,
        "fundInitialUSD": fund_initial,
        "fundDeltaUSD": fund_delta,
        "fundFinalUSD": fund_final,
        "uncoveredShortfallUSD": uncovered_shortfall,
        "useFraction": use_fraction,
        "benefitRows": benefit_rows,
        "signatoryCountries": signatory_countries,
        "shadowCountries": shadow_countries,
        "obligatory": obligatory,
        "shadow": shadow,
        "regionalizationOnly": regionalization_only,
        "noViable": no_viable,
        "finalClassification": final_classification,
        "topSpillovers": spillovers[:5],
    }


def main():
    parser = argparse.ArgumentParser(description="Run marginal LATAM analysis for each candidate line.")
    parser.add_argument("--reuse", action="store_true", help="Reuse existing scenario folders if they already contain outputs.")
    parser.add_argument("--line-id", type=int, default=None, help="Run only one candidate line ID for a pilot or targeted refresh.")
    args = parser.parse_args()

    lines = load_json(resolve_scenario_dir("S1") / "lines_processed.json")
    candidates = [line for line in lines if line.get("Estado") == "Candidata" and line.get("propiedad") == "Internacional"]
    if args.line_id is not None:
        candidates = [line for line in candidates if int(line["ID"]) == args.line_id]
        if not candidates:
            raise ValueError(f"No candidate line found with ID {args.line_id}")

    baseline_config = {**DEFAULT_CONFIG, "escenario_ejecucion": BASELINE_SCENARIO, "ordendemerito": True}
    run_model(baseline_config, reuse=args.reuse)

    baseline = {
        "gen": load_json(resolve_scenario_dir(BASELINE_SCENARIO) / "generators_summary.json"),
        "dem": load_json(resolve_scenario_dir(BASELINE_SCENARIO) / "demand_summary.json"),
        "flow": load_json(resolve_scenario_dir(BASELINE_SCENARIO) / "flows_results.json"),
        "mc": load_json(resolve_scenario_dir(BASELINE_SCENARIO) / "marginal_costs.json"),
    }

    analyses = []
    for line in candidates:
        scenario_name = f"S1_LINE_{int(line['ID']):02d}"
        config = {
            **DEFAULT_CONFIG,
            "escenario_ejecucion": scenario_name,
            "ordendemerito": True,
            "linea_obj": int(line["ID"]),
        }
        print(f"Running marginal case for {line['Nombre']} -> {scenario_name}")
        run_model(config, reuse=args.reuse)
        analyses.append(analyze_line(line, baseline, scenario_name))

    analyses.sort(key=lambda row: (row["finalClassification"] != "Viable bilateralmente", -row["modeledCRUSDPerYear"]))
    summary = {
        "baselineScenario": BASELINE_SCENARIO,
        "candidateCount": len(analyses),
        "classifications": {
            "viable_bilateralmente": sum(1 for row in analyses if row["finalClassification"] == "Viable bilateralmente"),
            "viable_solo_con_regionalizacion": sum(1 for row in analyses if row["finalClassification"] == "Viable solo con regionalización"),
            "no_viable": sum(1 for row in analyses if row["finalClassification"] == "No viable económicamente"),
        },
        "lines": analyses,
    }
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    save_json(OUTPUT_JSON, summary)

    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "line_id", "name", "from_country", "to_country", "fmax_mw", "capex_musd",
            "iar_musd_y", "cr_musd_y", "residual_musd_y", "use_pct", "classification"
        ])
        for row in analyses:
            writer.writerow([
                row["lineId"],
                row["name"],
                row["fromCountry"],
                row["toCountry"],
                round(row["fmaxMW"], 3),
                round(row["capexUSD"] / 1_000_000.0, 3),
                round(row["projectedIARUSDPerYear"] / 1_000_000.0, 3),
                round(row["modeledCRUSDPerYear"] / 1_000_000.0, 3),
                round(row["projectedResidualUSDPerYear"] / 1_000_000.0, 3),
                round(100.0 * row["useFraction"], 2),
                row["finalClassification"],
            ])

    print(f"Wrote {OUTPUT_JSON}")
    print(f"Wrote {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
