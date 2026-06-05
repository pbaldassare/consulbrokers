import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carica le variabili d'ambiente dal file .env del progetto
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('ERRORE: VITE_SUPABASE_URL o SUPABASE_URL non è configurata nel file .env.');
}

if (!serviceRoleKey) {
  console.warn(
    'ATTENZIONE: SUPABASE_SERVICE_ROLE_KEY non è configurata nel file .env.\n' +
    'Alcuni test dinamici che richiedono la creazione di utenti potrebbero fallire.\n' +
    'Assicurati di configurare la chiave di servizio per consentire setup e teardown automatici.'
  );
}

// Crea il client Supabase con privilegi admin (se la chiave è presente)
export const supabaseAdmin = serviceRoleKey 
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

/**
 * Crea un utente temporaneo di test con il ruolo e l'ufficio specificati.
 */
export async function createTestUser(email: string, password: string, role: string, cognome: string = 'Test') {
  if (!supabaseAdmin) {
    throw new Error('Impossibile creare l\'utente di test: SUPABASE_SERVICE_ROLE_KEY non configurata.');
  }

  // 1. Crea l'utente nell'Auth di Supabase
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: 'User', cognome }
  });

  if (authError) {
    // Se l'utente esiste già, proviamo a resettare la password e prelevare l'ID
    if (authError.message.includes('already been registered')) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const existing = users.users.find(u => u.email === email);
      if (existing) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
        // Forza l'aggiornamento del profilo e ruolo per consistenza
        await setupProfileAndRole(existing.id, email, role, cognome);
        return existing.id;
      }
    }
    throw new Error(`Errore creazione utente auth (${role}): ${authError.message}`);
  }

  const userId = authData.user.id;
  await setupProfileAndRole(userId, email, role, cognome);
  return userId;
}

/**
 * Configura il profilo e il ruolo per l'ID utente nel DB public.
 */
async function setupProfileAndRole(userId: string, email: string, role: string, cognome: string) {
  if (!supabaseAdmin) return;

  // L'ufficio predefinito per i test
  const defaultUfficioId = 'f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a';

  // 2. Inserisce o aggiorna il profilo
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: userId,
    nome: 'User',
    cognome,
    email,
    ruolo: role,
    ufficio_id: defaultUfficioId,
    attivo: true
  }, { onConflict: 'id' });

  if (profileError) {
    throw new Error(`Errore creazione profilo per ${email}: ${profileError.message}`);
  }

  // 3. Inserisce o aggiorna il ruolo utente
  const { error: roleError } = await supabaseAdmin.from('user_roles').upsert({
    user_id: userId,
    role: role
  }, { onConflict: 'user_id,role' });

  if (roleError) {
    throw new Error(`Errore associazione ruolo (${role}) per ${email}: ${roleError.message}`);
  }
}

/**
 * Elimina un utente temporaneo di test e tutti i record correlati (grazie a ON DELETE CASCADE).
 */
export async function deleteTestUser(userId: string) {
  if (!supabaseAdmin) return;

  // Rimuove i ruoli esplicitamente prima di eliminare il profilo/utente
  await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
  await supabaseAdmin.from('profiles').delete().eq('id', userId);
  
  // Elimina l'utente dall'Auth
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    console.error(`Errore eliminazione utente auth ${userId}:`, error.message);
  }
}

/**
 * Rimuove un titolo (polizza) dal database.
 */
export async function deleteTestTitolo(polizzaNumero: string) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('titoli').delete().eq('numero_titolo', polizzaNumero);
}

/**
 * Rimuove un sinistro dal database.
 */
export async function deleteTestSinistro(descrizione: string) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('sinistri').delete().filter('descrizione', 'ilike', `%${descrizione}%`);
}

/**
 * Crea una polizza (titolo) di test associata a uffici, compagnie, prodotti e clienti di test.
 */
export async function createTestTitolo(polizzaNumero: string, clienteId: string, produttoreId: string) {
  if (!supabaseAdmin) throw new Error('Supabase Admin non configurato');

  // 1. Cerca o crea un ufficio attivo
  let { data: uffici } = await supabaseAdmin.from('uffici').select('id').eq('attivo', true).limit(1);
  let ufficioId = uffici?.[0]?.id;
  if (!ufficioId) {
    const { data: newUff } = await supabaseAdmin.from('uffici').insert({ nome_ufficio: 'Ufficio Test e2e', attivo: true }).select('id').single();
    ufficioId = newUff.id;
  }

  // 2. Cerca o crea una compagnia attiva
  let { data: compagnie } = await supabaseAdmin.from('compagnie').select('id').eq('attiva', true).limit(1);
  let compagniaId = compagnie?.[0]?.id;
  if (!compagniaId) {
    const { data: newComp } = await supabaseAdmin.from('compagnie').insert({ nome: 'Compagnia Test e2e', attiva: true }).select('id').single();
    compagniaId = newComp.id;
  }

  // 3. Cerca o crea un prodotto attivo
  let { data: prodotti } = await supabaseAdmin.from('prodotti').select('id').eq('attivo', true).limit(1);
  let prodottoId = prodotti?.[0]?.id;
  if (!prodottoId) {
    const { data: newProd } = await supabaseAdmin.from('prodotti').insert({ nome_prodotto: 'Prodotto Test e2e', attivo: true, compagnia_id: compagniaId }).select('id').single();
    prodottoId = newProd.id;
  }

  // 4. Crea un'anagrafica cliente di test (tabella clienti)
  const { data: newCli, error: cliError } = await supabaseAdmin.from('clienti').insert({
    tipo_cliente: 'privato',
    nome: 'Cliente',
    cognome: 'Test e2e',
    attivo: true,
    ufficio_id: ufficioId
  }).select('id').single();

  if (cliError) {
    throw new Error(`Errore creazione cliente anagrafica: ${cliError.message}`);
  }
  const clienteAnagraficaId = newCli.id;

  // 5. Crea il titolo (polizza) di test impostato su 'attivo' per consentire la cassa
  const { data: newTitolo, error: tError } = await supabaseAdmin.from('titoli').insert({
    numero_titolo: polizzaNumero,
    cliente_id: clienteId,
    cliente_anagrafica_id: clienteAnagraficaId,
    produttore_id: produttoreId,
    prodotto_id: prodottoId,
    ufficio_id: ufficioId,
    premio_lordo: 500.00,
    stato: 'attivo',
    regolazione: false
  }).select('id').single();

  if (tError) {
    // Teardown parziale
    await supabaseAdmin.from('clienti').delete().eq('id', clienteAnagraficaId);
    throw new Error(`Errore creazione titolo: ${tError.message}`);
  }

  return {
    titoloId: newTitolo.id,
    clienteAnagraficaId
  };
}

/**
 * Pulisce il titolo di test e l'anagrafica cliente correlata.
 */
export async function cleanupTestTitolo(polizzaNumero: string, clienteAnagraficaId?: string) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from('titoli').delete().eq('numero_titolo', polizzaNumero);
  if (clienteAnagraficaId) {
    await supabaseAdmin.from('clienti').delete().eq('id', clienteAnagraficaId);
  }
}
