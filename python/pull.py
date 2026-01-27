import os
import json
import math
import random
import requests
import time

# --- Robust Path Setup ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(BASE_DIR, "..", "static", "locations.geojson")

# INCREASED SPACING TO 10KM
PROXIMITY_THRESHOLD_KM = 10.0 

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
]

COUNTRIES = {
    'AE': 'UAE', 'BH': 'Bahrain', 'CY': 'Cyprus', 'EG': 'Egypt', 
    'IR': 'Iran', 'IQ': 'Iraq', 'IL': 'Israel', 'JO': 'Jordan', 
    'KW': 'Kuwait', 'LB': 'Lebanon', 'OM': 'Oman', 'PS': 'Palestine', 
    'QA': 'Qatar', 'SA': 'Saudi Arabia', 'SY': 'Syria', 'TR': 'Turkey', 'YE': 'Yemen'
}

TYPE_MAP = {
    'hospital': {'priority': 1, 'category': 'emergency'},
    'police': {'priority': 2, 'category': 'emergency'},
    'university': {'priority': 3, 'category': 'institution'},
    'bank': {'priority': 4, 'category': 'financial'},
    'plant': {'priority': 1, 'category': 'power'}
}

def is_too_close(lat1, lon1, existing_features):
    """Checks if a point is within 10km of ANY existing feature in the global list."""
    for feature in existing_features:
        lon2, lat2 = feature["geometry"]["coordinates"]
        R = 6371.0 
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        if (R * c) < PROXIMITY_THRESHOLD_KM:
            return True
    return False

def get_solar_profile(peak):
    return [round(max(0, math.sin((h - 6) * math.pi / 12)) * peak, 2) for h in range(24)]

def get_wind_profile(peak):
    profile, val = [], peak * 0.5
    for h in range(24):
        val += (random.random() - 0.5) * (peak * 0.1)
        val = max(0.2 * peak, min(peak, val))
        profile.append(round(val, 2))
    return profile

def get_steady_profile(peak):
    return [round(float(peak), 2)] * 24

def get_demand_profile(peak):
    profile = []
    for h in range(24):
        v = (0.4 + 0.4*math.exp(-((h-9)**2)/8) + 0.6*math.exp(-((h-19)**2)/12) - 0.2*math.exp(-((h-3)**2)/4))
        profile.append(round(v * peak, 2))
    return profile

def fetch_and_process():
    all_features = []
    output_dir = os.path.dirname(OUTPUT_FILE)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for iso, name in COUNTRIES.items():
        print(f"Fetching {name} (10km spacing rule active)...")
        # Querying broad range of tags to ensure we find enough power sources
        query = f"""
        [out:json][timeout:180];
        area["ISO3166-1"="{iso}"]->.searchArea;
        (
          node(area.searchArea)["amenity"~"hospital|police|university|bank"];
          node(area.searchArea)["power"~"plant|generator|station"];
          way(area.searchArea)["power"~"plant|generator|station"];
        );
        out center;
        """
        
        data = None
        for url in ENDPOINTS:
            try:
                response = requests.post(url, data={'data': query}, timeout=180)
                data = response.json()
                if data and 'elements' in data: break
            except: continue
        
        if not data or 'elements' not in data: continue

        # Separate pools
        eme_inst_pool = [e for e in data['elements'] if e.get('tags', {}).get('amenity') in ['hospital', 'police', 'university', 'bank']]
        power_pool = [e for e in data['elements'] if "power" in e.get('tags', {})]
        
        random.shuffle(eme_inst_pool)
        random.shuffle(power_pool)

        # Iterate through the pool and apply the strict 10km check
        # We try to get up to 15 services and 10 power sources per country to keep it spread out
        for el in (power_pool + eme_inst_pool):
            tags = el.get('tags', {})
            is_power = "power" in tags
            
            lat = el.get('lat') or el.get('center', {}).get('lat')
            lon = el.get('lon') or el.get('center', {}).get('lon')

            if lat is None or lon is None: continue

            # GLOBAL PROXIMITY CHECK (10KM)
            if is_too_close(lat, lon, all_features):
                continue

            # Limit count per country slightly to force geographic variety
            current_country_count = len([f for f in all_features if f['properties']['country'] == iso])
            if current_country_count >= 25: break

            key = tags.get('amenity') or 'plant'
            cfg = TYPE_MAP.get(key, {'priority': 5, 'category': 'power' if is_power else 'other'})
            
            base_prod = random.randint(15000, 45000) if is_power else 0
            base_dem = random.randint(800, 3000) if not is_power else 0
            
            full_name = (tags.get('name:en') or tags.get('name') or "").lower()
            source_type = 'thermal'
            for s in ['solar', 'wind', 'hydro', 'nuclear', 'geothermal', 'gas', 'oil']:
                if s in full_name:
                    source_type = s
                    break

            props = {
                'name': tags.get('name:en') or tags.get('name') or f"{iso} {key.capitalize()} {random.randint(1,99)}",
                'type': 'power' if is_power else cfg['category'],
                'sub_type': key,
                'source_type': source_type if is_power else None,
                'priority': cfg['priority'],
                'country': iso,
                'lat': lat, 'lng': lon,
                'store': random.randint(2000, 8000),
                'prod_hourly': get_solar_profile(base_prod) if source_type == 'solar' else (get_wind_profile(base_prod) if source_type == 'wind' else get_steady_profile(base_prod)) if base_prod > 0 else [0]*24,
                'dem_hourly': get_demand_profile(base_dem) if base_dem > 0 else [0]*24
            }

            all_features.append({"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [lon, lat]}})
        
        time.sleep(1.5)

    output_data = {
        "type": "FeatureCollection",
        "metadata": {
            "test_label": " TEST !",
            "spacing_rule": "10KM MINIMUM",
            "total_count": len(all_features)
        },
        "features": all_features
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=4)

    print(f"\nSuccess! Found {len(all_features)} locations with 10km spacing.")

if __name__ == "__main__":
    fetch_and_process()