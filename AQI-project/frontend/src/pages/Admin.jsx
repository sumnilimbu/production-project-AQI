import { useEffect, useMemo, useState } from "react";
import mqtt from "mqtt";

const DEVICE_ID = "admin-aqi";
const MQTT_HOST = "broker.hivemq.com";
const MQTT_WS_PORT = 8000;

const MQTT_TOPICS = [
  "aiqdata/esp32-aiq-indurstrial",
  "aiqdata/esp32-aiq-forest",
];

function calculatePM25AQI(pm25) {
  const value = Number(pm25);
  if (Number.isNaN(value) || value < 0) return null;

  const breakpoints = [
    { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
    { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 },
  ];

  const bp = breakpoints.find(
    (item) => value >= item.cLow && value <= item.cHigh
  );

  if (!bp) return 500;

  return Math.round(
    ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) *
      (value - bp.cLow) +
      bp.iLow
  );
}

function getAQICategory(aqi) {
  if (aqi === null || aqi === "--") return "--";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

export default function Admin() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [stationFilter, setStationFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    const clientId = `react-${DEVICE_ID}-${Math.random()
      .toString(16)
      .slice(2)}`;

    const client = mqtt.connect(`ws://${MQTT_HOST}:${MQTT_WS_PORT}/mqtt`, {
      clientId,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 3000,
    });

    client.on("connect", () => {
      console.log("Admin MQTT connected:", clientId);
      setError("");

      client.subscribe(MQTT_TOPICS, (err) => {
        if (err) {
          console.error("Admin MQTT subscribe error:", err);
          setError(err.message);
          return;
        }

        console.log("Admin subscribed to MQTT topics:", MQTT_TOPICS);
      });
    });

    client.on("message", (topic, payload) => {
      const message = payload.toString();

      let newReading;

      try {
        newReading = JSON.parse(message);
      } catch (err) {
        console.error("Invalid MQTT JSON:", err);
        return;
      }

      setData((prevData) => {
        const pm25Value = Number(newReading.gp2y1010?.dust_ug_m3);
const aqiValue = calculatePM25AQI(pm25Value);

const normalizedReading = {
  id: Date.now(),

  station_name:
    topic.includes("forest") || newReading.station === "forest"
      ? "Forest"
      : "Industrial",

  timestamp: new Date().toISOString(),

  temperature: newReading.bmp280?.temperature_c ?? "--",

  pm25: Number.isNaN(pm25Value) ? "--" : Number(pm25Value.toFixed(2)),
  aqi: aqiValue ?? "--",
  aqi_category: getAQICategory(aqiValue),

  mq2: newReading.mq2?.adc ?? "--",
  mq2_voltage: newReading.mq2?.voltage_v ?? "--",

  fan_status: newReading.fan?.state?.toUpperCase() ?? "--",
  pump_status: newReading.fan?.state?.toUpperCase() ?? "--",
};

        return [normalizedReading, ...prevData].slice(0, 100);
      });
    });

    client.on("error", (err) => {
      console.error("Admin MQTT error:", err);
      setError(err.message);
    });

    return () => {
      client.end(true);
    };
  }, []);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesStation =
        stationFilter === "All" || item.station_name === stationFilter;

      const matchesDate =
        !dateFilter ||
        new Date(item.timestamp).toISOString().slice(0, 10) === dateFilter;

      return matchesStation && matchesDate;
    });
  }, [data, stationFilter, dateFilter]);

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-3xl font-bold text-slate-800">
          Admin / Live History Page
        </h1>

        {error && (
          <p className="mb-4 rounded-lg bg-red-100 p-3 text-red-700">
            Error: {error}
          </p>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl bg-white p-4 shadow-md md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Filter by Station
            </label>
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="All">All</option>
              <option value="Industrial">Industrial</option>
              <option value="Forest">Forest</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Filter by Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setStationFilter("All");
                setDateFilter("");
              }}
              className="w-full rounded-lg bg-slate-800 px-4 py-2 font-medium text-white hover:bg-slate-700"
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-white shadow-md">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3">Station</th>
                <th className="px-4 py-3">PM2.5</th>
                <th className="px-4 py-3">MQ-2 Gas</th>
                <th className="px-4 py-3">Temperature</th>
                <th className="px-4 py-3">AQI</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Fan</th>
                <th className="px-4 py-3">Pump</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>


            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr
                    key={`${item.station_name}-${item.timestamp}-${item.id}`}
                    className="border-b border-slate-200 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">{item.station_name}</td>
                    <td className="px-4 py-3">{item.pm25 ?? "--"}µg/m³</td>
                    <td className="px-4 py-3">{item.mq2 ?? "--"}</td>
                    <td className="px-4 py-3">
                      {item.temperature ?? "--"} °C
                    </td>
                     <td className="px-4 py-3">{item.aqi ?? "--"}</td>
                    <td className="px-4 py-3">
                      {item.aqi_category ?? "--"}
                    </td>
                    <td className="px-4 py-3">
                      {item.station_name === "Industrial"
                        ? item.fan_status ?? "--"
                        : "--"}
                    </td>
                    <td className="px-4 py-3">
                      {item.station_name === "Forest"
                        ? item.pump_status ?? "--"
                        : "--"}
                    </td>
                    <td className="px-4 py-3">
                      {item.timestamp
                        ? new Date(item.timestamp).toLocaleString()
                        : "--"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="10"
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No live readings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}