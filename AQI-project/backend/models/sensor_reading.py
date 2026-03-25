from models.database import db
from datetime import datetime

class SensorReading(db.Model):
    __tablename__ = "sensor_readings"

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50))
    pm25 = db.Column(db.Float)
    pm10 = db.Column(db.Float)
    temperature = db.Column(db.Float)
    humidity = db.Column(db.Float)
    co2 = db.Column(db.Float)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)