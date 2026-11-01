import { defineConfig } from "vitest/config";

// The first PDF test loads pdf.js, which can take several seconds.
export default defineConfig({ test: { testTimeout: 30_000 } });
