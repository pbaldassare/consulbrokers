/**
 * Specialist sede Roma uno (ruolo backoffice).
 *   bun scripts/provision-roma-specialist.ts
 *
 * Password default: Leone123!
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env") });

const PASSWORD = "Leone123!";
const RUOLO = "backoffice";
const ROMA_UNO_ID = "cdb3a9e1-2603-4147-819e-2bf5729c6731";

const PERMESSI: Record<string, boolean> = {
  titoli: true,
  sinistri: true,
  trattative: true,
  calendario: true,
  contabilita: true,
  rimesse: true,
  ec_clienti: true,
  chiusure: false,
  report: true,
  estrazioni: true,
  anagrafiche: false,
  tabelle_base: true,
  agenzie: false,
  uffici: false,
  manutenzione: false,
  documentale: true,
  template: true,
  provvigioni: true,
  riceve_provvigioni: false,
  pagamenti_provvigioni: false,
};

const SPECIALIST: { nome: string; cognome: string; email: string }[] = [
  { nome: "Francesco", cognome: "Paparella", email: "fgpaparella@consulbrokers.it" },
  { nome: "Antonino", cognome: "Guglielmini", email: "aguglielmini@consulbrokers.it" },
  { nome: "Federico", cognome: "Bartocci", email: "fbartocci@consulbrokers.it" },
  { nome: "Manuela", cognome: "Magalli", email: "mmagalli@consulbrokers.it" },
];

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const byEmail = new Map((listed?.users || []).map((u) => [u.email?.toLowerCase() || "", u.id]));

  for (const s of SPECIALIST) {
    let userId = byEmail.get(s.email.toLowerCase());
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: s.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { nome: s.nome, cognome: s.cognome },
      });
      if (error || !data.user) throw new Error(`${s.email}: ${error?.message || "createUser failed"}`);
      userId = data.user.id;
      console.log("created", s.email);
    } else {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(`${s.email}: ${error.message}`);
      console.log("updated", s.email);
    }

    const { error: pErr } = await admin.from("profiles").upsert({
      id: userId,
      nome: s.nome,
      cognome: s.cognome,
      email: s.email,
      ruolo: RUOLO,
      ufficio_id: ROMA_UNO_ID,
      attivo: true,
      permessi_json: PERMESSI,
    }, { onConflict: "id" });
    if (pErr) throw new Error(`${s.email} profile: ${pErr.message}`);

    await admin.from("user_roles").delete().eq("user_id", userId).neq("role", RUOLO);
    const { error: rErr } = await admin.from("user_roles").upsert(
      { user_id: userId, role: RUOLO },
      { onConflict: "user_id,role" },
    );
    if (rErr) throw new Error(`${s.email} role: ${rErr.message}`);

    await admin.from("profilo_sedi").upsert(
      { profilo_id: userId, ufficio_id: ROMA_UNO_ID, primaria: true },
      { onConflict: "profilo_id,ufficio_id" },
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
