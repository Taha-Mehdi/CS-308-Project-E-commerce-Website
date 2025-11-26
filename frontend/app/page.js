"use client";

import { useAuth } from "../context/AuthContext";
import SiteLayout from "../components/SiteLayout";

export default function HomePage() {
  const { user, loadingUser } = useAuth();

  return (
    <SiteLayout>
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Online Store
        </h1>

        {loadingUser ? (
          <p className="text-sm text-gray-500">Checking login status...</p>
        ) : user ? (
          <p className="text-sm text-gray-700">
            Logged in as:{" "}
            <span className="font-medium">{user.fullName}</span>{" "}
            <span className="text-gray-500">({user.email})</span>
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            You are not logged in.{" "}
            <a
              href="/login"
              className="text-gray-900 font-medium underline underline-offset-4"
            >
              Login
            </a>{" "}
            or{" "}
            <a
              href="/register"
              className="text-gray-900 font-medium underline underline-offset-4"
            >
              create an account
            </a>
            .
          </p>
        )}

        <p className="text-sm text-gray-600 max-w-xl">
          We&apos;ll turn this page into a proper hero + featured products
          section next, styled similarly to mockupflock.com.
        </p>
      </div>
    </SiteLayout>
  );
}
