import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "mysql+pymysql://root:password@localhost/aqi_db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.emqx.io")
    MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
    MQTT_TOPIC = os.getenv("MQTT_TOPIC", "extraiot/aqi/team1/data")