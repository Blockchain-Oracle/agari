import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/brain", "packages/core", "packages/db", "packages/markets", "services/ops", "web"],
    passWithNoTests: true,
  },
});
