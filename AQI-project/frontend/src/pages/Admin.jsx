import { useEffect, useMemo, useState } from "react";

export default function Admin() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [stationFilter, setStationFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/readings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch readings");
        return res.json();
      })
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((err) => setError(err.message));
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
          Admin / History Page
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
          <table className="min-w-full text-sm text-left text-slate-700">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3">Station</th>
                <th className="px-4 py-3">PM2.5</th>
                <th className="px-4 py-3">PM10</th>
                <th className="px-4 py-3">Temperature</th>
                <th className="px-4 py-3">Humidity</th>
                <th className="px-4 py-3">CO2</th>
                <th className="px-4 py-3">AQI</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Fan</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="px-4 py-3">{item.station_name}</td>
                    <td className="px-4 py-3">{item.pm25}</td>
                    <td className="px-4 py-3">{item.pm10}</td>
                    <td className="px-4 py-3">{item.temperature} °C</td>
                    <td className="px-4 py-3">{item.humidity} %</td>
                    <td className="px-4 py-3">{item.co2}</td>
                    <td className="px-4 py-3">{item.aqi}</td>
                    <td className="px-4 py-3">{item.aqi_category}</td>
                    <td className="px-4 py-3">{item.fan_status}</td>
                    <td className="px-4 py-3">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="px-4 py-6 text-center text-slate-500">
                    No readings found
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