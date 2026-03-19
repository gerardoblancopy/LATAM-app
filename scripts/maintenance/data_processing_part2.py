
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

    def get_fmax_dynamic(df_tiempo, df_L, df_maxflow, col_fmax='Fmax directo (MW)'):
        df_maxflow_sorted = df_maxflow.sort_values(by=['time'])
        df_tiempo_sorted = df_tiempo.sort_values(by=['time'])
        Fmax_dict = {}
        for t, time in zip(df_tiempo_sorted['t'], df_tiempo_sorted['time']):
            for l in df_L.index:
                line_name = df_L.loc[l, 'Nombre']
                base_Fmax = df_L.loc[l, col_fmax]
                relevant_flows = df_maxflow_sorted[(df_maxflow_sorted['name'] == line_name) & (df_maxflow_sorted['time'] <= time)]
                if not relevant_flows.empty:
                    Fmax_dict[(l + 1, t)] = relevant_flows['value (MW)'].iloc[-1]
                else:
                    Fmax_dict[(l + 1, t)] = base_Fmax
        return Fmax_dict

    Fmax_dynamic = get_fmax_dynamic(df_tiempo, Lineas, df_max_flow, col_fmax='Fmax directo (MW)')
    model.Lineas_Tiempos = pyo.Set(dimen=2, initialize=Fmax_dynamic.keys())
    model.Fmax = pyo.Param(model.Lineas_Tiempos, initialize=Fmax_dynamic, within= pyo.NonNegativeReals, mutable=True)
    model.max_lineasBINARIAS_tx = pyo.Param(initialize= max_lineasBINARIAS_tx)

    Fmax_dynamic_inverse = get_fmax_dynamic(df_tiempo, Lineas, df_max_flow, col_fmax='Fmax inverso (MW)')
    model.Fmax_inverse = pyo.Param(model.Lineas_Tiempos, initialize=Fmax_dynamic_inverse, within= pyo.NonNegativeReals, mutable=True)

