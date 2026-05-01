import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e) => {
  e.preventDefault();

  if (username.trim() === "admin" && password.trim() === "root") {
    localStorage.setItem("adminLoggedIn", "true");
    navigate("/admin", { replace: true });
  } else {
    setError("Invalid username or password.");
  }
};

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-md"
      >
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">
          Admin Login
        </h1>

        {error && <p className="mb-4 text-center text-red-600">{error}</p>}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border px-3 py-2"
        />

        <button className="w-full rounded-lg bg-slate-800 py-2 font-medium text-white hover:bg-slate-700">
          Login
        </button>
      </form>
    </div>
  );
}