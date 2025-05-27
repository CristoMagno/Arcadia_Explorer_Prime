const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const { spawn } = require('child_process'); // Para ejecutar Python
const WebSocket = require('ws');          // Para comunicación en tiempo real

dotenv.config();
const app = express();

// Configuración de CORS, Morgan, etc.
app.use(cors({ origin: "http://localhost:3000" })); // Asegúrate que el puerto coincida con tu frontend
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Configuración WebSocket ---
const wss = new WebSocket.Server({ port: 8080 }); // Puerto para WebSocket
console.log('Servidor WebSocket escuchando en el puerto 8080');

wss.on('connection', ws => {
  console.log('Cliente conectado al WebSocket');
  ws.on('message', message => {
    // Puedes manejar mensajes del cliente si es necesario en el futuro
    console.log('Mensaje recibido del cliente: %s', message);
  });
  ws.on('close', () => {
    console.log('Cliente desconectado del WebSocket');
  });
  ws.on('error', (error) => {
    console.error('Error en WebSocket:', error);
  });
});

function broadcastToAllClients(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
// --- Fin Configuración WebSocket ---


// --- Lógica para iniciar y manejar el script de Python ---
let pythonProcess = null;
let lastKnownGpsStatusIsWaiting = false;

function startGpsReader() {
    if (pythonProcess) {
        console.log('El lector GPS ya está corriendo.');
        // Podrías enviar el último estado conocido si es 'esperando'
        if (lastKnownGpsStatusIsWaiting) {
            broadcastToAllClients({ 
                type: 'gps_status', 
                payload: { 
                    status: 'waiting_for_valid_data', 
                    message: 'Esperando datos GPS válidos...' 
                } 
            });
        }
        return;
    }
    console.log('Iniciando lector GPS (gps_reader.py)...');
    // Asegúrate que la ruta a python y al script sean correctas
    // El script se llama 'gps_reader.py' según el context, no 'gps_reader_modified.py'
    pythonProcess = spawn('python', ['-u', 'gps_reader.py']); 
    lastKnownGpsStatusIsWaiting = false; // Reset on new start

    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        // console.log(`Salida Python (stdout): ${output}`); // Descomenta para debugging intensivo

        // Prioriza la detección de "Esperando serial GPS valida..."
        if (output.includes("Esperando")) {
            console.log("Mensaje Python: 'Esperando serial GPS valida...' detectado.");
            lastKnownGpsStatusIsWaiting = true;
            broadcastToAllClients({ 
                type: 'gps_status', 
                payload: { 
                    status: 'waiting_for_valid_data', 
                    message: 'Esperando datos GPS válidos...' 
                } 
            });
        } else if (output.startsWith('GPS_DATA_PARSED:') || output.startsWith('GPS_DATA:')) {
             lastKnownGpsStatusIsWaiting = false;
             const gpsStringStartIndex = output.indexOf(':') + 1;
             const gpsString = output.substring(gpsStringStartIndex).trim();
             const parts = gpsString.split(',');
             
             if (parts.length >= 2) {
                try {
                    // Función para parsear de forma flexible "key=value" o solo "value"
                    const parsePart = (partString) => {
                        if (partString.includes('=')) {
                            return parseFloat(partString.split('=')[1]);
                        }
                        return parseFloat(partString);
                    };

                    const lat = parsePart(parts[0]); // e.g., lat=VAL or just VAL
                    const lng = parsePart(parts[1]); // e.g., lng=VAL or just VAL
                    
                    let humidity = null;
                    if (parts.length > 2 && parts[2]) {
                        const humPart = parts[2].toLowerCase();
                        if (humPart.includes('humidity') || humPart.includes('hum')) {
                             humidity = parsePart(parts[2]);
                        } else if (!isNaN(parseFloat(parts[2]))) { // If it's just a number
                            humidity = parseFloat(parts[2]);
                        }
                    }

                    let temperature = null;
                    if (parts.length > 3 && parts[3]) {
                        const tempPart = parts[3].toLowerCase();
                        if (tempPart.includes('temperature') || tempPart.includes('temp')) {
                            temperature = parsePart(parts[3]);
                        } else if (!isNaN(parseFloat(parts[3]))) { // If it's just a number
                             temperature = parseFloat(parts[3]);
                        }
                    }
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                        const gpsData = {
                            lat: lat,
                            lng: lng,
                            humidity: !isNaN(humidity) ? humidity : null,
                            temperature: !isNaN(temperature) ? temperature : null,
                            timestamp: Date.now()
                        };
                        // console.log("Broadcasting GPS_UPDATE:", gpsData); // Debug
                        broadcastToAllClients({ type: 'gps_update', payload: gpsData });
                    } else {
                        // console.warn(`Datos GPS parseados inválidos (NaN): lat=${lat}, lng=${lng} desde '${output}'`);
                        if (!lastKnownGpsStatusIsWaiting) { // Evita spam si ya está en modo "esperando"
                           // console.log("Volviendo a estado 'waiting_for_valid_data' debido a parseo NaN");
                           // lastKnownGpsStatusIsWaiting = true;
                           // broadcastToAllClients({ type: 'gps_status', payload: { status: 'waiting_for_valid_data', message: 'Recibiendo datos no válidos...' } });
                        }
                    }
                } catch (e) {
                     console.error(`Error al parsear datos GPS de Python ('${output}'):`, e);
                     if (!lastKnownGpsStatusIsWaiting) {
                        //  console.log("Volviendo a estado 'waiting_for_valid_data' debido a error de parseo");
                        //  lastKnownGpsStatusIsWaiting = true;
                        //  broadcastToAllClients({ type: 'gps_status', payload: { status: 'waiting_for_valid_data', message: 'Error parseando datos GPS...' } });
                     }
                }
             } else if (!lastKnownGpsStatusIsWaiting) {
                // console.log(`Salida GPS no tiene suficientes partes: '${output}'. Volviendo a 'waiting_for_valid_data'`);
                // lastKnownGpsStatusIsWaiting = true;
                // broadcastToAllClients({ type: 'gps_status', payload: { status: 'waiting_for_valid_data', message: 'Formato de datos GPS inesperado...' } });
             }
        } else if (output) { 
            // Filtrar mensajes comunes para no spamear el log ni el broadcast
            const lowerOutput = output.toLowerCase();
            const ignoredMessages = [
                'conectado a', 'puerto serial cerrado', 'arduino encontrado', 
                'biblioteca c', 'iniciando script', 'comenzando a leer',
                'buscando dispositivos arduino', 'puerto encontrado', 'error de valor en fallback python',
                'no se pudieron parsear datos válidos', 'función c no encontró suficientes campos',
                'error al convertir tokens de c a float'
            ];
            if (!ignoredMessages.some(msg => lowerOutput.includes(msg))) {
                 console.log(`Mensaje Python (otro): ${output}`);
                 // Decidir si este tipo de mensaje debe afectar el estado de 'waiting_for_valid_data'
                 // Por ahora, solo "Esperando serial GPS valida..." activa explícitamente el estado de espera.
            }
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        const errorOutput = data.toString().trim();
        console.error(`Error Python (stderr): ${errorOutput}`);
        // Enviar un estado de error más genérico para no sobrecargar al cliente con detalles técnicos.
        broadcastToAllClients({ 
            type: 'gps_status', 
            payload: { 
                status: 'script_error', 
                message: `Error interno del script GPS. Revisa la consola del servidor.` 
            } 
        });
    });

    pythonProcess.on('close', (code) => {
        console.log(`Proceso Python gps_reader.py terminado con código ${code}`);
        const statusPayload = {
            status: (code === 0 || code === null) ? 'disconnected' : 'disconnected_error',
            message: (code === 0 || code === null) ? 'GPS desconectado.' : 'Proceso GPS terminado inesperadamente.'
        };
        broadcastToAllClients({ type: 'gps_status', payload: statusPayload });
        pythonProcess = null;
        lastKnownGpsStatusIsWaiting = false;
    });

     pythonProcess.on('error', (err) => {
        console.error('Error al iniciar el proceso Python:', err);
        broadcastToAllClients({ 
            type: 'gps_status', 
            payload: { 
                status: 'script_launch_error', 
                message: 'No se pudo iniciar el lector GPS.' 
            } 
        });
        pythonProcess = null;
        lastKnownGpsStatusIsWaiting = false;
     });
}

// --- Endpoint API para iniciar la conexión (llamado desde React) ---
app.get('/api/connect-gps', (req, res) => {
  if (!pythonProcess) {
    startGpsReader();
    // El mensaje de éxito aquí es solo para la API, el estado real lo dará el WebSocket
    res.status(200).json({ success: true, message: 'Solicitud de conexión GPS iniciada. Esperando datos...' });
  } else {
    // Si ya está corriendo, reenviar el estado actual de "espera" si aplica
    if (lastKnownGpsStatusIsWaiting) {
        broadcastToAllClients({ 
            type: 'gps_status', 
            payload: { 
                status: 'waiting_for_valid_data', 
                message: 'Esperando datos GPS válidos...' 
            } 
        });
    }
    res.status(200).json({ success: true, message: 'El lector GPS ya está activo.' });
  }
});

app.get('/api/disconnect-gps', (req, res) => {
  if (pythonProcess) {
    console.log('Deteniendo lector GPS...');
    pythonProcess.kill('SIGTERM'); // Envía señal para terminar educadamente
    // Esperar a que el evento 'close' del proceso maneje el estado y broadcast.
    // pythonProcess = null; // Se setea a null en el evento 'close'
    res.status(200).json({ success: true, message: 'Solicitud de desconexión GPS enviada.' });
  } else {
    res.status(200).json({ success: true, message: 'El lector GPS no estaba activo.' });
  }
});
// --- Fin Lógica Python ---


// Ruta raíz y listener
app.get("/", (req, res) => {
    return res.status(200).send("<h1>Backend Arcadia Explorer</h1><p>WebSocket en puerto 8080</p>");
});

const puerto = process.env.PUERTO || 3001;
app.listen(puerto, () => {
    console.log(`Servidor HTTP corriendo en el puerto ${puerto}`);
    // Opcionalmente, iniciar el lector GPS automáticamente al arrancar el servidor
    // startGpsReader();
});