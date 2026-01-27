import os
import json
import math
import random
import requests
import time

# --- Path & Config ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "..", "static", "locations.geojson")
PROXIMITY_THRESHOLD_KM = 10.0 

# Your Table
TYPE_MAP = {
    'solar': { 'code': "S", 'color': "#FFD700", 'renewable': True, 'cat': 'producer' },
    'wind': { 'code': "W", 'color': "#00BFFF", 'renewable': True, 'cat': 'producer' },
    'hydro': { 'code': "H", 'color': "#4169E1", 'renewable': True, 'cat': 'producer' },
    'nuclear': { 'code': "N", 'color': "#ADFF2F", 'renewable': True, 'cat': 'producer' },
    'biomass': { 'code': "B", 'color': "#32CD32", 'renewable': True, 'cat': 'producer' },
    'geothermal': { 'code': "G", 'color': "#F4A460", 'renewable': True, 'cat': 'producer' },
    'coal': { 'code': "C", 'color': "#8B4513", 'renewable': False, 'cat': 'producer' },
    'gas': { 'code': "G", 'color': "#FFA500", 'renewable': False, 'cat': 'producer' },
    'oil': { 'code': "O", 'color': "#FF4500", 'renewable': False, 'cat': 'producer' },
    'hospital': { 'code': "H+", 'color': "#FF0000", 'renewable': False, 'cat': 'consumer' },
    'police': { 'code': "P", 'color': "#1E90FF", 'renewable': False, 'cat': 'consumer' },
    'university': { 'code': "U", 'color': "#9370DB", 'renewable': False, 'cat': 'consumer' },
    'bank': { 'code': "B", 'color': "#2E8B57", 'renewable': False, 'cat': 'consumer' }
}

COUNTRIES = {'AE':'UAE','BH':'Bahrain','CY':'Cyprus','EG':'Egypt','IR':'Iran','IQ':'Iraq','IL':'Israel','JO':'Jordan','KW':'Kuwait','LB':'Lebanon','OM':'Oman','PS':'Palestine','QA':'Qatar','SA':'Saudi Arabia','SY':'Syria','TR':'Turkey','YE':'Yemen'}

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
]

HEADERS = {
    "User-Agent": "CompetitionProjectBot/1.0 (Educational Use)",
    "Content-Type": "application/x-www-form-urlencoded"
}

def is_too_close(lat1, lon1, existing_features):
    for f in existing_features:
        lon2, lat2 = f["geometry"]["coordinates"]
        R = 6371.0
        dphi, dlam = math.radians(lat2-lat1), math.radians(lon2-lon1)
        a = math.sin(dphi/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlam/2)**2
        if (R * 2 * math.asin(math.sqrt(a))) < PROXIMITY_THRESHOLD_KM: return True
    return False

def get_solar_profile(p): return [round(max(0, math.sin((h-6)*math.pi/12))*p, 2) for h in range(24)]
def get_wind_profile(p):
    vals, v = [], p*0.5
    for h in range(24):
        v = max(0.2*p, min(p, v + (random.random()-0.5)*(p*0.1)))
        vals.append(round(v, 2))
    return vals
def get_steady_profile(p): return [round(float(p), 2)] * 24
def get_demand_profile(p): return [round((0.4 + 0.4*math.exp(-((h-9)**2)/8) + 0.6*math.exp(-((h-19)**2)/12) - 0.2*math.exp(-((h-3)**2)/4))*p, 2) for h in range(24)]

def fetch_and_process():
    all_features = []
    print(" TEST !")
    if not os.path.exists(os.path.dirname(OUTPUT_FILE)): os.makedirs(os.path.dirname(OUTPUT_FILE))

    for iso, name in COUNTRIES.items():
        print(f"Processing {name}...")
        
        # Simplified query to reduce server stress
        query = f"""[out:json][timeout:90];area["ISO3166-1"="{iso}"]->.a;(node(a)["amenity"~"hospital|police|university|bank"];node(a)["power"~"plant|generator"];way(a)["power"~"plant|generator"];);out center;"""
        
        data = None
        for url in ENDPOINTS:
            try:
                response = requests.post(url, data={'data': query}, headers=HEADERS, timeout=100)
                if response.status_code == 200:
                    data = response.json()
                    break
                else:
                    print(f"  Endpoint {url} returned status: {response.status_code}")
            except Exception as e:
                continue
        
        if not data or 'elements' not in data:
            print(f"  Skipping {name}: No response from API.")
            continue

        producers, consumers = [], []
        for e in data['elements']:
            tags = e.get('tags', {})
            lat = e.get('lat') or e.get('center', {}).get('lat')
            lon = e.get('lon') or e.get('center', {}).get('lon')
            if not lat or not lon: continue

            fname = (tags.get('name:en') or tags.get('name') or "").lower()
            amenity = tags.get('amenity')
            stype = None
            
            if amenity in TYPE_MAP: stype = amenity
            else:
                gen_source = tags.get('generator:source', '').lower()
                for s in ['solar', 'wind', 'hydro', 'nuclear', 'biomass', 'geothermal', 'coal', 'gas', 'oil']:
                    if s in fname or s == gen_source:
                        stype = s; break
                if not stype and ("power" in tags or "plant" in tags): stype = 'gas'

            if not stype: continue
            
            item = {'lat': lat, 'lon': lon, 'stype': stype, 'tags': tags}
            if TYPE_MAP[stype]['cat'] == 'producer': producers.append(item)
            else: consumers.append(item)

        random.shuffle(producers)
        random.shuffle(consumers)

        p_added, c_added = 0, 0
        for item in (producers + consumers):
            info = TYPE_MAP[item['stype']]
            if info['cat'] == 'producer' and p_added >= 10: continue
            if info['cat'] == 'consumer' and c_added >= 15: continue
            if is_too_close(item['lat'], item['lon'], all_features): continue

            base_val = random.randint(30000, 60000) if info['cat'] == 'producer' else random.randint(1500, 5000)
            
            props = {
                'name': item['tags'].get('name:en') or item['tags'].get('name') or f"{item['stype'].capitalize()} {iso}",
                'type': info['cat'], 'sub_type': item['stype'], 'code': info['code'],
                'color': info['color'], 'renewable': info['renewable'], 'country': iso,
                'lat': item['lat'], 'lng': item['lon'],
                'prod_hourly': get_solar_profile(base_val) if item['stype'] == 'solar' else (get_wind_profile(base_val) if item['stype'] == 'wind' else get_steady_profile(base_val)) if info['cat'] == 'producer' else [0]*24,
                'dem_hourly': get_demand_profile(base_val) if info['cat'] == 'consumer' else [0]*24,
                'store': random.randint(2000, 10000)
            }
            all_features.append({"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [item['lon'], item['lat']]}})
            if info['cat'] == 'producer': p_added += 1
            else: c_added += 1

        print(f"  Added {p_added} P, {c_added} C.")
        time.sleep(2) # Increased pause to respect API

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump({"type": "FeatureCollection", "metadata": {"test_label": " TEST !"}, "features": all_features}, f, indent=4)
    print(f"\nSUCCESS: Created {len(all_features)} features.")

if __name__ == "__main__": 
    fetch_and_process()