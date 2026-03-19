import pandas as pd
import numpy as np
import json
import pyomo.environ as pyo
from datetime import datetime
import sys
import os
import matplotlib.pyplot as plt

# ==================== CONFIGURATION & ARGUMENT PARSING ====================
# Default values
year_obj = 2025
costo_combustible = 'Cst_med'
hidrologia = 'H_media'
inversiones_intx = 'Con_intx'
sincarbonCL = False
inversiones_gx = 'Sin_gx'
demanda_tipo = 'Dem_base'
bloquear_invtx_nacional = True
bloquear_invtx_existenteinternacional = True
flux0_internacional_candidata = False
ordendemerito = False
escenario_ejecucion = 'S0'

# Parse arguments
if len(sys.argv) > 1:
    try:
        config_str = sys.argv[1]
        print(f"Received config: {config_str}")
        config = json.loads(config_str)
        
        if 'year_obj' in config: year_obj = int(config['year_obj'])
        if 'costo_combustible' in config: costo_combustible = config['costo_combustible']
        if 'hidrologia' in config: hidrologia = config['hidrologia']
        if 'inversiones_intx' in config: inversiones_intx = config['inversiones_intx']
        if 'inversiones_gx' in config: inversiones_gx = config['inversiones_gx']
        if 'demanda_tipo' in config: demanda_tipo = config['demanda_tipo']
        
        # Boolean handling
        # Values come from JSON so they are proper booleans or need conversion if sent as strings (handled by frontend as bool)
        sincarbonCL = bool(config.get('sincarbonCL', False))
        bloquear_invtx_nacional = bool(config.get('bloquear_invtx_nacional', True))
        bloquear_invtx_existenteinternacional = bool(config.get('bloquear_invtx_existenteinternacional', True))
        flux0_internacional_candidata = bool(config.get('flux0_internacional_candidata', False))
        ordendemerito = bool(config.get('ordendemerito', False))
        linea_obj_id = config.get('linea_obj', None)
        if linea_obj_id is not None:
            try:
                linea_obj_id = int(linea_obj_id)
            except ValueError:
                pass
        if 'escenario_ejecucion' in config: escenario_ejecucion = config['escenario_ejecucion']

    except Exception as e:
        print(f"Error parsing config: {e}")

# Apply Logic provided by user
factor_dem = 1.0
if demanda_tipo == 'Dem_base': 
    factor_dem = 1.0
elif demanda_tipo == 'Dem_elec': 
    factor_dem = 1.48

inversiones_transmision = 'a' 
if inversiones_intx == 'Sin_intx':
    inversiones_transmision = 'a'
elif inversiones_intx == 'Con_intx':
    inversiones_transmision = 'b'

label_bloquear_invtx_nacional= 'Con_tx'
if bloquear_invtx_nacional== True:
    label_bloquear_invtx_nacional= 'Sin_tx'
else:
    label_bloquear_invtx_nacional= 'Con_tx'

label_bloquear_invtx_existenteinternacional= 'Con_intxExi'
if bloquear_invtx_existenteinternacional== True:
    label_bloquear_invtx_existenteinternacional= 'Sin_intxExi'
else:
    label_bloquear_invtx_existenteinternacional= 'Con_intxExi'    

label_flux0_internacional_candidata = ''
if flux0_internacional_candidata== True:
    label_flux0_internacional_candidata= '0'
else:
    label_flux0_internacional_candidata = ''

hidrologia_sheet= 'Energia_PerfilH'
if hidrologia== 'H_media':
    hidrologia_sheet= 'Energia_PerfilH'
elif hidrologia== 'H_niño':
    hidrologia_sheet= 'Energia_PerfilH_niño'
elif hidrologia== 'H_niña':
    hidrologia_sheet= 'Energia_PerfilH_niña'

# ==================== SCENARIO LOGIC ====================
max_lineasBINARIAS_tx = 0
if escenario_ejecucion == 'S1':
    max_lineasBINARIAS_tx = 1
elif escenario_ejecucion == 'S0':
    max_lineasBINARIAS_tx = 0

directorio = os.path.join("data", "scenarios", escenario_ejecucion)
if not os.path.exists(directorio):
    os.makedirs(directorio)

caso = "Resultados"
# =========================================================



file_name = os.path.join('data', 'input', 'MODELO PLANTILLA DE DATOS V9_INTx.xlsx')
try:
    xls = pd.ExcelFile(file_name)
except FileNotFoundError:
    print(f"Error: File '{file_name}' not found.")
    exit(1)

#====================================================================================

# Red
Lineas       = xls.parse(sheet_name='Lineas', header=0)
df_Nodos     = xls.parse(sheet_name='Nodos', header=0)
df_max_flow  = xls.parse(sheet_name='PlanObrasTx', header=0)
df_max_flow['time'] = pd.to_datetime(df_max_flow['time'])

# Generadores térmicos
GeneradoresC        = xls.parse(sheet_name='GeneradoresC', header=0)
#Energia_PerfilC     = xls.parse(sheet_name='Energia_PerfilC', header=4)
df_CostosInversion  = xls.parse(sheet_name='Costos_Inversion (new)', header=0)
df_CostosCombustible= xls.parse(sheet_name='Costos_Combustible (new)', header=0)
df_max_cap          = xls.parse(sheet_name='PlanObrasGx', header=0)
df_max_cap['time']  = pd.to_datetime(df_max_cap['time'])

# Generadores renovables
GeneradoresS    = xls.parse(sheet_name='GeneradoresS', header=0)
GeneradoresE    = xls.parse(sheet_name='GeneradoresE', header=0)
GeneradoresN    = xls.parse(sheet_name='GeneradoresN', header=0)
GeneradoresB    = xls.parse(sheet_name='GeneradoresB', header=0)
GeneradoresGeo    = xls.parse(sheet_name='GeneradoresGeo', header=0)
AlmacenamientoBESS = xls.parse(sheet_name='Almacenamiento', header=0)
#Energia_PerfilR = xls.parse(sheet_name='Energia_PerfilR', header=1)
PerfilS         = xls.parse(sheet_name='Perfiles Renovables', header=0)
PerfilE         = xls.parse(sheet_name='Perfiles Renovables', header=0)

# Generadores hidráulicos
GeneradoresH_P = xls.parse(sheet_name='GeneradoresH_P', header=0)
GeneradoresH_E = xls.parse(sheet_name='GeneradoresH_E', header=0)
Energia_PerfilH= xls.parse(sheet_name=hidrologia_sheet, header=0)

# Demanda y proyección
Demanda    = xls.parse(sheet_name='Demanda', header=2)
proyeccion = xls.parse(sheet_name='Proyeccion', header=0)

df_utilizacion = xls.parse(sheet_name='Res datos Enzo', header=0)

xls.close()


#@title Grafica Demanda 48 horas
df_demaux = Demanda
for contador, nodo in enumerate([ 'CL_NORTE', 'CL_CENTRO', 'CL_SUR', 'PE_NORTE', 'PE_SUR',
       'BR_NORTE', 'BR_NORESTE', 'BR_FC', 'BR_SUDESTE/CO', 'BR_SUR',
       'CO_NORTE', 'CO_SUR', 'BO_ESTE', 'BO_NOROESTE', 'BO_SUR', 'PY_NORTE',
       'PY_SUR', 'PY_CENTRO/OESTE', 'PY_ESTE', 'NOA_CEN_LIT', 'COM_CUY',
       'MERCADO', 'URUGUAY', 'EC_NORTE', 'EC_SUR', 'GU_NORTE', 'GU_SUR',
       'GU_ESTE', 'GU_OESTE', 'ES_OCCIDENTAL', 'ES_ORIENTAL', 'HN_NORTE',
       'HN_SUR', 'NI_NORTE', 'NI_SUR', 'CR_NORTE', 'CR_SUR', 'PA_NORTE',
       'PA_SUR', 'VZ_NORTE', 'VZ_SUR', 'MX_SUR', 'BELICE']):

  # Cambiar el nombre de las columnas
  try:
      nuevos_nombres = {'Nodo'+str(contador+1): nodo}
      df_demaux=  df_demaux.rename(columns=nuevos_nombres)
  except: pass
  
#==========================
df_dia = df_demaux[['CL_NORTE', 'CL_CENTRO', 'CL_SUR', 'PE_NORTE', 'PE_SUR',
       'BR_NORTE', 'BR_NORESTE', 'BR_FC', 'BR_SUDESTE/CO', 'BR_SUR',
       'CO_NORTE', 'CO_SUR', 'BO_ESTE', 'BO_NOROESTE', 'BO_SUR', 'PY_NORTE',
       'PY_SUR', 'PY_CENTRO/OESTE', 'PY_ESTE', 'NOA_CEN_LIT', 'COM_CUY',
       'MERCADO', 'URUGUAY', 'EC_NORTE', 'EC_SUR', 'GU_NORTE', 'GU_SUR',
       'GU_ESTE', 'GU_OESTE', 'ES_OCCIDENTAL', 'ES_ORIENTAL', 'HN_NORTE',
       'HN_SUR', 'NI_NORTE', 'NI_SUR', 'CR_NORTE', 'CR_SUR', 'PA_NORTE',
       'PA_SUR', 'VZ_NORTE', 'VZ_SUR', 'MX_SUR', 'BELICE']] 

df_dia = df_dia.head(48)

df = df_dia 

# Ordenar las columnas según las sumas totales en orden descendente
column_sums = df.sum().sort_values(ascending=False)
ordered_columns = column_sums.index

# Reordenar el DataFrame
df = df[ordered_columns]



proyeccion= proyeccion[['Indice','nombre','pais','crecimiento_anual']]


#@title year_objetivo
year_base =2025 # no modificar
year_objetivo = year_obj 

def proyectar(year_base=2025,year_objetivo=2025, df_dem_proyectada =df_demaux.copy()):
    # Recorrer todas las columnas excepto la especificada
    Set= ['t', 'time', 'CL_NORTE', 'CL_CENTRO', 'CL_SUR', 'PE_NORTE', 'PE_SUR',
        'BR_NORTE', 'BR_NORESTE', 'BR_FC', 'BR_SUDESTE/CO', 'BR_SUR',
        'CO_NORTE', 'CO_SUR', 'BO_ESTE', 'BO_NOROESTE', 'BO_SUR', 'PY_NORTE',
        'PY_SUR', 'PY_CENTRO/OESTE', 'PY_ESTE', 'NOA_CEN_LIT', 'COM_CUY',
        'MERCADO', 'URUGUAY', 'EC_NORTE', 'EC_SUR', 'GU_NORTE', 'GU_SUR',
        'GU_ESTE', 'GU_OESTE', 'ES_OCCIDENTAL', 'ES_ORIENTAL', 'HN_NORTE',
        'HN_SUR', 'NI_NORTE', 'NI_SUR', 'CR_NORTE', 'CR_SUR', 'PA_NORTE',
        'PA_SUR', 'VZ_NORTE', 'VZ_SUR', 'MX_SUR', 'BELICE']
    for columna in Set: #df_dem_proyectada.columns:#df_demaux.columns:
        if columna not in ['t', 'time']:
       
            valor_columna_B = proyeccion.loc[proyeccion['nombre'] == columna, 'crecimiento_anual'].values[0]
            columna_valores = df_demaux[columna]
            df_dem_proyectada[columna] =   columna_valores * valor_columna_B**(year_objetivo - year_base )
    return df_dem_proyectada

df_dem_proyectada = proyectar(2025,year_objetivo)

print('Demanda  Ember proyectada al año: ' + str(year_objetivo))
total_periodo=[]
for contador, nodo in enumerate(['CL_NORTE', 'CL_CENTRO', 'CL_SUR', 'PE_NORTE', 'PE_SUR',
       'BR_NORTE', 'BR_NORESTE', 'BR_FC', 'BR_SUDESTE/CO', 'BR_SUR',
       'CO_NORTE', 'CO_SUR', 'BO_ESTE', 'BO_NOROESTE', 'BO_SUR', 'PY_NORTE',
       'PY_SUR', 'PY_CENTRO/OESTE', 'PY_ESTE', 'NOA_CEN_LIT', 'COM_CUY',
       'MERCADO', 'URUGUAY', 'EC_NORTE', 'EC_SUR', 'GU_NORTE', 'GU_SUR',
       'GU_ESTE', 'GU_OESTE', 'ES_OCCIDENTAL', 'ES_ORIENTAL', 'HN_NORTE',
       'HN_SUR', 'NI_NORTE', 'NI_SUR', 'CR_NORTE', 'CR_SUR', 'PA_NORTE',
       'PA_SUR', 'VZ_NORTE', 'VZ_SUR', 'MX_SUR', 'BELICE']):
  print(nodo + '--> ' + str( round (df_dem_proyectada[nodo].sum()/10**6,2)) + '\t  TWh')

  total_periodo.append(df_dem_proyectada[nodo].sum()/10**6 )
total_periodo = np.array(total_periodo)
print('total --> ', round(total_periodo.sum(),2) ,  ' TWh' )

Dem=   df_dem_proyectada.copy()
#Dem.to_excel('Demanda_proyectada al'+str(year_objetivo)+".xlsx")


import itertools

division = 100

T= int(8760) 

VoLL=10000

Emision_cota = 100000 

CV_Chile_C = 46 
CV_Chile_D = 200 
CV_Chile_G_CC = 91 
CV_Chile_G_CA = 91 
CI_TODOS_G_CC = 113000/division 
CI_TODOS_G_CA = 113000/division 
CI_TODOS_D = 62000/division 
CI_TODOS_S = 80700/division 
CI_TODOS_E = 115100/division 
CI_TODOS_B = 30000/division 
CI_Tx = 30000/division 
EM_TODOS_C= 0.949 
EM_TODOS_G= 0.436 
EM_TODOS_D= 0.779 

#@title Tiempo


# Parámetros

representative_years = [year_objetivo]  
i_rate = 0.09  

# Crear un rango de 8760 horas para el periodo 2023-2025
fecha_base = pd.date_range(start=str(year_objetivo)+"-01-01", end=str(year_objetivo+1)+"-12-31 23:00", freq="h")  #"2040-12-31 23:00"

# Crear DataFrame con las 8760 horas
df_8760 = pd.DataFrame({"time": fecha_base})

# Extraer valores de año, mes, día y hora
df_8760["t"] = range(1, len(df_8760) + 1)
df_8760["year"] = df_8760["time"].dt.year
df_8760["month"] = df_8760["time"].dt.month
df_8760["day"] = df_8760["time"].dt.day
df_8760["hour"] = df_8760["time"].dt.hour

# Función para asignar rangos de días representativos
def assign_day_range(day, representative_days):
    if len(representative_days) == 1:
        return f"Día 1 al Día {representative_days[0] - 1}" if day < representative_days[0] else f"Día {representative_days[0]} al Fin de Mes"
    elif len(representative_days) == 2:
        if day < representative_days[0]:
            return f"Día 1 al Día {representative_days[0] - 1}"
        elif day < representative_days[1]:
            return f"Día {representative_days[0]} al Día {representative_days[1] - 1}"
        else:
            return f"Día {representative_days[1]} al Fin de Mes"
    elif len(representative_days) == 3:
        if day < representative_days[0]:
            return f"Día 1 al Día {representative_days[0] - 1}"
        elif day < representative_days[1]:
            return f"Día {representative_days[0]} al Día {representative_days[1] - 1}"
        elif day < representative_days[2]:
            return f"Día {representative_days[1]} al Día {representative_days[2] - 1}"
        else:
            return f"Día {representative_days[2]} al Fin de Mes"
    return None

# Aplicar asignación de rangos
df_8760["day_range"] = df_8760["day"]


# Obtener el año mínimo como referencia
min_year = df_8760["year"].min()

# Crear columna 'Inv_year' contando desde el primer año
df_8760["Inv_year"] = df_8760["year"] - min_year + 1

# Calcular la columna 'amortiguamiento'
df_8760["amortiguamiento"] = (1 / (1 + i_rate)) ** ((df_8760["Inv_year"] - 1)*1)


# Contar las horas por rango de días, año, mes y hora
hour_counts_by_month = df_8760.groupby(["day_range", "year", "month", "hour"]).size().reset_index(name="count")

# Filtrar los días y años representativos
df_tiempo = df_8760[df_8760["year"].isin(representative_years)]
df_tiempo = df_tiempo[df_tiempo["t"].isin(list([i for i in range(1,T+1,division)]))]


# Agregar columna Id_tiempo con valores consecutivos
df_tiempo.insert(1, "Id_tiempo", range(1, len(df_tiempo) + 1))

# Combinar para agregar la columna "count"
df_tiempo = pd.merge(df_tiempo, hour_counts_by_month, how="left", on=["day_range", "year", "month", "hour"])

# Mover la columna 'count' a la derecha de la columna 'hour'
df_tiempo.insert(df_tiempo.columns.get_loc("hour") + 1, "count", df_tiempo.pop("count"))



year_ =2025
df_Nodos['delta_' +str(year_)] =  df_Nodos['Dem 2025']*(df_Nodos['tasa anual']**(year_ -2025) - 1)
delta_dem_nodo = dict(zip(df_Nodos['nombre'], df_Nodos['delta_' +str(year_)])) 

Lineas['delta_D']= Lineas['Nodo_ini'].map(delta_dem_nodo) + Lineas['Nodo_fin'].map(delta_dem_nodo)

Lineas['Factor utilizacion pais']= Lineas['Nodo_ini'].map(df_utilizacion.set_index('nombre')['Factor utilizacion pais'])

print(Lineas[['Nodo_ini','Factor utilizacion pais']])


# =============================================================================
#                           Optimización
# =============================================================================

def construir_modelo(inversiones_gx= 'Con_gx', transmision = 'b', escenario = 'S1X', sincarbonCL= True, escenario_comb= "Cst_med", bloquear_invtx_nacional= True, bloquear_invtx_existenteinternacional= True, flux0_internacional_candidata=False, solo_CL_PE= False, pais1= 'CL', pais2= 'BO', interconexion_can = "CL_NORTE --> BO_SUR",ordendemerito= True, max_lineasBINARIAS_tx= 1):
    model = pyo.ConcreteModel()

    model.Convencionales =  pyo.RangeSet(len(GeneradoresC)) 
    model.Nodos = pyo.RangeSet(len(df_Nodos))  
    model.Solares = pyo.RangeSet(len(GeneradoresS)) 
    model.Eolicas = pyo.RangeSet(len(GeneradoresE)) 
    model.Hidraulicas_P = pyo.RangeSet(len(GeneradoresH_P)) 
    model.Hidraulicas_E = pyo.RangeSet(len(GeneradoresH_E)) 
    model.Nucleares = pyo.RangeSet(len(GeneradoresN)) 
    model.Bioenegy  = pyo.RangeSet(len(GeneradoresB))
    model.Geoenegy  = pyo.RangeSet(len(GeneradoresGeo))
    model.Periodos = [i for i in range(1,T+1,division)] 
    model.Lineas = pyo.RangeSet(len(Lineas)) 
    model.Periodos_aux = [0] + [i for i in range(1,T+1, division)] 

    model.P = pyo.Var(model.Convencionales, model.Periodos, within = pyo.NonNegativeReals)
    model.P_I = pyo.Var(model.Convencionales, within = pyo.NonNegativeReals)
    model.S = pyo.Var(model.Solares, model.Periodos, within = pyo.NonNegativeReals)
    model.S_I = pyo.Var(model.Solares, within = pyo.NonNegativeReals)
    model.E = pyo.Var(model.Eolicas, model.Periodos, within = pyo.NonNegativeReals)
    model.E_I = pyo.Var(model.Eolicas, within = pyo.NonNegativeReals)
    model.H_E = pyo.Var(model.Hidraulicas_E, model.Periodos, within = pyo.NonNegativeReals)
    model.H_P = pyo.Var(model.Hidraulicas_P, model.Periodos, within = pyo.NonNegativeReals)
    model.Nu = pyo.Var(model.Nucleares, model.Periodos, within = pyo.NonNegativeReals)
    model.Bio = pyo.Var(model.Bioenegy, model.Periodos, within = pyo.NonNegativeReals)
    model.Geo = pyo.Var(model.Geoenegy, model.Periodos, within = pyo.NonNegativeReals)
    model.F = pyo.Var(model.Lineas,model.Periodos, within = pyo.Reals)
    model.F_I = pyo.Var(model.Lineas, within = pyo.NonNegativeReals)

    model.F_loop = pyo.Var(model.Lineas,model.Periodos, within = pyo.Reals)

    model.delta = pyo.Var(model.Nodos, model.Periodos, within = pyo.NonNegativeReals)
    model.SG = pyo.Var(model.Nodos, model.Periodos, within = pyo.NonNegativeReals)  
    model.ver_dam = pyo.Var(model.Nodos, model.Periodos, within = pyo.NonNegativeReals)  
    model.ver_bess = pyo.Var(model.Nodos, model.Periodos, within = pyo.NonNegativeReals)

    model.PBess = pyo.Var(model.Nodos, model.Periodos, within = pyo.Reals)
    model.D = pyo.Var(model.Nodos, model.Periodos, within = pyo.NonNegativeReals)
    model.C = pyo.Var(model.Nodos, model.Periodos, within = pyo.NonNegativeReals)
    model.PBess_I = pyo.Var(model.Nodos, within = pyo.NonNegativeReals)

    model.EBess = pyo.Var(model.Nodos, model.Periodos_aux, within = pyo.NonNegativeReals)
    model.EBess2 = pyo.Var(model.Nodos, model.Periodos, within = pyo.NonNegativeReals)
    model.EBess0 = pyo.Var(model.Nodos, model.Periodos, within = pyo.NonNegativeReals) #energia inicial
    model.Opex = pyo.Var(within = pyo.NonNegativeReals)
    model.OpexChile = pyo.Var(within = pyo.NonNegativeReals)
    model.CapexGx = pyo.Var(within = pyo.NonNegativeReals)
    model.CapexB = pyo.Var(within = pyo.NonNegativeReals)
    model.CapexTx = pyo.Var(within = pyo.NonNegativeReals)
    model.ENS = pyo.Var(within = pyo.NonNegativeReals)
    model.Loop = pyo.Var(within = pyo.NonNegativeReals)
    model.Cbess = pyo.Var(within = pyo.NonNegativeReals)
    model.tx_internacional = pyo.Var(within = pyo.NonNegativeReals)
    model.tx_internacional_existente = pyo.Var(within = pyo.NonNegativeReals)
    model.tx_nacional = pyo.Var(within = pyo.NonNegativeReals)
    model.tx_nacionalloop = pyo.Var(within = pyo.NonNegativeReals)

    model.Produccion_anual_Solar = pyo.Var(model.Solares, within = pyo.NonNegativeReals)
    model.Produccion_anual_Eolica = pyo.Var(model.Eolicas, within = pyo.NonNegativeReals)
    model.Produccion_anual_Hidraulicas_P = pyo.Var(model.Hidraulicas_P, within = pyo.NonNegativeReals)

    model.X = pyo.Var(model.Lineas, within = pyo.Binary)
    model.X_LN = pyo.Var(model.Lineas, within = pyo.Binary)
    model.F_I_sup = pyo.Var(model.Lineas, within = pyo.NonNegativeReals)
    model.F_I_inf = pyo.Var(model.Lineas, within = pyo.NonNegativeReals)

    # Definir la variable de energía almacenada en el embalse
    model.E_almacenada = pyo.Var(model.Hidraulicas_E, model.Periodos_aux, within=pyo.NonNegativeReals) 
    model.E_almacenada2 = pyo.Var(model.Hidraulicas_E, model.Periodos, within=pyo.NonNegativeReals) 
    model.E_almacenada_ini = pyo.Var(model.Hidraulicas_E, model.Periodos, within=pyo.NonNegativeReals) 

    model.gen_solares_en_barra = {n: [g for g in model.Solares if GeneradoresS.loc[g - 1, 'Nodo'] == n] for n in model.Nodos}
    model.gen_eolicas_en_barra = {n: [g for g in model.Eolicas if GeneradoresE.loc[g - 1, 'Nodo'] == n] for n in model.Nodos}
    model.gen_nucleares_en_barra = {n: [g for g in model.Nucleares if GeneradoresN.loc[g - 1, 'Nodo'] == n] for n in model.Nodos}
    model.gen_bioenergy_en_barra = {n: [g for g in model.Bioenegy if GeneradoresB.loc[g - 1, 'Nodo'] == n] for n in model.Nodos}
    model.gen_geoenergy_en_barra = {n: [g for g in model.Geoenegy if GeneradoresGeo.loc[g - 1, 'Nodo'] == n] for n in model.Nodos}

    model.gen_HE_en_barra = {n: [g for g in model.Hidraulicas_E if GeneradoresH_E.loc[g - 1, 'Nodo'] == n] for n in model.Nodos}
    model.gen_HP_en_barra = {n: [g for g in model.Hidraulicas_P if GeneradoresH_P.loc[g - 1, 'Nodo'] == n] for n in model.Nodos}
    model.lineas_entrantes_barra = {n: [l for l in model.Lineas if Lineas.loc[l - 1, 'To'] == n] for n in model.Nodos}
    model.lineas_salientes_barra = {n: [l for l in model.Lineas if Lineas.loc[l - 1, 'From'] == n] for n in model.Nodos}
    model.gen_conv_en_barra = {n: [g for g in model.Convencionales if GeneradoresC.loc[g - 1, 'Nodo'] == n] for n in model.Nodos}

    def solar_init(model, g, t):
        perfil = GeneradoresS.loc[g-1, 'Perfil' ]  
        return PerfilS.loc[t-1, perfil]  
    model.PerfilS = pyo.Param(model.Solares, model.Periodos, initialize=solar_init)

    def eolico_init(model, g, t):
        perfil = GeneradoresE.loc[g-1, 'Perfil' ]  
        return PerfilE.loc[t-1, perfil]  
    model.PerfilE = pyo.Param(model.Eolicas, model.Periodos, initialize=eolico_init)

    def get_fmax_dynamic(df_tiempo, df_L, df_maxflow):
        df_maxflow = df_maxflow.sort_values(by=['time'])
        df_tiempo = df_tiempo.sort_values(by=['time'])
        Fmax_dict = {}
        for t, time in zip(df_tiempo['t'], df_tiempo['time']):
            for l in df_L.index:
                line_name = df_L.loc[l, 'Nombre']
                base_Fmax = df_L.loc[l, 'Fmax directo (MW)']
                relevant_flows = df_maxflow[(df_maxflow['name'] == line_name) & (df_maxflow['time'] <= time)]
                if not relevant_flows.empty:
                    last_value = relevant_flows['value (MW)'].iloc[-1]
                    Fmax_dict[(l + 1, t )] =  last_value 
                else:
                    Fmax_dict[( l + 1, t)] = base_Fmax
        return Fmax_dict

    Fmax_dynamic = get_fmax_dynamic(df_tiempo, Lineas, df_max_flow)
    model.Lineas_Tiempos = pyo.Set(dimen=2, initialize=Fmax_dynamic.keys())
    model.Fmax = pyo.Param(model.Lineas_Tiempos, initialize=Fmax_dynamic, within= pyo.NonNegativeReals, mutable=True)
    model.max_lineasBINARIAS_tx = pyo.Param(initialize= max_lineasBINARIAS_tx)

    def get_fmax_dynamic_inv(df_tiempo, df_L, df_maxflow):
        df_maxflow = df_maxflow.sort_values(by=['time'])
        df_tiempo = df_tiempo.sort_values(by=['time'])
        Fmax_dict = {}
        for t, time in zip(df_tiempo['t'], df_tiempo['time']):
            for l in df_L.index:
                line_name = df_L.loc[l, 'Nombre']
                base_Fmax = df_L.loc[l, 'Fmax inverso (MW)']
                relevant_flows = df_maxflow[(df_maxflow['name'] == line_name) & (df_maxflow['time'] <= time)]
                if not relevant_flows.empty:
                    last_value = relevant_flows['value (MW)'].iloc[-1]
                    Fmax_dict[(l + 1, t )] =  last_value
                else:
                    Fmax_dict[( l + 1, t)] = base_Fmax
        return Fmax_dict

    Fmax_dynamic_inverse = get_fmax_dynamic_inv(df_tiempo, Lineas, df_max_flow)
    model.Fmax_inverse = pyo.Param(model.Lineas_Tiempos, initialize=Fmax_dynamic_inverse, within= pyo.NonNegativeReals, mutable=True)


    def get_pmax_from_generadoresC_with_dfmax(df_tiempo, df_generadores_c, df_max_cap):
        df_max_cap = df_max_cap.sort_values(by='time')
        df_tiempo = df_tiempo.sort_values(by='time')
        Pmax_dict = {}
        for t, time in zip(df_tiempo['t'], df_tiempo['time']):
            for g in df_generadores_c.index:
                nodo = df_generadores_c.loc[g, 'Nombre_nodo']
                tecno = df_generadores_c.loc[g, 'Tecnología']
                base_Pmax = df_generadores_c.loc[g, 'Capacidad instalada (MW)']
                relevant_caps = df_max_cap[
                    (df_max_cap['Nombre_nodo'] == nodo) &
                    (df_max_cap['Tecnología'] == tecno) &
                    (df_max_cap['time'] <= time)
                ]
                if not relevant_caps.empty:
                    last_value = relevant_caps['value_MW'].iloc[-1]
                    Pmax_dict[(g + 1, t)] = last_value
                else:
                    Pmax_dict[(g + 1, t)] = base_Pmax
        return Pmax_dict
    Pmax_dynamic_C = get_pmax_from_generadoresC_with_dfmax(df_tiempo.copy(), GeneradoresC, df_max_cap)
    model.GeneradoresC_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_C.keys())
    model.Pmax_C = pyo.Param(model.GeneradoresC_Tiempos, initialize=Pmax_dynamic_C, within=pyo.NonNegativeReals, mutable=True)

    def get_pmax_from_generadoresE_with_dfmax(df_tiempo, df_generadores_e, df_max_cap):
        df_max_cap = df_max_cap.sort_values(by='time')
        df_tiempo = df_tiempo.sort_values(by='time')
        Pmax_dict = {}
        for t, time in zip(df_tiempo['t'], df_tiempo['time']):
            for g in df_generadores_e.index:
                nodo = df_generadores_e.loc[g, 'Nombre_nodo']
                tecno = df_generadores_e.loc[g, 'Tecnología']
                base_Pmax = df_generadores_e.loc[g, 'Capacidad instalada (MW)']
                relevant_caps = df_max_cap[
                    (df_max_cap['Nombre_nodo'] == nodo) &
                    (df_max_cap['Tecnología'] == tecno) &
                    (df_max_cap['time'] <= time)
                ]
                if not relevant_caps.empty:
                    last_value = relevant_caps['value_MW'].iloc[-1]
                    Pmax_dict[(g + 1, t)] = last_value
                else:
                    Pmax_dict[(g + 1, t)] = base_Pmax
        return Pmax_dict
    Pmax_dynamic_E = get_pmax_from_generadoresE_with_dfmax(df_tiempo, GeneradoresE, df_max_cap)
    model.GeneradoresE_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_E.keys())
    model.Pmax_E = pyo.Param(model.GeneradoresE_Tiempos, initialize=Pmax_dynamic_E, within=pyo.NonNegativeReals, mutable=True)

    def get_pmax_from_generadoresS_with_dfmax(df_tiempo, df_generadores_s, df_max_cap):
        df_max_cap = df_max_cap.sort_values(by='time')
        df_tiempo = df_tiempo.sort_values(by='time')
        Pmax_dict = {}
        for t, time in zip(df_tiempo['t'], df_tiempo['time']):
            for g in df_generadores_s.index:
                nodo = df_generadores_s.loc[g, 'Nombre_nodo']
                tecno = df_generadores_s.loc[g, 'Tecnología']
                base_Pmax = df_generadores_s.loc[g, 'Capacidad instalada (MW)']
                relevant_caps = df_max_cap[
                    (df_max_cap['Nombre_nodo'] == nodo) &
                    (df_max_cap['Tecnología'] == tecno) &
                    (df_max_cap['time'] <= time)
                ]
                if not relevant_caps.empty:
                    last_value = relevant_caps['value_MW'].iloc[-1]
                    Pmax_dict[(g + 1, t)] = last_value
                else:
                    Pmax_dict[(g + 1, t)] = base_Pmax
        return Pmax_dict
    Pmax_dynamic_S = get_pmax_from_generadoresS_with_dfmax(df_tiempo, GeneradoresS, df_max_cap)
    model.GeneradoresS_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_S.keys())
    model.Pmax_S = pyo.Param(model.GeneradoresS_Tiempos, initialize=Pmax_dynamic_S, within=pyo.NonNegativeReals, mutable=True)

    def get_pmax_from_generadoresH_P_with_dfmax(df_tiempo, df_generadores_h, df_max_cap):
        df_max_cap = df_max_cap.sort_values(by='time')
        df_tiempo = df_tiempo.sort_values(by='time')
        Pmax_dict = {}
        for t, time in zip(df_tiempo['t'], df_tiempo['time']):
            for g in df_generadores_h.index:
                nodo = df_generadores_h.loc[g, 'Nombre_nodo']
                tecno = df_generadores_h.loc[g, 'Tecnología']
                base_Pmax = df_generadores_h.loc[g, 'Capacidad instalada (MW)']
                relevant_caps = df_max_cap[
                    (df_max_cap['Nombre_nodo'] == nodo) &
                    (df_max_cap['Tecnología'] == tecno) &
                    (df_max_cap['time'] <= time)
                ]
                if not relevant_caps.empty:
                    last_value = relevant_caps['value_MW'].iloc[-1]
                    Pmax_dict[(g + 1, t)] = last_value
                else:
                    Pmax_dict[(g + 1, t)] = base_Pmax
        return Pmax_dict
    Pmax_dynamic_H = get_pmax_from_generadoresH_P_with_dfmax(df_tiempo, GeneradoresH_P, df_max_cap)
    model.GeneradoresH_P_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_H.keys())
    model.Pmax_H = pyo.Param(model.GeneradoresH_P_Tiempos, initialize=Pmax_dynamic_H, within=pyo.NonNegativeReals, mutable=True)

    def get_pmax_bess_from_dfmax(df_tiempo, df_almacenamiento, df_max_cap):
        df_max_cap = df_max_cap.sort_values(by='time')
        df_tiempo = df_tiempo.sort_values(by='time')
        Pmax_dict = {}
        for t, time in zip(df_tiempo['t'], df_tiempo['time']):
            for n in df_almacenamiento.index:
                nodo = df_almacenamiento.loc[n, 'nombre']
                base_Pmax = df_almacenamiento.loc[n, 'Capacidad instalada (MW)']
                relevant_caps = df_max_cap[
                    (df_max_cap['Nombre_nodo'] == nodo) &
                    (df_max_cap['Tecnología'] == 'BESS') &
                    (df_max_cap['time'] <= time)
                ]
                if not relevant_caps.empty:
                    last_value = relevant_caps['value_MW'].iloc[-1]
                    Pmax_dict[(n + 1, t)] = last_value
                else:
                    Pmax_dict[(n + 1, t)] = base_Pmax 
        return Pmax_dict
    Pmax_dynamic_BESS = get_pmax_bess_from_dfmax(df_tiempo, AlmacenamientoBESS, df_max_cap)
    model.Nodos_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_BESS.keys())
    model.Pmax_BESS = pyo.Param(model.Nodos_Tiempos, initialize=Pmax_dynamic_BESS, within=pyo.NonNegativeReals, mutable=True)

    perfil_map = df_Nodos.set_index('Indice')['nombre'].to_dict()
    Dem_dict = {}
    for n in model.Nodos:
        demandas_asociadas = df_Nodos[df_Nodos['Indice'] == n]['Indice'].tolist()
        for t in model.Periodos:
            Dem_dict[(n, t)] = sum(Dem.loc[t - 1, perfil_map[d]] for d in demandas_asociadas)
    model.Dem = pyo.Param(model.Nodos, model.Periodos, initialize=Dem_dict, within=pyo.NonNegativeReals)

    G_CostVariable_dict = {}
    for g in GeneradoresC.index + 1:
        tecnologia_g_ = GeneradoresC.loc[g - 1, 'Tecnología']
        nodo_g_ = GeneradoresC.loc[g - 1, 'Nombre_nodo']
        pmax_g_ = GeneradoresC.loc[g - 1, 'Capacidad instalada (MW)']
        for t in df_tiempo["t"]: 
            year_t_ = df_tiempo.loc[df_tiempo["t"] == t, "year"].values[0]
            filtro = (
                (df_CostosCombustible['Tecnología'] == tecnologia_g_) &
                (df_CostosCombustible['País'] == nodo_g_) &
                (df_CostosCombustible['Año'] == year_t_)
            )
            if filtro.any() :
                precio_combustible = df_CostosCombustible.loc[filtro, 'Precio Combustible'].values[0]
                heat_rate = df_CostosCombustible.loc[filtro, 'Heatrate'].values[0]
                vomc = df_CostosCombustible.loc[filtro, 'VOMC'].values[0]
                factor_escenario = df_CostosCombustible.loc[filtro, escenario_comb].values[0]
                valor = (precio_combustible * heat_rate)* factor_escenario +  vomc
            else:
                if pmax_g_!=0:
                  print('Error en costo variavle '+ str(nodo_g_)+str(tecnologia_g_))
                valor = 100000001
            G_CostVariable_dict[(g, t)] = valor
    model.G_T = pyo.Set(dimen=2, initialize=G_CostVariable_dict.keys())
    model.G_CostVariable = pyo.Param(model.G_T, initialize=G_CostVariable_dict, within=pyo.NonNegativeReals)

    G_CostInversion_dict = {}
    for g in GeneradoresC.index + 1:
        tecnologia_g = GeneradoresC.loc[g - 1, 'Tecnología']
        nodo_g = GeneradoresC.loc[g - 1, 'Pais']
        for t in df_tiempo["t"]: 
            year_t = df_tiempo.loc[df_tiempo["t"] == t, "year"].values[0]
            filtro = (
                (df_CostosInversion['Tecnología'] == tecnologia_g) &
                (df_CostosInversion['País'] == nodo_g) &
                (df_CostosInversion['Año'] == year_t)
            )
            if filtro.any():
                valor = df_CostosInversion.loc[filtro, 'Valor'].values[0]
            else:
                valor = 10001
            G_CostInversion_dict[(g, t)] = valor/division
    model.G_TC = pyo.Set(dimen=2, initialize=G_CostInversion_dict.keys(), within=pyo.Any)
    model.G_CostInversion = pyo.Param(model.G_TC, initialize=G_CostInversion_dict, within=pyo.NonNegativeReals)

    G_CostInversionS_dict = {}
    for g in GeneradoresS.index + 1:
        tecnologia_g = GeneradoresS.loc[g - 1, 'Tecnología']
        nodo_g = GeneradoresS.loc[g - 1, 'Pais'] 
        for t in df_tiempo["t"]: 
            year_t = df_tiempo.loc[df_tiempo["t"] == t, "year"].values[0]
            filtro = (
                (df_CostosInversion['Tecnología'] == tecnologia_g) &
                (df_CostosInversion['País'] == nodo_g) &
                (df_CostosInversion['Año'] == year_t)
            )
            if filtro.any():
                valor = df_CostosInversion.loc[filtro, 'Valor'].values[0]
            else:
                print('Error en costos de inversionS'+ str(nodo_g))
                valor = 10001
            G_CostInversionS_dict[(g, t)] = valor/division           
    model.G_TS = pyo.Set(dimen=2, initialize=G_CostInversionS_dict.keys(), within=pyo.Any)
    model.G_CostInversionS = pyo.Param(model.G_TS, initialize=G_CostInversionS_dict, within=pyo.NonNegativeReals)

    G_CostInversionE_dict = {}
    for g in GeneradoresE.index + 1:
        tecnologia_g = GeneradoresE.loc[g - 1, 'Tecnología']
        nodo_g = GeneradoresE.loc[g - 1, 'Pais']
        for t in df_tiempo["t"]: 
            year_t = df_tiempo.loc[df_tiempo["t"] == t, "year"].values[0]
            filtro = (
                (df_CostosInversion['Tecnología'] == 'Eólica') &
                (df_CostosInversion['País'] == nodo_g) &
                (df_CostosInversion['Año'] == year_t)
            )
            if filtro.any():
                valor = df_CostosInversion.loc[filtro, 'Valor'].values[0] 
            else:
                print('Error en costos de inversionE'+ str(nodo_g))
                valor = 10001
            G_CostInversionE_dict[(g, t)] = valor/division         
    model.G_TE = pyo.Set(dimen=2, initialize=G_CostInversionE_dict.keys(), within=pyo.Any)
    model.G_CostInversionE = pyo.Param(model.G_TE, initialize=G_CostInversionE_dict, within=pyo.NonNegativeReals)

    G_CostInversionBESS_dict = {}
    for g in df_Nodos.index + 1:
        nodo_g = df_Nodos.loc[g - 1, 'pais']
        for t in df_tiempo["t"]: 
            year_t = df_tiempo.loc[df_tiempo["t"] == t, "year"].values[0]
            filtro = (
                (df_CostosInversion['Tecnología'] == "Batería") &
                (df_CostosInversion['País'] == nodo_g) &
                (df_CostosInversion['Año'] == year_t)
            )
            if filtro.any():
                valor = df_CostosInversion.loc[filtro, 'Valor'].values[0] 
            else:
                print('Error en costos de inversion bess'+ str(nodo_g))
                valor = 10001
            G_CostInversionBESS_dict[(g, t)] = valor/division
    model.G_TBESS = pyo.Set(dimen=2, initialize=G_CostInversionBESS_dict.keys(), within=pyo.Any)
    model.G_CostInversionBESS = pyo.Param(model.G_TBESS, initialize=G_CostInversionBESS_dict, within=pyo.NonNegativeReals)

    def construir_diccionario_perfil_mes(df_generadores, df_tiempo, df_perfil, nombre_set='S'):
        Perfil_mes_dict = {}
        for g in df_generadores.index + 1:
            perfil_nombre = df_generadores.loc[g - 1, 'Perfil_mes']
            for t in df_tiempo["t"]:
                mes = df_tiempo.loc[df_tiempo["t"] == t, "month"].values[0]
                if perfil_nombre in df_perfil.columns:
                    valor = df_perfil.loc[mes - 1, perfil_nombre]  
                else:
                    valor = 0
                    print(f'El perfil no existe {perfil_nombre}')
                Perfil_mes_dict[(g, t)] = valor
        return Perfil_mes_dict

    Perfil_mes_HP_dict = construir_diccionario_perfil_mes(GeneradoresH_P, df_tiempo, Energia_PerfilH, nombre_set='HP')
    model.HP_T_PerfilMes = pyo.Set(dimen=2, initialize=Perfil_mes_HP_dict.keys(), ordered=True)
    model.PerfilMesHP = pyo.Param(model.HP_T_PerfilMes, initialize=Perfil_mes_HP_dict, within=pyo.NonNegativeReals)

    Perfil_mes_HE_dict = construir_diccionario_perfil_mes(GeneradoresH_E, df_tiempo, Energia_PerfilH, nombre_set='HE')
    model.HE_T_PerfilMes = pyo.Set(dimen=2, initialize=Perfil_mes_HE_dict.keys(), ordered=True)
    model.PerfilMesHE = pyo.Param(model.HE_T_PerfilMes, initialize=Perfil_mes_HE_dict, within=pyo.NonNegativeReals)

    def cost(model):
        return (model.Opex + model.CapexGx + model.tx_internacional + model.tx_nacional + model.tx_internacional_existente 
                + model.CapexB + model.ENS + model.Loop
                + sum(100000*model.SG[n,t] for n in model.Nodos for t in model.Periodos)
                + sum(0.000*model.ver_dam[n,t] for n in model.Nodos for t in model.Periodos)
                + sum(10000*model.ver_bess[n,t] for n in model.Nodos for t in model.Periodos)
                )
    model.cost = pyo.Objective(rule = cost, sense = pyo.minimize)

    def R40(model):
        return model.Opex == (
            sum(model.P[g, t] * model.G_CostVariable[g, t] for g in model.Convencionales for t in model.Periodos if GeneradoresC.loc[g-1, 'Tecnología'] == 'Carbón') +
            sum(model.P[g, t] * model.G_CostVariable[g, t] for g in model.Convencionales for t in model.Periodos if GeneradoresC.loc[g-1, 'Tecnología'] == 'Gas CC') +
            sum(model.P[g, t] * model.G_CostVariable[g, t] for g in model.Convencionales for t in model.Periodos if GeneradoresC.loc[g-1, 'Tecnología'] == 'Gas CA') +
            sum(model.P[g, t] * model.G_CostVariable[g, t] for g in model.Convencionales for t in model.Periodos if GeneradoresC.loc[g-1, 'Tecnología'] == 'Diesel')
        )
    model.R40 = pyo.Constraint(rule=R40)

    def R41(model):
        return model.CapexGx == (
            sum(model.P_I[g] * model.G_CostInversion[g, min(model.Periodos)] for g in model.Convencionales if GeneradoresC.loc[g-1,'Tecnología'] == 'Gas CC') +
            sum(model.P_I[g] * model.G_CostInversion[g, min(model.Periodos)] for g in model.Convencionales if GeneradoresC.loc[g-1,'Tecnología'] == 'Gas CA') +
            sum(model.S_I[s] * model.G_CostInversionS[s, min(model.Periodos)] for s in model.Solares if GeneradoresS.loc[g-1,'Tecnología'] == 'Solar') +
            sum(model.E_I[e] * model.G_CostInversionE[e, min(model.Periodos)] for e in model.Eolicas if GeneradoresE.loc[g-1,'Tecnología'] == 'Eolico')
        )
    model.R41 = pyo.Constraint(rule=R41)

    def R_tx_internacional_binaria(model):
        return  model.tx_internacional == sum( Lineas.loc[l-1,"Fmax directo (MW)"] * (66 / division) * model.X_LN[l] for l in model.Lineas if (Lineas.loc[l-1,'Estado'] == 'Candidata' and Lineas.loc[l-1, 'propiedad'] == "Internacional"))
    model.R_tx_internacional = pyo.Constraint( rule=R_tx_internacional_binaria)

    def R_tx_internacional_existente(model):
        return model.tx_internacional_existente == sum((66/division) * model.F_I[l] * Lineas.loc[l-1,'Distancia (km)']  for l in model.Lineas if (Lineas.loc[l-1,'Estado'] == 'Existente' and Lineas.loc[l-1, 'propiedad'] == "Internacional") )
    model.R_tx_internacional_existente = pyo.Constraint( rule=R_tx_internacional_existente)

    def R_tx_nacional(model):
        return model.tx_nacional == sum(66/division * model.F_I[l] * Lineas.loc[l-1,'Distancia (km)'] + 
                                        model.X[l] *((3.1)/division)*  Lineas.loc[l-1,'delta_D']*(1000000) * 
                                        (1+ (Lineas.loc[l-1,'Factor utilizacion pais'] - df_utilizacion.loc[0,'Factor utilizacion pais'] ) )
                                        for l in model.Lineas if (Lineas.loc[l-1, 'Estado'] == "Existente" and Lineas.loc[l-1, 'propiedad'] == "Nacional")
        )
    model.R_tx_nacional = pyo.Constraint( rule=R_tx_nacional)

    def R43(model):
        return  model.CapexB == sum(model.PBess_I[n]*model.G_CostInversionBESS[n, min(model.Periodos)]*5 for n in model.Nodos) 
    model.R43 = pyo.Constraint(rule = R43)

    def R44(model): 
        return  model.ENS  == sum(10000*model.delta[n,t] for n in model.Nodos for t in model.Periodos)
    model.R44 = pyo.Constraint(rule = R44)

    def R45(model):
        return  model.Loop == sum(0.01*model.F_loop[l,t] for l in model.Lineas for t in model.Periodos)
    model.R45 = pyo.Constraint(rule = R45)

    def R0a(model, l, t):
      return  model.F_loop[l,t] >= model.F[l,t]
    model.R0a = pyo.Constraint(model.Lineas, model.Periodos, rule = R0a)
    def R0b(model, l, t):
      return  model.F_loop[l,t] >= -model.F[l,t]
    model.R0b = pyo.Constraint(model.Lineas, model.Periodos, rule = R0b)

    def R2(model, s, t):
      produccion_anual = GeneradoresS.loc[s-1,'Produccion_anual (MWh)']
      produccion_anual_perfil = GeneradoresS.loc[s-1,'Capacidad instalada (MW)'] * sum(model.PerfilS[s,tt] for tt in model.Periodos)*division
      factor =  produccion_anual  / (produccion_anual_perfil if produccion_anual_perfil>0 else 1 )
      suma_perfil = sum(model.PerfilS[s, tt] for tt in model.Periodos)
      factor_carga =  produccion_anual/((GeneradoresS.loc[s-1,'Capacidad instalada (MW)'] if GeneradoresS.loc[s-1,'Capacidad instalada (MW)'] >0 else 1 )*8760)
      return model.S[s,t] <= GeneradoresS.loc[s-1,'Capacidad instalada (MW)'] * model.PerfilS[s,t] * factor  + (model.S_I[s] + (model.Pmax_S[s,t] -GeneradoresS.loc[s-1,'Capacidad instalada (MW)'] ))* model.PerfilS[s,t]
    model.R2 = pyo.Constraint(model.Solares, model.Periodos, rule = R2)

    def R10(model, e, t): 
      produccion_anual = GeneradoresE.loc[e-1,'Produccion_anual (MWh)']
      produccion_anual_perfil = GeneradoresE.loc[e-1,'Capacidad instalada (MW)'] * sum(model.PerfilE[e,tt] for tt in model.Periodos)*division
      factor =  produccion_anual  / (produccion_anual_perfil if produccion_anual_perfil>0 else 1 )
      suma_perfil = sum(model.PerfilE[e, tt] for tt in model.Periodos)
      factor_carga =  produccion_anual/((GeneradoresE.loc[e-1,'Capacidad instalada (MW)'] if GeneradoresE.loc[e-1,'Capacidad instalada (MW)'] >0 else 1 )*8760)
      return model.E[e,t] <= GeneradoresE.loc[e-1,'Capacidad instalada (MW)'] * model.PerfilE[e,t] * factor  + (model.E_I[e] + (model.Pmax_E[e,t] -GeneradoresE.loc[e-1,'Capacidad instalada (MW)'] ))* model.PerfilE[e,t]
    model.R10 = pyo.Constraint(model.Eolicas, model.Periodos, rule = R10)

    def E10(model, e):
      return model.E_I[e] <= (GeneradoresE.loc[e-1,'invmax'])
    def S2(model, s):
      return model.S_I[s] <= (GeneradoresS.loc[s-1,'invmax'])
    if inversiones_gx != 'Sin_gx' :
      model.E10 = pyo.Constraint(model.Eolicas, rule = E10)
      model.S2 = pyo.Constraint(model.Solares, rule = S2)

    def R3(model, g, t):
        fc = GeneradoresC.loc[g - 1, "fc"]
        if GeneradoresC.loc[g - 1, "Tecnología"] == "Carbón":
            if GeneradoresC.loc[g - 1, "Pais"] == "CL":
                if sincarbonCL:
                    return model.P[g, t] == 0
                else:
                    return (model.P[g, t] <= ((model.Pmax_C[g, 1])))
            else:
                return (model.P[g, t] <= ((model.Pmax_C[g, t])))  
        elif GeneradoresC.loc[g - 1, "Tecnología"] == "Diesel":
            return model.P[g, t] <= (model.Pmax_C[g, t]) * (1 - GeneradoresC.loc[g - 1, "IFOR"]) 
        elif GeneradoresC.loc[g - 1, "Tecnología"] == "Gas CC": 
            return model.P[g, t] <= ((model.Pmax_C[g, t])) + model.P_I[g] 
        elif GeneradoresC.loc[g - 1, "Tecnología"] == "Gas CA":
            return model.P[g, t] <= (model.Pmax_C[g, t]) * (1 - GeneradoresC.loc[g - 1, "IFOR"]) + model.P_I[g] * (1 - GeneradoresC.loc[g - 1, "IFOR"])  
    model.R3 = pyo.Constraint(model.Convencionales, model.Periodos, rule=R3)

    def agregar_restriccion_energia_mensual_convencional(model, df_tiempo):
        model.R3_fix = pyo.ConstraintList()
        t_por_mes = df_tiempo.groupby(["year", "month"])['t'].apply(list).to_dict()
        for g in model.Convencionales:
            tecnologia = GeneradoresC.loc[g - 1, "Tecnología"]
            fc = GeneradoresC.loc[g - 1, "fc"]
            produccion_anual = GeneradoresC.loc[g - 1, "Produccion_anual (MWh)"]
            for (y, m), t_list in t_por_mes.items():
                t_validos = [t for t in t_list if (g, t) in model.P]
                if not t_validos:
                    continue
                if tecnologia == "Carbón":
                    model.R3_fix.add(
                        sum(model.P[g, t] for t in t_validos) * division <= (produccion_anual / 12)
                    )
                elif tecnologia == "Gas CC":
                    model.R3_fix.add(
                        sum(model.P[g, t] for t in t_validos) * division <= (produccion_anual / 12) + (model.P_I[g] * 8760 * fc / 12)
                    )
    agregar_restriccion_energia_mensual_convencional(model, df_tiempo)

    def R15(model, g):
      if GeneradoresC.loc[g-1,'Tecnología'] == 'Carbón':
        return model.P_I[g] == 0
      elif GeneradoresC.loc[g-1,'Tecnología'] == 'Gas CC': 
        return model.P_I[g] <= GeneradoresC.loc[g-1,'invmax']
      elif GeneradoresC.loc[g-1,'Tecnología'] == 'Gas CA':
        return model.P_I[g] <= GeneradoresC.loc[g-1,'invmax']
      elif GeneradoresC.loc[g-1,'Tecnología'] == 'Diesel': 
        return model.P_I[g] <= 0 
      else:
        return pyo.Constraint.Skip
    model.R15 = pyo.Constraint(model.Convencionales, rule = R15)

    def R12(model, nu, t):
        produccion = GeneradoresN.loc[nu-1,'Produccion_anual (MWh)']
        return model.Nu[nu,t] <= GeneradoresN.loc[nu-1,'Capacidad instalada (MW)'] *produccion / ((GeneradoresN.loc[nu-1,'Capacidad instalada (MW)'] if GeneradoresN.loc[nu-1,'Capacidad instalada (MW)']>0 else 1)  * 8760 )
    model.R12 = pyo.Constraint(model.Nucleares, model.Periodos, rule = R12)

    def R13(model, nu, t):
        produccion = GeneradoresB.loc[nu-1,'Produccion_anual (MWh)']
        return model.Bio[nu,t] <= GeneradoresB.loc[nu-1,'Capacidad instalada (MW)'] *produccion / ((GeneradoresB.loc[nu-1,'Capacidad instalada (MW)'] if GeneradoresB.loc[nu-1,'Capacidad instalada (MW)']>0 else 1)  * 8760 )
    model.R13 = pyo.Constraint(model.Bioenegy, model.Periodos, rule = R13)

    def R14(model, geo, t):
        produccion = GeneradoresGeo.loc[geo-1,'Produccion_anual (MWh)']
        return model.Geo[geo,t] <= GeneradoresGeo.loc[geo-1,'Capacidad instalada (MW)'] *produccion / ((GeneradoresGeo.loc[geo-1,'Capacidad instalada (MW)'] if GeneradoresGeo.loc[geo-1,'Capacidad instalada (MW)']>0 else 1)  * 8760 )
    model.R14 = pyo.Constraint(model.Geoenegy, model.Periodos, rule = R14)

    def limite_cantidad_lineas(model):
        if ordendemerito:
            return sum(
                model.X_LN[l] for l in model.Lineas
                if (Lineas.loc[l-1,'Estado'] == 'Candidata' and
                    Lineas.loc[l-1,'propiedad'] == 'Internacional')
            ) == model.max_lineasBINARIAS_tx
        else:
            return pyo.Constraint.Skip
    model.limite_cantidad_lineas = pyo.Constraint(rule=limite_cantidad_lineas)

    def RXLN_solo_candidatas_internacionales(model, l):
        if Lineas.loc[l-1,'Estado'] == 'Candidata' and Lineas.loc[l-1,'propiedad'] == 'Internacional':
            return pyo.Constraint.Skip 
        else:
            return model.X_LN[l] == 0  
    model.RXLN_solo_candidatas_internacionales = pyo.Constraint(model.Lineas, rule=RXLN_solo_candidatas_internacionales)

    def R6(model, l, t):
        if (t - 1) % division != 0: return pyo.Constraint.Skip
        if (l, t) not in model.Lineas_Tiempos: return pyo.Constraint.Skip
        if Lineas.loc[l-1, 'Estado'] == "Candidata" and Lineas.loc[l-1, 'propiedad']=='Internacional':
            if ordendemerito==True:
                return model.F[l, t] <= Lineas.loc[l-1,'Fmax directo (MW)' ] * model.X_LN[l] 
            else:
                return model.F[l, t] <= model.F_I[l]
        else:
            return model.F[l, t] <= model.Fmax[l, t] + model.F_I[l]
    model.R6 = pyo.Constraint(model.Lineas, model.Periodos, rule=R6)

    def R7(model, l, t):
        if (t - 1) % division != 0: return pyo.Constraint.Skip
        if (l, t) not in model.Lineas_Tiempos: return pyo.Constraint.Skip
        if Lineas.loc[l-1, 'Estado'] == "Candidata" and Lineas.loc[l-1, 'propiedad']=='Internacional':
            if ordendemerito==True:
                return model.F[l, t] >= -Lineas.loc[l-1,'Fmax inverso (MW)' ] * model.X_LN[l] 
            else:
                return model.F[l, t] >= -model.F_I[l]          
        else: 
            return model.F[l, t] >= -model.Fmax_inverse[l, t] - model.F_I[l]
    model.R7 = pyo.Constraint(model.Lineas, model.Periodos, rule=R7)

    def RLineanacional(model, l):
        if Lineas.loc[l-1, 'Estado'] == "Existente" and Lineas.loc[l-1, 'propiedad'] == "Nacional":
            return  model.F_I[l] <=  model.X[l]*1000000
        else:
            return pyo.Constraint.Skip
    model.RLineanacional = pyo.Constraint(model.Lineas, rule=RLineanacional)

    def RLineanacional2(model, l):
        if Lineas.loc[l-1, 'Estado'] == "Existente" and Lineas.loc[l-1, 'propiedad'] == "Nacional":
            return  model.F_I[l] >=  model.X[l]*10**-6
        else:
            return pyo.Constraint.Skip
    model.RLineanacional2 = pyo.Constraint(model.Lineas, rule=RLineanacional2)

    def RLineanacional3(model, l):
        if Lineas.loc[l-1, 'Estado'] == "Existente" and Lineas.loc[l-1, 'propiedad'] == "Internacional" : 
            return  model.F_I[l] ==  0
        else:
            return pyo.Constraint.Skip
    model.RLineanacional3 = pyo.Constraint(model.Lineas, rule=RLineanacional3)

    def RbloquearTxnacional(model, l):
        if Lineas.loc[l-1, 'Estado'] == "Existente" and Lineas.loc[l-1, 'propiedad'] == "Nacional" and bloquear_invtx_nacional== True:
            return  model.F_I[l] ==  0
        else:
            return pyo.Constraint.Skip
    model.RbloquearTxnacional = pyo.Constraint(model.Lineas, rule=RbloquearTxnacional)

    def R8(model, n, t):
      return model.delta[n,t] <= model.Dem[n,t]   
    model.R8 = pyo.Constraint(model.Nodos, model.Periodos,rule = R8)

    t_inicio_mes = df_tiempo.groupby(['year', 'month'])['t'].min().to_dict()
    t_fin_mes = df_tiempo.groupby(['year', 'month'])['t'].max().to_dict()
    t_to_mes = df_tiempo.set_index('t')[['year', 'month']].apply(tuple, axis=1).to_dict()

    def R16(model,n,t):
      return model.PBess[n,t] == model.D[n,t] - model.C[n,t]
    model.R16 = pyo.Constraint(model.Nodos, model.Periodos, rule = R16)

    def R17(model,n,t):
      return model.PBess[n,t] <= model.Pmax_BESS[n,t] + model.PBess_I[n]
    model.R17 = pyo.Constraint(model.Nodos, model.Periodos, rule = R17)

    def R18(model,n,t):
      return model.PBess[n,t] >= - model.Pmax_BESS[n,t] - model.PBess_I[n]
    model.R18 = pyo.Constraint(model.Nodos, model.Periodos, rule = R18)

    def R19(model,n,t):
      y_m = t_to_mes[t]  
      t_ini = t_inicio_mes[y_m]
      if t == t_ini:
        return model.EBess2[n,t] == model.EBess0[n,t] - (model.D[n,t] - model.C[n,t]*0.85)*1 -model.ver_bess[n,t]
      else:
        return model.EBess2[n,t] == model.EBess2[n,t-division] - (model.D[n,t] - model.C[n,t]*0.85)*1  -model.ver_bess[n,t]
    model.R19 = pyo.Constraint(model.Nodos, model.Periodos, rule = R19)

    def Rlast(model,n,t):
      y_m = t_to_mes[t] 
      t_ini = t_inicio_mes[y_m]
      t_fin = t_fin_mes[y_m]
      if t == t_fin:
        return model.EBess0[n,t_ini] == model.EBess2[n,t]
      else:
        return pyo.Constraint.Skip
    model.Rlast = pyo.Constraint(model.Nodos, model.Periodos, rule = Rlast)

    def R20(model,n,t):
        return model.EBess2[n,t] <=( model.Pmax_BESS[n,t] + model.PBess_I[n])*5
    model.R20 = pyo.Constraint(model.Nodos, model.Periodos, rule = R20)

    def B1(model,n,t):
        return model.D[n,t] <= model.Pmax_BESS[n,t] + model.PBess_I[n] 
    model.B1 = pyo.Constraint(model.Nodos,model.Periodos, rule = B1)

    def B2(model,n,t):
        return model.C[n,t] <= model.Pmax_BESS[n,t] +  model.PBess_I[n] 
    model.B2 = pyo.Constraint(model.Nodos,model.Periodos, rule = B2)

    def R21(model,n): return model.PBess_I[n] == 0
    model.R21 = pyo.Constraint(model.Nodos, rule = R21)

    def R23(model,n): return model.P_I[n] == 0
    def R24(model,n): return model.S_I[n] == 0
    def R25(model,n): return model.E_I[n] == 0
    if inversiones_gx  ==  'Sin_gx':
        model.R23 = pyo.Constraint(model.Convencionales, rule = R23) 
        model.R24 = pyo.Constraint(model.Solares, rule = R24) 
        model.R25 = pyo.Constraint(model.Eolicas, rule = R25) 

    def R22(model,l):
        return model.F_I[l] == 0
    if transmision == 'a':
        model.R22 = pyo.Constraint(model.Lineas, rule = R22)

    def R27(model,h,t):
        return model.H_P[h, t] <=  model.Pmax_H[h,t] *(model.PerfilMesHP[h,t]/(GeneradoresH_P.loc[h-1,'Capacidad instalada (MW)'] *732 if GeneradoresH_P.loc[h-1,'Capacidad instalada (MW)'] >0 else 1))   
    model.R27 = pyo.Constraint(model.Hidraulicas_P, model.Periodos, rule = R27)

    def R29(model,h,t):
        return model.H_E[h,t] <= GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)'] *(model.PerfilMesHE[h,t]/(GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']*732 if GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']>0 else 1 ))
    model.R29 = pyo.Constraint(model.Hidraulicas_E, model.Periodos, rule = R29)

    t_inicio_mes = df_tiempo.groupby(['year', 'month'])['t'].min().to_dict()
    t_fin_mes = df_tiempo.groupby(['year', 'month'])['t'].max().to_dict()
    t_to_mes = df_tiempo.set_index('t')[['year', 'month']].apply(tuple, axis=1).to_dict()

    def R_balance_energia_embalse(model, h, t):
        y_m = t_to_mes[t]  
        t_ini = t_inicio_mes[y_m]
        if t == t_ini:
            return model.E_almacenada2[h, t] == model.E_almacenada_ini[h,t]  - model.H_E[h, t]+ GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']*(model.PerfilMesHE[h,t]/(GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']*732 if GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']>0 else 1))-model.ver_dam[h,t]
        else:
            return model.E_almacenada2[h, t] ==  model.E_almacenada2[h, t - division] - model.H_E[h, t] +  GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']*(model.PerfilMesHE[h,t]/(GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']*732 if GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']>0 else 1))-model.ver_dam[h,t]
    model.R_balance_energia_embalse = pyo.Constraint(model.Hidraulicas_E, model.Periodos, rule=R_balance_energia_embalse)

    def R_embalse_ver(model, h, t):
        return model.ver_dam[h,t] <= GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']*(model.PerfilMesHE[h,t]/(GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']*732 if GeneradoresH_E.loc[h-1,'Capacidad instalada (MW)']>0 else 1))
    model.R_embalse_ver = pyo.Constraint(model.Hidraulicas_E, model.Periodos, rule=R_embalse_ver)

    def R_balance_energia_embalse_borde(model, h, t):
        y_m = t_to_mes[t]  
        t_ini = t_inicio_mes[y_m]
        t_fin = t_fin_mes[y_m]

        if t == t_ini:
            return model.E_almacenada_ini[h,t] == model.E_almacenada2[h, t_fin]
        else:
            return pyo.Constraint.Skip
    model.R_balance_energia_embalse_borde = pyo.Constraint(model.Hidraulicas_E, model.Periodos, rule=R_balance_energia_embalse_borde)

    def agregar_restriccion_energia_mensual_embalse(model, df_tiempo):
        model.R_energia_mensual_embalse = pyo.ConstraintList()
        t_por_mes = df_tiempo.groupby(['year', 'month'])['t'].apply(list).to_dict()
        for h in model.Hidraulicas_E:
            for (y, m), t_list in t_por_mes.items():
                t_validos = [t for t in t_list if (h, t) in model.H_E]
                if not t_validos: continue
                t_representativo = t_validos[0]
                model.R_energia_mensual_embalse.add(sum(model.H_E[h, t] for t in t_validos) <= model.PerfilMesHE[h, t_representativo])
    agregar_restriccion_energia_mensual_embalse(model, df_tiempo)

    def R1(model, n, t):
        return (
            sum(model.P[g,t]     for g  in model.gen_conv_en_barra[n]) +
            model.PBess[n,t] +  
            sum(model.S[s,t]     for s  in model.gen_solares_en_barra[n]) +
            sum(model.E[e,t]     for e  in model.gen_eolicas_en_barra[n]) +
            sum(model.H_E[h,t]   for h  in model.gen_HE_en_barra[n]) +
            sum(model.H_P[h,t]   for h  in model.gen_HP_en_barra[n]) +
            sum(model.F[l,t]     for l  in model.lineas_entrantes_barra[n]) -
            sum(model.F[l,t]     for l  in model.lineas_salientes_barra[n]) +
            sum(model.Bio[g,t]   for g  in model.gen_bioenergy_en_barra[n]) +
            sum(model.Geo[g,t]   for g  in model.gen_geoenergy_en_barra[n]) +
            sum(model.Nu[nu,t]   for nu in model.gen_nucleares_en_barra[n]) +
            model.delta[n,t]                  
            - model.SG[n,t]                   
            ==
            model.Dem[n,t]  
            )
    model.R1 = pyo.Constraint(model.Nodos, model.Periodos, rule = R1)

    def Sin_interconexiones_existentes(model,l,t):
        if ((Lineas.loc[l-1, 'propiedad'] == 'Internacional' ) ) :
            return model.F[l,t] == 0
        else:
            return pyo.Constraint.Skip
            
    print('Modelo cargado!-', datetime.now().time())
    return model

model = construir_modelo(
    inversiones_gx=inversiones_gx,
    transmision=inversiones_transmision,
    escenario=escenario_ejecucion,
    sincarbonCL=sincarbonCL,
    escenario_comb=costo_combustible,
    bloquear_invtx_nacional=bloquear_invtx_nacional,
    bloquear_invtx_existenteinternacional=bloquear_invtx_existenteinternacional,
    flux0_internacional_candidata=flux0_internacional_candidata,
    ordendemerito=ordendemerito,
    max_lineasBINARIAS_tx=max_lineasBINARIAS_tx
)
print('Construyendo modelo...')
print('Modelo construido. Resolviendo...')

if ordendemerito and escenario_ejecucion == 'S1':
    if hasattr(model, "X_LN"):
        if linea_obj_id is not None:
            print(f'Fijando variables X_LN: linea {linea_obj_id} = 1, resto = 0...')
            for l in model.Lineas:
                model.X_LN[l].fix(0)
            if linea_obj_id in model.Lineas:
                model.X_LN[linea_obj_id].fix(1)
                print(f"Línea {linea_obj_id} fijada en 1.")
            else:
                print(f" linea_obj={linea_obj_id} no está en model.Lineas")
        else:
            print('Sin linea objetivo especificada. El solver elegirá la mejor interconexión.')
    else:
        print("El modelo no tiene la variable X_LN.")

solver = pyo.SolverFactory('appsi_highs')
solver.config.time_limit = 600
solver.config.mip_gap = 0.01
solver.config.load_solution = False
results = solver.solve(model, tee=True)
from pyomo.opt import TerminationCondition
tc = results.solver.termination_condition
print(f"Termination condition: {tc}")
if tc in (TerminationCondition.optimal, TerminationCondition.feasible):
    model.solutions.load_from(results)
    results.write()
else:
    results.write()
    raise RuntimeError(f"Solver did not find a feasible solution. Termination: {tc}")

import os
from pyomo.core.base.transformation import TransformationFactory

# =================== COSTOS MARGINALES ===================
print("Iniciando calculo de Costos Marginales...")
caso = "Resultados"
# directorio ya definido globalmente
# --- 1) Clonar
m_lp = model.clone()

# --- 2) Fijar TODAS las variables enteras/binarias que existan (robusto)
fixed_cnt = 0
for v_lp in m_lp.component_data_objects(pyo.Var, active=True, descend_into=True):
    if (v_lp.is_binary() or v_lp.is_integer()) and (not v_lp.fixed):

        # 1) intenta traer el valor del modelo original por nombre
        val = None
        try:
            v_orig = model.find_component(v_lp.name)
            val = pyo.value(v_orig, exception=False)
        except Exception:
            pass

        # 2) si no existe en el original o sigue siendo None, intenta el del clonado
        if val is None:
            val = pyo.value(v_lp, exception=False)

        # 3) fallback razonable si aún es None
        if val is None:
            if v_lp.is_binary():
                lb = pyo.value(v_lp.lb) if v_lp.has_lb() else 0
                ub = pyo.value(v_lp.ub) if v_lp.has_ub() else 1
                val = 1.0 if (lb == 1 and ub == 1) else 0.0
            else:
                val = pyo.value(v_lp.lb) if v_lp.has_lb() else 0.0

        # 4) fija (entera/binaria) al entero más cercano
        v_lp.fix(int(round(val)))
        fixed_cnt += 1

print(f"[fix] Variables enteras/binarias fijadas: {fixed_cnt}")

# --- 3) Relajar integridad por si quedó alguna entera
TransformationFactory('core.relax_integer_vars').apply_to(m_lp)

# --- 4) Verificación
left_discrete = []
for v in m_lp.component_data_objects(pyo.Var, active=True, descend_into=True):
    if (v.is_binary() or v.is_integer()) and not v.fixed:
        left_discrete.append(v.name)
if left_discrete:
    print("Aun quedan enteras sin fijar/relajar:")

# --- 5) Resolver el LP y pedir duales
if hasattr(m_lp, 'dual'):
    m_lp.del_component(m_lp.dual)
m_lp.dual = pyo.Suffix(direction=pyo.Suffix.IMPORT)

res_lp = solver.solve(m_lp, tee=True)
print("LP status:", res_lp.solver.termination_condition)

# --- 6) Construir DataFrame de duales de R1 manualmente ---
nodos = list(m_lp.Nodos)
tiempos = list(m_lp.Periodos)
df_dual = pd.DataFrame(index=tiempos, columns=nodos, dtype=float)
df_dual.loc[:, :] = np.nan

constr_balance = getattr(m_lp, 'R1', None)
if constr_balance is None:
    print("No encuentro la restricción de balance 'R1' en el modelo LP.")
else:
    for n in nodos:
        for t in tiempos:
            if (n, t) in constr_balance:
                cdata = constr_balance[n, t]
                val = m_lp.dual.get(cdata, np.nan)
                try:
                    df_dual.at[t, n] = float(val)
                except (TypeError, ValueError):
                    df_dual.at[t, n] = np.nan

# Etiquetas de columnas para df_dual
try:
    # df_Nodos index is 0-based, nodos are 1-based (from Pyomo)
    # Save the node names map for JSON exporting mapped by country
    map_nodos_nombres = {i: df_Nodos.loc[i-1, 'nombre'] for i in nodos}
    df_dual.columns = [f"Barra {df_Nodos.loc[i-1,'nombre']}" for i in nodos]
except Exception:
    df_dual.columns = [f"Barra {i}" for i in nodos]
    map_nodos_nombres = {i: str(i) for i in nodos}

df_dual.index.name = "Hora"

out_cm = os.path.join(directorio, f"Costo_marginal_{caso}.xlsx")
if df_dual.notna().sum().sum() > 0:
    df_dual.to_excel(out_cm, index=True)
    print(f"Duales exportados a: {out_cm}")

# =================== FIN COSTOS MARGINALES (LP garantizado) ===================

# --- Export duals to JSON for frontend
try:
    # We want a format: { country: { node: [cm1, cm2] }, time_steps: [...] }
    mc_json = { "time_steps": tiempos, "countries": {} }
    
    # map_nodos_nombres maps pyomo node index to node name (e.g. 1 -> "CL_NORTE")
    for i in nodos:
        node_name = map_nodos_nombres.get(i, str(i))
        # Find country for this node
        pais = "Unknown"
        filtro_pais = df_Nodos[df_Nodos["nombre"] == node_name]
        if not filtro_pais.empty:
            pais = filtro_pais.iloc[0]["pais"]
            
        if pais not in mc_json["countries"]:
            mc_json["countries"][pais] = {}
        
        # Columna en df_dual is either "Barra {node_name}" or "Barra {i}"
        col_name = f"Barra {node_name}"
        if col_name not in df_dual.columns:
            col_name = f"Barra {i}"
        
        if col_name in df_dual.columns:
            # fillna with None instead of string 'None' so it gets serialized cleanly to null
            vals = df_dual[col_name].replace({np.nan: None}).tolist()
            mc_json["countries"][pais][node_name] = vals

    mc_json_path = os.path.join(directorio, 'marginal_costs.json')
    with open(mc_json_path, 'w') as f:
        json.dump(mc_json, f)
    print(f"marginal_costs.json created successfully in {mc_json_path}")
except Exception as e:
    print(f"Could not export marginal costs JSON: {e}")

# ==================== GENERATION RESULTS EXTRACTION ====================

def extraer_resultados_modelo_custom(model):
    def crear_df(dict_results):
        import pandas as pd
        if not dict_results: return pd.DataFrame()
        # Ensure values are not None
        valid_dict = {k: v for k, v in dict_results.items() if v is not None}
        if not valid_dict: return pd.DataFrame()
        
        df = pd.DataFrame(pd.Series(valid_dict)).reset_index()
        if len(df.columns) < 2: return pd.DataFrame()
        try:
             df = df.set_index('level_1').pivot(columns='level_0')
             df.columns = df.columns.droplevel(0) # Remove top level added by pivot
             return df
        except Exception as e:
            print(f"Error structuring DF: {e}")
            return pd.DataFrame()

    print("Extracting detailed generation results...")
    
    def get_vals(component):
        if hasattr(model, component):
            v = getattr(model, component).get_values()
            return v if v else {}
        return {}

    # Extract raw results
    results_P = get_vals('P')
    results_S = get_vals('S')
    results_E = get_vals('E')
    print(f"EXTRACTION LOG: P={len(results_P)}, S={len(results_S)}, E={len(results_E)}")
    
    results_Bio = get_vals('Bio')
    results_Geo = get_vals('Geo')
    results_H_E = get_vals('H_E')
    results_H_P = get_vals('H_P')
    results_Nu = get_vals('Nu')
    print(f"EXTRACTION LOG: Bio={len(results_Bio)}, Geo={len(results_Geo)}, HE={len(results_H_E)}, HP={len(results_H_P)}, Nu={len(results_Nu)}")
    
    results_delta = get_vals('delta')
    results_C_bess = get_vals('C')
    results_D_bess = get_vals('D')

    # BESS Carga/Descarga
    data_C_bess = crear_df(results_C_bess)
    if not data_C_bess.empty:
        # Use nodal index directly since model.Nodos is 1-indexed and df_Nodos is 0-indexed
        data_C_bess.columns = pd.MultiIndex.from_tuples([
            (df_Nodos.loc[col-1, 'nombre'], 'BESS Carga') for col in data_C_bess.columns
        ], names=['Nombre_nodo', 'Tecnología'])

    data_D_bess = crear_df(results_D_bess)
    if not data_D_bess.empty:
        data_D_bess.columns = pd.MultiIndex.from_tuples([
            (df_Nodos.loc[col-1, 'nombre'], 'BESS Descarga') for col in data_D_bess.columns
        ], names=['Nombre_nodo', 'Tecnología'])
    
    data_bess = pd.concat([-data_C_bess, data_D_bess], axis=1) if not data_C_bess.empty or not data_D_bess.empty else pd.DataFrame()

    # Conventional
    data_Conv = crear_df(results_P)
    if not data_Conv.empty:
        data_Conv.columns = pd.MultiIndex.from_tuples([
            (GeneradoresC.loc[col-1, 'Nombre_nodo'], GeneradoresC.loc[col-1, 'Tecnología']) for col in data_Conv.columns
        ])

    # Solares
    data_S = crear_df(results_S)
    if not data_S.empty:
        data_S.columns = pd.MultiIndex.from_tuples([
            (GeneradoresS.loc[col-1, 'Nombre_nodo'], 'Solar') for col in data_S.columns
        ])

    # Eólicas
    data_E = crear_df(results_E)
    if not data_E.empty:
        data_E.columns = pd.MultiIndex.from_tuples([
            (GeneradoresE.loc[col-1, 'Nombre_nodo'], 'Eolica') for col in data_E.columns
        ])

    # Bioenergía
    data_Bio = crear_df(results_Bio)
    if not data_Bio.empty:
        data_Bio.columns = pd.MultiIndex.from_tuples([
            (GeneradoresB.loc[col-1, 'Nombre_nodo'], 'Bioenergía') for col in data_Bio.columns
        ])

    # Geotérmica
    data_Geo = crear_df(results_Geo)
    if not data_Geo.empty:
        data_Geo.columns = pd.MultiIndex.from_tuples([
            (GeneradoresGeo.loc[col-1, 'Nombre_nodo'], 'Geotérmica') for col in data_Geo.columns
        ])

    # Hydro Embalse
    data_H_E = crear_df(results_H_E)
    if not data_H_E.empty:
        data_H_E.columns = pd.MultiIndex.from_tuples([
            (GeneradoresH_E.loc[col-1, 'Nombre_nodo'], 'Hydro Embalse') for col in data_H_E.columns
        ])

    # Hydro Pasada
    data_H_P = crear_df(results_H_P)
    if not data_H_P.empty:
        data_H_P.columns = pd.MultiIndex.from_tuples([
            (GeneradoresH_P.loc[col-1, 'Nombre_nodo'], 'Hydro Pasada') for col in data_H_P.columns
        ])

    # Nuclear
    data_Nu = crear_df(results_Nu)
    if not data_Nu.empty:
        data_Nu.columns = pd.MultiIndex.from_tuples([
            (GeneradoresN.loc[col-1, 'Nombre_nodo'], 'Nuclear') for col in data_Nu.columns
        ])

    # Loss Load
    data_LL = crear_df(results_delta)
    if not data_LL.empty:
        data_LL.columns = pd.MultiIndex.from_tuples([
            (df_Nodos.loc[col-1, 'nombre'], 'Loss Load') for col in data_LL.columns
        ])

    # Concat all
    dfs = [data_H_P, data_Bio, data_Geo, data_H_E, data_S, data_E, data_Nu, data_Conv, data_D_bess, data_C_bess, data_LL]
    dfs_to_concat = [d for d in dfs if not d.empty]
    if dfs_to_concat:
        data_gen = pd.concat(dfs_to_concat, axis=1)
        data_gen.columns.names = ['Nombre_nodo', 'Tecnología']
    else:
        data_gen = pd.DataFrame()
    
    return data_bess, data_gen

def agrupar_y_exportar_resultados(model, data_gen, data_bess):
    global caso, directorio
    print("Grouping results by country...")
    
    # Mapping Nodos to Paises
    # df_Nodos must be available globally
    map_nodos_a_pais = dict(zip(df_Nodos["nombre"], df_Nodos["pais"]))
    
    # Process Generation Data
    data_gen_csv = data_gen.copy()
    
    # The columns are MultiIndex (Node, Tech). We map Node -> Country
    # Level 0 is Node Name
    data_gen_csv.columns = pd.MultiIndex.from_tuples([
        (map_nodos_a_pais.get(nodo, nodo), tecnologia) 
        for nodo, tecnologia in data_gen_csv.columns
    ], names=['País', 'Tecnología'])

    # Group by Country and Tech
    data_gen_pais = data_gen_csv.groupby(level=['País', 'Tecnología'], axis=1).sum()

    # === Agrupar datos BESS por país ===
    data_bess_pais = pd.DataFrame()
    if not data_bess.empty:
        try:
            data_bess_csv = data_bess.copy()
            # Handle potential MultiIndex columns if extracted that way or Flat
            # Based on previous extraction, data_bess has MultiIndex columns (Node, Tech)
            nodos_existentes = data_bess_csv.columns.get_level_values(0).unique()
            map_nodos_a_pais_completo = {nodo: map_nodos_a_pais.get(nodo, nodo) for nodo in nodos_existentes}

            data_bess_csv.columns = pd.MultiIndex.from_tuples([
                (map_nodos_a_pais_completo[nodo], tecnologia) for nodo, tecnologia in data_bess_csv.columns
            ], names=['País', 'Tecnología'])

            data_bess_pais = data_bess_csv.groupby(level=['País', 'Tecnología'], axis=1).sum()
        except Exception as e:
            print(f"Error grouping BESS by country: {e}")


    # Process Demand Data
    try:
        # Use global variables T and division defined earlier in the script
        # Dem is also global
        
        # Filter Dem based on division as requested
        # Dem2 = Dem[Dem["t"].isin(list(range(1, T+1, division)))]
        # Ensure 't' column exists or index reset
        df_demanda = Dem.copy()
        
        # If 't' is not a column but index, reset it to check logic, or assume 't' column exists as per script context
        if 't' not in df_demanda.columns and df_demanda.index.name != 't':
            # Create 't' if missing? The user script implies Dem has "t"
            # In line 113: Set includes 't'
            pass
            
        # Apply filtering
        # Check if globals exist in local scope, implicitly they should if defined at module level
        # If T and division are not passed as args, we rely on scope.
        # To be safe/explicit or if this function were moved, we might need them passed.
        # But since this is a script, globals work.
        
        # T and division are ints defined at top level
        df_demanda = df_demanda[df_demanda["t"].isin(list(range(1, T+1, division)))]
        
        # If 't' was used for filtering, now drop it for plotting/grouping
        # user code: 
        # df_demanda = df_demanda.drop(columns='t', errors='ignore') 
        # df_demanda.columns = [map_nodos_a_pais.get(n, n) for n in df_demanda.columns]
        
        nodos_demanda = df_demanda.columns.drop(['t', 'time'], errors='ignore')
        map_nodos_a_pais_completo = {nodo: map_nodos_a_pais.get(nodo, nodo) for nodo in nodos_demanda}
        
        # Set index to 't' or just reset? The chart expects time steps.
        # The generation data uses 1...N index.
        # If we drop 't', index remains.
        # Let's align with generation index.
        
        # Drop non-node columns for grouping
        df_to_group = df_demanda.drop(columns=['t', 'time'], errors='ignore')
        
        # Map columns
        df_to_group.columns = [map_nodos_a_pais_completo.get(col, col) for col in df_to_group.columns]
        
        # Group by Country
        df_demanda_pais = df_to_group.groupby(axis=1, level=0).sum()
        
    except Exception as e:
        print(f"Error processing demand: {e}")
        import traceback
        traceback.print_exc()
        df_demanda_pais = pd.DataFrame()

    # --- EXCEL EXPORT ---
    try:
        print("Exporting specialized Excel files...")
        # Use existing global directorio and caso
        
        # Helper to export if not empty
        data_gen.to_excel(f"{directorio}/{caso}_data_gen.xlsx")
        data_bess.to_excel(f"{directorio}/{caso}_data_bess.xlsx")
        data_gen_pais.to_excel(f"{directorio}/{caso}_data_gen_pais.xlsx")
        data_bess_pais.to_excel(f"{directorio}/{caso}_data_bess_pais.xlsx")
        df_demanda_pais.to_excel(f"{directorio}/{caso}_df_demanda_pais.xlsx")
        print("Excel files exported successfully.")
    except Exception as e:
        print(f"Error exporting Excel files: {e}")

    # Prepare JSON structure
    # Structure:
    # {
    #   "time_steps": [1, 2, ...],
    #   "countries": {
    #       "CL": { 
    #           "generation": { "Solar": [1,2], "Eolica": [3,4] ... },
    #           "demand": [10, 11...]
    #       },
    #       ...
    #   }
    # }
    
    output_json = {
        "time_steps": list(data_gen_pais.index),
        "countries": {}
    }
    
    unique_countries = data_gen_pais.columns.get_level_values(0).unique()
    
    for pais in unique_countries:
        pais_data = {
            "generation": {},
            "demand": []
        }
        
        # Generation by tech
        df_p = data_gen_pais[pais] # DataFrame with columns = Techs
        for tech in df_p.columns:
            # Handle float32/64 serialization
            pais_data["generation"][tech] = df_p[tech].tolist()
            
        # Demand
        if not df_demanda_pais.empty and pais in df_demanda_pais.columns:
            pais_data["demand"] = df_demanda_pais[pais].tolist()
            
        output_json["countries"][str(pais)] = pais_data

    # --- ENERGY SUMMARY TABLE (TWh) ---
    try:
        print("Generating Energy Summary Table (TWh)...")

        def generar_tabla_resumen_energia(Dem2_arg, data_gen_arg, div=1, ruta_excel='', caso_str=''):
            nodos = df_Nodos["nombre"].tolist()
        
            # DEMANDA total por nodo
            df_demanda_nodos = Dem2_arg[nodos]
            demanda_TWh_nodo = df_demanda_nodos.sum() / 1000  # GWh -> TWh
        
            # GENERACIÓN total por nodo
            data_gen_csv = data_gen_arg.copy()
            generacion_TWh_nodo = data_gen_csv.groupby(axis=1, level=0).sum().sum() / 1000  # GWh -> TWh
        
            # Combinar en tabla
            tabla_resumen_tmp = pd.DataFrame({
                "DEMANDA (TWh)": demanda_TWh_nodo,
                "GX (TWh)": generacion_TWh_nodo
            })
        
            # Total general
            fila_total = pd.DataFrame(tabla_resumen_tmp.sum()).T
            fila_total.index = ["Total_TWh"]
            tabla_resumen_tmp = pd.concat([tabla_resumen_tmp, fila_total])
        
            # Tecnologías clave para desagregar
            tecnologias = [
                'Loss Load', 'Solar', 'Eolica', 'Nuclear', 'Bioenergía', 'Geotérmica', 'Hydro Embalse',
                'Hydro Pasada', 'Carbón', 'Gas CC', 'Gas CA', 'Diesel', 'BESS Descarga'
            ]
        
            for tecnologia in tecnologias:
                if tecnologia in data_gen_csv.columns.get_level_values(1):
                    valores = data_gen_csv.xs(tecnologia, level=1, axis=1).sum() / 1000  # GWh -> TWh
                else:
                    valores = pd.Series(0, index=demanda_TWh_nodo.index)
                valores.name = f"{tecnologia} (TWh)"
                tabla_resumen_tmp = tabla_resumen_tmp.join(valores, how="left")
                tabla_resumen_tmp.loc["Total_TWh", f"{tecnologia} (TWh)"] = valores.sum()
        
            # Ajuste por división horaria y conversión MWh -> TWh
            tabla_resumen_tmp = tabla_resumen_tmp * div / 1000
        
            # Orden de países
            orden = df_Nodos["nombre"].tolist() + ["Total_TWh"]  
            tabla_resumen_tmp.index = pd.CategoricalIndex(tabla_resumen_tmp.index, categories=orden, ordered=True)
            tabla_resumen_tmp = tabla_resumen_tmp.sort_index()
        
            # Exportar a Excel (Ensure it matches expected name)
            tabla_resumen_tmp.to_excel(ruta_excel + '/' + caso_str + '_tabla_resumen_energia.xlsx')
        
            return tabla_resumen_tmp

        Dem2 = Dem.copy()
        if 't' in Dem2.columns: Dem2 = Dem2.set_index('t')
        Dem2 = Dem2.loc[Dem2.index.isin(list(range(1, T+1, division)))]
        # Filter columns to only Nodos
        nodos_names = df_Nodos["nombre"].tolist()
        Dem2 = Dem2[[c for c in Dem2.columns if c in nodos_names]]

        tabla_resumen = generar_tabla_resumen_energia(Dem2, data_gen, division, ruta_excel=directorio, caso_str=caso)
        
        # Add to JSON output for frontend display
        # We need this by Country to show in the chart modal or a separate modal.
        # The user said "option additional... to show energy summary".
        # We can structure it: { "countries_energy": { "CL": { "Solar (TWh)": 123, ... } } }
        
        # Group summary by Country
        # tabla_resumen has index=Node (and Total_TWh).
        # We Map Node -> Country.
        
        map_nodos_a_pais = dict(zip(df_Nodos["nombre"], df_Nodos["pais"]))
        
        # Filter out Total row for grouping
        df_nodes_only = tabla_resumen.drop("Total_TWh", errors='ignore')
        df_nodes_only['Country'] = df_nodes_only.index.map(map_nodos_a_pais)
        
        # Group by Country
        df_energy_country = df_nodes_only.groupby('Country').sum()
        
        # Add to output_json
        output_json["energy_summary"] = df_energy_country.to_dict(orient='index')
        
    except Exception as e:
        print(f"Error generating summary table: {e}")
        import traceback
        traceback.print_exc()


    # Save to JSON
    try:
        import json
        gen_results_path = os.path.join(directorio, 'generation_results.json')
        
        def json_serializable(obj):
            if isinstance(obj, (np.integer, np.int64)): return int(obj)
            if isinstance(obj, (np.floating, np.float64)): return float(obj)
            if isinstance(obj, np.ndarray): return obj.tolist()
            if isinstance(obj, dict): return {str(k): json_serializable(v) for k, v in obj.items()}
            if isinstance(obj, (list, tuple)): return [json_serializable(x) for x in obj]
            return obj

        with open(gen_results_path, 'w') as f:
            json.dump(json_serializable(output_json), f)
        print(f"generation_results.json created successfully in {gen_results_path}")
    except Exception as e:
        print(f"Error saving generation_results.json: {e}")

# Execute the logic
try:
    if hasattr(model, 'P'): # Check if model solved
        print(f"DEBUG: Model has P variable. Starting extraction logic for folder {directorio}")
        # Extract
        data_bess_full, data_gen_full = extraer_resultados_modelo_custom(model)
        
        print(f"DEBUG: Extraction complete. data_gen_full is empty? {data_gen_full.empty}")
        if not data_gen_full.empty:
            print(f"DEBUG: data_gen_full shape: {data_gen_full.shape}")
            # Group and Export
            agrupar_y_exportar_resultados(model, data_gen_full, data_bess_full)
            
            # Use user's plot function
            try:
                # We need to calculate country dataframes for the plot
                map_nodos_a_pais = dict(zip(df_Nodos["nombre"], df_Nodos["pais"]))
                data_gen_csv = data_gen_full.copy()
                data_gen_csv.columns = pd.MultiIndex.from_tuples([
                    (map_nodos_a_pais.get(nodo, nodo), tecnologia) for nodo, tecnologia in data_gen_csv.columns
                ], names=['País', 'Tecnología'])
                data_gen_pais = data_gen_csv.groupby(level=['País', 'Tecnología'], axis=1).sum()
                
                # Demand
                df_demanda = Dem.copy()
                df_demanda = df_demanda[df_demanda["t"].isin(list(range(1, T+1, division)))]
                df_to_group = df_demanda.drop(columns=['t', 'time'], errors='ignore')
                df_to_group.columns = [map_nodos_a_pais.get(col, col) for col in df_to_group.columns]
                df_demanda_pais = df_to_group.groupby(axis=1).sum()

                # Call plotting
                print("Generating generation plots...")
                plot_generacion_por_pais(data_gen_pais, df_demanda_pais, directorio, caso)
            except Exception as plot_err:
                print(f"Plotting skipped/failed: {plot_err}")
                
        else:
            print("No generation data extracted.")
            
except Exception as e:
    print(f"FATAL ERROR in generation extraction: {e}")
    import traceback
    traceback.print_exc()

def plot_generacion_por_pais(df_total, df_demanda, directorio_, caso, max_paises=6):
    colores_tecnologias = {
        'Eolica': '#388E3C', 'Gas CA': '#A93226', 'Gas CC': '#7B241C', 'Solar': '#F4D03F',
        'Carbón': '#000000', 'Diesel': '#808080', 'Nuclear': '#1F618D', 'Bioenergía': '#A9DFBF',
        'Geotérmica': '#E74C3C', 'Hydro Pasada': '#5DADE2', 'Hydro Embalse': '#3498DB',
        'BESS Descarga': '#00BCD4', 'BESS Carga': '#ADD8E6', 'Loss Load': '#2F4F4F', 'Demanda': 'black'
    }
    orden_tecnologias = [
        'Hydro Pasada', 'Bioenergía', 'Geotérmica', 'Hydro Embalse', 'Solar', 'Eolica',
        'Nuclear', 'Carbón', 'Gas CC', 'Gas CA', 'Diesel', 'BESS Descarga', 'Loss Load'
    ]
    paises = df_total.columns.get_level_values('País').unique()[:max_paises]
    if len(paises) == 0: return
    fig, axs = plt.subplots(len(paises), 1, figsize=(16, 5 * len(paises)), sharex=True)
    if len(paises) == 1: axs = [axs]
    for i, pais in enumerate(paises):
        df_pais = df_total[pais].fillna(0)
        tp = [t for t in orden_tecnologias if t in df_pais.columns]
        if tp:
            axs[i].stackplot(df_pais.index, df_pais[tp].values.T, labels=tp, colors=[colores_tecnologias.get(t, 'gray') for t in tp])
        if 'BESS Carga' in df_pais.columns:
            axs[i].stackplot(df_pais.index, -df_pais[['BESS Carga']].values.T, labels=['BESS Carga'], colors=[colores_tecnologias['BESS Carga']])
        if pais in df_demanda.columns:
            axs[i].plot(df_demanda.index, df_demanda[pais], linestyle='--', color='black', label='Demanda', linewidth=2)
        axs[i].set_title(f"Generación en {pais}"), axs[i].set_ylabel("MW"), axs[i].grid(True), axs[i].legend(loc='upper left')
    plt.xlabel("Hora"), plt.tight_layout()
    plot_path = os.path.join(directorio_, f"Plot_Generation_Summary_{caso}.png")
    plt.savefig(plot_path)
    plt.close()
    print(f"Plot saved to {plot_path}")

def generar_tabla_inversiones_modelo(model, df_Nodos, GeneradoresC, GeneradoresS, GeneradoresE, df_tiempo):
    global caso, directorio
    t_min = min(model.Periodos)

    def get_value(x):
        return x.value if hasattr(x, "value") else x

    try:
        df_conv = pd.DataFrame([
            {
                "Nodo": GeneradoresC.loc[g - 1, "Nombre_nodo"],
                "Tecnología": GeneradoresC.loc[g - 1, "Tecnología"],
                "MW": get_value(model.P_I[g]),
                "Costo_unitario": model.G_CostInversion[g, t_min]*division,
            }
            for g in model.P_I
        ])
        df_conv["Costo_total_USD"] = df_conv["MW"] * df_conv["Costo_unitario"]
        df_conv = df_conv[~df_conv["Tecnología"].isin(["Carbón", "Diesel"])]
    except: df_conv = pd.DataFrame()

    try:
        df_solar = pd.DataFrame([
            {
                "Nodo": GeneradoresS.loc[s - 1, "Nombre_nodo"],
                "Tecnología": "Solar",
                "MW": get_value(model.S_I[s]),
                "Costo_unitario": model.G_CostInversionS[s, t_min]*division,
            }
            for s in model.S_I
        ])
        df_solar["Costo_total_USD"] = df_solar["MW"] * df_solar["Costo_unitario"]
    except: df_solar = pd.DataFrame()

    try:
        df_eolica = pd.DataFrame([
            {
                "Nodo": GeneradoresE.loc[e - 1, "Nombre_nodo"],
                "Tecnología": "Eolica",
                "MW": get_value(model.E_I[e]),
                "Costo_unitario": model.G_CostInversionE[e, t_min]*division,
            }
            for e in model.E_I
        ])
        df_eolica["Costo_total_USD"] = df_eolica["MW"] * df_eolica["Costo_unitario"]
    except: df_eolica = pd.DataFrame()

    try:
        df_bess = pd.DataFrame([
            {
                "Nodo": df_Nodos.loc[n - 1, "nombre"],
                "Tecnología": "BESS",
                "MW": get_value(model.PBess_I[n]),
                "Costo_unitario": model.G_CostInversionBESS[n, t_min]*division,
            }
            for n in model.PBess_I
        ])
        df_bess["Costo_total_USD"] = df_bess["MW"] * df_bess["Costo_unitario"]
    except: df_bess = pd.DataFrame()

    dfs = [d for d in [df_conv, df_solar, df_eolica, df_bess] if not d.empty]
    if not dfs: return pd.DataFrame()
    
    if dfs:
        df_inversiones = pd.concat(dfs, ignore_index=True)
    else:
        df_inversiones = pd.DataFrame()
    resumen = df_inversiones.groupby(["Nodo", "Tecnología"], observed=True).agg({
        "MW": "sum",
        "Costo_unitario": "first",
        "Costo_total_USD": "sum"
    }).reset_index()

    tabla_pivot = resumen.pivot(index="Nodo", columns="Tecnología", values=["MW", "Costo_unitario", "Costo_total_USD"])
    if tabla_pivot.empty: return tabla_pivot
    
    tabla_pivot.columns.names = ["Variable", "Tecnología"]
    orden_nivel0 = ["MW", "Costo_unitario", "Costo_total_USD"]
    tabla_pivot = tabla_pivot.reorder_levels([0, 1], axis=1).sort_index(axis=1)
    columnas_ordenadas = [col for cat in orden_nivel0 for col in tabla_pivot.columns if col[0] == cat]
    tabla_pivot = tabla_pivot[columnas_ordenadas]

    orden_nodos = df_Nodos["nombre"].tolist()
    tabla_pivot = tabla_pivot.reindex(orden_nodos)
    return tabla_pivot

def generar_tabla_inversiones_transmision(model, Lineas, CI_Tx=1):
    def get_value(x):
        try:
            val = x.value if hasattr(x, "value") else x
            return val if val is not None else 0
        except:
            return 0

    data = []
    # Identify which variable is being used for investment
    # 1. Binary investment (X_LN)
    # 2. Continuous investment (F_I)
    
    # We'll check which one has non-zero values or is generally intended
    # For robust extraction, we can look at both.
    
    indices = list(model.Lineas)
    for l in indices:
        try:
            # Check binary decision
            decision_bin = 0
            if hasattr(model, 'X_LN'):
                decision_bin = get_value(model.X_LN[l])
            
            # Check continuous investment
            inv_mw_cont = 0
            if hasattr(model, 'F_I'):
                inv_mw_cont = get_value(model.F_I[l])
            
            # Capacidad base
            fmax_nom = Lineas.loc[l - 1, 'Fmax directo (MW)']
            
            # Determinar inversión total en MW
            # Si es binaria, es decision * fmax_nom
            # Si es continua, es inv_mw_cont
            mw = 0
            # Priorizamos la que sea mayor a un umbral (con holgura)
            if decision_bin > 0.5:
                mw = fmax_nom
            elif inv_mw_cont > 0.001:
                mw = inv_mw_cont
            
            # Si no hay inversión en este arco, saltar? 
            # El usuario a veces quiere ver todos. Vamos a poner solo los que tienen inversión > 0
            if mw <= 0.001:
                continue

            nombre_linea = Lineas.loc[l - 1, 'Nombre']
            desde = Lineas.loc[l - 1, 'From_name'] if 'From_name' in Lineas.columns else Lineas.loc[l - 1, 'From']
            hacia = Lineas.loc[l - 1, 'To_name'] if 'To_name' in Lineas.columns else Lineas.loc[l - 1, 'To']
            from_node = Lineas.loc[l - 1, 'Nodo_ini']
            to_node = Lineas.loc[l - 1, 'Nodo_fin']
            Ci_Tx = Lineas.loc[l - 1, 'Costo de inversion (USD)']
            
            if pd.isna(Ci_Tx): Ci_Tx = 0
            
            # Columna específica para SIEPAC según pedido de usuario:
            # "Inversion total sin anualizar (MUSD)" de la hoja Lineas
            capex_siepac_musd = Lineas.loc[l - 1, 'Inversion total sin anualizar (MUSD)'] if 'Inversion total sin anualizar (MUSD)' in Lineas.columns else 0
            if pd.isna(capex_siepac_musd): capex_siepac_musd = 0
            
            data.append({
                "Nombre línea": nombre_linea,
                "Desde": desde,
                "Hacia": hacia,
                "From": from_node,
                "To": to_node,
                "inv_MW": mw,
                "Decision_Bin": decision_bin,
                "Inv_Cont_MW": inv_mw_cont,
                "Costo_unitario": Ci_Tx,
                "Costo_total_USD": mw * Ci_Tx if Ci_Tx > 0 else mw * CI_Tx,
                "Capex_SIEPAC_MUSD": capex_siepac_musd
            })
        except Exception as e:
            pass
            
    df_tx = pd.DataFrame(data)
    return df_tx

try:
    if hasattr(model, 'P_I'):
        print("Generating investment tables...")
        tabla_inversiones = generar_tabla_inversiones_modelo(model, df_Nodos, GeneradoresC, GeneradoresS, GeneradoresE, df_tiempo)
        out_file = f"{directorio}/{caso}_tabla_inversiones.xlsx"
        tabla_inversiones.to_excel(out_file)
        print(f"Investment table saved to {out_file}")
        
        # Save flat CSV/JSON for UI extraction easily:
        df_flat = tabla_inversiones["MW"].reset_index().fillna(0)
        df_flat.to_csv(f"{directorio}/{caso}_inversiones_mw.csv", index=False)
        
except Exception as e:
    print(f"Error extracting generation investments: {e}")

try:
    print("Exporting transmission investment tables...")
    # New robust function handles empty results and multiple var types
    tabla_tx = generar_tabla_inversiones_transmision(model, Lineas, CI_Tx=division)
    
    # Paths for both S0 and S1 scenarios
    excel_path = os.path.join(directorio, caso + '_tabla_inversiones_txBINARIA.xlsx')
    json_path = os.path.join(directorio, "tx_investment.json")
    
    # Save files ALWAYS to update timestamp and ensure consistency
    tabla_tx.to_excel(excel_path, index=False)
    tabla_tx.to_json(json_path, orient="records")
    print(f"Transmission investment files updated in {directorio}")
            
except Exception as e:
    print(f"Error extracting transmission investments: {e}")
    import traceback
    traceback.print_exc()


# ==================== EXPORT LOGIC ====================
print("Exporting results to JSON...")
# We use the original Lineas dataframe which might have new columns like delta_D
lineas_output = Lineas.copy()

# Try to add optimization results if available
if hasattr(model, 'F'):
   # Extract flow for period 1 as an example/snapshot
   # Note: model.Lineas is 1-based, Lineas df is 0-based
   try:
       flows = []
       for i in range(len(lineas_output)):
           # Period 1
           val = model.F[i+1, 1].value 
           flows.append(val)
       lineas_output['Flow_P1'] = flows
   except Exception as e:
       print(f"Could not extract flows: {e}")

   # Extract X_LN values (Binary expansion variables)
   if hasattr(model, 'X_LN'):
       try:
           x_ln_values = []
           for i in range(len(lineas_output)):
               # model.X_LN is 1-based
               val = model.X_LN[i+1].value
               # Handle None values (uninitialized variables) by defaulting to 0
               if val is None: val = 0
               x_ln_values.append(val)
           lineas_output['X_LN'] = x_ln_values
       except Exception as e:
           print(f"Could not extract X_LN: {e}")


# Extract full time series flows for plotting
try:
    if hasattr(model, 'F'):
        print("Extracting time series flows...")
        time_series_flows = {}
        # model.Periodos contains the time steps
        time_steps = [t for t in model.Periodos]
        import json
        
        for i in range(len(lineas_output)):
            # lineas_output is a DataFrame copy of Lineas
            line_name = lineas_output.iloc[i]['Nombre']
            
            if pd.isna(line_name): 
                line_name = f"Line_{i+1}"
            else: 
                line_name = str(line_name)
                
            flows_t = []
            for t in time_steps:
                val = model.F[i+1, t].value # model.F is indexed by (line_idx_1based, time)
                if val is None: val = 0
                flows_t.append(val)
            time_series_flows[line_name] = flows_t
        
        with open(os.path.join(directorio, 'flows_results.json'), 'w') as f:
            json.dump({'time_steps': time_steps, 'flows': time_series_flows}, f)
        print("flows_results.json created successfully.")
        
except Exception as e:
     print(f"Could not extract time series flows: {e}")

lineas_output.to_json(os.path.join(directorio, 'lines_processed.json'), orient='records')
print("lines_processed.json created successfully.")

import subprocess
import sys

try:
    print("Executing post-simulation extraction scripts to update all JSON files...")
    maintenance_dir = os.path.join(base_dir, "scripts", "maintenance")
    extract_gen_script = os.path.join(maintenance_dir, "extract_gen.py")
    extract_demand_script = os.path.join(maintenance_dir, "extract_demand.py")
    
    # Run Generation Extraction (including generators, storage, and revenues)
    print(f"Running {extract_gen_script}...")
    subprocess.run([sys.executable, extract_gen_script, directorio], check=True)
    
    # Run Demand Extraction
    print(f"Running {extract_demand_script}...")
    subprocess.run([sys.executable, extract_demand_script, directorio], check=True)
    
    print("All post-simulation extraction scripts completed successfully.")
except Exception as e:
    print(f"Error executing extraction scripts: {e}")
