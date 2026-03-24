import { DataMenu } from "./DataMenu";

export function Header() {
  return (
    <header className="glass sticky top-0 z-50 px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <h1 className="font-display text-2xl font-bold tracking-tight text-gradient-accent">
          PALDEA
        </h1>
        <div className="flex items-center gap-3">
          <p className="font-body text-sm text-text-secondary">
            Draft League Manager
          </p>
          <DataMenu />
        </div>
      </div>
    </header>
  );
}
