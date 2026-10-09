/**
 * Allinea anagrafiche compagnie: brand in testa → gruppo,
 * resto del nome → agenzia + rapporto plurimandatario.
 *
 * Uso:
 *   bun scripts/apply-agenzie-brand-rapporto.ts --dry-run
 *   bun scripts/apply-agenzie-brand-rapporto.ts --json /tmp/plan.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { generateItalianIban, splitCompagniaAgenzia } from "../src/lib/splitCompagniaAgenzia";
import { validateIban } from "../src/lib/validateIban";

type Compagnia = {
  id: string;
  codice: string | null;
  nome: string;
  nome_segue: string | null;
  nome_sede: string | null;
  tipo: string | null;
  gruppo_compagnia: string | null;
  gruppo_compagnia_id: string | null;
  iban: string | null;
};

type Rapporto = {
  id: string;
  compagnia_id: string;
  gruppo_compagnia_id: string | null;
  codice_rapporto: string | null;
  tipo_rapporto: string | null;
  nome_rapporto: string | null;
  iban_dedicato: string | null;
  sede_denominazione: string | null;
};

type Gruppo = { id: string; descrizione: string };

const args = process.argv.slice(2);
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : "scripts/output/agenzie-brand-rapporto-plan.json";

const compagnie: Compagnia[] = JSON.parse(readFileSync("/tmp/cbnet-compagnie-all.json", "utf8"));
const rapporti: Rapporto[] = JSON.parse(readFileSync("/tmp/cbnet-rapporti-all.json", "utf8"));
const gruppi: Gruppo[] = JSON.parse(readFileSync("/tmp/cbnet-gruppi.json", "utf8"));

const gruppoByDesc = new Map(gruppi.map((g) => [g.descrizione, g]));

const rapportiByComp = new Map<string, Rapporto[]>();
for (const r of rapporti) {
  const list = rapportiByComp.get(r.compagnia_id) || [];
  list.push(r);
  rapportiByComp.set(r.compagnia_id, list);
}

function usableIban(value: string | null | undefined): string | null {
  const v = validateIban(value);
  return v.valid && v.normalized ? v.normalized : null;
}

const plan = compagnie.map((c) => {
  const split = splitCompagniaAgenzia(c.nome, c.tipo);
  const gruppo = split.gruppo ? gruppoByDesc.get(split.gruppo) : undefined;
  const existing = rapportiByComp.get(c.id) || [];
  const targetRap = gruppo ? existing.find((r) => r.gruppo_compagnia_id === gruppo.id) ?? null : null;
  const ibanNow = usableIban(c.iban) || usableIban(targetRap?.iban_dedicato);
  const needIban = !ibanNow && split.esito !== "sconosciuta";
  const iban = ibanNow || (needIban ? generateItalianIban(c.id) : null);
  const agenzia = split.agenzia;
  const renameNome = split.esito === "agenzia_da_brand" && !!agenzia && agenzia !== c.nome;
  const updateSede = !!agenzia && agenzia !== c.nome_sede;
  const updateGruppo = !!gruppo && gruppo.id !== c.gruppo_compagnia_id;
  const rapportoNome = agenzia || c.nome;
  const updateRapporto =
    !!gruppo &&
    (!targetRap ||
      targetRap.gruppo_compagnia_id !== gruppo.id ||
      targetRap.nome_rapporto !== rapportoNome ||
      (targetRap.sede_denominazione || "") !== (agenzia || "") ||
      (!usableIban(targetRap.iban_dedicato) && !!iban));

  return {
    id: c.id,
    codice: c.codice,
    nome: c.nome,
    tipo: c.tipo,
    ...split,
    gruppoId: gruppo?.id ?? null,
    renameNome,
    nomeNuovo: renameNome ? agenzia : c.nome,
    nomeSegue: renameNome && !c.nome_segue ? c.nome : c.nome_segue,
    updateSede,
    nomeSede: updateSede ? agenzia : c.nome_sede,
    updateGruppo,
    needIban,
    iban,
    rapportoId: targetRap?.id ?? null,
    createRapporto:
      !!gruppo &&
      !targetRap &&
      (split.esito === "agenzia_da_brand" || split.esito === "gia_agenzia" || existing.length === 0),
    updateRapporto: !!targetRap && updateRapporto,
    rapportoNome,
    skip: split.esito === "sconosciuta" || (!gruppo && split.esito !== "sconosciuta"),
  };
});

const summary = {
  tot: plan.length,
  agenzia_da_brand: plan.filter((p) => p.esito === "agenzia_da_brand").length,
  solo_compagnia: plan.filter((p) => p.esito === "solo_compagnia").length,
  gia_agenzia: plan.filter((p) => p.esito === "gia_agenzia").length,
  direzione: plan.filter((p) => p.esito === "direzione").length,
  sconosciuta: plan.filter((p) => p.esito === "sconosciuta").length,
  renameNome: plan.filter((p) => p.renameNome).length,
  updateGruppo: plan.filter((p) => p.updateGruppo).length,
  createRapporto: plan.filter((p) => p.createRapporto).length,
  updateRapporto: plan.filter((p) => p.updateRapporto).length,
  needIban: plan.filter((p) => p.needIban).length,
  skip: plan.filter((p) => p.skip).length,
};

mkdirSync(resolve(jsonOut, ".."), { recursive: true });
writeFileSync(jsonOut, JSON.stringify({ summary, plan }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log("Allianz:");
for (const p of plan.filter((x) => (x.gruppo === "ALLIANZ" || /allianz/i.test(x.nome)) && x.esito !== "sconosciuta")) {
  console.log(`  [${p.esito}] ${p.codice} ${p.nome} → agenzia=${p.agenzia || "—"} gruppo=${p.gruppo} rename=${p.renameNome}`);
}
