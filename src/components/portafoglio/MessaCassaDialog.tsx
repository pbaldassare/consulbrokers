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
import { CheckSquare, Wallet, Trash2, Calculator, Printer, FileText, Plus, Users, ArrowLeftRight } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { invokeNotificaMessaCassa } from "@/lib/notificaMessaCassa";
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

export const MessaCassaDialog = ({ open, onOpenChange, titoli: titoliProp, onSuccess, bankIncasso }: Props) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  // Lista titoli mutabile: parte dalla selezione iniziale, ma è possibile
  // aggiungere/rimuovere altre quietanze da incassare (anche di altri clienti).
  const [titoli, setTitoli] = useState<TitoloMin[]>(titoliProp);
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
  // Date specifiche per titolo (override rispetto alle date globali)
  const [datesByTitolo, setDatesByTitolo] = useState<Record<string, { mc: string; pag: string }>>({});
  // Cliente "pagatore" i cui acconti vengono erosi (può differire dai clienti dei titoli)
  const [pagatoreId, setPagatoreId] = useState<string | null>(null);
  const [pagatoreSearch, setPagatoreSearch] = useState("");
  // Ricerca per aggiungere altre quietanze da incassare
  const [titoloSearch, setTitoloSearch] = useState("");
  // Flusso "per cliente": cliente di cui elencare le quietanze da incassare
  const [clienteQuietanze, setClienteQuietanze] = useState<{ id: string; nome: string } | null>(null);
  const [clienteQuietanzeSearch, setClienteQuietanzeSearch] = useState("");
  // Quietanze spuntate nella checklist prima dell'aggiunta
  const [quietanzeSel, setQuietanzeSel] = useState<Record<string, boolean>>({});

  const isMulti = titoli.length > 1;
  const totaleLordo = titoli.reduce((s, t) => s + (Number(t.premio_lordo) || 0), 0);

  const clienteUnico = useMemo(() => {
    const ids = Array.from(new Set(titoli.map((t) => t.cliente_anagrafica_id).filter(Boolean)));
    return ids.length === 1 ? (ids[0] as string) : null;
  }, [titoli]);

  // Cliente pagatore effettivo: selezione esplicita oppure, se unico, il cliente dei titoli
  const effettivoPagatoreId = pagatoreId || clienteUnico;

  const nomeCliente = (c: any) =>
    c?.ragione_sociale || `${c?.cognome || ""} ${c?.nome || ""}`.trim() || "n/d";

  const { data: anticipi = [] } = useQuery({
    queryKey: ["cliente-anticipi-disponibili", effettivoPagatoreId],
    enabled: !!effettivoPagatoreId && open,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .select("id, data_anticipo, importo, importo_residuo, conto:conti_bancari(etichetta)")
        .eq("cliente_id", effettivoPagatoreId)
        .gt("importo_residuo", 0)
        .order("data_anticipo", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  // Nome del cliente pagatore (per etichette/giroconto)
  const { data: pagatoreCliente } = useQuery({
    queryKey: ["messa-cassa-pagatore", effettivoPagatoreId],
    enabled: !!effettivoPagatoreId && open,
    queryFn: async () => {
      const { data } = await (supabase.from("clienti") as any)
        .select("id, ragione_sociale, cognome, nome")
        .eq("id", effettivoPagatoreId)
        .maybeSingle();
      return data as any;
    },
  });

  // Ricerca clienti per selezione pagatore
  const { data: pagatoreOptions = [] } = useQuery({
    queryKey: ["messa-cassa-clienti-search", pagatoreSearch],
    enabled: open && pagatoreSearch.trim().length >= 2,
    queryFn: async () => {
      const q = pagatoreSearch.trim();
      const { data } = await (supabase.from("clienti") as any)
        .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
        .or(`ragione_sociale.ilike.%${q}%,cognome.ilike.%${q}%,codice_fiscale.ilike.%${q}%,partita_iva.ilike.%${q}%`)
        .eq("attivo", true)
        .limit(20);
      return (data as any[]) || [];
    },
  });

  // Ricerca altre quietanze da incassare (aggiungibili alla messa a cassa).
  // Cerca sia per numero titolo sia per nome/cognome/ragione sociale del cliente.
  const { data: titoliSearchResults = [] } = useQuery({
    queryKey: ["messa-cassa-titoli-search", titoloSearch, titoli.map((t) => t.id).join(",")],
    enabled: open && titoloSearch.trim().length >= 2,
    queryFn: async () => {
      const q = titoloSearch.trim();
      const already = new Set(titoli.map((t) => t.id));

      // Prima cerca per numero titolo
      const { data: byNum } = await (supabase.from("titoli") as any)
        .select("id, numero_titolo, premio_lordo, cliente_anagrafica_id, ufficio_id, importo_incassato, stato, clienti:clienti!titoli_cliente_anagrafica_id_fkey(ragione_sociale, cognome, nome)")
        .ilike("numero_titolo", `%${q}%`)
        .is("data_messa_cassa", null)
        .in("stato", ["attivo", "sospeso"])
        .limit(20);

      // Poi cerca per nome cliente e unisci senza duplicati
      const { data: clientiMatch } = await (supabase.from("clienti") as any)
        .select("id")
        .or(`ragione_sociale.ilike.%${q}%,cognome.ilike.%${q}%,nome.ilike.%${q}%`)
        .eq("attivo", true)
        .limit(20);
      const clienteIds = (clientiMatch as any[] || []).map((c: any) => c.id);

      let byCliente: any[] = [];
      if (clienteIds.length > 0) {
        const { data } = await (supabase.from("titoli") as any)
          .select("id, numero_titolo, premio_lordo, cliente_anagrafica_id, ufficio_id, importo_incassato, stato, clienti:clienti!titoli_cliente_anagrafica_id_fkey(ragione_sociale, cognome, nome)")
          .in("cliente_anagrafica_id", clienteIds)
          .is("data_messa_cassa", null)
          .in("stato", ["attivo", "sospeso"])
          .limit(20);
        byCliente = (data as any[]) || [];
      }

      const merged = new Map<string, any>();
      for (const r of [...((byNum as any[]) || []), ...byCliente]) {
        if (!merged.has(r.id)) merged.set(r.id, r);
      }
      return Array.from(merged.values()).filter((r) => !already.has(r.id)).slice(0, 20);
    },
  });

  // Ricerca clienti per il flusso "aggiungi quietanze di un cliente"
  const { data: clienteQuietanzeOptionsRaw = [] } = useQuery({
    queryKey: ["messa-cassa-cliente-quietanze-search", clienteQuietanzeSearch],
    enabled: open && clienteQuietanzeSearch.trim().length >= 2,
    queryFn: async () => {
      const q = clienteQuietanzeSearch.trim();
      const { data } = await (supabase.from("clienti") as any)
        .select("id, ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
        .or(`ragione_sociale.ilike.%${q}%,cognome.ilike.%${q}%,codice_fiscale.ilike.%${q}%,partita_iva.ilike.%${q}%`)
        .eq("attivo", true)
        .limit(20);
      return (data as any[]) || [];
    },
  });

  // Tutte le quietanze "da incassare" del cliente selezionato (non ancora messe a cassa).
  // Usa la vista v_portafoglio_quietanze (stessa sorgente del Portafoglio → Carico).
  // Post-processa lato client per escludere le polizze madri che hanno rate figlie
  // nel set restituito: la polizza madre è identificata da sostituisce_polizza IS NULL
  // mentre le sue rate figlie hanno sostituisce_polizza = numero_titolo_madre.
  // Non si usa il filtro .or() su numero_rate_totali perché la view può restituire
  // numero_rate_totali = 1 anche per polizze madri con rinnovi annuali.
  const { data: quietanzeCliente = [] } = useQuery({
    queryKey: ["messa-cassa-quietanze-cliente", clienteQuietanze?.id, titoli.map((t) => t.id).join(",")],
    enabled: open && !!clienteQuietanze?.id,
    queryFn: async () => {
      const { data } = await (supabase.from("v_portafoglio_quietanze") as any)
        .select("id, numero_titolo, premio_lordo, cliente_anagrafica_id, ufficio_id, importo_incassato, stato, data_scadenza, sostituisce_polizza")
        .eq("cliente_anagrafica_id", clienteQuietanze!.id)
        .is("data_messa_cassa", null)
        .in("stato", ["attivo", "sospeso"])
        .order("data_scadenza", { ascending: true })
        .limit(200);

      const raw = (data as any[]) || [];
      const already = new Set(titoli.map((t) => t.id));

      // Numeri titolo che compaiono come "padre" di almeno un'altra rata nel set
      const numeriPadre = new Set(
        raw.filter((r) => r.sostituisce_polizza).map((r) => r.sostituisce_polizza as string),
      );

      return raw
        .filter((r) => !already.has(r.id))
        // Escludi polizza madre se ha già rate figlie presenti nel set
        .filter((r) => !(r.sostituisce_polizza === null && numeriPadre.has(r.numero_titolo)));
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
      const seed = titoliProp;
      const t = bankIncasso?.dataMovimento || todayISO();
      const totLordoSeed = seed.reduce((s, x) => s + (Number(x.premio_lordo) || 0), 0);
      const bankCash = bankIncasso
        ? round2(Object.values(bankIncasso.importoByTitoloId).reduce((s, v) => s + (Number(v) || 0), 0))
        : round2(totLordoSeed);
      const cliIds = Array.from(new Set(seed.map((x) => x.cliente_anagrafica_id).filter(Boolean)));
      setTitoli(seed);
      setForm({
        dataMessaCassa: t,
        dataPagamento: t,
        tipoPagamento: bankIncasso ? "bonifico" : "contanti",
        banca: bankIncasso?.contoBancarioId ?? "",
        cashImporto: bankCash,
      });
      setAnticipiSel({});
      setCompensazioniByTitolo({});
      setDatesByTitolo({});
      setPagatoreId(cliIds.length === 1 ? (cliIds[0] as string) : null);
      setPagatoreSearch("");
      setTitoloSearch("");
      setClienteQuietanze(null);
      setClienteQuietanzeSearch("");
      setQuietanzeSel({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bankIncasso?.movimentoId]);

  // Date effettive per titolo (override oppure default globale del form)
  const getDate = (titoloId: string) =>
    datesByTitolo[titoloId] || { mc: form.dataMessaCassa, pag: form.dataPagamento };
  const setDate = (titoloId: string, patch: Partial<{ mc: string; pag: string }>) =>
    setDatesByTitolo((prev) => {
      const cur = prev[titoloId] || { mc: form.dataMessaCassa, pag: form.dataPagamento };
      return { ...prev, [titoloId]: { ...cur, ...patch } };
    });

  const addTitolo = (row: any) => {
    setTitoli((prev) => {
      if (prev.some((t) => t.id === row.id)) return prev;
      return [
        ...prev,
        {
          id: row.id,
          numero_titolo: row.numero_titolo,
          premio_lordo: row.premio_lordo,
          cliente_anagrafica_id: row.cliente_anagrafica_id,
          ufficio_id: row.ufficio_id,
          importo_incassato: row.importo_incassato,
        },
      ];
    });
    setTitoloSearch("");
  };

  const removeTitolo = (id: string) => {
    setTitoli((prev) => prev.filter((t) => t.id !== id));
    setCompensazioniByTitolo((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setDatesByTitolo((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  // === Flusso "aggiungi quietanze di un cliente" ===
  // Opzioni per il SearchableSelect del cliente: include sempre quello selezionato
  const clienteQuietanzeSelectOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; description?: string }>();
    if (clienteQuietanze) map.set(clienteQuietanze.id, { value: clienteQuietanze.id, label: clienteQuietanze.nome });
    for (const c of clienteQuietanzeOptionsRaw as any[]) {
      map.set(c.id, {
        value: c.id,
        label: nomeCliente(c),
        description: c.partita_iva || c.codice_fiscale || undefined,
      });
    }
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteQuietanze, clienteQuietanzeOptionsRaw]);

  const numQuietanzeSel = useMemo(
    () => (quietanzeCliente as any[]).filter((r) => quietanzeSel[r.id]).length,
    [quietanzeCliente, quietanzeSel],
  );
  const tutteQuietanzeSel =
    (quietanzeCliente as any[]).length > 0 && (quietanzeCliente as any[]).every((r) => quietanzeSel[r.id]);

  const toggleQuietanzaSel = (id: string) =>
    setQuietanzeSel((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleTutteQuietanze = () => {
    if (tutteQuietanzeSel) {
      setQuietanzeSel({});
    } else {
      setQuietanzeSel(Object.fromEntries((quietanzeCliente as any[]).map((r) => [r.id, true])));
    }
  };

  const addQuietanzeSelezionate = () => {
    (quietanzeCliente as any[]).filter((r) => quietanzeSel[r.id]).forEach((r) => addTitolo(r));
    setQuietanzeSel({});
  };

  // Beneficiari giroconto: titoli il cui cliente differisce dal pagatore
  const clientiById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const t of titoli) m.set(t.id, t.cliente_anagrafica_id ?? null);
    return m;
  }, [titoli]);

  const titoliGiroconto = useMemo(
    () =>
      effettivoPagatoreId
        ? titoli.filter((t) => t.cliente_anagrafica_id && t.cliente_anagrafica_id !== effettivoPagatoreId)
        : [],
    [titoli, effettivoPagatoreId],
  );

  // Opzioni per il SearchableSelect del cliente pagatore: include sempre il
  // cliente attualmente selezionato (così l'etichetta resta visibile) + risultati ricerca.
  const pagatoreSelectOptions = useMemo(() => {
    const map = new Map<string, { value: string; label: string; description?: string }>();
    if (pagatoreCliente?.id) {
      map.set(pagatoreCliente.id, { value: pagatoreCliente.id, label: nomeCliente(pagatoreCliente) });
    }
    for (const c of pagatoreOptions as any[]) {
      map.set(c.id, {
        value: c.id,
        label: nomeCliente(c),
        description: c.partita_iva || c.codice_fiscale || undefined,
      });
    }
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagatoreCliente, pagatoreOptions]);

  // Nomi dei clienti dei titoli correnti (per lista quietanze + banner giroconto)
  const titoliClienteIds = useMemo(
    () => Array.from(new Set(titoli.map((t) => t.cliente_anagrafica_id).filter(Boolean))) as string[],
    [titoli],
  );

  const { data: titoliClienti = [] } = useQuery({
    queryKey: ["messa-cassa-titoli-clienti", titoliClienteIds],
    enabled: open && titoliClienteIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase.from("clienti") as any)
        .select("id, ragione_sociale, cognome, nome")
        .in("id", titoliClienteIds);
      return (data as any[]) || [];
    },
  });

  const clienteNomeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of titoliClienti as any[]) m.set(c.id, nomeCliente(c));
    if (pagatoreCliente?.id) m.set(pagatoreCliente.id, nomeCliente(pagatoreCliente));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titoliClienti, pagatoreCliente]);

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
    const notificaTitoloIds: string[] = [];

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
      const d = getDate(t.id);

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
      // residuoCash è la quota cash/bonifico; usatoTitolo è la quota coperta da acconti.
      // Entrambe contribuiscono all'importo_incassato, altrimenti i pagamenti
      // fatti interamente con acconti lasciano il titolo in stato "attivo".
      const nuovoIncassato = round2(prevIncassato + residuoCash + usatoTitolo);
      const isFullIncasso = nuovoIncassato + TOLLERANZA_QUADRATURA >= dovutoT;

      const payload: any = {
        importo_incassato: nuovoIncassato,
        tipo_pagamento: tipoPag,
        updated_at: new Date().toISOString(),
      };
      if (isFullIncasso) {
        payload.stato = "incassato";
        payload.data_messa_cassa = d.mc;
        payload.data_pagamento = d.pag;
        payload.data_decorrenza_rinnovo = d.mc;
        payload.data_incasso = d.mc;
      }
      if (bancaLabel) payload.banca_pagamento = bancaLabel;
      // Pagamento diretto compagnia: il premio è già stato pagato dal cliente
      // direttamente alla compagnia → nessuna entrata banca lato broker e il
      // premio viene escluso dall'E/C compagnia (resta solo la provvigione).
      if (form.tipoPagamento === "pagamento_diretto_compagnia") {
        payload.pag_diretto_compagnia = true;
      }

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

      // Giroconto inter-cliente: se gli acconti del cliente pagatore coprono la
      // quietanza di un cliente diverso, registra una partita di giroconto per
      // ciascun acconto utilizzato (visibile negli E/C di entrambi i clienti).
      if (
        effettivoPagatoreId &&
        t.cliente_anagrafica_id &&
        t.cliente_anagrafica_id !== effettivoPagatoreId &&
        utilizziPerTitolo.length > 0
      ) {
        const giroRows = utilizziPerTitolo.map((u) => ({
          data: d.mc,
          cliente_pagatore_id: effettivoPagatoreId,
          cliente_beneficiario_id: t.cliente_anagrafica_id,
          titolo_id: t.id,
          anticipo_id: u.anticipo_id,
          importo: u.importo_utilizzato,
          note: `Acconto ${clienteNomeById.get(effettivoPagatoreId) || "pagatore"} usato per quietanza ${t.numero_titolo ?? t.id} di ${t.cliente_anagrafica_id ? clienteNomeById.get(t.cliente_anagrafica_id) || "altro cliente" : "altro cliente"}`,
          created_by: userId,
        }));
        const { error: errG } = await (supabase.from("giroconti_cliente") as any).insert(giroRows);
        if (errG) toast.warning(`Giroconto inter-cliente non registrato su ${t.numero_titolo ?? t.id}: ${errG.message}`);
      }

      // Abbuono: la quietanza è saldata senza entrata in banca. Registra un
      // movimento contabile di categoria "abbuono" a fini di audit/quadratura.
      if (form.tipoPagamento === "abbuono" && residuoCash > 0) {
        const { error: errAb } = await (supabase.from("movimenti_contabili") as any).insert({
          ufficio_id: t.ufficio_id || null,
          tipo: "entrata",
          categoria: "abbuono",
          riferimento_tipo: "titolo",
          riferimento_id: t.id,
          importo: residuoCash,
          data_movimento: d.mc,
          descrizione: `Abbuono su titolo ${t.numero_titolo ?? t.id} (nessuna entrata in banca)`,
          stato: "registrato",
          created_by: userId,
        });
        if (errAb) toast.warning(`Abbuono registrato ma prima nota non aggiornata: ${errAb.message}`);
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
        notificaTitoloIds.push(t.id);
      }
    }

    if (notificaTitoloIds.length > 0) {
      invokeNotificaMessaCassa(notificaTitoloIds)
        .then(({ data, error }) => {
          if (error) toast.warning("Notifica agenzia non inviata");
          else if (data?.archive_error) toast.warning(`Email inviata ma archivio PDF fallito: ${data.archive_error}`);
          else if (data?.documenti_archiviati) {
            queryClient.invalidateQueries({ queryKey: ["documenti", "titolo"] });
          }
        })
        .catch(() => toast.warning("Notifica agenzia non inviata"));
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

          {/* Cliente pagatore: i cui acconti vengono erosi (può differire dai clienti dei titoli) */}
          <div>
            <Label className="text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Acconti erosi dal cliente pagatore
            </Label>
            <SearchableSelect
              options={pagatoreSelectOptions}
              value={effettivoPagatoreId || ""}
              onValueChange={(v) => setPagatoreId(v || null)}
              onSearchChange={setPagatoreSearch}
              searchValue={pagatoreSearch}
              serverSideSearch
              clearable
              clearLabel="— Nessun pagatore —"
              placeholder="Seleziona cliente pagatore..."
              searchPlaceholder="Cerca cliente (nome, CF, P.IVA)..."
              className="mt-1"
            />
          </div>

          {/* Aggiungi altre quietanze da incassare — flusso "per cliente" */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-3">
            <Label className="text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Aggiungi quietanze di un cliente
            </Label>
            <SearchableSelect
              options={clienteQuietanzeSelectOptions}
              value={clienteQuietanze?.id || ""}
              onValueChange={(v) => {
                if (!v) {
                  setClienteQuietanze(null);
                  setQuietanzeSel({});
                  return;
                }
                const c = (clienteQuietanzeOptionsRaw as any[]).find((x) => x.id === v);
                setClienteQuietanze({ id: v, nome: c ? nomeCliente(c) : clienteQuietanze?.nome || "cliente" });
                setQuietanzeSel({});
              }}
              onSearchChange={setClienteQuietanzeSearch}
              searchValue={clienteQuietanzeSearch}
              serverSideSearch
              clearable
              clearLabel="— Nessun cliente —"
              placeholder="Cerca cliente per vedere le sue quietanze..."
              searchPlaceholder="Cerca cliente (nome, CF, P.IVA)..."
            />

            {clienteQuietanze && (
              <div className="space-y-1.5">
                {(quietanzeCliente as any[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Nessuna quietanza da incassare per <strong>{clienteQuietanze.nome}</strong>.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={toggleTutteQuietanze}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {tutteQuietanzeSel ? "Deseleziona tutte" : "Seleziona tutte"}
                      </button>
                      <span className="text-[11px] text-muted-foreground">
                        {(quietanzeCliente as any[]).length} quietanze da incassare
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {(quietanzeCliente as any[]).map((r) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 bg-background/70 rounded px-2 py-1.5 text-xs cursor-pointer"
                        >
                          <Checkbox
                            checked={!!quietanzeSel[r.id]}
                            onCheckedChange={() => toggleQuietanzaSel(r.id)}
                          />
                          <span className="font-mono font-medium">{r.numero_titolo || r.id.slice(0, 8)}</span>
                          <span className="text-muted-foreground truncate flex-1">
                            {r.data_scadenza ? `scad. ${new Date(r.data_scadenza).toLocaleDateString("it-IT")}` : "—"}
                          </span>
                          <span className="font-mono">{fmtEuro(Number(r.premio_lordo) || 0)}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={numQuietanzeSel === 0}
                      onClick={addQuietanzeSelezionate}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Aggiungi {numQuietanzeSel > 0 ? `${numQuietanzeSel} ` : ""}quietanze selezionate
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Ricerca rapida per numero titolo (opzionale) */}
            <div className="pt-2 border-t space-y-1.5">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Oppure cerca per numero titolo
              </Label>
              <SearchableSelect
                options={(titoliSearchResults as any[]).map((r) => ({
                  value: r.id,
                  label: r.numero_titolo || r.id.slice(0, 8),
                  description: `${nomeCliente(r.clienti)} — ${fmtEuro(Number(r.premio_lordo) || 0)}`,
                }))}
                value=""
                onValueChange={(id) => {
                  const row = (titoliSearchResults as any[]).find((r) => r.id === id);
                  if (row) addTitolo(row);
                }}
                onSearchChange={setTitoloSearch}
                searchValue={titoloSearch}
                serverSideSearch
                placeholder="Cerca quietanza da aggiungere..."
                searchPlaceholder="Cerca numero titolo..."
              />
            </div>

            {/* Quietanze già in incasso */}
            <div className="space-y-1 pt-1">
              {titoli.map((t) => (
                <div key={t.id} className="flex items-center gap-2 bg-background/70 rounded px-2 py-1.5 text-xs">
                  <span className="font-mono font-medium">{t.numero_titolo || t.id.slice(0, 8)}</span>
                  <span className="text-muted-foreground truncate flex-1">
                    {t.cliente_anagrafica_id ? clienteNomeById.get(t.cliente_anagrafica_id) || "…" : "—"}
                  </span>
                  <span className="font-mono">{fmtEuro(Number(t.premio_lordo) || 0)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={titoli.length <= 1}
                    title={titoli.length <= 1 ? "Deve restare almeno una quietanza" : "Rimuovi"}
                    onClick={() => removeTitolo(t.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Banner giroconto inter-cliente */}
          {titoliGiroconto.length > 0 && (
            <div className="rounded-md border border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/30 p-3 flex gap-2 text-xs text-amber-900 dark:text-amber-200">
              <ArrowLeftRight className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                Gli acconti di <strong>{effettivoPagatoreId ? clienteNomeById.get(effettivoPagatoreId) || "pagatore" : "pagatore"}</strong>{" "}
                copriranno {titoliGiroconto.length}{" "}
                {titoliGiroconto.length === 1 ? "polizza di un altro cliente" : "polizze di altri clienti"}.
                Verrà registrata una partita di <strong>giroconto inter-cliente</strong> negli estratti conto di entrambi i clienti.
              </div>
            </div>
          )}

          {effettivoPagatoreId && anticipi.length > 0 && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Wallet className="w-4 h-4" /> Acconti disponibili del cliente pagatore
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
                    <SelectItem value="abbuono">Abbuono</SelectItem>
                    <SelectItem value="pagamento_diretto_compagnia">Pagamento diretto compagnia</SelectItem>
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
                  <SelectItem value="abbuono">Abbuono</SelectItem>
                  <SelectItem value="pagamento_diretto_compagnia">Pagamento diretto compagnia</SelectItem>
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

          {/* Date per quietanza — bulk: tabella sempre visibile */}
          {isMulti && (
            <div className="rounded-md border bg-card p-3 space-y-2">
              <div className="text-sm font-medium flex items-center gap-2 mb-1">
                Date per quietanza
                <span className="text-[10px] text-muted-foreground">(override rispetto alle date globali)</span>
              </div>
              <div className="space-y-2">
                {titoli.map((t) => (
                  <div key={t.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <span className="text-xs font-mono truncate text-muted-foreground">
                      {t.numero_titolo || t.id.slice(0, 8)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground whitespace-nowrap">M.C.</Label>
                      <Input
                        type="date"
                        value={getDate(t.id).mc}
                        onChange={(e) => setDate(t.id, { mc: e.target.value })}
                        className="h-7 text-xs w-36"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Pag.</Label>
                      <Input
                        type="date"
                        value={getDate(t.id).pag}
                        onChange={(e) => setDate(t.id, { pag: e.target.value })}
                        className="h-7 text-xs w-36"
                      />
                    </div>
                  </div>
                ))}
              </div>
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
