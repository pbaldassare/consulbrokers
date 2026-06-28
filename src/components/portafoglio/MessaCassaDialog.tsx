import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckSquare, Wallet, Trash2, Calculator, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";
import { fmtEuro } from "@/lib/formatCurrency";
import { resolveTitoloMadreId } from "@/lib/sospensioneQuietanze";
import {
  buildTrattenutaCtx,
  calcIncassoConTrattenutaProvvigioni,
  type TrattenutaTitoloCtx,
} from "@/lib/trattenutaProvvigioniIncasso";

/**
 * Input importo per riga di compensazione contabile.
 *
 * Mantiene un buffer locale stringa per consentire la digitazione naturale
 * (incluso il separatore decimale italiano `,`), senza che il valore venga
 * riarrotondato a ogni keystroke (cosa che faceva "scattare" il cursore e
 * costringeva ad inserire un numero alla volta).
 *
 * Il parse e la persistenza nello stato globale avvengono solo on blur / Enter.
 */
const ImportoCompensazioneInput = ({
  value,
  autoFocus,
  onCommit,
}: {
  value: number;
  autoFocus?: boolean;
  onCommit: (n: number) => void;
}) => {
  const fmt = (n: number) =>
    !n || Number.isNaN(n) ? "" : n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const [text, setText] = useState<string>(() => fmt(value));
  const dirty = useRef(false);

  // Riallinea il buffer quando il valore esterno cambia senza che l'utente stia digitando
  useEffect(() => {
    if (!dirty.current) setText(fmt(value));
  }, [value]);

  const commit = () => {
    dirty.current = false;
    const norm = text.trim().replace(/\./g, "").replace(",", ".");
    const n = Number(norm);
    const safe = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
    onCommit(safe);
    setText(fmt(safe));
  };

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => {
          dirty.current = true;
          // accetta solo cifre, separatori . , e spazi (per migliaia)
          const cleaned = e.target.value.replace(/[^\d.,\s]/g, "");
          setText(cleaned);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-32 h-8 text-xs text-right pr-5"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">€</span>
    </div>
  );
};


interface TitoloMin {
  id: string;
  numero_titolo?: string | null;
  premio_lordo?: number | null;
  cliente_anagrafica_id?: string | null;
  ufficio_id?: string | null;
  importo_incassato?: number | null;
}

export interface BankIncassoContext {
  movimentoId: string;
  contoBancarioId: string | null;
  dataMovimento: string;
  importoByTitoloId: Record<string, number>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoli: TitoloMin[];
  onSuccess?: (dataMessaCassa: string) => void;
  bankIncasso?: BankIncassoContext;
}

interface CompensazioneRow {
  tempId: string;
  causale_id: string;
  causale_codice: string;
  causale_descrizione: string;
  segno: "+" | "-";
  importo: number;
  note: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;
const TOLLERANZA_QUADRATURA = 0.01;
const isBonificoTipo = (tipo: string) => tipo === "bonifico";

interface MovimentoPreview {
  tipo: "entrata" | "uscita";
  categoria: string;
  descrizione: string;
  importo: number;
  titolo?: string;
}

export const MessaCassaDialog = ({ open, onOpenChange, titoli, onSuccess, bankIncasso }: Props) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    dataMessaCassa: todayISO(),
    dataPagamento: todayISO(),
    tipoPagamento: "contanti",
    banca: "",
    cashImporto: 0,
  });
  const [anticipiSel, setAnticipiSel] = useState<Record<string, number>>({});
  // Compensazioni indicizzate per titolo
  const [compensazioniByTitolo, setCompensazioniByTitolo] = useState<Record<string, CompensazioneRow[]>>({});
  // Ultima riga compensazione aggiunta (per auto-focus sull'importo)
  const [lastAddedCompId, setLastAddedCompId] = useState<string | null>(null);

  const isMulti = titoli.length > 1;
  const totaleLordo = titoli.reduce((s, t) => s + (Number(t.premio_lordo) || 0), 0);

  const clienteUnico = useMemo(() => {
    const ids = Array.from(new Set(titoli.map((t) => t.cliente_anagrafica_id).filter(Boolean)));
    return ids.length === 1 ? (ids[0] as string) : null;
  }, [titoli]);

  const { data: anticipi = [] } = useQuery({
    queryKey: ["cliente-anticipi-disponibili", clienteUnico],
    enabled: !!clienteUnico && open,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .select("id, data_anticipo, importo, importo_residuo, conto:conti_bancari(etichetta)")
        .eq("cliente_id", clienteUnico)
        .gt("importo_residuo", 0)
        .order("data_anticipo", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Causali compensazione (anche in bulk: ora gestite per-titolo)
  const { data: causaliComp = [] } = useQuery({
    queryKey: ["causali-compensazione-messa-cassa"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase.from("causali_contabili") as any)
        .select("id, codice, descrizione, segno_default")
        .eq("tipo_tabella", "compensazione_messa_cassa")
        .eq("attivo", true)
        .order("codice");
      if (error) throw error;
      return data as Array<{ id: string; codice: string; descrizione: string; segno_default: "+" | "-" }>;
    },
  });

  const titoloIds = useMemo(() => titoli.map((t) => t.id), [titoli]);

  const { data: titoliTrattenutaDet = [] } = useQuery({
    queryKey: ["messa-cassa-titoli-trattenuta", titoloIds],
    enabled: open && titoloIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli") as any)
        .select("id, anagrafica_commerciale_id, provvigioni_quietanza, percentuale_commerciale")
        .in("id", titoloIds);
      if (error) throw error;
      return data as Array<{
        id: string;
        anagrafica_commerciale_id: string | null;
        provvigioni_quietanza: number | null;
        percentuale_commerciale: number | null;
      }>;
    },
  });

  const prodIdsTrattenuta = useMemo(
    () => Array.from(new Set(titoliTrattenutaDet.map((t) => t.anagrafica_commerciale_id).filter(Boolean))) as string[],
    [titoliTrattenutaDet],
  );

  const { data: produttoriTrattenuta = [] } = useQuery({
    queryKey: ["messa-cassa-prod-trattenuta", prodIdsTrattenuta],
    enabled: open && prodIdsTrattenuta.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("anagrafiche_professionali") as any)
        .select("id, trattenuta_provvigioni_incasso, percentuale_ra, ragione_sociale, cognome, nome")
        .in("id", prodIdsTrattenuta);
      if (error) throw error;
      return data as Array<{
        id: string;
        trattenuta_provvigioni_incasso: boolean | null;
        percentuale_ra: number | null;
        ragione_sociale: string | null;
        cognome: string | null;
        nome: string | null;
      }>;
    },
  });

  const trattenutaByTitolo = useMemo(() => {
    const prodById = new Map(produttoriTrattenuta.map((p) => [p.id, p]));
    const detById = new Map(titoliTrattenutaDet.map((t) => [t.id, t]));
    const m = new Map<string, TrattenutaTitoloCtx>();
    for (const t of titoli) {
      const det = detById.get(t.id);
      if (!det) continue;
      const ctx = buildTrattenutaCtx(det, prodById);
      if (ctx) m.set(t.id, ctx);
    }
    return m;
  }, [titoli, titoliTrattenutaDet, produttoriTrattenuta]);

  const haTrattenuta = trattenutaByTitolo.size > 0;

  const handleTipoPagamentoChange = (tipo: string) => {
    setForm((f) => ({
      ...f,
      tipoPagamento: tipo,
      banca: "",
    }));
  };

  useEffect(() => {
    if (open) {
      const t = bankIncasso?.dataMovimento || todayISO();
      const bankCash = bankIncasso
        ? round2(Object.values(bankIncasso.importoByTitoloId).reduce((s, v) => s + (Number(v) || 0), 0))
        : round2(totaleLordo);
      setForm({
        dataMessaCassa: t,
        dataPagamento: t,
        tipoPagamento: bankIncasso ? "bonifico" : "contanti",
        banca: bankIncasso?.contoBancarioId ?? "",
        cashImporto: bankCash,
      });
      setAnticipiSel({});
      setCompensazioniByTitolo({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoli.length, bankIncasso?.movimentoId]);

  // === Helpers compensazioni per titolo ===
  const getComp = (titoloId: string) => compensazioniByTitolo[titoloId] || [];

  const addCompFor = (titoloId: string, causaleId: string, suggestImporto?: number) => {
    const c = causaliComp.find((x) => x.id === causaleId);
    if (!c) return;
    const tempId = crypto.randomUUID();
    setCompensazioniByTitolo((prev) => {
      const cur = prev[titoloId] || [];
      const row: CompensazioneRow = {
        tempId,
        causale_id: c.id,
        causale_codice: c.codice,
        causale_descrizione: c.descrizione,
        segno: c.segno_default,
        importo: round2(suggestImporto && suggestImporto > 0 ? suggestImporto : 0),
        note: "",
      };
      return { ...prev, [titoloId]: [...cur, row] };
    });
    setLastAddedCompId(tempId);
  };

  const updateCompFor = (titoloId: string, tempId: string, patch: Partial<CompensazioneRow>) => {
    setCompensazioniByTitolo((prev) => ({
      ...prev,
      [titoloId]: (prev[titoloId] || []).map((c) => (c.tempId === tempId ? { ...c, ...patch } : c)),
    }));
  };

  const removeCompFor = (titoloId: string, tempId: string) => {
    setCompensazioniByTitolo((prev) => ({
      ...prev,
      [titoloId]: (prev[titoloId] || []).filter((c) => c.tempId !== tempId),
    }));
  };

  // === Calcoli quadratura ===
  const allCompensazioni = useMemo(
    () => Object.values(compensazioniByTitolo).flat(),
    [compensazioniByTitolo]
  );
  const totaleAnticipiUsati = round2(Object.values(anticipiSel).reduce((s, v) => s + (Number(v) || 0), 0));
  const totaleCompPlus = round2(allCompensazioni.filter((c) => c.segno === "+").reduce((s, c) => s + c.importo, 0));
  const totaleCompMinus = round2(allCompensazioni.filter((c) => c.segno === "-").reduce((s, c) => s + c.importo, 0));
  const dovutoFinale = round2(totaleLordo + totaleCompMinus - totaleCompPlus);

  const totaleDovutoConsul = useMemo(() => {
    return round2(
      titoli.reduce((sum, t) => {
        const lordo = Number(t.premio_lordo) || 0;
        const compForThis = compensazioniByTitolo[t.id] || [];
        const compPlusT = compForThis.filter((c) => c.segno === "+").reduce((s, c) => s + c.importo, 0);
        const compMinusT = compForThis.filter((c) => c.segno === "-").reduce((s, c) => s + c.importo, 0);
        const dovutoT = round2(lordo + compMinusT - compPlusT);
        const tr = trattenutaByTitolo.get(t.id);
        if (tr) {
          return sum + calcIncassoConTrattenutaProvvigioni(dovutoT, tr.provvigioneLorda, tr.percentualeRa).importoVersatoConsul;
        }
        return sum + dovutoT;
      }, 0),
    );
  }, [titoli, compensazioniByTitolo, trattenutaByTitolo]);

  const cashEffettivo = isMulti
    ? round2(Math.max(0, totaleDovutoConsul - totaleAnticipiUsati))
    : round2(Number(form.cashImporto) || 0);
  const coperto = round2(cashEffettivo + totaleAnticipiUsati);
  const delta = round2(totaleDovutoConsul - coperto);
  const quadrato = bankIncasso ? true : Math.abs(delta) < TOLLERANZA_QUADRATURA;

  useEffect(() => {
    if (!open || isMulti || !haTrattenuta) return;
    setForm((f) => ({ ...f, cashImporto: round2(Math.max(0, totaleDovutoConsul - totaleAnticipiUsati)) }));
  }, [open, isMulti, haTrattenuta, totaleDovutoConsul, totaleAnticipiUsati]);

  // === Anteprima scritture contabili ===
  const movimentiPreview: MovimentoPreview[] = useMemo(() => {
    const rows: MovimentoPreview[] = [];
    titoli.forEach((t) => {
      const tag = isMulti ? (t.numero_titolo || t.id.slice(0, 8)) : undefined;
      getComp(t.id).forEach((c) => {
        rows.push({
          tipo: c.segno === "+" ? "uscita" : "entrata",
          categoria: "compensazione_titolo",
          descrizione: `${c.causale_codice} — ${c.causale_descrizione}${c.note ? " · " + c.note : ""}`,
          importo: c.importo,
          titolo: tag,
        });
      });
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compensazioniByTitolo, titoli, isMulti]);

  const stampaRiepilogo = () => {
    const t = titoli[0];
    const comp = getComp(t?.id || "");
    const rows: string[] = [];
    rows.push(`<tr><td>Premio lordo</td><td style="text-align:right">${fmtEuro(totaleLordo)}</td></tr>`);
    comp.forEach((c) => {
      rows.push(`<tr><td>${c.segno} ${c.causale_codice} — ${c.causale_descrizione}${c.note ? " (" + c.note + ")" : ""}</td><td style="text-align:right">${c.segno === "+" ? "− " : "+ "}${fmtEuro(c.importo)}</td></tr>`);
    });
    rows.push(`<tr style="border-top:1px solid #999"><td><strong>Dovuto finale</strong></td><td style="text-align:right"><strong>${fmtEuro(dovutoFinale)}</strong></td></tr>`);
    if (totaleAnticipiUsati > 0) rows.push(`<tr><td>Acconti utilizzati</td><td style="text-align:right">− ${fmtEuro(totaleAnticipiUsati)}</td></tr>`);
    rows.push(`<tr><td>Cash/bonifico (${form.tipoPagamento})</td><td style="text-align:right">− ${fmtEuro(cashEffettivo)}</td></tr>`);
    rows.push(`<tr style="border-top:2px solid #000"><td><strong>Delta finale</strong></td><td style="text-align:right"><strong>${fmtEuro(delta)}</strong></td></tr>`);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Riepilogo Messa a Cassa</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:0 0 16px;color:#666;font-weight:normal}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:6px 4px}</style>
</head><body>
<h1>Riepilogo Messa a Cassa</h1>
<h2>Polizza ${t?.numero_titolo || t?.id?.slice(0, 8) || ""} — ${form.dataMessaCassa}</h2>
<table>${rows.join("")}</table>
<p style="margin-top:24px;font-size:11px;color:#888">Stampato il ${new Date().toLocaleString("it-IT")}</p>
<script>window.onload=()=>window.print()</script>
</body></html>`;
    const w = window.open("", "_blank", "width=700,height=800");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const toggleAnticipo = (aId: string, residuo: number) => {
    setAnticipiSel((prev) => {
      if (prev[aId] !== undefined) {
        const { [aId]: _, ...rest } = prev;
        return rest;
      }
      const giaUsato = Object.values(prev).reduce((s, v) => s + v, 0);
      const daCoprire = Math.max(0, totaleDovutoConsul - giaUsato - (isMulti ? 0 : cashEffettivo));
      return { ...prev, [aId]: Math.min(residuo, daCoprire) };
    });
  };

  const setImportoAnticipo = (aId: string, val: string, residuo: number) => {
    const n = Math.max(0, Math.min(residuo, Number(val.replace(",", ".")) || 0));
    setAnticipiSel((prev) => ({ ...prev, [aId]: n }));
    if (!isMulti) {
      setForm((f) => {
        const altriAnticipi = Object.entries(anticipiSel)
          .filter(([k]) => k !== aId)
          .reduce((s, [, v]) => s + v, 0);
        const newCash = round2(Math.max(0, totaleDovutoConsul - altriAnticipi - n));
        return { ...f, cashImporto: newCash };
      });
    }
  };

  const autoQuadra = () => {
    if (isMulti) return;
    setForm((f) => ({ ...f, cashImporto: round2(Math.max(0, totaleDovutoConsul - totaleAnticipiUsati)) }));
  };

  const handleConferma = async () => {
    if (titoli.length === 0) return;
    if (!quadrato) {
      toast.error(`Non quadra: delta ${fmtEuro(delta)}`);
      return;
    }
    if (cashEffettivo > 0 && isBonificoTipo(form.tipoPagamento) && !form.banca && !bankIncasso?.contoBancarioId) {
      toast.error("Seleziona la banca per il bonifico");
      return;
    }

    for (const t of titoli) {
      const { data: row } = await supabase
        .from("titoli")
        .select("id, stato, sostituisce_polizza, numero_titolo, importo_incassato, data_messa_cassa")
        .eq("id", t.id)
        .maybeSingle();
      if (row?.stato === "sospeso") {
        toast.error(`Impossibile incassare: titolo ${t.numero_titolo ?? t.id} è sospeso`);
        return;
      }
      if (row?.sostituisce_polizza && row.numero_titolo) {
        const madreId = await resolveTitoloMadreId(supabase, t.id);
        const { data: madre } = await supabase
          .from("titoli")
          .select("stato, numero_titolo")
          .eq("id", madreId)
          .maybeSingle();
        if (madre?.stato === "sospeso") {
          toast.error(`Impossibile incassare: polizza madre ${madre.numero_titolo ?? madreId} è sospesa`);
          return;
        }
      }
    }

    setLoading(true);

    const anticipiOrdered = Object.entries(anticipiSel).filter(([, v]) => v > 0).map(([id, v]) => ({ id, residuo: v }));
    const { data: userResp } = await supabase.auth.getUser();
    const userId = userResp.user?.id ?? null;

    let ok = 0, ko = 0;

    for (const t of titoli) {
      if (t.stato === "sospeso") {
        toast.error(`Impossibile incassare: titolo in sospensione (${(t as any).numero_titolo || t.id})`);
        ko++;
        continue;
      }
      if ((t as any).sostituisce_polizza && (t as any).numero_titolo) {
        const { data: madre } = await supabase
          .from("titoli")
          .select("stato")
          .eq("numero_titolo", (t as any).numero_titolo)
          .is("sostituisce_polizza", null)
          .order("riga", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (madre?.stato === "sospeso") {
          toast.error(`Impossibile incassare: polizza ${(t as any).numero_titolo} sospesa`);
          ko++;
          continue;
        }
      }

      const lordo = Number(t.premio_lordo) || 0;

      const compForThis = getComp(t.id);
      const compPlusT = compForThis.filter((c) => c.segno === "+").reduce((s, c) => s + c.importo, 0);
      const compMinusT = compForThis.filter((c) => c.segno === "-").reduce((s, c) => s + c.importo, 0);
      const dovutoT = round2(lordo + compMinusT - compPlusT);

      let daCoprireT = dovutoT;
      const utilizziPerTitolo: Array<{ anticipo_id: string; importo_utilizzato: number }> = [];
      for (const a of anticipiOrdered) {
        if (daCoprireT <= 0 || a.residuo <= 0) continue;
        const usato = Math.min(daCoprireT, a.residuo);
        if (usato > 0) {
          utilizziPerTitolo.push({ anticipo_id: a.id, importo_utilizzato: round2(usato) });
          a.residuo -= usato;
          daCoprireT -= usato;
        }
      }

      const usatoTitolo = round2(utilizziPerTitolo.reduce((s, u) => s + u.importo_utilizzato, 0));
      const bankImporto = bankIncasso?.importoByTitoloId[t.id];
      let residuoCash: number;
      if (bankImporto != null) {
        const maxCash = round2(Math.max(0, dovutoT - usatoTitolo));
        residuoCash = round2(Math.min(Number(bankImporto) || 0, maxCash));
        const trBank = trattenutaByTitolo.get(t.id);
        if (trBank) {
          residuoCash = calcIncassoConTrattenutaProvvigioni(
            residuoCash,
            trBank.provvigioneLorda,
            trBank.percentualeRa,
          ).importoVersatoConsul;
        }
      } else {
        residuoCash = round2(dovutoT - usatoTitolo);
        const tr = trattenutaByTitolo.get(t.id);
        if (tr) {
          residuoCash = calcIncassoConTrattenutaProvvigioni(
            round2(dovutoT - usatoTitolo),
            tr.provvigioneLorda,
            tr.percentualeRa,
          ).importoVersatoConsul;
        }
      }
      const tr = trattenutaByTitolo.get(t.id);
      const haCompensazioni = compForThis.length > 0;
      const tipoPag = dovutoT === 0 && !haCompensazioni && usatoTitolo === 0
        ? "incasso_zero"
        : haCompensazioni
        ? (usatoTitolo > 0 ? "misto_compensato" : "compensato")
        : usatoTitolo > 0
          ? (residuoCash > 0 ? "anticipo_misto" : "anticipo")
          : form.tipoPagamento;

      let bancaLabel: string | null = null;
      const bancaId = form.banca || bankIncasso?.contoBancarioId || "";
      if (residuoCash > 0 && isBonificoTipo(form.tipoPagamento) && bancaId) {
        const { data: conto } = await (supabase.from("conti_bancari") as any)
          .select("etichetta, banca, iban").eq("id", bancaId).maybeSingle();
        bancaLabel = conto?.etichetta || conto?.banca || bancaId;
      }

      const prevIncassato = Number(t.importo_incassato) || 0;
      const nuovoIncassato = round2(prevIncassato + residuoCash);
      const isFullIncasso = nuovoIncassato + TOLLERANZA_QUADRATURA >= dovutoT;

      const payload: any = {
        importo_incassato: nuovoIncassato,
        tipo_pagamento: tipoPag,
        updated_at: new Date().toISOString(),
      };
      if (isFullIncasso) {
        payload.stato = "incassato";
        payload.data_messa_cassa = form.dataMessaCassa;
        payload.data_pagamento = form.dataPagamento;
        payload.data_decorrenza_rinnovo = form.dataMessaCassa;
        payload.data_incasso = form.dataMessaCassa;
      }
      if (bancaLabel) payload.banca_pagamento = bancaLabel;

      const { error } = await (supabase.from("titoli") as any).update(payload).eq("id", t.id);
      if (error) { ko++; continue; }

      if (utilizziPerTitolo.length > 0) {
        const rows = utilizziPerTitolo.map((u) => ({
          ...u,
          titolo_id: t.id,
          data_utilizzo: form.dataMessaCassa,
          creato_da: userId,
        }));
        const { error: errU } = await (supabase.from("cliente_anticipi_utilizzi") as any).insert(rows);
        if (errU) {
          toast.error(`Errore registrazione acconti su ${t.numero_titolo ?? t.id}: ${errU.message}`);
        } else {
          const totUtilizzo = round2(utilizziPerTitolo.reduce((s, u: any) => s + Number(u.importo_utilizzato || 0), 0));
          if (totUtilizzo > 0) {
            const { error: errMA } = await (supabase.from("movimenti_contabili") as any).insert({
              ufficio_id: t.ufficio_id || null,
              tipo: "entrata",
              categoria: "utilizzo_anticipo",
              riferimento_tipo: "titolo",
              riferimento_id: t.id,
              importo: totUtilizzo,
              data_movimento: form.dataMessaCassa,
              descrizione: `Utilizzo acconto cliente su titolo ${t.numero_titolo ?? t.id}`,
              stato: "registrato",
              created_by: userId,
            });
            if (errMA) toast.warning(`Acconto registrato ma prima nota non aggiornata: ${errMA.message}`);
          }
        }
      }

      if (compForThis.length > 0) {
        const compRows = compForThis.map((c) => ({
          titolo_id: t.id,
          causale_id: c.causale_id,
          causale_codice: c.causale_codice,
          causale_descrizione: c.causale_descrizione,
          importo: c.importo,
          segno: c.segno,
          note: c.note || null,
          creato_da: userId,
        }));
        const { error: errC } = await (supabase.from("titoli_compensazioni") as any).insert(compRows);
        if (errC) {
          toast.error(`Errore registrazione compensazioni su ${t.numero_titolo ?? t.id}: ${errC.message}`);
        } else {
          const movRows = compForThis.map((c) => ({
            ufficio_id: t.ufficio_id || null,
            tipo: c.segno === "+" ? "uscita" : "entrata",
            categoria: "compensazione_titolo",
            riferimento_tipo: "titolo",
            riferimento_id: t.id,
            importo: c.importo,
            data_movimento: form.dataMessaCassa,
            descrizione: `${c.causale_codice} — ${c.causale_descrizione}${c.note ? " · " + c.note : ""}`,
            stato: "registrato",
            created_by: userId,
          }));
          const { error: errM } = await (supabase.from("movimenti_contabili") as any).insert(movRows);
          if (errM) toast.warning(`Compensazioni salvate ma prima nota non aggiornata: ${errM.message}`);
        }
      }

      ok++;
      await logAttivita({
        azione: isFullIncasso ? "messa_a_cassa" : "incasso_parziale",
        entita_tipo: "titolo",
        entita_id: t.id,
        dettagli_json: {
          data_messa_cassa: isFullIncasso ? form.dataMessaCassa : null,
          tipo_pagamento: tipoPag,
          anticipi_usati: utilizziPerTitolo,
          compensazioni: compForThis.map((c) => ({ codice: c.causale_codice, segno: c.segno, importo: c.importo })),
          residuo_cash: residuoCash,
          importo_incassato_totale: nuovoIncassato,
          incasso_parziale: !isFullIncasso,
          movimento_bancario_id: bankIncasso?.movimentoId ?? null,
          trattenuta_provvigioni: tr
            ? {
                prod_id: tr.prodId,
                provvigione_lorda: tr.provvigioneLorda,
                ritenuta: tr.ritenutaAcconto,
                trattenuto_netto: tr.trattenutoNetto,
              }
            : null,
          bulk: isMulti,
        },
      });
      try {
        await supabase.functions.invoke("calcola-provvigioni", { body: { titolo_id: t.id } });
        if (tr?.prodId && isFullIncasso) {
          const { error: errPag } = await (supabase.from("provvigioni_generate") as any)
            .update({ pagata: true })
            .eq("titolo_id", t.id)
            .eq("anagrafica_commerciale_id", tr.prodId)
            .eq("tipo_destinatario", "commerciale");
          if (errPag) {
            toast.warning(`Provvigione non segnata pagata su ${t.numero_titolo ?? t.id}: ${errPag.message}`);
          }
        }
      } catch {
        toast.warning(`Calcolo provvigioni non completato su ${t.numero_titolo ?? t.id}`);
      }
      if (isFullIncasso) {
        supabase.functions.invoke("notifica-messa-cassa-agenzia", { body: { titolo_id: t.id } })
          .then((res: any) => { if (res?.error) toast.warning(`Notifica non inviata (${t.numero_titolo ?? t.id})`); })
          .catch(() => {});
      }
    }

    setLoading(false);
    if (ok > 0) {
      const parziali = bankIncasso && titoli.some((t) => {
        const imp = bankIncasso.importoByTitoloId[t.id] ?? 0;
        const lordo = Number(t.premio_lordo) || 0;
        return imp > 0 && imp < lordo - TOLLERANZA_QUADRATURA;
      });
      toast.success(
        isMulti
          ? `${ok} polizze processate${ko > 0 ? `, ${ko} errori` : ""}${parziali ? " (alcune parziali, restano in carico)" : ""}`
          : parziali ? "Incasso parziale registrato — quietanza resta in carico" : "Polizza incassata"
      );
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-anticipi"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-anticipi-disponibili"] });
      queryClient.invalidateQueries({ queryKey: ["anticipi-globale"] });
      queryClient.invalidateQueries({ queryKey: ["anticipi-residuo-by-clienti"] });
      queryClient.invalidateQueries({ queryKey: ["titoli-compensazioni"] });
      queryClient.invalidateQueries({ queryKey: ["provvigioni-generate"] });
      queryClient.invalidateQueries({ queryKey: ["ec-produttori"] });
      queryClient.invalidateQueries({ queryKey: ["polizze_cliente"] });
      queryClient.invalidateQueries({ queryKey: ["ec-agenzia-contab"] });
      onSuccess?.(form.dataMessaCassa);
      onOpenChange(false);
    } else {
      toast.error("Operazione fallita");
    }
  };

  // === UI: pannello compensazioni per singolo titolo (riusato in single e bulk) ===
  /**
   * Render del pannello compensazioni per un titolo.
   *
   * NB: definito come funzione che ritorna JSX (non come componente React) per
   * evitare che ad ogni re-render del parent React rimonti gli input figli
   * (causa del vecchio bug "un numero alla volta"): in quel caso il campo
   * perdeva il focus a ogni tasto.
   */
  const renderCompensazioniPanel = (titoloId: string) => {
    const list = getComp(titoloId);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Compensazioni contabili
          </div>
          <Select value="" onValueChange={(v) => v && addCompFor(titoloId, v, isMulti ? 0 : Math.abs(delta))}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue placeholder="+ Aggiungi causale..." />
            </SelectTrigger>
            <SelectContent>
              {causaliComp.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  <span className="font-mono mr-2">{c.segno_default}</span>
                  {c.codice} — {c.descrizione}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nessuna compensazione. Usa per abbuoni, sconti, arrotondamenti.
          </p>
        ) : (
          <div className="space-y-1.5">
            {list.map((c) => (
              <div key={c.tempId} className="flex items-center gap-2 bg-background/80 rounded px-2 py-1.5">
                <span className={`font-mono text-sm font-bold ${c.segno === "+" ? "text-green-600" : "text-red-600"}`}>
                  {c.segno}
                </span>
                <div className="flex-1 text-xs">
                  <div className="font-medium">{c.causale_codice}</div>
                  <div className="text-muted-foreground truncate">{c.causale_descrizione}</div>
                </div>
                <Input
                  type="text" placeholder="note"
                  value={c.note}
                  onChange={(e) => updateCompFor(titoloId, c.tempId, { note: e.target.value })}
                  className="w-32 h-8 text-xs"
                />
                <ImportoCompensazioneInput
                  value={c.importo}
                  autoFocus={lastAddedCompId === c.tempId}
                  onCommit={(n) => updateCompFor(titoloId, c.tempId, { importo: n })}
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCompFor(titoloId, c.tempId)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferma Messa a Cassa</DialogTitle>
          <DialogDescription>
            {isMulti ? (
              <>Incasso multiplo: <strong>{titoli.length} polizze</strong> — totale lordo {fmtEuro(totaleLordo)}</>
            ) : (
              <>Polizza {titoli[0]?.numero_titolo || titoli[0]?.id?.slice(0, 8) || ""} — Lordo {fmtEuro(totaleLordo)}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data Messa a Cassa</Label>
              <Input type="date" value={form.dataMessaCassa} onChange={(e) => setForm(f => ({ ...f, dataMessaCassa: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Data Pagamento</Label>
              <Input type="date" value={form.dataPagamento} onChange={(e) => setForm(f => ({ ...f, dataPagamento: e.target.value }))} className="mt-1" />
            </div>
          </div>

          {clienteUnico && anticipi.length > 0 && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Wallet className="w-4 h-4" /> Acconti disponibili del cliente
              </div>
              {anticipi.map((a) => {
                const selected = anticipiSel[a.id] !== undefined;
                return (
                  <div key={a.id} className="flex items-center gap-2 bg-background/60 rounded px-2 py-1.5">
                    <Checkbox checked={selected} onCheckedChange={() => toggleAnticipo(a.id, Number(a.importo_residuo))} />
                    <div className="flex-1 text-xs">
                      <div className="font-medium">{new Date(a.data_anticipo).toLocaleDateString("it-IT")} — {a.conto?.etichetta || "n/d"}</div>
                      <div className="text-muted-foreground">Residuo: {fmtEuro(Number(a.importo_residuo))}</div>
                    </div>
                    {selected && (
                      <Input
                        type="number" step="0.01" min="0" max={Number(a.importo_residuo)}
                        value={anticipiSel[a.id]}
                        onChange={(e) => setImportoAnticipo(a.id, e.target.value, Number(a.importo_residuo))}
                        className="w-28 h-8 text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cash + tipo pagamento (single titolo) */}
          {!isMulti && cashEffettivo >= 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{haTrattenuta ? "Importo versato a Consulbrokers" : "Importo cash incassato"}</Label>
                <div className="flex gap-1 mt-1">
                  <Input
                    type="number" step="0.01" min="0"
                    value={form.cashImporto}
                    onChange={(e) => setForm(f => ({ ...f, cashImporto: round2(Number(e.target.value) || 0) }))}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={autoQuadra} title="Imposta al valore che fa quadrare">
                    <Calculator className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Tipo Pagamento</Label>
                <Select value={form.tipoPagamento} onValueChange={handleTipoPagamentoChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contanti">Contanti</SelectItem>
                    <SelectItem value="pos">POS</SelectItem>
                    <SelectItem value="bonifico">Bonifico</SelectItem>
                    <SelectItem value="assegno">Assegno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Bulk: tipo pagamento per residuo cash */}
          {isMulti && cashEffettivo > 0 && (
            <div>
              <Label className="text-xs">Tipo Pagamento {totaleAnticipiUsati > 0 && <span className="text-muted-foreground">(parte residua)</span>}</Label>
              <Select value={form.tipoPagamento} onValueChange={handleTipoPagamentoChange}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contanti">Contanti</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="bonifico">Bonifico</SelectItem>
                  <SelectItem value="assegno">Assegno</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {cashEffettivo > 0 && isBonificoTipo(form.tipoPagamento) && (
            <div>
              <Label className="text-xs">Conto Consulbrokers</Label>
              <ContoBancarioSelect
                tipi={["generico", "incasso_clienti"]}
                value={form.banca || null}
                onChange={(id) => setForm(f => ({ ...f, banca: id || "" }))}
                placeholder="Cerca conto..."
                showPreview
                autoSelectDefault
                className="mt-1"
              />
            </div>
          )}

          {/* Incasso a zero (regolazione/proroga) */}
          {totaleDovutoConsul === 0 && (
            <div className="rounded-md border border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 p-3 text-sm">
              Incasso tecnico a <strong>€0,00</strong>: conferma per registrare messa a cassa e tutte le conseguenze contabili.
            </div>
          )}

          {/* Riepilogo quadratura */}
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Premio lordo {isMulti ? "(totale polizze)" : "polizza"}</span><span>{fmtEuro(totaleLordo)}</span></div>
            {totaleCompMinus > 0 && (
              <div className="flex justify-between text-red-600"><span>+ Compensazioni che aumentano dovuto</span><span>+ {fmtEuro(totaleCompMinus)}</span></div>
            )}
            {totaleCompPlus > 0 && (
              <div className="flex justify-between text-green-600"><span>− Compensazioni che riducono dovuto</span><span>− {fmtEuro(totaleCompPlus)}</span></div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1"><span>Dovuto cliente</span><span>{fmtEuro(dovutoFinale)}</span></div>
            {Array.from(trattenutaByTitolo.values()).map((tr) => (
              <div key={tr.titoloId} className="rounded border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 p-2 space-y-0.5 my-1">
                <div className="font-medium text-amber-800 dark:text-amber-300">Trattenuta provvigioni — {tr.prodNome}</div>
                <div className="flex justify-between"><span>− Provvigione trattenuta</span><span>− {fmtEuro(tr.provvigioneLorda)}</span></div>
                <div className="flex justify-between"><span>+ RA versata ({tr.percentualeRa}%)</span><span>+ {fmtEuro(tr.ritenutaAcconto)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Netto trattenuto produttore</span><span>{fmtEuro(tr.trattenutoNetto)}</span></div>
              </div>
            ))}
            {haTrattenuta && (
              <div className="flex justify-between font-semibold"><span>Da incassare (Consulbrokers)</span><span>{fmtEuro(totaleDovutoConsul)}</span></div>
            )}
            {totaleAnticipiUsati > 0 && (
              <div className="flex justify-between text-primary"><span>− Acconti utilizzati</span><span>− {fmtEuro(totaleAnticipiUsati)}</span></div>
            )}
            <div className="flex justify-between"><span>− Cash/bonifico</span><span>− {fmtEuro(cashEffettivo)}</span></div>
            <div className={`flex justify-between font-bold border-t pt-1 ${quadrato ? "text-green-700" : "text-red-700"}`}>
              <span>{quadrato ? "✅ Quadrato" : "⚠️ Delta da quadrare"}</span>
              <span>{fmtEuro(delta)}</span>
            </div>
          </div>

          {/* Anteprima scritture contabili */}
          {movimentiPreview.length > 0 && (
            <div className="rounded-md border bg-background p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Anteprima scritture in Prima Nota ({movimentiPreview.length})
              </div>
              <div className="text-xs space-y-1">
                {movimentiPreview.map((m, i) => (
                  <div key={i} className="flex justify-between gap-2 border-b last:border-0 pb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${m.tipo === "entrata" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
                        {m.tipo}
                      </span>
                      {m.titolo && <span className="font-mono text-[10px] text-muted-foreground">{m.titolo}</span>}
                      <span className="truncate">{m.descrizione}</span>
                    </div>
                    <span className="font-mono">{fmtEuro(m.importo)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compensazioni — single titolo: pannello singolo */}
          {!isMulti && titoli[0] && (
            <div className="rounded-md border border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-3">
              {renderCompensazioniPanel(titoli[0].id)}
            </div>
          )}

          {/* Compensazioni — bulk: accordion per titolo */}
          {isMulti && (
            <div className="rounded-md border border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-3">
              <div className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-2">
                <Calculator className="w-4 h-4" /> Compensazioni per polizza
                {allCompensazioni.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {allCompensazioni.length} righe su {Object.keys(compensazioniByTitolo).filter(k => (compensazioniByTitolo[k] || []).length > 0).length} polizze
                  </span>
                )}
              </div>
              <Accordion type="multiple" className="w-full">
                {titoli.map((t) => {
                  const n = getComp(t.id).length;
                  return (
                    <AccordionItem key={t.id} value={t.id} className="border-b last:border-0">
                      <AccordionTrigger className="text-xs py-2 hover:no-underline">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-mono">{t.numero_titolo || t.id.slice(0, 8)}</span>
                          <span className="text-muted-foreground">— {fmtEuro(Number(t.premio_lordo) || 0)}</span>
                          {n > 0 && (
                            <span className="ml-auto mr-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                              {n} comp.
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-3">
                        {renderCompensazioniPanel(t.id)}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}

          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              ⚠️ Operazione irreversibile senza privilegi admin. Tolleranza quadratura: {fmtEuro(TOLLERANZA_QUADRATURA)}.
            </p>
          </div>
        </div>
        <DialogFooter>
          {!isMulti && (
            <Button variant="outline" onClick={stampaRiepilogo} disabled={loading} title="Stampa riepilogo per l'operatore">
              <Printer className="w-4 h-4 mr-1" /> Stampa
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annulla</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={loading || !quadrato || (cashEffettivo > 0 && isBonificoTipo(form.tipoPagamento) && !form.banca)}
            onClick={handleConferma}
          >
            <CheckSquare className="w-4 h-4 mr-1" />
            {loading ? "In corso..." : isMulti ? `Conferma Incasso (${titoli.length})` : "Conferma Incasso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessaCassaDialog;
