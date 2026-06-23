import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Ricongiungimento Bancario — collegamento movimenti ↔ polizze.
 * Route: /contabilita/ricongiungimento-bancario
 */
test.describe('Contabilità · Ricongiungimento Bancario', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.contabilita.ricongiungimentoHeading })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('tab Da Ricongiungere e Storico sono navigabili', async ({ page }) => {
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabDaRicongiungere })).toBeVisible();
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabStorico })).toBeVisible();

    await page.getByRole('tab', { name: SEL.contabilita.tabStorico }).click();
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();

    await page.getByRole('tab', { name: SEL.contabilita.tabDaRicongiungere }).click();
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
    await expect(page.getByRole('button', { name: SEL.contabilita.salvaRicongiungimento })).toBeVisible();
    await expect(page.getByRole('button', { name: SEL.contabilita.mettiACassa })).toBeDisabled();
  });

  test('tab Storico: filtri data e tabella movimenti incassati', async ({ page }) => {
    await page.getByRole('tab', { name: SEL.contabilita.tabStorico }).click();
    const dal = page.locator('label:text-is("Dal")').locator('..').locator('input[type="date"]');
    const al = page.locator('label:text-is("Al")').locator('..').locator('input[type="date"]');
    await dal.fill('2020-01-01');
    await al.fill('2030-12-31');
    await expect(page.locator('table')).toBeVisible();
  });
});
