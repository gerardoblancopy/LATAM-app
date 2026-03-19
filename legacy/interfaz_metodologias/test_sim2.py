import requests
import json

try:
    res = requests.get('http://localhost:8888/params')
    data = res.json()
    out = requests.post('http://localhost:8888/simulate', json=data).json()
    print("Keys in response:", out.keys())
    if "cba_europa" in out:
        cba = out["cba_europa"]
        print("Keys in cba_europa:", cba.keys())
        print("Annual length:", len(cba.get("annual", [])))
        print("PV length:", len(cba.get("pv", [])))
        print("Summary Models length:", len(cba.get("summary_models", [])))
    else:
        print("cba_europa NOT in response")
except Exception as e:
    print("ERROR:", e)
