import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/ws": {
          target: env.GAME_SERVER_URL || "http://localhost:3001",
          ws: true,
        },
      },
    },
  };
});
