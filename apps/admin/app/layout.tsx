import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { sections } from "../lib/sections";
export const metadata: Metadata = {
  title: "CargoX · Local Admin Preview",
  description: "Development-only CargoX Admin UI, not production operations.",
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><a className="skip-link" href="#content">Skip navigation</a>
    <nav className="operations-nav" aria-label="Demo operations"><Link href="/">Overview</Link>
      {Object.entries(sections).map(([key, section]) => <Link key={key} href={`/${key}`}>{section.title}</Link>)}
    </nav><div id="content">{children}</div></body></html>;
}
