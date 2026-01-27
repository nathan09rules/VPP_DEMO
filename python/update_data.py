import json
import math
import random

def get_solar_profile(peak):
    profile = []
    for h in range(24):
        # Bell curve peaked at 12
        val = max(0, math.sin((h - 6) * math.pi / 12)) * peak
        profile.append(round(val, 2))
    return profile

def get_wind_profile(peak):
    # semi-random wind
    profile = []
    val = peak * 0.5
    for h in range(24):
        val += (random.random() - 0.5) * (peak * 0.1)
        val = max(0.2 * peak, min(peak, val))
        profile.append(round(val, 2))
    return profile

def get_hydro_profile(peak):
    # Steady hydro
    return [round(peak, 2)] * 24

def get_thermal_profile(peak):
    # Steady base load
    return [round(peak, 2)] * 24

def get_demand_profile(peak):
    # Typical daily demand curve
    profile = []
    for h in range(24):
        # Two peaks: morning (8-10) and evening (18-21)
        # Using a combination of sine waves
        base = 0.4
        morning_peak = 0.4 * math.exp(-((h - 9)**2) / 8)
        evening_peak = 0.6 * math.exp(-((h - 19)**2) / 12)
        night_dip = -0.2 * math.exp(-((h - 3)**2) / 4)
        
        val = (base + morning_peak + evening_peak + night_dip) * peak
        profile.append(round(val, 2))
    return profile

def update_geojson():
    with open('static/loactions.geojson', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for feature in data['features']:
        props = feature['properties']
        name = props.get('name', '').lower()
        sub_type = props.get('sub_type', '')
        old_prod = props.get('prod', 0)
        old_dem = props.get('dem', 0)
        
        # Determine source type for plants
        source_type = 'thermal' # default
        if 'solar' in name:
            source_type = 'solar'
        elif 'wind' in name:
            source_type = 'wind'
        elif 'hydro' in name:
            source_type = 'hydro'
        elif 'nuclear' in name:
            source_type = 'nuclear'
        elif 'geothermal' in name:
            source_type = 'geothermal'
            
        props['source_type'] = source_type
        
        if old_prod > 0:
            if source_type == 'solar':
                props['prod_hourly'] = get_solar_profile(old_prod)
            elif source_type == 'wind':
                props['prod_hourly'] = get_wind_profile(old_prod)
            else:
                props['prod_hourly'] = get_thermal_profile(old_prod)
        else:
            props['prod_hourly'] = [0] * 24
            
        if old_dem > 0:
            props['dem_hourly'] = get_demand_profile(old_dem)
        else:
            props['dem_hourly'] = [0] * 24
            
        # Clean up old single values IF needed, but maybe keep them for backward compatibility if code isn't updated?
        # User said "remove the hard coded prod, dem", so I'll remove them.
        if 'prod' in props: del props['prod']
        if 'dem' in props: del props['dem']

    with open('static/loactions.geojson', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)

if __name__ == "__main__":
    update_geojson()
    print("Updated loactions.geojson with hourly profiles.")
