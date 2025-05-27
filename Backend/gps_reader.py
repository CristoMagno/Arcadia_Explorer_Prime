# gps_reader_modified.py
import serial
import serial.tools.list_ports
import time
import sys
import os
import ctypes 
# --- Carga de la biblioteca C para tokenizar (de gps_reader_asm.py) ---
lib_gps_tokenizer = None
MAX_TOKEN_LEN_PY = 32  

try:
    lib_name_tokenizer = None
    # Determinar el nombre de la biblioteca según el SO
    # Asumimos que la biblioteca compilada (gps_tokenizer.dll, .so, .dylib)
    # está en el mismo directorio que este script.
    # Si no, ajustar la ruta. Ejemplo: './Backend/gps_tokenizer.dll'
    base_path = os.path.dirname(os.path.abspath(__file__)) # Directorio del script actual

    if os.name == 'nt':  # Windows
        lib_name_tokenizer = os.path.join(base_path, 'gps_tokenizer.dll')
    elif os.name == 'posix':
        if os.uname().sysname == 'Darwin':  # macOS
            lib_name_tokenizer = os.path.join(base_path, 'libgps_tokenizer.dylib')
        else:  # Linux
            lib_name_tokenizer = os.path.join(base_path, 'libgps_tokenizer.so')
    
    if lib_name_tokenizer and os.path.exists(lib_name_tokenizer):
        lib_gps_tokenizer = ctypes.CDLL(lib_name_tokenizer)


        lib_gps_tokenizer.tokenize_and_extract_gps_fields_asm.argtypes = [
            ctypes.c_char_p, ctypes.c_char,
            ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p,
            ctypes.c_int
        ]
        lib_gps_tokenizer.tokenize_and_extract_gps_fields_asm.restype = ctypes.c_int
        print(f"Biblioteca C para tokenizar GPS '{lib_name_tokenizer}' cargada exitosamente.")
    elif lib_name_tokenizer:
        print(f"Advertencia: Biblioteca C '{lib_name_tokenizer}' no encontrada. Se usará el parseo en Python puro.")
        lib_gps_tokenizer = None
    else:
        print("Sistema operativo no soportado para la carga automática de la biblioteca C de tokenización. Se usará el parseo en Python puro.")
        lib_gps_tokenizer = None

except OSError as e:
    print(f"Error al cargar la biblioteca C 'gps_tokenizer': {e}")
    print("Se utilizará la implementación en Python puro para el parseo.")
    lib_gps_tokenizer = None
# --- Fin de la carga de la biblioteca C ---

# Configuración global (de gps_reader.py)
BAUD_RATE = 9600  # Opcionalmente configurable por dotenv si se desea
TIMEOUT = 5  # Segundos para timeout de lectura
arduino_port = None
serial_connection = None

# Funciones de conexión y lectura serial (de gps_reader.py)
def find_arduino():
    print("Buscando dispositivos Arduino...")
    ports = list(serial.tools.list_ports.comports())
    for p in ports: # Cambiado 'port' a 'p' para evitar conflicto con variable global 'arduino_port'
        print(f"Puerto encontrado: {p.device} - {p.description}")
    
    if not ports:
        print("No se encontraron puertos seriales disponibles.")
        return None
    
    for p in ports:
        if 'arduino' in p.description.lower() or \
           'ch340' in p.description.lower() or \
           'usb' in p.description.lower(): # Más genérico para USB-Serial
            print(f"Dispositivo compatible con Arduino encontrado en {p.device}")
            return p.device
    
    print("No se encontró un Arduino específico por descripción. Intentando el primer puerto si solo hay uno.")
    if len(ports) == 1:
        print(f"Usando el único puerto disponible: {ports[0].device}")
        return ports[0].device
        
    print("No se pudo determinar el puerto del Arduino automáticamente.")
    return None

def connect_to_gps():
    global arduino_port, serial_connection
    
    if not arduino_port: # Intentar buscar si no está definido
        arduino_port = find_arduino()

    if not arduino_port:
        
        print("No se pudo encontrar un puerto para el dispositivo GPS/Arduino.")
        return False
    
    try:
        serial_connection = serial.Serial(arduino_port, BAUD_RATE, timeout=TIMEOUT)
        print(f"Conectado a {arduino_port} a {BAUD_RATE} baudios")
        time.sleep(2) # Esperar a que se inicialice la conexión
        return True
    except serial.SerialException as e:
        print(f"Error al conectar con {arduino_port}: {e}")
        return False

def parse_gps_data_python_fallback(data_to_parse):
    try:
        parts = data_to_parse.split(',')
        if len(parts) >= 2: 
            lat = float(parts[0])
            lon = float(parts[1])
            
            humidity_str = parts[2] if len(parts) > 2 else None
            temp_str = parts[3] if len(parts) > 3 else None

            humidity = float(humidity_str) if humidity_str and humidity_str.strip() else None
            temp = float(temp_str) if temp_str and temp_str.strip() else None
            
            data = {"lat": lat, "lng": lon}
            if humidity is not None:
                data["humidity"] = humidity
            if temp is not None:
                data["temperature"] = temp
            return data
    except ValueError as ve:
        print(f"Error de valor en fallback Python (parseando '{data_to_parse}'): {ve}")
    except Exception as e:
        print(f"Error general en fallback Python (parseando '{data_to_parse}'): {e}")
    return None
def parse_gps_data(line):
    try:
        data_part_to_process = None
        if "GPS_DATA:" in line: # Asumiendo que este prefijo aún puede estar
            data_part_to_process = line.split("GPS_DATA:", 1)[1].strip()
        else:
            data_part_to_process = line.strip() # Procesar la línea tal cual si no hay prefijo

        if not data_part_to_process:
            return None

        if lib_gps_tokenizer:
            out_lat_b = ctypes.create_string_buffer(MAX_TOKEN_LEN_PY)
            out_lon_b = ctypes.create_string_buffer(MAX_TOKEN_LEN_PY)
            out_hum_b = ctypes.create_string_buffer(MAX_TOKEN_LEN_PY)
            out_temp_b = ctypes.create_string_buffer(MAX_TOKEN_LEN_PY)
            
            input_bytes = data_part_to_process.encode('utf-8')
            delimiter_byte = b','[0]

            num_fields = lib_gps_tokenizer.tokenize_and_extract_gps_fields_asm(
                input_bytes, ctypes.c_char(delimiter_byte),
                out_lat_b, out_lon_b, out_hum_b, out_temp_b,
                MAX_TOKEN_LEN_PY
            )

            if num_fields >= 2: # Latitud y longitud son mínimas
                try:
                    lat = float(out_lat_b.value.decode('utf-8'))
                    lon = float(out_lon_b.value.decode('utf-8'))
                    
                    humidity = None
                    if num_fields > 2 and out_hum_b.value: # Verificar que el buffer no esté vacío
                        hum_str = out_hum_b.value.decode('utf-8').strip()
                        if hum_str: humidity = float(hum_str) 
                    
                    temp = None
                    if num_fields > 3 and out_temp_b.value: # Verificar que el buffer no esté vacío
                        temp_str = out_temp_b.value.decode('utf-8').strip()
                        if temp_str: temp = float(temp_str)

                    data = {"lat": lat, "lng": lon}
                    if humidity is not None: data["humidity"] = humidity
                    if temp is not None: data["temperature"] = temp
                    return data
                except ValueError as ve:
                    print(f"Error al convertir tokens de C a float: {ve}. Tokens: lat='{out_lat_b.value.decode()}', lon='{out_lon_b.value.decode()}', hum='{out_hum_b.value.decode()}', temp='{out_temp_b.value.decode()}'. Usando fallback.")
                    return parse_gps_data_python_fallback(data_part_to_process)
                except Exception as e_conv:
                    print(f"Excepción inesperada durante conversión de tokens C: {e_conv}. Usando fallback.")
                    return parse_gps_data_python_fallback(data_part_to_process)
            elif num_fields == -1:
                print("Error de puntero nulo en la función C de tokenización. Usando fallback.")
                return parse_gps_data_python_fallback(data_part_to_process)
            else:
                # print(f"Función C no encontró suficientes campos ({num_fields}) para '{data_part_to_process}'. Usando fallback.")
                return parse_gps_data_python_fallback(data_part_to_process)
        else:
            # Fallback a la lógica de Python si la biblioteca C no está cargada
            return parse_gps_data_python_fallback(data_part_to_process)
            
    except Exception as e:
        print(f"Error general en parse_gps_data ('{line}'): {e}")
    return None

def read_gps_and_process():
    global serial_connection
    
    if not serial_connection:
        if not connect_to_gps():
            print("No se pudo establecer conexión con el dispositivo GPS/Arduino.")
            return
    
    print("Comenzando a leer y procesar datos GPS...")
    
    try:
        while True:
            if serial_connection.in_waiting > 0:
                try:
                    line = serial_connection.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        print(f"Línea recibida: '{line}'") # Para depuración
                        gps_data = parse_gps_data(line)
                        if gps_data:
                        
                            output_line = f"GPS_DATA_PARSED: lat={gps_data['lat']},lng={gps_data['lng']}"
                            if "humidity" in gps_data and gps_data["humidity"] is not None:
                                output_line += f",humidity={gps_data['humidity']}"
                            if "temperature" in gps_data and gps_data["temperature"] is not None:
                                output_line += f",temperature={gps_data['temperature']}"
                            print(output_line)
                            sys.stdout.flush() # Forzar la salida inmediata
                        # else:
                            # print(f"No se pudieron parsear datos válidos de la línea: '{line}'")
                    
                except serial.SerialException as se:
                    print(f"Error de comunicación serial: {se}. Intentando reconectar...")
                    if serial_connection and serial_connection.is_open:
                        serial_connection.close()
                    serial_connection = None # Forzar intento de reconexión
                    time.sleep(5) # Esperar antes de reconectar
                    if not connect_to_gps():
                        print("Fallo al reconectar. Terminando.")
                        break
                except UnicodeDecodeError as ude:
                    print(f"Error de decodificación Unicode: {ude}. Línea ignorada.")
                except Exception as e:
                    print(f"Error inesperado durante la lectura/procesamiento: {e}")
            
            time.sleep(0.1) # Pequeña pausa
            
    except KeyboardInterrupt:
        print("Lectura GPS interrumpida por el usuario.")
    except Exception as e:
        print(f"Error en la lectura del GPS: {e}")
    finally:
        if serial_connection and serial_connection.is_open:
            serial_connection.close()
            print("Puerto serial cerrado.")

if __name__ == "__main__":
    print("Iniciando script gps_reader_modified.py...")
    
    # Iniciar la lectura del GPS real
    # Asegúrate de que el dispositivo esté conectado y la biblioteca C compilada
    # (gps_tokenizer.dll, .so, o .dylib) en el mismo directorio o ruta correcta.
    read_gps_and_process()
    
    print("Script .py finalizado.")