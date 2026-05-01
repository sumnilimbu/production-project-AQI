function StationCard({ station }) {
  if (!station) {
    return (
      <div style={styles.card}>
        <h2>No Data</h2>
        <p>No station data available yet.</p>
      </div>
    );
  }

  const isIndustrial = station.station_name === "Industrial";

  return (
    <div style={styles.card}>
      <h2>{station.station_name} Station</h2>
      <p><strong>AQI:</strong> {station.aqi ?? "N/A"}</p>
      <p><strong>Category:</strong> {station.aqi_category ?? "N/A"}</p>
      <p><strong>PM2.5:</strong> {station.pm25 ?? "N/A"}</p>
      <p><strong>Temperature:</strong> {station.temperature ?? "N/A"} °C</p>
      {isIndustrial && <p><strong>Fan Status:</strong> {station.fan_status ?? "N/A"}</p>}
      <p><strong>Last Updated:</strong> {station.timestamp ?? "N/A"}</p>
    </div>
  );
}

const styles = {
  card: {
    flex: 1,
    border: "1px solid #ccc",
    borderRadius: "10px",
    padding: "20px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    backgroundColor: "#fff",
    color: "#000"
  }
};

export default StationCard;