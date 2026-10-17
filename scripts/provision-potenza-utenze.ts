/**
 * Account operativi sede Potenza.
 * Uso (con SUPABASE_SERVICE_ROLE_KEY in .env):
 *   bun scripts/provision-potenza-utenze.ts
 *
 * Crea o allinea:
 *   mderosa@consulbrokers.it   Maria Grazia De Rosa
 *   aroberti@consulbrokers.it  Agnese Roberti
 *   tbonito@consulbrokers.it   Tina Bonito
 *
 * Ruolo: ufficio (Sede) sulla sede PZ. Password default: Leone123!
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env") });

const PASSWORD = "Leone123!";
const RUOLO = "ufficio";
export const POTENZA_UFFICIO_ID = "e4f0d1f5-e344-4920-b178-d8754904a108";

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

export const POTENZA_UTENTI = [
  { email: "mderosa@consulbrokers.it", nome: "Maria Grazia", cognome: "De Rosa" },
  { email: "aroberti@consulbrokers.it", nome: "Agnese", cognome: "Roberti" },
  { email: "tbonito@consulbrokers.it", nome: "Tina", cognome: "Bonito" },
] as const;

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Servono SUPABASE_URL (o VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const byEmail = new Map(
    (listed?.users ?? []).filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id]),
  );

  for (const u of POTENZA_UTENTI) {
    let userId = byEmail.get(u.email.toLowerCase());
    let action: "created" | "updated" = "updated";

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { nome: u.nome, cognome: u.cognome },
      });
      if (error || !created.user) throw new Error(`${u.email}: ${error?.message || "createUser failed"}`);
      userId = created.user.id;
      action = "created";
    } else {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`${u.email}: ${error.message}`);
    }

    const { error: pErr } = await admin.from("profiles").upsert({
      id: userId,
      nome: u.nome,
      cognome: u.cognome,
      email: u.email,
      ruolo: RUOLO,
      ufficio_id: POTENZA_UFFICIO_ID,
      attivo: true,
      permessi_json: PERMESSI,
    }, { onConflict: "id" });
    if (pErr) throw new Error(`${u.email} profile: ${pErr.message}`);

    await admin.from("user_roles").delete().eq("user_id", userId).neq("role", RUOLO);
    const { error: rErr } = await admin.from("user_roles").upsert(
      { user_id: userId, role: RUOLO },
      { onConflict: "user_id,role" },
    );
    if (rErr) throw new Error(`${u.email} user_roles: ${rErr.message}`);

    await admin.from("profilo_sedi").upsert(
      { profilo_id: userId, ufficio_id: POTENZA_UFFICIO_ID, primaria: true },
      { onConflict: "profilo_id,ufficio_id" },
    );

    console.log(`${action} ${u.email} (${u.nome} ${u.cognome})`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
