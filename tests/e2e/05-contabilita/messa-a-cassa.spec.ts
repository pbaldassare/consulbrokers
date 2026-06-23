import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import { waitForPortafoglioCarico } from '../../helpers/contabilita-helper';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Messa a Cassa — dialog di incasso da Portafoglio Carico e da Ricongiungimento.
 * I test aprono il dialog e lo chiudono senza confermare l'incasso (no mutazioni DB).
 */
test.describe('Contabilità · Messa a Cassa (dialog)', () => {
  test('da Portafoglio Carico: bottone Cassa apre dialog Conferma Messa a Cassa', async ({ page }) => {
    await page.goto('/portafoglio/carico');
    await expectPageHealthy(page);
    await waitForPortafoglioCarico(page);

    const cassaBtn = page.getByRole('button', { name: 'Cassa', exact: true }).first();
    if (!(await cassaBtn.count())) {
      test.skip(true, 'Nessuna quietanza attiva incassabile nel carico corrente');
      return;
    }

    await cassaBtn.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: SEL.messaCassa.dialog })).toBeVisible();
    await dialog.getByRole('button', { name: SEL.messaCassa.annulla }).click();
    await expect(dialog).toBeHidden();
  });

  test('Portafoglio Carico: toggle Messe a Cassa mostra colonna data incasso', async ({ page }) => {
    await page.goto('/portafoglio/carico?periodo=messe_cassa');
    await expectPageHealthy(page);
    await waitForPortafoglioCarico(page);
    await expect(page.getByRole('columnheader', { name: /Messa a Cassa/i })).toBeVisible();
  });
});
