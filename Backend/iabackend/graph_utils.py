import osmnx as ox
from stops_graph import build_graph

def cargar_grafo_vial():
    return ox.graph_from_place("Atlixco, Puebla, México", network_type='drive')

def cargar_grafo_transporte():
    return build_graph()
