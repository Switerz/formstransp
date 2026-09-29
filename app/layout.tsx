import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forms Transp",
  description: "Controle operacional para transportadoras",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link className="brand-lockup" href="/">
              <span className="brand-mark" aria-hidden="true">FT</span>
              <span>
                <strong>Forms Transp</strong>
                <small>Controle operacional</small>
              </span>
            </Link>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
