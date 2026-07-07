import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        stats: resolve(__dirname, "stats.html"),
        login: resolve(__dirname, "login.html"),
        register: resolve(__dirname, "register.html")
      }
    }
  }
});
