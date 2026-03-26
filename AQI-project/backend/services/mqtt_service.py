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
from services.aqi_service import calculate_pm25_aqi, determine_fan_status


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

        station_name = data.get("station_name")
        pm25 = float(data.get("pm25"))
        pm10 = float(data.get("pm10"))
        temperature = data.get("temperature")
        humidity = data.get("humidity")
        co2 = data.get("co2")

        aqi = calculate_pm25_aqi(pm25)

        with app.app_context():
            previous_industrial = (
                SensorReading.query
                .filter_by(station_name="Industrial")
                .order_by(SensorReading.timestamp.desc())
                .first()
            )

            previous_fan_status = previous_industrial.fan_status if previous_industrial else "OFF"
            fan_status = determine_fan_status(station_name, aqi, previous_fan_status)

            new_reading = SensorReading(
                station_name=station_name,
                pm25=pm25,
                pm10=pm10,
                temperature=temperature,
                humidity=humidity,
                co2=co2,
                aqi=aqi,
                fan_status=fan_status,
                timestamp=datetime.utcnow()
            )

            db.session.add(new_reading)
            db.session.commit()

            print(f"Saved {station_name} reading | AQI={aqi} | Fan={fan_status}")

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