import { createBrowserRouter } from "react-router";
import { AppShell } from "@/components/AppShell";
import { HomePage } from "@/pages/HomePage";
import { TeamsPage } from "@/components/teams/TeamsPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "teams", element: <TeamsPage /> },
    ],
  },
]);
