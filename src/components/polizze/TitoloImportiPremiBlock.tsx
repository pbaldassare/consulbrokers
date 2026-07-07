import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PremiGaranziaCardShell,
  emptyGaranziaRow,
  type GaranziaRow,
} from "./PremiGaranziaCardShell";
import {
  syncQuietanzaFromFirma,
  markQuietanzaEdits,
  mirrorAllFromFirma,
  resetQuietanzaRow,
  isQuietanzaSincronizzata,
  rowsAreEmpty,
} from "./premiSync";
import {
  isProvvigioniManualStored,
  provvigioniImportoFromPct,
  provvigioniImportoFromManualPctNetto,
  provvigioniPctFromImporto,
} from "@/lib/provvigioniManual";
import {
  calcProvvigioniGaranzia,
  resolveRowPctNetto,
  resolveRowPctAccessori,
  resolveRowPctNettoAgenzia,
  resolveRowPctAccessoriAgenzia,
  provvPctBreakdown,
  calcTasseRiga,
  calcTasseEffettiveRiga,
  type MatriceProvvAccessori,
  premioRigaDbImporto,
} from "@/lib/calcProvvigioniGaranzia";
import { logAttivita } from "@/lib/logAttivita";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  buildGaranziaRowFromTitoliAggregati,
  fetchPremiGaranziaByTitolo,
  remapDbPremiTipo,
  titoliHaAggregatiPremi,
  type DbPremioLike,
} from "@/lib/premiGaranziaLoad";

/**
 * Sezione "Composizione Premio" (Firma + Quietanza) per TitoloDetail.
 *
 * Allinea la grafica e la logica alla pagina di immissione: stesso componente
 * `PremiGaranziaCardShell`, SSN per riga via flag `rami.ssn_attivo`,
 * provvigioni formattate a 2 decimali.
 *
 * Carica le righe esistenti da `premi_garanzia_polizza` e le mappa a
 * `GaranziaRow`, arricchendo con metadata del sottoramo (id, ssn, aliquota).
 * Su modifica esegue un upsert debounced e aggiorna i totali in `titoli`.
 */
export interface TitoloImportiPremiBlockProps {
  titoloId: string;
  gruppoRamoId: string | null;
  ramoDescrizione?: string | null;
  isLocked: boolean;
  /** Valori correnti su `titoli` per controllare gli input (controlled). */
  addizionaliFirma: number | null | undefined;
  addizionaliQuietanza: number | null | undefined;
  provvigioniFirma: number | null | undefined;
  provvigioniQuietanza: number | null | undefined;
  /** False su quietanza già incassata: nasconde card e sync verso quietanza successiva */
  showQuietanza?: boolean;
  /** Su quietanza rata 2+ nasconde la card Firma (conta solo il premio quietanza della rata) */
  hideFirma?: boolean;
  /** Titolo sorgente (madre / rata 1) per caricare premi se assenti sul titolo corrente */
  fallbackPremiTitoloId?: string | null;
  /** True solo in modalità Modifica Importi: abilita edit garanzie e salvataggio esplicito. */
  draftMode?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

export type TitoloImportiPremiSaveStatus = "idle" | "saving";

export type TitoloImportiPremiBlockHandle = {
  /** Persiste firma + quietanza (chiamato dal pulsante Salva in alto). */
  saveDraft: () => Promise<void>;
  /** Annulla bozza locale e forza ricarico da DB. */
  revertDraft: () => Promise<void>;
  hasPendingChanges: () => boolean;
};

type DbPremio = DbPremioLike & {
  id: string;
  titolo_id: string;
  ordine: number | null;
  tasse_rettifica?: number | null;
};

function dbPremioHasImporto(p: DbPremio, tipo: "firma" | "quietanza"): boolean {
  const stored = tipo === "firma" ? Number(p.firma ?? 0) : Number(p.rata ?? 0);
  return stored > 0 || Number(p.accessori ?? 0) > 0 || Number(p.ssn ?? 0) > 0;
}

function rowHasContent(r: GaranziaRow): boolean {
  return !!(r.sottoramoId || r.codice || r.descrizione.trim() || r.netto || (r.dirittiAgenzia && r.tasse));
}

function hasDraftRows(rows: GaranziaRow[]): boolean {
  return rows.some((r) => !rowHasContent(r));
}

/** Blocca re-idratazione DB solo se l'utente sta compilando una riga nuova accanto a righe già piene. */
function hasInProgressUserEdits(rows: GaranziaRow[]): boolean {
  if (rows.length === 0) return false;
  const filled = rows.filter(rowHasContent).length;
  return filled > 0 && filled < rows.length;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function rowsBase(rows: GaranziaRow[]): number {
  const netto = rows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const accessori = rows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  return netto + accessori;
}

export const TitoloImportiPremiBlock = forwardRef<TitoloImportiPremiBlockHandle, TitoloImportiPremiBlockProps>(
function TitoloImportiPremiBlock({
  titoloId,
  gruppoRamoId,
  ramoDescrizione,
  isLocked,
  addizionaliFirma,
  addizionaliQuietanza,
  provvigioniFirma,
  provvigioniQuietanza,
  showQuietanza = true,
  hideFirma = false,
  fallbackPremiTitoloId = null,
  draftMode = false,
  onDirtyChange,
}, ref) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<TitoloImportiPremiSaveStatus>("idle");
  const savingRef = useRef(false);
  const tasseRettificaSupportedRef = useRef<boolean | null>(null);
  const draftBaselineRef = useRef("");

  // Catalogo sottorami del gruppo: serve a risolvere codice_garanzia → id/SSN/aliquota
  const { data: catalogo = [], isLoading: catalogoLoading } = useQuery({
    queryKey: ["sottorami-titolo-detail", gruppoRamoId || "none"],
    enabled: !!gruppoRamoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rami")
        .select("id, codice, descrizione, aliquota_tasse_ramo, ssn_attivo, aliquota_ssn, escludi_provvigioni, diritti_agenzia")
        .eq("attivo", true)
        .eq("gruppo_ramo_id", gruppoRamoId!)
        .order("codice");
      return (data as any[]) || [];
    },
  });

  const { data: titoloMeta, isLoading: titoloMetaLoading } = useQuery({
    queryKey: ["titolo-meta-premi", titoloId],
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select(
          "compagnia_rapporto_id, ramo_id, premio_netto, premio_netto_quietanza, tasse, tasse_quietanza, ssn_firma, ssn_quietanza, addizionali, addizionali_quietanza, provvigioni_firma, provvigioni_quietanza, premio_lordo, sostituisce_polizza, polizza_rateo",
        )
        .eq("id", titoloId)
        .maybeSingle();
      return data;
    },
  });

  const { data: provvMatrice = null } = useQuery({
    queryKey: ["provv-matrice-titolo", titoloMeta?.compagnia_rapporto_id, gruppoRamoId],
    enabled: !!titoloMeta?.compagnia_rapporto_id && !!gruppoRamoId,
    queryFn: async (): Promise<MatriceProvvAccessori | null> => {
      const { data } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("ramo_id, percentuale_provvigione, percentuale_provvigione_accessori")
        .eq("compagnia_rapporto_id", titoloMeta!.compagnia_rapporto_id!)
        .eq("gruppo_ramo_id", gruppoRamoId!)
        .eq("attiva", true);
      const rows = (data || []) as Array<{
        ramo_id: string | null;
        percentuale_provvigione: number;
        percentuale_provvigione_accessori: number | null;
      }>;
      if (!rows.length) return null;
      const pctByRamoId = new Map<string, number>();
      const pctAccessoriByRamoId = new Map<string, number>();
      let pctDefault: number | null = null;
      let pctAccessoriDefault: number | null = null;
      const counts = new Map<number, number>();
      for (const r of rows) {
        const p = Number(r.percentuale_provvigione);
        if (r.ramo_id) {
          pctByRamoId.set(r.ramo_id, p);
          if (r.percentuale_provvigione_accessori != null) {
            pctAccessoriByRamoId.set(r.ramo_id, Number(r.percentuale_provvigione_accessori));
          }
        } else {
          pctDefault = p;
          if (r.percentuale_provvigione_accessori != null) {
            pctAccessoriDefault = Number(r.percentuale_provvigione_accessori);
          }
        }
        counts.set(p, (counts.get(p) || 0) + 1);
      }
      let bestP = 0, bestC = 0;
      for (const [p, c] of counts) if (c > bestC) { bestC = c; bestP = p; }
      return {
        pctByRamoId,
        pctAccessoriByRamoId,
        pctDefault,
        pctAccessoriDefault,
        pctPrevalente: bestP,
        isUniform: counts.size === 1,
      };
    },
  });

  const { data: premi = [], isLoading: premiLoading } = useQuery({
    queryKey: ["premi-garanzia-import", titoloId],
    queryFn: async () => {
      const { rows, hasTasseRettifica } = await fetchPremiGaranziaByTitolo(titoloId);
      tasseRettificaSupportedRef.current = hasTasseRettifica;
      return rows as DbPremio[];
    },
  });

  const hasQuietanzaPremi = (premi as DbPremio[]).some(
    (p) => p.tipo_premio === "quietanza" && dbPremioHasImporto(p, "quietanza"),
  );
  const needsFallbackPremi = !!fallbackPremiTitoloId && (premi.length === 0 || !hasQuietanzaPremi);
  const { data: fallbackPremi = [], isLoading: fallbackPremiLoading } = useQuery({
    queryKey: ["premi-garanzia-fallback", fallbackPremiTitoloId],
    enabled: needsFallbackPremi,
    queryFn: async () => {
      const { rows, hasTasseRettifica } = await fetchPremiGaranziaByTitolo(fallbackPremiTitoloId!);
      if (tasseRettificaSupportedRef.current === null) {
        tasseRettificaSupportedRef.current = hasTasseRettifica;
      }
      return rows as DbPremio[];
    },
  });

  const catByCodice = useMemo(() => {
    const m = new Map<string, any>();
    (catalogo as any[]).forEach((s: any) => m.set(s.codice, s));
    return m;
  }, [catalogo]);

  // Mappa DbPremio → GaranziaRow arricchita con metadata sottoramo
  const toGaranziaRow = (p: DbPremio): GaranziaRow => {
    const cat = p.codice_garanzia ? catByCodice.get(p.codice_garanzia) : undefined;
    const dirittiAgenzia = !!cat?.diritti_agenzia;
    const escludiProvvigioni = !!cat?.escludi_provvigioni;
    const aliquotaTasse = dirittiAgenzia || escludiProvvigioni
      ? 0
      : (Number(p.aliquota_tasse_pct ?? cat?.aliquota_tasse_ramo ?? 0) || 0);
    const ssnAttivo = !dirittiAgenzia && !escludiProvvigioni && !!cat?.ssn_attivo;
    const aliquotaSsn = ssnAttivo ? Number(cat?.aliquota_ssn ?? 10.5) || 10.5 : 0;
    const stored = p.tipo_premio === "firma" ? Number(p.firma ?? 0) : Number(p.rata ?? 0);
    const rettifica = Number((p as DbPremio).tasse_rettifica ?? 0);
    if (dirittiAgenzia) {
      return {
        _localId: crypto.randomUUID(),
        codice: p.codice_garanzia || null,
        descrizione: cat?.descrizione || p.garanzia || "",
        netto: "",
        accessori: "",
        tasse: stored ? stored.toFixed(2) : "",
        tasseRettifica: "",
        aliquotaTasse: 0,
        sottoramoId: cat?.id || null,
        ssn: "",
        aliquotaSsn: 0,
        ssnAttivo: false,
        ssnManualOverride: false,
        escludiProvvigioni: false,
        dirittiAgenzia: true,
        provvNettoPct: p.provvigione_netto_pct_override && p.provvigione_netto_pct != null ? Number(p.provvigione_netto_pct) : undefined,
        provvNettoPctOverride: !!p.provvigione_netto_pct_override,
        provvAccessoriPct: p.provvigione_accessori_pct_override && p.provvigione_accessori_pct != null ? Number(p.provvigione_accessori_pct) : undefined,
        provvAccessoriPctOverride: !!p.provvigione_accessori_pct_override,
        quietanzaPersonalizzata: p.tipo_premio === "quietanza" ? !!p.quietanza_personalizzata : undefined,
      };
    }
    const netto = stored;
    const accessori = Number(p.accessori ?? 0);
    const ssn = p.ssn != null ? Number(p.ssn) : 0;
    const ssnAuto = ssnAttivo ? round2((netto * aliquotaSsn) / 100) : 0;
    const ssnManualOverride = ssnAttivo && Math.abs(ssn - ssnAuto) > 0.01;
    const tasseCalc = aliquotaTasse > 0 && (netto > 0 || accessori > 0)
      ? calcTasseRiga(netto, accessori, aliquotaTasse)
      : 0;
    return {
      _localId: crypto.randomUUID(),
      codice: p.codice_garanzia || null,
      descrizione: cat?.descrizione || p.garanzia || "",
      netto: netto ? netto.toFixed(2) : "",
      accessori: accessori ? accessori.toFixed(2) : "",
      tasse: escludiProvvigioni ? "0" : (tasseCalc ? tasseCalc.toFixed(2) : ""),
      tasseRettifica: rettifica !== 0 ? rettifica.toFixed(2) : "",
      tasseManualOverride: !escludiProvvigioni && rettifica !== 0,
      aliquotaTasse,
      sottoramoId: cat?.id || null,
      ssn: ssn ? ssn.toFixed(2) : "",
      aliquotaSsn,
      ssnAttivo,
      ssnManualOverride,
      escludiProvvigioni,
      dirittiAgenzia: false,
      provvNettoPct: p.provvigione_netto_pct_override && p.provvigione_netto_pct != null ? Number(p.provvigione_netto_pct) : undefined,
      provvNettoPctOverride: !!p.provvigione_netto_pct_override,
      provvAccessoriPct: p.provvigione_accessori_pct_override && p.provvigione_accessori_pct != null ? Number(p.provvigione_accessori_pct) : undefined,
      provvAccessoriPctOverride: !!p.provvigione_accessori_pct_override,
      quietanzaPersonalizzata: p.tipo_premio === "quietanza" ? !!p.quietanza_personalizzata : undefined,
    };
  };

  const [firmaRows, setFirmaRows] = useState<GaranziaRow[]>([]);
  const [quietanzaRows, setQuietanzaRows] = useState<GaranziaRow[]>([]);
  const firmaRowsRef = useRef(firmaRows);
  const quietanzaRowsRef = useRef(quietanzaRows);
  firmaRowsRef.current = firmaRows;
  quietanzaRowsRef.current = quietanzaRows;
  /** false = provvigioni impostate manualmente (% o totale €), non ricalcolate dalla matrice */
  const [provvFirmaAuto, setProvvFirmaAuto] = useState(true);
  const [provvQuietanzaAuto, setProvvQuietanzaAuto] = useState(true);
  const provvFirmaAutoRef = useRef(true);
  const provvQuietanzaAutoRef = useRef(true);
  const manualPctFirmaRef = useRef("");
  const manualPctQuietanzaRef = useRef("");
  /** Importo € digitato a mano (priorità sul ricalcolo da %). */
  const manualImportoFirmaRef = useRef<number | null>(null);
  const manualImportoQuietanzaRef = useRef<number | null>(null);
  const manualFromEuroFirmaRef = useRef(false);
  const manualFromEuroQuietanzaRef = useRef(false);
  const manualUserEditFirmaRef = useRef(false);
  const manualUserEditQuietanzaRef = useRef(false);
  const [, bumpProvvDisplay] = useState(0);

  const setProvvAuto = (tipo: "firma" | "quietanza", auto: boolean) => {
    if (tipo === "firma") {
      provvFirmaAutoRef.current = auto;
      setProvvFirmaAuto(auto);
    } else {
      provvQuietanzaAutoRef.current = auto;
      setProvvQuietanzaAuto(auto);
    }
  };

  // Refresh state quando arrivano i dati DB o cambia il catalogo
  const lastSnapRef = useRef<string>("");
  useEffect(() => {
    lastSnapRef.current = "";
    setFirmaRows([]);
    setQuietanzaRows([]);
    manualUserEditFirmaRef.current = false;
    manualUserEditQuietanzaRef.current = false;
  }, [titoloId]);

  const enrichGaranziaRow = (r: GaranziaRow): GaranziaRow => {
    // Deriva solo il sottoramo se mancante; le % provvigioni si risolvono via
    // resolver (matrice agenzia o override di riga), non vanno "congelate" qui.
    if (r.sottoramoId || !titoloMeta?.ramo_id) return r;
    return { ...r, sottoramoId: titoloMeta.ramo_id as string };
  };

  useEffect(() => {
    if (draftMode) return;
    if (savingRef.current) return;
    if (hasInProgressUserEdits(firmaRowsRef.current) || hasInProgressUserEdits(quietanzaRowsRef.current)) return;

    if (titoloMetaLoading || premiLoading) return;
    if (!titoloMeta) return;
    if (needsFallbackPremi && fallbackPremiLoading) return;

    const mightSynthFromAggregati =
      titoliHaAggregatiPremi(titoloMeta, hideFirma ? "quietanza" : "firma") ||
      titoliHaAggregatiPremi(titoloMeta, "quietanza");
    if (
      gruppoRamoId &&
      catalogoLoading &&
      premi.length === 0 &&
      !fallbackPremi.length &&
      mightSynthFromAggregati
    ) {
      return;
    }

    let fRaw = (premi as DbPremio[]).filter((p) => p.tipo_premio === "firma");
    let qRaw = (premi as DbPremio[]).filter((p) => p.tipo_premio === "quietanza");
    if (qRaw.length && qRaw.every((p) => !dbPremioHasImporto(p, "quietanza"))) {
      qRaw = [];
    }

    // Fallback: premi da madre / rata 1 se assenti sul titolo corrente
    if (fallbackPremi.length) {
      if (!fRaw.length && !hideFirma) {
        fRaw = (fallbackPremi as DbPremio[]).filter((p) => p.tipo_premio === "firma");
      }
      if (!qRaw.length) {
        qRaw = (fallbackPremi as DbPremio[]).filter((p) => p.tipo_premio === "quietanza");
        if (!qRaw.length && hideFirma) {
          qRaw = remapDbPremiTipo(fallbackPremi as DbPremio[], "quietanza", "quietanza") as DbPremio[];
          if (!qRaw.length) {
            qRaw = remapDbPremiTipo(fallbackPremi as DbPremio[], "firma", "quietanza") as DbPremio[];
          }
        } else if (!qRaw.length && fRaw.length) {
          qRaw = remapDbPremiTipo(fRaw, "firma", "quietanza") as DbPremio[];
        }
      }
    }

    const snap = JSON.stringify({
      f: fRaw.map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.firma, t: p.aliquota_tasse_pct, s: p.ssn })),
      q: qRaw.map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.rata, t: p.aliquota_tasse_pct, s: p.ssn, pz: p.quietanza_personalizzata })),
      cat: catalogo.length,
      fb: fallbackPremiTitoloId,
      hide: hideFirma,
    });
    if (snap === lastSnapRef.current) return;
    lastSnapRef.current = snap;

    let firmaMapped = fRaw.length ? fRaw.map(toGaranziaRow) : [emptyGaranziaRow()];
    let quietanzaMapped = qRaw.length
      ? qRaw.map(toGaranziaRow)
      : fRaw.length && !hideFirma
        ? mirrorAllFromFirma(firmaMapped)
        : [emptyGaranziaRow()];

    // Fix: quietanza "sincronizzata" ma con zeri mentre la Firma ha importi
    if (
      !hideFirma &&
      fRaw.length &&
      rowsAreEmpty(quietanzaMapped) &&
      !rowsAreEmpty(firmaMapped) &&
      isQuietanzaSincronizzata(quietanzaMapped)
    ) {
      quietanzaMapped = mirrorAllFromFirma(firmaMapped);
    }

    // Fallback da aggregati su titoli (quietanze auto-generate spesso non hanno righe in premi_garanzia_polizza)
    if (titoloMeta) {
      if (!fRaw.length && !hideFirma) {
        const synth = buildGaranziaRowFromTitoliAggregati("firma", titoloMeta, catalogo as any[]);
        if (synth) firmaMapped = [synth];
      }
      if (!qRaw.length) {
        const synthQ = buildGaranziaRowFromTitoliAggregati("quietanza", titoloMeta, catalogo as any[]);
        if (synthQ) quietanzaMapped = [synthQ];
      }
    }

    firmaMapped = firmaMapped.map(enrichGaranziaRow);
    quietanzaMapped = quietanzaMapped.map(enrichGaranziaRow);

    setFirmaRows(firmaMapped);
    setQuietanzaRows(quietanzaMapped);

    // Se il valore salvato su titoli diverge dal calcolo matrice → override manuale (importo esatto)
    const calcF = provvMatrice ? round2(calcProvvigioniGaranzia(firmaMapped, provvMatrice)) : 0;
    const calcQ = provvMatrice ? round2(calcProvvigioniGaranzia(quietanzaMapped, provvMatrice)) : 0;
    const storedF = Number(provvigioniFirma) || 0;
    const storedQ = Number(provvigioniQuietanza) || 0;

    if (manualUserEditFirmaRef.current || isProvvigioniManualStored(storedF, calcF)) {
      manualImportoFirmaRef.current = storedF;
      manualFromEuroFirmaRef.current = true;
      manualPctFirmaRef.current = "";
      setProvvAuto("firma", false);
    } else {
      manualImportoFirmaRef.current = null;
      manualFromEuroFirmaRef.current = false;
      manualPctFirmaRef.current = "";
      manualUserEditFirmaRef.current = false;
      setProvvAuto("firma", true);
    }

    if (manualUserEditQuietanzaRef.current || isProvvigioniManualStored(storedQ, calcQ)) {
      manualImportoQuietanzaRef.current = storedQ;
      manualFromEuroQuietanzaRef.current = true;
      manualPctQuietanzaRef.current = "";
      setProvvAuto("quietanza", false);
    } else {
      manualImportoQuietanzaRef.current = null;
      manualFromEuroQuietanzaRef.current = false;
      manualPctQuietanzaRef.current = "";
      manualUserEditQuietanzaRef.current = false;
      setProvvAuto("quietanza", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    premi,
    premiLoading,
    catalogo,
    catalogoLoading,
    provvMatrice,
    provvigioniFirma,
    provvigioniQuietanza,
    fallbackPremi,
    fallbackPremiLoading,
    fallbackPremiTitoloId,
    needsFallbackPremi,
    hideFirma,
    titoloMeta,
    titoloMetaLoading,
    gruppoRamoId,
    draftMode,
  ]);

  const serializeDraft = () =>
    JSON.stringify({
      f: firmaRowsRef.current,
      q: quietanzaRowsRef.current,
      pf: manualPctFirmaRef.current,
      pq: manualPctQuietanzaRef.current,
      mif: manualImportoFirmaRef.current,
      miq: manualImportoQuietanzaRef.current,
      eff: manualFromEuroFirmaRef.current,
      efq: manualFromEuroQuietanzaRef.current,
      af: provvFirmaAutoRef.current,
      aq: provvQuietanzaAutoRef.current,
    });

  useEffect(() => {
    if (!draftMode) {
      draftBaselineRef.current = "";
      return;
    }
    draftBaselineRef.current = serializeDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftMode]);

  const isDirty =
    draftMode && !!draftBaselineRef.current && serializeDraft() !== draftBaselineRef.current;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const resolveProvvigioniImporto = (
    tipo: "firma" | "quietanza",
    rows: GaranziaRow[],
  ): number => {
    const auto = tipo === "firma" ? provvFirmaAutoRef.current : provvQuietanzaAutoRef.current;
    if (auto) return round2(calcProvvigioniGaranzia(rows, provvMatrice));
    const fromEuro = tipo === "firma" ? manualFromEuroFirmaRef.current : manualFromEuroQuietanzaRef.current;
    const importo = tipo === "firma" ? manualImportoFirmaRef.current : manualImportoQuietanzaRef.current;
    if (fromEuro && importo != null) return importo;
    const pct = tipo === "firma" ? manualPctFirmaRef.current : manualPctQuietanzaRef.current;
    return round2(provvigioniImportoFromManualPctNetto(rows, pct, provvMatrice));
  };

  const copyProvvFirmaToQuietanza = () => {
    provvQuietanzaAutoRef.current = provvFirmaAutoRef.current;
    setProvvQuietanzaAuto(provvFirmaAutoRef.current);
    manualPctQuietanzaRef.current = manualPctFirmaRef.current;
    manualImportoQuietanzaRef.current = manualImportoFirmaRef.current;
    manualFromEuroQuietanzaRef.current = manualFromEuroFirmaRef.current;
    manualUserEditQuietanzaRef.current = manualUserEditFirmaRef.current;
    bumpProvvDisplay((n) => n + 1);
  };

  // Persist esplicito (solo da saveDraft)
  const persistRows = async (rows: GaranziaRow[], tipo: "firma" | "quietanza") => {
    const validRows = rows.filter(rowHasContent);
    if (validRows.length < rows.length) {
      throw new Error("Completa o rimuovi le righe garanzia vuote prima di salvare.");
    }

    savingRef.current = true;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const payload = validRows.map((r, idx) => {
        const importo = premioRigaDbImporto(r);
        return {
          titolo_id: titoloId,
          tipo_premio: tipo,
          garanzia: (r.descrizione && r.descrizione.trim()) || r.codice || "Premio",
          codice_garanzia: r.codice || null,
          capitale: 0,
          tasso: 0,
          firma: tipo === "firma" ? importo : 0,
          rata: tipo === "quietanza" ? importo : 0,
          accessori: parseFloat(r.accessori || "0") || 0,
          annuo: 0,
          ordine: idx,
          aliquota_tasse_pct: r.aliquotaTasse || null,
          ssn: parseFloat(r.ssn || "0") || 0,
          tasse_rettifica: parseFloat(r.tasseRettifica || "0") || 0,
          provvigione_netto_pct: resolveRowPctNetto(r, provvMatrice).pct,
          provvigione_accessori_pct: resolveRowPctAccessori(r, provvMatrice).pct,
          provvigione_netto_pct_override: !!r.provvNettoPctOverride,
          provvigione_accessori_pct_override: !!r.provvAccessoriPctOverride,
          ...(tipo === "quietanza" ? { quietanza_personalizzata: !!r.quietanzaPersonalizzata } : {}),
        };
      });

      const sum = (rs: GaranziaRow[], k: "netto" | "ssn" | "accessori") =>
        rs.reduce((s, r) => s + (parseFloat(r[k] || "0") || 0), 0);
      const totNetto = round2(sum(rows, "netto"));
      const totAccessori = round2(sum(rows, "accessori"));
      const totTasse = round2(rows.reduce((s, r) => s + calcTasseEffettiveRiga(r), 0));
      const totSsn = round2(sum(rows, "ssn"));
      const lordo = round2(totNetto + totAccessori + totTasse + totSsn);
      const updates: Record<string, number> = {};

      if (tipo === "firma") {
        updates.premio_netto = totNetto;
        updates.addizionali = totAccessori;
        updates.tasse = totTasse;
        updates.ssn_firma = totSsn;
        updates.premio_lordo = lordo;
        updates.provvigioni_firma = resolveProvvigioniImporto("firma", rows);
      } else {
        updates.premio_netto_quietanza = totNetto;
        updates.addizionali_quietanza = totAccessori;
        updates.tasse_quietanza = totTasse;
        updates.ssn_quietanza = totSsn;
        updates.provvigioni_quietanza = resolveProvvigioniImporto("quietanza", rows);
        updates.premio_lordo = lordo;
        // Su quietanza/rata: allinea anche i campi operativi usati da incasso e liste
        if (hideFirma || !!titoloMeta?.sostituisce_polizza) {
          updates.premio_netto = totNetto;
          updates.addizionali = totAccessori;
          updates.tasse = totTasse;
          updates.ssn_firma = totSsn;
          updates.provvigioni_firma = updates.provvigioni_quietanza;
        }
      }

      const rpcRows = payload.map(({ titolo_id: _tid, tipo_premio: _tp, ...rest }) => {
        if (tasseRettificaSupportedRef.current === false) {
          const { tasse_rettifica: _t, ...noRettifica } = rest;
          return noRettifica;
        }
        return rest;
      });

      const { error: rpcErr } = await (supabase.rpc as any)("salva_premi_garanzia_titolo", {
        p_titolo_id: titoloId,
        p_tipo_premio: tipo,
        p_rows: rpcRows,
        p_titolo_updates: updates,
      });
      if (rpcErr) {
        toast.error("Errore salvataggio premi: " + rpcErr.message);
        throw rpcErr;
      }

      lastSnapRef.current = JSON.stringify({
        f: tipo === "firma"
          ? validRows.map((r) => ({ c: r.codice, n: parseFloat(r.netto || "0") || 0, t: r.aliquotaTasse, s: parseFloat(r.ssn || "0") || 0 }))
          : (premi as DbPremio[]).filter((p) => p.tipo_premio === "firma").map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.firma, t: p.aliquota_tasse_pct, s: p.ssn })),
        q: tipo === "quietanza"
          ? validRows.map((r) => ({ c: r.codice, n: parseFloat(r.netto || "0") || 0, t: r.aliquotaTasse, s: parseFloat(r.ssn || "0") || 0, pz: !!r.quietanzaPersonalizzata }))
          : (premi as DbPremio[]).filter((p) => p.tipo_premio === "quietanza").map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.rata, t: p.aliquota_tasse_pct, s: p.ssn, pz: p.quietanza_personalizzata })),
        cat: catalogo.length,
        fb: fallbackPremiTitoloId,
        hide: hideFirma,
      });
      await qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
      await qc.invalidateQueries({ queryKey: ["titolo-meta-premi", titoloId] });
      await qc.invalidateQueries({ queryKey: ["premi-garanzia-import", titoloId] });
      await qc.invalidateQueries({ queryKey: ["premi-garanzia", titoloId] });
      await qc.invalidateQueries({ queryKey: ["polizze_cliente"] });
      await qc.invalidateQueries({ queryKey: ["riparto", titoloId] });
      if (tipo === "firma" && !provvFirmaAutoRef.current) {
        manualUserEditFirmaRef.current = true;
      }
      if (tipo === "quietanza" && !provvQuietanzaAutoRef.current) {
        manualUserEditQuietanzaRef.current = true;
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
      setSaveStatus("idle");
    }
  };

  const saveDraft = async () => {
    if (isLocked || !draftMode) return;
    if (!hideFirma) await persistRows(firmaRowsRef.current, "firma");
    if (showQuietanza) await persistRows(quietanzaRowsRef.current, "quietanza");
    draftBaselineRef.current = serializeDraft();
  };

  const revertDraft = async () => {
    lastSnapRef.current = "";
    draftBaselineRef.current = "";
    manualPctFirmaRef.current = "";
    manualPctQuietanzaRef.current = "";
    manualImportoFirmaRef.current = null;
    manualImportoQuietanzaRef.current = null;
    manualFromEuroFirmaRef.current = false;
    manualFromEuroQuietanzaRef.current = false;
    manualUserEditFirmaRef.current = false;
    manualUserEditQuietanzaRef.current = false;
    setProvvAuto("firma", true);
    setProvvAuto("quietanza", true);
    bumpProvvDisplay((n) => n + 1);
    await qc.invalidateQueries({ queryKey: ["premi-garanzia-import", titoloId] });
    await qc.invalidateQueries({ queryKey: ["titolo-meta-premi", titoloId] });
  };

  const hasPendingChanges = () => isDirty;

  useImperativeHandle(ref, () => ({ saveDraft, revertDraft, hasPendingChanges }), [
    isLocked,
    draftMode,
    hideFirma,
    showQuietanza,
    isDirty,
  ]);

  const onFirmaChange = (next: GaranziaRow[]) => {
    if (!draftMode || isLocked) return;
    setFirmaRows(next);

    if (hideFirma || !showQuietanza) return;

    const syncedQuietanza = syncQuietanzaFromFirma(next, quietanzaRows);
    setQuietanzaRows(syncedQuietanza);
    if (isQuietanzaSincronizzata(syncedQuietanza)) {
      copyProvvFirmaToQuietanza();
    }
  };

  const onQuietanzaChange = (next: GaranziaRow[]) => {
    if (!draftMode || isLocked) return;
    const marked = markQuietanzaEdits(quietanzaRows, next);
    setQuietanzaRows(marked);
  };

  const resyncAllFromFirma = () => {
    if (isLocked || !draftMode) return;
    const mirrored = mirrorAllFromFirma(firmaRows);
    setQuietanzaRows(mirrored);
    copyProvvFirmaToQuietanza();
  };

  const resyncRowFromFirma = (idx: number) => {
    if (isLocked || !draftMode) return;
    const updated = resetQuietanzaRow(firmaRows, quietanzaRows, idx);
    setQuietanzaRows(updated);
  };

  const accessoriFirmaNum = firmaRows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  const accessoriQuietanzaNum = quietanzaRows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  const rowPctAccessoriFn = (row: GaranziaRow) => resolveRowPctAccessori(row, provvMatrice).pct;
  const rowPctNettoFn = (row: GaranziaRow) => resolveRowPctNetto(row, provvMatrice).pct;
  const rowAgencyPctNettoFn = (row: GaranziaRow) => resolveRowPctNettoAgenzia(row, provvMatrice).pct;
  const rowAgencyPctAccessoriFn = (row: GaranziaRow) => resolveRowPctAccessoriAgenzia(row, provvMatrice).pct;
  const provvBreakdownFirma = provvPctBreakdown(firmaRows, provvMatrice);
  const provvBreakdownQuietanza = provvPctBreakdown(quietanzaRows, provvMatrice);

  // --- Override % provvigioni per voce (con conferma + log attività) -------
  type PctOverridePending = {
    tipo: "firma" | "quietanza";
    idx: number;
    campo: "netto" | "accessori";
    voce: string;
    from: number;
    to: number;
    agency: number;
  };
  const [pctOverride, setPctOverride] = useState<PctOverridePending | null>(null);

  const patchRowProvv = (
    row: GaranziaRow,
    campo: "netto" | "accessori",
    pct: number | null,
    override: boolean,
  ): GaranziaRow =>
    campo === "netto"
      ? { ...row, provvNettoPct: override ? pct : undefined, provvNettoPctOverride: override }
      : { ...row, provvAccessoriPct: override ? pct : undefined, provvAccessoriPctOverride: override };

  const applyProvvPct = async (
    tipo: "firma" | "quietanza",
    idx: number,
    campo: "netto" | "accessori",
    pct: number | null,
    override: boolean,
    agency: number,
    prevEff: number,
    voce: string,
  ) => {
    const baseRows = tipo === "firma" ? firmaRowsRef.current : quietanzaRowsRef.current;
    const nextRows = baseRows.map((r, i) => {
      if (i !== idx) return r;
      const nr = patchRowProvv(r, campo, pct, override);
      // Su quietanza: l'override scollega la voce dalla sincronizzazione automatica.
      return tipo === "quietanza" ? { ...nr, quietanzaPersonalizzata: true } : nr;
    });
    if (tipo === "firma") {
      setFirmaRows(nextRows);
      if (!hideFirma && showQuietanza) {
        setQuietanzaRows(syncQuietanzaFromFirma(nextRows, quietanzaRowsRef.current));
      }
    } else {
      setQuietanzaRows(nextRows);
    }
    await logAttivita({
      azione: override ? "override_provvigione_voce" : "reset_provvigione_voce",
      entita_tipo: "titolo",
      entita_id: titoloId,
      dettagli_json: {
        tipo_premio: tipo,
        voce,
        campo,
        pct_agenzia: round2(agency),
        pct_precedente: round2(prevEff),
        pct_nuova: override && pct != null ? round2(pct) : round2(agency),
      },
      severity: "warning",
    });
  };

  const requestProvvPctOverride = (
    tipo: "firma" | "quietanza",
    idx: number,
    campo: "netto" | "accessori",
    nextPct: number | null,
  ) => {
    if (garanzieReadOnly) return;
    const rows = tipo === "firma" ? firmaRowsRef.current : quietanzaRowsRef.current;
    const row = rows[idx];
    if (!row) return;
    const voce = row.descrizione?.trim() || row.codice || "Voce";
    const agency =
      campo === "netto"
        ? resolveRowPctNettoAgenzia(row, provvMatrice).pct
        : resolveRowPctAccessoriAgenzia(row, provvMatrice).pct;
    const current =
      campo === "netto"
        ? resolveRowPctNetto(row, provvMatrice).pct
        : resolveRowPctAccessori(row, provvMatrice).pct;
    const wasOverride = campo === "netto" ? !!row.provvNettoPctOverride : !!row.provvAccessoriPctOverride;

    // Torna al valore agenzia → reset dell'override (log, nessuna conferma).
    if (nextPct == null || Math.abs(nextPct - agency) < 0.0001) {
      if (!wasOverride) return;
      void applyProvvPct(tipo, idx, campo, null, false, agency, current, voce);
      return;
    }
    if (Math.abs(nextPct - current) < 0.0001) return;
    setPctOverride({ tipo, idx, campo, voce, from: current, to: nextPct, agency });
  };

  const resetProvvPct = (tipo: "firma" | "quietanza", idx: number, campo: "netto" | "accessori") => {
    if (garanzieReadOnly) return;
    const rows = tipo === "firma" ? firmaRowsRef.current : quietanzaRowsRef.current;
    const row = rows[idx];
    if (!row) return;
    const voce = row.descrizione?.trim() || row.codice || "Voce";
    const agency =
      campo === "netto"
        ? resolveRowPctNettoAgenzia(row, provvMatrice).pct
        : resolveRowPctAccessoriAgenzia(row, provvMatrice).pct;
    const current =
      campo === "netto"
        ? resolveRowPctNetto(row, provvMatrice).pct
        : resolveRowPctAccessori(row, provvMatrice).pct;
    void applyProvvPct(tipo, idx, campo, null, false, agency, current, voce);
  };

  const confirmPctOverride = () => {
    if (!pctOverride) return;
    const { tipo, idx, campo, from, to, agency, voce } = pctOverride;
    void applyProvvPct(tipo, idx, campo, to, true, agency, from, voce);
    setPctOverride(null);
  };

  const totNettoFirma = firmaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totNettoQui = quietanzaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totBaseFirma = totNettoFirma + accessoriFirmaNum;
  const totBaseQui = totNettoQui + accessoriQuietanzaNum;
  const displayProvvFirma = resolveProvvigioniImporto("firma", firmaRows);
  const displayProvvQuietanza = resolveProvvigioniImporto("quietanza", quietanzaRows);
  const pctFirma = !provvFirmaAuto
    ? (manualFromEuroFirmaRef.current && manualImportoFirmaRef.current != null
      ? provvigioniPctFromImporto(manualImportoFirmaRef.current, totBaseFirma)
      : manualPctFirmaRef.current)
    : provvBreakdownFirma
      ? String(provvBreakdownFirma.pctNetto)
      : "";
  const pctQui = !provvQuietanzaAuto
    ? (manualFromEuroQuietanzaRef.current && manualImportoQuietanzaRef.current != null
      ? provvigioniPctFromImporto(manualImportoQuietanzaRef.current, totBaseQui)
      : manualPctQuietanzaRef.current)
    : provvBreakdownQuietanza
      ? String(provvBreakdownQuietanza.pctNetto)
      : "";

  const setProvvigioniManualPct = (tipo: "firma" | "quietanza", v: string) => {
    if (isLocked || !draftMode) return;
    if (tipo === "firma") {
      manualPctFirmaRef.current = v;
      manualImportoFirmaRef.current = null;
      manualFromEuroFirmaRef.current = false;
      manualUserEditFirmaRef.current = true;
    } else {
      manualPctQuietanzaRef.current = v;
      manualImportoQuietanzaRef.current = null;
      manualFromEuroQuietanzaRef.current = false;
      manualUserEditQuietanzaRef.current = true;
    }
    setProvvAuto(tipo, false);
    bumpProvvDisplay((n) => n + 1);
  };

  const setProvvigioniManualImporto = (tipo: "firma" | "quietanza", importo: number) => {
    if (isLocked || !draftMode) return;
    if (tipo === "firma") {
      manualImportoFirmaRef.current = importo;
      manualFromEuroFirmaRef.current = true;
      manualPctFirmaRef.current = "";
      manualUserEditFirmaRef.current = true;
    } else {
      manualImportoQuietanzaRef.current = importo;
      manualFromEuroQuietanzaRef.current = true;
      manualPctQuietanzaRef.current = "";
      manualUserEditQuietanzaRef.current = true;
    }
    setProvvAuto(tipo, false);
    bumpProvvDisplay((n) => n + 1);
  };

  const resetProvvigioniAuto = (tipo: "firma" | "quietanza") => {
    if (isLocked || !draftMode) return;
    if (tipo === "firma") {
      manualPctFirmaRef.current = "";
      manualImportoFirmaRef.current = null;
      manualFromEuroFirmaRef.current = false;
      manualUserEditFirmaRef.current = false;
    } else {
      manualPctQuietanzaRef.current = "";
      manualImportoQuietanzaRef.current = null;
      manualFromEuroQuietanzaRef.current = false;
      manualUserEditQuietanzaRef.current = false;
    }
    setProvvAuto(tipo, true);
    bumpProvvDisplay((n) => n + 1);
  };

  const onPercentualeAgenziaFirma = (v: string) => { setProvvigioniManualPct("firma", v); };
  const onPercentualeAgenziaQuietanza = (v: string) => { setProvvigioniManualPct("quietanza", v); };
  const onImportoProvvigioniFirma = (importo: number) => { setProvvigioniManualImporto("firma", importo); };
  const onImportoProvvigioniQuietanza = (importo: number) => { setProvvigioniManualImporto("quietanza", importo); };

  // Specchio perfetto: nessuna riga Quietanza personalizzata.
  const sincronizzata = isQuietanzaSincronizzata(quietanzaRows);
  const personalizzati = quietanzaRows.map((r) => !!r.quietanzaPersonalizzata);

  const saveStatusLabel = (() => {
    if (!draftMode || isLocked) return null;
    if (saveStatus === "saving") return "Salvataggio…";
    if (isDirty) return "Modifiche non salvate";
    return null;
  })();

  const garanzieReadOnly = isLocked || !draftMode;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground flex-1 min-w-[240px]">
          ℹ️ Le voci di garanzia disponibili sono filtrate sul <strong>Gruppo Ramo</strong> della polizza
          ({ramoDescrizione || "—"}).
          {hideFirma ? (
            <> Modifica il <strong>premio quietanza</strong> di questa rata. I dati vengono caricati dal titolo o dalla polizza madre se non ancora salvati per garanzia.</>
          ) : showQuietanza ? (
            <> La <strong>Quietanza</strong> si sincronizza <strong>automaticamente</strong> con
            la <strong>Firma</strong>: ogni voce modificata a mano nella Quietanza diventa
            <strong> personalizzata</strong> e smette di aggiornarsi (puoi riallinearla con “↻ Sincronizza da Firma”).</>
          ) : (
            <> Questa quietanza è già incassata: viene mostrato solo il premio alla <strong>Firma</strong> della rata.</>
          )}
          {!isLocked && draftMode && (
            <> Premi e provvigioni si salvano con <strong>Salva</strong> in alto (valuta e brokeraggio inclusi).</>
          )}
          {!isLocked && !draftMode && (
            <> Premi e garanzie in sola lettura: premi <strong>Modifica</strong> in alto per modificare.</>
          )}
        </p>
        {saveStatusLabel && (
          <span
            className={`text-xs shrink-0 px-2 py-1 rounded-md border ${
              isDirty
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
                : saveStatus === "saving"
                  ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
                  : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            {saveStatusLabel}
          </span>
        )}
      </div>

      {!hideFirma && (
      <PremiGaranziaCardShell
        tipoPremio="firma"
        gruppoRamoId={gruppoRamoId}
        rows={firmaRows}
        onRowsChange={onFirmaChange}
        readOnly={garanzieReadOnly}
        addizionali={String(round2(accessoriFirmaNum))}
        provvigioni={displayProvvFirma}
        provvPctBreakdown={provvBreakdownFirma}
        rowPctAccessori={rowPctAccessoriFn}
        rowPctNetto={rowPctNettoFn}
        rowAgencyPctNetto={rowAgencyPctNettoFn}
        rowAgencyPctAccessori={rowAgencyPctAccessoriFn}
        onProvvPctOverride={(idx, campo, next) => requestProvvPctOverride("firma", idx, campo, next)}
        onProvvPctReset={(idx, campo) => resetProvvPct("firma", idx, campo)}
        percentualeAgenzia={pctFirma}
        onPercentualeAgenziaChange={onPercentualeAgenziaFirma}
        onProvvigioniImportoChange={onImportoProvvigioniFirma}
        percentualeAgenziaAuto={provvFirmaAuto}
        onResetAuto={() => { resetProvvigioniAuto("firma"); }}
        headerExtra={
          showQuietanza ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-7 text-xs"
            disabled={garanzieReadOnly}
            onClick={() => {
              resyncAllFromFirma();
              toast.success("Quietanza riallineata alla Firma");
            }}
            title="Riallinea l'intera Quietanza alla Firma, azzerando le personalizzazioni"
          >
            Copia in Quietanza
          </Button>
          ) : undefined
        }
      />
      )}

      {showQuietanza && (
      <PremiGaranziaCardShell
        tipoPremio="quietanza"
        gruppoRamoId={gruppoRamoId}
        rows={quietanzaRows}
        onRowsChange={onQuietanzaChange}
        readOnly={garanzieReadOnly}
        titoloOverride={hideFirma ? "Premi per Garanzia — Rata" : undefined}
        addizionali={String(round2(accessoriQuietanzaNum))}
        provvigioni={displayProvvQuietanza}
        provvPctBreakdown={provvBreakdownQuietanza}
        rowPctAccessori={rowPctAccessoriFn}
        rowPctNetto={rowPctNettoFn}
        rowAgencyPctNetto={rowAgencyPctNettoFn}
        rowAgencyPctAccessori={rowAgencyPctAccessoriFn}
        onProvvPctOverride={(idx, campo, next) => requestProvvPctOverride("quietanza", idx, campo, next)}
        onProvvPctReset={(idx, campo) => resetProvvPct("quietanza", idx, campo)}
        percentualeAgenzia={pctQui}
        onPercentualeAgenziaChange={onPercentualeAgenziaQuietanza}
        onProvvigioniImportoChange={onImportoProvvigioniQuietanza}
        percentualeAgenziaAuto={provvQuietanzaAuto}
        onResetAuto={() => { resetProvvigioniAuto("quietanza"); }}
        sincronizzata={sincronizzata}
        personalizzati={personalizzati}
        onResetRow={hideFirma ? undefined : resyncRowFromFirma}
        headerExtra={
          hideFirma ? undefined : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={garanzieReadOnly || sincronizzata}
            onClick={resyncAllFromFirma}
            title="Riallinea tutte le voci alla Firma, azzerando le personalizzazioni"
          >
            Sincronizza da Firma
          </Button>
          )
        }
      />
      )}

      <AlertDialog open={!!pctOverride} onOpenChange={(o) => { if (!o) setPctOverride(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sovrascrivere la % provvigione?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Voce <strong>{pctOverride?.voce}</strong> ·{" "}
                  {pctOverride?.campo === "netto" ? "provvigione sul netto" : "provvigione sugli accessori"} ·{" "}
                  {pctOverride?.tipo === "firma" ? "Firma" : "Quietanza"}
                </p>
                <p className="font-mono">
                  {pctOverride?.from.toFixed(2)}% → <strong className="text-orange-600">{pctOverride?.to.toFixed(2)}%</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  La % dell'agenzia è {pctOverride?.agency.toFixed(2)}%. La voce verrà scollegata dalla
                  matrice agenzia e la modifica sarà registrata nel log attività.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPctOverride}>Conferma override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

TitoloImportiPremiBlock.displayName = "TitoloImportiPremiBlock";

export default TitoloImportiPremiBlock;
