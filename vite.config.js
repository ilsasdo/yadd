import { cp, copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const root = process.cwd();

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(root, "newtab.html")
    }
  },
  plugins: [
    vue(),
    {
      name: "chrome-extension-assets",
      async closeBundle() {
        const output = resolve(root, "dist");
        await mkdir(output, { recursive: true });
        await Promise.all([
          copyFile(resolve(root, "manifest.json"), resolve(output, "manifest.json")),
          cp(resolve(root, "widgets"), resolve(output, "widgets"), { recursive: true })
        ]);
      }
    }
  ]
});
