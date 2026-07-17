import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Bonifici: flusso primario in Incassi; storico sulla route legacy con ?tab=storico.
 */
test.describe('Contabilità · Bonifici (merge Incassi)', () => {
  test('route legacy reindirizza a Incassi → Bonifici aperti', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario');
    await expectPageHealthy(page);
    await expect(page).toHaveURL(/\/portafoglio\/carico\?tab=bonifici/);
    await expect(page.getByRole('heading', { name: SEL.portafoglio.caricoHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Bonifici aperti/i).first()).toBeVisible();
  });

  test('storico accessibile con ?tab=storico', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario?tab=storico');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.contabilita.ricongiungimentoHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabStorico })).toBeVisible();
    const dal = page.locator('label:text-is("Dal")').locator('..').locator('input[type="date"]');
    const al = page.locator('label:text-is("Al")').locator('..').locator('input[type="date"]');
    await dal.fill('2020-01-01');
    await al.fill('2030-12-31');
    await expect(page.locator('table')).toBeVisible();
  });

  test('legacy=1 mantiene tab Da collegare per casi avanzati', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario?legacy=1');
    await expectPageHealthy(page);
    await expect(page.getByRole('heading', { name: SEL.contabilita.ricongiungimentoHeading })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabDaRicongiungere })).toBeVisible();
    await expect(page.getByRole('tab', { name: SEL.contabilita.tabStorico })).toBeVisible();
  });
});
