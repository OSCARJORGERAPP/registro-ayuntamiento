const { defineConfig, devices } = require('@playwright/test');

// BD dedicada para e2e (aislada de dev). Se fija aquí para que la hereden
// global-setup, los workers y el proceso del webServer (node src/server.js).
process.env.MONGODB_DB = 'registro_e2e';

const PORT = process.env.PORT || '3000';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: './e2e',
  globalSetup: require.resolve('./e2e/global-setup.js'),
  // Comparten una sola BD de e2e → ejecución secuencial para evitar interferencias.
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Si defines BASE_URL se usa esa app; si no, Playwright arranca el servidor.
  webServer: process.env.BASE_URL ? undefined : {
    command: 'node src/server.js',
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
