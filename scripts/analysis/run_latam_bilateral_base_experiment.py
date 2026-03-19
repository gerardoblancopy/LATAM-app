#!/usr/bin/env python3
import argparse
import csv
import json

from run_latam_candidate_analysis import (
    ANALYSIS_DIR,
    DEFAULT_CONFIG,
    RUN_LOGS_DIR,
    analyze_line,
    load_json,
    resolve_scenario_dir,
    run_model,
    save_json,
)


ORIGINAL_ANALYSIS = ANALYSIS_DIR / "latam_marginal_analysis.json"
OUTPUT_JSON = ANALYSIS_DIR / "latam_bilateral_base_experiment.json"
OUTPUT_CSV = ANALYSIS_DIR / "latam_bilateral_base_experiment.csv"
BASELINE_SCENARIO = "S1_TRIAD_BASE"

RANK = {
    "No viable económicamente": 0,
    "Viable solo con regionalización": 1,
    "Viable bilateralmente": 2,
}


def load_baseline_outputs(scenario_name):
    scenario_dir = resolve_scenario_dir(scenario_name)
    return {
        "gen": load_json(scenario_dir / "generators_summary.json"),
        "dem": load_json(scenario_dir / "demand_summary.json"),
        "flow": load_json(scenario_dir / "flows_results.json"),
        "mc": load_json(scenario_dir / "marginal_costs.json"),
    }


def compare_status(original, new):
    if RANK[new] > RANK[original]:
        return "mejora"
    if RANK[new] < RANK[original]:
        return "empeora"
    return "igual"


def main():
    parser = argparse.ArgumentParser(
        description="Run LATAM experiment with bilaterally viable lines active as the new base."
    )
    parser.add_argument("--reuse", action="store_true", help="Reuse scenario folders if outputs already exist.")
    parser.add_argument(
        "--only-original-no-viable",
        action="store_true",
        help="Run only lines that were originally classified as No viable económicamente.",
    )
    args = parser.parse_args()

    original = load_json(ORIGINAL_ANALYSIS)
    original_lines = original["lines"]
    base_rows = [row for row in original_lines if row["finalClassification"] == "Viable bilateralmente"]
    base_line_ids = sorted(row["lineId"] for row in base_rows)
    original_by_id = {row["lineId"]: row for row in original_lines}

    lines = load_json(resolve_scenario_dir("S1") / "lines_processed.json")
    candidates = [
        line for line in lines
        if line.get("Estado") == "Candidata" and line.get("propiedad") == "Internacional"
    ]
    candidates = [line for line in candidates if int(line["ID"]) not in base_line_ids]
    if args.only_original_no_viable:
        candidates = [
            line for line in candidates
            if original_by_id[int(line["ID"])]["finalClassification"] == "No viable económicamente"
        ]

    baseline_config = {
        **DEFAULT_CONFIG,
        "escenario_ejecucion": BASELINE_SCENARIO,
        "ordendemerito": True,
        "lineas_activas": base_line_ids,
    }
    print(f"Running bilateral-base scenario with active lines {base_line_ids} -> {BASELINE_SCENARIO}")
    run_model(baseline_config, reuse=args.reuse)
    baseline = load_baseline_outputs(BASELINE_SCENARIO)

    analyses = []
    for line in candidates:
        line_id = int(line["ID"])
        scenario_name = f"S1_TRIAD_PLUS_{line_id:02d}"
        active_lines = [*base_line_ids, line_id]
        config = {
            **DEFAULT_CONFIG,
            "escenario_ejecucion": scenario_name,
            "ordendemerito": True,
            "lineas_activas": active_lines,
        }
        print(f"Running triad-plus case for {line['Nombre']} with active lines {active_lines}")
        run_model(config, reuse=args.reuse)
        row = analyze_line(line, baseline, scenario_name)
        original_row = original_by_id[line_id]
        row["originalClassification"] = original_row["finalClassification"]
        row["statusChange"] = compare_status(original_row["finalClassification"], row["finalClassification"])
        row["baseActiveLines"] = base_line_ids
        row["activeLinesScenario"] = active_lines
        analyses.append(row)

    analyses.sort(key=lambda row: (RANK[row["finalClassification"]], row["statusChange"], -row["modeledCRUSDPerYear"]), reverse=True)
    summary = {
        "baselineScenario": BASELINE_SCENARIO,
        "baseActiveLines": base_line_ids,
        "baseActiveNames": [row["name"] for row in base_rows],
        "testedCount": len(analyses),
        "classifications": {
            "viable_bilateralmente": sum(1 for row in analyses if row["finalClassification"] == "Viable bilateralmente"),
            "viable_solo_con_regionalizacion": sum(1 for row in analyses if row["finalClassification"] == "Viable solo con regionalización"),
            "no_viable": sum(1 for row in analyses if row["finalClassification"] == "No viable económicamente"),
        },
        "statusChanges": {
            "mejora": sum(1 for row in analyses if row["statusChange"] == "mejora"),
            "igual": sum(1 for row in analyses if row["statusChange"] == "igual"),
            "empeora": sum(1 for row in analyses if row["statusChange"] == "empeora"),
        },
        "lines": analyses,
    }
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    save_json(OUTPUT_JSON, summary)

    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "line_id", "name", "original_classification", "new_classification", "status_change",
            "iar_musd_y", "cr_musd_y", "residual_musd_y", "use_pct"
        ])
        for row in analyses:
            writer.writerow([
                row["lineId"],
                row["name"],
                row["originalClassification"],
                row["finalClassification"],
                row["statusChange"],
                round(row["projectedIARUSDPerYear"] / 1_000_000.0, 3),
                round(row["modeledCRUSDPerYear"] / 1_000_000.0, 3),
                round(row["projectedResidualUSDPerYear"] / 1_000_000.0, 3),
                round(100.0 * row["useFraction"], 2),
            ])

    print(f"Wrote {OUTPUT_JSON}")
    print(f"Wrote {OUTPUT_CSV}")
    print(f"Logs in {RUN_LOGS_DIR}")


if __name__ == "__main__":
    main()
