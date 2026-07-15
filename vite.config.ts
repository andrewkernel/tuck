import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-extension-manifest",
      async closeBundle() {
        const output = resolve("dist");
        await mkdir(output, { recursive: true });
        await copyFile("manifest.json", resolve(output, "manifest.json"));
        await mkdir(resolve(output, "sidepanel"), { recursive: true });
        await copyFile(
          resolve(output, "src/sidepanel/index.html"),
          resolve(output, "sidepanel/index.html"),
        );
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve("src/sidepanel/index.html"),
        "service-worker": resolve("src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "service-worker"
            ? "background/service-worker.js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["tests/extension/**", "node_modules/**", "dist/**"],
    coverage: { reporter: ["text", "html"] },
  },
});
