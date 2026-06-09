import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, STORAGE_STATE, TEST_EMAIL } from '../helpers/auth-helper';

/**
 * Setup di autenticazione.
 *
 * Esegue il login una sola volta (questo file ordina prima — prefisso 00) e salva
 * lo stato della sessione su disco. Le altre spec lo riutilizzano via
 * `test.use({ storageState: STORAGE_STATE })`, evitando di ri-loggare per ogni test.
 *
 * Funziona anche come smoke test del login: se fallisce qui, il resto della suite
 * fallirà con un messaggio chiaro.
 */
test('setup: login e salvataggio sessione', async ({ page }) => {
  await login(page);

  // Conferma che siamo dentro l'app (non più sulla pagina di login)
  await expect(page).not.toHaveURL(/\/login/);

  // Garantisce l'esistenza della cartella .auth e salva lo storageState
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });

  console.log(`[setup] Sessione salvata per ${TEST_EMAIL} -> ${STORAGE_STATE}`);
});
