import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind on all interfaces so the dev server is reachable from a phone on
    // the LAN or through an HTTPS tunnel. `allowedHosts: true` lets tunnel
    // hostnames through. `/api` is proxied to the local gateway so the app can
    // stay same-origin (no CORS) no matter what host it is opened from.
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    restoreMocks: true,
    clearMocks: true,
    maxWorkers: 2,
  },
});
