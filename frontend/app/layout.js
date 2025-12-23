import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { GlobalLoadingProvider } from "../context/GlobalLoadingContext";
import GlobalLoaderGate from "../components/GlobalLoaderGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SNEAKS-UP",
  description: "hype Sneakers",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <GlobalLoadingProvider>
          <AuthProvider>
            <GlobalLoaderGate>{children}</GlobalLoaderGate>
          </AuthProvider>
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
