import type { ReactNode } from "react";

// The root layout (app/layout.tsx) renders a Sidebar + a max-w-[1200px]
// `<main>`. The kiosk deck needs to escape both. Fixed-positioning the
// child over the entire viewport (z-index above the rest of the app)
// puts the deck in front of the chrome without restructuring the routes.

export default function DemoDeckLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] h-screen w-screen overflow-hidden bg-[var(--bg-canvas)]">
      {children}
    </div>
  );
}
