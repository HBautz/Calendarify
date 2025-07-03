import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'node server.js',
    port: 3000,
    reuseExistingServer: true,
  },
});
