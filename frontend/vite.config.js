import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// ልማት፦ `npm run dev` (http://localhost:5173) — /api ጥሪዎች ወደ Django ይላካሉ።
// አድራሻው በ frontend/.env ውስጥ VITE_API_PROXY ነው (ነባሪ http://127.0.0.1:8000)።
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      proxy: { "/api": env.VITE_API_PROXY || "http://127.0.0.1:8000" },
    },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
