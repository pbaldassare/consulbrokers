import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Send, Loader2, Paperclip, FileText } from "lucide-react";
import { toast } from "sonner";
import { sendEmail } from "@/lib/sendEmail";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";

interface SendTestEmailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: { id: string; nome: string; oggetto: string; corpo: string } | null;
  cliente?: { id: string; email: string | null; nome: string | null; cognome: string | null; ragione_sociale: string | null } | null;
  titolo?: { id: string; numero_titolo: string | null } | null;
  /** Subject + body with placeholders already replaced */
  renderedSubject: string;
  renderedBody: string;
}

const PDF_TYPES = [
  { value: "preventivo", label: "Preventivo assicurativo" },
  { value: "quietanza", label: "Quietanza di pagamento" },
  { value: "riepilogo_polizza", label: "Riepilogo polizza" },
];

export function SendTestEmailDialog({
  open,
  onOpenChange,
  template,
  cliente,
  titolo,
  renderedSubject,
  renderedBody,
}: SendTestEmailDialogProps) {
  const [destinatario, setDestinatario] = useState("");
  const [allegaPdf, setAllegaPdf] = useState(false);
  const [tipoPdf, setTipoPdf] = useState<string>("riepilogo_polizza");
  const [sending, setSending] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (open) {
      setDestinatario(cliente?.email || "");
      setAllegaPdf(false);
    }
  }, [open, cliente?.email]);

  const previewHtml = useMemo(() => {
    // Mini wrapper preview for the dialog (the real one is built server-side)
    const safeBody = renderedBody
      .split("\n\n")
      .map((p) => `<p style="margin:0 0 12px 0;">${p.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`)
      .join("");
    return `<div style="font-family:system-ui;background:#f4f6f8;padding:16px;border-radius:8px;">
      <div style="background:#fff;border-radius:6px;overflow:hidden;border:1px solid hsl(var(--border));">
        <div style="background:hsl(var(--primary));color:#fff;padding:12px 16px;font-weight:600;">ConsulNet</div>
        <div style="padding:16px;font-size:14px;color:hsl(var(--foreground));">${safeBody}</div>
        <div style="padding:12px 16px;border-top:1px solid hsl(var(--border));font-size:12px;color:hsl(var(--muted-foreground));">Cordiali saluti,<br/><strong>ConsulNet</strong></div>
      </div>
    </div>`;
  }, [renderedBody]);

  async function handleSend() {
    if (!destinatario || !destinatario.includes("@")) {
      toast.error("Inserisci un destinatario valido");
      return;
    }
    if (!template) return;

    setSending(true);
    try {
      let attachments: { filename: string; content: string }[] | undefined;

      if (allegaPdf) {
        if (!cliente?.id && !titolo?.id) {
          toast.error("Per allegare un PDF serve almeno un cliente o una polizza");
          setSending(false);
          return;
        }
        setGeneratingPdf(true);
        const { data, error } = await supabase.functions.invoke("genera-pdf-template", {
          body: { tipo: tipoPdf, cliente_id: cliente?.id, titolo_id: titolo?.id },
        });
        setGeneratingPdf(false);
        if (error || data?.error) {
          toast.error("Generazione PDF fallita: " + (error?.message || data?.error));
          setSending(false);
          return;
        }
        attachments = [{ filename: data.filename, content: data.content }];
      }

      const result = await sendEmail({
        to: destinatario,
        subject: renderedSubject,
        html: renderedBody,
        attachments,
        apply_branding: true,
        template_id: template.id,
      });

      if (!result.success) {
        toast.error("Invio fallito: " + (result.error || "errore sconosciuto"));
      } else {
        toast.success(`Email inviata a ${destinatario}`);
        await logAttivita({
          azione: "test_email_inviata",
          entita_tipo: "template_email",
          entita_id: template.id,
          dettagli_json: {
            destinatario,
            template_nome: template.nome,
            cliente_id: cliente?.id || null,
            titolo_id: titolo?.id || null,
            allegato_pdf: allegaPdf ? tipoPdf : null,
            resend_id: result.id,
          },
          severity: "info",
        });
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e?.message || "Errore durante l'invio");
    } finally {
      setSending(false);
      setGeneratingPdf(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Invia email di test
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/40 border rounded-md p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">Modalità test attiva</p>
            <p className="text-muted-foreground">
              Mittente: <code className="bg-background px-1 rounded">onboarding@resend.dev</code>. In test, Resend
              consente l'invio solo verso l'email del proprietario dell'account Resend.
            </p>
          </div>

          {template && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{template.nome}</Badge>
              {cliente && (
                <Badge variant="outline">
                  {cliente.ragione_sociale || `${cliente.cognome || ""} ${cliente.nome || ""}`.trim() || "—"}
                </Badge>
              )}
              {titolo && <Badge variant="outline">Polizza {titolo.numero_titolo}</Badge>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="destinatario">Destinatario</Label>
            <Input
              id="destinatario"
              type="email"
              placeholder="es. tu@esempio.it"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Oggetto</Label>
            <Input value={renderedSubject} readOnly className="bg-muted/30" />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Allegato</Label>
            <div className="flex items-center gap-3 border rounded-md p-3">
              <Checkbox
                id="allega-pdf"
                checked={allegaPdf}
                onCheckedChange={(v) => setAllegaPdf(!!v)}
              />
              <label htmlFor="allega-pdf" className="text-sm cursor-pointer flex-1">
                Allega PDF autocompilato
              </label>
              <Select value={tipoPdf} onValueChange={setTipoPdf} disabled={!allegaPdf}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PDF_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> {t.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {allegaPdf && !cliente && !titolo && (
              <p className="text-xs text-destructive">
                Seleziona prima un cliente o una polizza nell'anteprima per generare un PDF con dati reali.
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Anteprima HTML</Label>
            <div
              className="border rounded-md max-h-64 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
            <p className="text-xs text-muted-foreground">
              L'email reale userà il branding (logo + colori + firma) configurato in <strong>Branding email</strong>.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Annulla
          </Button>
          <Button onClick={handleSend} disabled={sending || !destinatario}>
            {sending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {generatingPdf ? "Genero PDF…" : "Invio…"}</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Invia test</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
