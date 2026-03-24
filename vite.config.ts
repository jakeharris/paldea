/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["paldea-192.png", "paldea-512.png"],
      manifest: {
        name: "PALDEA - Pokemon Draft League Assistant",
        short_name: "PALDEA",
        description:
          "Pokemon Assistant for League Draft Evaluation and Analysis",
        theme_color: "#4B0082",
        background_color: "#1a0030",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "paldea-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "paldea-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/pokeapi\.co\/api\/v2\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "pokeapi-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
