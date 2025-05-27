# iabackend/utils.py

import math

def haversine_meters(lat1, lng1, lat2, lng2):
    """
    Calcula la distancia en metros entre dos coordenadas (lat, lng) usando fórmula Haversine.
    """
    R = 6371000  # radio tierra en metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def estimar_tiempo(distancia_metros, modo="caminar"):
    velocidad = 80 if modo == "caminar" else 300  # 4.8 km/h o 18 km/h
    return round(distancia_metros / velocidad)  # Redondea al número entero más cercano

