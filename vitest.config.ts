import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/brain", "packages/core", "packages/markets", "services/ops", "web"],
    passWithNoTests: true,
  },
});
