import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the app heading", () => {
    render(<App />);
    expect(screen.getByText("PALDEA")).toBeInTheDocument();
  });

  it("renders welcome content", () => {
    render(<App />);
    expect(screen.getByText("Welcome to PALDEA")).toBeInTheDocument();
  });
});
