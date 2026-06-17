import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  FileEdit,
  Ban,
  RefreshCw,
  Copy,
  Replace,
  PauseCircle,
  PlayCircle,
  XCircle,
  Wallet,
  Undo2,
  Upload,
  FileText,
  Wand2,
  Filter,
  Search,
  Loader2,
  ArrowUp,
  ArrowDown,
  Lock,
} from "lucide-react";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { fmtEuro } from "@/lib/formatCurrency";
import { annullaPolizza } from "@/lib/annullaPolizza";
import { annullaMessaACassa } from "@/lib/annullaMessaACassa";
import { SospensionePolizzaDialog } from "@/components/polizze/SospensionePolizzaDialog";
import { RiattivazionePolizzaDialog } from "@/components/polizze/RiattivazionePolizzaDialog";
import { SostituzionePolizzaDialog } from "@/components/polizze/SostituzionePolizzaDialog";
import { StornoTitoloDialog } from "@/components/polizze/StornoTitoloDialog";
import MessaCassaDialog from "@/components/portafoglio/MessaCassaDialog";
import { DuplicaPolizzaDialog } from "@/components/polizze/azioni/DuplicaPolizzaDialog";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import ServerPagination from "@/components/ServerPagination";
import { useServerPagination } from "@/hooks/useServerPagination";
import { AttivitaRecentiPanel } from "@/components/polizze/azioni/AttivitaRecentiPanel";


type OperazioneKey =
  | "appendice"
  | "storno"
  | "rinnovo"
  | "duplica"
  | "sostituzione"
  | "sospensione"
  | "riattivazione"
  | "annulla"
  | "messa_cassa"
  | "annulla_messa_cassa"
  | "carica_doc"
  | "precontrattuale";

interface Operazione {
  key: OperazioneKey;
  label: string;
  icon: any;
  descrizione: string;
  /** stati polizza filtrati (vuoto = tutti) */
  statiFiltro: string[];
  /** richiede `data_messa_cassa` valorizzata */
  richiedeMessaCassa?: boolean;
  /** richiede `data_messa_cassa` NULL */
  escludeMessaCassa?: boolean;
  adminOnly?: boolean;
}

const OPERAZIONI: Operazione[] = [
  { key: "appendice", label: "Appendice", icon: FileEdit, descrizione: "Aggiungi un'appendice alla polizza", statiFiltro: ["attivo"] },
  { key: "storno", label: "Storno", icon: Ban, descrizione: "Storna premio e quietanze", statiFiltro: ["attivo"] },
  { key: "rinnovo", label: "Rinnovo", icon: RefreshCw, descrizione: "Gestisci il rinnovo della polizza", statiFiltro: ["attivo"] },
  { key: "duplica", label: "Duplica Polizza", icon: Copy, descrizione: "Crea una nuova polizza copiando i dati tecnici", statiFiltro: [] },
  { key: "sostituzione", label: "Sostituzione", icon: Replace, descrizione: "Sostituisci con nuova polizza/numero", statiFiltro: ["attivo"] },
  { key: "sospensione", label: "Sospensione", icon: PauseCircle, descrizione: "Sospendi temporaneamente la polizza", statiFiltro: ["attivo"] },
  { key: "riattivazione", label: "Riattivazione", icon: PlayCircle, descrizione: "Riattiva una polizza sospesa", statiFiltro: ["sospeso"] },
  { key: "annulla", label: "Annulla Polizza", icon: XCircle, descrizione: "Annullamento totale con cascade", statiFiltro: [], adminOnly: true },
  { key: "messa_cassa", label: "Messa a Cassa", icon: Wallet, descrizione: "Incassa e contabilizza la polizza", statiFiltro: ["attivo"], escludeMessaCassa: true },
  { key: "annulla_messa_cassa", label: "Annulla Messa a Cassa", icon: Undo2, descrizione: "Annulla la messa a cassa", statiFiltro: [], richiedeMessaCassa: true, adminOnly: true },
  { key: "carica_doc", label: "Carica Documenti", icon: Upload, descrizione: "Carica documenti collegati alla polizza", statiFiltro: [] },
  { key: "precontrattuale", label: "Genera Precontrattuale", icon: FileText, descrizione: "Genera la documentazione precontrattuale", statiFiltro: [] },
];

const STATI_OPTIONS = ["", "attivo", "sospeso", "scaduto", "incassato", "annullato", "stornato"];

const GestionePolizzePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [opKey, setOpKey] = useState<OperazioneKey | null>(null);
  const [search, setSearch] = useState("");
  const [statoFilter, setStatoFilter] = useState<string>("");
  const [scadDal, setScadDal] = useState("");
  const [scadAl, setScadAl] = useState("");

  // dialog state
  const [target, setTarget] = useState<{ id: string; numero: string } | null>(null);
  const [sospensioneOpen, setSospensioneOpen] = useState(false);
  const [riattivazioneOpen, setRiattivazioneOpen] = useState(false);
  const [sostituzioneOpen, setSostituzioneOpen] = useState(false);
  const [stornoOpen, setStornoOpen] = useState(false);
  const [duplicaOpen, setDuplicaOpen] = useState(false);
  const [messaCassaOpen, setMessaCassaOpen] = useState(false);
  const [messaCassaTitolo, setMessaCassaTitolo] = useState<any | null>(null);
  const [annullaConfirm, setAnnullaConfirm] = useState(false);
  const [annullaMCConfirm, setAnnullaMCConfirm] = useState(false);
  const [annullaLoading, setAnnullaLoading] = useState(false);

  const operazione = useMemo(() => OPERAZIONI.find((o) => o.key === opKey) || null, [opKey]);

  // pre-imposta filtro stato in base all'operazione
  const statiAttivi = useMemo(() => {
    if (!operazione) return [] as string[];
    if (statoFilter) return [statoFilter];
    return operazione.statiFiltro;
  }, [operazione, statoFilter]);

  const { data: polizze, isFetching } = useQuery({
    queryKey: ["gestione-polizze", opKey, search, statiAttivi.join(","), scadDal, scadAl],
    enabled: !!opKey,
    queryFn: async () => {
      let q = supabase
        .from("v_portafoglio_titoli")
        .select(
          "id, numero_titolo, compagnia_nome, ramo_nome, cliente_nome_display, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, data_messa_cassa, ufficio_id, sostituisce_polizza",
        )
        .order("data_scadenza", { ascending: true })
        .limit(25);

      if (statiAttivi.length > 0) q = q.in("stato", statiAttivi);
      if (operazione?.richiedeMessaCassa) q = q.not("data_messa_cassa", "is", null);
      if (operazione?.escludeMessaCassa) q = q.is("data_messa_cassa", null);
      if (scadDal) q = q.gte("data_scadenza", scadDal);
      if (scadAl) q = q.lte("data_scadenza", scadAl);
      if (search.trim()) {
        const s = search.trim();
        q = q.or(`numero_titolo.ilike.%${s}%,cliente_nome_display.ilike.%${s}%,compagnia_nome.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const handleSelect = (op: OperazioneKey) => {
    setOpKey(op);
    setSearch("");
    setStatoFilter("");
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["gestione-polizze"] });
    queryClient.invalidateQueries({ queryKey: ["titoli"] });
    queryClient.invalidateQueries({ queryKey: ["v_portafoglio_titoli"] });
  };

  const esegui = (row: any) => {
    if (!operazione) return;
    if (operazione.adminOnly && !isAdmin) {
      toast.error("Operazione riservata agli amministratori");
      return;
    }
    const t = { id: row.id, numero: row.numero_titolo || row.id.slice(0, 8) };
    setTarget(t);

    switch (operazione.key) {
      case "appendice":
        navigate(`/portafoglio/appendici?titoloId=${row.id}`);
        return;
      case "rinnovo":
        navigate(`/portafoglio/rinnovi?titoloId=${row.id}`);
        return;
      case "precontrattuale":
        navigate(`/portafoglio/doc-precontrattuale?titoloId=${row.id}`);
        return;
      case "carica_doc":
        navigate(`/titoli/${row.id}?tab=documenti`);
        return;
      case "duplica":
        setDuplicaOpen(true);
        return;
      case "storno":
        setStornoOpen(true);
        return;
      case "sospensione":
        setSospensioneOpen(true);
        return;
      case "riattivazione":
        setRiattivazioneOpen(true);
        return;
      case "sostituzione":
        setSostituzioneOpen(true);
        return;
      case "messa_cassa":
        setMessaCassaTitolo(row);
        setMessaCassaOpen(true);
        return;
      case "annulla":
        setAnnullaConfirm(true);
        return;
      case "annulla_messa_cassa":
        setAnnullaMCConfirm(true);
        return;
    }
  };

  const confermaAnnulla = async () => {
    if (!target) return;
    setAnnullaLoading(true);
    try {
      const res = await annullaPolizza(target.id);
      if (res.ok) {
        toast.success("Polizza annullata");
        refreshAll();
      } else {
        toast.error(res.error || "Errore annullamento");
      }
    } finally {
      setAnnullaLoading(false);
      setAnnullaConfirm(false);
    }
  };

  const confermaAnnullaMC = async () => {
    if (!target) return;
    setAnnullaLoading(true);
    try {
      const res = await annullaMessaACassa(target.id);
      if (res.ok) {
        toast.success("Messa a cassa annullata");
        refreshAll();
      } else {
        toast.error(res.error || "Errore annullamento messa a cassa");
      }
    } finally {
      setAnnullaLoading(false);
      setAnnullaMCConfirm(false);
    }
  };

  const visibleOps = OPERAZIONI.filter((o) => isAdmin || !o.adminOnly);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-teal-600" />
          Gestione Polizze
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scegli l'operazione, filtra cliente/polizza ed esegui. Le azioni sono identiche a quelle disponibili
          dalla scheda polizza.
        </p>
      </div>

      <PolizzaSection title="1. Scegli operazione" icon={Wand2} defaultOpen>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleOps.map((op) => {
            const Icon = op.icon;
            const active = op.key === opKey;
            return (
              <button
                key={op.key}
                type="button"
                onClick={() => handleSelect(op.key)}
                className={`text-left rounded-lg border p-3 transition hover:border-teal-600 hover:shadow-sm ${
                  active ? "border-teal-600 bg-teal-50 dark:bg-teal-950/30 ring-1 ring-teal-600" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${active ? "text-teal-600" : "text-muted-foreground"}`} />
                  <span className="font-semibold text-sm">{op.label}</span>
                  {op.adminOnly && (
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      admin
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{op.descrizione}</p>
              </button>
            );
          })}
        </div>
      </PolizzaSection>

      {operazione && (
        <>
          <PolizzaSection title="2. Filtra polizza" icon={Filter} defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label>Cerca (N° polizza, cliente, compagnia)</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Almeno 2 caratteri..."
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Stato</Label>
                <select
                  value={statoFilter}
                  onChange={(e) => setStatoFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATI_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s ? s : `Default (${operazione.statiFiltro.join(", ") || "tutti"})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Scad. dal</Label>
                  <Input type="date" value={scadDal} onChange={(e) => setScadDal(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>al</Label>
                  <Input type="date" value={scadAl} onChange={(e) => setScadAl(e.target.value)} />
                </div>
              </div>
            </div>
          </PolizzaSection>

          <PolizzaSection title={`3. Risultati — ${operazione.label}`} icon={operazione.icon} defaultOpen>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Polizza</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Compagnia</TableHead>
                      <TableHead>Ramo</TableHead>
                      <TableHead>Decorr.</TableHead>
                      <TableHead>Scad.</TableHead>
                      <TableHead className="text-right">Premio</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isFetching && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                          Caricamento...
                        </TableCell>
                      </TableRow>
                    )}
                    {!isFetching && (polizze?.length ?? 0) === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground">
                          Nessuna polizza corrisponde ai filtri impostati.
                        </TableCell>
                      </TableRow>
                    )}
                    {!isFetching &&
                      polizze?.map((p: any, idx: number) => (
                        <TableRow key={p.id} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                          <TableCell className="font-mono text-xs">
                            <button
                              type="button"
                              onClick={() => navigate(`/titoli/${p.id}`)}
                              className="text-teal-700 hover:underline"
                            >
                              {p.numero_titolo || p.id.slice(0, 8)}
                            </button>
                            {p.sostituisce_polizza && (
                              <Badge variant="outline" className="ml-1 text-[10px]">
                                quietanza
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                          <TableCell>{p.compagnia_nome || "—"}</TableCell>
                          <TableCell>{p.ramo_nome || "—"}</TableCell>
                          <TableCell className="text-xs">{p.garanzia_da || "—"}</TableCell>
                          <TableCell className="text-xs">{p.data_scadenza || p.garanzia_a || "—"}</TableCell>
                          <TableCell className="text-right text-xs">
                            {p.premio_lordo != null ? fmtEuro(Number(p.premio_lordo)) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {p.stato}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => esegui(p)} className="gap-1">
                              <operazione.icon className="w-3.5 h-3.5" />
                              Esegui
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {(polizze?.length ?? 0) >= 25 && (
              <p className="text-xs text-muted-foreground mt-2">
                Mostrate le prime 25 polizze. Affina i filtri per restringere la ricerca.
              </p>
            )}
          </PolizzaSection>
        </>
      )}

      {/* Dialogs */}
      {target && (
        <>
          <StornoTitoloDialog
            open={stornoOpen}
            onOpenChange={setStornoOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <SospensionePolizzaDialog
            open={sospensioneOpen}
            onOpenChange={setSospensioneOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <RiattivazionePolizzaDialog
            open={riattivazioneOpen}
            onOpenChange={setRiattivazioneOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <SostituzionePolizzaDialog
            open={sostituzioneOpen}
            onOpenChange={setSostituzioneOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
          <DuplicaPolizzaDialog
            open={duplicaOpen}
            onOpenChange={setDuplicaOpen}
            titoloId={target.id}
            numeroPolizza={target.numero}
            onDone={refreshAll}
          />
        </>
      )}

      {messaCassaTitolo && (
        <MessaCassaDialog
          open={messaCassaOpen}
          onOpenChange={setMessaCassaOpen}
          titoli={[
            {
              id: messaCassaTitolo.id,
              numero_titolo: messaCassaTitolo.numero_titolo,
              premio_lordo: messaCassaTitolo.premio_lordo,
              cliente_anagrafica_id: messaCassaTitolo.cliente_anagrafica_id,
              ufficio_id: messaCassaTitolo.ufficio_id,
            },
          ]}
          onSuccess={refreshAll}
        />
      )}

      <AlertDialog open={annullaConfirm} onOpenChange={setAnnullaConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare la polizza {target?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              L'annullamento esegue il cascade-delete di provvigioni (anche pagate), rimesse, movimenti e
              quietanze. Il titolo resta in stato "annullato" come ancora per il log. Operazione irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={annullaLoading}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confermaAnnulla();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={annullaLoading}
            >
              {annullaLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Conferma annullamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={annullaMCConfirm} onOpenChange={setAnnullaMCConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare la messa a cassa di {target?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              La polizza tornerà in stato "attivo" e i dati di incasso verranno azzerati. Le compensazioni e i
              movimenti contabili collegati verranno rimossi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={annullaLoading}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confermaAnnullaMC();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={annullaLoading}
            >
              {annullaLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GestionePolizzePage;
