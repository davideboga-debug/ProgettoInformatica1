import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget =
    env.VITE_API_URL ||
    (env.NEON_BRANCH_ID && env.NEON_FUNCTION_HOST_SUFFIX
      ? `https://${env.NEON_BRANCH_ID}-api${env.NEON_FUNCTION_HOST_SUFFIX}`
      : "");
  const authUrl = env.VITE_NEON_AUTH_URL || env.NEON_AUTH_BASE_URL || "";

  const proxy = apiTarget
    ? {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ""),
        },
      }
    : undefined;

  return {
    plugins: [react()],
    define: {
      __NEON_AUTH_URL__: JSON.stringify(authUrl),
    },
    server: {
      port: 5173,
      proxy,
    },
    preview: {
      port: 4173,
      proxy,
    },
    build: {
      outDir: "dist",
      sourcemap: false,
    },
  };
});
