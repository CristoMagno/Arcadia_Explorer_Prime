#include <SoftwareSerial.h>
#include <TinyGPS++.h>

// Sensor DHT para humedad y temperatura (opcional)
// Si no tienes un sensor DHT, puedes eliminar estas líneas
#include <DHT.h>
#define DHTPIN 4     // Pin digital conectado al sensor DHT
#define DHTTYPE DHT11   // DHT 11 (cambia a DHT22 si usas ese modelo)

// Configuración para GPS NEO-6M - Usar D0(RX), D1(TX) para R4 WiFi
// Conecta TX del GPS al pin D0 del Arduino
// Conecta RX del GPS al pin D1 del Arduino
SoftwareSerial gpsSerial(0, 1); // RX, TX (D0, D1 en Arduino R4 WiFi)
TinyGPSPlus gps;

// Inicializar sensor DHT (elimina esta línea si no tienes DHT)
DHT dht(DHTPIN, DHTTYPE);

// Variables para almacenar datos
float latitude = 0.0, longitude = 0.0;
float humidity = 0.0, temperature = 0.0;
unsigned long lastUpdateTime = 0;
const unsigned long UPDATE_INTERVAL = 2000; // Actualizar cada 2 segundos

void setup() {
  // Inicializar puerto serial para comunicación con la computadora
  Serial.begin(9600);
  while (!Serial) {
    ; // Esperar a que el puerto serial se conecte
  }
  
  // Inicializar puerto serial para GPS
  gpsSerial.begin(9600);
  
  // Inicializar sensor DHT (elimina esta línea si no tienes DHT)
  dht.begin();
  
  Serial.println("Sistema GPS iniciado. Esperando datos...");
}

void loop() {
  // Leer datos del GPS
  while (gpsSerial.available() > 0) {
    if (gps.encode(gpsSerial.read())) {
      if (gps.location.isValid()) {
        latitude = gps.location.lat();
        longitude = gps.location.lng();
      }
    }
  }
  
  // Cada intervalo definido, enviar datos completos
  if (millis() - lastUpdateTime > UPDATE_INTERVAL) {
    lastUpdateTime = millis();
    
    // Leer sensores DHT (elimina esta sección si no tienes DHT)
    humidity = dht.readHumidity();
    temperature = dht.readTemperature();
    
    // Enviar datos en formato estandarizado para que Python los procese
    if (gps.location.isValid()) {
      Serial.print("GPS_DATA: ");
      Serial.print(latitude, 6);
      Serial.print(",");
      Serial.print(longitude, 6);
      
      // Añadir datos de humedad y temperatura si están disponibles
      if (!isnan(humidity) && !isnan(temperature)) {
        Serial.print(",");
        Serial.print(humidity, 1);
        Serial.print(",");
        Serial.print(temperature, 1);
      }
      
      Serial.println();
    } else {
      Serial.println("Esperando señal GPS válida...");
    }
  }
  
  // Si después de 5 segundos no hay datos GPS, mostrar mensaje
  if (millis() > 5000 && gps.charsProcessed() < 10) {
    Serial.println("No se detectan datos GPS. Verifica las conexiones.");
    delay(1000);
  }
}