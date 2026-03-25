from flask import Blueprint, request, jsonify
from models.database import db
from models.sensor_reading import SensorReading
from datetime import datetime

sensor_bp = Blueprint("sensor_bp", __name__)

@sensor_bp.route("/api/readings", methods=["POST"])
def add_reading():
    try:
        data = request.get_json()

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

        return jsonify({
            "message": "Sensor reading added successfully"
        }), 201

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


@sensor_bp.route("/api/readings", methods=["GET"])
def get_readings():
    try:
        readings = SensorReading.query.order_by(SensorReading.timestamp.desc()).all()

        result = []
        for reading in readings:
            result.append({
                "id": reading.id,
                "device_id": reading.device_id,
                "pm25": reading.pm25,
                "pm10": reading.pm10,
                "temperature": reading.temperature,
                "humidity": reading.humidity,
                "co2": reading.co2,
                "timestamp": reading.timestamp.isoformat() if reading.timestamp else None
            })

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500