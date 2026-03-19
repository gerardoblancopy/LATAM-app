import pandas as pd
import json

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EXCEL_FILE = PROJECT_ROOT / 'data' / 'input' / 'MODELO PLANTILLA DE DATOS V9_INTx.xlsx'

def extract_demand():
    directorio_arg = sys.argv[1] if len(sys.argv) > 1 else "."
    directorio_path = Path(directorio_arg)
    if not directorio_path.is_absolute():
        directorio_path = (PROJECT_ROOT / directorio_path).resolve()
    directorio = str(directorio_path)
    print(f"Extracting demand data for {directorio}...")
    xl_file = EXCEL_FILE
    
    # Read Nodes to map Node Name to Country
    try:
        df_nodos = pd.read_excel(xl_file, sheet_name='Nodos')
        # Ensure we have 'nombre' and 'pais'
        node_to_country = {}
        for _, row in df_nodos.iterrows():
            if pd.notna(row.get('nombre')) and pd.notna(row.get('pais')):
                node_to_country[str(row['nombre']).strip()] = str(row['pais']).strip()
    except Exception as e:
        print(f"Error reading Nodos: {e}")
        return

    # Read Demand
    try:
        df_demanda = pd.read_excel(xl_file, sheet_name='Demanda', header=2)
        
        # Calculate sums per node
        # The columns are initially 't', 'time', then node names
        # Some columns might not be nodes, so we filter by measuring node_to_country
        
        # Load marginal costs
        try:
            df_cm = pd.read_excel(os.path.join(directorio, 'Costo_marginal_Resultados.xlsx'))
        except Exception as e:
            print(f"Warning: Could not read Costo_marginal_Resultados.xlsx: {e}")
            df_cm = pd.DataFrame()

        out_demanda = {}
        for col in df_demanda.columns:
            if col in node_to_country:
                pais = node_to_country[col]
                # Calculate total demand by summing the numeric column
                try:
                    dem_series = pd.to_numeric(df_demanda[col], errors='coerce').fillna(0)
                    
                    # Sample every 100 points like the model, and multiply by 100 for the total volume
                    dem_sliced = dem_series.iloc[::100].values
                    total_demand = float(dem_sliced.sum() * 100)
                    
                    demand_cost = 0.0
                    cm_col = 'Barra ' + str(col)
                    if not df_cm.empty and cm_col in df_cm.columns:
                        cm_node = df_cm[cm_col].values
                        if len(dem_sliced) == len(cm_node):
                            demand_cost = float((dem_sliced * cm_node * 100).sum())
                        else:
                            print(f"Warning: Dimension mismatch for {col}. 'dem_sliced' length: {len(dem_sliced)} vs 'cm_node' length: {len(cm_node)}.")
                    
                    if pais not in out_demanda:
                        out_demanda[pais] = []
                    out_demanda[pais].append({
                        'node': col,
                        'demand': float(total_demand),
                        'demand_cost': demand_cost
                    })
                except Exception as ex:
                    print(f"Error summing demand for {col}: {ex}")
                    
        with open(os.path.join(directorio, 'demand_summary.json'), 'w', encoding='utf-8') as f:
            json.dump(out_demanda, f, indent=2, ensure_ascii=False)
        print("demand_summary.json created successfully.")
            
    except Exception as e:
        print(f"Error reading Demanda: {e}")

if __name__ == "__main__":
    extract_demand()
