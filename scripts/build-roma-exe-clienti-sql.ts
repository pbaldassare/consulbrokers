/**
 * Genera SQL di import anagrafiche EXE Roma.
 * Uso: bun scripts/build-roma-exe-clienti-sql.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolveRomaExeCliente, type CatalogoClienteCBnet, type RomaExeClienteRiga } from "../src/lib/romaExeClienti.ts";

type ExeClient = { exe_codice: string; righe: RomaExeClienteRiga[] };

const exe = JSON.parse(readFileSync("/tmp/roma-exe-clienti.json", "utf8")) as ExeClient[];
const catalogoRaw = JSON.parse(readFileSync("/tmp/cbnet-clienti-tax.json", "utf8")) as Array<
  CatalogoClienteCBnet & { cf?: string | null; piva?: string | null; cf_az?: string | null }
>;
const catalogo: CatalogoClienteCBnet[] = catalogoRaw.map((c) => ({
  id: c.id,
  ufficio_id: c.ufficio_id,
  codice_fiscale: c.codice_fiscale ?? c.cf ?? null,
  partita_iva: c.partita_iva ?? c.piva ?? null,
  codice_fiscale_azienda: c.codice_fiscale_azienda ?? c.cf_az ?? null,
}));
const RM2 = "c83a748c-653f-4cbd-b075-b399eccdd1b1";

const resolved = exe.map((c) =>
  resolveRomaExeCliente(c.exe_codice, c.righe, catalogo, { ufficioId: RM2 }),
);

const stats = resolved.reduce(
  (acc, r) => {
    acc[r.esito] = (acc[r.esito] || 0) + 1;
    acc[r.tipoCliente] = (acc[r.tipoCliente] || 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlIdent(id: string): string {
  return `'${id}'::uuid`;
}

const GF = {
  linea_persona: "(SELECT id FROM gf WHERE key = 'linea_persona')",
  aziende_private: "(SELECT id FROM gf WHERE key = 'aziende_private')",
  enti_territoriali: "(SELECT id FROM gf WHERE key = 'enti_territoriali')",
};

const header = `-- Import anagrafiche EXE → CBnet (generato, non editare a mano)
-- ${resolved.length} clienti EXE | ${JSON.stringify(stats)}

DROP TABLE IF EXISTS gf;
CREATE TEMP TABLE gf (key text PRIMARY KEY, id uuid);
INSERT INTO gf (key, id)
SELECT 'linea_persona', id FROM gruppi_finanziari
WHERE nome = 'Linea Persona' AND tipo_soggetto = 'privato'
ORDER BY (SELECT count(*) FROM clienti c WHERE c.gruppo_finanziario_id = gruppi_finanziari.id) DESC
LIMIT 1;
INSERT INTO gf (key, id)
SELECT 'aziende_private', id FROM gruppi_finanziari
WHERE nome = 'Aziende Private' AND tipo_soggetto = 'azienda'
ORDER BY (SELECT count(*) FROM clienti c WHERE c.gruppo_finanziario_id = gruppi_finanziari.id) DESC
LIMIT 1;
INSERT INTO gf (key, id)
SELECT 'enti_territoriali', id FROM gruppi_finanziari
WHERE nome = 'Enti Pubblici Territoriali' AND tipo_soggetto = 'ente'
ORDER BY (SELECT count(*) FROM clienti c WHERE c.gruppo_finanziario_id = gruppi_finanziari.id) DESC
LIMIT 1;

DO $chk$
BEGIN
  IF (SELECT count(*) FROM gf) <> 3 THEN
    RAISE EXCEPTION 'Gruppi finanziari Roma EXE non trovati';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM uffici WHERE codice_ufficio = 'RM2') THEN
    RAISE EXCEPTION 'Ufficio RM2 mancante';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'romaexe@consulbrokers.it') THEN
    RAISE EXCEPTION 'Profilo sede Roma EXE mancante';
  END IF;
END
$chk$;
`;

const existing = resolved.filter((r) => r.esito === "esistente" && r.clienteId);
const created = resolved.filter((r) => r.esito === "da_creare");

const mapExisting = existing
  .map(
    (r) =>
      `  (${sqlStr(r.exeCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.clienteId!)}, 'esistente', ${sqlStr(r.motivo)})`,
  )
  .join(",\n");

const createdWithId = created.map((r) => ({ ...r, newId: randomUUID() }));

const clienteRows = createdWithId.map((r) => {
  const isPriv = r.tipoCliente === "privato";
  return `(${sqlIdent(r.newId)}, ${sqlStr(r.tipoCliente)}, ${sqlStr(r.codiceCliente)}, ${sqlStr(r.ragioneSociale)},
    ${sqlStr(r.nome)}, ${sqlStr(r.cognome)}, ${sqlStr(r.titolo)},
    ${sqlStr(isPriv ? r.codiceFiscale : null)}, ${sqlStr(isPriv ? null : r.partitaIva)}, ${sqlStr(isPriv ? null : r.codiceFiscaleAzienda)},
    ${sqlStr(r.formaGiuridica)}, ${GF[r.gruppoKey]},
    (SELECT id FROM uffici WHERE codice_ufficio = 'RM2'),
    (SELECT email FROM uffici WHERE codice_ufficio = 'RM2'),
    ${sqlStr(r.pec)}, ${sqlStr(r.telefono)}, ${sqlStr(r.cellulare)}, ${sqlStr(r.fax)},
    ${sqlStr(isPriv ? r.indirizzo : null)}, ${sqlStr(isPriv ? r.cap : null)}, ${sqlStr(isPriv ? r.citta : null)}, ${sqlStr(isPriv ? r.provincia : null)},
    ${sqlStr(isPriv ? null : r.indirizzo)}, ${sqlStr(isPriv ? null : r.cap)}, ${sqlStr(isPriv ? null : r.citta)}, ${sqlStr(isPriv ? null : r.provincia)},
    ${sqlStr(r.indirizzoAlternativo)}, ${sqlStr(r.capAlternativo)}, ${sqlStr(r.cittaAlternativa)}, ${sqlStr(r.provinciaAlternativa)},
    ${sqlStr(r.note)}, 'IT', true, 'attivo')`;
});

const mapCreated = createdWithId
  .map(
    (r) =>
      `  (${sqlStr(r.exeCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.newId)}, 'creata', ${sqlStr(r.motivo)})`,
  )
  .join(",\n");

const specialistIds = createdWithId.map((r) => sqlIdent(r.newId)).join(",\n  ");

const CHUNK = 80;
const chunks: string[] = [];
for (let i = 0; i < createdWithId.length; i += CHUNK) {
  const slice = createdWithId.slice(i, i + CHUNK);
  const rows = clienteRows.slice(i, i + CHUNK);
  const maps = slice
    .map(
      (r) =>
        `  (${sqlStr(r.exeCodice)}, ${sqlStr(r.ragioneSociale)}, ${sqlIdent(r.newId)}, 'creata', ${sqlStr(r.motivo)})`,
    )
    .join(",\n");
  const specs = slice.map((r) => sqlIdent(r.newId)).join(",\n  ");
  chunks.push(`INSERT INTO public.clienti (
  id, tipo_cliente, codice_cliente, ragione_sociale,
  nome, cognome, titolo,
  codice_fiscale, partita_iva, codice_fiscale_azienda,
  forma_giuridica, gruppo_finanziario_id,
  ufficio_id, email, pec, telefono, cellulare, fax,
  indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza,
  indirizzo_sede, cap_sede, citta_sede, provincia_sede,
  indirizzo_alternativo, cap_alternativo, citta_alternativa, provincia_alternativa,
  note, nazione, attivo, stato_cliente
)
VALUES
${rows.join(",\n")};

INSERT INTO public.roma_exe_clienti_map (exe_codice, exe_ragione_sociale, cliente_id, esito, motivo)
VALUES
${maps}
ON CONFLICT (exe_codice) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id, esito = EXCLUDED.esito, motivo = EXCLUDED.motivo;

INSERT INTO public.codici_commerciali_cliente (cliente_id, ruolo, profilo_id)
SELECT x.id, 'Backoffice', p.id
FROM (VALUES
  ${specs}
) AS x(id)
JOIN public.profiles p ON p.email = 'romaexe@consulbrokers.it'
ON CONFLICT (cliente_id, ruolo) DO UPDATE
SET profilo_id = EXCLUDED.profilo_id;
`);
}

const prelude = `${header}
${
  existing.length
    ? `INSERT INTO public.roma_exe_clienti_map (exe_codice, exe_ragione_sociale, cliente_id, esito, motivo)
VALUES
${mapExisting}
ON CONFLICT (exe_codice) DO UPDATE
SET cliente_id = EXCLUDED.cliente_id, esito = EXCLUDED.esito, motivo = EXCLUDED.motivo;
`
    : "-- nessun cliente EXE già presente in CBnet per CF/P.IVA"
}
`;

writeFileSync("/tmp/roma-exe-clienti-import.sql", prelude + "\n" + chunks.join("\n"));
writeFileSync("/tmp/roma-exe-clienti-prelude.sql", prelude);
for (let i = 0; i < chunks.length; i++) {
  writeFileSync(`/tmp/roma-exe-clienti-chunk-${String(i + 1).padStart(2, "0")}.sql`, header + "\n" + chunks[i]);
}
writeFileSync(
  "/tmp/roma-exe-clienti-resolved.json",
  JSON.stringify(
    {
      stats,
      existing: existing.map((r) => ({ exe: r.exeCodice, id: r.clienteId, nome: r.ragioneSociale })),
      created: created.length,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ total: resolved.length, stats, existing: existing.length, created: created.length }, null, 2));
