import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, Search } from "lucide-react";
import ServerPagination from "@/components/ServerPagination";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { parseCF } from "@/lib/parseCF";
import { lookupComune } from "@/lib/comuniItaliani";
import { useLookupZone, useLookupIndotti, useLookupAttivita, useLookupSettori, useLookupContratti, useLookupFasceFatturato, useLookupFasceDipendenti, useGruppiStatistici } from "@/hooks/useLookupTables";

interface CommercialRole {
  profilo_id: string;
  percentuale: string;
  societa_brand: string;
  filiale: string;
  mandato: string;
  data_acquisito: string;
  scadenza_mandato: string;
  data_disdetta: string;
  termine_proroga: string;
  altro_broker: boolean;
  altro_broker_nome: string;
}

const emptyRole = (): CommercialRole => ({
  profilo_id: "",
  percentuale: "",
  societa_brand: "",
  filiale: "",
  mandato: "",
  data_acquisito: "",
  scadenza_mandato: "",
  data_disdetta: "",
  termine_proroga: "",
  altro_broker: false,
  altro_broker_nome: "",
});

/* ── Dati Statistici sub-component for Create dialog ── */
function DatiStatisticiCreate(props: {
  zona: string; setZona: (v: string) => void;
  indotto: string; setIndotto: (v: string) => void;
  attivita: string; setAttivita: (v: string) => void;
  settore: string; setSettore: (v: string) => void;
  contratto: string; setContratto: (v: string) => void;
  gruppoFinanziarioId: string; setGruppoFinanziarioId: (v: string) => void;
  gruppoStatistico: string; setGruppoStatistico: (v: string) => void;
  fasciaFatturato: string; setFasciaFatturato: (v: string) => void;
  fasciaDipendenti: string; setFasciaDipendenti: (v: string) => void;
  aziendaStat: string; setAziendaStat: (v: string) => void;
  matricola: string; setMatricola: (v: string) => void;
  riferimento: string; setRiferimento: (v: string) => void;
  codiceAteco: string; setCodiceAteco: (v: string) => void;
  clienteAssociato: boolean; setClienteAssociato: (v: boolean) => void;
  clienteCaptive: boolean; setClienteCaptive: (v: boolean) => void;
  internazionale: boolean; setInternazionale: (v: boolean) => void;
  gruppiFinanziari: any[];
}) {
  const { data: zoneOpts = [] } = useLookupZone();
  const { data: indottiOpts = [] } = useLookupIndotti();
  const { data: attivitaOpts = [] } = useLookupAttivita();
  const { data: settoriOpts = [] } = useLookupSettori();
  const { data: contrattiOpts = [] } = useLookupContratti();
  const { data: fasceFatturatoOpts = [] } = useLookupFasceFatturato();
  const { data: fasceDipendentiOpts = [] } = useLookupFasceDipendenti();
  const { data: gruppiStatOpts = [] } = useGruppiStatistici();

  const p = props;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Gruppo Finanziario</Label>
          <SearchableSelect
            value={p.gruppoFinanziarioId}
            onValueChange={p.setGruppoFinanziarioId}
            placeholder="— Seleziona gruppo finanziario —"
            options={p.gruppiFinanziari.map((g: any) => ({ value: g.id, label: `${g.codice} - ${g.nome}` }))}
          />
        </div>
        <div>
          <Label className="text-xs">Gruppo Statistico</Label>
          <SearchableSelect value={p.gruppoStatistico} onValueChange={p.setGruppoStatistico} placeholder="— Seleziona —" options={gruppiStatOpts} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Zona</Label><SearchableSelect value={p.zona} onValueChange={p.setZona} placeholder="— Seleziona —" options={zoneOpts} /></div>
        <div><Label className="text-xs">Indotto</Label><SearchableSelect value={p.indotto} onValueChange={p.setIndotto} placeholder="— Seleziona —" options={indottiOpts} /></div>
        <div><Label className="text-xs">Attività</Label><SearchableSelect value={p.attivita} onValueChange={p.setAttivita} placeholder="— Seleziona —" options={attivitaOpts} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Settore</Label><SearchableSelect value={p.settore} onValueChange={p.setSettore} placeholder="— Seleziona —" options={settoriOpts} /></div>
        <div><Label className="text-xs">Azienda Stat.</Label><Input value={p.aziendaStat} onChange={(e) => p.setAziendaStat(e.target.value)} /></div>
        <div><Label className="text-xs">Contratto</Label><SearchableSelect value={p.contratto} onValueChange={p.setContratto} placeholder="— Seleziona —" options={contrattiOpts} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Matricola</Label><Input value={p.matricola} onChange={(e) => p.setMatricola(e.target.value)} /></div>
        <div><Label className="text-xs">Riferimento</Label><Input value={p.riferimento} onChange={(e) => p.setRiferimento(e.target.value)} /></div>
        <div><Label className="text-xs">Codice ATECO</Label><Input value={p.codiceAteco} onChange={(e) => p.setCodiceAteco(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Fascia Fatturato</Label><SearchableSelect value={p.fasciaFatturato} onValueChange={p.setFasciaFatturato} placeholder="— Seleziona —" options={fasceFatturatoOpts} /></div>
        <div><Label className="text-xs">Fascia Dipendenti</Label><SearchableSelect value={p.fasciaDipendenti} onValueChange={p.setFasciaDipendenti} placeholder="— Seleziona —" options={fasceDipendentiOpts} /></div>
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2"><Switch checked={p.clienteAssociato} onCheckedChange={p.setClienteAssociato} /><Label className="text-xs">Cliente Associato</Label></div>
        <div className="flex items-center gap-2"><Switch checked={p.clienteCaptive} onCheckedChange={p.setClienteCaptive} /><Label className="text-xs">Cliente Captive</Label></div>
        <div className="flex items-center gap-2"><Switch checked={p.internazionale} onCheckedChange={p.setInternazionale} /><Label className="text-xs">Internazionale</Label></div>
      </div>
    </div>
  );
}

const ClientiList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"denominazione" | "created_at">("denominazione");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when sort changes
  useEffect(() => { setPage(0); }, [sortBy]);

  // Form state
  const [tipoCliente, setTipoCliente] = useState<"privato" | "azienda" | "ente">("privato");
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [dataNascita, setDataNascita] = useState("");
  const [luogoNascita, setLuogoNascita] = useState("");
  const [indirizzoResidenza, setIndirizzoResidenza] = useState("");
  const [capResidenza, setCapResidenza] = useState("");
  const [cittaResidenza, setCittaResidenza] = useState("");
  const [provinciaResidenza, setProvinciaResidenza] = useState("");
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [partitaIva, setPartitaIva] = useState("");
  const [codiceFiscaleAzienda, setCodiceFiscaleAzienda] = useState("");
  const [codiceSdi, setCodiceSdi] = useState("");
  const [formaGiuridica, setFormaGiuridica] = useState("");
  const [indirizzoSede, setIndirizzoSede] = useState("");
  const [capSede, setCapSede] = useState("");
  const [cittaSede, setCittaSede] = useState("");
  const [provinciaSede, setProvinciaSede] = useState("");
  const [referenteNome, setReferenteNome] = useState("");
  const [referenteCognome, setReferenteCognome] = useState("");
  const [referenteTelefono, setReferenteTelefono] = useState("");
  const [referenteEmail, setReferenteEmail] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [pec, setPec] = useState("");
  const [gruppoFinanziarioId, setGruppoFinanziarioId] = useState("");
  const scannedFilesRef = useRef<{ file: File; documentType: string }[]>([]);

  // Dati Gestionali
  const [codiceRicerca, setCodiceRicerca] = useState("");
  const [titolo, setTitolo] = useState("");
  const [statoCliente, setStatoCliente] = useState("");
  const [prospect, setProspect] = useState("");
  const [tipoPersona, setTipoPersona] = useState("");
  const [sesso, setSesso] = useState("");
  const [comuneNascita, setComuneNascita] = useState("");
  const [provinciaNascita, setProvinciaNascita] = useState("");
  const [tipoSommario, setTipoSommario] = useState("");
  const [clienteNonCeduto, setClienteNonCeduto] = useState(false);
  const [aziendaSsnSx, setAziendaSsnSx] = useState(false);
  const [statisticaPremiSinistri, setStatisticaPremiSinistri] = useState(false);
  const [specSxDanni, setSpecSxDanni] = useState("");
  const [specSxSanita, setSpecSxSanita] = useState("");
  const [cellulare, setCellulare] = useState("");
  const [fax, setFax] = useState("");
  const [nazione, setNazione] = useState("");
  const [attenzioneDi, setAttenzioneDi] = useState("");
  const [note, setNote] = useState("");

  // Indirizzi aggiuntivi
  const [indirizzoAlternativo, setIndirizzoAlternativo] = useState("");
  const [capAlternativo, setCapAlternativo] = useState("");
  const [cittaAlternativa, setCittaAlternativa] = useState("");
  const [provinciaAlternativa, setProvinciaAlternativa] = useState("");
  const [indirizzoFiscale, setIndirizzoFiscale] = useState("");
  const [capFiscale, setCapFiscale] = useState("");
  const [cittaFiscale, setCittaFiscale] = useState("");
  const [provinciaFiscale, setProvinciaFiscale] = useState("");

  // Dati Statistici
  const [zona, setZona] = useState("");
  const [indotto, setIndotto] = useState("");
  const [attivita, setAttivita] = useState("");
  const [settore, setSettore] = useState("");
  const [aziendaStat, setAziendaStat] = useState("");
  const [contratto, setContratto] = useState("");
  const [matricola, setMatricola] = useState("");
  const [riferimento, setRiferimento] = useState("");
  const [fatturato, setFatturato] = useState("");
  const [numDipendenti, setNumDipendenti] = useState("");
  const [fascia_fatturato, setFasciaFatturato] = useState("");
  const [fascia_dipendenti, setFasciaDipendenti] = useState("");
  const [codiceAteco, setCodiceAteco] = useState("");
  const [clienteAssociato, setClienteAssociato] = useState(false);
  const [clienteCaptive, setClienteCaptive] = useState(false);
  const [internazionale, setInternazionale] = useState(false);
  const [gruppoStatistico, setGruppoStatistico] = useState("");

  // Dati Contabili
  const [fidoCredito, setFidoCredito] = useState("");
  const [fidoCauzioni, setFidoCauzioni] = useState("");

  // Rete Commerciale state
  const [ae, setAe] = useState<CommercialRole>(emptyRole());
  const [backofficeRole, setBackofficeRole] = useState<CommercialRole>(emptyRole());
  const [agente, setAgente] = useState<CommercialRole>(emptyRole());
  const [produttoreSede, setProduttoreSede] = useState<CommercialRole>(emptyRole());

  const handleFileReady = useCallback((file: File, documentType: DocumentType) => {
    scannedFilesRef.current.push({ file, documentType });
  }, []);

  const uploadScannedFiles = useCallback(async (clienteId: string) => {
    const files = scannedFilesRef.current;
    if (files.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    for (const { file, documentType } of files) {
      const ts = Date.now();
      const path = `cliente/${clienteId}/${ts}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("documenti_clienti")
        .upload(path, file);
      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        continue;
      }
      await supabase.from("documenti").insert({
        nome_file: file.name,
        path_storage: path,
        bucket_name: "documenti_clienti",
        entita_tipo: "cliente",
        entita_id: clienteId,
        caricato_da: userId,
        categoria: documentType,
      });
    }
    scannedFilesRef.current = [];
  }, []);

  const { data: clientiResult, isLoading } = useQuery({
    queryKey: ["clienti", debouncedSearch, sortBy, page],
    queryFn: async () => {
      let query = supabase
        .from("clienti")
        .select("*", { count: "exact" });

      // Server-side search across all fields
      if (debouncedSearch) {
        const s = `%${debouncedSearch}%`;
        query = query.or(
          `nome.ilike.${s},cognome.ilike.${s},ragione_sociale.ilike.${s},codice_fiscale.ilike.${s},codice_fiscale_azienda.ilike.${s},partita_iva.ilike.${s},email.ilike.${s},pec.ilike.${s},telefono.ilike.${s},citta_residenza.ilike.${s},citta_sede.ilike.${s},codice_ricerca.ilike.${s}`
        );
      }

      // Server-side sorting
      if (sortBy === "denominazione") {
        query = query.order("cognome", { ascending: true, nullsFirst: false })
                     .order("ragione_sociale", { ascending: true, nullsFirst: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      // Pagination
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], totalCount: count || 0 };
    },
  });

  const clienti = clientiResult?.data || [];
  const totalCount = clientiResult?.totalCount || 0;

  // Conteggio polizze per cliente
  const { data: polizzeCountMap = {} } = useQuery({
    queryKey: ["count_polizze_per_cliente"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("count_polizze_per_cliente");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => { map[r.cliente_id] = Number(r.count); });
      return map;
    },
  });

  const { data: gruppiFinanziari = [] } = useQuery({
    queryKey: ["gruppi_finanziari_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_finanziari" as any)
        .select("id, codice, nome")
        .eq("attivo", true)
        .order("codice");
      return (data || []) as any[];
    },
  });

  const { data: profiliCommercialiRaw = [] } = useQuery({
    queryKey: ["profili_commerciali_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo")
        .in("ruolo", ["admin", "produttore", "responsabile_sede", "produttore_sede", "executive", "backoffice"])
        .order("cognome");
      return data || [];
    },
  });

  const profiliCommerciali = profiliCommercialiRaw.map((p: any) => ({
    value: p.id,
    label: `${p.cognome || ""} ${p.nome || ""} (${p.ruolo})`.trim(),
  }));

  // Auto-fill backoffice role when dialog opens
  useEffect(() => {
    if (open && !backofficeRole.profilo_id) {
      const backofficeProfile = profiliCommercialiRaw.find((p: any) => p.ruolo === "backoffice");
      if (backofficeProfile) {
        setBackofficeRole(prev => ({ ...prev, profilo_id: backofficeProfile.id }));
      }
    }
  }, [open, profiliCommercialiRaw]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, attivo }: { id: string; attivo: boolean }) => {
      const { error } = await supabase.from("clienti").update({ attivo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clienti"] }),
  });

  const insertCommercialRoles = async (clienteId: string) => {
    const roles: { ruolo: string; data: CommercialRole }[] = [
      { ruolo: "AE", data: ae },
      { ruolo: "Backoffice", data: backofficeRole },
      { ruolo: "Agente", data: agente },
      { ruolo: "Produttore Sede", data: produttoreSede },
    ];
    const rows = roles
      .filter((r) => r.data.profilo_id)
      .map((r) => ({
        cliente_id: clienteId,
        profilo_id: r.data.profilo_id,
        ruolo: r.ruolo,
        percentuale: r.data.percentuale ? parseFloat(r.data.percentuale) : null,
        societa_brand: r.data.societa_brand || null,
        filiale: r.data.filiale || null,
        mandato: r.data.mandato || null,
        data_acquisito: r.data.data_acquisito || null,
        scadenza_mandato: r.data.scadenza_mandato || null,
        data_disdetta: r.data.data_disdetta || null,
        termine_proroga: r.data.termine_proroga || null,
        altro_broker: r.data.altro_broker,
        altro_broker_nome: r.data.altro_broker_nome || null,
      }));
    if (rows.length > 0) {
      const { error } = await supabase.from("codici_commerciali_cliente").insert(rows as any);
      if (error) console.error("Errore inserimento rete commerciale:", error);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        tipo_cliente: tipoCliente,
        email: email || null,
        telefono: telefono || null,
        pec: pec || null,
        gruppo_finanziario_id: gruppoFinanziarioId || null,
        // Gestionali
        codice_ricerca: codiceRicerca || null,
        titolo: titolo || null,
        stato_cliente: statoCliente || null,
        prospect: prospect || null,
        tipo_persona: tipoPersona || null,
        sesso: sesso || null,
        comune_nascita: comuneNascita || null,
        provincia_nascita: provinciaNascita || null,
        tipo_sommario: tipoSommario || null,
        cliente_non_ceduto: clienteNonCeduto,
        azienda_ssn_sx: aziendaSsnSx,
        statistica_premi_sinistri: statisticaPremiSinistri,
        spec_sx_danni: specSxDanni || null,
        spec_sx_sanita: specSxSanita || null,
        cellulare: cellulare || null,
        fax: fax || null,
        nazione: nazione || null,
        attenzione_di: attenzioneDi || null,
        note: note || null,
        // Indirizzi aggiuntivi
        indirizzo_alternativo: indirizzoAlternativo || null,
        cap_alternativo: capAlternativo || null,
        citta_alternativa: cittaAlternativa || null,
        provincia_alternativa: provinciaAlternativa || null,
        indirizzo_fiscale: indirizzoFiscale || null,
        cap_fiscale: capFiscale || null,
        citta_fiscale: cittaFiscale || null,
        provincia_fiscale: provinciaFiscale || null,
        // Statistici
        zona: zona || null,
        indotto: indotto || null,
        attivita: attivita || null,
        settore: settore || null,
        azienda_stat: aziendaStat || null,
        contratto: contratto || null,
        matricola: matricola || null,
        riferimento: riferimento || null,
        fatturato: fatturato ? parseFloat(fatturato) : null,
        num_dipendenti: numDipendenti ? parseInt(numDipendenti) : null,
        fascia_fatturato: fascia_fatturato || null,
        fascia_dipendenti: fascia_dipendenti || null,
        codice_ateco: codiceAteco || null,
        cliente_associato: clienteAssociato,
        cliente_captive: clienteCaptive,
        internazionale: internazionale,
        gruppo_statistico: gruppoStatistico || null,
        // Contabili
        fido_credito: fidoCredito ? parseFloat(fidoCredito) : null,
        fido_cauzioni: fidoCauzioni ? parseFloat(fidoCauzioni) : null,
      };
      if (tipoCliente === "privato") {
        payload.nome = nome || null;
        payload.cognome = cognome || null;
        payload.codice_fiscale = codiceFiscale || null;
        payload.data_nascita = dataNascita || null;
        payload.luogo_nascita = luogoNascita || null;
        payload.indirizzo_residenza = indirizzoResidenza || null;
        payload.cap_residenza = capResidenza || null;
        payload.citta_residenza = cittaResidenza || null;
        payload.provincia_residenza = provinciaResidenza || null;
      } else {
        payload.ragione_sociale = ragioneSociale || null;
        payload.partita_iva = partitaIva || null;
        payload.codice_fiscale_azienda = codiceFiscaleAzienda || null;
        payload.codice_sdi = codiceSdi || null;
        payload.forma_giuridica = formaGiuridica || null;
        payload.indirizzo_sede = indirizzoSede || null;
        payload.cap_sede = capSede || null;
        payload.citta_sede = cittaSede || null;
        payload.provincia_sede = provinciaSede || null;
        payload.referente_nome = referenteNome || null;
        payload.referente_cognome = referenteCognome || null;
        payload.referente_telefono = referenteTelefono || null;
        payload.referente_email = referenteEmail || null;
      }
      const { data, error } = await supabase.from("clienti").insert(payload as any).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      if (data?.id) {
        await Promise.all([
          uploadScannedFiles(data.id),
          insertCommercialRoles(data.id),
        ]);
      }
      queryClient.invalidateQueries({ queryKey: ["clienti"] });
      toast.success("Cliente creato con successo");
      resetForm();
      setOpen(false);
    },
    onError: (err: Error) => {
      toast.error("Errore");
    },
  });

  const resetForm = () => {
    setNome(""); setCognome(""); setCodiceFiscale(""); setDataNascita("");
    setLuogoNascita(""); setIndirizzoResidenza(""); setCapResidenza("");
    setCittaResidenza(""); setProvinciaResidenza(""); setRagioneSociale("");
    setPartitaIva(""); setCodiceFiscaleAzienda(""); setCodiceSdi("");
    setFormaGiuridica(""); setIndirizzoSede(""); setCapSede("");
    setCittaSede(""); setProvinciaSede(""); setReferenteNome("");
    setReferenteCognome(""); setReferenteTelefono(""); setReferenteEmail("");
    setEmail(""); setTelefono(""); setPec(""); setTipoCliente("privato");
    setGruppoFinanziarioId("");
    setAe(emptyRole()); setBackofficeRole(emptyRole()); setAgente(emptyRole()); setProduttoreSede(emptyRole());
    // Gestionali
    setCodiceRicerca(""); setTitolo(""); setStatoCliente(""); setProspect("");
    setTipoPersona(""); setSesso(""); setComuneNascita(""); setProvinciaNascita("");
    setTipoSommario(""); setClienteNonCeduto(false); setAziendaSsnSx(false);
    setStatisticaPremiSinistri(false); setSpecSxDanni(""); setSpecSxSanita("");
    setCellulare(""); setFax(""); setNazione(""); setAttenzioneDi(""); setNote("");
    setIndirizzoAlternativo(""); setCapAlternativo(""); setCittaAlternativa(""); setProvinciaAlternativa("");
    setIndirizzoFiscale(""); setCapFiscale(""); setCittaFiscale(""); setProvinciaFiscale("");
    // Statistici
    setZona(""); setIndotto(""); setAttivita(""); setSettore("");
    setAziendaStat(""); setContratto(""); setMatricola(""); setRiferimento("");
    setFatturato(""); setNumDipendenti(""); setCodiceAteco(""); setGruppoStatistico("");
    setClienteAssociato(false); setClienteCaptive(false); setInternazionale(false);
    // Contabili
    setFidoCredito(""); setFidoCauzioni("");
    scannedFilesRef.current = [];
  };

  // Server-side filtering/sorting — data already comes filtered and sorted

  const updateRole = (setter: React.Dispatch<React.SetStateAction<CommercialRole>>, field: keyof CommercialRole, value: any) => {
    setter((prev) => ({ ...prev, [field]: value }));
  };

  const renderCorrispondenteFields = (role: CommercialRole, setter: React.Dispatch<React.SetStateAction<CommercialRole>>) => (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Profilo</Label>
          <SearchableSelect
            value={role.profilo_id}
            onValueChange={(v) => updateRole(setter, "profilo_id", v)}
            placeholder="Seleziona..."
            options={profiliCommerciali}
          />
        </div>
        <div>
          <Label className="text-xs">% Provvigione</Label>
          <Input value={role.percentuale} onChange={(e) => updateRole(setter, "percentuale", e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs">Società/Brand</Label>
          <Input value={role.societa_brand} onChange={(e) => updateRole(setter, "societa_brand", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Filiale</Label>
          <Input value={role.filiale} onChange={(e) => updateRole(setter, "filiale", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Mandato</Label>
          <Input value={role.mandato} onChange={(e) => updateRole(setter, "mandato", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Data Acquisizione</Label>
          <Input type="date" value={role.data_acquisito} onChange={(e) => updateRole(setter, "data_acquisito", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Scadenza Mandato</Label>
          <Input type="date" value={role.scadenza_mandato} onChange={(e) => updateRole(setter, "scadenza_mandato", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Data Disdetta</Label>
          <Input type="date" value={role.data_disdetta} onChange={(e) => updateRole(setter, "data_disdetta", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Termine Proroga</Label>
          <Input type="date" value={role.termine_proroga} onChange={(e) => updateRole(setter, "termine_proroga", e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Switch checked={role.altro_broker} onCheckedChange={(v) => updateRole(setter, "altro_broker", v)} />
          <Label className="text-xs">Altro Broker</Label>
        </div>
        {role.altro_broker && (
          <div>
            <Label className="text-xs">Nome Altro Broker</Label>
            <Input value={role.altro_broker_nome} onChange={(e) => updateRole(setter, "altro_broker_nome", e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clienti</h1>
          <p className="text-muted-foreground">Anagrafica clienti privati, aziende ed enti</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Nuovo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuovo Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo Cliente</Label>
                <Select value={tipoCliente} onValueChange={(v) => setTipoCliente(v as "privato" | "azienda" | "ente")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="privato">Privato</SelectItem>
                    <SelectItem value="azienda">Azienda</SelectItem>
                    <SelectItem value="ente">Ente</SelectItem>
                  </SelectContent>
                </Select>
               </div>

              {/* AI Document Scanner */}
              {tipoCliente === "privato" ? (
                <div className="flex flex-wrap gap-2">
                  <AiDocumentScanner
                    documentType="carta_identita"
                    onFileReady={handleFileReady}
                    onExtracted={(data) => {
                      if (data.nome) setNome(data.nome as string);
                      if (data.cognome) setCognome(data.cognome as string);
                      if (data.codice_fiscale) setCodiceFiscale((data.codice_fiscale as string).toUpperCase());
                      if (data.data_nascita) setDataNascita(data.data_nascita as string);
                      if (data.luogo_nascita) setLuogoNascita(data.luogo_nascita as string);
                      if (data.indirizzo) setIndirizzoResidenza(data.indirizzo as string);
                      if (data.cap) setCapResidenza(data.cap as string);
                      if (data.citta) setCittaResidenza(data.citta as string);
                      if (data.provincia) setProvinciaResidenza((data.provincia as string).toUpperCase());
                    }}
                  />
                  <AiDocumentScanner
                    documentType="tessera_sanitaria"
                    onFileReady={handleFileReady}
                    onExtracted={(data) => {
                      if (data.codice_fiscale) setCodiceFiscale((data.codice_fiscale as string).toUpperCase());
                      if (data.nome) setNome(data.nome as string);
                      if (data.cognome) setCognome(data.cognome as string);
                      if (data.data_nascita) setDataNascita(data.data_nascita as string);
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <AiDocumentScanner
                    documentType="visura_camerale"
                    onFileReady={handleFileReady}
                    onExtracted={(data) => {
                      if (data.ragione_sociale) setRagioneSociale(data.ragione_sociale as string);
                      if (data.partita_iva) setPartitaIva(data.partita_iva as string);
                      if (data.codice_fiscale) setCodiceFiscaleAzienda((data.codice_fiscale as string).toUpperCase());
                      if (data.codice_sdi) setCodiceSdi(data.codice_sdi as string);
                      if (data.forma_giuridica) {
                        const fg = (data.forma_giuridica as string).toLowerCase().replace(/\s/g, "_");
                        setFormaGiuridica(fg);
                      }
                      if (data.indirizzo_sede) setIndirizzoSede(data.indirizzo_sede as string);
                      if (data.cap) setCapSede(data.cap as string);
                      if (data.citta) setCittaSede(data.citta as string);
                      if (data.provincia) setProvinciaSede((data.provincia as string).toUpperCase());
                      if (data.pec) setPec(data.pec as string);
                    }}
                  />
                </div>
              )}

              {tipoCliente === "privato" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                    <div><Label>Cognome</Label><Input value={cognome} onChange={(e) => setCognome(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Codice Fiscale</Label><Input value={codiceFiscale} onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setCodiceFiscale(val);
                      if (val.length === 16) {
                        const parsed = parseCF(val);
                        if (parsed) {
                          if (!sesso) setSesso(parsed.sesso);
                          if (!dataNascita) setDataNascita(parsed.dataNascita);
                          const info = lookupComune(parsed.codiceCatastale);
                          if (info) {
                            if (!comuneNascita) setComuneNascita(info.comune);
                            if (!provinciaNascita) setProvinciaNascita(info.provincia);
                          }
                          toast.info("Dati estratti automaticamente dal Codice Fiscale");
                        }
                      }
                    }} maxLength={16} /></div>
                    <div><Label>Data di Nascita</Label><Input type="date" value={dataNascita} onChange={(e) => setDataNascita(e.target.value)} /></div>
                  </div>
                  <div><Label>Luogo di Nascita</Label><Input value={luogoNascita} onChange={(e) => setLuogoNascita(e.target.value)} /></div>
                  <div><Label>Indirizzo Residenza</Label><AddressAutocomplete value={indirizzoResidenza} onChange={setIndirizzoResidenza} onSelect={(c) => { setCapResidenza(c.cap); setCittaResidenza(c.citta); setProvinciaResidenza(c.provincia); }} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>CAP</Label><Input value={capResidenza} onChange={(e) => setCapResidenza(e.target.value)} maxLength={5} /></div>
                    <div><Label>Città</Label><Input value={cittaResidenza} onChange={(e) => setCittaResidenza(e.target.value)} /></div>
                    <div><Label>Provincia</Label><Input value={provinciaResidenza} onChange={(e) => setProvinciaResidenza(e.target.value)} maxLength={2} /></div>
                  </div>
                </>
              ) : (
                <>
                  <div><Label>Ragione Sociale</Label><Input value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Partita IVA</Label><Input value={partitaIva} onChange={(e) => setPartitaIva(e.target.value.toUpperCase())} maxLength={11} /></div>
                    <div><Label>Codice Fiscale Azienda</Label><Input value={codiceFiscaleAzienda} onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setCodiceFiscaleAzienda(val);
                      if (val.length === 11 && /^\d{11}$/.test(val) && !partitaIva) {
                        setPartitaIva(val);
                        toast.info("Partita IVA copiata dal Codice Fiscale Azienda");
                      }
                    }} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Codice SDI</Label><Input value={codiceSdi} onChange={(e) => setCodiceSdi(e.target.value)} maxLength={7} /></div>
                    <div>
                      <Label>Forma Giuridica</Label>
                      <SearchableSelect
                        value={formaGiuridica}
                        onValueChange={setFormaGiuridica}
                        placeholder="Seleziona..."
                        options={[
                          { value: "srl", label: "SRL" },
                          { value: "srls", label: "SRLS" },
                          { value: "spa", label: "SPA" },
                          { value: "snc", label: "SNC" },
                          { value: "sas", label: "SAS" },
                          { value: "ditta_individuale", label: "Ditta Individuale" },
                          { value: "cooperativa", label: "Cooperativa" },
                          { value: "altro", label: "Altro" },
                        ]}
                      />
                    </div>
                  </div>
                  <div><Label>Indirizzo Sede</Label><AddressAutocomplete value={indirizzoSede} onChange={setIndirizzoSede} onSelect={(c) => { setCapSede(c.cap); setCittaSede(c.citta); setProvinciaSede(c.provincia); }} /></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>CAP</Label><Input value={capSede} onChange={(e) => setCapSede(e.target.value)} maxLength={5} /></div>
                    <div><Label>Città</Label><Input value={cittaSede} onChange={(e) => setCittaSede(e.target.value)} /></div>
                    <div><Label>Provincia</Label><Input value={provinciaSede} onChange={(e) => setProvinciaSede(e.target.value)} maxLength={2} /></div>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Referente Aziendale</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Nome Referente</Label><Input value={referenteNome} onChange={(e) => setReferenteNome(e.target.value)} /></div>
                      <div><Label>Cognome Referente</Label><Input value={referenteCognome} onChange={(e) => setReferenteCognome(e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div><Label>Telefono Referente</Label><Input value={referenteTelefono} onChange={(e) => setReferenteTelefono(e.target.value)} /></div>
                      <div><Label>Email Referente</Label><Input type="email" value={referenteEmail} onChange={(e) => setReferenteEmail(e.target.value)} /></div>
                    </div>
                  </div>
                </>
              )}

              {/* Sezioni aggiuntive in Accordion */}
              <Accordion type="multiple" className="w-full border-t pt-4">
                {/* Dati Gestionali */}
                <AccordionItem value="gestionali">
                  <AccordionTrigger className="text-sm font-medium">Dati Gestionali</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Codice Ricerca</Label>
                          <Input value={codiceRicerca} onChange={(e) => setCodiceRicerca(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Titolo</Label>
                          <Select value={titolo} onValueChange={setTitolo}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sig">Sig.</SelectItem>
                              <SelectItem value="sig_ra">Sig.ra</SelectItem>
                              <SelectItem value="dott">Dott.</SelectItem>
                              <SelectItem value="dott_ssa">Dott.ssa</SelectItem>
                              <SelectItem value="ing">Ing.</SelectItem>
                              <SelectItem value="avv">Avv.</SelectItem>
                              <SelectItem value="prof">Prof.</SelectItem>
                              <SelectItem value="rag">Rag.</SelectItem>
                              <SelectItem value="geom">Geom.</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Stato Cliente</Label>
                          <Select value={statoCliente} onValueChange={setStatoCliente}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="attivo">Attivo</SelectItem>
                              <SelectItem value="sospeso">Sospeso</SelectItem>
                              <SelectItem value="cessato">Cessato</SelectItem>
                              <SelectItem value="prospect">Prospect</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Tipo Persona</Label>
                          <Select value={tipoPersona} onValueChange={setTipoPersona}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fisica">Persona Fisica</SelectItem>
                              <SelectItem value="giuridica">Persona Giuridica</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Sesso</Label>
                          <Select value={sesso} onValueChange={setSesso}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="M">Maschio</SelectItem>
                              <SelectItem value="F">Femmina</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Prospect</Label>
                          <Select value={prospect} onValueChange={setProspect}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="si">Sì</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="convertito">Convertito</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Comune Nascita</Label>
                          <Input value={comuneNascita} onChange={(e) => setComuneNascita(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Provincia Nascita</Label>
                          <Input value={provinciaNascita} onChange={(e) => setProvinciaNascita(e.target.value)} maxLength={2} />
                        </div>
                        <div>
                          <Label className="text-xs">Tipo Sommario</Label>
                          <Select value={tipoSommario} onValueChange={setTipoSommario}>
                            <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="dettagliato">Dettagliato</SelectItem>
                              <SelectItem value="sintetico">Sintetico</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs">Cellulare</Label>
                          <Input value={cellulare} onChange={(e) => setCellulare(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Fax</Label>
                          <Input value={fax} onChange={(e) => setFax(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Nazione</Label>
                          <Input value={nazione} onChange={(e) => setNazione(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Spec. SX Danni</Label>
                          <Input value={specSxDanni} onChange={(e) => setSpecSxDanni(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Spec. SX Sanità</Label>
                          <Input value={specSxSanita} onChange={(e) => setSpecSxSanita(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Attenzione di</Label>
                          <Input value={attenzioneDi} onChange={(e) => setAttenzioneDi(e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Note</Label>
                        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
                      </div>
                      <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-2">
                          <Switch checked={clienteNonCeduto} onCheckedChange={setClienteNonCeduto} />
                          <Label className="text-xs">Cliente Non Ceduto</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={aziendaSsnSx} onCheckedChange={setAziendaSsnSx} />
                          <Label className="text-xs">Azienda SSN/SX</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={statisticaPremiSinistri} onCheckedChange={setStatisticaPremiSinistri} />
                          <Label className="text-xs">Stat. Premi/Sinistri</Label>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Indirizzi Aggiuntivi */}
                <AccordionItem value="indirizzi_extra">
                  <AccordionTrigger className="text-sm font-medium">Indirizzi Aggiuntivi</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-muted-foreground">Indirizzo Alternativo</p>
                      <div className="grid grid-cols-4 gap-3">
                        <div><Label className="text-xs">Indirizzo</Label><Input value={indirizzoAlternativo} onChange={(e) => setIndirizzoAlternativo(e.target.value)} /></div>
                        <div><Label className="text-xs">CAP</Label><Input value={capAlternativo} onChange={(e) => setCapAlternativo(e.target.value)} maxLength={5} /></div>
                        <div><Label className="text-xs">Città</Label><Input value={cittaAlternativa} onChange={(e) => setCittaAlternativa(e.target.value)} /></div>
                        <div><Label className="text-xs">Provincia</Label><Input value={provinciaAlternativa} onChange={(e) => setProvinciaAlternativa(e.target.value)} maxLength={2} /></div>
                      </div>
                      <p className="text-xs font-semibold text-muted-foreground">Indirizzo Fiscale</p>
                      <div className="grid grid-cols-4 gap-3">
                        <div><Label className="text-xs">Indirizzo</Label><Input value={indirizzoFiscale} onChange={(e) => setIndirizzoFiscale(e.target.value)} /></div>
                        <div><Label className="text-xs">CAP</Label><Input value={capFiscale} onChange={(e) => setCapFiscale(e.target.value)} maxLength={5} /></div>
                        <div><Label className="text-xs">Città</Label><Input value={cittaFiscale} onChange={(e) => setCittaFiscale(e.target.value)} /></div>
                        <div><Label className="text-xs">Provincia</Label><Input value={provinciaFiscale} onChange={(e) => setProvinciaFiscale(e.target.value)} maxLength={2} /></div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Dati Statistici */}
                <AccordionItem value="statistici">
                  <AccordionTrigger className="text-sm font-medium">Dati Statistici</AccordionTrigger>
                  <AccordionContent>
                    <DatiStatisticiCreate
                      zona={zona} setZona={setZona}
                      indotto={indotto} setIndotto={setIndotto}
                      attivita={attivita} setAttivita={setAttivita}
                      settore={settore} setSettore={setSettore}
                      contratto={contratto} setContratto={setContratto}
                      gruppoFinanziarioId={gruppoFinanziarioId} setGruppoFinanziarioId={setGruppoFinanziarioId}
                      gruppoStatistico={gruppoStatistico} setGruppoStatistico={setGruppoStatistico}
                      fasciaFatturato={fascia_fatturato} setFasciaFatturato={setFasciaFatturato}
                      fasciaDipendenti={fascia_dipendenti} setFasciaDipendenti={setFasciaDipendenti}
                      aziendaStat={aziendaStat} setAziendaStat={setAziendaStat}
                      matricola={matricola} setMatricola={setMatricola}
                      riferimento={riferimento} setRiferimento={setRiferimento}
                      codiceAteco={codiceAteco} setCodiceAteco={setCodiceAteco}
                      clienteAssociato={clienteAssociato} setClienteAssociato={setClienteAssociato}
                      clienteCaptive={clienteCaptive} setClienteCaptive={setClienteCaptive}
                      internazionale={internazionale} setInternazionale={setInternazionale}
                      gruppiFinanziari={gruppiFinanziari}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Dati Contabili */}
                <AccordionItem value="contabili">
                  <AccordionTrigger className="text-sm font-medium">Dati Contabili</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Fido Credito €</Label>
                        <Input type="number" value={fidoCredito} onChange={(e) => setFidoCredito(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Fido Cauzioni €</Label>
                        <Input type="number" value={fidoCauzioni} onChange={(e) => setFidoCauzioni(e.target.value)} />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">Contatti</p>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><Label>Telefono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
                  <div><Label>PEC</Label><Input type="email" value={pec} onChange={(e) => setPec(e.target.value)} /></div>
                </div>
              </div>

              {/* Rete Commerciale */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-foreground mb-3">Rete Commerciale</p>

                {/* Account Executive - sempre visibile */}
                <div className="rounded-md border p-4 mb-3 bg-muted/30">
                  <p className="text-sm font-medium mb-3">Account Executive</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Profilo</Label>
                      <SearchableSelect
                        value={ae.profilo_id}
                        onValueChange={(v) => updateRole(setAe, "profilo_id", v)}
                        placeholder="Seleziona AE..."
                        options={profiliCommerciali}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">% Provvigione</Label>
                      <Input value={ae.percentuale} onChange={(e) => updateRole(setAe, "percentuale", e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <Label className="text-xs">Società/Brand</Label>
                      <Input value={ae.societa_brand} onChange={(e) => updateRole(setAe, "societa_brand", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Ruoli commerciali in Accordion */}
                <Accordion type="multiple" className="w-full">
                  <AccordionItem value="backoffice">
                    <AccordionTrigger className="text-sm py-2">Specialist</AccordionTrigger>
                    <AccordionContent>{renderCorrispondenteFields(backofficeRole, setBackofficeRole)}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="agente">
                    <AccordionTrigger className="text-sm py-2">Agente</AccordionTrigger>
                    <AccordionContent>{renderCorrispondenteFields(agente, setAgente)}</AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="produttore_sede">
                    <AccordionTrigger className="text-sm py-2">Produttore Sede</AccordionTrigger>
                    <AccordionContent>{renderCorrispondenteFields(produttoreSede, setProduttoreSede)}</AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Clienti ({totalCount})
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="denominazione">Nome A-Z</SelectItem>
                  <SelectItem value="created_at">Data creazione ↓</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome, CF, P.IVA..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-4">Caricamento...</p>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Denominazione</TableHead>
                  <TableHead>CF / P.IVA</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefono</TableHead>
                   <TableHead>Città</TableHead>
                   <TableHead className="text-center">Polizze</TableHead>
                   <TableHead>Portale</TableHead>
                   <TableHead>Stato</TableHead>
                  <TableHead>Attivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clienti.map((c) => {
                  const denominazione = c.tipo_cliente === "privato"
                    ? [c.cognome, c.nome].filter(Boolean).join(" ") || "—"
                    : c.ragione_sociale || "—";
                  const cfPiva = c.codice_fiscale || c.partita_iva || c.codice_fiscale_azienda || "—";
                  const citta = c.citta_residenza || c.citta_sede || "—";
                  return (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/archivi/clienti/${c.id}`)}>
                      <TableCell className="font-mono text-xs">{c.codice_ricerca || "—"}</TableCell>
                      <TableCell className="font-medium">{denominazione}</TableCell>
                      <TableCell className="font-mono text-xs">{cfPiva}</TableCell>
                      <TableCell>{c.email || "—"}</TableCell>
                      <TableCell>{c.telefono || "—"}</TableCell>
                      <TableCell>{citta}</TableCell>
                      <TableCell className="text-center">
                        {(polizzeCountMap[c.id] || 0) > 0 ? (
                          <Badge variant="default" className="min-w-[2rem] justify-center">{polizzeCountMap[c.id]}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(c as any).area_riservata_tipo && (c as any).area_riservata_tipo !== "nessuna" ? (
                          <Badge variant="outline" className="border-green-500 text-green-600 text-xs">Attivo</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.attivo ? "default" : "secondary"}>
                          {c.attivo ? "Attivo" : "Disattivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.attivo ?? true}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, attivo: v })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {clienti.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      Nessun cliente trovato
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientiList;
