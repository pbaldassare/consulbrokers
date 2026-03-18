import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";

const DuplicazionePolizzaPage = () => {
  const navigate = useNavigate();

  const [codiceCliente, setCodiceCliente] = useState("");
  const [selectedAE, setSelectedAE] = useState("");
  const [numeroPolizza, setNumeroPolizza] = useState("");
  const [riga, setRiga] = useState("");
  const [appendice, setAppendice] = useState("");
  const [effetto, setEffetto] = useState("");
  const [tipoOperazione, setTipoOperazione] = useState("polizza");

  // Documento Originale
  const [docCodice, setDocCodice] = useState("");
  const [docNumero, setDocNumero] = useState("");
  const [docRiga, setDocRiga] = useState("");
  const [docAppendice, setDocAppendice] = useState("");
  const [copiaArchivio, setCopiaArchivio] = useState(false);

  const { data: clienteData } = useQuery({
    queryKey: ["cliente-lookup-dupl", codiceCliente],
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
    enabled: codiceCliente.length >= 2,
  });

  const { data: aeList } = useQuery({
    queryKey: ["ae-list-dupl"],
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

  const handleConferma = () => {
    console.log({
      codiceCliente, selectedAE, numeroPolizza, riga, appendice, effetto,
      tipoOperazione, docCodice, docNumero, docRiga, docAppendice, copiaArchivio,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Duplicazione Polizza</h1>
        <p className="text-sm text-muted-foreground mt-1">Duplicazione polizza esistente</p>
      </div>

      {/* CLIENTE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Cliente</legend>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label htmlFor="codice-cliente-dupl">Codice</Label>
            <div className="relative">
              <Input id="codice-cliente-dupl" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="Codice cliente" />
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

      {/* POLIZZA */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Polizza</legend>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[180px] max-w-[250px]">
            <Label htmlFor="numero-polizza-dupl">Numero</Label>
            <div className="relative">
              <Input id="numero-polizza-dupl" value={numeroPolizza} onChange={(e) => setNumeroPolizza(e.target.value)} placeholder="N° polizza" />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5 w-[80px]">
            <Label htmlFor="riga-dupl">Riga</Label>
            <Input id="riga-dupl" value={riga} onChange={(e) => setRiga(e.target.value)} />
          </div>
          <div className="space-y-1.5 w-[120px]">
            <Label htmlFor="appendice-dupl">Appendice</Label>
            <Input id="appendice-dupl" value={appendice} onChange={(e) => setAppendice(e.target.value)} />
          </div>
          <div className="space-y-1.5 w-[120px]">
            <Label htmlFor="effetto-dupl">Effetto</Label>
            <Input id="effetto-dupl" value={effetto} onChange={(e) => setEffetto(e.target.value)} placeholder="gg/mm/aaaa" />
          </div>
        </div>
      </fieldset>

      {/* TIPO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Tipo</legend>
        <div className="space-y-3">
          <Label>Tipo Operazione</Label>
          <RadioGroup value={tipoOperazione} onValueChange={setTipoOperazione} className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="polizza" id="tipo-polizza-dupl" />
              <Label htmlFor="tipo-polizza-dupl" className="font-normal cursor-pointer">Polizza</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="app_modifica" id="tipo-app-mod-dupl" />
              <Label htmlFor="tipo-app-mod-dupl" className="font-normal cursor-pointer">App. Modifica</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="regolazione" id="tipo-regolazione-dupl" />
              <Label htmlFor="tipo-regolazione-dupl" className="font-normal cursor-pointer">Regolazione</Label>
            </div>
          </RadioGroup>
        </div>
      </fieldset>

      {/* DOCUMENTO ORIGINALE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Documento Originale</legend>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 max-w-[200px]">
            <Label htmlFor="doc-codice-dupl">Codice</Label>
            <div className="relative">
              <Input id="doc-codice-dupl" value={docCodice} onChange={(e) => setDocCodice(e.target.value)} />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[180px] max-w-[250px]">
            <Label htmlFor="doc-numero-dupl">Numero</Label>
            <div className="relative">
              <Input id="doc-numero-dupl" value={docNumero} onChange={(e) => setDocNumero(e.target.value)} />
              <Search className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5 w-[80px]">
            <Label htmlFor="doc-riga-dupl">Riga</Label>
            <Input id="doc-riga-dupl" value={docRiga} onChange={(e) => setDocRiga(e.target.value)} />
          </div>
          <div className="space-y-1.5 w-[120px]">
            <Label htmlFor="doc-appendice-dupl">Appendice</Label>
            <Input id="doc-appendice-dupl" value={docAppendice} onChange={(e) => setDocAppendice(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox id="copia-archivio" checked={copiaArchivio} onCheckedChange={(v) => setCopiaArchivio(v === true)} />
          <Label htmlFor="copia-archivio" className="font-normal cursor-pointer">Copia archivio</Label>
        </div>
      </fieldset>

      {/* ACTIONS */}
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate("/portafoglio/gestione-polizze")}>Chiudi</Button>
        <Button onClick={handleConferma}>Conferma</Button>
      </div>
    </div>
  );
};

export default DuplicazionePolizzaPage;
