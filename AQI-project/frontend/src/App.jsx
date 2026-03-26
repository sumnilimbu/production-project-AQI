import { useEffect, useState } from "react";

export default function App() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/readings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch data");
        return res.json();
      })
      .then((result) => setData(result))
      .catch((err) => setError(err.message));
  }, []);

  const latestIndustrial = data.find((item) => item.station_name === "Industrial");
  const latestForest = data.find((item) => item.station_name === "Forest");

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", background: "#f5f7fa", minHeight: "100vh" }}>
      <h1 style={{ textAlign: "center" }}>Air Quality Monitoring Dashboard</h1>

      {error && <p style={{ color: "red", textAlign: "center" }}>Error: {error}</p>}

      <div style={{ display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap", marginTop: "30px" }}>
        <div style={{ background: "white", padding: "20px", borderRadius: "12px", width: "320px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <h2>Industrial Station</h2>
          {latestIndustrial ? (
            <>
              <p><strong>AQI:</strong> {latestIndustrial.aqi}</p>
              <p><strong>Category:</strong> {latestIndustrial.aqi_category}</p>
              <p><strong>PM2.5:</strong> {latestIndustrial.pm25}</p>
              <p><strong>PM10:</strong> {latestIndustrial.pm10}</p>
              <p><strong>Temperature:</strong> {latestIndustrial.temperature} °C</p>
              <p><strong>Humidity:</strong> {latestIndustrial.humidity} %</p>
              <p><strong>CO2:</strong> {latestIndustrial.co2}</p>
              <p><strong>Fan Status:</strong> {latestIndustrial.fan_status}</p>
              <p><strong>Updated:</strong> {new Date(latestIndustrial.timestamp).toLocaleString()}</p>
            </>
          ) : (
            <p>No Industrial data</p>
          )}
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "12px", width: "320px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <h2>Forest Station</h2>
          {latestForest ? (
            <>
              <p><strong>AQI:</strong> {latestForest.aqi}</p>
              <p><strong>Category:</strong> {latestForest.aqi_category}</p>
              <p><strong>PM2.5:</strong> {latestForest.pm25}</p>
              <p><strong>PM10:</strong> {latestForest.pm10}</p>
              <p><strong>Temperature:</strong> {latestForest.temperature} °C</p>
              <p><strong>Humidity:</strong> {latestForest.humidity} %</p>
              <p><strong>CO2:</strong> {latestForest.co2}</p>
              <p><strong>Fan Status:</strong> {latestForest.fan_status}</p>
              <p><strong>Updated:</strong> {new Date(latestForest.timestamp).toLocaleString()}</p>
            </>
          ) : (
            <p>No Forest data</p>
          )}
        </div>
      </div>

      <div style={{ marginTop: "30px", background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <h2>System Summary</h2>
        <p>
          The industrial area currently has {latestIndustrial ? latestIndustrial.aqi_category : "no"} AQI conditions,
          and the forest area currently has {latestForest ? latestForest.aqi_category : "no"} AQI conditions.
        </p>
        <p>
          {latestIndustrial && latestIndustrial.fan_status === "ON"
            ? "The industrial fan is currently active to reduce pollution."
            : "The industrial fan is currently inactive."}
        </p>
      </div>
    </div>
  );
}