import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/llm-api-key-manager/",
  plugins: [
    // plugins
    vue(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": "/src/",
    },
  },
});
