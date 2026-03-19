
import json

try:
    with open('generation_results.json', 'r') as f:
        data = json.load(f)
        
    if "energy_summary" in data:
        print("Keys in energy_summary:", list(data["energy_summary"].keys()))
        # Print a sample entry
        sample_key = list(data["energy_summary"].keys())[0] if data["energy_summary"] else None
        if sample_key:
            print(f"Sample data for {sample_key}:", data["energy_summary"][sample_key])
            
    else:
        print("energy_summary key NOT found in JSON")
        
    if "countries" in data:
        print("Keys in countries:", list(data["countries"].keys()))

except Exception as e:
    print(f"Error: {e}")
