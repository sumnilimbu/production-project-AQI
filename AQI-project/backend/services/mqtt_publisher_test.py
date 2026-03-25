import json
import paho.mqtt.client as mqtt

BROKER = "broker.emqx.io"
PORT = 1883
TOPIC = "extraiot/aqi/team1/data"

payload = {
    "device_id": "sensor_02",
    "pm25": 52.1,
    "pm10": 81.3,
    "temperature": 30.2,
    "humidity": 60.5,
    "co2": 425.0
}

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect(BROKER, PORT, 60)
client.publish(TOPIC, json.dumps(payload))
client.disconnect()

print("Test MQTT message published successfully!")