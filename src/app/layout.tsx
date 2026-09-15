import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
 
export const metadata: Metadata = {
  title: "CA Tax OS",
  description: "Security and access foundation for Indian CA firms",
};
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site">
          <strong>
            <Link href="/">CA Tax OS</Link>
          </strong>
          <Link href="/onboarding">Onboarding</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/platform/review">Review queue</Link>
          <Link href="/login">Sign in</Link>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}