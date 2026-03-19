import numpy as np
import sys
import types
import warnings

# Pyomo versions commonly bundled with academic environments still expect NumPy 1.x
# scalar aliases. Re-create them when running against NumPy 2.x so the model loads.
if not hasattr(np, "float_"):
    np.float_ = np.float64
if not hasattr(np, "complex_"):
    np.complex_ = np.complex128

# Older optional pandas accelerators in this environment were compiled against
# NumPy 1.x. Stub them so pandas falls back to pure-Python/numpy execution.
for _module_name in ("numexpr", "bottleneck"):
    if _module_name not in sys.modules:
        _stub = types.ModuleType(_module_name)
        _stub.__version__ = "0.0.0"
        sys.modules[_module_name] = _stub

warnings.filterwarnings("ignore", message="Pandas requires version .* of 'numexpr'.*")
warnings.filterwarnings("ignore", message="Pandas requires version .* of 'bottleneck'.*")

import pyomo.environ as pyo
from pyomo.environ import value
import pandas as pd

# -----------------------------
# MODELO (SIN theta): solo flujos + límites + balance nodal
# -----------------------------
def build_model_no_theta(params):
    m = pyo.ConcreteModel()

    # Extract params
    NODES = params["NODES"]
    GEN = params["GEN"]
    LINES = params["LINES"]
    D = params["D"]
    VoLL = params["VoLL"]
    with_interconnection = params["with_interconnection"]

    m.N = pyo.Set(initialize=list(NODES.keys()))
    m.G = pyo.Set(initialize=list(GEN.keys()))
    m.L = pyo.Set(initialize=list(LINES.keys()) if with_interconnection else [])

    # Params
    m.D = pyo.Param(m.N, initialize=lambda mm, n: float(D[n]))
    m.VoLL = pyo.Param(initialize=float(VoLL))

    m.node_of_g = pyo.Param(m.G, initialize=lambda mm, g: GEN[g]["node"], within=pyo.Any)
    m.pmax = pyo.Param(m.G, initialize=lambda mm, g: float(GEN[g]["pmax"]))
    m.c    = pyo.Param(m.G, initialize=lambda mm, g: float(GEN[g]["c"]))

    if with_interconnection:
        m.fr   = pyo.Param(m.L, initialize=lambda mm, l: LINES[l]["fr"], within=pyo.Any)
        m.to   = pyo.Param(m.L, initialize=lambda mm, l: LINES[l]["to"], within=pyo.Any)
        m.fmax = pyo.Param(m.L, initialize=lambda mm, l: float(LINES[l]["fmax"]))

    # Vars
    m.P  = pyo.Var(m.G, within=pyo.NonNegativeReals)
    m.LL = pyo.Var(m.N, within=pyo.NonNegativeReals)  # ENS
    if with_interconnection:
        m.F = pyo.Var(m.L, within=pyo.Reals)          # flujo libre con límites

    # Limits
    m.GenLimit = pyo.Constraint(m.G, rule=lambda mm, g: mm.P[g] <= mm.pmax[g])
    m.ENSLimit = pyo.Constraint(m.N, rule=lambda mm, n: mm.LL[n] <= mm.D[n])

    if with_interconnection:
        # límites de flujo
        m.FlowLim = pyo.Constraint(m.L, rule=lambda mm, l: (-mm.fmax[l], mm.F[l], mm.fmax[l]))

    # Balance nodal (KCL): gen + inflow - outflow + ENS = D
    def balance_rule(mm, n):
        gen = sum(mm.P[g] for g in mm.G if mm.node_of_g[g] == n)

        inflow = 0.0
        outflow = 0.0
        if with_interconnection:
            inflow  = sum(mm.F[l] for l in mm.L if mm.to[l] == n)
            outflow = sum(mm.F[l] for l in mm.L if mm.fr[l] == n)

        return gen + inflow - outflow + mm.LL[n] == mm.D[n]

    m.Balance = pyo.Constraint(m.N, rule=balance_rule)

    # Objective
    m.Obj = pyo.Objective(
        expr=sum(m.c[g] * m.P[g] for g in m.G) + m.VoLL * sum(m.LL[n] for n in m.N),
        sense=pyo.minimize
    )

    # Duals (LMP)
    m.dual = pyo.Suffix(direction=pyo.Suffix.IMPORT)
    return m

def solve_gurobi(m):
    errors = {}
    for solver_name in ("glpk", "appsi_highs", "cbc", "gurobi"):
        solver = pyo.SolverFactory(solver_name)
        if not solver.available(False):
            continue
        try:
            if solver_name == "gurobi":
                solver.options["Method"] = 1  # dual simplex (LP) -> duales estables
            return solver.solve(m, tee=False)
        except Exception as exc:
            errors[solver_name] = str(exc)

    if errors:
        detail = "; ".join(f"{name}: {message}" for name, message in errors.items())
        raise RuntimeError(f"No fue posible resolver el modelo con los solvers disponibles. {detail}")
    raise RuntimeError("No hay solvers LP disponibles. Instala GLPK, HiGHS, CBC o una licencia vigente de Gurobi.")

# -----------------------------
# REPORTE
# -----------------------------
def get_lmp(m, NODES):
    rows = []
    for n in m.N:
        lam = m.dual.get(m.Balance[n], 0.0)
        rows.append({"node": n, "country": NODES[n], "lambda": float(lam)})
    return pd.DataFrame(rows)

def report_case(m, case_name: str, params: dict):
    NODES = params["NODES"]
    GEN = params["GEN"]
    LINES = params["LINES"]
    with_interconnection = params["with_interconnection"]
    
    df_lmp = get_lmp(m, NODES)

    # Despacho por generador
    gen_rows = []
    for g in m.G:
        node = GEN[g]["node"]
        country = GEN[g]["country"]
        c = GEN[g]["c"]
        pmax = GEN[g]["pmax"]
        P = float(value(m.P[g]))
        lam = float(df_lmp.loc[df_lmp["node"] == node, "lambda"].values[0])
        gen_rows.append({
            "case": case_name, "g": g, "country": country, "node": node,
            "c": c, "pmax": pmax, "P": P, "lambda": lam,
            "revenue": lam * P,
            "var_cost": c * P,
            "profit": (lam - c) * P
        })
    df_gen = pd.DataFrame(gen_rows)

    # Demanda
    dem_rows = []
    for n in m.N:
        Dn = float(value(m.D[n]))
        LLn = float(value(m.LL[n]))
        served = Dn - LLn
        lam = float(df_lmp.loc[df_lmp["node"] == n, "lambda"].values[0])
        dem_rows.append({
            "case": case_name, "country": NODES[n], "node": n,
            "D": Dn, "LL": LLn, "served": served,
            "lambda": lam,
            "pay_dem": lam * served,
            "cost_ens": float(value(m.VoLL)) * LLn,
            "dem_total_cost": lam * served + float(value(m.VoLL)) * LLn
        })
    df_dem = pd.DataFrame(dem_rows)

    # Flujos y renta congestión
    if with_interconnection and hasattr(m, "F"):
        cr_rows = []
        for l in m.L:
            fr = LINES[l]["fr"]; to = LINES[l]["to"]
            F = float(value(m.F[l]))
            lam_fr = float(df_lmp.loc[df_lmp["node"] == fr, "lambda"].values[0])
            lam_to = float(df_lmp.loc[df_lmp["node"] == to, "lambda"].values[0])
            CR = F * (lam_to - lam_fr)  # puede ser +/-, usualmente se interpreta su valor como renta
            cr_rows.append({"case": case_name, "line": l, "from": fr, "to": to, "F": F,
                            "lam_from": lam_fr, "lam_to": lam_to, "CR": CR})
        df_cr = pd.DataFrame(cr_rows)
    else:
        df_cr = pd.DataFrame([{"case": case_name, "line": "-", "from": "-", "to": "-", "F": 0.0, "lam_from": 0.0, "lam_to": 0.0, "CR": 0.0}])

    # Agregados por país y nodo
    gen_country = df_gen.groupby("country", as_index=False)[["revenue", "var_cost", "profit"]].sum()
    gen_node = df_gen.groupby(["country", "node"], as_index=False)[["pmax", "P", "revenue", "var_cost", "profit"]].sum()
    dem_country = df_dem.groupby("country", as_index=False)[["pay_dem", "cost_ens", "dem_total_cost"]].sum()

    # Chequeo contable: pagos = ingresos + CR (si no hay otros cargos)
    pay_total = float(df_dem["pay_dem"].sum())
    rev_total = float(df_gen["revenue"].sum())
    cr_total = float(df_cr["CR"].sum())
    residual = pay_total - (rev_total + cr_total)

    return {
        "lmp": df_lmp.to_dict(orient="records"),
        "df_gen": df_gen.to_dict(orient="records"),
        "gen_node": gen_node.to_dict(orient="records"),
        "df_dem": df_dem.to_dict(orient="records"),
        "gen_country": gen_country.to_dict(orient="records"),
        "dem_country": dem_country.to_dict(orient="records"),
        "df_cr": df_cr.to_dict(orient="records"),
        "totals": {"pay_total": pay_total, "rev_total": rev_total, "cr_total": cr_total, "residual": residual}
    }

def report_delta(rep_con, rep_sin):
    COUNTRIES = ["CHILE", "PERU", "ARGENTINA"]
    
    # Δprofit GEN = CON - SIN
    gcon = pd.DataFrame(rep_con["gen_country"]).rename(columns={"revenue": "rev_CON", "var_cost": "cost_CON", "profit": "profit_CON"})
    gsin = pd.DataFrame(rep_sin["gen_country"]).rename(columns={"revenue": "rev_SIN", "var_cost": "cost_SIN", "profit": "profit_SIN"})
    g = gcon.merge(gsin, on="country", how="outer").fillna(0.0)
    g["delta_profit_GEN (CON-SIN)"] = g["profit_CON"] - g["profit_SIN"]

    # Ahorro demanda = SIN - CON
    dcon = pd.DataFrame(rep_con["dem_country"]).rename(columns={"pay_dem": "pay_CON", "cost_ens": "ens_CON", "dem_total_cost": "dem_CON"})
    dsin = pd.DataFrame(rep_sin["dem_country"]).rename(columns={"pay_dem": "pay_SIN", "cost_ens": "ens_SIN", "dem_total_cost": "dem_SIN"})
    d = dcon.merge(dsin, on="country", how="outer").fillna(0.0)
    d["ahorro_DEM (SIN-CON)"] = d["dem_SIN"] - d["dem_CON"]

    out = pd.DataFrame({"country": COUNTRIES}) \
        .merge(g[["country", "delta_profit_GEN (CON-SIN)"]], on="country", how="left") \
        .merge(d[["country", "ahorro_DEM (SIN-CON)"]], on="country", how="left") \
        .fillna(0.0)
    out["neto_solo_agentes"] = out["delta_profit_GEN (CON-SIN)"] + out["ahorro_DEM (SIN-CON)"]

    cr_con = rep_con["totals"]["cr_total"]
    cr_sin = rep_sin["totals"]["cr_total"]
    d_cr = cr_con - cr_sin

    # Sorting for winners/losers
    out_sorted = out.sort_values("neto_solo_agentes", ascending=False)
    
    winner = out_sorted.iloc[0].to_dict()
    loser = out_sorted.iloc[-1].to_dict()

    return {
        "delta_table": out.to_dict(orient="records"),
        "d_cr": d_cr,
        "winner_net": winner,
        "loser_net": loser
    }
