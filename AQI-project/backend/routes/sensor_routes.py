from flask import Blueprint, request, jsonify
from models.database import db
from models.sensor_reading import SensorReading
from datetime import datetime
from services.aqi_service import calculate_pm25_aqi, determine_fan_status, get_aqi_category

sensor_bp = Blueprint("sensor_bp", __name__)


@sensor_bp.route("/api/readings", methods=["POST"])
def add_reading():
    try:
        data = request.get_json()

        station_name = data.get("station_name")
        pm25 = float(data.get("pm25"))
        pm10 = float(data.get("pm10"))
        temperature = data.get("temperature")
        humidity = data.get("humidity")
        co2 = data.get("co2")

        aqi = calculate_pm25_aqi(pm25)

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

        return jsonify({
            "message": "Sensor reading added successfully",
            "aqi": aqi,
            "aqi_category": get_aqi_category(aqi),
            "fan_status": fan_status
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sensor_bp.route("/api/readings", methods=["GET"])
def get_readings():
    try:
        readings = SensorReading.query.order_by(SensorReading.timestamp.desc()).all()

        result = []
        for reading in readings:
            result.append({
                "id": reading.id,
                "station_name": reading.station_name,
                "pm25": reading.pm25,
                "pm10": reading.pm10,
                "temperature": reading.temperature,
                "humidity": reading.humidity,
                "co2": reading.co2,
                "aqi": reading.aqi,
                "aqi_category": get_aqi_category(reading.aqi) if reading.aqi is not None else None,
                "fan_status": reading.fan_status,
                "timestamp": reading.timestamp.isoformat() if reading.timestamp else None
            })

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@sensor_bp.route("/api/latest-readings", methods=["GET"])
def get_latest_station_readings():
    try:
        stations = ["Industrial", "Forest"]
        latest_data = []

        for station in stations:
            reading = (
                SensorReading.query
                .filter_by(station_name=station)
                .order_by(SensorReading.timestamp.desc())
                .first()
            )

            if reading:
                latest_data.append({
                    "id": reading.id,
                    "station_name": reading.station_name,
                    "pm25": reading.pm25,
                    "pm10": reading.pm10,
                    "temperature": reading.temperature,
                    "humidity": reading.humidity,
                    "co2": reading.co2,
                    "aqi": reading.aqi,
                    "aqi_category": get_aqi_category(reading.aqi) if reading.aqi is not None else None,
                    "fan_status": reading.fan_status,
                    "timestamp": reading.timestamp.isoformat() if reading.timestamp else None
                })

        return jsonify(latest_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500