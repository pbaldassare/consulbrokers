/**
 * Account sede Potenza: utente ufficio per specialist + login sede.
 *   bun scripts/provision-sede-potenza.ts
 *
 * Email: potenza@consulbrokers.it
 * Password default: Leone123!
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env") });

const EMAIL = "potenza@consulbrokers.it";
const PASSWORD = "Leone123!";
const NOME = "Sede";
const COGNOME = "Potenza";
const RUOLO = "ufficio";
const POTENZA_ID = "e4f0d1f5-e344-4920-b178-d8754904a108";

const PERMESSI: Record<string, boolean> = {
  titoli: true,
  sinistri: true,
  trattative: true,
  calendario: true,
  contabilita: true,
  rimesse: true,
  ec_clienti: true,
  chiusure: true,
  report: true,
  estrazioni: true,
  anagrafiche: true,
  agenzie: true,
  documentale: true,
  template: true,
  provvigioni: true,
  tabelle_base: false,
  uffici: false,
  manutenzione: false,
  riceve_provvigioni: false,
  pagamenti_provvigioni: false,
};

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let userId = listed?.users?.find((u) => u.email?.toLowerCase() === EMAIL)?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nome: NOME, cognome: COGNOME },
    });
    if (error || !data.user) throw new Error(error?.message || "createUser failed");
    userId = data.user.id;
    console.log("created", EMAIL, userId);
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    console.log("updated", EMAIL, userId);
  }

  const { error: pErr } = await admin.from("profiles").upsert({
    id: userId,
    nome: NOME,
    cognome: COGNOME,
    email: EMAIL,
    ruolo: RUOLO,
    ufficio_id: POTENZA_ID,
    attivo: true,
    permessi_json: PERMESSI,
  }, { onConflict: "id" });
  if (pErr) throw new Error(pErr.message);

  await admin.from("user_roles").delete().eq("user_id", userId).neq("role", RUOLO);
  const { error: rErr } = await admin.from("user_roles").upsert(
    { user_id: userId, role: RUOLO },
    { onConflict: "user_id,role" },
  );
  if (rErr) throw new Error(rErr.message);

  await admin.from("profilo_sedi").upsert(
    { profilo_id: userId, ufficio_id: POTENZA_ID, primaria: true },
    { onConflict: "profilo_id,ufficio_id" },
  );

  console.log(JSON.stringify({ email: EMAIL, userId, ufficio_id: POTENZA_ID }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
