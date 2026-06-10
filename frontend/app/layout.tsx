import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "SPP Calculation Module",
  description: "SPP test task frontend"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}