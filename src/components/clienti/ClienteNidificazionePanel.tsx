import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { useTitoliNidificazione } from "@/hooks/useLookupTables";
import {
  CATEGORIA_LABEL,
  clienteDisplayName,
  findTitolo,
  formatNidificazionePhrase,
  wouldCreateCycle,
  type ClienteNidificazioneLite,
  type RelazioneNidificazione,
} from "@/lib/nidificazione";

type Props = {
  clienteId: string;
  cliente: ClienteNidificazioneLite;
  compact?: boolean;
  readOnly?: boolean;
};

export default function ClienteNidificazionePanel({ clienteId, cliente, compact, readOnly }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: titoli = [] } = useTitoliNidificazione();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [tipo, setTipo] = useState("");
  const [note, setNote] = useState("");

  const { data: relazioni = [] } = useQuery({
    queryKey: ["relazioni_cliente", clienteId],
    queryFn: async () => {
      const { data: rel1, error: e1 } = await supabase
        .from("clienti_relazioni")
        .select("id, tipo_relazione, note, cliente_id, cliente_collegato_id, clienti_collegato:clienti!clienti_relazioni_cliente_collegato_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale, gruppo_statistico)")
        .eq("cliente_id", clienteId);
      if (e1) throw e1;
      const { data: rel2, error: e2 } = await supabase
        .from("clienti_relazioni")
        .select("id, tipo_relazione, note, cliente_id, cliente_collegato_id, clienti_origine:clienti!clienti_relazioni_cliente_id_fkey(id, tipo_cliente, nome, cognome, ragione_sociale, gruppo_statistico)")
        .eq("cliente_collegato_id", clienteId);
      if (e2) throw e2;
      const rows: {
        id: string;
        tipo_relazione: string;
        note: string | null;
        verso: "out" | "in";
        altro: ClienteNidificazioneLite;
        raw: RelazioneNidificazione;
      }[] = [];
      type RelOut = RelazioneNidificazione & { clienti_collegato: ClienteNidificazioneLite };
      type RelIn = RelazioneNidificazione & { clienti_origine: ClienteNidificazioneLite };
      ((rel1 || []) as RelOut[]).forEach((r) => {
        rows.push({
          id: r.id,
          tipo_relazione: r.tipo_relazione,
          note: r.note ?? null,
          verso: "out",
          altro: r.clienti_collegato,
          raw: {
            id: r.id,
            cliente_id: r.cliente_id,
            cliente_collegato_id: r.cliente_collegato_id,
            tipo_relazione: r.tipo_relazione,
            note: r.note,
          },
        });
      });
      ((rel2 || []) as RelIn[]).forEach((r) => {
        rows.push({
          id: r.id,
          tipo_relazione: r.tipo_relazione,
          note: r.note ?? null,
          verso: "in",
          altro: r.clienti_origine,
          raw: {
            id: r.id,
            cliente_id: r.cliente_id,
            cliente_collegato_id: r.cliente_collegato_id,
            tipo_relazione: r.tipo_relazione,
            note: r.note,
          },
        });
      });
      return rows;
    },
    enabled: !!clienteId,
  });

  const { data: searchHits = [], isFetching: searchLoading } = useQuery({
    queryKey: ["clienti_search_nidif", search],
    queryFn: async () => {
      const q = search.replace(/[,()]/g, " ").trim();
      if (q.length < 2) return [];
      const { data, error } = await supabase
        .from("clienti")
        .select("id, tipo_cliente, nome, cognome, ragione_sociale, codice_fiscale, gruppo_statistico")
        .neq("id", clienteId)
        .or(`cognome.ilike.%${q}%,nome.ilike.%${q}%,ragione_sociale.ilike.%${q}%,codice_fiscale.ilike.%${q}%`)
        .limit(25);
      if (error) throw error;
      return (data || []) as ClienteNidificazioneLite[];
    },
    enabled: search.trim().length >= 2,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!selectedId || !tipo) throw new Error("Seleziona cliente e titolo");
      const existing = relazioni.map((r) => r.raw);
      if (wouldCreateCycle(clienteId, selectedId, existing)) {
        throw new Error("Questo collegamento creerebbe un ciclo nella nidificazione");
      }
      const { error } = await supabase.from("clienti_relazioni").insert({
        cliente_id: clienteId,
        cliente_collegato_id: selectedId,
        tipo_relazione: tipo,
        note: note.trim() || null,
      });
      if (error) throw error;

      const altro = searchHits.find((c) => c.id === selectedId);
      if (altro?.gruppo_statistico && !cliente.gruppo_statistico) {
        await supabase.from("clienti").update({ gruppo_statistico: altro.gruppo_statistico }).eq("id", clienteId);
      } else if (cliente.gruppo_statistico && altro && !altro.gruppo_statistico) {
        await supabase.from("clienti").update({ gruppo_statistico: cliente.gruppo_statistico }).eq("id", selectedId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relazioni_cliente", clienteId] });
      qc.invalidateQueries({ queryKey: ["cliente", clienteId] });
      setOpen(false);
      setSearch("");
      setSelectedId("");
      setNote("");
      toast.success("Nidificazione aggiunta");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clienti_relazioni").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relazioni_cliente", clienteId] });
      toast.success("Collegamento rimosso");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const titoloOptions = titoli.map((t) => ({
    value: t.codice,
    label: t.descrizione,
    description: CATEGORIA_LABEL[t.categoria],
    searchText: `${t.descrizione} ${t.categoria} ${t.codice}`,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <span className={compact ? "text-sm font-medium" : "font-semibold"}>Nidificazione</span>
          <Badge variant="outline">{relazioni.length}</Badge>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-3 h-3 mr-1" /> Collega cliente
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Questo cliente è [titolo] di un altro cliente in anagrafica. Es. sindaco di Comune di Varese, figlio di Gianni.
      </p>

      {relazioni.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">Nessun collegamento di nidificazione.</p>
      ) : compact ? (
        <ul className="space-y-1">
          {relazioni.map((r) => {
            const titolo = findTitolo(r.tipo_relazione, titoli);
            const phrase = r.verso === "out"
              ? formatNidificazionePhrase(cliente, titolo, r.altro)
              : formatNidificazionePhrase(r.altro, titolo, cliente);
            return (
              <li key={r.id} className="flex items-start justify-between gap-2 text-sm">
                <button type="button" className="text-left hover:underline" onClick={() => navigate(`/archivi/clienti/${r.altro.id}`)}>
                  {phrase}
                </button>
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(r.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nidificazione</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Note</TableHead>
              {!readOnly && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {relazioni.map((r) => {
              const titolo = findTitolo(r.tipo_relazione, titoli);
              const phrase = r.verso === "out"
                ? formatNidificazionePhrase(cliente, titolo, r.altro)
                : formatNidificazionePhrase(r.altro, titolo, cliente);
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => navigate(`/archivi/clienti/${r.altro.id}`)}>
                      {phrase}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{titolo ? CATEGORIA_LABEL[titolo.categoria] : r.tipo_relazione}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.note || "—"}</TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collega nidificazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Questo cliente è…</Label>
              <SearchableSelect
                options={titoloOptions}
                value={tipo}
                onValueChange={setTipo}
                placeholder="Titolo (sindaco, figlio, …)"
                className="w-full mt-1"
                showSelectedDescription
              />
            </div>
            <div>
              <Label>… di questo cliente</Label>
              <SearchableSelect
                className="w-full mt-1"
                options={searchHits.map((c) => ({
                  value: c.id,
                  label: clienteDisplayName(c),
                  description: c.gruppo_statistico || undefined,
                }))}
                value={selectedId}
                onValueChange={setSelectedId}
                placeholder="Cerca in anagrafica…"
                searchPlaceholder="Digita almeno 2 caratteri…"
                searchValue={search}
                onSearchChange={setSearch}
                serverSideSearch
                emptyText={searchLoading ? "Ricerca in corso…" : "Nessun cliente trovato."}
              />
            </div>
            <div>
              <Label>Note (opzionale)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => add.mutate()} disabled={!selectedId || !tipo || add.isPending}>
              Collega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
