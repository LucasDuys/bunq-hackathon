import type { Metadata } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { ExplainProvider } from "@/components/ExplainProvider";
import { ExplainModal } from "@/components/ExplainModal";
import { ProofFloatingBadge } from "@/components/ProofFloatingBadge";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500"],
  subsets: ["latin"],
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  weight: ["400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Carbo — bunq Business",
  description: "Agentic carbon accounting for bunq Business accounts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceCodePro.variable} h-full`}>
      <body className="min-h-full flex">
        <ExplainProvider>
          <Sidebar />
          <main className="layout-main flex-1 min-w-0 flex flex-col">
            <div className="flex-1 w-full max-w-[1200px] mx-auto px-6 py-8">
              {children}
            </div>
          </main>
          <ExplainModal />
          <ProofFloatingBadge orgId="org_acme_bv" />
        </ExplainProvider>
      </body>
    </html>
  );
}
