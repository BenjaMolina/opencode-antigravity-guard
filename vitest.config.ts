import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "packages/*/src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["node_modules", "dist", "packages/*/dist"],
  },
})
