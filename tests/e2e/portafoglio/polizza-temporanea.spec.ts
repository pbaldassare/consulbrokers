import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from '../../helpers/auth-helper';
import { supabaseAdmin } from '../../helpers/db-helper';
import {
  assertQuietanzeChain,
  cleanupPolizzaChain,
  fetchImmissioneFixtures,
  fetchTitoliChain,
  fillImmissionePolizzaForm,
  getFirstQuietanzaId,
  performMessaACassa,
  submitImmissionePolizza,
  type ImmissioneFixtures,
} from './portafoglio-helpers';

test.use({ storageState: STORAGE_STATE });

/**
 * Scenario 2: polizza temporanea → solo la polizza (nessuna quietanza successiva).
 */
test.describe.serial('Polizza temporanea — una sola quietanza', () => {
  const POLIZZA_NUM = `TMP-E2E-${Date.now()}`;
  const GAR_DA = '2026-06-22';
  const GAR_A = '2026-07-15';
  let fixtures: ImmissioneFixtures | null = null;
  let quietanzaId: string | null = null;

  test.beforeAll(async () => {
    test.skip(!supabaseAdmin, 'SUPABASE_SERVICE_ROLE_KEY non configurata');
    fixtures = await fetchImmissioneFixtures();
    test.skip(!fixtures, 'Dataset insufficiente (cliente/compagnia/ramo)');
  });

  test.afterAll(async () => {
    await cleanupPolizzaChain(POLIZZA_NUM);
  });

  test('polizza temporanea è la prima (e unica) rata incassabile', async ({ page }) => {
    expect(fixtures).not.toBeNull();

    await fillImmissionePolizzaForm(page, {
      numeroPolizza: POLIZZA_NUM,
      fixtures: fixtures!,
      polizzaTemporanea: true,
      durataDa: GAR_DA,
      durataA: GAR_A,
      garanziaDa: GAR_DA,
      garanziaA: GAR_A,
      premioNetto: '250',
    });

    await submitImmissionePolizza(page);

    const { quietanzaIds } = await assertQuietanzeChain(POLIZZA_NUM, {
      polizzaTemporanea: true,
      garanziaDa: GAR_DA,
      garanziaA: GAR_A,
      dataCompetenza: GAR_DA,
    });

    expect(quietanzaIds).toHaveLength(0);

    const chain = await fetchTitoliChain(POLIZZA_NUM);
    expect(chain).toHaveLength(1);

    const madre = chain.find((t) => !t.sostituisce_polizza);
    expect(madre?.polizza_temporanea).toBe(true);
    expect(madre?.garanzia_da).toBe(GAR_DA);
    expect(madre?.garanzia_a).toBe(GAR_A);

    quietanzaId = madre?.id ?? null;
    expect(quietanzaId).toBeTruthy();
  });

  test('messa a cassa non genera rata 2 su polizza temporanea', async ({ page }) => {
    expect(quietanzaId).not.toBeNull();

    await performMessaACassa(page, quietanzaId!);

    const chain = await fetchTitoliChain(POLIZZA_NUM);
    expect(chain).toHaveLength(1);

    const madre = chain.find((t) => !t.sostituisce_polizza);
    expect(madre?.stato).toBe('incassato');
    expect(chain.filter((t) => !!t.sostituisce_polizza)).toHaveLength(0);
  });
});
