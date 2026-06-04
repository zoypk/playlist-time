import { defineConfig, devices } from "@playwright/test";

const processEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env ?? {};

const baseURL =
  processEnv.SMOKE_BASE_URL ||
  processEnv.PLAYWRIGHT_BASE_URL ||
  "http://127.0.0.1:4321";

export default defineConfig({
  testDir: "./tests/smoke",
  testMatch: "**/*.smoke.ts",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  reporter: processEnv.CI
    ? [["github"], ["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
