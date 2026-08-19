import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built app works from any subpath, including GitHub
  // Pages project sites, and from a file:// URL.
  base: "./",
  plugins: [vlyPlugin(), react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    sourcemap: false,
    target: "esnext",
    minify: "esbuild",
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router"],
  },
  server: {
    // Keep HMR on, but disable full-screen error overlay.
    hmr: {
      overlay: false,
    },
  },
});
