import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Quantum Tennis Scheduler",
  description: "Court booking monitor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <main className="max-w-7xl mx-auto px-4 py-6 overflow-x-hidden">{children}</main>
      </body>
    </html>
  );
}
