import pandas as pd
df_gen = pd.read_excel('Resultados_data_gen.xlsx', header=[0, 1]).iloc[1:].reset_index(drop=True)
df_mc = pd.read_excel('Costo_marginal_Resultados.xlsx')

rev_dict = {}
for k in df_gen.columns:
    if isinstance(k, tuple) and len(k) >= 2:
        n, t = k
        cn = f"Barra {n}"
        if cn in df_mc.columns:
            gen_series = pd.to_numeric(df_gen[k], errors='coerce').fillna(0)
            mc_series = pd.to_numeric(df_mc[cn], errors='coerce').fillna(0)
            rev = (gen_series * mc_series).sum() * 100
            rev_dict[(str(n), str(t))] = float(rev)

print(list(rev_dict.items())[:5])
