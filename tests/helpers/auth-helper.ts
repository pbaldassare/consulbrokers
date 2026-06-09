import { expect, type Page } from '@playwright/test';
import * as path from 'path';

/**
 * Credenziali di test.
 * Override possibile via variabili d'ambiente TEST_USER_EMAIL / TEST_USER_PASSWORD,
 * altrimenti si usano i valori forniti per la suite e2e.
 */
export const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'cloude@gmail.com';
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'Leone123!';

/**
 * Percorso dove viene salvato lo storageState (sessione autenticata) dal setup.
 * È gitignorato e ricreato a ogni run dal file 00-auth.setup.ts.
 */
export const STORAGE_STATE = path.resolve(process.cwd(), 'tests/.auth/user.json');

/**
 * Esegue il login via UI partendo dalla pagina /login e attende il redirect
 * verso una rotta autenticata (qualsiasi rotta diversa da /login).
 */
export async function login(
  page: Page,
  email: string = TEST_EMAIL,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto('/login');

  // Il form di login può apparire dopo il bootstrap dell'auth (spinner iniziale)
  await page.waitForSelector('#email', { state: 'visible', timeout: 30_000 });

  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  // onAuthStateChange aggiorna il context e il guard fa il <Navigate> reattivo.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
}

/**
 * Logout via menu utente in Topbar ("Esci").
 */
export async function logout(page: Page): Promise<void> {
  // Il trigger del menu utente è il bottone con avatar in alto a destra
  await page.locator('header button').last().click();
  await page.getByRole('menuitem', { name: 'Esci' }).click();
  await page.waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 15_000 });
}

/**
 * Asserisce che la pagina corrente non sia in stato d'errore:
 * - non è stata espulsa verso /login
 * - non mostra l'AppErrorBoundary ("Si è verificato un errore...")
 * - non mostra la pagina 404 ("Page not found")
 */
export async function expectPageHealthy(page: Page): Promise<void> {
  await expect(page, 'non deve essere reindirizzato al login').not.toHaveURL(/\/login(\?|$)/);
  await expect(
    page.getByRole('heading', { name: /Si è verificato un errore/i }),
    'AppErrorBoundary non deve essere visibile',
  ).toHaveCount(0);
  await expect(
    page.getByText('Page not found', { exact: false }),
    'la rotta non deve cadere sul 404',
  ).toHaveCount(0);
}

/**
 * Rotte principali del gestionale accessibili a un utente con privilegi pieni.
 * Sono escluse le rotte di dettaglio (:id, richiedono dati) e i portali
 * cliente/prospect (layout/login differenti).
 */
export const GESTIONALE_ROUTES: { label: string; path: string }[] = [
  { label: 'Home / Dashboard', path: '/' },
  { label: 'Assistente IA', path: '/ai-assistant' },
  { label: 'Mio Profilo', path: '/mio-profilo' },

  // Trattative / commerciale
  { label: 'Prospect', path: '/archivi/prospect' },
  { label: 'Trattative', path: '/trattative' },
  { label: 'Calendario Trattative', path: '/trattative/calendario' },
  { label: 'Storico Trattative', path: '/trattative/storico' },
  { label: 'Storico Gare', path: '/trattative/storico-gare' },
  { label: 'Bandi Pubblici', path: '/bandi-pubblici' },
  { label: 'Chat', path: '/chat' },

  // Anagrafiche
  { label: 'Clienti', path: '/archivi/clienti' },
  { label: 'Anagrafiche Agenzie', path: '/archivi/anagrafiche-agenzie' },
  { label: 'Anagrafiche Amministrative', path: '/archivi/anagrafiche-amministrative' },
  { label: 'Conti Bancari', path: '/archivi/conti-bancari' },

  // Portafoglio
  { label: 'Polizze Attive', path: '/portafoglio/attive' },
  { label: 'Carico', path: '/portafoglio/carico' },
  { label: 'Storico Polizze', path: '/portafoglio/storico' },
  { label: 'Immissione Polizza', path: '/portafoglio/immissione' },
  { label: 'Appendici', path: '/portafoglio/appendici' },
  { label: 'Rinnovi', path: '/portafoglio/rinnovi' },
  { label: 'Doc. Precontrattuale', path: '/portafoglio/doc-precontrattuale' },
  { label: 'Estrazioni e Stampe', path: '/portafoglio/estrazioni-stampe' },
  { label: 'Estrazione per Cliente', path: '/portafoglio/estrazioni/per-cliente' },
  { label: 'Estrazione per Compagnia', path: '/portafoglio/estrazioni/per-compagnia' },
  { label: 'Premi/Provvigioni', path: '/portafoglio/estrazioni/premi-provvigioni' },
  { label: 'Premi Scoperti/Garantiti', path: '/portafoglio/estrazioni/premi-scoperti-garantiti' },
  { label: 'E/C Clienti (estrazioni)', path: '/portafoglio/estrazioni/ec-clienti' },
  { label: 'Collettive / Libri Matricola', path: '/portafoglio/collettive' },
  { label: 'Archivio Documentale', path: '/portafoglio/documentale' },
  { label: 'Elenco Polizze (titoli)', path: '/titoli' },

  // Sinistri
  { label: 'Sinistri', path: '/sinistri' },
  { label: 'Apertura Sinistro', path: '/sinistri/apertura' },
  { label: 'Prescrizioni Sinistri', path: '/sinistri/prescrizioni' },
  { label: 'Scadenze Sinistri', path: '/sinistri/scadenze' },
  { label: 'Report Sanitario SIR', path: '/sinistri/report-sir' },

  // Contabilità
  { label: 'Incassi e Coperture', path: '/contabilita' },
  { label: 'Cruscotto del Giorno', path: '/contabilita/cruscotto' },
  { label: 'E/C Clienti', path: '/contabilita/ec-clienti' },
  { label: 'E/C Compagnia', path: '/contabilita/ec-compagnia' },
  { label: 'E/C Agenzie', path: '/contabilita/ec-agenzia' },
  { label: 'Agenzie in Pagamento', path: '/contabilita/ec-agenzia/in-pagamento' },
  { label: 'Storico E/C Agenzie', path: '/contabilita/ec-agenzia/storico' },
  { label: 'Storico E/C Clienti', path: '/contabilita/ec-cliente/storico' },
  { label: 'E/C Produttori', path: '/contabilita/ec-produttori' },
  { label: 'Storico E/C Produttori', path: '/contabilita/ec-produttore/storico' },
  { label: 'Storico Rimesse', path: '/contabilita/storico-rimesse' },
  { label: 'Stampa Sospesi', path: '/contabilita/stampa-sospesi' },
  { label: 'Report IVA', path: '/report-iva' },

  // Provvigioni
  { label: 'Provvigioni Maturate', path: '/provvigioni-maturate' },
  { label: 'Provvigioni Compagnie/Ramo', path: '/provvigioni-compagnie-ramo' },
  { label: 'Pagamenti Provvigioni', path: '/pagamenti-provvigioni' },

  // Sistema / Admin
  { label: 'Centro Utenti & Privilegi', path: '/utenti-privilegi' },
  { label: 'Impostazioni', path: '/impostazioni' },
  { label: 'Backup & Export', path: '/backup-export' },
  { label: 'Manutenzione', path: '/manutenzione' },
  { label: 'Tabelle di Base', path: '/tabelle-base' },
  { label: 'Gestione Uffici', path: '/gestione-uffici' },
  { label: 'Compagnie / Agenzie', path: '/compagnie' },
  { label: 'Template Email', path: '/template' },
  { label: 'Comunicazioni', path: '/comunicazioni' },
  { label: 'Anomalie Sistema', path: '/anomalie-sistema' },
  { label: 'Sitemap', path: '/sitemap' },
  { label: 'Note di Restituzione', path: '/note-restituzione' },
  { label: 'Spedizioni', path: '/spedizioni' },
  { label: 'Notifiche', path: '/notifiche' },
  { label: 'Privacy & Consensi', path: '/privacy' },
  { label: 'Flussi Compagnie', path: '/flussi-compagnie' },
  { label: 'Report', path: '/report' },
];
