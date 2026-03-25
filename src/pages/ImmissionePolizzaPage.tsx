import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";

const ImmissionePolizzaPage = () => {
  const navigate = useNavigate();

  // Form state — Cliente
  const [codiceCliente, setCodiceCliente] = useState("");
  const [selectedAE, setSelectedAE] = useState("");
  const [selectedClienteId, setSelectedClienteId] = useState("");

  // Form state — Polizza
  const [numeroPolizza, setNumeroPolizza] = useState("");
  const [riga, setRiga] = useState("0");
  const [appendice, setAppendice] = useState("000");
  const [tipoOperazione, setTipoOperazione] = useState("polizza");
  const [polizzaAuto, setPolizzaAuto] = useState(false);
  const scannedFileRef = useRef<File | null>(null);

  // Contratto
  const [selectedCompagnia, setSelectedCompagnia] = useState("");
  const [selectedRamo, setSelectedRamo] = useState("");
  const [selectedProdotto, setSelectedProdotto] = useState("");
  const [specialist, setSpecialist] = useState("");
  const [tipoPortafoglio, setTipoPortafoglio] = useState("diretto");
  const [cigRif, setCigRif] = useState("");
  const [vincolo, setVincolo] = useState("");
  const [targaTelaio, setTargaTelaio] = useState("");
  const [descrizionePolizza, setDescrizionePolizza] = useState("");

  // Periodo
  const [durataDa, setDurataDa] = useState("");
  const [durataA, setDurataA] = useState("");
  const [anniDurata, setAnniDurata] = useState("1");
  const [tipoRinnovo, setTipoRinnovo] = useState("tacito_rinnovo");
  const [periodicita, setPeriodicita] = useState("annuale");
  const [rate, setRate] = useState("1");
  const [moraGiorni, setMoraGiorni] = useState("15");

  // Importi
  const [premioNetto, setPremioNetto] = useState("");
  const [addizionali, setAddizionali] = useState("0");
  const [tasse, setTasse] = useState("");
  const [valuta, setValuta] = useState("EUR");

  // Lookup cliente
  const { data: clienteData } = useQuery({
    queryKey: ["cliente-lookup", codiceCliente],
    queryFn: async () => {
      if (!codiceCliente || codiceCliente.length < 2) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, tipo_cliente, gruppo_finanziario_id")
        .or(`codice_fiscale.ilike.%${codiceCliente}%,partita_iva.ilike.%${codiceCliente}%,codice_ricerca.ilike.%${codiceCliente}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: codiceCliente.length >= 2,
  });

  // Auto-fetch AE dal cliente
  const { data: clienteAE } = useQuery({
    queryKey: ["cliente-ae", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return null;
      const { data } = await supabase
        .from("codici_commerciali_cliente")
        .select("profilo_id, anagrafiche_professionali:profilo_id(id, codice, cognome, nome, sigla)")
        .eq("cliente_id", selectedClienteId)
        .eq("ruolo", "account_executive")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedClienteId,
  });

  // Quando il cliente cambia, pre-compilare AE
  useEffect(() => {
    if (clienteData?.id) {
      setSelectedClienteId(clienteData.id);
    }
  }, [clienteData?.id]);

  useEffect(() => {
    if (clienteAE?.profilo_id) {
      setSelectedAE(clienteAE.profilo_id as string);
    }
  }, [clienteAE?.profilo_id]);

  // Load A/E list
  const { data: aeList } = useQuery({
    queryKey: ["ae-list-immissione"],
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

  // Load compagnie
  const { data: compagnieList } = useQuery({
    queryKey: ["compagnie-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome, codice").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  // Load rami
  const { data: ramiList } = useQuery({
    queryKey: ["rami-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione").eq("attivo", true).order("codice");
      return data || [];
    },
  });

  // Load prodotti (filtrati per compagnia)
  const { data: prodottiList } = useQuery({
    queryKey: ["prodotti-list-immissione", selectedCompagnia],
    queryFn: async () => {
      let q = supabase.from("prodotti").select("id, nome_prodotto, codice_prodotto, compagnia_id").eq("attivo", true).order("nome_prodotto");
      if (selectedCompagnia) q = q.eq("compagnia_id", selectedCompagnia);
      const { data } = await q;
      return data || [];
    },
  });

  // Auto-set compagnia when prodotto changes
  useEffect(() => {
    if (selectedProdotto && prodottiList) {
      const prod = prodottiList.find((p) => p.id === selectedProdotto);
      if (prod?.compagnia_id && !selectedCompagnia) {
        setSelectedCompagnia(prod.compagnia_id);
      }
    }
  }, [selectedProdotto, prodottiList]);

  const handleConferma = () => {
    console.log("Immissione polizza:", {
      codiceCliente, selectedClienteId, selectedAE, numeroPolizza, riga, appendice,
      tipoOperazione, polizzaAuto, selectedCompagnia, selectedRamo, selectedProdotto,
      specialist, tipoPortafoglio, durataDa, durataA, anniDurata, tipoRinnovo,
      periodicita, rate, moraGiorni, premioNetto, addizionali, tasse, valuta,
    });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Immissione Polizza</h1>
        <p className="text-sm text-muted-foreground mt-1">Inserimento nuova polizza nel portafoglio</p>
      </div>

      {/* CLIENTE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Cliente</legend>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label htmlFor="codice-cliente" className="text-xs">Codice / CF / P.IVA</Label>
            <div className="relative">
              <Input id="codice-cliente" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="Cerca cliente" className="h-8 text-xs" />
              <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          {clienteData && (
            <p className="text-sm text-foreground pb-1 font-medium">
              {clienteData.ragione_sociale || `${clienteData.cognome} ${clienteData.nome}`}
            </p>
          )}
        </div>
        <div className="space-y-1.5 max-w-[300px]">
          <Label className="text-xs">A/E (ereditato dal cliente)</Label>
          <SearchableSelect
            className="h-8 text-xs"
            value={selectedAE}
            onValueChange={setSelectedAE}
            placeholder="— Seleziona A/E —"
            options={(aeList || []).map((ae) => ({
              value: ae.id,
              label: `${ae.sigla || ae.codice} - ${ae.cognome} ${ae.nome}`,
            }))}
          />
        </div>
      </fieldset>

      {/* CONTRATTO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Contratto</legend>

        <AiDocumentScanner
          documentType="copia_polizza"
          onFileReady={(file) => { scannedFileRef.current = file; }}
          onExtracted={(data) => {
            if (data.numero_polizza) setNumeroPolizza(data.numero_polizza as string);
          }}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Compagnia</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedCompagnia}
              onValueChange={setSelectedCompagnia}
              placeholder="— Compagnia —"
              options={(compagnieList || []).map((c) => ({ value: c.id, label: `${c.codice || ""} - ${c.nome}` }))}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Ramo</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedRamo}
              onValueChange={setSelectedRamo}
              placeholder="— Ramo —"
              options={(ramiList || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }))}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Prodotto</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedProdotto}
              onValueChange={setSelectedProdotto}
              placeholder="— Prodotto —"
              options={(prodottiList || []).map((p) => ({ value: p.id, label: `${p.codice_prodotto || ""} - ${p.nome_prodotto}` }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Specialist</Label>
            <SearchableSelect className="h-8 text-xs" value={specialist} onValueChange={setSpecialist} placeholder="—"
              options={[{ value: "danni", label: "Danni" }, { value: "vita", label: "Vita" }, { value: "auto", label: "Auto" }, { value: "re", label: "RE" }]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo Portafoglio</Label>
            <SearchableSelect className="h-8 text-xs" value={tipoPortafoglio} onValueChange={setTipoPortafoglio} placeholder="—"
              options={[{ value: "diretto", label: "Diretto" }, { value: "indiretto", label: "Indiretto" }, { value: "ri", label: "Riassicurazione" }]}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">N° Polizza</Label>
            <div className="relative">
              <Input value={numeroPolizza} onChange={(e) => setNumeroPolizza(e.target.value)} placeholder="N° polizza" className="h-8 text-xs" />
              <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Riga</Label>
            <Input value={riga} onChange={(e) => setRiga(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Appendice</Label>
            <Input value={appendice} onChange={(e) => setAppendice(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Targa/Telaio</Label>
            <Input value={targaTelaio} onChange={(e) => setTargaTelaio(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">CIG/Rif.</Label>
            <Input value={cigRif} onChange={(e) => setCigRif(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vincolo</Label>
            <Input value={vincolo} onChange={(e) => setVincolo(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </fieldset>

      {/* PERIODO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Periodo</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Durata Da</Label>
            <Input type="date" value={durataDa} onChange={(e) => setDurataDa(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Durata A</Label>
            <Input type="date" value={durataA} onChange={(e) => setDurataA(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anni Durata</Label>
            <Input type="number" value={anniDurata} onChange={(e) => setAnniDurata(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rate</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo Rinnovo</Label>
            <SearchableSelect className="h-8 text-xs" value={tipoRinnovo} onValueChange={setTipoRinnovo} placeholder="—"
              options={[
                { value: "tacito_rinnovo", label: "Tacito Rinnovo" },
                { value: "scadenza_naturale", label: "Scadenza Naturale" },
                { value: "libera", label: "Libera" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Periodicità</Label>
            <SearchableSelect className="h-8 text-xs" value={periodicita} onValueChange={setPeriodicita} placeholder="—"
              options={[
                { value: "annuale", label: "Annuale" },
                { value: "semestrale", label: "Semestrale" },
                { value: "trimestrale", label: "Trimestrale" },
                { value: "mensile", label: "Mensile" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GG Mora</Label>
            <Input type="number" value={moraGiorni} onChange={(e) => setMoraGiorni(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </fieldset>

      {/* IMPORTI */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Importi</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Premio Netto €</Label>
            <Input type="number" step="0.01" value={premioNetto} onChange={(e) => setPremioNetto(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Addizionali €</Label>
            <Input type="number" step="0.01" value={addizionali} onChange={(e) => setAddizionali(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tasse €</Label>
            <Input type="number" step="0.01" value={tasse} onChange={(e) => setTasse(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valuta</Label>
            <SearchableSelect className="h-8 text-xs" value={valuta} onValueChange={setValuta} placeholder="—"
              options={[{ value: "EUR", label: "EUR" }, { value: "USD", label: "USD" }, { value: "GBP", label: "GBP" }]}
            />
          </div>
        </div>
      </fieldset>

      {/* TIPO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Tipo</legend>
        <div className="space-y-3">
          <Label className="text-xs">Tipo Operazione</Label>
          <RadioGroup value={tipoOperazione} onValueChange={setTipoOperazione} className="flex flex-wrap gap-4">
            {[
              { value: "polizza", label: "Polizza" },
              { value: "emittenda", label: "Emittenda" },
              { value: "cp_nuova", label: "CP (Nuova)" },
              { value: "cp_sost_rinn", label: "CP (Sost/Rinn)" },
            ].map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                <Label htmlFor={`tipo-${opt.value}`} className="font-normal cursor-pointer text-xs">{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox id="polizza-auto" checked={polizzaAuto} onCheckedChange={(v) => setPolizzaAuto(v === true)} />
          <Label htmlFor="polizza-auto" className="font-normal cursor-pointer text-xs">Polizza Auto</Label>
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

export default ImmissionePolizzaPage;
