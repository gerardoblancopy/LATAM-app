
    def get_pmax_dynamic(df_tiempo, df_gen, df_max_cap, col_nodo='Nombre_nodo', col_tecno='Tecnología', tecno_fija=None):
        df_max_cap_sorted = df_max_cap.sort_values(by='time')
        df_tiempo_sorted = df_tiempo.sort_values(by='time')
        Pmax_dict = {}
        for t, time in zip(df_tiempo_sorted['t'], df_tiempo_sorted['time']):
            for g in df_gen.index:
                nodo = df_gen.loc[g, col_nodo]
                tecno = tecno_fija if tecno_fija else df_gen.loc[g, col_tecno]
                base_Pmax = df_gen.loc[g, 'Capacidad instalada (MW)']
                relevant_caps = df_max_cap_sorted[
                    (df_max_cap_sorted['Nombre_nodo'] == nodo) &
                    (df_max_cap_sorted['Tecnología'] == tecno) &
                    (df_max_cap_sorted['time'] <= time)
                ]
                if not relevant_caps.empty:
                    Pmax_dict[(g + 1, t)] = relevant_caps['value_MW'].iloc[-1]
                else:
                    Pmax_dict[(g + 1, t)] = base_Pmax
        return Pmax_dict

    Pmax_dynamic_C = get_pmax_dynamic(df_tiempo.copy(), GeneradoresC, df_max_cap)
    model.GeneradoresC_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_C.keys())
    model.Pmax_C = pyo.Param(model.GeneradoresC_Tiempos, initialize=Pmax_dynamic_C, within=pyo.NonNegativeReals, mutable=True)

    Pmax_dynamic_E = get_pmax_dynamic(df_tiempo, GeneradoresE, df_max_cap)
    model.GeneradoresE_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_E.keys())
    model.Pmax_E = pyo.Param(model.GeneradoresE_Tiempos, initialize=Pmax_dynamic_E, within=pyo.NonNegativeReals, mutable=True)

    Pmax_dynamic_S = get_pmax_dynamic(df_tiempo, GeneradoresS, df_max_cap)
    model.GeneradoresS_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_S.keys())
    model.Pmax_S = pyo.Param(model.GeneradoresS_Tiempos, initialize=Pmax_dynamic_S, within=pyo.NonNegativeReals, mutable=True)

    Pmax_dynamic_H = get_pmax_dynamic(df_tiempo, GeneradoresH_P, df_max_cap)
    model.GeneradoresH_P_Tiempos = pyo.Set(dimen=2, initialize=Pmax_dynamic_H.keys())
    model.Pmax_H = pyo.Param(model.GeneradoresH_P_Tiempos, initialize=Pmax_dynamic_H, within=pyo.NonNegativeReals, mutable=True)

    Pmax_dynamic_BESS = get_pmax_dynamic(df_tiempo, AlmacenamientoBESS, df_max_cap, col_nodo='nombre', tecno_fija='BESS')
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
            sum(model.S_I[s] * model.G_CostInversionS[s, min(model.Periodos)] for s in model.Solares if GeneradoresS.loc[s-1,'Tecnología'] == 'Solar') +
            sum(model.E_I[e] * model.G_CostInversionE[e, min(model.Periodos)] for e in model.Eolicas if GeneradoresE.loc[e-1,'Tecnología'] == 'Eolico')
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
    def R23(model,n): return model.P_I[n] == 0
    def R24(model,n): return model.S_I[n] == 0
    def R25(model,n): return model.E_I[n] == 0
    if inversiones_gx  ==  'Sin_gx':
        model.R21 = pyo.Constraint(model.Nodos, rule = R21) 
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

model = construir_modelo()
print('Construyendo modelo...')
print('Modelo construido. Resolviendo...')

solver = pyo.SolverFactory('gurobi', solver_io = 'python')
solver.solve(model).write()

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

lineas_output.to_json('lines_processed.json', orient='records')
print("lines_processed.json created successfully.")
