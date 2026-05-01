import joblib
from datetime import datetime

import os

model_path = os.path.join(os.path.dirname(__file__), "aqi_model.pkl")
model = joblib.load(model_path)

def get_category(aqi):
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"

def predict_station(station_name, pm25, temperature, mq2, pressure):
    station_code = 1 if station_name == "Industrial" else 2
    hour = datetime.now().hour

    features = [[station_code, pm25, temperature, mq2, pressure, hour]]
    predicted_aqi = round(model.predict(features)[0])

    return {
        "station": station_name,
        "predicted_aqi": predicted_aqi,
        "category": get_category(predicted_aqi)
    }

def predict_both_stations(industrial_data, forest_data):
    return {
        "industrial": predict_station("Industrial", **industrial_data),
        "forest": predict_station("Forest", **forest_data)
    }