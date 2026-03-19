import pandas as pd
import json
import math
import glob

import sys
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EXCEL_FILE = PROJECT_ROOT / "data" / "input" / "MODELO PLANTILLA DE DATOS V9_INTx.xlsx"

directorio_arg = sys.argv[1] if len(sys.argv) > 1 else "."
directorio_path = Path(directorio_arg)
if not directorio_path.is_absolute():
    directorio_path = (PROJECT_ROOT / directorio_path).resolve()
directorio = str(directorio_path)

xl = pd.ExcelFile(EXCEL_FILE)
out = {}

prod_dict = {}
rev_dict = {}

inv_dict = {}
inv_files = glob.glob(os.path.join(directorio, '*_inversiones_mw.csv'))
if inv_files:
    try:
        df_inv = pd.read_csv(inv_files[0])
        if 'Nodo' in df_inv.columns and 'Tecnología' in df_inv.columns and 'MW' in df_inv.columns:
            for idx, row in df_inv.iterrows():
                n = str(row['Nodo'])
                t = str(row['Tecnología'])
                v = float(row['MW'])
                inv_dict[(n, t)] = v
        elif 'Nodo' in df_inv.columns:
            for idx, row in df_inv.iterrows():
                n = str(row['Nodo'])
                for col in df_inv.columns:
                    if col != 'Nodo':
                        t = str(col)
                        try:
                            v = float(row[col])
                            inv_dict[(n, t)] = v
                        except:
                            pass
    except Exception as e:
        print(f"Warning: could not read inversiones file: {e}")
try:
    df_prod = pd.read_excel(os.path.join(directorio, 'Resultados_data_gen.xlsx'), header=[0, 1])
    df_prod_calc = df_prod.iloc[1:].reset_index(drop=True)
    sums = df_prod_calc.sum(numeric_only=True)
    for k, v in sums.items():
        if isinstance(k, tuple) and len(k) >= 2:
            prod_dict[(str(k[0]), str(k[1]))] = float(v) * 100
            
    try:
        df_mc = pd.read_excel(os.path.join(directorio, 'Costo_marginal_Resultados.xlsx'))
        for k in df_prod_calc.columns:
            if isinstance(k, tuple) and len(k) >= 2:
                n, t = k
                cn = f"Barra {n}"
                if cn in df_mc.columns:
                    gen_series = pd.to_numeric(df_prod_calc[k], errors='coerce').fillna(0)
                    mc_series = pd.to_numeric(df_mc[cn], errors='coerce').fillna(0)
                    rev = (gen_series * mc_series).sum() * 100
                    rev_dict[(str(n), str(t))] = float(rev)
    except Exception as e_mc:
        print(f"Warning: could not compute revenue matching marginal costs: {e_mc}")
            
except Exception as e:
    print(f"Warning: could not read Resultados_data_gen.xlsx for production/revenue: {e}")

cc = pd.read_excel(xl, sheet_name='Costos_Combustible (new)')

col_pais_cc = next((c for c in cc.columns if 'Pa' in c), 'País')
col_tech_cc = next((c for c in cc.columns if 'Tec' in c), 'Tecnología')
col_ano_cc = next((c for c in cc.columns if 'A' in c and 'o' in c), 'Año')

gen_sheets = ['GeneradoresC', 'GeneradoresS', 'GeneradoresE', 'GeneradoresH_E', 'GeneradoresH_P', 'GeneradoresGeo', 'GeneradoresN', 'GeneradoresB']

for s in gen_sheets:
    df = pd.read_excel(xl, sheet_name=s)
    col_tech = next((c for c in df.columns if 'Tec' in c), 'Tecnología')
    col_cap = next((c for c in df.columns if 'Capacidad' in c or 'MW' in c), 'Capacidad instalada (MW)')
    
    for idx, row in df.iterrows():
        pais = str(row.get('Pais', ''))
        if pais not in out: out[pais] = []
        
        tech = str(row.get(col_tech, ''))
        cap = row.get(col_cap, 0)
        try: cap = float(cap)
        except: cap = 0
        if math.isnan(cap): cap = 0
        
        cv = 0
        if s == 'GeneradoresC':
            nodo_val = str(row.get('Nombre_nodo', ''))
            match = cc[(cc[col_pais_cc] == nodo_val) & (cc[col_tech_cc] == tech) & (cc[col_ano_cc] == 2025)]
            if not match.empty:
                val = match.iloc[0].get('CV', 0)
                try: cv = float(val) if pd.notna(val) else 0
                except: cv = 0
        tech_map = {
            'Pasada': 'Hydro Pasada',
            'Embalse': 'Hydro Embalse',
            'Eolico': 'Eolica',
            'Geotermica': 'Geotérmica',
            'Bioenergia': 'Bioenergía'
        }
        prod_tech = tech_map.get(tech, tech)
        nodo_gen = str(row.get('Nombre_nodo', ''))
        prod = prod_dict.get((nodo_gen, prod_tech), 0.0)
        rev = rev_dict.get((nodo_gen, prod_tech), 0.0)
        total_var_cost = prod * cv
        profit = rev - total_var_cost
        
        inv_pot = inv_dict.get((nodo_gen, prod_tech), 0.0)
        if inv_pot == 0.0:
            inv_pot = inv_dict.get((nodo_gen, tech), 0.0)
                
        out[pais].append({
            'name': nodo_gen, 
            'tech': tech, 
            'capmax': cap, 
            'inv_pot_MW': inv_pot,
            'cv': cv,
            'prod': prod,
            'rev': rev,
            'total_var_cost': total_var_cost,
            'profit': profit
        })

with open(os.path.join(directorio, 'generators_summary.json'), 'w', encoding='utf-8') as f: 
    json.dump(out, f, indent=2, ensure_ascii=False)
print("Generators exported")

storage_out = {}
try:
    df_alm = pd.read_excel(xl, sheet_name='Almacenamiento')
    for idx, row in df_alm.iterrows():
        pais = str(row.get('pais', '')).strip()
        if not pais: continue
        if pais not in storage_out: storage_out[pais] = []
        cap = row.get('Capacidad instalada (MW)', 0)
        try: cap = float(cap)
        except: cap = 0
        if math.isnan(cap): cap = 0
        
        nodo_bess = str(row.get('nombre', ''))
        inv_pot_bess = inv_dict.get((nodo_bess, 'BESS'), 0.0)
        
        storage_out[pais].append({
            'name': nodo_bess,
            'tech': 'BESS',
            'capmax': cap,
            'inv_pot_MW': inv_pot_bess 
        })
    with open(os.path.join(directorio, 'storage_summary.json'), 'w', encoding='utf-8') as fs:
        json.dump(storage_out, fs, indent=2, ensure_ascii=False)
except Exception as e:
    print(f"Warning: could not process Almacenamiento sheet: {e}")
