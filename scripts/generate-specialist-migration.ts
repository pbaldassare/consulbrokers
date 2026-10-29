/**
 * Genera supabase/migrations/20261028141000_specialist_excel_ttbxsp.sql
 * da export TTXSP00F (Specialist legacy).
 */
import XLSX from "xlsx";
import fs from "node:fs";
import path from "node:path";

const XLS_PATH =
  process.env.SPECIALIST_XLSX ||
  "/root/.cursor/projects/home-ubuntu-cursor-projects-cbnet2/uploads/TTXSP00F_20261027105701__1__07a3.xlsx";
const OUT = path.resolve(
  process.cwd(),
  "supabase/migrations/20261028141000_specialist_excel_ttbxsp.sql",
);

const UFFICI: Record<string, string> = {
  ROMA: "cdb3a9e1-2603-4147-819e-2bf5729c6731",
  POTENZA: "e4f0d1f5-e344-4920-b178-d8754904a108",
  CATANIA: "d2c47452-4bb2-4b3b-8a24-a1606357e909",
  FIRENZE: "85e3e5e8-06be-4eb0-b547-c9cc36a70008",
  BERGA: "d2d73996-a161-4a04-be84-260f6c514c23",
  MILANO: "88cf938e-0f81-4fdc-96a8-f9048d08b91b",
  NAPOLI: "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a",
  PALERMO: "05727385-affb-4c21-80dd-1e218482307e",
  CAMPOBASSO: "ebd881c6-cc52-4fbe-a423-2bf1f8498e5c",
  SALERNO: "6153d82f-0e65-4862-81a0-52d438711640",
  PADOVA: "ddd1d20f-9284-41bb-b49e-445817858722",
  PARMA: "a0d09b81-777d-43be-9615-e9d051786e2c",
  GENOVA: "52f824ba-de02-4dbb-b1fd-a545424eaca2",
  "SAN DON": "327e92f7-64f0-48b9-9e48-73611d8cb406",
};

/** Solo codice contabile + banca su profilo sede (ruolo ufficio), senza creare backoffice. */
const SEDE_ONLY_EMAIL: Record<string, string> = {
  BG: "sedebergamo@consulbrokers.it",
  MI: "milano@consulbrokers.it",
  RM: "gestionerm@consulbrokers.it",
};

/** Sempre @consulbrokers.it (Excel a volte ha @consulbroker.it). */
function normalizeEmail(raw: string): string {
  let email = raw.trim().toLowerCase();
  if (!email) return email;
  email = email.replace(/@consulbroker\.it$/i, "@consulbrokers.it");
  email = email.replace(/@consulbrokers\.local$/i, "@consulbrokers.it");
  return email;
}

/** Sede fallback se l'Excel non indica ufficio (trigger backoffice richiede ufficio_id). */
const DEFAULT_UFFICIO_ID = "cdb3a9e1-2603-4147-819e-2bf5729c6731"; // Roma uno

const PERMESSI = {
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

function title(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

function parseName(desc: string) {
  const d = (desc || "").trim().replace(/\s+/g, " ");
  if (!d) return { nome: "Specialist", cognome: "Import" };
  if (/^(sede|seede|ufficio|gestione)\b/i.test(d)) {
    const parts = d.split(" ");
    return { nome: parts.slice(0, 2).join(" "), cognome: parts.slice(2).join(" ") || parts[0] };
  }
  if (d === d.toUpperCase() && d.includes(" ")) {
    const parts = d.split(" ");
    if (parts[0] === "DI" && parts.length >= 3) {
      return { cognome: `Di ${title(parts[1])}`, nome: parts.slice(2).map(title).join(" ") };
    }
    const [c, ...rest] = parts;
    return { cognome: title(c), nome: rest.map(title).join(" ") };
  }
  const parts = d.split(" ");
  if (parts.length >= 2 && parts[0][0] === parts[0][0].toLowerCase()) {
    return { nome: title(parts[0]), cognome: parts.slice(1).map(title).join(" ") };
  }
  return { cognome: title(parts[0]), nome: parts.slice(1).map(title).join(" ") || "—" };
}

function mapUfficio(sede: string) {
  const s = (sede || "").toUpperCase();
  for (const [k, v] of Object.entries(UFFICI)) {
    if (s.includes(k)) return v;
  }
  return null;
}

function excelDate(n: unknown): string | null {
  if (typeof n !== "number" || !n) return null;
  return new Date(Date.UTC(1899, 11, 30 + n)).toISOString().slice(0, 10);
}

function extractIban(...parts: unknown[]) {
  const t = parts.filter(Boolean).join(" ");
  const m = t.match(/IT[0-9A-Z]{2}[0-9A-Z]{23,27}/i);
  return m ? m[0].replace(/\s/g, "").toUpperCase() : null;
}

function sqlStr(v: string | null | undefined) {
  if (v == null || v === "") return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

type Row = {
  cod: string;
  email: string;
  desc: string;
  nome: string;
  cognome: string;
  ufficio: string | null;
  telefono: string;
  fax: string;
  nome_rui: string;
  data_rui: string | null;
  num_rui: string;
  sez_rui: string;
  iban: string | null;
  sedeOnly: boolean;
};

function loadRows(): Row[] {
  const wb = XLSX.readFile(XLS_PATH);
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
  const out: Row[] = [];
  for (const r of raw) {
    if (String(r["A=Ann"] || "").trim().toUpperCase() === "A") continue;
    const cod = String(r["Codice Specialist"] || "").trim();
    const desc = String(r["Descrizione Specialist"] || "").trim();
    let email = normalizeEmail(String(r["E-Mail"] || ""));
    const sedeOnly = !!SEDE_ONLY_EMAIL[cod];
    if (!email && SEDE_ONLY_EMAIL[cod]) email = normalizeEmail(SEDE_ONLY_EMAIL[cod]);
    if (!email) email = `specialist.${cod.toLowerCase()}@consulbrokers.it`;
    const { nome, cognome } = parseName(desc);
    out.push({
      cod,
      email,
      desc,
      nome,
      cognome,
      ufficio: mapUfficio(String(r["Sede"] || desc)),
      telefono: String(r["Telefono"] || "").trim(),
      fax: String(r["Fax"] || "").trim(),
      nome_rui: String(r["Nome RUI "] || "").trim(),
      data_rui: excelDate(r["data RUI "]),
      num_rui: String(r["Num RUI"] || "").trim(),
      sez_rui: String(r["Sez RUI"] || "").trim(),
      iban: extractIban(r["Banca (3)"], r["Banca (2)"], r["Banca (1)"]),
      sedeOnly,
    });
  }
  return out;
}

function main() {
  const rows = loadRows();
  const calls = rows
    .map(
      (r) =>
        `  PERFORM public.import_specialist_excel_row(${sqlStr(r.email)}, ${sqlStr(r.cod)}, ${sqlStr(r.nome)}, ${sqlStr(r.cognome)}, ${sqlStr(r.desc)}, ${r.ufficio ? `'${r.ufficio}'::uuid` : "null"}, ${sqlStr(r.telefono)}, ${sqlStr(r.fax)}, ${sqlStr(r.nome_rui)}, ${r.data_rui ? sqlStr(r.data_rui) : "null"}, ${sqlStr(r.num_rui)}, ${sqlStr(r.sez_rui)}, ${sqlStr(r.iban)}, ${r.sedeOnly});`,
    )
    .join("\n");

  const sql = `-- Specialist da export Excel TTXSP00F_20261027105701 (${rows.length} righe attive)
-- Idempotente: lookup per email, creazione auth solo se assente.

CREATE OR REPLACE FUNCTION public.import_specialist_excel_row(
  p_email text,
  p_codice text,
  p_nome text,
  p_cognome text,
  p_descrizione text,
  p_ufficio_id uuid,
  p_telefono text,
  p_fax text,
  p_nome_rui text,
  p_data_rui date,
  p_num_rui text,
  p_sez_rui text,
  p_iban text,
  p_sede_only boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_user_id uuid;
  v_ruolo text;
  v_ufficio uuid := p_ufficio_id;
  v_perm jsonb := '${JSON.stringify(PERMESSI)}'::jsonb;
BEGIN
  IF v_ufficio IS NULL AND NOT p_sede_only THEN
    v_ufficio := '${DEFAULT_UFFICIO_ID}'::uuid;
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, recovery_sent_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt('Leone123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nome', p_nome, 'cognome', p_cognome),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', v_user_id::text, now(), now(), now()
    );
  END IF;

  SELECT ruolo INTO v_ruolo FROM public.profiles WHERE id = v_user_id;

  IF v_ruolo IS NULL THEN
    INSERT INTO public.profiles (
      id, nome, cognome, email, ruolo, ufficio_id, attivo, permessi_json,
      descrizione, telefono, fax, nome_rui, data_iscrizione_rui, numero_rui, sezione_rui,
      codice_contabile, iban
    ) VALUES (
      v_user_id, p_nome, p_cognome, v_email,
      CASE WHEN p_sede_only THEN 'ufficio' ELSE 'backoffice' END,
      CASE WHEN p_sede_only THEN p_ufficio_id ELSE v_ufficio END, true,
      CASE WHEN p_sede_only THEN null ELSE v_perm END,
      p_descrizione, nullif(p_telefono,''), nullif(p_fax,''),
      nullif(p_nome_rui,''), p_data_rui, nullif(p_num_rui,''), nullif(p_sez_rui,''),
      p_codice, nullif(p_iban,'')
    );
    IF NOT p_sede_only THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'backoffice')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    UPDATE public.profiles SET
      codice_contabile = p_codice,
      descrizione = coalesce(nullif(p_descrizione,''), descrizione),
      telefono = coalesce(nullif(p_telefono,''), telefono),
      fax = coalesce(nullif(p_fax,''), fax),
      nome_rui = coalesce(nullif(p_nome_rui,''), nome_rui),
      data_iscrizione_rui = coalesce(p_data_rui, data_iscrizione_rui),
      numero_rui = coalesce(nullif(p_num_rui,''), numero_rui),
      sezione_rui = coalesce(nullif(p_sez_rui,''), sezione_rui),
      iban = coalesce(nullif(p_iban,''), iban),
      ufficio_id = coalesce(v_ufficio, ufficio_id),
      attivo = true,
      nome = CASE WHEN v_ruolo IN ('admin','cfo') THEN nome ELSE coalesce(nullif(p_nome,''), nome) END,
      cognome = CASE WHEN v_ruolo IN ('admin','cfo') THEN cognome ELSE coalesce(nullif(p_cognome,''), cognome) END,
      ruolo = CASE
        WHEN p_sede_only THEN v_ruolo
        WHEN v_ruolo IN ('admin','cfo','cliente','produttore','corrispondente') THEN v_ruolo
        ELSE 'backoffice'
      END,
      permessi_json = CASE
        WHEN p_sede_only OR v_ruolo IN ('admin','cfo') THEN permessi_json
        ELSE coalesce(permessi_json, v_perm)
      END
    WHERE id = v_user_id;

    IF NOT p_sede_only AND v_ruolo NOT IN ('admin','cfo','cliente') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'backoffice')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_ufficio IS NOT NULL AND NOT p_sede_only THEN
    INSERT INTO public.profilo_sedi (profilo_id, ufficio_id, primaria)
    VALUES (v_user_id, v_ufficio, true)
    ON CONFLICT (profilo_id, ufficio_id) DO NOTHING;
  END IF;
END;
$$;

DO $$
BEGIN
${calls}
END;
$$;

DROP FUNCTION public.import_specialist_excel_row(
  text, text, text, text, text, uuid, text, text, text, date, text, text, text, boolean
);
`;

  fs.writeFileSync(OUT, sql);
  console.log(`Wrote ${OUT} (${rows.length} rows, ${sql.length} bytes)`);
}

main();
