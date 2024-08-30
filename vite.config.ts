import { defineConfig, UserConfig } from "vite";
import react from "@vitejs/plugin-react";

const config: UserConfig = {
  plugins: [react()],
};

// @ts-ignore
if (import.meta.env.MODE === "production") {
  config.base = "https://soprodecarnaval.github.io/cadernin-web/";
}

// https://vitejs.dev/config/
export default defineConfig(config);
