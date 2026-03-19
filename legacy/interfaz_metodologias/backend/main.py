from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import model
import europa_cba
import latam_hybrid
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class Generator(BaseModel):
    node: str
    country: str
    c: float
    pmax: float

class Line(BaseModel):
    fr: str
    to: str
    fmax: float

class SimulationParams(BaseModel):
    NODES: Dict[str, str]
    GEN: Dict[str, Generator]
    LINES: Dict[str, Line]
    D: Dict[str, float]
    VoLL: float
    europa_cba_params: Optional[Dict] = None
    latam_hybrid_params: Optional[Dict] = None

# Default Data
DEFAULT_NODES = {"CHL": "CHILE", "PER": "PERU", "ARG": "ARGENTINA"}
DEFAULT_D = {"CHL": 4300.0, "PER": 1700.0, "ARG": 4000.0}
DEFAULT_VoLL = 2000.0
DEFAULT_EUROPA_CBA_PARAMS = {
    "annual_hours": 8760.0,
    "discount_rate": 0.04,
    "horizon_years": 25,
    "capex_year0_musd": 1400.0,
    "capex_final_musd": 1400.0,
    "opex_annual_musd": 18.0,
    "co2_annual_musd_total": 0.0,
    "sos_annual_musd_total": 0.0,
}
DEFAULT_LATAM_HYBRID_PARAMS = {
    "annual_hours": 8760.0,
    "discount_rate": 0.08,
    "horizon_years": 25,
    "capex_musd": 1400.0,
    "opex_annual_musd": 18.0,
    "congestion_credit_pct": 0.25,
    "usage_recovery_pct": 0.35,
    "alpha_demand": 0.70,
    "alpha_generation": 0.30,
    "benefit_weight": 0.85,
    "host_weight": 0.15,
}

DEFAULT_GEN = {
    "CHL_SOLAR":  {"node": "CHL", "country": "CHILE",     "c":  5.0, "pmax": 1800.0},
    "CHL_GAS":    {"node": "CHL", "country": "CHILE",     "c": 65.0, "pmax": 1500.0},
    "CHL_PEAKER": {"node": "CHL", "country": "CHILE",     "c": 80.0, "pmax": 1500.0},
    "PER_H1":     {"node": "PER", "country": "PERU",      "c": 12.0, "pmax": 2000.0},
    "PER_H2":     {"node": "PER", "country": "PERU",      "c": 35.0, "pmax": 1200.0},
    "ARG_WIND":   {"node": "ARG", "country": "ARGENTINA", "c":  8.0, "pmax": 1400.0},
    "ARG_GAS":    {"node": "ARG", "country": "ARGENTINA", "c": 50.0, "pmax": 2600.0},
    "ARG_PEAKER": {"node": "ARG", "country": "ARGENTINA", "c": 62.0, "pmax": 1000.0},
}

DEFAULT_LINES = {
    "L_CHL_PER": {"fr": "CHL", "to": "PER", "fmax": 1200.0},
    "L_CHL_ARG": {"fr": "CHL", "to": "ARG", "fmax":  500.0},
}

@app.get("/params")
def get_params():
    return {
        "NODES": DEFAULT_NODES,
        "GEN": DEFAULT_GEN,
        "LINES": DEFAULT_LINES,
        "D": DEFAULT_D,
        "VoLL": DEFAULT_VoLL,
        "europa_cba_params": DEFAULT_EUROPA_CBA_PARAMS,
        "latam_hybrid_params": DEFAULT_LATAM_HYBRID_PARAMS,
    }

@app.post("/simulate")
def run_simulation(params: SimulationParams):
    try:
        data = params.model_dump()
        
        # Run SIN case
        data["with_interconnection"] = False
        m_sin = model.build_model_no_theta(data)
        model.solve_gurobi(m_sin)
        rep_sin = model.report_case(m_sin, "SIN", data)

        # Run CON case
        data["with_interconnection"] = True
        m_con = model.build_model_no_theta(data)
        model.solve_gurobi(m_con)
        rep_con = model.report_case(m_con, "CON", data)

        # Delta analysis
        delta = model.report_delta(rep_con, rep_sin)

        # Europa CBA analysis
        europa_params = data.get("europa_cba_params") or {}
        # We need to map nodes and lines for the CBA script
        cba_europa = europa_cba.cba_expost_from_market(
            rep_sin, 
            rep_con, 
            europa_params, 
            data["NODES"], 
            data["LINES"]
        )

        latam_params = data.get("latam_hybrid_params") or {}
        latam_result = latam_hybrid.evaluate_latam_hybrid(
            rep_sin,
            rep_con,
            cba_europa,
            latam_params,
            data["NODES"],
            data["LINES"],
        )

        return {
            "sin": rep_sin,
            "con": rep_con,
            "delta": delta,
            "cba_europa": cba_europa,
            "latam_hybrid": latam_result,
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888)
