"use client";

import { useEffect, useState } from "react";

export default function ApiTestPage() {
  const [health, setHealth] = useState(null);
  const [dbHealth, setDbHealth] = useState(null);
  const [error, setError] = useState(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  useEffect(() => {
    async function fetchHealth() {
      try {
        const [healthRes, dbRes] = await Promise.all([
          fetch(`${baseUrl}/health`),
          fetch(`${baseUrl}/db-health`),
        ]);

        const healthData = await healthRes.json();
        const dbData = await dbRes.json();

        setHealth(healthData);
        setDbHealth(dbData);
      } catch (err) {
        console.error(err);
        setError("Failed to reach backend API");
      }
    }

    fetchHealth();
  }, [baseUrl]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-100">
      <h1 className="text-3xl font-bold">API Connectivity Test</h1>

      {error && (
        <div className="px-4 py-2 rounded bg-red-200 text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
        <div className="p-4 rounded-lg bg-white shadow">
          <h2 className="font-semibold mb-2">/health</h2>
          <pre className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">
            {health ? JSON.stringify(health, null, 2) : "Loading..."}
          </pre>
        </div>

        <div className="p-4 rounded-lg bg-white shadow">
          <h2 className="font-semibold mb-2">/db-health</h2>
          <pre className="text-sm bg-gray-50 p-2 rounded overflow-x-auto">
            {dbHealth ? JSON.stringify(dbHealth, null, 2) : "Loading..."}
          </pre>
        </div>
      </div>
    </main>
  );
}
