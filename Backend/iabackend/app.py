# Arcadia/iabackend/app.py

from flask import Flask
from flask_cors import CORS
from graph_utils import cargar_grafo_vial, cargar_grafo_transporte
from rutas import rutas
from optimal_route import blueprint as optimal_route_blueprint

app = Flask(__name__)
#CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "https://miapp.vercel.app"]}})


# Cargar el grafo vial y red de transporte desde funciones auxiliares
print("Cargando red vial...")
G_vial = cargar_grafo_vial()
print("Red vial cargada.")

print("Cargando red de transporte...")
G_transporte, stops_info = cargar_grafo_transporte()
print("Red de transporte cargada.")

# Registrar el blueprint del endpoint /api/optimal-route
app.register_blueprint(optimal_route_blueprint(G_vial, G_transporte, stops_info, rutas))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
