import { supabase } from "@/integrations/supabase/client";
import {
  buildQuietanzaFigliaInsertFromMadre,
  buildQuietanzaFigliaUpdateFromMadre,
  decideCopiaDatiInQuietanza,
  nextRigaQuietanza,
  periodoNuovaQuietanza,
  type CopiaDatiQuietanzaFiglia,
  type CopiaDatiQuietanzaMadre,
} from "@/lib/copiaDatiQuietanza";

const MADRE_SELECT = [
  "id",
  "numero_titolo",
  "riga",
  "stato",
  "sostituisce_polizza",
  "is_appendice_modifica",
  "is_proroga",
  "is_regolazione",
  "cliente_id",
  "cliente_anagrafica_id",
  "prodotto_id",
  "prodotto_nome",
  "ufficio_id",
  "produttore_id",
  "produttore_nome",
  "compagnia_id",
  "compagnia_rapporto_id",
  "codice_rapporto",
  "ramo_id",
  "specialist",
  "commerciale_id",
  "anagrafica_commerciale_id",
  "percentuale_commerciale",
  "percentuale_riparto",
  "percentuale_ae",
  "tipo_mandatario",
  "ae_anagrafica_id",
  "ae_nome",
  "anni_durata",
  "rate",
  "periodicita",
  "frazionamento",
  "tipo_rinnovo",
  "tacito_rinnovo",
  "disdetta_giorni",
  "descrizione_polizza",
  "targa_telaio",
  "risk_type",
  "valuta",
  "cambio",
  "indicizzata",
  "no_calcolo_tasse",
  "durata_da",
  "durata_a",
  "data_scadenza",
  "data_competenza",
  "garanzia_da",
  "garanzia_a",
  "premio_netto",
  "tasse",
  "ssn_firma",
  "addizionali",
  "provvigioni_firma",
  "premio_netto_quietanza",
  "tasse_quietanza",
  "ssn_quietanza",
  "addizionali_quietanza",
  "provvigioni_quietanza",
  "premio_lordo",
  "brokeraggio_firma",
  "brokeraggio_quietanza",
  "percentuale_brokeraggio",
  "tipo_portafoglio",
  "polizza_temporanea",
  "polizza_rateo",
  "cig_rif",
  "cig_temporaneo",
  "vincolo",
  "vincolo_attivo",
  "note",
  "emittenda",
  "formato_elettronico",
  "rimborso",
  "coassicurazione",
].join(", ");

export type CopiaDatiQuietanzaResult = {
  action: "create" | "update";
  quietanzaId: string;
};

const PREMI_COPY_COLS = [
  "garanzia",
  "capitale",
  "tasso",
  "firma",
  "rata",
  "annuo",
  "ordine",
  "aliquota_tasse_pct",
  "lordo_calcolato",
  "is_rca_principale",
  "imposta_provinciale",
  "ssn",
  "codice_garanzia",
  "tipo_premio",
  "quietanza_personalizzata",
  "accessori",
  "provvigione_netto_pct",
  "provvigione_accessori_pct",
  "provvigione_netto_pct_override",
  "provvigione_accessori_pct_override",
  "tasse_rettifica",
] as const;

async function clonePremiMadreSuFiglia(madreId: string, figliaId: string, fattore = 1): Promise<void> {
  const { data: rows, error } = await supabase
    .from("premi_garanzia_polizza")
    .select(PREMI_COPY_COLS.join(", "))
    .eq("titolo_id", madreId)
    .order("ordine");
  if (error) {
    if (String(error.message || "").toLowerCase().includes("tasse_rettifica")) {
      const retry = await supabase
        .from("premi_garanzia_polizza")
        .select(PREMI_COPY_COLS.filter((c) => c !== "tasse_rettifica").join(", "))
        .eq("titolo_id", madreId)
        .order("ordine");
      if (retry.error) throw retry.error;
      await writePremiFiglia(figliaId, (retry.data || []) as unknown as Record<string, unknown>[], fattore);
      return;
    }
    throw error;
  }
  await writePremiFiglia(figliaId, (rows || []) as unknown as Record<string, unknown>[], fattore);
}

async function writePremiFiglia(figliaId: string, rows: Record<string, unknown>[], fattore = 1): Promise<void> {
  const { error: delErr } = await supabase.from("premi_garanzia_polizza").delete().eq("titolo_id", figliaId);
  if (delErr) throw delErr;
  if (!rows.length) return;

  const quietanzaRows = rows.filter((r) => r.tipo_premio === "quietanza");
  const firmaRows = rows.filter((r) => r.tipo_premio === "firma");
  const source = quietanzaRows.length ? quietanzaRows : firmaRows;
  const payload = source.map((r) => {
    const rata = Math.round((Number(r.tipo_premio === "quietanza" ? r.rata : r.firma) || 0) * fattore * 100) / 100;
    return {
      ...r,
      titolo_id: figliaId,
      tipo_premio: "quietanza",
      firma: 0,
      rata,
    };
  });
  const { error: insErr } = await supabase.from("premi_garanzia_polizza").insert(payload as any);
  if (insErr) throw insErr;
}

/**
 * Crea o aggiorna la quietanza figlia con i dati della madre.
 * Insert con `sostituisce_polizza` valorizzato: il trigger non genera rate extra.
 */
export async function copiaDatiPolizzaInQuietanza(madreId: string): Promise<CopiaDatiQuietanzaResult> {
  const { data: madre, error: madreErr } = await supabase
    .from("titoli")
    .select(MADRE_SELECT)
    .eq("id", madreId)
    .maybeSingle();
  if (madreErr) throw madreErr;
  if (!madre) throw new Error("Polizza non trovata");

  const numero = String((madre as CopiaDatiQuietanzaMadre).numero_titolo || "").trim();
  const { data: siblings, error: sibErr } = await supabase
    .from("titoli")
    .select("id, numero_titolo, riga, stato, sostituisce_polizza, data_messa_cassa, is_appendice_modifica, is_proroga, is_regolazione")
    .eq("sostituisce_polizza", numero);
  if (sibErr) throw sibErr;

  const decision = decideCopiaDatiInQuietanza(
    madre as CopiaDatiQuietanzaMadre,
    (siblings || []) as CopiaDatiQuietanzaFiglia[],
  );
  if (decision.action === "blocked") throw new Error(decision.reason);

  if (decision.action === "update") {
    const patch = buildQuietanzaFigliaUpdateFromMadre(madre as CopiaDatiQuietanzaMadre);
    const { error: updErr } = await supabase.from("titoli").update(patch as any).eq("id", decision.target.id);
    if (updErr) throw updErr;
    await clonePremiMadreSuFiglia(madreId, decision.target.id);
    return { action: "update", quietanzaId: decision.target.id };
  }

  const riga = nextRigaQuietanza(madre as CopiaDatiQuietanzaMadre, (siblings || []) as CopiaDatiQuietanzaFiglia[]);
  const insertPayload = buildQuietanzaFigliaInsertFromMadre(madre as CopiaDatiQuietanzaMadre, riga);
  const { data: created, error: insErr } = await supabase
    .from("titoli")
    .insert(insertPayload as any)
    .select("id")
    .single();
  if (insErr) throw insErr;
  if (!created?.id) throw new Error("Quietanza non creata");

  await clonePremiMadreSuFiglia(madreId, created.id);
  const { error: splitErr } = await supabase.rpc("sync_split_commerciali_to_children", {
    p_madre_id: madreId,
  });
  if (splitErr) {
    console.warn("[copiaDatiPolizzaInQuietanza] split:", splitErr.message);
  }

  return { action: "create", quietanzaId: created.id };
}

export type DatiNuovaQuietanza = {
  garanzia_da: string;
  garanzia_a: string;
  data_competenza: string;
  data_scadenza: string;
  note: string;
};

async function caricaMadreECatena(madreId: string) {
  const { data: madre, error: madreErr } = await supabase
    .from("titoli")
    .select(MADRE_SELECT)
    .eq("id", madreId)
    .maybeSingle();
  if (madreErr) throw madreErr;
  if (!madre) throw new Error("Polizza madre non trovata");
  const m = madre as CopiaDatiQuietanzaMadre;
  const { data: siblings, error: sibErr } = await supabase
    .from("titoli")
    .select("id, numero_titolo, riga, stato, sostituisce_polizza, data_messa_cassa, garanzia_a, is_appendice_modifica, is_proroga, is_regolazione")
    .eq("sostituisce_polizza", String(m.numero_titolo || "").trim());
  if (sibErr) throw sibErr;
  return { madre: m, figlie: (siblings || []) as CopiaDatiQuietanzaFiglia[] };
}

/** Valori proposti per la nuova quietanza: rata successiva all'ultima. */
export async function anteprimaNuovaQuietanza(madreId: string): Promise<DatiNuovaQuietanza> {
  const { madre, figlie } = await caricaMadreECatena(madreId);
  const periodo = periodoNuovaQuietanza(madre, figlie);
  if ("reason" in periodo) throw new Error(periodo.reason);
  return {
    garanzia_da: periodo.garanzia_da,
    garanzia_a: periodo.garanzia_a,
    data_competenza: periodo.garanzia_da,
    data_scadenza: periodo.garanzia_a,
    note: madre.note ?? "",
  };
}

/**
 * Nuova quietanza creata a mano (scheda cliente): periodo e note dal dialog,
 * anagrafica, split e garanzie copiati dalla madre (poi modificabili nel secondo passo del dialog).
 */
export async function creaNuovaQuietanza(madreId: string, dati: DatiNuovaQuietanza): Promise<string> {
  if (!dati.garanzia_da || !dati.garanzia_a || dati.garanzia_a <= dati.garanzia_da) {
    throw new Error("La fine garanzia deve essere dopo l'inizio.");
  }
  const { madre, figlie } = await caricaMadreECatena(madreId);
  const gate = periodoNuovaQuietanza(madre, figlie);
  if ("reason" in gate) throw new Error(gate.reason);

  const payload = {
    ...buildQuietanzaFigliaInsertFromMadre(madre, nextRigaQuietanza(madre, figlie)),
    garanzia_da: dati.garanzia_da,
    garanzia_a: dati.garanzia_a,
    data_competenza: dati.data_competenza || dati.garanzia_da,
    data_scadenza: dati.data_scadenza || dati.garanzia_a,
    note: dati.note.trim() || null,
  };
  const { data: created, error: insErr } = await supabase.from("titoli").insert(payload as any).select("id").single();
  if (insErr) throw insErr;

  await clonePremiMadreSuFiglia(madreId, created.id);
  const { error: splitErr } = await supabase.rpc("sync_split_commerciali_to_children", { p_madre_id: madreId });
  if (splitErr) console.warn("[creaNuovaQuietanza] split:", splitErr.message);
  return created.id;
}

/** Annulla una quietanza appena creata dal dialog (righe premi e split si cancellano a cascata). */
export async function eliminaNuovaQuietanza(quietanzaId: string): Promise<void> {
  const { error } = await supabase.from("titoli").delete().eq("id", quietanzaId);
  if (error) throw error;
}
