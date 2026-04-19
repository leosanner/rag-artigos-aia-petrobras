import { fileURLToPath } from "node:url";

import { defineWorkspace } from "vitest/config";

const srcAlias = fileURLToPath(new URL("./src", import.meta.url));

const sharedProjectConfig = {
  esbuild: {
    jsx: "automatic" as const,
  },
  resolve: {
    alias: {
      "@": srcAlias,
    },
  },
};

const sharedTestConfig = {
  fileParallelism: false,
  globals: true,
  passWithNoTests: false,
  restoreMocks: true,
};

export default defineWorkspace([
  {
    ...sharedProjectConfig,
    test: {
      ...sharedTestConfig,
      name: "node",
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  },
  {
    ...sharedProjectConfig,
    test: {
      ...sharedTestConfig,
      name: "dom",
      environment: "jsdom",
      include: ["src/**/*.test.tsx"],
      setupFiles: ["src/test/setup-dom.ts"],
    },
  },
]);
