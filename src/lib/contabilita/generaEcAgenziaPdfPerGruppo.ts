import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { buildECAgenziaPdf, type ECAgenziaData, type ECAgenziaTitolo, type ECRiepilogoIncasso } from "@/lib/ec-agenzia-pdf";
import { getProvvigioneEC } from "@/lib/getProvvigioneEC";
import { calcolaRitenutaAcconto, resolvePercentualeRA } from "@/lib/resolvePercentualeRA";
import { resolveCompagniaCollegataNome, resolveMiCodiceEcAgenzia } from "@/lib/ecAgenziaDisplay";
import {
  ecAgenziaCodiceProgressivo,
  ecAgenziaProgressivoEntitaId,
  resolveEcAgenziaMandataria,
} from "@/lib/contabilita/ecAgenziaGruppo";
import { defaultDataEstrattoContoFormatted } from "@/lib/contabilita/defaultDataEstrattoConto";
import { prossimoRiferimentoEc } from "@/lib/contabilita/ecProgressivo";
import { archiviaEcAgenziaPdf, righeFromEcAgenziaTitoli } from "@/lib/contabilita/ecAgenziaArchivio";
import { isIncassoNelPeriodoEcAgenzia } from "@/lib/contabilita/defaultDataLimiteIncasso";

const mesiIt = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

export type EcAgenziaGruppoPdfInput = {
  compagnia_id: string;
  compagnia_rapporto_id: string | null;
  compagniaCollegata: string;
  codice: string;
  titoli: { id: string; cig_rif?: string | null }[];
};

export type GeneraEcAgenziaPdfResult = {
  pdfBytes: Uint8Array;
  riferimento: string;
  nomeFile: string;
  periodoTesto: string;
  ecData: ECAgenziaData;
};

async function fetchSedeNapoliEc() {
  const { data } = await supabase
    .from("uffici")
    .select("nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
    .or("nome_ufficio.ilike.%napoli%,citta.ilike.%napoli%")
    .eq("attivo", true)
    .limit(1)
    .maybeSingle();
  return data;
}

/** Genera PDF E/C per una riga gruppo (agenzia o mandato). */
export async function generaEcAgenziaPdfPerGruppo(
  row: EcAgenziaGruppoPdfInput,
  opts: {
    periodoDalIso: string | null;
    periodoAlIso?: string | null;
    cigByTitoloId?: Map<string, string | null | undefined>;
    riepilogoIncasso?: ECRiepilogoIncasso;
    incrementaProgressivo?: boolean;
    archivia?: { userId: string | null };
    dataDocumento?: string;
  },
): Promise<GeneraEcAgenziaPdfResult | null> {
  const titoliIds = row.titoli.map((t) => t.id);
  if (!titoliIds.length) return null;

  const [{ data: comp }, { data: rapporto }, { data: titoliFull }] = await Promise.all([
    supabase
      .from("compagnie")
      .select("id, nome, codice, indirizzo, cap, comune, provincia, codice_fiscale, partita_iva, iban, intestato_a, percentuale_ra, gruppo_compagnia, gruppi_compagnia(descrizione)")
      .eq("id", row.compagnia_id)
      .maybeSingle(),
    row.compagnia_rapporto_id
      ? supabase
          .from("compagnia_rapporti")
          .select("id, codice_rapporto, iban_dedicato, percentuale_ra, gruppi_compagnia:gruppo_compagnia_id(descrizione, codice)")
          .eq("id", row.compagnia_rapporto_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("titoli")
      .select("id, numero_titolo, riga, premio_lordo, pag_diretto_compagnia, provvigioni_firma, provvigioni_quietanza, sostituisce_polizza, tipo_pagamento, data_messa_cassa, data_copertura, garanzia_da, garanzia_a, durata_da, durata_a, cig_rif, compagnia_rapporti:compagnia_rapporto_id(percentuale_ra), rami:ramo_id(codice, descrizione), clienti_anagrafica:cliente_anagrafica_id(nome, cognome, ragione_sociale)")
      .in("id", titoliIds),
  ]);

  if (!comp) return null;

  const dalIso = opts.periodoDalIso;
  const titoliAgenzia = (titoliFull || []).filter((t: any) => {
    if (!dalIso) return true;
    return (
      isIncassoNelPeriodoEcAgenzia(t.data_messa_cassa, dalIso) ||
      (!t.data_messa_cassa && (t.data_copertura || "").slice(0, 10) >= dalIso)
    );
  });
  if (!titoliAgenzia.length) return null;

  const cigMap =
    opts.cigByTitoloId ||
    new Map(row.titoli.map((t) => [t.id, t.cig_rif] as const));

  const dates = titoliAgenzia.map((t: any) => t.data_messa_cassa).filter(Boolean).sort();
  const periodoTesto = dates.length
    ? (() => {
        const d = new Date(dates[dates.length - 1]);
        return `${mesiIt[d.getMonth()]} ${d.getFullYear()}`;
      })()
    : "";

  const righe: ECAgenziaTitolo[] = titoliAgenzia.map((t: any) => {
    const cli = t.clienti_anagrafica;
    const cliente = cli?.ragione_sociale || `${cli?.cognome || ""} ${cli?.nome || ""}`.trim() || "—";
    const ramoR = t.rami;
    const ramo = ramoR ? ramoR.descrizione || ramoR.codice || "" : "";
    const dFrom = t.garanzia_da || t.durata_da;
    const dTo = t.garanzia_a || t.durata_a;
    const periodo =
      dFrom || dTo
        ? `${dFrom ? format(new Date(dFrom), "dd/MM/yyyy") : "—"} ${dTo ? format(new Date(dTo), "dd/MM/yyyy") : ""}`.trim()
        : "";
    const polizzaRiga = `${t.numero_titolo || ""}${t.riga ? " - " + t.riga : ""}`.trim();
    const provv = getProvvigioneEC(t);
    return {
      polizza: polizzaRiga,
      cig: cigMap.get(t.id) || undefined,
      cliente,
      ramo,
      periodo,
      tp: "AM",
      premio: t.pag_diretto_compagnia ? 0 : Number(t.premio_lordo) || 0,
      provvigioni: provv,
      mi: resolveMiCodiceEcAgenzia(t.tipo_pagamento),
    };
  });

  const totalePremio = righe.reduce((s, rr) => s + rr.premio, 0);
  const totaleProvvigioni = righe.reduce((s, rr) => s + rr.provvigioni, 0);
  const compagniaRA = Number(comp.percentuale_ra) || null;
  const ritenutaAcconto = titoliAgenzia.reduce((sum: number, t: any) => {
    const provv = getProvvigioneEC(t);
    const raEffettiva = resolvePercentualeRA({
      rapporto_percentuale_ra: t.compagnia_rapporti?.percentuale_ra ?? rapporto?.percentuale_ra ?? null,
      compagnia_percentuale_ra: compagniaRA,
    });
    return sum + calcolaRitenutaAcconto(provv, raEffettiva);
  }, 0);

  const mandataria = row.compagniaCollegata || resolveEcAgenziaMandataria(rapporto, comp);
  const codiceProg = ecAgenziaCodiceProgressivo({
    codiceRapporto: row.codice || rapporto?.codice_rapporto,
    codiceGruppo: rapporto?.gruppi_compagnia?.codice,
    codiceCompagnia: comp.codice,
  });
  const progEntita = ecAgenziaProgressivoEntitaId(row.compagnia_id, row.compagnia_rapporto_id);
  const progRes = await prossimoRiferimentoEc("agenzia", progEntita, codiceProg, {
    incrementa: opts.incrementaProgressivo !== false,
  });
  if (!progRes.ok || !progRes.riferimento) {
    throw new Error(progRes.error || `Riferimento progressivo non disponibile per ${codiceProg}`);
  }

  const sedeNapoli = await fetchSedeNapoliEc();
  const dataDocumento = opts.dataDocumento || defaultDataEstrattoContoFormatted();

  const ecData: ECAgenziaData = {
    sedeNome: sedeNapoli?.nome_ufficio || "Sede di Napoli",
    sedeIndirizzo: sedeNapoli?.indirizzo || "",
    sedeCap: sedeNapoli?.cap || "",
    sedeCitta: sedeNapoli?.citta || "",
    sedeProvincia: sedeNapoli?.provincia || "",
    sedeEmail: sedeNapoli?.email || "",
    sedeTelefono: sedeNapoli?.telefono || "",
    riferimento: progRes.riferimento,
    dataDocumento,
    periodoTesto,
    modalitaPagamento: "Bonifico",
    agenziaNome: comp.nome || "",
    compagniaCollegata: mandataria || resolveCompagniaCollegataNome(comp),
    agenziaIndirizzo: comp.indirizzo || "",
    agenziaCap: comp.cap || "",
    agenziaCitta: comp.comune || "",
    agenziaProvincia: comp.provincia || "",
    agenziaCF: comp.codice_fiscale || "",
    agenziaPIVA: comp.partita_iva || "",
    iban: (rapporto?.iban_dedicato || comp.iban || "").trim(),
    intestatoA: comp.intestato_a || comp.nome || "",
    titoli: righe,
    totalePremio,
    totaleProvvigioni,
    ritenutaAcconto,
    riepilogoIncasso: opts.riepilogoIncasso,
  };

  const pdfBytes = await buildECAgenziaPdf(ecData);
  const agCodice = mandataria || row.codice || comp.codice || comp.nome || "agenzia";
  const nomeFile = `EC_Agenzia_${String(agCodice).replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}_${progRes.riferimento.replace(/\//g, "-")}.pdf`;

  if (opts.archivia) {
    await archiviaEcAgenziaPdf({
      compagniaId: row.compagnia_id,
      compagniaRapportoId: row.compagnia_rapporto_id,
      mandataria: mandataria || null,
      riferimento: progRes.riferimento,
      periodoTesto,
      dataDocumento,
      righe: righeFromEcAgenziaTitoli(ecData.titoli),
      pdfBlob: new Blob([pdfBytes as BlobPart], { type: "application/pdf" }),
      nomeFile,
      userId: opts.archivia.userId,
    });
  }

  return { pdfBytes, riferimento: progRes.riferimento, nomeFile, periodoTesto, ecData };
}

/** Uint8Array → base64 per allegato send-email. */
export function pdfBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
