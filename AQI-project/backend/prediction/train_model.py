import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

data = [
    # station, pm25, temperature, mq2, pressure, hour, next_aqi
    ["Industrial", 35, 28, 400, 982, 9, 95],
    ["Industrial", 55, 30, 600, 981, 10, 135],
    ["Industrial", 85, 31, 800, 981, 11, 165],
    ["Industrial", 120, 32, 950, 980, 12, 190],
    ["Industrial", 45, 29, 500, 982, 13, 110],

    ["Forest", 20, 27, 250, 983, 9, 60],
    ["Forest", 35, 30, 350, 982, 10, 90],
    ["Forest", 50, 33, 550, 981, 11, 125],
    ["Forest", 70, 36, 750, 980, 12, 155],
    ["Forest", 90, 38, 900, 979, 13, 180],
]

df = pd.DataFrame(
    data,
    columns=["station", "pm25", "temperature", "mq2", "pressure", "hour", "next_aqi"]
)

df["station_code"] = df["station"].map({
    "Industrial": 1,
    "Forest": 2
})

X = df[["station_code", "pm25", "temperature", "mq2", "pressure", "hour"]]
y = df["next_aqi"]

model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X, y)

joblib.dump(model, "aqi_model.pkl")

print("AQI prediction model trained and saved as aqi_model.pkl")