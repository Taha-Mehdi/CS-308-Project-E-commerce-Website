"use client";

import { useGlobalLoading } from "../context/GlobalLoadingContext";
import DripLoader from "./DripLoader";

export default function GlobalLoaderGate({ children }) {
  const { loading } = useGlobalLoading();
  return (
    <>
      {children}
      {loading ? <DripLoader /> : null}
    </>
  );
}
