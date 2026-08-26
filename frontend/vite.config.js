import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: false,
    },
  },
  server: {
    port: 5173,
  },
});
