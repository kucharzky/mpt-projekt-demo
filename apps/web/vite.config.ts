import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (/\/(react|react-dom|scheduler)\//.test(id)) return "react";
            if (id.includes("react-day-picker") || id.includes("date-fns"))
              return "date-picker";
            if (id.includes("@radix-ui") || id.includes("radix-ui"))
              return "primitives";
            if (id.includes("i18next")) return "localization";
          },
        },
      },
    },
    server: {
      host: "127.0.0.1",
      port: Number(env.WEB_PORT || 5173),
      strictPort: true,
      proxy: {
        "/api": {
          target:
            process.env.API_PROXY_TARGET ||
            `http://127.0.0.1:${env.API_PORT || 3001}`,
          changeOrigin: false,
        },
      },
    },
  };
});
