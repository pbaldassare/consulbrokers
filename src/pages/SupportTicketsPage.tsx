import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  CheckCircle2,
  Clock3,
  Download,
  FileWarning,
  Loader2,
  MessageSquareText,
  Paperclip,
  Plus,
  ShieldCheck,
  TicketCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sendEmail } from "@/lib/sendEmail";
import { logAttivita } from "@/lib/logAttivita";
import { sanitizeStorageFileName } from "@/lib/sanitizeFileName";
import {
  documentUploadTooLargeMessage,
  isDocumentUploadTooLarge,
} from "@/lib/uploadLimits";
import {
  escapeSupportTicketHtml,
  formatSupportTicketNumber,
  isOpenSupportTicket,
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_STATUS_LABEL,
  type SupportTicketStatus,
  validateSupportTicketDescription,
} from "@/lib/supportTickets";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const SUPPORT_EMAIL = "support@cbnet.it";
const SUPPORT_BUCKET = "ticket-supporto";
// Le tabelle entrano nei tipi generati Supabase dopo l'applicazione della migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface SupportTicket {
  id: string;
  numero: number;
  richiedente_id: string;
  richiedente_nome: string;
  richiedente_email: string;
  ufficio_id: string | null;
  titolo: string;
  descrizione: string;
  cliente_riferimento: string | null;
  polizza_riferimento: string | null;
  stato: SupportTicketStatus;
  data_apertura: string;
  data_presa_in_carico: string | null;
  data_risoluzione: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketEvent {
  id: string;
  tipo: "apertura" | "cambio_stato" | "nota_admin";
  stato_da: SupportTicketStatus | null;
  stato_a: SupportTicketStatus | null;
  nota: string | null;
  autore_nome: string | null;
  created_at: string;
}

interface TicketAttachment {
  id: string;
  nome_file: string;
  path_storage: string;
  mime_type: string | null;
  dimensione_bytes: number | null;
  created_at: string;
}

const statusClass: Record<SupportTicketStatus, string> = {
  aperto: "border-amber-300 bg-amber-50 text-amber-800",
  preso_in_carico: "border-blue-300 bg-blue-50 text-blue-800",
  risolto: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

function displayDate(value: string | null): string {
  return value ? format(new Date(value), "dd MMM yyyy, HH:mm", { locale: it }) : "—";
}

function NewTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticket: SupportTicket) => void;
}) {
  const { user, profile } = useAuth();
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [cliente, setCliente] = useState("");
  const [polizza, setPolizza] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitolo("");
    setDescrizione("");
    setCliente("");
    setPolizza("");
    setFiles([]);
  };

  const submit = async () => {
    if (!user?.id || !profile) {
      toast.error("Sessione non disponibile");
      return;
    }
    if (titolo.trim().length < 5) {
      toast.error("Inserisci un titolo di almeno 5 caratteri");
      return;
    }
    const descriptionError = validateSupportTicketDescription(descrizione);
    if (descriptionError) {
      toast.error(descriptionError);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await db
        .from("support_tickets")
        .insert({
          richiedente_id: user.id,
          richiedente_nome: profile.email || "Utente CBnet",
          richiedente_email: profile.email || user.email || "",
          titolo: titolo.trim(),
          descrizione: descrizione.trim(),
          cliente_riferimento: cliente.trim() || null,
          polizza_riferimento: polizza.trim() || null,
        })
        .select("*")
        .single();
      if (error) throw error;

      const ticket = data as SupportTicket;
      const uploadedNames: string[] = [];
      for (const file of files) {
        const path = `${ticket.id}/${crypto.randomUUID()}_${sanitizeStorageFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from(SUPPORT_BUCKET)
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (uploadError) {
          toast.warning(`Ticket creato, ma ${file.name} non è stato caricato`);
          continue;
        }
        const { error: metadataError } = await db.from("support_ticket_allegati").insert({
          ticket_id: ticket.id,
          nome_file: file.name,
          path_storage: path,
          bucket_name: SUPPORT_BUCKET,
          mime_type: file.type || null,
          dimensione_bytes: file.size,
          caricato_da: user.id,
        });
        if (metadataError) {
          await supabase.storage.from(SUPPORT_BUCKET).remove([path]);
          toast.warning(`Ticket creato, ma ${file.name} non è stato registrato`);
          continue;
        }
        uploadedNames.push(file.name);
      }

      const ticketNumber = formatSupportTicketNumber(ticket.numero);
      const emailResult = await sendEmail({
        to: SUPPORT_EMAIL,
        reply_to: ticket.richiedente_email,
        subject: `[CBnet] Nuovo ticket ${ticketNumber} - ${ticket.titolo}`,
        apply_branding: true,
        ufficio_id: ticket.ufficio_id,
        html: `
          <h2>Nuovo ticket ${ticketNumber}</h2>
          <p><strong>Richiedente:</strong> ${escapeSupportTicketHtml(ticket.richiedente_nome)}
          &lt;${escapeSupportTicketHtml(ticket.richiedente_email)}&gt;</p>
          <p><strong>Titolo:</strong> ${escapeSupportTicketHtml(ticket.titolo)}</p>
          <p><strong>Cliente:</strong> ${escapeSupportTicketHtml(ticket.cliente_riferimento || "Non indicato")}</p>
          <p><strong>Polizza:</strong> ${escapeSupportTicketHtml(ticket.polizza_riferimento || "Non indicata")}</p>
          <p><strong>Descrizione:</strong></p>
          <div style="white-space:pre-wrap">${escapeSupportTicketHtml(ticket.descrizione)}</div>
          <p><strong>Allegati:</strong> ${uploadedNames.length
            ? uploadedNames.map(escapeSupportTicketHtml).join(", ")
            : "Nessuno"}</p>
          <p><a href="${window.location.origin}/ticket-supporto">Apri l'area Ticket in CBnet</a></p>
        `,
      });
      await logAttivita({
        azione: emailResult.success ? "ticket_supporto_aperto" : "ticket_supporto_email_errore",
        entita_tipo: "support_ticket",
        entita_id: ticket.id,
        dettagli_json: {
          numero: ticket.numero,
          destinatario: SUPPORT_EMAIL,
          allegati: uploadedNames.length,
          email_id: emailResult.id || null,
          errore: emailResult.error || null,
        },
        severity: emailResult.success ? "info" : "warning",
        ufficio_id: ticket.ufficio_id || undefined,
      });

      reset();
      onOpenChange(false);
      onCreated(ticket);
      if (emailResult.success) {
        toast.success(`${ticketNumber} inviato al supporto`);
      } else {
        toast.warning(`${ticketNumber} creato; notifica email non consegnata`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante la creazione del ticket");
    } finally {
      setSaving(false);
    }
  };

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const accepted: File[] = [];
    for (const file of Array.from(selected)) {
      if (isDocumentUploadTooLarge(file.size)) {
        toast.error(`${file.name}: ${documentUploadTooLargeMessage()}`);
      } else {
        accepted.push(file);
      }
    }
    setFiles((current) => [...current, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apri un nuovo ticket</DialogTitle>
          <DialogDescription>
            La richiesta sarà inviata automaticamente al supporto IT.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Aiutaci a risolvere più velocemente</AlertTitle>
          <AlertDescription>
            Descrivi passaggi, messaggi di errore e risultato atteso. Se il problema riguarda
            un cliente o una polizza, indica tutti i riferimenti disponibili.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ticket-title">Titolo *</Label>
            <Input
              id="ticket-title"
              maxLength={160}
              value={titolo}
              onChange={(event) => setTitolo(event.target.value)}
              placeholder="Es. Impossibile mettere a cassa una polizza"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-description">Descrizione dettagliata *</Label>
            <Textarea
              id="ticket-description"
              className="min-h-36"
              maxLength={10_000}
              value={descrizione}
              onChange={(event) => setDescrizione(event.target.value)}
              placeholder="Indica cosa stavi facendo, cosa è successo e cosa ti aspettavi..."
            />
            <p className="text-xs text-muted-foreground">{descrizione.length}/10.000 caratteri</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ticket-client">Cliente coinvolto</Label>
              <Input
                id="ticket-client"
                value={cliente}
                onChange={(event) => setCliente(event.target.value)}
                placeholder="Nome, ragione sociale o codice"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ticket-policy">Polizza coinvolta</Label>
              <Input
                id="ticket-policy"
                value={polizza}
                onChange={(event) => setPolizza(event.target.value)}
                placeholder="Numero polizza"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-files">Allegati</Label>
            <Input
              ref={fileInputRef}
              id="ticket-files"
              type="file"
              multiple
              onChange={(event) => addFiles(event.target.files)}
            />
            {files.length > 0 && (
              <div className="space-y-1 rounded-md border p-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Rimuovi
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Invia ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetail({
  ticket,
  open,
  onOpenChange,
  onUpdated,
}: {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { isAdmin, user, profile } = useAuth();
  const [status, setStatus] = useState<SupportTicketStatus>(ticket?.stato || "aperto");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ticket?.stato) setStatus(ticket.stato);
  }, [ticket?.id, ticket?.stato]);

  const { data: events = [], refetch: refetchEvents } = useQuery({
    queryKey: ["support-ticket-events", ticket?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("support_ticket_eventi")
        .select("*")
        .eq("ticket_id", ticket!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketEvent[];
    },
    enabled: !!ticket?.id && open,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["support-ticket-attachments", ticket?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("support_ticket_allegati")
        .select("*")
        .eq("ticket_id", ticket!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketAttachment[];
    },
    enabled: !!ticket?.id && open,
  });

  if (!ticket) return null;

  const downloadAttachment = async (attachment: TicketAttachment) => {
    const { data, error } = await supabase.storage
      .from(SUPPORT_BUCKET)
      .createSignedUrl(attachment.path_storage, 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message || "Impossibile scaricare l'allegato");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const saveAdminUpdate = async () => {
    if (!isAdmin || !user?.id) return;
    const statusChanged = status !== ticket.stato;
    const cleanNote = note.trim();
    if (!statusChanged && !cleanNote) {
      toast.info("Nessuna modifica da salvare");
      return;
    }
    setSaving(true);
    try {
      if (statusChanged) {
        const { error } = await db
          .from("support_tickets")
          .update({ stato: status })
          .eq("id", ticket.id);
        if (error) throw error;
      }
      if (cleanNote) {
        const { error } = await db.from("support_ticket_eventi").insert({
          ticket_id: ticket.id,
          tipo: "nota_admin",
          nota: cleanNote,
          autore_id: user.id,
          autore_nome: [profile?.nome, profile?.cognome].filter(Boolean).join(" ") || profile?.email || "Admin",
        });
        if (error) throw error;
      }

      const finalStatus = statusChanged ? status : ticket.stato;
      const emailResult = await sendEmail({
        to: ticket.richiedente_email,
        subject: `[CBnet] ${formatSupportTicketNumber(ticket.numero)} - ${SUPPORT_TICKET_STATUS_LABEL[finalStatus]}`,
        apply_branding: true,
        ufficio_id: ticket.ufficio_id,
        html: `
          <h2>Aggiornamento ticket ${formatSupportTicketNumber(ticket.numero)}</h2>
          <p><strong>${escapeSupportTicketHtml(ticket.titolo)}</strong></p>
          <p>Stato attuale: <strong>${SUPPORT_TICKET_STATUS_LABEL[finalStatus]}</strong></p>
          ${cleanNote ? `<p><strong>Nota del supporto:</strong></p><div style="white-space:pre-wrap">${escapeSupportTicketHtml(cleanNote)}</div>` : ""}
          <p><a href="${window.location.origin}/ticket-supporto">Consulta il ticket in CBnet</a></p>
        `,
      });
      await logAttivita({
        azione: emailResult.success ? "ticket_supporto_aggiornato" : "ticket_supporto_email_errore",
        entita_tipo: "support_ticket",
        entita_id: ticket.id,
        dettagli_json: {
          stato_da: ticket.stato,
          stato_a: finalStatus,
          nota_inserita: !!cleanNote,
          destinatario: ticket.richiedente_email,
          email_id: emailResult.id || null,
          errore: emailResult.error || null,
        },
        severity: emailResult.success ? "info" : "warning",
        ufficio_id: ticket.ufficio_id || undefined,
      });

      setNote("");
      await refetchEvents();
      onUpdated();
      if (emailResult.success) {
        toast.success("Ticket aggiornato e richiedente avvisato");
      } else {
        toast.warning("Ticket aggiornato; notifica email non consegnata");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore durante l'aggiornamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-hidden sm:max-w-2xl">
        <SheetHeader>
          <div className="flex items-center gap-2 pr-8">
            <SheetTitle>{formatSupportTicketNumber(ticket.numero)}</SheetTitle>
            <Badge variant="outline" className={statusClass[ticket.stato]}>
              {SUPPORT_TICKET_STATUS_LABEL[ticket.stato]}
            </Badge>
          </div>
          <SheetDescription>{ticket.titolo}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-5 h-[calc(100vh-130px)] pr-4">
          <div className="space-y-5 pb-10">
            <div className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Richiedente</p>
                <p className="font-medium">{ticket.richiedente_nome}</p>
                <p className="text-muted-foreground">{ticket.richiedente_email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aperto il</p>
                <p className="font-medium">{displayDate(ticket.data_apertura)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p>{ticket.cliente_riferimento || "Non indicato"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Polizza</p>
                <p>{ticket.polizza_riferimento || "Non indicata"}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Descrizione</h3>
              <div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">{ticket.descrizione}</div>
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-2 font-semibold">
                <Paperclip className="h-4 w-4" />
                Allegati ({attachments.length})
              </h3>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nessun allegato.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((attachment) => (
                    <button
                      type="button"
                      key={attachment.id}
                      onClick={() => downloadAttachment(attachment)}
                      className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/50"
                    >
                      <span className="truncate">{attachment.nome_file}</span>
                      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isAdmin && (
              <>
                <Separator />
                <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Gestione amministratore
                  </div>
                  <div className="grid gap-2">
                    <Label>Stato ticket</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as SupportTicketStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUPPORT_TICKET_STATUS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="admin-note">Nota per il richiedente</Label>
                    <Textarea
                      id="admin-note"
                      className="min-h-24"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Es. Problema risolto: abbiamo corretto il collegamento della polizza..."
                    />
                  </div>
                  <Button onClick={saveAdminUpdate} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salva e avvisa il richiedente
                  </Button>
                </div>
              </>
            )}

            <Separator />
            <div>
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Clock3 className="h-4 w-4" />
                Cronologia
              </h3>
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="relative border-l-2 border-muted pl-4">
                    <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium">
                      {event.tipo === "apertura" && "Ticket aperto"}
                      {event.tipo === "cambio_stato" && event.stato_a
                        && `Stato: ${SUPPORT_TICKET_STATUS_LABEL[event.stato_a]}`}
                      {event.tipo === "nota_admin" && "Nota del supporto"}
                    </p>
                    {event.nota && event.nota !== "Ticket aperto" && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{event.nota}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {displayDate(event.created_at)}
                      {event.autore_nome ? ` · ${event.autore_nome}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function TicketsTable({
  tickets,
  isAdmin,
  onSelect,
}: {
  tickets: SupportTicket[];
  isAdmin: boolean;
  onSelect: (ticket: SupportTicket) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="py-14 text-center text-muted-foreground">
        <TicketCheck className="mx-auto mb-3 h-11 w-11 opacity-30" />
        <p>Nessun ticket in questa sezione.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket</TableHead>
            <TableHead>Richiesta</TableHead>
            {isAdmin && <TableHead>Richiedente</TableHead>}
            <TableHead>Stato</TableHead>
            <TableHead>Apertura</TableHead>
            <TableHead>Aggiornamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow
              key={ticket.id}
              className="cursor-pointer"
              onClick={() => onSelect(ticket)}
            >
              <TableCell className="font-mono text-xs font-semibold">
                {formatSupportTicketNumber(ticket.numero)}
              </TableCell>
              <TableCell>
                <p className="max-w-md truncate font-medium">{ticket.titolo}</p>
                {(ticket.cliente_riferimento || ticket.polizza_riferimento) && (
                  <p className="max-w-md truncate text-xs text-muted-foreground">
                    {[ticket.cliente_riferimento, ticket.polizza_riferimento].filter(Boolean).join(" · ")}
                  </p>
                )}
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <p className="font-medium">{ticket.richiedente_nome}</p>
                  <p className="text-xs text-muted-foreground">{ticket.richiedente_email}</p>
                </TableCell>
              )}
              <TableCell>
                <Badge variant="outline" className={statusClass[ticket.stato]}>
                  {SUPPORT_TICKET_STATUS_LABEL[ticket.stato]}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{displayDate(ticket.data_apertura)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">{displayDate(ticket.updated_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function SupportTicketsPage() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ["support-tickets", user?.id, isAdmin],
    queryFn: async () => {
      const { data, error } = await db
        .from("support_tickets")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user?.id,
  });

  const openTickets = useMemo(
    () => tickets.filter((ticket) => isOpenSupportTicket(ticket.stato)),
    [tickets],
  );
  const resolvedTickets = useMemo(
    () => tickets.filter((ticket) => !isOpenSupportTicket(ticket.stato)),
    [tickets],
  );
  const assignedCount = tickets.filter((ticket) => ticket.stato === "preso_in_carico").length;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    if (selectedTicket) {
      const { data } = await db.from("support_tickets").select("*").eq("id", selectedTicket.id).maybeSingle();
      if (data) setSelectedTicket(data as SupportTicket);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <TicketCheck className="h-6 w-6 text-primary" />
            Ticket Supporto
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Gestisci le richieste inviate dagli utenti a IT e amministrazione."
              : "Comunica problemi ed esigenze al supporto IT e segui la lavorazione."}
          </p>
        </div>
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo ticket
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <MessageSquareText className="h-8 w-8 text-amber-600" />
            <div><p className="text-2xl font-bold">{openTickets.length}</p><p className="text-xs text-muted-foreground">Ticket attivi</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <UserRound className="h-8 w-8 text-blue-600" />
            <div><p className="text-2xl font-bold">{assignedCount}</p><p className="text-xs text-muted-foreground">Presi in carico</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div><p className="text-2xl font-bold">{resolvedTickets.length}</p><p className="text-xs text-muted-foreground">Risolti / storico</p></div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Impossibile caricare i ticket</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Errore sconosciuto"}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Caricamento ticket...
        </div>
      ) : (
        <Tabs defaultValue="aperti">
          <TabsList>
            <TabsTrigger value="aperti">Aperti ({openTickets.length})</TabsTrigger>
            <TabsTrigger value="storico">Storico ({resolvedTickets.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="aperti" className="mt-4">
            <TicketsTable tickets={openTickets} isAdmin={isAdmin} onSelect={setSelectedTicket} />
          </TabsContent>
          <TabsContent value="storico" className="mt-4">
            <TicketsTable tickets={resolvedTickets} isAdmin={isAdmin} onSelect={setSelectedTicket} />
          </TabsContent>
        </Tabs>
      )}

      <NewTicketDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreated={(ticket) => {
          refresh();
          setSelectedTicket(ticket);
        }}
      />
      <TicketDetail
        ticket={selectedTicket}
        open={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
        onUpdated={refresh}
      />
    </div>
  );
}
