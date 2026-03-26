import json
import time
import paho.mqtt.client as mqtt

BROKER = "broker.emqx.io"
PORT = 1883
TOPIC = "extraiot/aqi/team1/data"

messages = [
    {
        "station_name": "Industrial",
        "pm25": 160.0,
        "pm10": 210.0,
        "temperature": 31.2,
        "humidity": 58.0,
        "co2": 460.0
    },
    {
        "station_name": "Forest",
        "pm25": 32.0,
        "pm10": 48.0,
        "temperature": 25.5,
        "humidity": 72.0,
        "co2": 390.0
    }
]

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.connect(BROKER, PORT, 60)

for payload in messages:
    client.publish(TOPIC, json.dumps(payload))
    print("Published:", payload)
    time.sleep(1)

client.disconnect()
print("Test MQTT messages published successfully!")