import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  base: "/love_mahjong_23333/",
  plugins: [svelte()],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
});
