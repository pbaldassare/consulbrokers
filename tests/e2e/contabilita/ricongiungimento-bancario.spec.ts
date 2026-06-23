import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';

test.use({ storageState: STORAGE_STATE });

/**
 * Ricongiungimento Bancario — collegamento movimenti ↔ polizze.
 * Route: /contabilita/ricongiungimento-bancario
 *
 * I test non confermano il salvataggio per evitare mutazioni irreversibili nel DB condiviso.
 */
test.describe('Contabilità · Ricongiungimento Bancario', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: /Ricongiungimento Bancario/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('tab Da Ricongiungere e Storico sono navigabili', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /Da Ricongiungere/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Storico/i })).toBeVisible();

    await page.getByRole('tab', { name: /Storico/i }).click();
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.locator('label:text-is("Cliente")')).toBeVisible();

    await page.getByRole('tab', { name: /Da Ricongiungere/i }).click();
    await expect(
      page.getByText(/Nessun movimento da ricongiungere|Ordinante:|Importo:/i).first(),
    ).toBeVisible();
  });

  test('espansione card movimento mostra sezione ricongiungimento e azioni', async ({ page }) => {
    const trigger = page.locator('.cursor-pointer').filter({ hasText: /Ordinante:/i }).first();

    if (!(await trigger.count())) {
      test.skip(true, 'Nessun movimento assegnato da ricongiungere nel DB di test');
      return;
    }

    await trigger.click();

    await expect(page.getByText(/Cliente pre-matchato/i).first()).toBeVisible();
    await expect(page.getByText(/Polizze attive di/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Salva Ricongiungimento/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Metti a Cassa/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Garantito/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Aggiungi polizza di altro cliente/i })).toBeVisible();

    // Metti a Cassa disabilitato finché non quadra
    await expect(page.getByRole('button', { name: /Metti a Cassa/i })).toBeDisabled();
  });

  test('selezione polizza aggiorna quadratura e abilita Metti a Cassa quando quadra', async ({ page }) => {
    const trigger = page.locator('.cursor-pointer').filter({ hasText: /Ordinante:/i }).first();
    if (!(await trigger.count())) {
      test.skip(true, 'Nessun movimento assegnato da ricongiungere nel DB di test');
      return;
    }

    await trigger.click();

    const checkbox = page.locator('table tbody tr').first().locator('[role="checkbox"]').first();
    if (!(await checkbox.count())) {
      test.skip(true, 'Nessuna polizza attiva collegabile per il movimento');
      return;
    }

    await checkbox.click();

    const quadraOk = page.getByText(/✓ Quadra/i);
    const mettiACassa = page.getByRole('button', { name: /Metti a Cassa/i });

    if (await quadraOk.isVisible().catch(() => false)) {
      await expect(mettiACassa).toBeEnabled();
      await mettiACassa.click();

      const dialog = page.getByRole('dialog', { name: /Conferma Messa a Cassa/i });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Annulla' }).click();
      await expect(dialog).toBeHidden();
    } else {
      await expect(mettiACassa).toBeDisabled();
    }
  });

  test('tab Storico: filtri data e tabella movimenti incassati', async ({ page }) => {
    await page.getByRole('tab', { name: /Storico/i }).click();

    const dal = page.locator('label:text-is("Dal")').locator('..').locator('input[type="date"]');
    const al = page.locator('label:text-is("Al")').locator('..').locator('input[type="date"]');
    await dal.fill('2020-01-01');
    await al.fill('2030-12-31');

    await expect(page.locator('table')).toBeVisible();
    await expect(
      page.getByText(/Nessun movimento|Ordinante/i).first(),
    ).toBeVisible();
  });
});
