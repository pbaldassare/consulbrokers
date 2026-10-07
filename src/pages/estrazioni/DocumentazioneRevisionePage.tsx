import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, CheckCheck, ExternalLink, FileCheck, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useDebouncedClienteSearch } from "@/hooks/useClienteSearch";
import ServerPagination from "@/components/ServerPagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FiltroVerifica = "tutti" | "verificati" | "non_verificati";
type Fonte = "documenti" | "trattativa_documenti" | "compagnia_rapporto_documenti" | "document_library" | "documenti_utenti";

type DocRevisione = {
  fonte: Fonte;
  id: string;
  nome_file: string | null;
  path_storage: string | null;
  bucket_name: string | null;
  categoria: string | null;
  entita_tipo: string | null;
  entita_id: string | null;
  titolo_id: string | null;
  sinistro_id: string | null;
  cliente_id: string | null;
  numero_polizza: string | null;
  numero_sinistro: string | null;
  prospect_nome: string | null;
  caricato_da_cliente: boolean | null;
  created_at: string;
  verificato: boolean;
  verificato_il: string | null;
  cliente_nome: string | null;
  garanzie: string | null;
  gruppo_ramo: string | null;
  compagnia_nome: string | null;
  sede_nome: string | null;
  caricato_da_nome: string | null;
  verificato_da_nome: string | null;
};

const FONTE_LABEL: Record<Fonte, string> = {
  documenti: "Archivio documenti",
  trattativa_documenti: "Trattativa",
  compagnia_rapporto_documenti: "Rapporto agenzia",
  document_library: "Documentale",
  documenti_utenti: "Documenti utente",
};

const ENTITA_LABEL: Record<string, string> = {
  titolo: "Polizza",
  cliente: "Cliente",
  sinistro: "Sinistro",
  prospect: "Prospect",
  trattativa: "Trattativa",
  rapporto: "Rapporto agenzia",
  agenzia: "Agenzia",
  compagnia: "Compagnia",
  sede: "Sede",
  anagrafica_professionale: "Anagrafica professionale",
  archivio: "Documentale",
  utente: "Utente",
};

const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm");
  } catch {
    return iso;
  }
};

const db = supabase as unknown as SupabaseClient;

const erroreMsg = (e: unknown) => (e as { message?: string } | null)?.message || "Errore nel salvataggio";

const rowKey = (d: Pick<DocRevisione, "fonte" | "id">) => `${d.fonte}:${d.id}`;

const escapeIlike = (s: string) => s.replace(/[%_,()]/g, " ").trim();

async function setVerificato(fonte: Fonte, ids: string[], verificato: boolean) {
  const { error } = await db.rpc("set_documento_verificato", {
    p_fonte: fonte,
    p_ids: ids,
    p_verificato: verificato,
  });
  if (error) throw error;
}

async function apriDocumento(d: DocRevisione) {
  if (!d.path_storage) {
    toast.error("File non disponibile");
    return;
  }
  if (/^https?:\/\//i.test(d.path_storage)) {
    const m = d.path_storage.match(/document-library\/(.+)$/);
    if (m) {
      const { data } = await supabase.storage.from("document-library").createSignedUrl(m[1], 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
        return;
      }
    }
    window.open(d.path_storage, "_blank");
    return;
  }
  const { data, error } = await supabase.storage
    .from(d.bucket_name || "documenti_generali")
    .createSignedUrl(d.path_storage, 300);
  if (error || !data?.signedUrl) {
    toast.error("Impossibile aprire il documento");
    return;
  }
  window.open(data.signedUrl, "_blank");
}

const DocumentazioneRevisionePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroVerifica>("non_verificati");
  const [fonte, setFonte] = useState<"tutte" | Fonte>("tutte");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedClienteSearch(search, 350);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const { page, setPage, pageSize, range } = useServerPagination(25, [filtro, fonte, debouncedSearch]);

  const queryKey = ["documenti-revisione", filtro, fonte, debouncedSearch, page];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = db
        .from("v_documenti_revisione")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(range.from, range.to);
      if (filtro === "verificati") q = q.eq("verificato", true);
      if (filtro === "non_verificati") q = q.eq("verificato", false);
      if (fonte !== "tutte") q = q.eq("fonte", fonte);
      const s = escapeIlike(debouncedSearch);
      if (s) {
        const like = `%${s}%`;
        q = q.or(
          [
            `cliente_nome.ilike.${like}`,
            `numero_polizza.ilike.${like}`,
            `nome_file.ilike.${like}`,
            `numero_sinistro.ilike.${like}`,
            `garanzie.ilike.${like}`,
            `compagnia_nome.ilike.${like}`,
            `prospect_nome.ilike.${like}`,
          ].join(","),
        );
      }
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as DocRevisione[], count: (count ?? 0) as number };
    },
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.count ?? 0;

  const invalida = () => queryClient.invalidateQueries({ queryKey: ["documenti-revisione"] });

  const toggleVerificato = async (d: DocRevisione, value: boolean) => {
    const k = rowKey(d);
    setSaving((prev) => new Set(prev).add(k));
    try {
      await setVerificato(d.fonte, [d.id], value);
      queryClient.setQueryData(queryKey, (old: typeof data) =>
        old
          ? { ...old, rows: old.rows.map((r) => (rowKey(r) === k ? { ...r, verificato: value } : r)) }
          : old,
      );
      toast.success(value ? "Documento verificato" : "Verifica rimossa");
      invalida();
    } catch (e) {
      toast.error(erroreMsg(e));
    } finally {
      setSaving((prev) => {
        const n = new Set(prev);
        n.delete(k);
        return n;
      });
    }
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      rows.forEach((r) => (checked ? n.add(rowKey(r)) : n.delete(rowKey(r))));
      return n;
    });
  };

  const toggleOne = (d: DocRevisione, checked: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(rowKey(d));
      else n.delete(rowKey(d));
      return n;
    });
  };

  const bulkSet = async (value: boolean) => {
    const perFonte = new Map<Fonte, string[]>();
    selected.forEach((k) => {
      const [f, id] = k.split(":") as [Fonte, string];
      perFonte.set(f, [...(perFonte.get(f) ?? []), id]);
    });
    if (perFonte.size === 0) return;
    setBulkSaving(true);
    try {
      for (const [f, ids] of perFonte) await setVerificato(f, ids, value);
      toast.success(`${selected.size} documenti ${value ? "verificati" : "segnati come non verificati"}`);
      setSelected(new Set());
      invalida();
    } catch (e) {
      toast.error(erroreMsg(e));
    } finally {
      setBulkSaving(false);
    }
  };

  const riferimento = (d: DocRevisione) => {
    if (d.sinistro_id) {
      return (
        <Link to={`/sinistri/${d.sinistro_id}`} className="text-primary hover:underline">
          Sinistro {d.numero_sinistro || ""}
        </Link>
      );
    }
    if (d.entita_tipo === "prospect" && d.prospect_nome) {
      return <span>Prospect {d.prospect_nome}</span>;
    }
    return <span>{(d.entita_tipo && ENTITA_LABEL[d.entita_tipo]) || FONTE_LABEL[d.fonte]}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/portafoglio/estrazioni-stampe")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-primary" />
            Documentazione da revisionare
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tutti i documenti caricati in CBnet. Spunta «Verificato» per segnarli come controllati.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              value={filtro}
              onValueChange={(v) => v && setFiltro(v as FiltroVerifica)}
              variant="outline"
            >
              <ToggleGroupItem value="tutti">Tutti</ToggleGroupItem>
              <ToggleGroupItem value="verificati">Verificati</ToggleGroupItem>
              <ToggleGroupItem value="non_verificati">Non verificati</ToggleGroupItem>
            </ToggleGroup>

            <Select value={fonte} onValueChange={(v) => setFonte(v as "tutte" | Fonte)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutte">Tutte le provenienze</SelectItem>
                {(Object.keys(FONTE_LABEL) as Fonte[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {FONTE_LABEL[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca cliente, polizza, garanzia, agenzia, file…"
                className="pl-8"
              />
            </div>

            <span className="text-sm text-muted-foreground">
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `${totalCount} documenti`}
            </span>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <span className="text-sm">{selected.size} selezionati</span>
              <Button size="sm" onClick={() => bulkSet(true)} disabled={bulkSaving}>
                <CheckCheck className="w-4 h-4 mr-1" /> Segna verificati
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSet(false)} disabled={bulkSaving}>
                Segna non verificati
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkSaving}>
                Annulla selezione
              </Button>
            </div>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(c === true)} />
                  </TableHead>
                  <TableHead>Verificato</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Numero polizza</TableHead>
                  <TableHead>Garanzie</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Agenzia</TableHead>
                  <TableHead>Sede</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Riferimento</TableHead>
                  <TableHead>Caricato da</TableHead>
                  <TableHead>Caricato il</TableHead>
                  <TableHead>Verificato da</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      Nessun documento trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((d) => {
                    const k = rowKey(d);
                    return (
                      <TableRow key={k}>
                        <TableCell>
                          <Checkbox checked={selected.has(k)} onCheckedChange={(c) => toggleOne(d, c === true)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={d.verificato}
                              disabled={saving.has(k)}
                              onCheckedChange={(c) => toggleVerificato(d, c === true)}
                              aria-label="Verificato"
                            />
                            {d.verificato ? (
                              <Badge variant="default" className="bg-green-600 hover:bg-green-600">Sì</Badge>
                            ) : (
                              <Badge variant="outline">No</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          {d.cliente_id ? (
                            <Link to={`/clienti/${d.cliente_id}`} className="text-primary hover:underline">
                              {d.cliente_nome || "—"}
                            </Link>
                          ) : (
                            d.cliente_nome || d.prospect_nome || "—"
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {d.titolo_id ? (
                            <Link to={`/titoli/${d.titolo_id}`} className="text-primary hover:underline">
                              {d.numero_polizza || "—"}
                            </Link>
                          ) : (
                            d.numero_polizza || "—"
                          )}
                        </TableCell>
                        <TableCell className="min-w-[180px] max-w-[280px] text-xs">{d.garanzie || "—"}</TableCell>
                        <TableCell className="text-xs">{d.gruppo_ramo || "—"}</TableCell>
                        <TableCell className="min-w-[140px] text-xs">{d.compagnia_nome || "—"}</TableCell>
                        <TableCell className="text-xs">{d.sede_nome || "—"}</TableCell>
                        <TableCell className="min-w-[200px]">
                          <button
                            type="button"
                            onClick={() => apriDocumento(d)}
                            className="text-left text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <span className="break-all">{d.nome_file || "documento"}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </button>
                          {d.caricato_da_cliente && (
                            <Badge variant="secondary" className="ml-1 text-[10px]">dal cliente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{d.categoria || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{riferimento(d)}</TableCell>
                        <TableCell className="text-xs">{d.caricato_da_nome || "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(d.created_at)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {d.verificato ? (
                            <>
                              {d.verificato_da_nome || "—"}
                              <div className="text-muted-foreground">{fmtDateTime(d.verificato_il)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentazioneRevisionePage;
