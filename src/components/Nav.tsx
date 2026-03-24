const NAV_ITEMS = [
  { label: "Dashboard", href: "#" },
  { label: "Teams", href: "#" },
  { label: "Draft Board", href: "#" },
  { label: "Matchups", href: "#" },
] as const;

export function Nav() {
  return (
    <nav className="glass rounded-card p-4">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.label}>
            <a
              href={item.href}
              className="block px-4 py-2 rounded-lg font-mono text-sm text-text-secondary
                         hover:text-text-primary hover:bg-surface-raised
                         transition-colors duration-200"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
