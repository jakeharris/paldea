import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { LeagueProvider } from "@/context/league-context";
import { router } from "./router";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LeagueProvider>
      <RouterProvider router={router} />
    </LeagueProvider>
  </StrictMode>,
);
