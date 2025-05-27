# iabackend/stops_graph.py

import networkx as nx
from utils import haversine_meters
from rutas import ALL_PREDEFINED_ROUTES_CONFIG

def build_graph():
    """
    Construye un grafo en el que cada nodo es una parada (indexada con ruta_id + índice);
    las aristas entre paradas consecutivas de la misma ruta tienen peso = distancia en metros.
    Devuelve:
      - G: objeto nx.Graph (o nx.DiGraph si se quiere dirección)
      - stops_info: dict con key=node_id, value={ lat, lng, route_id, idx_en_ruta }
    """
    G = nx.Graph()
    stops_info = {}

    for route in ALL_PREDEFINED_ROUTES_CONFIG:
        r_id = route["id"]
        coords = route["coords"]  # lista de [lng, lat]
        for i, (lng, lat) in enumerate(coords):
            node_id = f"{r_id}_{i}"
            stops_info[node_id] = {
                "lat": lat,
                "lng": lng,
                "route_id": r_id,
                "index": i
            }
            G.add_node(node_id)

        # Crear aristas entre consecutivos
        for i in range(len(coords) - 1):
            node_a = f"{r_id}_{i}"
            node_b = f"{r_id}_{i+1}"
            lat1, lng1 = coords[i][1], coords[i][0]
            lat2, lng2 = coords[i+1][1], coords[i+1][0]
            dist_m = haversine_meters(lat1, lng1, lat2, lng2)
            G.add_edge(node_a, node_b, weight=dist_m)
    return G, stops_info

def encontrar_parada_cercana(ubicacion, stops_info):
    """
    Encuentra la parada más cercana a una ubicación dada (lat, lng).
    Retorna el ID de la parada más cercana.
    """
    min_dist = float('inf')
    parada_cercana = None
    lat_u, lng_u = ubicacion['lat'], ubicacion['lng']
    for node_id, info in stops_info.items():
        lat_s, lng_s = info['lat'], info['lng']
        dist = haversine_meters(lat_u, lng_u, lat_s, lng_s)
        if dist < min_dist:
            min_dist = dist
            parada_cercana = node_id
    return parada_cercana

def calcular_distancia_total(origen, destino, parada_subida, parada_bajada, stops_info, G):
    """
    Calcula la distancia total combinada (origen → parada subida → ruta en camión → parada bajada → destino).
    """
    # Distancia origen a parada subida
    lat1, lng1 = origen['lat'], origen['lng']
    lat2, lng2 = stops_info[parada_subida]['lat'], stops_info[parada_subida]['lng']
    dist1 = haversine_meters(lat1, lng1, lat2, lng2)

    # Distancia en ruta entre paradas
    path = nx.shortest_path(G, parada_subida, parada_bajada, weight='weight')
    dist2 = sum(G[path[i]][path[i+1]]['weight'] for i in range(len(path) - 1))

    # Distancia parada bajada a destino
    lat3, lng3 = stops_info[parada_bajada]['lat'], stops_info[parada_bajada]['lng']
    lat4, lng4 = destino['lat'], destino['lng']
    dist3 = haversine_meters(lat3, lng3, lat4, lng4)

    return dist1 + dist2 + dist3
