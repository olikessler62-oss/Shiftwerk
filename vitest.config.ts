import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: [
      "packages/compliance/src/**/*.test.ts",
      "packages/database/src/**/*.test.ts",
      "packages/i18n/src/**/*.test.ts",
      "apps/web/src/lib/**/*.test.ts",
    ],
    environment: "node",
  },
  resolve: {
    alias: {
      "@schichtwerk/compliance": path.resolve(
        __dirname,
        "packages/compliance/src/index.ts"
      ),
      "@schichtwerk/types": path.resolve(__dirname, "packages/types/src/index.ts"),
      "@schichtwerk/i18n": path.resolve(__dirname, "packages/i18n/src/index.ts"),
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
});
