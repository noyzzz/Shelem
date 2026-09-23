import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      proxy: {
        "/ws": {
          target: env.GAME_SERVER_URL || "http://localhost:3001",
          ws: true,
        },
        "/api": {
          target: env.GAME_SERVER_URL || "http://localhost:3001",
        },
      },
    },
  };
});
