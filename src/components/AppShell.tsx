import { Outlet } from "react-router";
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
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
