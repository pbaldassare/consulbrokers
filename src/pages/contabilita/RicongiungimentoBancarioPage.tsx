import { useState, useMemo, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import RoleGuard from "@/components/RoleGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Undo2, ArrowUp, ArrowDown } from "lucide-react";
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
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { fmtEuro } from "@/lib/formatCurrency";
import { formatDateIT } from "@/lib/formatDate";
import * as XLSX from "xlsx";
import {
  dedupeMovimentiStessoBonificoFisico,
  extractOrdinanteFromDescrizione,
  fetchAllQueryPages,
  fetchContoIdsForUfficio,
  sanitizeIlikeTerm,
} from "@/lib/movimentiBancari";
import { annullaBonificoCollegato } from "@/lib/annullaBonificoCollegato";

const round2 = (n: number) => Math.round(n * 100) / 100;
const TOLL = 0.01;
const MOVIMENTI_CARD_STEP = 50;

type MovimentoFilterRow = {
  data_movimento?: string | null;
  ordinante?: string | null;
  importo?: number | null;
};

const filterMovimentiByOrdinanteImporto = <T extends MovimentoFilterRow>(
  rows: T[],
  ordinante: string,
  importo: string,
): T[] => {
  let result = rows;
  const ord = ordinante.trim().toLowerCase();
  if (ord) {
    result = result.filter((m) => (m.ordinante || "").toLowerCase().includes(ord));
  }
  const impQ = importo.trim();
  if (impQ) {
    const normalized = impQ.replace(/[€$\s]/g, "").replace(",", ".");
    const asNum = parseFloat(normalized);
    result = result.filter((m) => {
      const imp = Number(m.importo) || 0;
      if (!isNaN(asNum) && /^-?\d+([.,]\d+)?$/.test(normalized)) {
        return Math.abs(imp - asNum) < TOLL;
      }
      const formatted = fmtEuro(imp).replace(/\s/g, "").toLowerCase();
      return formatted.includes(impQ.toLowerCase()) || imp.toFixed(2).includes(normalized);
    });
  }
  return result;
};

const FiltriMovimentiRow = ({
  dal,
  setDal,
  al,
  setAl,
  ordinante,
  setOrdinante,
  importo,
  setImporto,
  sortDataAsc,
  setSortDataAsc,
  children,
}: {
  dal: string;
  setDal: (v: string) => void;
  al: string;
  setAl: (v: string) => void;
  ordinante: string;
  setOrdinante: (v: string) => void;
  importo: string;
  setImporto: (v: string) => void;
  sortDataAsc: boolean;
  setSortDataAsc: (v: boolean | ((prev: boolean) => boolean)) => void;
  children?: ReactNode;
}) => (
  <div className="space-y-1.5">
    <p className="text-xs text-muted-foreground">Date in formato gg/mm/aaaa</p>
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label>
          Dal <span className="font-normal text-muted-foreground">(gg/mm/aaaa)</span>
        </Label>
        <Input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className="w-40" title="gg/mm/aaaa" />
      </div>
      <div>
        <Label>
          Al <span className="font-normal text-muted-foreground">(gg/mm/aaaa)</span>
        </Label>
        <Input type="date" value={al} onChange={(e) => setAl(e.target.value)} className="w-40" title="gg/mm/aaaa" />
      </div>
      <div>
        <Label>Nome ordinante</Label>
        <Input value={ordinante} onChange={(e) => setOrdinante(e.target.value)} placeholder="Cerca…" className="w-56" />
      </div>
      <div>
        <Label>Importo</Label>
        <Input value={importo} onChange={(e) => setImporto(e.target.value)} placeholder="es. 150,00" className="w-32" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setSortDataAsc((v) => !v)}
        title={sortDataAsc ? "Ordina: dal più vecchio al più recente" : "Ordina: dal più recente al più vecchio"}
      >
        {sortDataAsc ? <ArrowUp className="w-3.5 h-3.5 mr-1" /> : <ArrowDown className="w-3.5 h-3.5 mr-1" />}
        Data {sortDataAsc ? "↑" : "↓"}
      </Button>
      {children}
    </div>
  </div>
);

const Page = () => {
  const { profile, isAdmin } = useAuth();
  const isCfo = profile?.ruolo === "cfo";
  const seeAll = isAdmin || isCfo;
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const legacy = searchParams.get("legacy") === "1";

  // Flusso primario → hub Bonifici su Caricamento Mov. Bancari
  if (!legacy) {
    const dest =
      tabParam === "storico"
        ? "/contabilita/caricamento-mov-bancari?tab=ricongiunti"
        : "/contabilita/caricamento-mov-bancari?tab=da-ricongiungere";
    return <Navigate to={dest} replace />;
  }

  const activeTab =
    tabParam === "da-ricongiungere" && legacy
      ? "da-ricongiungere"
      : tabParam === "storico"
        ? "storico"
        : legacy
          ? "da-ricongiungere"
          : "storico";

  return (
    <RoleGuard allowedRoles={["admin", "cfo", "ufficio", "backoffice", "contabilita"]} permissionKey="contabilita">
      <div className="container mx-auto py-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">
            {activeTab === "storico" && !legacy ? "Storico bonifici" : "Bonifici (legacy)"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTab === "storico" && !legacy
              ? "Movimenti già collegati e incassati. Per i bonifici aperti usa Incassi."
              : "Vista avanzata legacy. Il flusso operativo è in Incassi → Bonifici aperti."}
          </p>
        </div>

        <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          Vista legacy. Il flusso operativo è in{" "}
          <Link
            to="/contabilita/caricamento-mov-bancari?tab=da-ricongiungere"
            className="font-semibold underline underline-offset-2"
          >
            Bonifici → Da ricongiungere
          </Link>
          {" "}(match su ordinante ↔ cliente, non sull&apos;importo).
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const sp = new URLSearchParams(searchParams);
            sp.set("tab", v);
            if (legacy) sp.set("legacy", "1");
            setSearchParams(sp, { replace: true });
          }}
        >
          <TabsList>
            {(legacy || activeTab === "da-ricongiungere") && (
              <TabsTrigger value="da-ricongiungere">Da collegare</TabsTrigger>
            )}
            <TabsTrigger value="storico">Storico</TabsTrigger>
          </TabsList>

          {(legacy || activeTab === "da-ricongiungere") && (
            <TabsContent value="da-ricongiungere">
              <DaRicongiungereTab profileUfficio={profile?.ufficio_id ?? null} seeAll={seeAll} />
            </TabsContent>
          )}

          <TabsContent value="storico">
            <StoricoTab profileUfficio={profile?.ufficio_id ?? null} seeAll={seeAll} />
          </TabsContent>
        </Tabs>
      </div>
    </RoleGuard>
  );
};

// === Tab: Da Ricongiungere ===
export const DaRicongiungereTab = ({ profileUfficio, seeAll }: { profileUfficio: string | null; seeAll: boolean }) => {
  const [filtroUfficio, setFiltroUfficio] = useState<string>("");
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [ordinante, setOrdinante] = useState("");
  const [ordinanteDebounced, setOrdinanteDebounced] = useState("");
  const [importo, setImporto] = useState("");
  const [sortDataAsc, setSortDataAsc] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOrdinanteDebounced(ordinante), 350);
    return () => clearTimeout(t);
  }, [ordinante]);

  const { data: uffici = [] } = useQuery({
    queryKey: ["uffici-all"],
    enabled: seeAll,
    queryFn: async () => (await supabase.from("uffici").select("id, nome:nome_ufficio").order("nome_ufficio")).data ?? [],
  });

  // ordinante → server (ilike ordinante|descrizione); importo → client sul set completo (tolleranza ±0.01)
  const { data: movs = [], isLoading } = useQuery({
    queryKey: ["mov-bancari", "ricongiungimento", profileUfficio, filtroUfficio, seeAll, dal, al, ordinanteDebounced, sortDataAsc],
    queryFn: async () => {
      const contoIds =
        !seeAll && profileUfficio ? await fetchContoIdsForUfficio(profileUfficio) : ([] as string[]);
      const ordTerm = sanitizeIlikeTerm(ordinanteDebounced);

      return fetchAllQueryPages<any>(async (from, to) => {
        let q = supabase.from("movimenti_bancari" as any)
          .select("id, data_movimento, importo, ordinante, descrizione, stato, ufficio_id, cliente_id, conto_bancario_id, conto:conti_bancari(etichetta), cliente:clienti(id, ragione_sociale, nome, cognome)")
          .in("stato", ["importato", "matchato", "assegnato", "ricongiunti"])
          .order("data_movimento", { ascending: sortDataAsc })
          .order("id", { ascending: sortDataAsc });
        if (seeAll && filtroUfficio) q = q.eq("ufficio_id", filtroUfficio);
        if (!seeAll && profileUfficio) {
          if (contoIds.length > 0) {
            q = q.or(`ufficio_id.eq.${profileUfficio},conto_bancario_id.in.(${contoIds.join(",")})`);
          } else {
            q = q.eq("ufficio_id", profileUfficio);
          }
        }
        if (dal) q = q.gte("data_movimento", dal);
        if (al) q = q.lte("data_movimento", al);
        if (ordTerm) q = q.or(`ordinante.ilike.%${ordTerm}%,descrizione.ilike.%${ordTerm}%`);
        return q.range(from, to);
      }, undefined, 4);
    },
  });

  // Importo filtrato client-side (match esatto con tolleranza o sottostringa formattata)
  const movsFiltrati = useMemo(() => {
    const filtered = filterMovimentiByOrdinanteImporto(movs, "", importo);
    return dedupeMovimentiStessoBonificoFisico(filtered);
  }, [movs, importo]);

  const [visibili, setVisibili] = useState(MOVIMENTI_CARD_STEP);
  useEffect(() => {
    setVisibili(MOVIMENTI_CARD_STEP);
  }, [filtroUfficio, dal, al, ordinanteDebounced, importo, sortDataAsc]);
  const movsVisibili = useMemo(() => movsFiltrati.slice(0, visibili), [movsFiltrati, visibili]);

  return (
    <Card>
      <CardHeader>
        <FiltriMovimentiRow
          dal={dal}
          setDal={setDal}
          al={al}
          setAl={setAl}
          ordinante={ordinante}
          setOrdinante={setOrdinante}
          importo={importo}
          setImporto={setImporto}
          sortDataAsc={sortDataAsc}
          setSortDataAsc={setSortDataAsc}
        >
          {seeAll && (
            <div>
              <Label>Ufficio</Label>
              <select value={filtroUfficio} onChange={(e) => setFiltroUfficio(e.target.value)} className="h-9 px-2 border rounded-md text-sm bg-background">
                <option value="">Tutti</option>
                {(uffici as any[]).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}
        </FiltriMovimentiRow>
        {!isLoading && (
          <p className="text-sm text-muted-foreground pt-2">
            {movsFiltrati.length === 1 ? "1 movimento" : `${movsFiltrati.length} movimenti`}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? <p className="text-sm">Caricamento…</p> :
          movsFiltrati.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Nessun bonifico da collegare</p> :
          movsVisibili.map((m: any) => <MovimentoCard key={m.id} movimento={m} />)}
        {!isLoading && movsFiltrati.length > movsVisibili.length && (
          <div className="flex flex-col items-center gap-1 pt-2">
            <p className="text-xs text-muted-foreground">
              Mostrati {movsVisibili.length} di {movsFiltrati.length} — usa i filtri per restringere
            </p>
            <Button variant="outline" size="sm" onClick={() => setVisibili((v) => v + MOVIMENTI_CARD_STEP)}>
              Mostra altri {Math.min(MOVIMENTI_CARD_STEP, movsFiltrati.length - movsVisibili.length)}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const MovimentoCard = ({ movimento }: { movimento: any }) => {
  const cliNome = movimento.cliente?.ragione_sociale
    || [movimento.cliente?.nome, movimento.cliente?.cognome].filter(Boolean).join(" ")
    || "—";
  return (
    <Card>
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm min-w-0">
          <div>
            <span className="text-muted-foreground">Data: </span>
            <span className="font-medium" title="gg/mm/aaaa">{formatDateIT(movimento.data_movimento)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ordinante: </span>
            <span className="font-medium">
              {(movimento.ordinante || "").trim()
                || extractOrdinanteFromDescrizione(movimento.descrizione || "")
                || "—"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Cliente: </span>
            <span className="font-medium">{cliNome}</span>
          </div>
          <div className="text-right md:text-left">
            <span className="text-muted-foreground">Importo: </span>
            <span className="font-bold tabular-nums">{fmtEuro(movimento.importo)}</span>
          </div>
          {movimento.descrizione && (
            <div className="md:col-span-4 text-xs text-muted-foreground truncate" title={movimento.descrizione}>
              <span className="font-medium text-foreground/80">Descrizione: </span>
              {movimento.descrizione}
            </div>
          )}
        </div>
        <Badge variant={movimento.stato === "ricongiunti" ? "outline" : "default"}>{movimento.stato}</Badge>
      </div>
    </Card>
  );
};

type StoricoMovimento = {
  id: string;
  data_movimento?: string | null;
  importo?: number | null;
  ordinante?: string | null;
  cliente?: { ragione_sociale?: string | null; nome?: string | null; cognome?: string | null } | null;
  ufficio?: { nome?: string | null } | null;
};

type PolizzaCollegataRow = {
  titolo_id: string | null;
  importo: number | null;
  numero_titolo: string | null;
  stato: string | null;
};

// === Tab: Storico ===
export const StoricoTab = ({ profileUfficio, seeAll }: { profileUfficio: string | null; seeAll: boolean }) => {
  const qc = useQueryClient();
  const [dal, setDal] = useState("");
  const [al, setAl] = useState("");
  const [cliente, setCliente] = useState("");
  const [ordinante, setOrdinante] = useState("");
  const [ordinanteDebounced, setOrdinanteDebounced] = useState("");
  const [importo, setImporto] = useState("");
  const [sortDataAsc, setSortDataAsc] = useState(false);
  const [annullaTarget, setAnnullaTarget] = useState<StoricoMovimento | null>(null);
  const [annullaLoading, setAnnullaLoading] = useState(false);
  const [polizzeCollegate, setPolizzeCollegate] = useState<PolizzaCollegataRow[]>([]);
  const [polizzeLoading, setPolizzeLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOrdinanteDebounced(ordinante), 350);
    return () => clearTimeout(t);
  }, [ordinante]);

  // ordinante → server (ilike ordinante|descrizione); importo + cliente → client sul set completo
  const { data: movs = [], isLoading: storicoLoading } = useQuery({
    queryKey: ["mov-bancari", "storico", profileUfficio, seeAll, dal, al, ordinanteDebounced, sortDataAsc],
    queryFn: async () => {
      const contoIds =
        !seeAll && profileUfficio ? await fetchContoIdsForUfficio(profileUfficio) : ([] as string[]);
      const ordTerm = sanitizeIlikeTerm(ordinanteDebounced);
      return fetchAllQueryPages<any>(async (from, to) => {
        let q = supabase.from("movimenti_bancari" as any)
          .select("id, data_movimento, importo, ordinante, descrizione, ufficio_id, conto_bancario_id, cliente:clienti(id, ragione_sociale, nome, cognome), ufficio:uffici(nome:nome_ufficio)")
          .eq("stato", "incassato")
          .order("data_movimento", { ascending: sortDataAsc })
          .order("id", { ascending: sortDataAsc });
        if (!seeAll && profileUfficio) {
          if (contoIds.length > 0) {
            q = q.or(`ufficio_id.eq.${profileUfficio},conto_bancario_id.in.(${contoIds.join(",")})`);
          } else {
            q = q.eq("ufficio_id", profileUfficio);
          }
        }
        if (dal) q = q.gte("data_movimento", dal);
        if (al) q = q.lte("data_movimento", al);
        if (ordTerm) q = q.or(`ordinante.ilike.%${ordTerm}%,descrizione.ilike.%${ordTerm}%`);
        return q.range(from, to);
      });
    },
  });

  const movsFiltrati = useMemo(() => {
    let rows = filterMovimentiByOrdinanteImporto(movs, "", importo);
    if (cliente) {
      const c = cliente.toLowerCase();
      rows = rows.filter((m) => {
        const n = (m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "").toLowerCase();
        return n.includes(c);
      });
    }
    return rows;
  }, [movs, importo, cliente]);

  const exportXlsx = () => {
    const rows = movsFiltrati.map((m: any) => ({
      Data: formatDateIT(m.data_movimento),
      Ordinante: m.ordinante || "",
      Descrizione: m.descrizione || "",
      Cliente: m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "",
      Ufficio: m.ufficio?.nome || "",
      Importo: Number(m.importo) || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Storico");
    XLSX.writeFile(wb, `storico-movimenti-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const apriAnnullaDialog = async (m: StoricoMovimento) => {
    setAnnullaTarget(m);
    setPolizzeCollegate([]);
    setPolizzeLoading(true);
    try {
      const { data: mcs } = await supabase
        .from("movimenti_clienti" as any)
        .select("id")
        .eq("movimento_id", m.id);
      const mcIds = ((mcs as any[]) ?? []).map((r) => r.id);
      if (mcIds.length === 0) {
        setPolizzeCollegate([]);
        return;
      }
      const { data: mps, error } = await supabase
        .from("movimenti_polizze" as any)
        .select("titolo_id, importo, titolo:titoli(numero_titolo, stato)")
        .in("movimento_cliente_id", mcIds)
        .eq("tipo", "polizza");
      if (error) throw error;
      setPolizzeCollegate(
        ((mps as any[]) ?? []).map((r) => ({
          titolo_id: r.titolo_id,
          importo: r.importo,
          numero_titolo: r.titolo?.numero_titolo ?? null,
          stato: r.titolo?.stato ?? null,
        })),
      );
    } catch (e: any) {
      toast.error(e.message ?? "Errore caricamento polizze collegate");
    } finally {
      setPolizzeLoading(false);
    }
  };

  const confermaAnnulla = async () => {
    if (!annullaTarget) return;
    setAnnullaLoading(true);
    try {
      const res = await annullaBonificoCollegato(annullaTarget.id);
      if (!res.ok) {
        toast.error(res.error || "Annullamento fallito");
        return;
      }
      toast.success(
        `Bonifico ripristinato in Da collegare${res.clienteRimosso ? " · cliente pagatore rimosso" : ""} · ${res.titoliAnnullati ?? 0} incass${(res.titoliAnnullati ?? 0) === 1 ? "o" : "i"} annullat${(res.titoliAnnullati ?? 0) === 1 ? "o" : "i"}${(res.titoliSaltati ?? 0) > 0 ? ` · ${res.titoliSaltati} titoli non più presenti` : ""}`,
      );
      setAnnullaTarget(null);
      qc.invalidateQueries({ queryKey: ["mov-bancari"] });
      qc.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      qc.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
      qc.invalidateQueries({ queryKey: ["dashboard-ufficio"] });
    } finally {
      setAnnullaLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <FiltriMovimentiRow
          dal={dal}
          setDal={setDal}
          al={al}
          setAl={setAl}
          ordinante={ordinante}
          setOrdinante={setOrdinante}
          importo={importo}
          setImporto={setImporto}
          sortDataAsc={sortDataAsc}
          setSortDataAsc={setSortDataAsc}
        >
          <div>
            <Label>Cliente</Label>
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cerca…" className="w-56" />
          </div>
          <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="w-3 h-3 mr-1" />Export Excel</Button>
        </FiltriMovimentiRow>
        {!storicoLoading && (
          <p className="text-sm text-muted-foreground pt-2">
            {movsFiltrati.length === 1 ? "1 movimento" : `${movsFiltrati.length} movimenti`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {storicoLoading ? (
          <p className="text-sm py-6 text-center">Caricamento…</p>
        ) : (
        <Table>
          <TableHeader><TableRow>
            <TableHead title="gg/mm/aaaa">Data <span className="font-normal text-muted-foreground text-xs">(gg/mm/aaaa)</span></TableHead>
            <TableHead>Ordinante</TableHead>
            <TableHead>Descrizione</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Ufficio</TableHead><TableHead className="text-right">Importo</TableHead>
            <TableHead className="w-36 text-right">Azioni</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {movsFiltrati.map((m: any, i: number) => (
              <TableRow key={m.id} className={i % 2 ? "bg-muted/30" : ""}>
                <TableCell title="gg/mm/aaaa">{formatDateIT(m.data_movimento)}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{m.ordinante || "—"}</TableCell>
                <TableCell className="text-sm max-w-[240px] truncate" title={m.descrizione || undefined}>{m.descrizione || "—"}</TableCell>
                <TableCell className="text-sm">{m.cliente?.ragione_sociale || [m.cliente?.nome, m.cliente?.cognome].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell className="text-sm">{m.ufficio?.nome ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtEuro(m.importo)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => apriAnnullaDialog(m)}
                  >
                    <Undo2 className="w-3 h-3 mr-1" />
                    Annulla
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {movsFiltrati.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nessun movimento</TableCell></TableRow>}
          </TableBody>
        </Table>
        )}
      </CardContent>

      <AlertDialog open={!!annullaTarget} onOpenChange={(v) => !v && !annullaLoading && setAnnullaTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annulla bonifico collegato</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Verranno annullati gli incassi delle polizze collegate (come «Annulla messa a cassa»), verrà rimosso il cliente pagatore assegnato e il bonifico tornerà in <strong className="text-foreground">Da collegare</strong> come appena importato.
                </p>
                {annullaTarget && (
                  <div className="rounded-md border p-3 space-y-1 text-foreground">
                    <div><span className="text-muted-foreground">Data (gg/mm/aaaa):</span>{" "}
                      <span title="gg/mm/aaaa">{formatDateIT(annullaTarget.data_movimento)}</span>
                    </div>
                    <div><span className="text-muted-foreground">Ordinante:</span> {annullaTarget.ordinante || "—"}</div>
                    <div><span className="text-muted-foreground">Importo:</span> {fmtEuro(annullaTarget.importo)}</div>
                  </div>
                )}
                {polizzeLoading ? (
                  <p>Caricamento polizze collegate…</p>
                ) : polizzeCollegate.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {polizzeCollegate.map((p, idx) => (
                      <li key={p.titolo_id ?? idx}>
                        {p.numero_titolo || p.titolo_id || "Titolo eliminato"} — {fmtEuro(p.importo)}
                        {p.stato ? ` (${p.stato})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-amber-700 dark:text-amber-400">Nessuna polizza collegata trovata: verranno rimossi cliente pagatore e collegamenti, il bonifico tornerà in Da collegare.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={annullaLoading}>Chiudi</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={annullaLoading}
              onClick={(e) => {
                e.preventDefault();
                void confermaAnnulla();
              }}
            >
              {annullaLoading ? "Annullamento…" : "Conferma annullamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default Page;
