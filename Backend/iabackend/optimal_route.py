from flask import Blueprint, request, jsonify
import networkx as nx
import osmnx as ox
from utils import estimar_tiempo
from rutas import rutas, ALL_PREDEFINED_ROUTES_CONFIG  # ✅ Importa nombres reales

def blueprint(G_vial, G_transporte, stops_info, rutas):
    bp = Blueprint('optimal_route', __name__)

    @bp.route('/api/optimal-route', methods=['POST'])
    def optimal_route():
        data = request.get_json(force=True)
        origen = data.get("origen")
        destino = data.get("destino")

        if not origen or not destino:
            return jsonify({
                "error": "Debes proporcionar origen y destino",
                "mensaje": "Faltan datos para calcular la ruta."
            }), 400

        try:
            nodo_origen = ox.distance.nearest_nodes(G_vial, origen['lng'], origen['lat'])
            nodo_destino = ox.distance.nearest_nodes(G_vial, destino['lng'], destino['lat'])

            if not nx.has_path(G_vial, nodo_origen, nodo_destino):
                return jsonify({
                    "recomendacion": "caminar",
                    "mensaje": "No hay ruta directa entre origen y destino.",
                    "ruta_directa": [],
                    "distancia_a_pie_directa": 0,
                    "tiempo_estimado": 0
                })

            path_directo = nx.shortest_path(G_vial, nodo_origen, nodo_destino, weight='length')
            dist_directo = nx.path_weight(G_vial, path_directo, weight='length')
            dist_directo_km = round(dist_directo / 1000, 2)
            ruta_directa = [[G_vial.nodes[n]['x'], G_vial.nodes[n]['y']] for n in path_directo]
            tiempo_directo = estimar_tiempo(dist_directo)

            mejor_ruta_id = None
            mejor_tramo = []
            mejor_parada_subida = None
            mejor_parada_bajada = None
            mejor_distancia_total = float('inf')
            mejor_ruta2 = []

            for ruta_key, puntos in rutas.items():
                nodos_ruta = [ox.distance.nearest_nodes(G_vial, lng, lat) for lng, lat in puntos]

                parada_subida = min(nodos_ruta, key=lambda n: nx.shortest_path_length(G_vial, nodo_origen, n, weight='length'))
                parada_bajada = min(nodos_ruta, key=lambda n: nx.shortest_path_length(G_vial, nodo_destino, n, weight='length'))

                if not nx.has_path(G_vial, nodo_origen, parada_subida) or not nx.has_path(G_vial, parada_bajada, nodo_destino):
                    continue

                idx1, idx2 = nodos_ruta.index(parada_subida), nodos_ruta.index(parada_bajada)
                if idx1 < idx2:
                    tramo = nodos_ruta[idx1:idx2+1]
                else:
                    tramo = nodos_ruta[idx2:idx1+1][::-1]

                if len(tramo) < 2:
                    continue

                ruta2 = []
                tramo_valido = True
                for i in range(len(tramo) - 1):
                    if nx.has_path(G_vial, tramo[i], tramo[i+1]):
                        subcamino = nx.shortest_path(G_vial, tramo[i], tramo[i+1], weight='length')
                        if i > 0:
                            subcamino = subcamino[1:]
                        ruta2.extend([[G_vial.nodes[n]['x'], G_vial.nodes[n]['y']] for n in subcamino])
                    else:
                        tramo_valido = False
                        break

                if not tramo_valido or not ruta2:
                    continue

                dist_a_subida = nx.shortest_path_length(G_vial, nodo_origen, parada_subida, weight='length')
                dist_de_bajada = nx.shortest_path_length(G_vial, parada_bajada, nodo_destino, weight='length')
                dist_tramo = sum(nx.shortest_path_length(G_vial, tramo[i], tramo[i+1], weight='length') for i in range(len(tramo)-1))
                distancia_total = dist_a_subida + dist_tramo + dist_de_bajada

                if distancia_total < mejor_distancia_total:
                    mejor_distancia_total = distancia_total
                    mejor_ruta_id = ruta_key
                    mejor_parada_subida = parada_subida
                    mejor_parada_bajada = parada_bajada
                    mejor_tramo = tramo
                    mejor_ruta2 = ruta2

            if mejor_ruta_id is None:
                return jsonify({
                    "recomendacion": "caminar",
                    "mensaje": "No se encontró un tramo válido en las rutas. Se recomienda caminar directo.",
                    "ruta_directa": ruta_directa,
                    "distancia_a_pie_directa": dist_directo_km,
                    "tiempo_estimado": tiempo_directo
                })

            # ✅ Buscar el nombre real de la ruta
            mejor_ruta_nombre = next((r['name'] for r in ALL_PREDEFINED_ROUTES_CONFIG if r['id'] == mejor_ruta_id), mejor_ruta_id)

            ruta1 = [[G_vial.nodes[n]['x'], G_vial.nodes[n]['y']] for n in nx.shortest_path(G_vial, nodo_origen, mejor_parada_subida, weight='length')]
            ruta3 = [[G_vial.nodes[n]['x'], G_vial.nodes[n]['y']] for n in nx.shortest_path(G_vial, mejor_parada_bajada, nodo_destino, weight='length')]

            tiempo_total = (
                estimar_tiempo(dist_a_subida) +
                estimar_tiempo(dist_tramo, "transporte") +
                estimar_tiempo(dist_de_bajada)
            )
            mejor_distancia_total_km = round(mejor_distancia_total / 1000, 2)

            mensaje_transporte = f"Camina hasta la parada, toma la combi '{mejor_ruta_nombre}' y luego camina al destino."

            return jsonify({
                "recomendacion": "usar_transporte",
                "mensaje": mensaje_transporte,
                "ruta_origen_a_subida": ruta1,
                "ruta_transporte": mejor_ruta2,
                "ruta_bajada_a_destino": ruta3,
                "parada_subida_coords": {
                    "lat": G_vial.nodes[mejor_parada_subida]['y'],
                    "lng": G_vial.nodes[mejor_parada_subida]['x']
                },
                "parada_bajada_coords": {
                    "lat": G_vial.nodes[mejor_parada_bajada]['y'],
                    "lng": G_vial.nodes[mejor_parada_bajada]['x']
                },
                "distancia_total_ruta": mejor_distancia_total_km,
                "tiempo_estimado": tiempo_total,
                "combi_id": mejor_ruta_id,
                "combi_nombre": mejor_ruta_nombre
            })

        except Exception as e:
            print(f"Error interno: {e}")
            return jsonify({
                "recomendacion": "error",
                "mensaje": f"Ocurrió un error al calcular la ruta: {str(e)}",
                "error": str(e)
            }), 500

    return bp
