import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface QuickClienteDialogProps {
  onCreated: (clienteId: string, label: string) => void;
}

const privatoSchema = z.object({
  nome: z.string().trim().min(1, "Nome obbligatorio").max(100),
  cognome: z.string().trim().min(1, "Cognome obbligatorio").max(100),
  codice_fiscale: z.string().trim().max(16).optional().or(z.literal("")),
  email: z.string().trim().email("Email non valida").max(255).optional().or(z.literal("")),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
});

const aziendaSchema = z.object({
  ragione_sociale: z.string().trim().min(1, "Ragione sociale obbligatoria").max(200),
  partita_iva: z.string().trim().max(20).optional().or(z.literal("")),
  codice_fiscale: z.string().trim().max(16).optional().or(z.literal("")),
  email: z.string().trim().email("Email non valida").max(255).optional().or(z.literal("")),
  telefono: z.string().trim().max(30).optional().or(z.literal("")),
});

export function QuickClienteDialog({ onCreated }: QuickClienteDialogProps) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"privato" | "azienda" | "ente">("privato");
  const [saving, setSaving] = useState(false);

  // Privato fields
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  // Azienda/Ente fields
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [partitaIva, setPartitaIva] = useState("");
  // Common
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  const reset = () => {
    setNome(""); setCognome(""); setRagioneSociale(""); setPartitaIva("");
    setCodiceFiscale(""); setEmail(""); setTelefono(""); setTipo("privato");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let payload: Record<string, any> = {
        tipo_cliente: tipo,
        codice_fiscale: codiceFiscale.trim().toUpperCase() || null,
        email: email.trim() || null,
        telefono: telefono.trim() || null,
        attivo: true,
      };

      if (tipo === "privato") {
        const parsed = privatoSchema.safeParse({ nome, cognome, codice_fiscale: codiceFiscale, email, telefono });
        if (!parsed.success) {
          toast.error(parsed.error.errors[0].message);
          setSaving(false);
          return;
        }
        payload.nome = nome.trim();
        payload.cognome = cognome.trim();
      } else {
        const parsed = aziendaSchema.safeParse({ ragione_sociale: ragioneSociale, partita_iva: partitaIva, codice_fiscale: codiceFiscale, email, telefono });
        if (!parsed.success) {
          toast.error(parsed.error.errors[0].message);
          setSaving(false);
          return;
        }
        payload.ragione_sociale = ragioneSociale.trim();
        payload.partita_iva = partitaIva.trim().toUpperCase() || null;
      }

      const { data, error } = await supabase
        .from("clienti")
        .insert(payload as any)
        .select("id, nome, cognome, ragione_sociale")
        .single();

      if (error) throw error;

      const label = data.ragione_sociale || `${data.cognome || ""} ${data.nome || ""}`.trim();
      toast.success(`Cliente "${label}" creato`);
      onCreated(data.id, label);
      setOpen(false);
      reset();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore nella creazione del cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <UserPlus className="w-3.5 h-3.5" />
          Nuovo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crea nuovo cliente</DialogTitle>
          <DialogDescription>
            Anagrafica rapida — i dati completi potranno essere integrati in seguito dalla scheda cliente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="privato">Privato</TabsTrigger>
            <TabsTrigger value="azienda">Azienda</TabsTrigger>
            <TabsTrigger value="ente">Ente</TabsTrigger>
          </TabsList>

          <TabsContent value="privato" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cognome *</Label>
                <Input value={cognome} onChange={(e) => setCognome(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Codice Fiscale</Label>
              <Input value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())} maxLength={16} className="h-8 text-xs font-mono" />
            </div>
          </TabsContent>

          <TabsContent value="azienda" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Ragione Sociale *</Label>
              <Input value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Partita IVA</Label>
                <Input value={partitaIva} onChange={(e) => setPartitaIva(e.target.value.toUpperCase())} maxLength={11} className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Codice Fiscale</Label>
                <Input value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())} maxLength={16} className="h-8 text-xs font-mono" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ente" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Denominazione Ente *</Label>
              <Input value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Partita IVA</Label>
                <Input value={partitaIva} onChange={(e) => setPartitaIva(e.target.value.toUpperCase())} maxLength={11} className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Codice Fiscale</Label>
                <Input value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())} maxLength={16} className="h-8 text-xs font-mono" />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefono</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Crea cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
