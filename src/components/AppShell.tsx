import { Header } from "./Header";
import { Nav } from "./Nav";

export function AppShell() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <div className="flex-1 flex max-w-7xl mx-auto w-full gap-6 p-6">
        <aside className="hidden md:block w-56 shrink-0">
          <Nav />
        </aside>
        <main className="flex-1">
          <div className="glass rounded-card p-8">
            <h2 className="font-display text-xl font-semibold mb-4 text-warm-100">
              Welcome to PALDEA
            </h2>
            <p className="text-text-secondary leading-relaxed max-w-prose">
              Your Pokemon draft league command center. Build rosters, analyze
              matchups, and dominate your league.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                className="gradient-accent text-purple-950 font-body font-semibold
                           px-5 py-2.5 rounded-pill
                           hover:opacity-90 transition-opacity"
              >
                Get Started
              </button>
              <button
                className="glass px-5 py-2.5 rounded-pill font-body
                           text-text-primary hover:bg-surface-overlay
                           transition-colors"
              >
                View Docs
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
