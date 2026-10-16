import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronDown, ChevronRight, ClipboardList, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isRootAdminEmail } from "@/lib/adminAccountGuard";
import { labelOperazioneLog, statoLogAttivita, type LogAttivitaStato } from "@/lib/logAttivitaStato";
import { registroEntitaLabel, registroEntitaPath } from "@/lib/registroAttivitaEntityLink";
import { useServerPagination } from "@/hooks/useServerPagination";
import { PageContainer } from "@/components/shared/PageContainer";
import ServerPagination from "@/components/ServerPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/contabilita/DatePicker";
import { combineRegistroDateTime } from "@/lib/registroAttivitaDateTime";

type LogSeverity = "info" | "warning" | "critical";

type LogRow = {
  id: string;
  created_at: string | null;
  azione: string | null;
  severity: string;
  entita_tipo: string | null;
  entita_id: string | null;
  dettagli_json: unknown;
  user_id: string | null;
  esito_fallita: boolean | null;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

const SEVERITY_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warning: "outline",
  critical: "destructive",
};

function fmtUtente(row: LogRow): string {
  const nome = `${row.nome ?? ""} ${row.cognome ?? ""}`.trim();
  if (nome) return row.email ? `${nome} (${row.email})` : nome;
  if (row.email) return row.email;
  return row.user_id ? row.user_id.slice(0, 8) : "—";
}

export default function RegistroAttivitaPage() {
  const { profile } = useAuth();
  const [filtroUtente, setFiltroUtente] = useState<string>("all");
  const [filtroAzione, setFiltroAzione] = useState("");
  const [filtroStato, setFiltroStato] = useState<"all" | LogAttivitaStato>("all");
  const [filtroGravita, setFiltroGravita] = useState<"all" | LogSeverity>("all");
  const [dataDa, setDataDa] = useState<Date | undefined>();
  const [oraDa, setOraDa] = useState("");
  const [dataA, setDataA] = useState<Date | undefined>();
  const [oraA, setOraA] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tsDaIso = combineRegistroDateTime(dataDa, oraDa, "da");
  const tsAIso = combineRegistroDateTime(dataA, oraA, "a");

  const { page, setPage, pageSize } = useServerPagination(50, [
    filtroUtente,
    filtroAzione,
    filtroStato,
    filtroGravita,
    tsDaIso,
    tsAIso,
  ]);

  const { data: utentiStaff = [] } = useQuery({
    queryKey: ["registro_attivita_utenti"],
    staleTime: 5 * 60_000,
    enabled: isRootAdminEmail(profile?.email),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, cognome, email")
        .neq("ruolo", "cliente")
        .neq("ruolo", "prospect")
        .order("cognome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "registro_attivita",
      page,
      filtroUtente,
      filtroAzione,
      filtroStato,
      filtroGravita,
      tsDaIso,
      tsAIso,
    ],
    enabled: isRootAdminEmail(profile?.email),
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const az = filtroAzione.trim();
      const { data: rpcRows, error } = await supabase.rpc("registro_log_attivita_page", {
        p_page_size: pageSize,
        p_page: page,
        p_user_id: filtroUtente === "all" ? null : filtroUtente,
        p_azione: az || null,
        p_da: tsDaIso,
        p_a: tsAIso,
        p_stato: filtroStato === "all" ? null : filtroStato,
        p_gravita: filtroGravita === "all" ? null : filtroGravita,
      });
      if (error) throw error;
      const list = (rpcRows ?? []) as (LogRow & { total_count: number })[];
      const count = list[0]?.total_count ?? 0;
      return { rows: list as LogRow[], count: Number(count) };
    },
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.count ?? 0;

  const subtitle = useMemo(
    () =>
      isFetching && !isLoading
        ? "Aggiornamento…"
        : `${totalCount.toLocaleString("it-IT")} eventi in log_attivita`,
    [totalCount, isFetching, isLoading],
  );

  if (!isRootAdminEmail(profile?.email)) {
    return (
      <PageContainer>
        <p className="text-sm text-muted-foreground">Sezione riservata ad admin@consul.it.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="full" className="min-w-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ClipboardList className="h-7 w-7" />
            Registro attività
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tutte le azioni registrate in CBnet (tabella log_attivita). {subtitle}
          </p>
        </div>
      </div>

      <div className="mb-4 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="space-y-2">
          <Label>Utente</Label>
          <Select value={filtroUtente} onValueChange={setFiltroUtente}>
            <SelectTrigger>
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli utenti</SelectItem>
              {utentiStaff.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {`${u.cognome ?? ""} ${u.nome ?? ""}`.trim() || u.email || u.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Azione</Label>
          <Input
            value={filtroAzione}
            onChange={(e) => setFiltroAzione(e.target.value)}
            placeholder="Es. messa_cassa, titolo_modificato…"
          />
        </div>
        <div className="space-y-2">
          <Label>Stato</Label>
          <Select
            value={filtroStato}
            onValueChange={(v) => setFiltroStato(v as "all" | LogAttivitaStato)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="RIUSCITA">RIUSCITA</SelectItem>
              <SelectItem value="FALLITA">FALLITA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Gravità</Label>
          <Select
            value={filtroGravita}
            onValueChange={(v) => setFiltroGravita(v as "all" | LogSeverity)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tutte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              <SelectItem value="info">info</SelectItem>
              <SelectItem value="warning">warning</SelectItem>
              <SelectItem value="critical">critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label>Timestamp da (data e ora)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              value={dataDa ?? null}
              onChange={(d) => setDataDa(d ?? undefined)}
              placeholder="Data"
              className="w-[140px]"
            />
            <Input
              type="time"
              step={1}
              value={oraDa}
              onChange={(e) => setOraDa(e.target.value)}
              className="w-[130px]"
              aria-label="Ora inizio"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Se l&apos;ora è vuota: inizio giornata (00:00:00).
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label>Timestamp a (data e ora)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              value={dataA ?? null}
              onChange={(d) => setDataA(d ?? undefined)}
              placeholder="Data"
              className="w-[140px]"
            />
            <Input
              type="time"
              step={1}
              value={oraA}
              onChange={(e) => setOraA(e.target.value)}
              className="w-[130px]"
              aria-label="Ora fine"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Se l&apos;ora è vuota: fine giornata (23:59:59).
          </p>
        </div>
      </div>

      <div className="w-full min-w-0 rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Caricamento log…
          </div>
        ) : (
          <>
            <Table className="min-w-0 table-fixed" containerClassName="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 px-2" />
                  <TableHead className="w-[12%]">Timestamp</TableHead>
                  <TableHead className="w-[18%]">Utente</TableHead>
                  <TableHead className="w-[32%]">Operazione</TableHead>
                  <TableHead className="w-[9%]">Stato</TableHead>
                  <TableHead className="w-[9%]">Gravità</TableHead>
                  <TableHead className="w-[14%]">Entità</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      Nessun log con i filtri selezionati.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const stato = statoLogAttivita(row.dettagli_json, row.severity, row.esito_fallita);
                    const entPath = registroEntitaPath(row.entita_tipo, row.entita_id);
                    const open = expandedId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <TableRow>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setExpandedId(open ? null : row.id)}
                              aria-label={open ? "Chiudi dettaglio" : "Apri dettaglio"}
                            >
                              {open ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm tabular-nums">
                            {row.created_at
                              ? format(new Date(row.created_at), "dd/MM/yyyy HH:mm:ss", { locale: it })
                              : "—"}
                          </TableCell>
                          <TableCell className="min-w-0 truncate text-sm" title={fmtUtente(row)}>
                            {fmtUtente(row)}
                          </TableCell>
                          <TableCell className="min-w-0">
                            <div
                              className="truncate text-sm font-medium"
                              title={labelOperazioneLog(row.azione, row.dettagli_json)}
                            >
                              {labelOperazioneLog(row.azione, row.dettagli_json)}
                            </div>
                            {row.azione && (
                              <div className="truncate text-xs text-muted-foreground" title={row.azione}>
                                {row.azione}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={stato === "FALLITA" ? "destructive" : "default"}>
                              {stato}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={SEVERITY_BADGE[row.severity] ?? "outline"}>
                              {row.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.entita_tipo || row.entita_id ? (
                              <div className="flex flex-col gap-0.5">
                                <span>{registroEntitaLabel(row.entita_tipo)}</span>
                                {entPath ? (
                                  <Link
                                    to={entPath}
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    {row.entita_id?.slice(0, 8)}…
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {row.entita_id?.slice(0, 12) ?? "—"}
                                  </span>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-muted/40">
                              <pre className="max-h-64 overflow-auto rounded-md border bg-background p-3 text-xs">
                                {JSON.stringify(row.dettagli_json ?? {}, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <div className="border-t p-3">
              <ServerPagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
