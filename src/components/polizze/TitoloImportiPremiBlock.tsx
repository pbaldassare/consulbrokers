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
  aliquota_tasse_pct: number | null;
  ssn: number | null;
  ordine: number | null;
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

  const { data: premi = [] } = useQuery({
    queryKey: ["premi-garanzia-import", titoloId],
    queryFn: async () => {
      const { data } = await supabase
        .from("premi_garanzia_polizza")
        .select("id, titolo_id, tipo_premio, garanzia, codice_garanzia, firma, rata, aliquota_tasse_pct, ssn, ordine")
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
    const ssn = p.ssn != null ? Number(p.ssn) : 0;
    // Heuristica: se l'SSN salvato si discosta dal calcolo automatico → override
    const ssnAuto = ssnAttivo ? round2((netto * aliquotaSsn) / 100) : 0;
    const ssnManualOverride = ssnAttivo && Math.abs(ssn - ssnAuto) > 0.01;
    return {
      codice: p.codice_garanzia || null,
      descrizione: cat?.descrizione || p.garanzia || "",
      netto: netto ? netto.toFixed(2) : "",
      tasse: Number(p.aliquota_tasse_pct ?? 0) || aliquotaTasse > 0
        ? (netto && aliquotaTasse > 0 ? round2((netto * aliquotaTasse) / 100).toFixed(2) : "")
        : "",
      aliquotaTasse,
      sottoramoId: cat?.id || null,
      ssn: ssn ? ssn.toFixed(2) : "",
      aliquotaSsn,
      ssnAttivo,
      ssnManualOverride,
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
      q: qRaw.map((p) => ({ id: p.id, c: p.codice_garanzia, n: p.rata, t: p.aliquota_tasse_pct, s: p.ssn })),
      cat: catalogo.length,
    });
    if (snap === lastSnapRef.current) return;
    lastSnapRef.current = snap;
    setFirmaRows(fRaw.length ? fRaw.map(toGaranziaRow) : [emptyGaranziaRow()]);
    setQuietanzaRows(qRaw.length ? qRaw.map(toGaranziaRow) : [emptyGaranziaRow()]);
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
      annuo: 0,
      ordine: idx,
      aliquota_tasse_pct: r.aliquotaTasse || null,
      ssn: parseFloat(r.ssn || "0") || 0,
      ...(tipo === "quietanza" ? { quietanza_personalizzata: true } : {}),
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
    const sum = (rs: GaranziaRow[], k: "netto" | "tasse" | "ssn") =>
      rs.reduce((s, r) => s + (parseFloat((r as any)[k] || "0") || 0), 0);
    const totNetto = round2(sum(rows, "netto"));
    const totTasse = round2(sum(rows, "tasse"));
    const totSsn = round2(sum(rows, "ssn"));
    const updates: any = {};
    if (tipo === "firma") {
      const lordo = round2(totNetto + totTasse + totSsn + Number(addizionaliFirma || 0));
      updates.premio_netto = totNetto;
      updates.tasse = totTasse;
      updates.ssn_firma = totSsn;
      updates.premio_lordo = lordo;
    } else {
      updates.premio_netto_quietanza = totNetto;
      updates.tasse_quietanza = totTasse;
      updates.ssn_quietanza = totSsn;
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
  };
  const onQuietanzaChange = (next: GaranziaRow[]) => {
    setQuietanzaRows(next);
    if (!isLocked) scheduleSave("quietanza", next);
  };

  const onAddizionaliFirma = async (v: string) => {
    if (isLocked) return;
    const num = parseFloat(v || "0") || 0;
    const sum = (rs: GaranziaRow[], k: "netto" | "tasse" | "ssn") =>
      rs.reduce((s, r) => s + (parseFloat((r as any)[k] || "0") || 0), 0);
    const lordo = round2(sum(firmaRows, "netto") + sum(firmaRows, "tasse") + sum(firmaRows, "ssn") + num);
    await supabase.from("titoli").update({ addizionali: num, premio_lordo: lordo }).eq("id", titoloId);
    qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
  };
  const onAddizionaliQuietanza = async (v: string) => {
    if (isLocked) return;
    const num = parseFloat(v || "0") || 0;
    await supabase.from("titoli").update({ addizionali_quietanza: num }).eq("id", titoloId);
    qc.invalidateQueries({ queryKey: ["titolo", titoloId] });
  };

  const onPercentualeAgenziaFirma = async (v: string) => {
    if (isLocked) return;
    // L'input "Totale Provvigione" della shell calcola la % e la passa qui.
    // Il valore di provvigione effettivo lo deriviamo da % * netto / 100.
    const sumNetto = firmaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
    const pct = parseFloat((v || "0").replace(",", ".")) || 0;
    const importo = round2((sumNetto * pct) / 100);
    await supabase
      .from("titoli")
      .update({ provvigioni_firma: importo })
      .eq("id", titoloId);
    await qc.refetchQueries({ queryKey: ["titolo", titoloId] });
  };
  const onPercentualeAgenziaQuietanza = async (v: string) => {
    if (isLocked) return;
    const sumNetto = quietanzaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
    const pct = parseFloat((v || "0").replace(",", ".")) || 0;
    const importo = round2((sumNetto * pct) / 100);
    await supabase.from("titoli").update({ provvigioni_quietanza: importo }).eq("id", titoloId);
    await qc.refetchQueries({ queryKey: ["titolo", titoloId] });
  };

  // % corrente: deriva da provvigione corrente / netto
  const totNettoFirma = firmaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const totNettoQui = quietanzaRows.reduce((s, r) => s + (parseFloat(r.netto || "0") || 0), 0);
  const pctFirma = totNettoFirma > 0 && provvigioniFirma
    ? ((Number(provvigioniFirma) / totNettoFirma) * 100).toFixed(4)
    : "";
  const pctQui = totNettoQui > 0 && provvigioniQuietanza
    ? ((Number(provvigioniQuietanza) / totNettoQui) * 100).toFixed(4)
    : "";

  const sincronizzata =
    quietanzaRows.length === firmaRows.length &&
    quietanzaRows.every(
      (r, i) =>
        r.netto === firmaRows[i]?.netto &&
        r.tasse === firmaRows[i]?.tasse &&
        (r.codice || "") === (firmaRows[i]?.codice || ""),
    );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        ℹ️ Le voci di garanzia disponibili sono filtrate sul <strong>Gruppo Ramo</strong> della polizza
        ({ramoDescrizione || "—"}). La <strong>Quietanza</strong> è inizialmente uno specchio della
        <strong> Firma</strong>; ogni voce modificata a mano è considerata personalizzata.
      </p>

      <PremiGaranziaCardShell
        tipoPremio="firma"
        gruppoRamoId={gruppoRamoId}
        rows={firmaRows}
        onRowsChange={onFirmaChange}
        addizionali={addizionaliFirma != null ? String(addizionaliFirma) : ""}
        onAddizionaliChange={(v) => onAddizionaliFirma(v)}
        provvigioni={Number(provvigioniFirma || 0)}
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
              const copy = firmaRows.map((r) => ({ ...r }));
              setQuietanzaRows(copy);
              scheduleSave("quietanza", copy);
              toast.success("Firma copiata in Quietanza");
            }}
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
        addizionali={addizionaliQuietanza != null ? String(addizionaliQuietanza) : ""}
        onAddizionaliChange={(v) => onAddizionaliQuietanza(v)}
        provvigioni={Number(provvigioniQuietanza || 0)}
        percentualeAgenzia={pctQui}
        onPercentualeAgenziaChange={onPercentualeAgenziaQuietanza}
        sincronizzata={sincronizzata}
        headerExtra={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isLocked}
            onClick={() => {
              const copy = firmaRows.map((r) => ({ ...r }));
              setQuietanzaRows(copy);
              scheduleSave("quietanza", copy);
            }}
          >
            Sincronizza da Firma
          </Button>
        }
      />
    </div>
  );
}

export default TitoloImportiPremiBlock;
