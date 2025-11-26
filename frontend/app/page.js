"use client";

import { useAuth } from "../context/AuthContext";

export default function HomePage() {
  const { user, loadingUser } = useAuth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">Online Store</h1>
      {loadingUser ? (
        <p>Checking login status...</p>
      ) : user ? (
        <p>Logged in as: {user.fullName} ({user.email})</p>
      ) : (
        <p>You are not logged in.</p>
      )}
    </main>
  );
}
