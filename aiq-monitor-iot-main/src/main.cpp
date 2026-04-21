#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Adafruit_BMP280.h>
#include <ESPAsyncWebServer.h>
#include <AsyncTCP.h>
#include <LittleFS.h>

// ======================================================
// FEATURE FLAGS
// ======================================================
#define HAS_MQTT   1
#define DUST_DEBUG 1

// ======================================================
// PIN MAP
// ======================================================
static const uint8_t PIN_DUST_LED = 25;   // HIGH = LED ON
static const uint8_t PIN_RELAY    = 26;
static const uint8_t PIN_DUST_VO  = 34;   // ADC input
static const uint8_t PIN_MQ2_AO   = 35;
static const uint8_t PIN_MQ2_DO   = 27;

static const uint8_t PIN_I2C_SDA  = 21;
static const uint8_t PIN_I2C_SCL  = 22;

// ======================================================
// RELAY CONFIG
// ======================================================
static const bool RELAY_ACTIVE_HIGH = false;

// ======================================================
// THRESHOLDS (with hysteresis)
// ======================================================
static const float TEMP_FAN_ON_C  = 30.0f;
static const float TEMP_FAN_OFF_C = 29.0f;

// ======================================================
// DUST SENSOR TIMING (GP2Y1010AU0F)
// Total cycle = 280 + 40 + 9680 = 10000us (10ms)
// LED control in this wiring: LOW = ON, HIGH = OFF (active low)
// ======================================================
static const uint32_t DUST_LED_ON_TIME_US       = 280;
static const uint32_t DUST_WAIT_AFTER_SAMPLE_US = 40;
static const uint32_t DUST_REST_TIME_US         = 9680;

// Per reading, average multiple pulse samples
static const int DUST_AVG_CYCLES = 20;   // 20 x 10ms = 200ms

// ======================================================
// DUST CALIBRATION
// Voltages are actual sensor VO (before 10K/22K divider).
// DIVIDER converts ADC voltage back to actual VO.
// Re-check baseline after 3-5 min warmup in still air.
// ======================================================
static const float DUST_DIVIDER    = 32.0f / 22.0f;  // (10K+22K)/22K = 1.4545
static const float DUST_V_BASELINE = 0.9f;    // actual VO in clean air (V)
static const float DUST_V_SLOPE    = 0.5f;    // V per mg/m³ (actual VO)

// Extra filtering:
// 1) pulse averaging above
// 2) moving average across multiple completed readings
static const int   DUST_HISTORY_SIZE = 12;     // 12 x 2s = 24s smoothing
static const float DUST_MAX_VALID_V  = 3.5f;   // sanity limit (actual VO)

static const char* DEFAULT_SSID    = "The British College";
static const char* DEFAULT_PASSWORD = "British@123#";

// ======================================================
// MQTT CONFIG
// ======================================================
static const char* DEVICE_ID    = "esp32-aiq-01";
static const char* MQTT_HOST    = "broker.hivemq.com";
static const uint16_t MQTT_PORT = 1883;
static const char* MQTT_TOPIC   = "aiqdata/esp32-aiq-02"; //put 01 for industrial and 02 for forest during the upload

// ======================================================
// CONFIG PAGE LOGIN
// ======================================================
static const char* CONFIG_USER = "admin";
static const char* CONFIG_PASS = "root";

// ======================================================
// CONFIG AP
// ======================================================
static const char* AP_SSID = "AIQ-Setup-ind"; //put ind for industrial and for for forest 
static const char* AP_PASS = "12345678";

// ======================================================
// INTERVALS
// ======================================================
static const unsigned long SENSOR_INTERVAL_MS = 2000;
static const unsigned long SERIAL_INTERVAL_MS = 2000;
static const unsigned long MQTT_INTERVAL_MS   = 5000;
static const unsigned long WIFI_RETRY_MS      = 10000;

static const float MQ2_DO_THRESHOLD_V        = 2.0f;  // simulate DO: HIGH if AO >= this voltage

// ======================================================
// DATA STRUCTURES
// ======================================================
struct WifiConfig {
  String ssid;
  String password;
};

struct SensorData {
  float temperatureC = NAN;
  float pressureHpa  = NAN;

  int   dustAdcRaw        = 0;     // current raw averaged reading before long smoothing
  float dustVoltageRaw    = 0.0f;
  float dustUgM3Raw       = 0.0f;

  int   dustAdc           = 0;     // final smoothed value
  float dustVoltage       = 0.0f;
  float dustUgM3          = 0.0f;
  int   dustMinRaw        = 0;
  int   dustMaxRaw        = 0;
  bool  dustValid         = false;

  int   mq2Adc            = 0;
  float mq2Voltage        = 0.0f;
  bool  mq2Digital        = false;

  bool  fanOn             = false;
  long  wifiRssi          = 0;
  unsigned long uptimeMs  = 0;
};

// ======================================================
// GLOBALS
// ======================================================
Adafruit_BMP280 bmp;
AsyncWebServer  server(80);
WiFiClient      wifiClient;
PubSubClient    mqttClient(wifiClient);

WifiConfig  wifiConfig;
SensorData  latest;

unsigned long lastSensorReadMs  = 0;
unsigned long lastSerialPrintMs = 0;
unsigned long lastMqttPublishMs = 0;
unsigned long lastWifiAttemptMs = 0;

// Dust smoothing history
int   dustHistoryAdc[DUST_HISTORY_SIZE] = {0};
int   dustHistoryCount = 0;
int   dustHistoryIndex = 0;

// ======================================================
// HELPERS
// ======================================================
float adcToVoltage(int raw) {
  return (3.3f * raw) / 4095.0f;
}

int voltageToAdc(float voltage) {
  if (voltage < 0.0f) voltage = 0.0f;
  if (voltage > 3.3f) voltage = 3.3f;
  return (int)((voltage / 3.3f) * 4095.0f + 0.5f);
}

// Takes actual sensor VO voltage (after applying DUST_DIVIDER)
float estimateDustUgM3(float actualVoltage) {
  float densityMgM3 = (actualVoltage - DUST_V_BASELINE) / DUST_V_SLOPE;
  if (densityMgM3 < 0.0f) densityMgM3 = 0.0f;
  return densityMgM3 * 1000.0f;
}

String dustAQI(float ugm3) {
  if (ugm3 <  12.0f) return "Good";
  if (ugm3 <  35.4f) return "Moderate";
  if (ugm3 <  55.4f) return "Unhealthy for Sensitive";
  if (ugm3 < 150.4f) return "Unhealthy";
  if (ugm3 < 250.4f) return "Very Unhealthy";
  return                    "Hazardous";
}

String escapeHtml(const String& s) {
  String out = s;
  out.replace("&", "&amp;");
  out.replace("<", "&lt;");
  out.replace(">", "&gt;");
  out.replace("\"", "&quot;");
  return out;
}

void writeRelayPin(bool on) {
  digitalWrite(PIN_RELAY, (on == RELAY_ACTIVE_HIGH) ? HIGH : LOW);
}

void setRelay(bool on) {
  latest.fanOn = on;
  writeRelayPin(on);
}

void addDustHistory(int adcValue) {
  dustHistoryAdc[dustHistoryIndex] = adcValue;
  dustHistoryIndex = (dustHistoryIndex + 1) % DUST_HISTORY_SIZE;
  if (dustHistoryCount < DUST_HISTORY_SIZE) dustHistoryCount++;
}

int getDustHistoryAverage() {
  if (dustHistoryCount == 0) return 0;
  long sum = 0;
  for (int i = 0; i < dustHistoryCount; i++) sum += dustHistoryAdc[i];
  return (int)(sum / dustHistoryCount);
}

// ======================================================
// LITTLEFS WIFI CONFIG
// ======================================================
bool saveWifiConfig(const WifiConfig& cfg) {
  File f = LittleFS.open("/wifi.json", "w");
  if (!f) return false;
  JsonDocument doc;
  doc["ssid"]     = cfg.ssid;
  doc["password"] = cfg.password;
  bool ok = serializeJson(doc, f) > 0;
  f.close();
  return ok;
}

bool loadWifiConfig(WifiConfig& cfg) {
 /* if (!LittleFS.exists("/wifi.json")) return false;
  File f = LittleFS.open("/wifi.json", "r");
  if (!f) return false;
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();
  if (err) return false;

  cfg.ssid     = doc["ssid"]     | "";
  cfg.password = doc["password"] | "";*/
  cfg.ssid = DEFAULT_SSID;
  cfg.password = DEFAULT_PASSWORD;
  return cfg.ssid.length() > 0;
}

bool hasWifiConfig() {
  return wifiConfig.ssid.length() > 0;
}

// ======================================================
// WIFI / MQTT
// ======================================================
void startApMode() {
#if HAS_MQTT
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.println("[WiFi] Setup AP started");
  Serial.print("[WiFi] AP SSID: "); Serial.println(AP_SSID);
  Serial.print("[WiFi] AP IP:   "); Serial.println(WiFi.softAPIP());
#endif
}

void connectWifiIfNeeded() {
#if HAS_MQTT
  if (!hasWifiConfig()) return;
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if (now - lastWifiAttemptMs < WIFI_RETRY_MS) return;

  lastWifiAttemptMs = now;
  Serial.print("[WiFi] Connecting to "); Serial.println(wifiConfig.ssid);
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(wifiConfig.ssid.c_str(), wifiConfig.password.c_str());
#endif
}

void connectMqttIfNeeded() {
#if HAS_MQTT
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  Serial.print("[MQTT] Connecting to ");
  Serial.print(MQTT_HOST); Serial.print(":"); Serial.println(MQTT_PORT);

  if (mqttClient.connect(DEVICE_ID)) {
    Serial.println("[MQTT] Connected");
  } else {
    Serial.print("[MQTT] Failed, rc="); Serial.println(mqttClient.state());
  }
#endif
}

// ======================================================
// WEB SERVER
// ======================================================
String buildStatusJson();

bool isAuthenticated(AsyncWebServerRequest* request) {
  return request->authenticate(CONFIG_USER, CONFIG_PASS);
}

String configPageHtml() {
  String html;
  html += "<!doctype html><html><head>";
  html += "<meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>AIQ WiFi Setup</title>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;margin:24px;background:#f7f7f7;}";
  html += ".card{max-width:440px;margin:auto;background:white;padding:20px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);}";
  html += "input{width:100%;padding:10px;margin:8px 0 16px 0;box-sizing:border-box;}";
  html += "button{padding:10px 16px;border:none;border-radius:8px;background:#222;color:#fff;cursor:pointer;}";
  html += "small{color:#555;}";
  html += "</style></head><body>";
  html += "<div class='card'><h2>AIQ WiFi Setup</h2>";
  html += "<form method='POST' action='/save'>";
  html += "<label>SSID</label>";
  html += "<input name='ssid' value='" + escapeHtml(wifiConfig.ssid) + "'>";
  html += "<label>Password</label>";
  html += "<input type='password' name='password' value='" + escapeHtml(wifiConfig.password) + "'>";
  html += "<button type='submit'>Save</button></form>";
  html += "<p><small>Login: admin / root</small></p>";
  html += "<p><small>Device ID: "; html += DEVICE_ID; html += "</small></p>";
  html += "<p><small>Status JSON at /status</small></p>";
  html += "</div></body></html>";
  return html;
}

void setupWebServer() {
#if HAS_MQTT
  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(200, "text/html", configPageHtml());
  });

  server.on("/save", HTTP_POST, [](AsyncWebServerRequest* request) {

    WifiConfig cfg;
    if (request->hasParam("ssid", true))     cfg.ssid     = request->getParam("ssid", true)->value();
    if (request->hasParam("password", true)) cfg.password = request->getParam("password", true)->value();

    if (cfg.ssid.length() == 0) {
      request->send(400, "text/plain", "SSID required");
      return;
    }

    if (!saveWifiConfig(cfg)) {
      request->send(500, "text/plain", "Save failed");
      return;
    }

    wifiConfig = cfg;
    request->send(200, "text/html", "<html><body><h3>Saved. Connecting...</h3></body></html>");
    WiFi.disconnect(true, true);
    delay(500);
    connectWifiIfNeeded();
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest* request) {
    request->send(200, "application/json", buildStatusJson());
  });

  server.begin();
#endif
}

// ======================================================
// SENSORS
// ======================================================
void readBmp280(SensorData& data) {
  data.temperatureC = bmp.readTemperature();
  data.pressureHpa  = bmp.readPressure() / 100.0f;
}

void readDustSensor(SensorData& data) {
  long sumRaw = 0;
  int validCount = 0;
  int minRaw = 4095;
  int maxRaw = 0;

  for (int i = 0; i < DUST_AVG_CYCLES; i++) {
    digitalWrite(PIN_DUST_LED, LOW);             // LOW = LED ON (active low)
    delayMicroseconds(DUST_LED_ON_TIME_US);      // wait 280us for VO peak

    int raw = analogRead(PIN_DUST_VO);           // sample at peak

    delayMicroseconds(DUST_WAIT_AFTER_SAMPLE_US);
    digitalWrite(PIN_DUST_LED, HIGH);            // HIGH = LED OFF
    delayMicroseconds(DUST_REST_TIME_US);

    if (raw > 20 && raw < 4090) {
      sumRaw += raw;
      validCount++;
      if (raw < minRaw) minRaw = raw;
      if (raw > maxRaw) maxRaw = raw;
    }
  }

  if (validCount == 0) {
    // No valid pulses — carry forward last smoothed value
    data.dustAdcRaw     = 0;
    data.dustVoltageRaw = 0.0f;
    data.dustUgM3Raw    = 0.0f;
    data.dustMinRaw     = 0;
    data.dustMaxRaw     = 0;
    data.dustValid      = false;
    data.dustAdc        = latest.dustAdc;
    data.dustVoltage    = latest.dustVoltage;
    data.dustUgM3       = latest.dustUgM3;
    return;
  }

  // --- Raw (pulse-averaged, pre-history) ---
  int avgRaw = sumRaw / validCount;
  data.dustAdcRaw     = avgRaw;
  data.dustVoltageRaw = adcToVoltage(avgRaw) * DUST_DIVIDER;  // actual VO
  data.dustUgM3Raw    = estimateDustUgM3(data.dustVoltageRaw);
  data.dustMinRaw     = minRaw;
  data.dustMaxRaw     = maxRaw;
  data.dustValid      = true;

  // --- Long history smoothing ---
  addDustHistory(avgRaw);
  int smoothedAdc = getDustHistoryAverage();
  data.dustAdc     = smoothedAdc;
  data.dustVoltage = adcToVoltage(smoothedAdc) * DUST_DIVIDER;  // actual VO
  data.dustUgM3    = estimateDustUgM3(data.dustVoltage);
}

void readMq2(SensorData& data) {
  data.mq2Adc     = analogRead(PIN_MQ2_AO);
  data.mq2Voltage = adcToVoltage(data.mq2Adc);
  data.mq2Digital = (data.mq2Voltage >= MQ2_DO_THRESHOLD_V);
}

void updateRelayLogic(SensorData& data) {
  bool on = latest.fanOn;

  if (!isnan(data.temperatureC)) {
    if (!on && data.temperatureC >= TEMP_FAN_ON_C) {
      on = true;
    } else if (on && data.temperatureC <= TEMP_FAN_OFF_C) {
      on = false;
    }
  }

  data.fanOn = on;
  writeRelayPin(on);
}

void readAllSensors() {
  SensorData data;

  readBmp280(data);
  readDustSensor(data);
  readMq2(data);

  data.uptimeMs = millis();

#if HAS_MQTT
  data.wifiRssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
#else
  data.wifiRssi = 0;
#endif

  updateRelayLogic(data);
  latest = data;
}

// ======================================================
// JSON
// ======================================================
String buildStatusJson() {
  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["ts"]        = millis();

  JsonObject bmpObj = doc["bmp280"].to<JsonObject>();
  bmpObj["temperature_c"] = latest.temperatureC;
  bmpObj["pressure_hpa"]  = latest.pressureHpa;

  JsonObject dustObj = doc["gp2y1010"].to<JsonObject>();
  dustObj["valid"]              = latest.dustValid;
  dustObj["adc_raw"]            = latest.dustAdcRaw;
  dustObj["voltage_raw_v"]      = latest.dustVoltageRaw;
  dustObj["dust_raw_ug_m3"]     = latest.dustUgM3Raw;
  dustObj["adc"]                = latest.dustAdc;
  dustObj["voltage_v"]          = latest.dustVoltage;
  dustObj["dust_ug_m3"]         = latest.dustUgM3;
  dustObj["aqi"]                = dustAQI(latest.dustUgM3);
  dustObj["pulse_min_raw"]      = latest.dustMinRaw;
  dustObj["pulse_max_raw"]      = latest.dustMaxRaw;
  dustObj["history_count"]      = dustHistoryCount;
  dustObj["baseline_v"]         = DUST_V_BASELINE;
  dustObj["avg_cycles"]         = DUST_AVG_CYCLES;
  dustObj["history_size"]       = DUST_HISTORY_SIZE;

  JsonObject mqObj = doc["mq2"].to<JsonObject>();
  mqObj["adc"]       = latest.mq2Adc;
  mqObj["voltage_v"] = latest.mq2Voltage;
  mqObj["do"]        = latest.mq2Digital;

  JsonObject fanObj = doc["fan"].to<JsonObject>();
  fanObj["relay"]      = latest.fanOn;
  fanObj["state"]      = latest.fanOn ? "on" : "off";
  fanObj["on_temp_c"]  = TEMP_FAN_ON_C;
  fanObj["off_temp_c"] = TEMP_FAN_OFF_C;

  doc["wifi_rssi_dbm"] = latest.wifiRssi;
  doc["uptime_ms"]     = latest.uptimeMs;
  doc["uptime_s"]      = latest.uptimeMs / 1000UL;

#if HAS_MQTT
  doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
  doc["mqtt_connected"] = mqttClient.connected();
#else
  doc["wifi_connected"] = false;
  doc["mqtt_connected"] = false;
#endif

  String payload;
  serializeJson(doc, payload);
  return payload;
}

// ======================================================
// SERIAL
// ======================================================
void printToSerial() {
  Serial.println("================ AIQ Monitor ================");
  Serial.print("BMP280 Temperature (C): "); Serial.println(latest.temperatureC, 2);
  Serial.print("BMP280 Pressure (hPa):  "); Serial.println(latest.pressureHpa, 2);

  Serial.print("Dust ADC Raw:          ");  Serial.println(latest.dustAdcRaw);
  Serial.print("Dust Voltage Raw (V):  ");  Serial.println(latest.dustVoltageRaw, 3);
  Serial.print("Dust ug/m3 Raw:        ");  Serial.println(latest.dustUgM3Raw, 2);
  Serial.print("Dust ADC Smoothed:     ");  Serial.println(latest.dustAdc);
  Serial.print("Dust Voltage (V):      ");  Serial.println(latest.dustVoltage, 3);
  Serial.print("Dust ug/m3 (est):      ");  Serial.println(latest.dustUgM3, 2);
  Serial.print("Dust AQI:              ");  Serial.println(dustAQI(latest.dustUgM3));
  Serial.print("Dust min/max raw:      ");
  Serial.print(latest.dustMinRaw);
  Serial.print(" / ");
  Serial.println(latest.dustMaxRaw);

  Serial.print("MQ2 ADC:               ");  Serial.println(latest.mq2Adc);
  Serial.print("MQ2 Voltage (V):       ");  Serial.println(latest.mq2Voltage, 3);
  Serial.print("MQ2 DO:                ");  Serial.println(latest.mq2Digital ? "HIGH" : "LOW");

  Serial.print("Relay/Fan:             ");  Serial.println(latest.fanOn ? "ON" : "OFF");

#if HAS_MQTT
  Serial.print("WiFi Status:           ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP:                    "); Serial.println(WiFi.localIP());
    Serial.print("RSSI (dBm):            "); Serial.println(WiFi.RSSI());
  }
  Serial.print("MQTT Status:           ");
  Serial.println(mqttClient.connected() ? "CONNECTED" : "DISCONNECTED");
#else
  Serial.println("WiFi/MQTT disabled by HAS_MQTT=0");
#endif

  Serial.println(buildStatusJson());
  Serial.println();
}

// ======================================================
// SETUP
// ======================================================
void setupBmp280() {
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (bmp.begin(0x76)) {
    Serial.println("[BMP280] Initialized at 0x76");
  } else {
    Serial.println("[BMP280] Not found at 0x76");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("AIQ monitor booting...");
  Serial.print("Dust pin LED = "); Serial.println(PIN_DUST_LED);
  Serial.print("Dust pin VO  = "); Serial.println(PIN_DUST_VO);

  pinMode(PIN_DUST_LED, OUTPUT);
  digitalWrite(PIN_DUST_LED, HIGH);  // LED OFF by default (active low)

  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, RELAY_ACTIVE_HIGH ? LOW : HIGH);
  latest.fanOn = false;

  pinMode(PIN_DUST_VO, INPUT);
  pinMode(PIN_MQ2_DO, INPUT);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Warm up ADC
  for (int i = 0; i < 30; i++) {
    analogRead(PIN_DUST_VO);
    analogRead(PIN_MQ2_AO);
    delay(5);
  }

  if (!LittleFS.begin(true)) {
    Serial.println("[FS] LittleFS mount failed");
  }

  setupBmp280();

#if HAS_MQTT
  loadWifiConfig(wifiConfig);
  startApMode();
  setupWebServer();
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(640);  // payload is ~460 bytes; default 256 is too small
  connectWifiIfNeeded();
#else
  Serial.println("[Config] HAS_MQTT=0, WiFi and MQTT disabled");
#endif
}

// ======================================================
// LOOP
// ======================================================
void loop() {
#if HAS_MQTT
  connectWifiIfNeeded();
  connectMqttIfNeeded();
  mqttClient.loop();
#endif

  unsigned long now = millis();

  if (now - lastSensorReadMs >= SENSOR_INTERVAL_MS) {
    lastSensorReadMs = now;
    readAllSensors();
  }

  if (now - lastSerialPrintMs >= SERIAL_INTERVAL_MS) {
    lastSerialPrintMs = now;
    printToSerial();
  }

#if HAS_MQTT
  if (mqttClient.connected() && now - lastMqttPublishMs >= MQTT_INTERVAL_MS) {
    lastMqttPublishMs = now;
    String payload = buildStatusJson();
    bool ok = mqttClient.publish(MQTT_TOPIC, payload.c_str(), true);
    Serial.print("[MQTT] Publish "); Serial.println(ok ? "OK" : "FAILED");
  }
#endif
}