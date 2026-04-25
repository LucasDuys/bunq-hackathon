import type { ReactNode } from "react";

export default function GreenReportLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] h-screen w-screen overflow-y-auto bg-[var(--bg-canvas)]">
      {children}
    </div>
  );
}
