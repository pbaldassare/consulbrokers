import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Search, Loader2, User as UserIcon, FileText, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { PolizzaHeaderCard } from "@/components/polizze/PolizzaHeaderCard";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";

const SospensionePolizzaPage = () => {
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
  const [numeroPolizza, setNumeroPolizza] = useState(paramPolizza);
  const [riga, setRiga] = useState(paramRiga);
  const [dataSospensione, setDataSospensione] = useState("");
  const [limiteRiattivazione, setLimiteRiattivazione] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data: clienteFromId } = useQuery({
    queryKey: ["cliente-by-id-sosp", paramClienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale")
        .eq("id", paramClienteId)
        .maybeSingle();
      return data;
    },
    enabled: !!paramClienteId,
  });

  const { data: clienteFromSearch } = useQuery({
    queryKey: ["cliente-lookup-sosp", codiceCliente],
    queryFn: async () => {
      if (!codiceCliente || codiceCliente.length < 2) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale")
        .or(`codice_fiscale.ilike.%${codiceCliente}%,partita_iva.ilike.%${codiceCliente}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !fromDettaglio && codiceCliente.length >= 2,
  });

  const clienteData = fromDettaglio ? clienteFromId : clienteFromSearch;

  useEffect(() => {
    if (clienteFromId?.codice_fiscale && fromDettaglio) {
      setCodiceCliente(clienteFromId.codice_fiscale);
    }
  }, [clienteFromId, fromDettaglio]);

  const { data: aeList } = useQuery({
    queryKey: ["ae-list-sosp"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, sigla")
        .eq("tipo", "account_executive")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const sospensioneMutation = useMutation({
    mutationFn: async () => {
      if (!dataSospensione) throw new Error("Data sospensione obbligatoria");

      // Find titolo
      let titoloId = paramTitoloId;
      if (!titoloId && numeroPolizza) {
        const { data: found } = await supabase
          .from("titoli")
          .select("id")
          .eq("numero_titolo", numeroPolizza.trim())
          .eq("stato", "attivo")
          .limit(1)
          .maybeSingle();
        if (!found) throw new Error("Polizza non trovata o non attiva");
        titoloId = found.id;
      }
      if (!titoloId) throw new Error("Specificare una polizza");

      // Update titolo
      const { error: errUp } = await supabase
        .from("titoli")
        .update({
          stato: "sospeso",
          data_sospensione: dataSospensione,
          limite_riattivazione: limiteRiattivazione || null,
          motivo_sospensione: motivo || null,
        } as any)
        .eq("id", titoloId);
      if (errUp) throw errUp;

      // Insert movement
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloId,
        tipo_documento: "SO",
        data_movimento: dataSospensione,
        descrizione: `Sospensione polizza${motivo ? ": " + motivo : ""}`,
        stato: "sospeso",
      } as any);

      // Log
      await logAttivita({
        azione: "sospensione_polizza",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: { data_sospensione: dataSospensione, limite_riattivazione: limiteRiattivazione, motivo },
      });

      return titoloId;
    },
    onSuccess: (titoloId) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      toast.success("Polizza sospesa con successo");
      navigate(`/titoli/${titoloId}`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante la sospensione");
    },
  });

  const handleConferma = () => sospensioneMutation.mutate();

  return (
    <div className="space-y-4 max-w-4xl">
      <PolizzaHeaderCard
        titoloId={paramTitoloId || undefined}
        pageTitle="Sospensione Polizza"
        pageSubtitle={paramTitoloId ? undefined : "Sospensione polizze dal portafoglio"}
        backTo={paramTitoloId ? `/titoli/${paramTitoloId}` : "/portafoglio/attive"}
      />

      <PolizzaSection title="Cliente" icon={UserIcon}>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5 flex-1 max-w-[220px]">
            <Label htmlFor="codice-cliente-sosp">Codice</Label>
            <div className="relative">
              <Input id="codice-cliente-sosp" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="Codice cliente" readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          {clienteData && (
            <p className="text-sm text-foreground pb-2">
              {clienteData.ragione_sociale || `${clienteData.cognome} ${clienteData.nome}`}
            </p>
          )}
        </div>
        <div className="space-y-1.5 max-w-[320px] mt-3">
          <Label>A/E</Label>
          <select value={selectedAE} onChange={(e) => setSelectedAE(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">— Seleziona —</option>
            {aeList?.map((ae) => (
              <option key={ae.id} value={ae.id}>{ae.sigla || ae.codice} - {ae.cognome} {ae.nome}</option>
            ))}
          </select>
        </div>
      </PolizzaSection>

      <PolizzaSection title="Polizza" icon={FileText}>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[180px] max-w-[260px]">
            <Label htmlFor="numero-polizza-sosp">Numero</Label>
            <div className="relative">
              <Input id="numero-polizza-sosp" value={numeroPolizza} onChange={(e) => setNumeroPolizza(e.target.value)} placeholder="N° polizza" readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5 w-[80px]">
            <Label htmlFor="riga-sosp">Riga</Label>
            <Input id="riga-sosp" value={riga} onChange={(e) => setRiga(e.target.value)} readOnly={fromDettaglio} className={fromDettaglio ? "bg-muted" : ""} />
          </div>
          <div className="space-y-1.5 w-[180px]">
            <Label htmlFor="data-sosp">Data Sospensione *</Label>
            <Input id="data-sosp" type="date" value={dataSospensione} onChange={(e) => setDataSospensione(e.target.value)} className="tabular-nums" />
          </div>
          <div className="space-y-1.5 w-[180px]">
            <Label htmlFor="limite-riatt">Limite Riattivazione</Label>
            <Input id="limite-riatt" type="date" value={limiteRiattivazione} onChange={(e) => setLimiteRiattivazione(e.target.value)} className="tabular-nums" />
          </div>
        </div>
        <div className="space-y-1.5 mt-3">
          <Label htmlFor="motivo-sosp">Motivo</Label>
          <Textarea id="motivo-sosp" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo della sospensione (opzionale)" rows={2} />
        </div>
      </PolizzaSection>

      <PolizzaSection title="Tipo Operazione" icon={Settings2}>
        <RadioGroup value="sospensione" className="flex gap-4">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="sospensione" id="tipo-sosp" />
            <Label htmlFor="tipo-sosp" className="font-normal cursor-pointer">Sospensione</Label>
          </div>
        </RadioGroup>
      </PolizzaSection>

      {/* ACTIONS */}
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => fromDettaglio && paramTitoloId ? navigate(`/titoli/${paramTitoloId}`) : navigate("/portafoglio/attive")}>Chiudi</Button>
        <Button onClick={handleConferma} disabled={sospensioneMutation.isPending}>
          {sospensioneMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Conferma
        </Button>
      </div>
    </div>
  );
};

export default SospensionePolizzaPage;
