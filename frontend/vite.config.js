import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Prototype dev config: proxy /api and /uploads to the FastAPI backend
// so the frontend can call relative paths both in dev and once built.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/uploads": "http://localhost:8000",
    },
  },
});
