import { defineConfig, devices } from '@playwright/test';

/**
 * Vedere https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Esegue i test in file paralleli */
  fullyParallel: false,
  /* Fallisce la build su CI se si dimentica un test.only nel codice */
  forbidOnly: !!process.env.CI,
  /* Numero di retry per i test che falliscono */
  retries: process.env.CI ? 2 : 0,
  /* Numero di worker paralleli */
  workers: 1, // Impostato a 1 per evitare conflitti concorrenti sui dati di test nel DB di Supabase
  /* Reporter da utilizzare */
  reporter: 'html',
  /* Condiviso tra tutti i progetti */
  use: {
    /* Base URL per le chiamate navigate() dei test */
    baseURL: 'http://localhost:8080',
    /* Raccoglie la traccia per i test falliti */
    trace: 'on-first-retry',
    /* Disabilita i video e screenshot per velocizzare */
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  /* Configurazione dei browser da testare */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Avvia il server locale di sviluppo prima dei test */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
