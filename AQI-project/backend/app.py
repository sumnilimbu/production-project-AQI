from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from config import Config
from models.database import db
from models.sensor_reading import SensorReading
from routes.sensor_routes import sensor_bp
import json
import paho.mqtt.client as mqtt

socketio = SocketIO(cors_allowed_origins="*")

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)
    socketio.init_app(app)

    app.register_blueprint(sensor_bp)

    @app.route("/")
    def home():
        return jsonify({
            "message": "AQI Flask backend is running"
        })

    return app


app = create_app()


# MQTT callbacks
def on_connect(client, userdata, flags, rc):
    print("Connected to MQTT Broker")
    client.subscribe("aqi/industrial")
    client.subscribe("aqi/forest")


def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode())
        print("Live MQTT Data:", data)

        # Send live data to React dashboard
        socketio.emit("live-aqi-data", data)

    except Exception as e:
        print("MQTT Error:", e)


def start_mqtt():
    mqtt_client = mqtt.Client()
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message
    mqtt_client.connect("broker.hivemq.com", 1883, 60)
    mqtt_client.loop_start()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        print("Database tables created!")

    start_mqtt()

    socketio.run(app, host="0.0.0.0", port=5000, debug=True)