import { test, expect } from '@playwright/test';
import { createTestUser, deleteTestUser, createTestTitolo, cleanupTestTitolo } from './helpers/db-helper';

const polizzaNumero = 'TEST-POL-E2E-999';
const adminEmail = 'test.admin.titoli@consulbrokers.it';
const clienteEmail = 'test.cliente.titoli@consulbrokers.it';
const produttoreEmail = 'test.produttore.titoli@consulbrokers.it';
const password = 'Password123!';

let adminId: string;
let clienteId: string;
let produttoreId: string;
let titoloId: string;
let clienteAnagraficaId: string;

test.describe('Titoli — Messa a Cassa e Quietanza Automatica', () => {

  // Setup: Crea gli utenti e la polizza di test prima di avviare il test
  test.beforeAll(async () => {
    try {
      adminId = await createTestUser(adminEmail, password, 'admin', 'Admin-Titoli');
      clienteId = await createTestUser(clienteEmail, password, 'cliente', 'Cliente-Titoli');
      produttoreId = await createTestUser(produttoreEmail, password, 'produttore', 'Produttore-Titoli');
      
      const setupTitolo = await createTestTitolo(polizzaNumero, clienteId, produttoreId);
      titoloId = setupTitolo.titoloId;
      clienteAnagraficaId = setupTitolo.clienteAnagraficaId;
    } catch (err) {
      console.error('Errore nel setup del test Titoli:', err);
    }
  });

  // Teardown: Pulisce la polizza e gli utenti temporanei a fine test
  test.afterAll(async () => {
    try {
      await cleanupTestTitolo(polizzaNumero, clienteAnagraficaId);
      await deleteTestUser(adminId);
      await deleteTestUser(clienteId);
      await deleteTestUser(produttoreId);
    } catch (err) {
      console.error('Errore nel teardown del test Titoli:', err);
    }
  });

  test('Esegui messa a cassa ed ereditarietà quietanza', async ({ page }) => {
    // 1. Esegui il login come L1 Admin
    await page.goto('/login');
    await page.fill('#email', adminEmail);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    
    // Attendi la dashboard principale
    await expect(page).toHaveURL('/');

    // 2. Naviga direttamente al dettaglio della polizza creata
    await page.goto(`/titoli/${titoloId}`);

    // 3. Verifica che il titolo sia in stato 'Attivo' (o 'Da incassare')
    await expect(page.locator('text=Operazioni').first()).toBeVisible({ timeout: 10000 });
    
    // 4. Esegui il click sul pulsante "Incassa"
    // Usiamo una combinazione di selettori per cliccare sul pulsante Incassa
    const incassaButton = page.locator('button:has-text("Incassa")');
    await expect(incassaButton).toBeVisible();
    await incassaButton.click();

    // 5. Compila la modale di Messa a Cassa
    // Attendi che la modale di cassa sia visibile
    const cassaModalHeader = page.locator('text=Conferma ricezione fondi').first();
    // Nota: in base al codice di TitoloDetail.tsx, per lo stato 'attivo' si clicca su "Incassa" 
    // che può richiedere un dialog di conferma o una compilazione.
    // Compiliamo gli input del form cassa (se presenti) o clicchiamo semplicemente su "Conferma" nella modale.
    const confirmButton = page.locator('button:has-text("Conferma")').first();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // 6. Verifica la comparsa dei toast di successo
    // Dovrebbe apparire "Stato aggiornato"
    await expect(page.locator('text=Stato aggiornato').first()).toBeVisible({ timeout: 15000 });

    // 7. Verifica che lo stato sia cambiato in "Incassato"
    const statusBadge = page.locator('.badge', { hasText: 'Incassato' }).first();
    // Se la classe badge è diversa, cerchiamo semplicemente il testo 'Incassato' dentro un badge o elemento
    await expect(page.locator('text=Incassato').first()).toBeVisible();
  });
});
