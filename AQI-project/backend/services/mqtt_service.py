import sys
import os

# Add backend folder to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from datetime import datetime
import paho.mqtt.client as mqtt

from app import app
from models.database import db
from models.sensor_reading import SensorReading
from config import Config


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("Connected to MQTT broker successfully!")
        client.subscribe(Config.MQTT_TOPIC)
        print(f"Subscribed to topic: {Config.MQTT_TOPIC}")
    else:
        print(f"Failed to connect to MQTT broker. Return code: {rc}")


def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        print(f"Received MQTT message: {payload}")

        data = json.loads(payload)

        with app.app_context():
            new_reading = SensorReading(
                device_id=data.get("device_id"),
                pm25=data.get("pm25"),
                pm10=data.get("pm10"),
                temperature=data.get("temperature"),
                humidity=data.get("humidity"),
                co2=data.get("co2"),
                timestamp=datetime.utcnow()
            )

            db.session.add(new_reading)
            db.session.commit()

            print("Sensor reading saved to database!")

    except Exception as e:
        print(f"Error processing MQTT message: {e}")


def start_mqtt():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message

    client.connect(Config.MQTT_BROKER, Config.MQTT_PORT, 60)
    client.loop_forever()


if __name__ == "__main__":
    start_mqtt()