import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../helpers/auth-helper';
import { supabaseAdmin, createTestTitolo, cleanupTestTitolo } from '../helpers/db-helper';

test.use({ storageState: STORAGE_STATE });

/**
 * Test E2E del flag "Regolazione" come promemoria.
 *
 * Verifica il ciclo completo:
 *  1. attivazione flag e salvataggio campi (data presunta, fattore, note) da TitoloDetail
 *  2. aggiornamento del badge live sulla card "Regolazioni Attese" in /portafoglio/gestione
 *  3. presenza della riga col badge giallo (in scadenza entro 30gg) nella tabella
 *  4. filtro segmentato "Regolazione" (Tutti / In reg. / Senza) con persistenza in URL
 *  5. disattivazione del flag e azzeramento dei campi correlati
 */

const POLIZZA_NUM = `REG-E2E-${Date.now()}`;
const DATA_PRESUNTA = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 15); // entro 30 giorni → badge giallo
  return d.toISOString().slice(0, 10);
})();

let titoloId: string | null = null;
let clienteAnagraficaId: string | null = null;
let countBefore = 0;

test.describe.serial('Regolazione promemoria — ciclo completo', () => {
  test.beforeAll(async () => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata: test saltato');

    // Recupera un cliente attivo e un produttore (anagrafica professionale) esistenti
    const { data: cli } = await supabaseAdmin!
      .from('clienti')
      .select('id')
      .eq('attivo', true)
      .limit(1)
      .single();
    const { data: prod } = await supabaseAdmin!
      .from('anagrafiche_professionali')
      .select('id')
      .limit(1)
      .single();

    if (!cli || !prod) {
      test.skip(true, 'Dataset privo di cliente/produttore di base: impossibile creare titolo di test');
      return;
    }

    const created = await createTestTitolo(POLIZZA_NUM, cli.id, prod.id);
    titoloId = created.titoloId;
    clienteAnagraficaId = created.clienteAnagraficaId;
  });

  test.afterAll(async () => {
    if (!supabaseAdmin) return;
    await cleanupTestTitolo(POLIZZA_NUM, clienteAnagraficaId ?? undefined);
  });

  test('1. cattura conteggio iniziale badge "Regolazioni Attese"', async ({ page }) => {
    await page.goto('/portafoglio/gestione');
    await expectPageHealthy(page);

    const card = page.locator('button[data-op="regolazioni_attese"]');
    await expect(card).toBeVisible();

    const badge = page.locator('[data-testid="reg-count-badge"]');
    const visible = await badge.isVisible().catch(() => false);
    countBefore = visible ? parseInt((await badge.textContent()) || '0', 10) : 0;
    expect(countBefore).toBeGreaterThanOrEqual(0);
  });

  test('2. attiva il flag Regolazione e salva i campi obbligatori', async ({ page }) => {
    expect(titoloId).not.toBeNull();
    await page.goto(`/titoli/${titoloId}?section=regolazione`);
    await expectPageHealthy(page);

    // La sezione "Regolazione" è collassata di default: espandila cliccando l'header
    const sezione = page.getByRole('button', { name: /^Regolazione$/i }).first();
    await sezione.click();

    // Entra in modalità modifica
    await page.getByRole('button', { name: /Modifica/i }).first().click();

    // Attiva lo Switch "Polizza in regolazione (promemoria)"
    const switchReg = page.locator('#reg-check');
    await switchReg.click();
    await expect(switchReg).toHaveAttribute('data-state', 'checked');

    // Compila data presunta (input type=date nel blocco ambra)
    const dateInput = page.locator('input[type="date"]').last();
    await dateInput.fill(DATA_PRESUNTA);

    // Seleziona Fattore "Fatturato" via SearchableSelect (Popover + Command)
    await page.getByRole('combobox', { name: /Seleziona fattore/i }).click();
    await page.getByRole('option', { name: /^Fatturato$/i }).click();

    // Note
    await page.getByPlaceholder('Eventuali note sul promemoria').fill('Test E2E promemoria');

    // Salva
    await page.getByRole('button', { name: /^Salva$/ }).click();

    // Attendi che la modalità modifica si chiuda (torna "Modifica" visibile)
    await expect(page.getByRole('button', { name: /Modifica/i }).first()).toBeVisible({ timeout: 10_000 });

    // Verifica persistenza lato DB
    const { data: reloaded } = await supabaseAdmin!
      .from('titoli')
      .select('regolazione, regolazione_data_presunta, regolazione_fattore, regolazione_note')
      .eq('id', titoloId!)
      .single();
    expect(reloaded?.regolazione).toBe(true);
    expect(reloaded?.regolazione_data_presunta).toBe(DATA_PRESUNTA);
    expect(reloaded?.regolazione_fattore).toBe('fatturato');
    expect(reloaded?.regolazione_note).toBe('Test E2E promemoria');
  });

  test('3. card "Regolazioni Attese" aggiorna badge e mostra la polizza con badge giallo', async ({ page }) => {
    await page.goto('/portafoglio/gestione');
    await expectPageHealthy(page);

    // Badge live: countBefore + 1
    await expect
      .poll(
        async () => {
          const b = page.locator('[data-testid="reg-count-badge"]');
          if (!(await b.isVisible().catch(() => false))) return 0;
          return parseInt((await b.textContent()) || '0', 10);
        },
        { timeout: 8_000, message: 'badge regolazioni deve incrementarsi di 1' },
      )
      .toBe(countBefore + 1);

    // Attiva operazione "Regolazioni Attese"
    await page.locator('button[data-op="regolazioni_attese"]').click();

    // Il filtro segmentato "Regolazione" deve essere nascosto su questa operazione
    await expect(page.locator('[role="group"][aria-label="filtro-reg"]')).toHaveCount(0);

    // Cerca per numero polizza
    await page.getByLabel(/N°\s*polizza\s*\/\s*ricerca libera/i).fill(POLIZZA_NUM);

    // Riga col numero polizza è presente
    const row = page.getByRole('row').filter({ hasText: POLIZZA_NUM });
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Badge Reg. giallo (entro 30gg)
    const regBadge = row.locator('[data-testid="reg-badge"]');
    await expect(regBadge).toBeVisible();
    await expect(regBadge).toHaveClass(/bg-yellow-100/);

    // Click "Esegui" naviga a /titoli/:id?section=regolazione
    await row.getByRole('button', { name: /^Esegui$/ }).click();
    await page.waitForURL((url) => url.pathname === `/titoli/${titoloId}`, { timeout: 10_000 });
    expect(page.url()).toContain('section=regolazione');
  });

  test('4. filtro segmentato Regolazione (Tutti / In reg. / Senza) persistito in URL', async ({ page }) => {
    await page.goto('/portafoglio/gestione');
    await page.locator('button[data-op="appendice"]').click();

    const filterGroup = page.locator('[role="group"][aria-label="filtro-reg"]');
    await expect(filterGroup).toBeVisible();

    // Filtra "In reg." (with) → URL contiene reg=with
    await filterGroup.locator('button[data-reg-filter="with"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('reg')).toBe('with');

    // Cerca la polizza test → deve essere presente
    await page.getByLabel(/N°\s*polizza\s*\/\s*ricerca libera/i).fill(POLIZZA_NUM);
    await expect(page.getByRole('row').filter({ hasText: POLIZZA_NUM })).toBeVisible({ timeout: 10_000 });

    // Filtra "Senza" (without) → la polizza non deve comparire
    await filterGroup.locator('button[data-reg-filter="without"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get('reg')).toBe('without');
    await expect(page.getByRole('row').filter({ hasText: POLIZZA_NUM })).toHaveCount(0);
  });

  test('5. disattivazione del flag azzera i campi e ripristina il badge', async ({ page }) => {
    await page.goto(`/titoli/${titoloId}?section=regolazione`);
    await expectPageHealthy(page);

    await page.getByRole('button', { name: /^Regolazione$/i }).first().click();
    await page.getByRole('button', { name: /Modifica/i }).first().click();

    const switchReg = page.locator('#reg-check');
    await switchReg.click();
    await expect(switchReg).toHaveAttribute('data-state', 'unchecked');

    await page.getByRole('button', { name: /^Salva$/ }).click();
    await expect(page.getByRole('button', { name: /Modifica/i }).first()).toBeVisible({ timeout: 10_000 });

    // Verifica azzeramento campi a DB
    const { data: cleared } = await supabaseAdmin!
      .from('titoli')
      .select('regolazione, regolazione_data_presunta, regolazione_fattore, regolazione_note')
      .eq('id', titoloId!)
      .single();
    expect(cleared?.regolazione).toBe(false);
    expect(cleared?.regolazione_data_presunta).toBeNull();
    expect(cleared?.regolazione_fattore).toBeNull();
    expect(cleared?.regolazione_note).toBeNull();

    // Badge tornato al valore iniziale
    await page.goto('/portafoglio/gestione');
    await expect
      .poll(
        async () => {
          const b = page.locator('[data-testid="reg-count-badge"]');
          if (!(await b.isVisible().catch(() => false))) return 0;
          return parseInt((await b.textContent()) || '0', 10);
        },
        { timeout: 8_000 },
      )
      .toBe(countBefore);
  });
});
