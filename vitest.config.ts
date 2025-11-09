
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    watch: false,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      all: true,
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 75,
        branches: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@shared/schema": path.resolve(__dirname, "server/test/schema.mock.ts"),
      "./db": path.resolve(__dirname, "server/test/db.mock.ts"),
    },
  },
});
