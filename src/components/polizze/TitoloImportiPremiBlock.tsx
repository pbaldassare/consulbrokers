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
} from "./premiSync";
import {
  calcProvvigioniGaranzia,
  resolveRowPctNetto,
  resolveRowPctAccessori,
  provvPctBreakdown,
  calcTasseRiga,
  type MatriceProvvAccessori,
} from "@/lib/calcProvvigioniGaranzia";

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
}

type DbPremio = {
  id: string;
  titolo_id: string;
  tipo_premio: "firma" | "quietanza";
  garanzia: string | null;
  codice_garanzia: string | null;
  firma: number | null;
  rata: number | null;
  accessori: number | null;
  aliquota_tasse_pct: number | null;
  ssn: number | null;
  ordine: number | null;
  quietanza_personalizzata: boolean | null;
  provvigione_netto_pct: number | null;
  provvigione_accessori_pct: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function TitoloImportiPremiBlock({
  titoloId,
  gruppoRamoId,
  ramoDescrizione,
  isLocked,
  addizionaliFirma,
  addizionaliQuietanza,
  provvigioniFirma,
  provvigioniQuietanza,
}: TitoloImportiPremiBlockProps) {
  const qc = useQueryClient();

  // Catalogo sottorami del gruppo: serve a risolvere codice_garanzia → id/SSN/aliquota
  const { data: catalogo = [] } = useQuery({
    queryKey: ["sottorami-titolo-detail", gruppoRamoId || "none"],
    enabled: !!gruppoRamoId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rami")
        .select("id, codice, descrizione, aliquota_tasse_ramo, ssn_attivo, aliquota_ssn")
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
        .select("compagnia_rapporto_id")
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
      const { data } = await supabase
        .from("premi_garanzia_polizza")
        .select("id, titolo_id, tipo_premio, garanzia, codice_garanzia, firma, rata, accessori, aliquota_tasse_pct, ssn, ordine, quietanza_personalizzata, provvigione_netto_pct, provvigione_accessori_pct")
        .eq("titolo_id", titoloId)
        .order("ordine");
      return (data as DbPremio[]) || [];
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
    const aliquotaTasse = Number(p.aliquota_tasse_pct ?? cat?.aliquota_tasse_ramo ?? 0) || 0;
    const ssnAttivo = !!cat?.ssn_attivo;
    const aliquotaSsn = ssnAttivo ? Number(cat?.aliquota_ssn ?? 10.5) || 10.5 : 0;
    const netto = p.tipo_premio === "firma" ? Number(p.firma ?? 0) : Number(p.rata ?? 0);
    const accessori = Number(p.accessori ?? 0);
    const ssn = p.ssn != null ? Number(p.ssn) : 0;
    const ssnAuto = ssnAttivo ? round2((netto * aliquotaSsn) / 100) : 0;
    const ssnManualOverride = ssnAttivo && Math.abs(ssn - ssnAuto) > 0.01;
    const tasseCalc = aliquotaTasse > 0 && (netto > 0 || accessori > 0)
      ? calcTasseRiga(netto, accessori, aliquotaTasse)
      : 0;
    return {
      codice: p.codice_garanzia || null,
      descrizione: cat?.descrizione || p.garanzia || "",
      netto: netto ? netto.toFixed(2) : "",
      accessori: accessori ? accessori.toFixed(2) : "",
      tasse: tasseCalc ? tasseCalc.toFixed(2) : "",
      aliquotaTasse,
      sottoramoId: cat?.id || null,
      ssn: ssn ? ssn.toFixed(2) : "",
      aliquotaSsn,
      ssnAttivo,
      ssnManualOverride,
      provvAccessoriPct: p.provvigione_accessori_pct != null ? Number(p.provvigione_accessori_pct) : undefined,
      quietanzaPersonalizzata: p.tipo_premio === "quietanza" ? !!p.quietanza_personalizzata : undefined,
    };
  };

  const [firmaRows, setFirmaRows] = useState<GaranziaRow[]>([]);
  const [quietanzaRows, setQuietanzaRows] = useState<GaranziaRow[]>([]);

  // Refresh state quando arrivano i dati DB o cambia il catalogo
  const lastSnapRef = useRef<string>("");
  useEffect(() => {
    if (!premi.length && !catalogo.length) return;
    const fRaw = (premi as DbPremio[]).filter((p) => p.tipo_premio === "firma");
    const qRaw = (premi as DbPremio[]).filter((p) => p.tipo_premio === "quietanza");
    const snap = JSON.stringify({
      f: fRaw.map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.firma, t: p.aliquota_tasse_pct, s: p.ssn })),
      q: qRaw.map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.rata, t: p.aliquota_tasse_pct, s: p.ssn, pz: p.quietanza_personalizzata })),
      cat: catalogo.length,
    });
    if (snap === lastSnapRef.current) return;
    lastSnapRef.current = snap;
    const firmaMapped = fRaw.length ? fRaw.map(toGaranziaRow) : [emptyGaranziaRow()];
    // Se non esistono righe Quietanza salvate, parte come specchio della Firma.
    const quietanzaMapped = qRaw.length
      ? qRaw.map(toGaranziaRow)
      : fRaw.length
        ? mirrorAllFromFirma(firmaMapped)
        : [emptyGaranziaRow()];
    setFirmaRows(firmaMapped);
    setQuietanzaRows(quietanzaMapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premi, catalogo]);

  // Persist debounced
  const firmaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quietanzaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistRows = async (rows: GaranziaRow[], tipo: "firma" | "quietanza") => {
    // Sostituiamo l'intero set di righe per tipo: delete + insert (semplice e affidabile).
    const validRows = rows.filter((r) => !!(r.sottoramoId || r.codice || r.descrizione.trim() || r.netto));
    const payload = validRows.map((r, idx) => ({
      titolo_id: titoloId,
      tipo_premio: tipo,
      garanzia: (r.descrizione && r.descrizione.trim()) || r.codice || "Premio",
      codice_garanzia: r.codice || null,
      capitale: 0,
      tasso: 0,
      firma: tipo === "firma" ? parseFloat(r.netto || "0") || 0 : 0,
      rata: tipo === "quietanza" ? parseFloat(r.netto || "0") || 0 : 0,
      accessori: parseFloat(r.accessori || "0") || 0,
      annuo: 0,
      ordine: idx,
      aliquota_tasse_pct: r.aliquotaTasse || null,
      ssn: parseFloat(r.ssn || "0") || 0,
      provvigione_netto_pct: resolveRowPctNetto(r, provvMatrice).pct,
      provvigione_accessori_pct: resolveRowPctAccessori(r, provvMatrice).pct,
      ...(tipo === "quietanza" ? { quietanza_personalizzata: !!r.quietanzaPersonalizzata } : {}),
    }));

    const { error: delErr } = await supabase
      .from("premi_garanzia_polizza")
      .delete()
      .eq("titolo_id", titoloId)
      .eq("tipo_premio", tipo);
    if (delErr) {
      toast.error("Errore aggiornamento premi: " + delErr.message);
      return;
    }
    if (payload.length > 0) {
      const { error: insErr } = await supabase.from("premi_garanzia_polizza").insert(payload as any);
      if (insErr) {
        toast.error("Errore aggiornamento premi: " + insErr.message);
        return;
      }
    }

    // Aggiorna aggregati su titoli
    const sum = (rs: GaranziaRow[], k: "netto" | "tasse" | "ssn" | "accessori") =>
      rs.reduce((s, r) => s + (parseFloat(r[k] || "0") || 0), 0);
    const totNetto = round2(sum(rows, "netto"));
    const totAccessori = round2(sum(rows, "accessori"));
    const totTasse = round2(sum(rows, "tasse"));
    const totSsn = round2(sum(rows, "ssn"));
    const updates: any = {};
    if (tipo === "firma") {
      const lordo = round2(totNetto + totAccessori + totTasse + totSsn);
      updates.premio_netto = totNetto;
      updates.addizionali = totAccessori;
      updates.tasse = totTasse;
      updates.ssn_firma = totSsn;
      updates.premio_lordo = lordo;
      updates.provvigioni_firma = round2(calcProvvigioniGaranzia(rows, provvMatrice));
    } else {
      updates.premio_netto_quietanza = totNetto;
      updates.addizionali_quietanza = totAccessori;
      updates.tasse_quietanza = totTasse;
      updates.ssn_quietanza = totSsn;
      updates.provvigioni_quietanza = round2(calcProvvigioniGaranzia(rows, provvMatrice));
    }
    await supabase.from("titoli").update(updates).eq("id", titoloId);
    qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
    qc.invalidateQueries({ queryKey: ["premi-garanzia-import", titoloId] });
    qc.invalidateQueries({ queryKey: ["premi-garanzia", titoloId] });
  };

  const scheduleSave = (tipo: "firma" | "quietanza", rows: GaranziaRow[]) => {
    const ref = tipo === "firma" ? firmaTimer : quietanzaTimer;
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => persistRows(rows, tipo), 700);
  };

  const onFirmaChange = (next: GaranziaRow[]) => {
    setFirmaRows(next);
    if (!isLocked) scheduleSave("firma", next);

    // Sincronizzazione automatica Firma → Quietanza: le righe Quietanza non
    // personalizzate rispecchiano la Firma in tempo reale.
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

  const onPercentualeAgenziaFirma = async (_v: string) => {
    if (isLocked) return;
    const importo = round2(calcProvvigioniGaranzia(firmaRows, provvMatrice));
    await supabase.from("titoli").update({ provvigioni_firma: importo }).eq("id", titoloId);
    await qc.refetchQueries({ queryKey: ["titolo", titoloId] });
  };
  const onPercentualeAgenziaQuietanza = async (_v: string) => {
    if (isLocked) return;
    const importo = round2(calcProvvigioniGaranzia(quietanzaRows, provvMatrice));
    await supabase.from("titoli").update({ provvigioni_quietanza: importo }).eq("id", titoloId);
    await qc.refetchQueries({ queryKey: ["titolo", titoloId] });
  };

  // Specchio perfetto: nessuna riga Quietanza personalizzata.
  const sincronizzata = isQuietanzaSincronizzata(quietanzaRows);
  const personalizzati = quietanzaRows.map((r) => !!r.quietanzaPersonalizzata);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        ℹ️ Le voci di garanzia disponibili sono filtrate sul <strong>Gruppo Ramo</strong> della polizza
        ({ramoDescrizione || "—"}). La <strong>Quietanza</strong> si sincronizza <strong>automaticamente</strong> con
        la <strong>Firma</strong>: ogni voce modificata a mano nella Quietanza diventa
        <strong> personalizzata</strong> e smette di aggiornarsi (puoi riallinearla con “↻ Sincronizza da Firma”).
      </p>

      <PremiGaranziaCardShell
        tipoPremio="firma"
        gruppoRamoId={gruppoRamoId}
        rows={firmaRows}
        onRowsChange={onFirmaChange}
        addizionali={String(round2(accessoriFirmaNum))}
        provvigioni={Number(provvigioniFirma || 0)}
        provvPctBreakdown={provvBreakdownFirma}
        rowPctAccessori={rowPctAccessoriFn}
        percentualeAgenzia={pctFirma}
        onPercentualeAgenziaChange={onPercentualeAgenziaFirma}
        headerExtra={
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
        }
      />

      <PremiGaranziaCardShell
        tipoPremio="quietanza"
        gruppoRamoId={gruppoRamoId}
        rows={quietanzaRows}
        onRowsChange={onQuietanzaChange}
        addizionali={String(round2(accessoriQuietanzaNum))}
        provvigioni={Number(provvigioniQuietanza || 0)}
        provvPctBreakdown={provvBreakdownQuietanza}
        rowPctAccessori={rowPctAccessoriFn}
        percentualeAgenzia={pctQui}
        onPercentualeAgenziaChange={onPercentualeAgenziaQuietanza}
        sincronizzata={sincronizzata}
        personalizzati={personalizzati}
        onResetRow={resyncRowFromFirma}
        headerExtra={
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
        }
      />
    </div>
  );
}

export default TitoloImportiPremiBlock;
