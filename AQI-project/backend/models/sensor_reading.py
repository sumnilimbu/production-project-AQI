from models.database import db
from datetime import datetime

class SensorReading(db.Model):
    __tablename__ = "sensor_readings"

    id = db.Column(db.Integer, primary_key=True)
    station_name = db.Column(db.String(50), nullable=False)
    pm25 = db.Column(db.Float, nullable=False)
    pm10 = db.Column(db.Float, nullable=False)
    temperature = db.Column(db.Float, nullable=True)
    humidity = db.Column(db.Float, nullable=True)
    co2 = db.Column(db.Float, nullable=True)
    aqi = db.Column(db.Integer, nullable=True)
    fan_status = db.Column(db.String(10), default="N/A")
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)