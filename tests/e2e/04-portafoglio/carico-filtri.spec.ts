import { test, expect } from '@playwright/test';
import { STORAGE_STATE, expectPageHealthy } from '../../helpers/auth-helper';
import {
  caricoDateInputs,
  selectCaricoPeriodo,
  waitForPortafoglioCarico,
} from '../../helpers/contabilita-helper';
import { SEL } from '../../helpers/selectors';

test.use({ storageState: STORAGE_STATE });

/**
 * Portafoglio Carico — filtri periodo, date range e reset.
 * Route: /portafoglio/carico
 */
test.describe('Portafoglio · Carico — filtri', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portafoglio/carico');
    await expectPageHealthy(page);
    await waitForPortafoglioCarico(page);
  });

  test('carico senza parametri: default Tutte', async ({ page }) => {
    await expect(page.getByRole('radio', { name: 'Tutte' })).toHaveAttribute('data-state', 'on');
    await expect(page).not.toHaveURL(/[?&]periodo=/);
  });

  test('toggle periodo: Mese Corrente / Tutte aggiornano URL e sottotitolo', async ({ page }) => {
    await selectCaricoPeriodo(page, 'Mese Corrente');
    await expect(page).toHaveURL(/periodo=mese_corrente/);
    await expect(page.getByText(/inclusi arretrati non a cassa|Tutte le polizze/i).first()).toBeVisible();

    await selectCaricoPeriodo(page, 'Tutte');
    await expect(page).toHaveURL(/periodo=tutte/);
    await expect(page.getByText(/Tutte le polizze( messe a cassa)?/i).first()).toBeVisible();
  });

  test('datepicker Dal/Al aggiorna i parametri URL e il sottotitolo', async ({ page }) => {
    const { dal, al } = caricoDateInputs(page);
    const da = '2025-01-01';
    const a = '2025-06-30';

    await dal.fill(da);
    await al.fill(a);

    await expect(page).toHaveURL(new RegExp(`dal=${da}`));
    await expect(page).toHaveURL(new RegExp(`al=${a}`));
    await expect(page.getByText(/dal 01\/01\/2025 al 30\/06\/2025/i)).toBeVisible();
  });

  test('Reset Filtri ripristina periodo default e rimuove date e query string', async ({ page }) => {
    const { dal, al } = caricoDateInputs(page);

    await selectCaricoPeriodo(page, 'Tutte');
    await dal.fill('2024-06-01');
    await al.fill('2024-12-31');

    const reset = page.getByRole('button', { name: SEL.portafoglio.resetFiltri });
    await expect(reset).toBeVisible();
    await reset.click();

    await expect(dal).toHaveValue('');
    await expect(al).toHaveValue('');
    await expect(page.getByRole('radio', { name: 'Tutte' })).toHaveAttribute('data-state', 'on');
    await expect(page).not.toHaveURL(/[?&]periodo=/);
    await expect(page).not.toHaveURL(/[?&]dal=/);
    await expect(page).not.toHaveURL(/[?&]al=/);
    await expect(reset).toHaveCount(0);
  });

  test('la tabella o il messaggio vuoto restano coerenti dopo cambio filtro', async ({ page }) => {
    await selectCaricoPeriodo(page, 'Mese Corrente');
    await waitForPortafoglioCarico(page);

    const tableRows = page.locator('table tbody tr');
    const emptyMsg = page.getByText(/Nessuna polizza trovata/i);
    const hasTable = (await tableRows.count()) > 0;
    const hasEmpty = (await emptyMsg.count()) > 0;
    expect(hasTable || hasEmpty).toBeTruthy();
  });
});
