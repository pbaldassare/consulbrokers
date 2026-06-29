import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import { waitForPortafoglioCarico } from '../../helpers/contabilita-helper';

test.use({ storageState: STORAGE_STATE });

/**
 * Messa a Cassa — dialog di incasso da Portafoglio Carico e da Ricongiungimento.
 * I test aprono il dialog e lo chiudono senza confermare l'incasso (no mutazioni DB).
 */
test.describe('Contabilità · Messa a Cassa (dialog)', () => {
  test('da Portafoglio Carico: selezione + Incassa apre dialog Conferma Messa a Cassa', async ({ page }) => {
    await page.goto('/portafoglio/carico');
    await expectPageHealthy(page);
    await waitForPortafoglioCarico(page);

    const rowCheckbox = page.locator('table tbody tr').first().locator('[role="checkbox"]').first();
    if (!(await rowCheckbox.count())) {
      test.skip(true, 'Nessuna quietanza attiva incassabile nel carico corrente');
      return;
    }

    await rowCheckbox.click();

    const incassaBtn = page.getByRole('button', { name: /^Incassa \(\d+\)$/ }).first();
    if (!(await incassaBtn.count())) {
      test.skip(true, 'Nessuna riga selezionabile per incasso');
      return;
    }

    await incassaBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /Conferma Messa a Cassa/i })).toBeVisible();
    await expect(dialog.getByText(/Data Messa a Cassa/i)).toBeVisible();
    await expect(dialog.getByText(/Data Pagamento/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Conferma Incasso/i })).toBeVisible();
    await expect(dialog.getByText(/Operazione irreversibile/i)).toBeVisible();

    await dialog.getByRole('button', { name: 'Annulla' }).click();
    await expect(dialog).toBeHidden();
  });

  test('da Ricongiungimento: Metti a Cassa apre lo stesso dialog quando la quadratura è ok', async ({ page }) => {
    await page.goto('/contabilita/ricongiungimento-bancario');
    await expectPageHealthy(page);

    const trigger = page.locator('.cursor-pointer').filter({ hasText: /Ordinante:/i }).first();
    if (!(await trigger.count())) {
      test.skip(true, 'Nessun movimento da ricongiungere');
      return;
    }

    await trigger.click();

    const checkbox = page.locator('table tbody tr').first().locator('[role="checkbox"]').first();
    if (!(await checkbox.count())) {
      test.skip(true, 'Nessuna polizza selezionabile');
      return;
    }

    await checkbox.click();

    const mettiACassa = page.getByRole('button', { name: /Metti a Cassa/i });
    if (!(await page.getByText(/✓ Quadra/i).isVisible().catch(() => false))) {
      test.skip(true, 'Quadratura non raggiunta con la prima polizza disponibile');
      return;
    }

    await mettiACassa.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Conferma Messa a Cassa/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Portafoglio Carico: colonna Messa a Cassa visibile in vista Tutte', async ({ page }) => {
    await page.goto('/portafoglio/carico');
    await expectPageHealthy(page);
    await waitForPortafoglioCarico(page);

    await expect(page.getByRole('columnheader', { name: /Messa a Cassa/i })).toBeVisible();

    const rows = page.locator('table tbody tr');
    if ((await rows.count()) > 0) {
      const headerIndex = await page.getByRole('columnheader', { name: /Messa a Cassa/i }).evaluate((el) => {
        const row = el.closest('tr');
        if (!row) return -1;
        return Array.from(row.children).indexOf(el);
      });
      if (headerIndex >= 0) {
        const dateCell = rows.first().locator('td').nth(headerIndex);
        await expect(dateCell).toBeVisible();
      }
    }
  });
});
