import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { LeagueProvider } from "@/context/league-context";
import { AppShell } from "@/components/AppShell";
import { HomePage } from "@/pages/HomePage";

function renderWithRouter(initialRoute = "/") {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [{ index: true, element: <HomePage /> }],
      },
    ],
    { initialEntries: [initialRoute] },
  );
  return render(
    <LeagueProvider>
      <RouterProvider router={router} />
    </LeagueProvider>,
  );
}

describe("App", () => {
  it("renders the app heading", () => {
    renderWithRouter();
    expect(screen.getByText("PALDEA")).toBeInTheDocument();
  });

  it("renders welcome content", () => {
    renderWithRouter();
    expect(screen.getByText("Welcome to PALDEA")).toBeInTheDocument();
  });
});
