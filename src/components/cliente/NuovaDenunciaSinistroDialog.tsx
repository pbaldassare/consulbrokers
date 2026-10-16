import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, MapPin, Building2 } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { TIPI_SINISTRO as TIPI_SINISTRO_LIB } from "@/lib/tipiSinistro";
import { isClienteSanitario, REPARTI_OSPEDALE_STANDARD } from "@/lib/sinistriReparto";
import {
  AttachmentStagingPanel,
  type PendingDocumentFile,
} from "@/components/shared/MultiDocumentUploadPanel";
import { resolveUploadDisplayName, sanitizeStorageFileName } from "@/lib/sanitizeFileName";
import { fetchPolizzeForClienti } from "@/lib/polizzeSearch";
import { formatPolizzaProdotto } from "@/lib/titoliDisplay";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

interface Polizza {
  id: string;
  numero_titolo: string | null;
  prodotto_label?: string | null;
  ramo_descrizione?: string | null;
  ufficio_id?: string | null;
  cliente_anagrafica_id: string;
}

const TIPI_SINISTRO = TIPI_SINISTRO_LIB.map(t => ({
  value: t.value,
  label: t.label,
  isVeicolo: !!t.isVeicolo,
}));

export const NuovaDenunciaSinistroDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [polizze, setPolizze] = useState<Polizza[]>([]);

  const [titoloId, setTitoloId] = useState("");
  const [tipoSinistro, setTipoSinistro] = useState("");
  const [isPersonalizzato, setIsPersonalizzato] = useState(false);
  const [tipoPersonalizzato, setTipoPersonalizzato] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [citta, setCitta] = useState("");
  const [cap, setCap] = useState("");
  const [provincia, setProvincia] = useState("");
  const [dinamica, setDinamica] = useState("");
  const [controparte, setControparte] = useState("");
  const [targa, setTarga] = useState("");
  const [reparto, setReparto] = useState("");
  const [files, setFiles] = useState<PendingDocumentFile[]>([]);
  const [clienteSanitario, setClienteSanitario] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitoloId(""); setTipoSinistro(""); setIsPersonalizzato(false); setTipoPersonalizzato("");
    setDataEvento("");
    setIndirizzo(""); setCitta(""); setCap(""); setProvincia("");
    setDinamica(""); setControparte(""); setTarga(""); setReparto(""); setFiles([]);
    setClienteSanitario(false);
    (async () => {
      const { data: cIds } = await supabase.rpc("get_my_cliente_ids");
      const ids = (cIds ?? []).map((c: any) => c);
      if (!ids.length) return;
      const { data: cli } = await supabase
        .from("clienti")
        .select("spec_sx_sanita, settore, codice_ricerca, azienda_ssn_sx")
        .in("id", ids)
        .limit(1)
        .maybeSingle();
      setClienteSanitario(isClienteSanitario(cli));
      const merged = await fetchPolizzeForClienti(ids, { soloMadri: true });
      setPolizze(
        merged.map((p: any) => ({
          id: p.id,
          numero_titolo: p.numero_titolo,
          ufficio_id: p.ufficio_id ?? null,
          cliente_anagrafica_id: p.cliente_anagrafica_id ?? ids[0],
          prodotto_label: formatPolizzaProdotto(p),
          ramo_descrizione: p.ramo?.descrizione ?? p.prodotti_cga?.ramo ?? null,
        })),
      );
    })();
  }, [open]);

  const polizzaSelezionata = polizze.find(p => p.id === titoloId);
  const tipoMeta = TIPI_SINISTRO.find(t => t.value === tipoSinistro);
  const showTarga = !isPersonalizzato && !!tipoMeta?.isVeicolo;

  const tipoValido = isPersonalizzato
    ? tipoPersonalizzato.trim().length >= 3
    : !!tipoSinistro;
  const canSubmit = tipoValido && dataEvento && dinamica.trim().length > 5
    && (!clienteSanitario || reparto.trim().length > 0);

  const submit = async () => {
    if (!user) return;
    const emptyName = files.find((p) => !p.displayName.trim());
    if (emptyName) {
      toast.error("Inserisci un nome per ogni allegato");
      return;
    }
    setSaving(true);
    try {
      const { data: cIds } = await supabase.rpc("get_my_cliente_ids");
      const ids = (cIds ?? []).map((c: any) => c);
      const clienteId = polizzaSelezionata?.cliente_anagrafica_id || ids[0];
      if (!clienteId) {
        toast.error("Nessun cliente associato all'utente");
        setSaving(false);
        return;
      }
      const isCga = polizzaSelezionata?.id.startsWith("cga:");
      const numero = `WEB-${Date.now().toString().slice(-8)}`;
      const luogoCompleto = clienteSanitario
        ? [reparto, indirizzo].filter(Boolean).join(" — ")
        : [indirizzo, cap, citta, provincia].filter(Boolean).join(", ");
      const { data: sin, error } = await supabase
        .from("sinistri")
        .insert({
          numero_sinistro: numero,
          stato: "in_valutazione",
          aperto_da_cliente: true,
          titolo_id: polizzaSelezionata && !isCga ? polizzaSelezionata.id : null,
          cliente_anagrafica_id: clienteId,
          ufficio_id: polizzaSelezionata?.ufficio_id ?? null,
          ramo_sinistro: polizzaSelezionata?.ramo_descrizione ?? null,
          tipo_sinistro: isPersonalizzato ? null : (tipoSinistro || null),
          tipo_sinistro_personalizzato: isPersonalizzato ? tipoPersonalizzato.trim() : null,
          data_evento: dataEvento || null,
          data_apertura: new Date().toISOString().slice(0, 10),
          data_denuncia: new Date().toISOString().slice(0, 10),
          reparto: clienteSanitario ? reparto.trim() : null,
          luogo_sinistro: luogoCompleto || null,
          indirizzo_sinistro: indirizzo || null,
          citta_sinistro: citta || null,
          cap_sinistro: cap || null,
          provincia_sinistro: provincia || null,
          dinamica: dinamica || null,
          controparte: controparte || null,
          targa_veicolo: showTarga ? (targa || null) : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      for (const item of files) {
        const nomeFile = resolveUploadDisplayName(item.displayName, item.file.name);
        const path = `${sin.id}/${Date.now()}_${sanitizeStorageFileName(nomeFile)}`;
        const { error: uErr } = await supabase.storage
          .from("documenti_sinistri")
          .upload(path, item.file);
        if (uErr) {
          toast.error(`Errore upload ${nomeFile}: ${uErr.message}`);
          continue;
        }
        await supabase.from("documenti").insert({
          entita_tipo: "sinistro",
          entita_id: sin.id,
          nome_file: nomeFile,
          path_storage: path,
          bucket_name: "documenti_sinistri",
          caricato_da: user.id,
          caricato_da_cliente: true,
          visibile_al_cliente: true,
          categoria: "denuncia_cliente",
        });
      }

      // Log apertura + evento timeline
      await supabase.from("sinistro_eventi").insert([{
        sinistro_id: sin.id,
        tipo_evento: "apertura_cliente",
        data_scadenza: new Date().toISOString().slice(0, 10),
        stato: "completato",
        note: `Denuncia inviata dal cliente — stato iniziale: in valutazione`,
      }]);
      await supabase.from("log_attivita").insert({
        user_id: user.id,
        azione: "sinistro_aperto_da_cliente",
        entita_tipo: "sinistro",
        entita_id: sin.id,
        ufficio_id: polizzaSelezionata?.ufficio_id ?? null,
        dettagli_json: { numero, tipo_sinistro: tipoSinistro, cliente_id: clienteId },
        severity: "info",
      });

      toast.success("Denuncia inviata all'agenzia");
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Errore durante l'invio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apri nuovo sinistro</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Polizza & Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Polizza coinvolta (opzionale)</Label>
              <Select value={titoloId} onValueChange={setTitoloId}>
                <SelectTrigger><SelectValue placeholder="Seleziona polizza" /></SelectTrigger>
                <SelectContent>
                  {polizze.map(p => {
                    const extra = p.prodotto_label || p.ramo_descrizione;
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.numero_titolo}{extra ? ` — ${extra}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo di sinistro *</Label>
              {isPersonalizzato ? (
                <Input
                  value={tipoPersonalizzato}
                  onChange={e => setTipoPersonalizzato(e.target.value)}
                  placeholder="Es. Danno da grandine al tetto"
                  maxLength={500}
                />
              ) : (
                <SearchableSelect
                  options={TIPI_SINISTRO.map(t => ({ value: t.value, label: t.label }))}
                  value={tipoSinistro}
                  onValueChange={setTipoSinistro}
                  placeholder="Seleziona tipo"
                  searchPlaceholder="Cerca tipo..."
                />
              )}
              <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer">
                <Checkbox
                  checked={isPersonalizzato}
                  onCheckedChange={(v) => {
                    const checked = v === true;
                    setIsPersonalizzato(checked);
                    if (checked) setTipoSinistro("");
                    else setTipoPersonalizzato("");
                  }}
                />
                <span>Tipo non in elenco — descrivilo</span>
              </label>
            </div>
          </div>

          {/* Data + reparto / indirizzo */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Data evento *</Label>
                <Input type="date" value={dataEvento} onChange={e => setDataEvento(e.target.value)} />
              </div>
              {clienteSanitario && (
                <div>
                  <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />Reparto *</Label>
                  <SearchableSelect
                    options={REPARTI_OSPEDALE_STANDARD.map((r) => ({ value: r, label: r }))}
                    value={reparto}
                    onValueChange={setReparto}
                    placeholder="Seleziona reparto"
                    searchPlaceholder="Cerca reparto..."
                  />
                </div>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {clienteSanitario ? "Dettaglio ubicazione (opzionale)" : "Indirizzo del sinistro"}
              </Label>
              <AddressAutocomplete
                value={indirizzo}
                onChange={setIndirizzo}
                onSelect={(c) => {
                  setIndirizzo(c.indirizzo);
                  if (!clienteSanitario) {
                    setCap(c.cap);
                    setCitta(c.citta);
                    setProvincia(c.provincia);
                  }
                }}
                searchPlaceholder={
                  clienteSanitario
                    ? "Cerca su Google Maps (opzionale)..."
                    : "Inizia a digitare via, piazza..."
                }
                manualStreetLabel={
                  clienteSanitario ? "Dettaglio ubicazione" : "Indirizzo (via e numero)"
                }
                manualStreetPlaceholder={
                  clienteSanitario
                    ? "Es. Padiglione A, Piano 3, corridoio..."
                    : "Es. Via Roma 12"
                }
              />
            </div>
            {!clienteSanitario && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Città</Label>
                <Input value={citta} onChange={e => setCitta(e.target.value)} />
              </div>
              <div>
                <Label>CAP</Label>
                <Input value={cap} onChange={e => setCap(e.target.value)} />
              </div>
              <div>
                <Label>Provincia</Label>
                <Input value={provincia} onChange={e => setProvincia(e.target.value.toUpperCase())} maxLength={2} />
              </div>
            </div>
            )}
          </div>

          {/* Dinamica */}
          <div>
            <Label>Dinamica del sinistro *</Label>
            <Textarea rows={4} value={dinamica} onChange={e => setDinamica(e.target.value)} placeholder="Descrivi cosa è successo..." />
          </div>

          {/* Opzionali */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Controparte (se presente)</Label>
              <Input value={controparte} onChange={e => setControparte(e.target.value)} />
            </div>
            {showTarga && (
              <div>
                <Label>Targa veicolo</Label>
                <Input value={targa} onChange={e => setTarga(e.target.value.toUpperCase())} />
              </div>
            )}
          </div>

          {/* Allegati */}
          <div className="space-y-2">
            <Label>Allegati (foto, denuncia, perizia...)</Label>
            <AttachmentStagingPanel
              files={files}
              onFilesChange={setFiles}
              disabled={saving}
              emptyLabel="Trascina qui o clicca per selezionare"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
          <Button onClick={submit} disabled={!canSubmit || saving} className="bg-teal-700 hover:bg-teal-800">
            <Upload className="h-4 w-4 mr-1" />
            {saving ? "Invio..." : "Invia denuncia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NuovaDenunciaSinistroDialog;
