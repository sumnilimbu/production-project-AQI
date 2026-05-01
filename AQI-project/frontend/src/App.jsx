import { useEffect, useMemo, useState } from "react";
import mqtt from "mqtt";
import { Routes, Route, Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import { Navigate } from "react-router-dom";

const DEVICE_ID = "esp32-aiq-02";
const MQTT_HOST = "broker.hivemq.com";
const MQTT_WS_PORT = 8884;

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

function Dashboard() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [prediction, setPrediction] = useState(null);

  
  useEffect(() => {
    const clientId = `react-${DEVICE_ID}-${Math.random()
      .toString(16)
      .slice(2)}`;

    const client = mqtt.connect(`wss://${MQTT_HOST}:${MQTT_WS_PORT}/mqtt`, {
      clientId,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 3000,
    });

    client.on("connect", () => {
      console.log("MQTT connected:", clientId);
      setError("");

      client.subscribe(MQTT_TOPICS, (err) => {
        if (err) {
          console.error("MQTT subscribe error:", err);
          setError(err.message);
          return;
        }

        console.log("Subscribed to MQTT topics:", MQTT_TOPICS);
      });
    });

    client.on("message", (topic, payload) => {
      const message = payload.toString();

      console.log("MQTT data received");
      console.log("Topic:", topic);
      console.log("Raw message:", message);

      let newReading;

      try {
        newReading = JSON.parse(message);
        console.log("Parsed MQTT JSON:", newReading);
      } catch (err) {
        console.error("Invalid MQTT JSON:", err);
        return;
      }

      setData((prevData) => {
        const isForest =
          topic.includes("forest") || newReading.station === "forest";

        const pm25Value = Number(newReading.gp2y1010?.dust_ug_m3);
const aqiValue = calculatePM25AQI(pm25Value);

const normalizedReading = {
  device_id: newReading.device_id,

  station_name: isForest ? "Forest" : "Industrial",

  timestamp: new Date().toISOString(),

  temperature: newReading.bmp280?.temperature_c ?? "--",
  pressure: newReading.bmp280?.pressure_hpa ?? "--",

  pm25: Number.isNaN(pm25Value) ? "--" : Number(pm25Value.toFixed(2)),
  aqi: aqiValue ?? "--",
  aqi_category: getAQICategory(aqiValue),

  mq2: newReading.mq2?.adc ?? "--",
  mq2_voltage: newReading.mq2?.voltage_v ?? "--",
  mq2_detected: newReading.mq2?.do ?? false,

  fan_status: newReading.fan?.state?.toUpperCase() ?? "--",
  pump_status: newReading.fan?.state?.toUpperCase() ?? "--",

  wifi_rssi_dbm: newReading.wifi_rssi_dbm,
  uptime_s: newReading.uptime_s,
};

        return [normalizedReading, ...prevData].slice(0, 50);
      });
    });

    client.on("error", (err) => {
      console.error("MQTT error:", err);
      setError(err.message);
    });

    client.on("reconnect", () => {
      console.log("MQTT reconnecting...");
    });

    client.on("close", () => {
      console.log("MQTT connection closed");
    });

    return () => {
      client.end(true);
    };
  }, []);

  const latestIndustrial = useMemo(
    () => data.find((item) => item.station_name === "Industrial"),
    [data]
  );

  const latestForest = useMemo(
    () => data.find((item) => item.station_name === "Forest"),
    [data]
  );

  const fetchPrediction = async () => {
  try {
    if (!latestIndustrial || !latestForest) return;

    const response = await fetch("http://localhost:5001/api/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        industrial: {
          pm25: Number(latestIndustrial.pm25) || 0,
          temperature: Number(latestIndustrial.temperature) || 0,
          mq2: Number(latestIndustrial.mq2) || 0,
          pressure: Number(latestIndustrial.pressure) || 0,
        },
        forest: {
          pm25: Number(latestForest.pm25) || 0,
          temperature: Number(latestForest.temperature) || 0,
          mq2: Number(latestForest.mq2) || 0,
          pressure: Number(latestForest.pressure) || 0,
        },
      }),
    });

    const result = await response.json();
    setPrediction(result);
  } catch (err) {
    console.error("Prediction error:", err);
  }
};

useEffect(() => {
  fetchPrediction();
}, [latestIndustrial, latestForest]);

  const getAqiColor = (category) => {
    switch (category) {
      case "Good":
        return "bg-green-500 text-white";
      case "Moderate":
        return "bg-yellow-400 text-black";
      case "Unhealthy":
        return "bg-orange-500 text-white";
      case "Very Unhealthy":
        return "bg-red-600 text-white";
      case "Hazardous":
        return "bg-purple-700 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  const chartData = useMemo(() => {
    return data
      .slice()
      .reverse()
      .map((item) => ({
        ...item,
        shortTime: new Date(item.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
  }, [data]);

  const combinedStationData = useMemo(() => {
    return chartData.reduce((acc, item) => {
      const existing = acc.find((d) => d.shortTime === item.shortTime);

      if (existing) {
        if (item.station_name === "Industrial") {
          existing.industrialAqi = item.aqi;
          existing.industrialPm25 = item.pm25;
        }

        if (item.station_name === "Forest") {
          existing.forestAqi = item.aqi;
          existing.forestPm25 = item.pm25;
        }
      } else {
        acc.push({
          shortTime: item.shortTime,
          industrialAqi: item.station_name === "Industrial" ? item.aqi : null,
          forestAqi: item.station_name === "Forest" ? item.aqi : null,
          industrialPm25:
            item.station_name === "Industrial" ? item.pm25 : null,
          forestPm25: item.station_name === "Forest" ? item.pm25 : null,
        });
      }

      return acc;
    }, []);
  }, [chartData]);

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-center text-3xl font-bold text-slate-800 sm:text-left">
            Air Quality Monitoring Dashboard
          </h1>

          <Link
            to="/admin"
            className="inline-block rounded-lg bg-slate-800 px-4 py-2 text-center text-white hover:bg-slate-700"
          >
            Go to Admin Page
          </Link>
        </div>

        {error && (
          <p className="mb-6 text-center font-medium text-red-600">
            Error: {error}
          </p>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-md">
            <p className="text-sm text-slate-500">Industrial AQI</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">
              {latestIndustrial?.aqi ?? "--"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-md">
            <p className="text-sm text-slate-500">Forest AQI</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">
              {latestForest?.aqi ?? "--"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-md">
            <p className="text-sm text-slate-500">Industrial Fan</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">
              {latestIndustrial?.fan_status ?? "--"}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-md">
            <p className="text-sm text-slate-500">Forest Pump</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">
              {latestForest?.pump_status ?? "--"}
            </p>
          </div>
        </div>

                   {prediction && (
  <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
    <div className="rounded-2xl bg-white p-5 shadow-md">
      <p className="text-sm text-slate-500">Industrial Predicted AQI Next Hour</p>
      <p className="mt-2 text-3xl font-bold text-slate-800">
        {prediction.industrial?.predicted_aqi ?? "--"}
      </p>
      <p className="mt-1 font-medium text-slate-600">
        {prediction.industrial?.category ?? "--"}
      </p>
    </div>

    <div className="rounded-2xl bg-white p-5 shadow-md">
      <p className="text-sm text-slate-500">Forest Predicted AQI Next Hour</p>
      <p className="mt-2 text-3xl font-bold text-slate-800">
        {prediction.forest?.predicted_aqi ?? "--"}
      </p>
      <p className="mt-1 font-medium text-slate-600">
        {prediction.forest?.category ?? "--"}
      </p>
    </div>
  </div>
)}

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">
              Industrial Station
            </h2>

            {latestIndustrial ? (
              <>
                <div
                  className={`mb-5 rounded-xl p-4 ${getAqiColor(
                    latestIndustrial.aqi_category
                  )}`}
                >
                  <p className="text-2xl font-bold">
                    AQI: {latestIndustrial.aqi}
                  </p>
                  <p className="text-sm font-medium">
                    {latestIndustrial.aqi_category}
                  </p>
                </div>

                <div className="space-y-2 text-slate-700">
                  <p>
                    <span className="font-semibold">PM2.5:</span>{" "}
                    {latestIndustrial.pm25} µg/m³
                  </p>
                  <p>
                    <span className="font-semibold">MQ-2 Gas:</span>{" "}
                    {latestIndustrial.mq2}
                  </p>
                  <p>
                    <span className="font-semibold">Temperature:</span>{" "}
                    {latestIndustrial.temperature} °C
                  </p>
                  <p>
                    <span className="font-semibold">Fan Status:</span>{" "}
                    <span
                      className={
                        latestIndustrial.fan_status === "ON"
                          ? "font-bold text-red-600"
                          : "font-bold text-green-600"
                      }
                    >
                      {latestIndustrial.fan_status}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold">Updated:</span>{" "}
                    {new Date(latestIndustrial.timestamp).toLocaleString()}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-slate-500">No Industrial data</p>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">
              Forest Station
            </h2>

            {latestForest ? (
              <>
                <div
                  className={`mb-5 rounded-xl p-4 ${getAqiColor(
                    latestForest.aqi_category
                  )}`}
                >
                  <p className="text-2xl font-bold">AQI: {latestForest.aqi}</p>
                  <p className="text-sm font-medium">
                    {latestForest.aqi_category}
                  </p>
                </div>

                <div className="space-y-2 text-slate-700">
                  <p>
                    <span className="font-semibold">PM2.5:</span>{" "}
                    {latestForest.pm25} µg/m³
                  </p>
                  <p>
                    <span className="font-semibold">MQ-2 Gas:</span>{" "}
                    {latestForest.mq2}
                  </p>
                  <p>
                    <span className="font-semibold">Temperature:</span>{" "}
                    {latestForest.temperature} °C
                  </p>
                  <p>
                    <span className="font-semibold">Pump Status:</span>{" "}
                    <span
                      className={
                        latestForest.pump_status === "ON"
                          ? "font-bold text-blue-600"
                          : "font-bold text-green-600"
                      }
                    >
                      {latestForest.pump_status}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold">Updated:</span>{" "}
                    {new Date(latestForest.timestamp).toLocaleString()}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-slate-500">No Forest data</p>
            )}
          </div>
        </div>

        <div className="mb-8 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-semibold text-slate-800">
                AQI Trend by Station
              </h2>
                <div className="h-80 min-h-[320px] min-w-0">                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combinedStationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="shortTime" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="industrialAqi"
                      name="Industrial AQI"
                      stroke="#ef4444"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="forestAqi"
                      name="Forest AQI"
                      stroke="#22c55e"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-semibold text-slate-800">
                PM2.5 and MQ-2 Levels
              </h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="shortTime" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="pm25"
                      name="PM2.5"
                      stroke="#16a34a"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="mq2"
                      name="MQ-2 Gas"
                      stroke="#dc2626"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold text-slate-800">
              PM2.5 Comparison by Station
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedStationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="shortTime" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="industrialPm25"
                    name="Industrial PM2.5"
                    stroke="#f97316"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="forestPm25"
                    name="Forest PM2.5"
                    stroke="#22c55e"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            System Summary
          </h2>

          <div className="space-y-2 text-slate-700">
            <p>
              The industrial area currently has{" "}
              <span className="font-semibold">
                {latestIndustrial ? latestIndustrial.aqi_category : "no"}
              </span>{" "}
              AQI conditions.
            </p>
            <p>
              The forest area currently has{" "}
              <span className="font-semibold">
                {latestForest ? latestForest.aqi_category : "no"}
              </span>{" "}
              AQI conditions.
            </p>
            <p>
              {latestIndustrial && latestIndustrial.fan_status === "ON"
                ? "The industrial fan is currently active to reduce pollution."
                : "The industrial fan is currently inactive."}
            </p>
            <p>
              {latestForest && latestForest.pump_status === "ON"
                ? "The forest water pump is currently active."
                : "The forest water pump is currently inactive."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminWithNav() {
  return (
    <>
      <div className="bg-slate-800 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="font-semibold">AQI Admin Panel</p>

          <div className="flex gap-3">
            <Link
              to="/"
              className="rounded-lg bg-white px-4 py-2 text-slate-800 hover:bg-slate-100"
            >
              Back to Dashboard
            </Link>

            <button
              onClick={() => {
                localStorage.removeItem("adminLoggedIn");
                window.location.href = "/login";
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <Admin />
    </>
  );
}

function ProtectedAdmin() {
  const isLoggedIn = localStorage.getItem("adminLoggedIn") === "true";

  return isLoggedIn ? <AdminWithNav /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/login" element={<Login />} />
  <Route path="/admin" element={<ProtectedAdmin />} />
</Routes>
  );
}