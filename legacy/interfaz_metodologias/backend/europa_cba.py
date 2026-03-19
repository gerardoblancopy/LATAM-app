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

COUNTRIES = ["CHILE", "PERU", "ARGENTINA"]

# -----------------------------
# UTILIDADES CBA
# -----------------------------
def pvaf(r: float, n_years: int) -> float:
    return (1.0 - (1.0 + r) ** (-n_years)) / r

def ensure_country_series(d: dict, default=0.0):
    return pd.Series({c: float(d.get(c, default)) for c in COUNTRIES}, index=COUNTRIES)

def get_country_price_map(rep: dict) -> pd.Series:
    df = pd.DataFrame(rep["lmp"])
    return df.set_index("country")["lambda"].reindex(COUNTRIES).astype(float)

def get_country_demand_map(rep: dict) -> pd.Series:
    df = pd.DataFrame(rep["dem_country"])
    # The current backend model.py doesn't export 'D' in dem_country by default,
    # but it exports 'df_dem' with 'D'
    df_dem = pd.DataFrame(rep["df_dem"])
    d_agg = df_dem.groupby("country")["D"].sum()
    return d_agg.reindex(COUNTRIES).astype(float)

def get_country_profit_map(rep: dict) -> pd.Series:
    df = pd.DataFrame(rep["gen_country"])
    return df.set_index("country")["profit"].reindex(COUNTRIES).astype(float)

def allocate_cr_50_50_by_border(df_cr_con: pd.DataFrame) -> pd.Series:
    alloc = {c: 0.0 for c in COUNTRIES}
    if df_cr_con.empty:
        return pd.Series(alloc)

    for _, r in df_cr_con.iterrows():
        # model.py rep_con["df_cr"] has F, lam_from, lam_to
        # we need to infer physical flow and countries
        f = float(r["F"])
        # Assuming r["from"] is something like "CHL", maps to nodes
        if f == 0:
            continue
            
        # mapping nodes to countries is needed, we'll pass NODES to the function
        pass # implemented inside the main function to have access to NODES

    return pd.Series(alloc).reindex(COUNTRIES).astype(float)

# -----------------------------
# EX POST CBA/CBCA
# -----------------------------
def cba_expost_from_market(rep_sin: dict, rep_con: dict, params_cba: dict, nodes_map: dict, lines_map: dict):
    """
    Construye el análisis ex post siguiendo la lógica del PDF:
      Delta SEW = Delta CS + Delta PS + Delta CR + modulos no-mercado
    """
    annual_hours = float(params_cba.get("annual_hours", 8760.0))
    r = float(params_cba.get("discount_rate", 0.04))
    n_years = int(params_cba.get("horizon_years", 25))
    PVAF = pvaf(r, n_years)

    capex_year0 = float(params_cba.get("capex_year0_musd", 1400.0))
    opex_annual = float(params_cba.get("opex_annual_musd", 18.0))
    capex_final = float(params_cba.get("capex_final_musd", capex_year0))

    # Precio por país
    p0 = get_country_price_map(rep_sin)
    p1 = get_country_price_map(rep_con)

    # Demanda inelástica: uso D del caso SIN como base
    D0 = get_country_demand_map(rep_sin)

    # Beneficio demanda (Delta CS del PDF)
    delta_cs_usdph = -(p1 - p0) * D0

    # Beneficio generadores (exacto del modelo)
    ps0 = get_country_profit_map(rep_sin)
    ps1 = get_country_profit_map(rep_con)
    delta_ps_usdph = ps1 - ps0

    # Congestión del sistema y asignación 50/50
    df_cr_con = pd.DataFrame(rep_con["df_cr"])
    cr_system_usdph = 0.0
    alloc_cr = {c: 0.0 for c in COUNTRIES}
    
    if not df_cr_con.empty and df_cr_con.iloc[0]["line"] != "-":
        for _, r_cr in df_cr_con.iterrows():
            f = float(r_cr["F"])
            if abs(f) < 1e-9:
                continue
            
            lam_fr = float(r_cr["lam_from"])
            lam_to = float(r_cr["lam_to"])
            
            line_def = lines_map.get(r_cr["line"])
            if not line_def:
                continue
                
            if f >= 0:
                exp_node = line_def["fr"]
                imp_node = line_def["to"]
                lam_exp = lam_fr
                lam_imp = lam_to
                f_phys = f
            else:
                exp_node = line_def["to"]
                imp_node = line_def["fr"]
                lam_exp = lam_to
                lam_imp = lam_fr
                f_phys = abs(f)
                
            cr_phys = f_phys * (lam_imp - lam_exp)
            cr_system_usdph += cr_phys
            
            exp_c = nodes_map.get(exp_node)
            imp_c = nodes_map.get(imp_node)
            
            if exp_c in alloc_cr:
                alloc_cr[exp_c] += 0.5 * cr_phys
            if imp_c in alloc_cr:
                alloc_cr[imp_c] += 0.5 * cr_phys

    delta_cr_alloc_usdph = pd.Series(alloc_cr).reindex(COUNTRIES).astype(float)

    # SEW sin CR nacionalizada (solo país)
    delta_sew_nocr_usdph = delta_cs_usdph + delta_ps_usdph

    # Módulos no-mercado anuales
    co2_total = float(params_cba.get("co2_annual_musd_total", 0.0))
    sos_total = float(params_cba.get("sos_annual_musd_total", 0.0))
    co2_shares = ensure_country_series(params_cba.get("co2_shares", {"CHILE": 1/3, "PERU": 1/3, "ARGENTINA": 1/3}))
    sos_shares = ensure_country_series(params_cba.get("sos_shares", {"CHILE": 1/3, "PERU": 1/3, "ARGENTINA": 1/3}))

    co2_annual_musd = co2_total * co2_shares
    sos_annual_musd = sos_total * sos_shares

    # Pasar de USD/h a MUSD/año
    delta_cs_annual_musd = delta_cs_usdph * annual_hours / 1e6
    delta_ps_annual_musd = delta_ps_usdph * annual_hours / 1e6
    delta_sew_nocr_annual_musd = delta_sew_nocr_usdph * annual_hours / 1e6

    cr_system_annual_musd = cr_system_usdph * annual_hours / 1e6
    delta_cr_alloc_annual_musd = delta_cr_alloc_usdph * annual_hours / 1e6

    # Beneficios anuales por país
    benefits_A_annual = delta_sew_nocr_annual_musd + co2_annual_musd + sos_annual_musd
    benefits_B_annual = benefits_A_annual + delta_cr_alloc_annual_musd

    # PV de beneficios por país
    pv_benefits_A = benefits_A_annual * PVAF
    pv_benefits_B = benefits_B_annual * PVAF

    # PV de congestión del sistema
    pv_cr_system = cr_system_annual_musd * PVAF

    # PV costos del proyecto
    pv_opex = opex_annual * PVAF
    pv_cost_total_base = capex_year0 + pv_opex
    pv_cost_total_final = capex_final + pv_opex

    # NPV social total del proyecto (Enfoque B total sistema)
    pv_benefits_total_system = pv_benefits_A.sum() + pv_cr_system
    npv_social_total = pv_benefits_total_system - pv_cost_total_base

    # ---- CBCA Enfoque A ----
    sum_pvA = float(pv_benefits_A.sum())
    if abs(sum_pvA) > 1e-12:
        share_A = pv_benefits_A / sum_pvA
    else:
        share_A = pd.Series(0.0, index=COUNTRIES)

    cbca_cost_A = share_A * pv_cost_total_base
    cbca_npv_A = pv_benefits_A - cbca_cost_A

    # ---- CBCA Enfoque B ----
    sum_pvB = float(pv_benefits_B.sum())
    if abs(sum_pvB) > 1e-12:
        share_B = pv_benefits_B / sum_pvB
    else:
        share_B = pd.Series(0.0, index=COUNTRIES)

    cbca_cost_B = share_B * pv_cost_total_base
    cbca_npv_B = pv_benefits_B - cbca_cost_B

    # ---- Regla por tramos sobre CAPEX final ----
    overrun = max(capex_final - capex_year0, 0.0)
    overrun_share = pd.Series(1.0 / len(COUNTRIES), index=COUNTRIES)

    cbca_cost_tramo = (
        share_B * capex_year0 +
        overrun_share * overrun +
        share_B * pv_opex
    )
    cbca_npv_tramo = pv_benefits_B - cbca_cost_tramo

    # ---- Tablas resumidas ----
    df_annual = pd.DataFrame({
        "country": COUNTRIES,
        "Delta_CS_MUSDy": delta_cs_annual_musd.values,
        "Delta_PS_MUSDy": delta_ps_annual_musd.values,
        "Delta_SEW_noCR_MUSDy": delta_sew_nocr_annual_musd.values,
        "CO2_MUSDy": co2_annual_musd.reindex(COUNTRIES).values,
        "SoS_MUSDy": sos_annual_musd.reindex(COUNTRIES).values,
        "Benefits_A_noCR_MUSDy": benefits_A_annual.reindex(COUNTRIES).values,
        "CR_alloc_MUSDy": delta_cr_alloc_annual_musd.values,
        "Benefits_B_withCR_MUSDy": benefits_B_annual.reindex(COUNTRIES).values,
    }).fillna(0.0)

    df_pv = pd.DataFrame({
        "country": COUNTRIES,
        "PV_Benefits_A_noCR_MUSD": pv_benefits_A.reindex(COUNTRIES).values,
        "PV_Benefits_B_withCR_MUSD": pv_benefits_B.reindex(COUNTRIES).values,
        "CBCA_Share_A": share_A.reindex(COUNTRIES).values,
        "CBCA_Cost_A_MUSD": cbca_cost_A.reindex(COUNTRIES).values,
        "CBCA_NPV_A_MUSD": cbca_npv_A.reindex(COUNTRIES).values,
        "CBCA_Share_B": share_B.reindex(COUNTRIES).values,
        "CBCA_Cost_B_MUSD": cbca_cost_B.reindex(COUNTRIES).values,
        "CBCA_NPV_B_MUSD": cbca_npv_B.reindex(COUNTRIES).values,
        "CBCA_Cost_Tramo_MUSD": cbca_cost_tramo.reindex(COUNTRIES).values,
        "CBCA_NPV_Tramo_MUSD": cbca_npv_tramo.reindex(COUNTRIES).values,
    }).fillna(0.0)

    summary_models = pd.DataFrame(index=[
        "Modelo Demanda (ΔCS)",
        "Modelo Generador (ΔPS)",
        "Modelo Social s/CR (ΔCS+ΔPS+CO2+SoS)",
        "Modelo Social c/CR asignada",
    ], columns=COUNTRIES, data=0.0)

    summary_models.loc["Modelo Demanda (ΔCS)", :] = delta_cs_annual_musd.reindex(COUNTRIES).values if isinstance(delta_cs_annual_musd, pd.Series) else delta_cs_annual_musd
    summary_models.loc["Modelo Generador (ΔPS)", :] = delta_ps_annual_musd.reindex(COUNTRIES).values if isinstance(delta_ps_annual_musd, pd.Series) else delta_ps_annual_musd
    summary_models.loc["Modelo Social s/CR (ΔCS+ΔPS+CO2+SoS)", :] = benefits_A_annual.reindex(COUNTRIES).values if isinstance(benefits_A_annual, pd.Series) else benefits_A_annual
    summary_models.loc["Modelo Social c/CR asignada", :] = benefits_B_annual.reindex(COUNTRIES).values if isinstance(benefits_B_annual, pd.Series) else benefits_B_annual

    summary_models = summary_models.reset_index().rename(columns={"index": "modelo"})

    scalar_summary = {
        "annual_hours": annual_hours,
        "PVAF": PVAF,
        "CR_system_USDph": cr_system_usdph,
        "CR_system_MUSDy": cr_system_annual_musd,
        "PV_CR_system_MUSD": pv_cr_system,
        "PV_OPEX_MUSD": pv_opex,
        "PV_Cost_total_base_MUSD": pv_cost_total_base,
        "PV_Cost_total_final_MUSD": pv_cost_total_final,
        "PV_Benefits_total_system_MUSD": pv_benefits_total_system,
        "NPV_social_total_MUSD": npv_social_total,
        "CAPEX_base_MUSD": capex_year0,
        "CAPEX_final_MUSD": capex_final,
        "Overrun_MUSD": overrun,
    }

    return {
        "annual": df_annual.to_dict(orient="records"),
        "pv": df_pv.to_dict(orient="records"),
        "summary_models": summary_models.to_dict(orient="records"),
        "scalar_summary": scalar_summary,
    }
