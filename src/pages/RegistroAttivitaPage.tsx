import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, endOfDay, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronDown, ChevronRight, ClipboardList, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isRootAdminEmail } from "@/lib/adminAccountGuard";
import { labelOperazioneLog, statoLogAttivita } from "@/lib/logAttivitaStato";
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

type LogRow = {
  id: string;
  created_at: string | null;
  azione: string | null;
  severity: string;
  entita_tipo: string | null;
  entita_id: string | null;
  dettagli_json: unknown;
  user_id: string | null;
  profiles: { nome: string | null; cognome: string | null; email: string | null } | null;
};

const SEVERITY_BADGE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warning: "outline",
  critical: "destructive",
};

function fmtUtente(row: LogRow): string {
  const p = row.profiles;
  if (p) {
    const nome = `${p.nome ?? ""} ${p.cognome ?? ""}`.trim();
    if (nome) return p.email ? `${nome} (${p.email})` : nome;
    if (p.email) return p.email;
  }
  return row.user_id ? row.user_id.slice(0, 8) : "—";
}

export default function RegistroAttivitaPage() {
  const { profile } = useAuth();
  const [filtroUtente, setFiltroUtente] = useState<string>("all");
  const [filtroAzione, setFiltroAzione] = useState("");
  const [dataDa, setDataDa] = useState<Date | undefined>();
  const [dataA, setDataA] = useState<Date | undefined>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { page, setPage, pageSize, range } = useServerPagination(50, [
    filtroUtente,
    filtroAzione,
    dataDa?.toISOString(),
    dataA?.toISOString(),
  ]);

  const { data: utentiStaff = [] } = useQuery({
    queryKey: ["registro_attivita_utenti"],
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
      dataDa?.toISOString(),
      dataA?.toISOString(),
    ],
    enabled: isRootAdminEmail(profile?.email),
    queryFn: async () => {
      let q = supabase
        .from("log_attivita")
        .select(
          "id, created_at, azione, severity, entita_tipo, entita_id, dettagli_json, user_id, profiles:user_id(nome, cognome, email)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(range.from, range.to);

      if (filtroUtente !== "all") q = q.eq("user_id", filtroUtente);
      const az = filtroAzione.trim();
      if (az) q = q.ilike("azione", `%${az}%`);
      if (dataDa) q = q.gte("created_at", startOfDay(dataDa).toISOString());
      if (dataA) q = q.lte("created_at", endOfDay(dataA).toISOString());

      const { data: rows, error, count } = await q;
      if (error) throw error;
      return { rows: (rows ?? []) as LogRow[], count: count ?? 0 };
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
    <PageContainer>
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

      <div className="mb-4 grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Label>Timestamp da</Label>
          <DatePicker value={dataDa} onChange={setDataDa} placeholder="Data inizio" />
        </div>
        <div className="space-y-2">
          <Label>Timestamp a</Label>
          <DatePicker value={dataA} onChange={setDataA} placeholder="Data fine" />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Caricamento log…
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Operazione</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Gravità</TableHead>
                  <TableHead>Entità</TableHead>
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
                    const stato = statoLogAttivita(row.dettagli_json, row.severity);
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
                          <TableCell className="whitespace-nowrap text-sm">
                            {row.created_at
                              ? format(new Date(row.created_at), "dd/MM/yyyy HH:mm:ss", { locale: it })
                              : "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-sm" title={fmtUtente(row)}>
                            {fmtUtente(row)}
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <div className="truncate text-sm font-medium">
                              {labelOperazioneLog(row.azione, row.dettagli_json)}
                            </div>
                            {row.azione && (
                              <div className="truncate text-xs text-muted-foreground">{row.azione}</div>
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
