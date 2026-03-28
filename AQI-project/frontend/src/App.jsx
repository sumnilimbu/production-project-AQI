import { useEffect, useMemo, useState } from "react";
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

export default function App() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = () => {
      fetch("http://127.0.0.1:5000/api/readings")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch data");
          return res.json();
        })
        .then((result) => {
          setData(result);
          setError("");
        })
        .catch((err) => setError(err.message));
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  const latestIndustrial = useMemo(
    () => data.find((item) => item.station_name === "Industrial"),
    [data]
  );

  const latestForest = useMemo(
    () => data.find((item) => item.station_name === "Forest"),
    [data]
  );

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
          existing.industrialPm10 = item.pm10;
        }

        if (item.station_name === "Forest") {
          existing.forestAqi = item.aqi;
          existing.forestPm25 = item.pm25;
          existing.forestPm10 = item.pm10;
        }
      } else {
        acc.push({
          shortTime: item.shortTime,
          industrialAqi: item.station_name === "Industrial" ? item.aqi : null,
          forestAqi: item.station_name === "Forest" ? item.aqi : null,
          industrialPm25: item.station_name === "Industrial" ? item.pm25 : null,
          forestPm25: item.station_name === "Forest" ? item.pm25 : null,
          industrialPm10: item.station_name === "Industrial" ? item.pm10 : null,
          forestPm10: item.station_name === "Forest" ? item.pm10 : null,
        });
      }

      return acc;
    }, []);
  }, [chartData]);

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-center text-3xl font-bold text-slate-800">
          Air Quality Monitoring Dashboard
        </h1>

        {error && (
          <p className="mb-6 text-center font-medium text-red-600">
            Error: {error}
          </p>
        )}

        {/* Summary Cards */}
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
            <p className="text-sm text-slate-500">Alert Level</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">
              {latestIndustrial?.aqi_category ?? "--"}
            </p>
          </div>
        </div>

        {/* Station Cards */}
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
                    {latestIndustrial.pm25}
                  </p>
                  <p>
                    <span className="font-semibold">PM10:</span>{" "}
                    {latestIndustrial.pm10}
                  </p>
                  <p>
                    <span className="font-semibold">Temperature:</span>{" "}
                    {latestIndustrial.temperature} °C
                  </p>
                  <p>
                    <span className="font-semibold">Humidity:</span>{" "}
                    {latestIndustrial.humidity} %
                  </p>
                  <p>
                    <span className="font-semibold">CO2:</span>{" "}
                    {latestIndustrial.co2}
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
                    {latestForest.pm25}
                  </p>
                  <p>
                    <span className="font-semibold">PM10:</span>{" "}
                    {latestForest.pm10}
                  </p>
                  <p>
                    <span className="font-semibold">Temperature:</span>{" "}
                    {latestForest.temperature} °C
                  </p>
                  <p>
                    <span className="font-semibold">Humidity:</span>{" "}
                    {latestForest.humidity} %
                  </p>
                  <p>
                    <span className="font-semibold">CO2:</span> {latestForest.co2}
                  </p>
                  <p>
                    <span className="font-semibold">Fan Status:</span>{" "}
                    {latestForest.fan_status}
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

        {/* Charts */}
        <div className="mb-8 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-semibold text-slate-800">
                AQI Trend by Station
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
                PM2.5 vs PM10 Levels
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
                      dataKey="pm10"
                      name="PM10"
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

        {/* System Summary */}
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
          </div>
        </div>
      </div>
    </div>
  );
}