import { NavLink } from "react-router";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/" },
  { label: "Teams", to: "/teams" },
  { label: "Draft Board", to: "/draft" },
  { label: "Matchups", to: "/matchups" },
] as const;

export function Nav() {
  return (
    <nav className="glass rounded-card p-4">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.label}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `block px-4 py-2 rounded-lg font-mono text-sm transition-colors duration-200 ${
                  isActive
                    ? "text-text-primary bg-surface-raised"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
