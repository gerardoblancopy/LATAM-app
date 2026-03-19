import requests
import json

try:
    res = requests.get('http://localhost:8888/params')
    data = res.json()
    out = requests.post('http://localhost:8888/simulate', json=data)
    print(out.status_code)
    print(out.text[:500])
except Exception as e:
    print(e)
