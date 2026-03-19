import sys
import types
import warnings

for _module_name in ("numexpr", "bottleneck"):
    if _module_name not in sys.modules:
        _stub = types.ModuleType(_module_name)
        _stub.__version__ = "0.0.0"
        sys.modules[_module_name] = _stub

warnings.filterwarnings("ignore", message="Pandas requires version .* of 'numexpr'.*")
warnings.filterwarnings("ignore", message="Pandas requires version .* of 'bottleneck'.*")

import pandas as pd


def _country_list(nodes_map: dict) -> list[str]:
    countries = []
    for country in nodes_map.values():
        if country not in countries:
            countries.append(country)
    return countries


def _as_series(data: dict, countries: list[str], default: float = 0.0) -> pd.Series:
    return pd.Series({country: float(data.get(country, default)) for country in countries}, index=countries)


def _positive_share(series: pd.Series) -> pd.Series:
    positive = series.clip(lower=0.0)
    total = float(positive.sum())
    if total <= 0.0:
        return pd.Series(1.0 / len(series), index=series.index)
    return positive / total


def _crf(rate: float, n_years: int) -> float:
    if n_years <= 0:
        return 0.0
    if abs(rate) < 1e-12:
        return 1.0 / n_years
    pow_term = (1.0 + rate) ** n_years
    return rate * pow_term / (pow_term - 1.0)


def _pvaf(rate: float, n_years: int) -> float:
    if n_years <= 0:
        return 0.0
    if abs(rate) < 1e-12:
        return float(n_years)
    return (1.0 - (1.0 + rate) ** (-n_years)) / rate


def _country_energy_bases(rep_con: dict, countries: list[str], annual_hours: float) -> tuple[pd.Series, pd.Series]:
    df_dem = pd.DataFrame(rep_con.get("df_dem", []))
    df_gen = pd.DataFrame(rep_con.get("df_gen", []))

    if df_dem.empty:
        served_annual = pd.Series(0.0, index=countries)
    else:
        served_annual = df_dem.groupby("country")["served"].sum().reindex(countries).fillna(0.0) * annual_hours

    if df_gen.empty:
        gen_annual = pd.Series(0.0, index=countries)
    else:
        gen_annual = df_gen.groupby("country")["P"].sum().reindex(countries).fillna(0.0) * annual_hours

    return served_annual.astype(float), gen_annual.astype(float)


def _host_share(lines_map: dict, nodes_map: dict, countries: list[str]) -> pd.Series:
    host = {country: 0.0 for country in countries}
    for line in lines_map.values():
        fmax = float(line.get("fmax", 0.0))
        fr_country = nodes_map.get(line.get("fr"))
        to_country = nodes_map.get(line.get("to"))
        if fr_country in host:
            host[fr_country] += 0.5 * fmax
        if to_country in host:
            host[to_country] += 0.5 * fmax
    return _positive_share(pd.Series(host).reindex(countries).fillna(0.0))


def _stability_transfers(pv_benefits: pd.Series, pv_costs: pd.Series) -> tuple[pd.Series, pd.Series]:
    npv_pre = pv_benefits - pv_costs
    deficits = (-npv_pre).clip(lower=0.0)
    surpluses = npv_pre.clip(lower=0.0)

    transfer_pool = min(float(deficits.sum()), float(surpluses.sum()))
    transfers = pd.Series(0.0, index=pv_benefits.index)

    if transfer_pool <= 0.0:
        return transfers, npv_pre

    donor_weights = _positive_share(surpluses)
    receiver_weights = _positive_share(deficits)

    donor_contrib = donor_weights * transfer_pool
    receiver_comp = receiver_weights * transfer_pool

    transfers = receiver_comp - donor_contrib
    npv_post = pv_benefits - (pv_costs - transfers)
    return transfers, npv_post


def evaluate_latam_hybrid(rep_sin: dict, rep_con: dict, cba_europa: dict, params: dict, nodes_map: dict, lines_map: dict):
    countries = _country_list(nodes_map)

    annual_hours = float(params.get("annual_hours", 8760.0))
    discount_rate = float(params.get("discount_rate", 0.08))
    horizon_years = int(params.get("horizon_years", 25))
    capex_musd = float(
        params.get(
            "capex_musd",
            cba_europa.get("scalar_summary", {}).get("CAPEX_final_MUSD")
            or cba_europa.get("scalar_summary", {}).get("CAPEX_base_MUSD")
            or 1400.0,
        )
    )
    opex_annual_musd = float(params.get("opex_annual_musd", 18.0))
    congestion_credit_pct = float(params.get("congestion_credit_pct", 0.50))
    usage_recovery_pct = float(params.get("usage_recovery_pct", 0.35))
    alpha_demand = float(params.get("alpha_demand", 0.70))
    alpha_generation = float(params.get("alpha_generation", 0.30))
    benefit_weight = float(params.get("benefit_weight", 0.85))
    host_weight = float(params.get("host_weight", 0.15))

    if abs(alpha_demand + alpha_generation) <= 1e-12:
        alpha_demand = 0.70
        alpha_generation = 0.30
    else:
        alpha_total = alpha_demand + alpha_generation
        alpha_demand /= alpha_total
        alpha_generation /= alpha_total

    if abs(benefit_weight + host_weight) <= 1e-12:
        benefit_weight = 0.85
        host_weight = 0.15
    else:
        weight_total = benefit_weight + host_weight
        benefit_weight /= weight_total
        host_weight /= weight_total

    cba_pv = pd.DataFrame(cba_europa.get("pv", []))
    if cba_pv.empty:
        pv_benefits = pd.Series(0.0, index=countries)
    else:
        pv_benefits = (
            cba_pv.set_index("country")["PV_Benefits_B_withCR_MUSD"]
            .reindex(countries)
            .fillna(0.0)
            .astype(float)
        )

    benefit_share = _positive_share(pv_benefits)
    host_share = _host_share(lines_map, nodes_map, countries)
    hybrid_share = _positive_share((benefit_weight * benefit_share) + (host_weight * host_share))

    crf = _crf(discount_rate, horizon_years)
    pvaf = _pvaf(discount_rate, horizon_years)
    gross_arr = capex_musd * crf + opex_annual_musd

    congestion_rent = float(cba_europa.get("scalar_summary", {}).get("CR_system_MUSDy", 0.0))
    congestion_credit = min(max(congestion_rent, 0.0) * congestion_credit_pct, gross_arr)
    net_arr = max(gross_arr - congestion_credit, 0.0)

    usage_block = net_arr * usage_recovery_pct
    beneficiary_block = net_arr - usage_block

    served_annual, gen_annual = _country_energy_bases(rep_con, countries, annual_hours)
    total_served = float(served_annual.sum())
    total_gen = float(gen_annual.sum())

    demand_block = usage_block * alpha_demand
    generation_block = usage_block * alpha_generation
    demand_tariff = demand_block / total_served if total_served > 0.0 else 0.0
    generation_tariff = generation_block / total_gen if total_gen > 0.0 else 0.0

    usage_payment = (served_annual * demand_tariff) + (gen_annual * generation_tariff)
    beneficiary_payment = beneficiary_block * hybrid_share

    pv_usage_cost = usage_payment * pvaf
    pv_beneficiary_cost = beneficiary_payment * pvaf
    pv_total_cost_pre = pv_usage_cost + pv_beneficiary_cost

    stability_transfer_pv, npv_post = _stability_transfers(pv_benefits, pv_total_cost_pre)
    stability_transfer_annual = stability_transfer_pv / pvaf if pvaf > 0.0 else stability_transfer_pv * 0.0

    final_annual_payment = usage_payment + beneficiary_payment - stability_transfer_annual
    final_pv_cost = pv_total_cost_pre - stability_transfer_pv

    df = pd.DataFrame(
        {
            "country": countries,
            "PV_Benefits_MUSD": pv_benefits.reindex(countries).values,
            "Benefit_Share": benefit_share.reindex(countries).values,
            "Host_Share": host_share.reindex(countries).values,
            "Hybrid_Share": hybrid_share.reindex(countries).values,
            "Served_MWhy": served_annual.reindex(countries).values,
            "Generation_MWhy": gen_annual.reindex(countries).values,
            "Usage_Charge_MUSDy": usage_payment.reindex(countries).values,
            "Beneficiary_Charge_MUSDy": beneficiary_payment.reindex(countries).values,
            "Stability_Transfer_MUSDy": stability_transfer_annual.reindex(countries).values,
            "Final_Charge_MUSDy": final_annual_payment.reindex(countries).values,
            "PV_Final_Cost_MUSD": final_pv_cost.reindex(countries).values,
            "PV_Net_Benefit_MUSD": npv_post.reindex(countries).values,
        }
    ).fillna(0.0)

    df["Host_Neutral"] = df["PV_Net_Benefit_MUSD"] >= -1e-9

    scalar_summary = {
        "annual_hours": annual_hours,
        "discount_rate": discount_rate,
        "horizon_years": horizon_years,
        "CRF": crf,
        "PVAF": pvaf,
        "CAPEX_MUSD": capex_musd,
        "OPEX_Annual_MUSD": opex_annual_musd,
        "Gross_ARR_MUSDy": gross_arr,
        "Congestion_Rent_MUSDy": congestion_rent,
        "Congestion_Credit_MUSDy": congestion_credit,
        "Net_ARR_MUSDy": net_arr,
        "Usage_Block_MUSDy": usage_block,
        "Beneficiary_Block_MUSDy": beneficiary_block,
        "Demand_Block_MUSDy": demand_block,
        "Generation_Block_MUSDy": generation_block,
        "Demand_Tariff_USD_per_MWh": demand_tariff * 1e6,
        "Generation_Tariff_USD_per_MWh": generation_tariff * 1e6,
        "Countries_Protected": int(df["Host_Neutral"].sum()),
        "Countries_Total": len(countries),
    }

    design_rules = [
        {
            "step": "1. Ingreso regulado tipo SIEPAC",
            "rule": "El activo recupera una anualidad regulada (CAPEX + OPEX), evitando dependencia exclusiva de rentas de congestión.",
        },
        {
            "step": "2. Crédito de congestión",
            "rule": "Una parte de la renta de congestión reduce el ingreso requerido, conteniendo cargos al usuario final.",
        },
        {
            "step": "3. Bloque por uso",
            "rule": "Una fracción del ingreso neto se recupera con cargos ex post a retiros e inyecciones, siguiendo la lógica operativa del MER/SIEPAC.",
        },
        {
            "step": "4. Bloque por beneficios",
            "rule": "El remanente se asigna ex ante con una mezcla de CBA/CBCA y exposición física del activo para reflejar beneficios y obligaciones territoriales.",
        },
        {
            "step": "5. Salvaguarda de neutralidad",
            "rule": "Si un país queda con NPV negativo, se activa una transferencia estabilizadora pagada por los beneficiarios netos.",
        },
    ]

    return {
        "country_breakdown": df.to_dict(orient="records"),
        "scalar_summary": scalar_summary,
        "design_rules": design_rules,
    }
