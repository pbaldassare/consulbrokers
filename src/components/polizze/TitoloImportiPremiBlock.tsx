import { useEffect, useMemo, useRef, useState } from "react";
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
  calcProvvigioniGaranzia,
  resolveRowPctNetto,
  resolveRowPctAccessori,
  provvPctBreakdown,
  calcTasseRiga,
  calcTasseEffettiveRiga,
  type MatriceProvvAccessori,
  premioRigaDbImporto,
} from "@/lib/calcProvvigioniGaranzia";
import {
  buildGaranziaRowFromTitoliAggregati,
  fetchPremiGaranziaByTitolo,
  remapDbPremiTipo,
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
}

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

const round2 = (n: number) => Math.round(n * 100) / 100;

function provvigioniFromPct(base: number, pctStr: string): number {
  const s = (pctStr ?? "").trim().replace(",", ".");
  if (s === "") return 0;
  const pct = parseFloat(s);
  if (isNaN(pct) || base <= 0) return 0;
  return round2((base * pct) / 100);
}

function rowsBase(rows: GaranziaRow[]): number {
  const netto = rows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const accessori = rows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  return netto + accessori;
}

export function TitoloImportiPremiBlock({
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
}: TitoloImportiPremiBlockProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const tasseRettificaSupportedRef = useRef<boolean | null>(null);

  // Catalogo sottorami del gruppo: serve a risolvere codice_garanzia → id/SSN/aliquota
  const { data: catalogo = [] } = useQuery({
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

  const { data: titoloMeta } = useQuery({
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

  const { data: premi = [] } = useQuery({
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
  const { data: fallbackPremi = [] } = useQuery({
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
        provvAccessoriPct: p.provvigione_accessori_pct != null ? Number(p.provvigione_accessori_pct) : undefined,
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
      provvAccessoriPct: p.provvigione_accessori_pct != null ? Number(p.provvigione_accessori_pct) : undefined,
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
    if (savingRef.current) return;
    if (hasDraftRows(firmaRowsRef.current) || hasDraftRows(quietanzaRowsRef.current)) return;

    const catalogReady = catalogo.length > 0 || !gruppoRamoId;
    if (!catalogReady && premi.length === 0 && !fallbackPremi.length) return;

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

    // Fallback da aggregati titoli corrente
    if (titoloMeta && catalogo.length) {
      if (!fRaw.length && !hideFirma) {
        const synth = buildGaranziaRowFromTitoliAggregati("firma", titoloMeta, catalogo as any[]);
        if (synth) firmaMapped = [synth];
      }
      if (!qRaw.length) {
        const synthQ = buildGaranziaRowFromTitoliAggregati("quietanza", titoloMeta, catalogo as any[]);
        if (synthQ) quietanzaMapped = [synthQ];
      }
    }

    setFirmaRows(firmaMapped);
    setQuietanzaRows(quietanzaMapped);

    // Se il valore salvato su titoli diverge dal calcolo matrice → override manuale
    if (provvMatrice) {
      const baseF = rowsBase(firmaMapped);
      const baseQ = rowsBase(quietanzaMapped);
      const calcF = round2(calcProvvigioniGaranzia(firmaMapped, provvMatrice));
      const calcQ = round2(calcProvvigioniGaranzia(quietanzaMapped, provvMatrice));
      const storedF = round2(Number(provvigioniFirma) || 0);
      const storedQ = round2(Number(provvigioniQuietanza) || 0);
      if (storedF > 0 && Math.abs(calcF - storedF) > 0.015) {
        manualPctFirmaRef.current = baseF > 0 ? ((storedF / baseF) * 100).toFixed(4) : "";
        setProvvAuto("firma", false);
      } else {
        setProvvAuto("firma", true);
      }
      if (storedQ > 0 && Math.abs(calcQ - storedQ) > 0.015) {
        manualPctQuietanzaRef.current = baseQ > 0 ? ((storedQ / baseQ) * 100).toFixed(4) : "";
        setProvvAuto("quietanza", false);
      } else {
        setProvvAuto("quietanza", true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premi, catalogo, provvMatrice, provvigioniFirma, provvigioniQuietanza, fallbackPremi, fallbackPremiTitoloId, hideFirma, titoloMeta, gruppoRamoId]);

  const resolveProvvigioniImporto = (
    tipo: "firma" | "quietanza",
    rows: GaranziaRow[],
  ): number => {
    const auto = tipo === "firma" ? provvFirmaAutoRef.current : provvQuietanzaAutoRef.current;
    if (auto) return round2(calcProvvigioniGaranzia(rows, provvMatrice));
    const base = rowsBase(rows);
    const pct = tipo === "firma" ? manualPctFirmaRef.current : manualPctQuietanzaRef.current;
    return provvigioniFromPct(base, pct);
  };

  // Persist debounced
  const firmaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quietanzaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistRows = async (rows: GaranziaRow[], tipo: "firma" | "quietanza", manual = false) => {
    const validRows = rows.filter(rowHasContent);
    if (validRows.length < rows.length) return;

    savingRef.current = true;
    setSaving(true);
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
        return;
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
      toast.success(manual ? "Premi salvati" : "Premi aggiornati");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const flushSave = async (tipo: "firma" | "quietanza") => {
    const ref = tipo === "firma" ? firmaTimer : quietanzaTimer;
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
    const rows = tipo === "firma" ? firmaRows : quietanzaRows;
    return persistRows(rows, tipo, true);
  };

  const saveAllPremi = async () => {
    if (isLocked) return;
    if (!hideFirma) await flushSave("firma");
    if (showQuietanza) await flushSave("quietanza");
  };

  const scheduleSave = (tipo: "firma" | "quietanza", rows: GaranziaRow[]) => {
    if (hasDraftRows(rows)) return;
    const ref = tipo === "firma" ? firmaTimer : quietanzaTimer;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => persistRows(rows, tipo), 700);
  };

  const onFirmaChange = (next: GaranziaRow[]) => {
    setFirmaRows(next);
    if (!isLocked) scheduleSave("firma", next);

    if (hideFirma || !showQuietanza) return;

    const syncedQuietanza = syncQuietanzaFromFirma(next, quietanzaRows);
    setQuietanzaRows(syncedQuietanza);
    if (!isLocked && JSON.stringify(syncedQuietanza) !== JSON.stringify(quietanzaRows)) {
      scheduleSave("quietanza", syncedQuietanza);
    }
  };

  const onQuietanzaChange = (next: GaranziaRow[]) => {
    // Ogni voce Quietanza modificata a mano diventa "personalizzata" e si
    // scollega dalla sincronizzazione automatica con la Firma.
    const marked = markQuietanzaEdits(quietanzaRows, next);
    setQuietanzaRows(marked);
    if (!isLocked) scheduleSave("quietanza", marked);
  };

  // Riallinea l'intera Quietanza alla Firma azzerando ogni personalizzazione.
  const resyncAllFromFirma = () => {
    if (isLocked) return;
    const mirrored = mirrorAllFromFirma(firmaRows);
    setQuietanzaRows(mirrored);
    scheduleSave("quietanza", mirrored);
  };

  // Riallinea una singola voce Quietanza alla Firma corrispondente.
  const resyncRowFromFirma = (idx: number) => {
    if (isLocked) return;
    const updated = resetQuietanzaRow(firmaRows, quietanzaRows, idx);
    setQuietanzaRows(updated);
    scheduleSave("quietanza", updated);
  };

  const accessoriFirmaNum = firmaRows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  const accessoriQuietanzaNum = quietanzaRows.reduce((s, r) => s + (parseFloat(r.accessori || "0") || 0), 0);
  const rowPctAccessoriFn = (row: GaranziaRow) => resolveRowPctAccessori(row, provvMatrice).pct;
  const provvBreakdownFirma = provvPctBreakdown(firmaRows, provvMatrice);
  const provvBreakdownQuietanza = provvPctBreakdown(quietanzaRows, provvMatrice);

  const totNettoFirma = firmaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totNettoQui = quietanzaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totBaseFirma = totNettoFirma + accessoriFirmaNum;
  const totBaseQui = totNettoQui + accessoriQuietanzaNum;
  const pctFirma = totBaseFirma > 0 && provvigioniFirma
    ? ((Number(provvigioniFirma) / totBaseFirma) * 100).toFixed(4)
    : "";
  const pctQui = totBaseQui > 0 && provvigioniQuietanza
    ? ((Number(provvigioniQuietanza) / totBaseQui) * 100).toFixed(4)
    : "";

  const saveProvvigioniManual = async (tipo: "firma" | "quietanza", v: string) => {
    if (isLocked) return;
    const rows = tipo === "firma" ? firmaRows : quietanzaRows;
    const base = rowsBase(rows);
    const importo = provvigioniFromPct(base, v);
    const col = tipo === "firma" ? "provvigioni_firma" : "provvigioni_quietanza";
    const { error } = await supabase.from("titoli").update({ [col]: importo }).eq("id", titoloId);
    if (error) {
      toast.error("Errore salvataggio provvigioni: " + error.message);
      return;
    }
    if (tipo === "firma") manualPctFirmaRef.current = v;
    else manualPctQuietanzaRef.current = v;
    setProvvAuto(tipo, false);
    await qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
    await qc.invalidateQueries({ queryKey: ["polizze_cliente"] });
    toast.success("Provvigioni aggiornate");
  };

  const resetProvvigioniAuto = async (tipo: "firma" | "quietanza") => {
    if (isLocked) return;
    const rows = tipo === "firma" ? firmaRows : quietanzaRows;
    const importo = round2(calcProvvigioniGaranzia(rows, provvMatrice));
    const col = tipo === "firma" ? "provvigioni_firma" : "provvigioni_quietanza";
    const { error } = await supabase.from("titoli").update({ [col]: importo }).eq("id", titoloId);
    if (error) {
      toast.error("Errore ricalcolo provvigioni: " + error.message);
      return;
    }
    if (tipo === "firma") manualPctFirmaRef.current = "";
    else manualPctQuietanzaRef.current = "";
    setProvvAuto(tipo, true);
    await qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
    await qc.invalidateQueries({ queryKey: ["polizze_cliente"] });
    toast.success("Provvigioni ricalcolate dalla matrice");
  };

  const onPercentualeAgenziaFirma = (v: string) => { void saveProvvigioniManual("firma", v); };
  const onPercentualeAgenziaQuietanza = (v: string) => { void saveProvvigioniManual("quietanza", v); };

  // Specchio perfetto: nessuna riga Quietanza personalizzata.
  const sincronizzata = isQuietanzaSincronizzata(quietanzaRows);
  const personalizzati = quietanzaRows.map((r) => !!r.quietanzaPersonalizzata);

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
          {!isLocked && (
            <> Le modifiche si salvano automaticamente; puoi anche usare <strong>Salva premi</strong>.</>
          )}
        </p>
        {!isLocked && (
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0"
            disabled={saving}
            onClick={saveAllPremi}
          >
            {saving ? "Salvataggio…" : "Salva premi"}
          </Button>
        )}
      </div>

      {!hideFirma && (
      <PremiGaranziaCardShell
        tipoPremio="firma"
        gruppoRamoId={gruppoRamoId}
        rows={firmaRows}
        onRowsChange={onFirmaChange}
        readOnly={isLocked}
        addizionali={String(round2(accessoriFirmaNum))}
        provvigioni={Number(provvigioniFirma || 0)}
        provvPctBreakdown={provvBreakdownFirma}
        rowPctAccessori={rowPctAccessoriFn}
        percentualeAgenzia={pctFirma}
        onPercentualeAgenziaChange={onPercentualeAgenziaFirma}
        percentualeAgenziaAuto={provvFirmaAuto}
        onResetAuto={() => { void resetProvvigioniAuto("firma"); }}
        headerExtra={
          showQuietanza ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-7 text-xs"
            disabled={isLocked}
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
        readOnly={isLocked}
        titoloOverride={hideFirma ? "Premi per Garanzia — Rata" : undefined}
        addizionali={String(round2(accessoriQuietanzaNum))}
        provvigioni={Number(provvigioniQuietanza || 0)}
        provvPctBreakdown={provvBreakdownQuietanza}
        rowPctAccessori={rowPctAccessoriFn}
        percentualeAgenzia={pctQui}
        onPercentualeAgenziaChange={onPercentualeAgenziaQuietanza}
        percentualeAgenziaAuto={provvQuietanzaAuto}
        onResetAuto={() => { void resetProvvigioniAuto("quietanza"); }}
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
            disabled={isLocked || sincronizzata}
            onClick={resyncAllFromFirma}
            title="Riallinea tutte le voci alla Firma, azzerando le personalizzazioni"
          >
            Sincronizza da Firma
          </Button>
          )
        }
      />
      )}
    </div>
  );
}

export default TitoloImportiPremiBlock;
