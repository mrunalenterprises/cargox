import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CargoX · Local Admin Preview",
  description: "Development-only CargoX Admin UI, not production operations.",
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
