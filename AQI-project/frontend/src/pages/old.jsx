import { useEffect, useState } from "react";
import api from "../services/api";
import StationCard from "../components/StationCard";

function Dashboard() {
  const [latestReadings, setLatestReadings] = useState([]);
  const [allReadings, setAllReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const latestResponse = await api.get("/api/latest-readings");
      const allResponse = await api.get("/api/readings");

      setLatestReadings(Array.isArray(latestResponse.data) ? latestResponse.data : []);
      setAllReadings(Array.isArray(allResponse.data) ? allResponse.data : []);
      setError("");
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Failed to fetch data from backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const industrial = latestReadings.find(
    (reading) => reading.station_name === "Industrial"
  );

  const forest = latestReadings.find(
    (reading) => reading.station_name === "Forest"
  );

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Smart AQI Monitoring and Control Dashboard</h1>

      {loading && <p>Loading dashboard...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <>
          <div style={styles.cardContainer}>
            <StationCard station={industrial} />
            <StationCard station={forest} />
          </div>

          <div style={styles.tableSection}>
            <h2>Stored Readings</h2>

            {allReadings.length === 0 ? (
              <p>No readings found.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Station</th>
                    <th>PM2.5</th>
                    <th>PM10</th>
                    <th>Temp</th>
                    <th>Humidity</th>
                    <th>CO2</th>
                    <th>AQI</th>
                    <th>Category</th>
                    <th>Fan</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {allReadings.map((reading) => (
                    <tr key={reading.id}>
                      <td>{reading.id}</td>
                      <td>{reading.station_name}</td>
                      <td>{reading.pm25}</td>
                      <td>{reading.pm10}</td>
                      <td>{reading.temperature}</td>
                      <td>{reading.humidity}</td>
                      <td>{reading.co2}</td>
                      <td>{reading.aqi}</td>
                      <td>{reading.aqi_category}</td>
                      <td>{reading.fan_status}</td>
                      <td>{reading.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: "20px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f5f7fa",
    minHeight: "100vh",
    color: "#000"
  },
  title: {
    textAlign: "center",
    marginBottom: "30px"
  },
  cardContainer: {
    display: "flex",
    gap: "20px",
    marginBottom: "30px"
  },
  tableSection: {
    backgroundColor: "#fff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    overflowX: "auto"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse"
  }
};

export default Dashboard;