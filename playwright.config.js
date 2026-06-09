const { defineConfig } = require('@playwright/test');

const chromiumChannel = String(process.env.PLAYWRIGHT_CHROMIUM_CHANNEL || '').trim();

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  reporter: 'line',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
    ...(chromiumChannel ? { channel: chromiumChannel } : {})
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'python3 -m http.server --bind 127.0.0.1 8080',
    port: 8080,
    reuseExistingServer: false,
    timeout: 10_000,
    stdout: 'ignore',
    stderr: 'ignore'
  }
});
