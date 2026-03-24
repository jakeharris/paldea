export function HomePage() {
  return (
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
  );
}
