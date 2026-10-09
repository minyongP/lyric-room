import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "PORT=4174 DATA_DIR=.local-data/e2e npm run dev",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
