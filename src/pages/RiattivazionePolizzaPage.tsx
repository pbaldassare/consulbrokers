import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

const RiattivazionePolizzaPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const paramPolizza = searchParams.get("polizza") || "";
  const paramRiga = searchParams.get("riga") || "";
  const paramClienteId = searchParams.get("clienteId") || "";
  const paramTitoloId = searchParams.get("titoloId") || "";
  const fromDettaglio = !!(paramPolizza && paramClienteId);

  const [codiceCliente, setCodiceCliente] = useState("");
  const [selectedAE, setSelectedAE] = useState("");
  const [numeroNuova, setNumeroNuova] = useState("");
  const [rigaNuova, setRigaNuova] = useState("");
  const [dataRiattivazione, setDataRiattivazione] = useState("");
  const [numeroDaRiatt, setNumeroDaRiatt] = useState(paramPolizza);
  const [rigaDaRiatt, setRigaDaRiatt] = useState(paramRiga);
  const [copiaArchivio, setCopiaArchivio] = useState(false);
  const [polizzaAuto, setPolizzaAuto] = useState(true);

  const { data: clienteFromId } = useQuery({
    queryKey: ["cliente-by-id-riatt", paramClienteId],
    queryFn: async () => {
      const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale, codice_fiscale").eq("id", paramClienteId).maybeSingle();
      return data;
    },
    enabled: !!paramClienteId,
  });

  const { data: clienteFromSearch } = useQuery({
    queryKey: ["cliente-lookup-riatt", codiceCliente],
    queryFn: async () => {
      if (!codiceCliente || codiceCliente.length < 2) return null;
      const { data } = await supabase.from("clienti").select("id, nome, cognome, ragione_sociale, codice_fiscale").or(`codice_fiscale.ilike.%${codiceCliente}%,partita_iva.ilike.%${codiceCliente}%`).limit(1).maybeSingle();
      return data;
    },
    enabled: !fromDettaglio && codiceCliente.length >= 2,
  });

  const clienteData = fromDettaglio ? clienteFromId : clienteFromSearch;

  useEffect(() => {
    if (clienteFromId?.codice_fiscale && fromDettaglio) setCodiceCliente(clienteFromId.codice_fiscale);
  }, [clienteFromId, fromDettaglio]);

  const { data: aeList } = useQuery({
    queryKey: ["ae-list-riatt"],
    queryFn: async () => {
      const { data } = await supabase.from("anagrafiche_professionali").select("id, codice, cognome, nome, sigla").eq("tipo", "account_executive").eq("attivo", true).order("cognome");
      return data || [];
    },
  });

  const riattivazioneMutation = useMutation({
    mutationFn: async () => {
      if (!dataRiattivazione) throw new Error("Data riattivazione obbligatoria");

      // Find titolo to reactivate
      let titoloId = paramTitoloId;
      if (!titoloId && numeroDaRiatt) {
        const { data: found } = await supabase
          .from("titoli")
          .select("id")
          .eq("numero_titolo", numeroDaRiatt.trim())
          .eq("stato", "sospeso")
          .limit(1)
          .maybeSingle();
        if (!found) throw new Error("Polizza sospesa non trovata");
        titoloId = found.id;
      }
      if (!titoloId) throw new Error("Specificare una polizza da riattivare");

      // Update titolo
      const { error: errUp } = await supabase
        .from("titoli")
        .update({
          stato: "attivo",
          data_riattivazione: dataRiattivazione,
        } as any)
        .eq("id", titoloId);
      if (errUp) throw errUp;

      // Insert movement
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloId,
        tipo_documento: "RA",
        data_movimento: dataRiattivazione,
        descrizione: "Riattivazione polizza",
        stato: "attivo",
      } as any);

      // Log
      await logAttivita({
        azione: "riattivazione_polizza",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: { data_riattivazione: dataRiattivazione },
      });

      return titoloId;
    },
    onSuccess: (titoloId) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      toast.success("Polizza riattivata con successo");
      navigate(`/titoli/${titoloId}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante la riattivazione");
    },
  });

  const handleConferma = () => riattivazioneMutation.mutate();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Riattivazione Polizza</h1>
        <p className="text-sm text-muted-foreground mt-1">Riattivazione polizze sospese</p>
      </div>

      {/* CLIENTE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Cliente</legend>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label htmlFor="codice-cliente-riatt">Codice</Label>
            <div className="relative">
              <Input id="codice-cliente-riatt" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="Codice cliente" readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          {clienteData && (
            <p className="text-sm text-foreground pb-2">
              {clienteData.ragione_sociale || `${clienteData.cognome} ${clienteData.nome}`}
            </p>
          )}
        </div>
        <div className="space-y-1.5 max-w-[300px]">
          <Label>A/E</Label>
          <select value={selectedAE} onChange={(e) => setSelectedAE(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">— Seleziona —</option>
            {aeList?.map((ae) => (
              <option key={ae.id} value={ae.id}>{ae.sigla || ae.codice} - {ae.cognome} {ae.nome}</option>
            ))}
          </select>
        </div>
      </fieldset>

      {/* NUOVA POLIZZA EMESSA */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Nuova Polizza Emessa</legend>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[180px] max-w-[250px]">
            <Label htmlFor="numero-nuova-riatt">Numero</Label>
            <div className="relative">
              <Input id="numero-nuova-riatt" value={numeroNuova} onChange={(e) => setNumeroNuova(e.target.value)} placeholder="N° polizza" />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5 w-[80px]">
            <Label htmlFor="riga-nuova-riatt">Riga</Label>
            <Input id="riga-nuova-riatt" value={rigaNuova} onChange={(e) => setRigaNuova(e.target.value)} />
          </div>
          <div className="space-y-1.5 w-[180px]">
            <Label htmlFor="data-riatt">Data Riattivazione *</Label>
            <Input id="data-riatt" type="date" value={dataRiattivazione} onChange={(e) => setDataRiattivazione(e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* TIPO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Tipo</legend>
        <div className="flex items-center gap-3">
          <Label>Tipo Operazione</Label>
          <RadioGroup value="riattivazione" className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="riattivazione" id="tipo-riatt" />
              <Label htmlFor="tipo-riatt" className="font-normal cursor-pointer">Riattivazione</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="polizza-auto-riatt" checked={polizzaAuto} onCheckedChange={(v) => setPolizzaAuto(!!v)} />
          <Label htmlFor="polizza-auto-riatt" className="font-normal cursor-pointer">Polizza Auto</Label>
        </div>
      </fieldset>

      {/* POLIZZA DA RIATTIVARE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Polizza da Riattivare</legend>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[180px] max-w-[250px]">
            <Label htmlFor="numero-da-riatt">Numero</Label>
            <div className="relative">
              <Input id="numero-da-riatt" value={numeroDaRiatt} onChange={(e) => setNumeroDaRiatt(e.target.value)} placeholder="N° polizza" readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5 w-[80px]">
            <Label htmlFor="riga-da-riatt">Riga</Label>
            <Input id="riga-da-riatt" value={rigaDaRiatt} onChange={(e) => setRigaDaRiatt(e.target.value)} readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="copia-archivio" checked={copiaArchivio} onCheckedChange={(v) => setCopiaArchivio(!!v)} />
          <Label htmlFor="copia-archivio" className="font-normal cursor-pointer">Copia archivio</Label>
        </div>
      </fieldset>

      {/* ACTIONS */}
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => fromDettaglio && paramTitoloId ? navigate(`/titoli/${paramTitoloId}`) : navigate("/portafoglio/attive")}>Chiudi</Button>
        <Button onClick={handleConferma} disabled={riattivazioneMutation.isPending}>
          {riattivazioneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Conferma
        </Button>
      </div>
    </div>
  );
};

export default RiattivazionePolizzaPage;
