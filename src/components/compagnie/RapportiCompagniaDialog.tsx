import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, XCircle, Network, X } from "lucide-react";
import { toast } from "sonner";
import { validateIban } from "@/lib/validateIban";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const ALL_SOTTORAMI = "__ALL__";
interface RamoRow { gruppo_ramo_id: string; ramo_id: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  compagniaId: string | null;
  compagniaNome: string;
}

const TIPI_RAPPORTO = [
  "Agenzia",
  "Direzione",
  "Broker",
  "Mandato diretto",
  "Mandato principale",
  "Sub-agenzia",
  "Convenzione broker",
  "Coverholder",
  "Altro",
];

interface RapportoForm {
  id?: string;
  nome_rapporto: string;
  gruppo_compagnia_id: string;
  codice_rapporto: string;
  tipo_rapporto: string;
  rami_abilitati: string;
  data_inizio: string;
  data_fine: string;
  attivo: boolean;
  percentuale_provvigione: string;
  conto_bancario_id: string | null;
  conto_etichetta: string;
  conto_banca: string;
  conto_iban: string;
  conto_intestato_a: string;
  conto_bic: string;
  conto_abi: string;
  conto_cab: string;
  conto_note: string;
  sede_denominazione: string;
  sede_indirizzo: string;
  sede_cap: string;
  sede_citta: string;
  sede_provincia: string;
  referente_compagnia: string;
  email_referente: string;
  telefono_referente: string;
  note: string;
}

const emptyForm: RapportoForm = {
  nome_rapporto: "",
  gruppo_compagnia_id: "",
  codice_rapporto: "",
  tipo_rapporto: "Agenzia",
  rami_abilitati: "",
  data_inizio: new Date().toISOString().slice(0, 10),
  data_fine: "",
  attivo: true,
  percentuale_provvigione: "",
  conto_bancario_id: null,
  conto_etichetta: "",
  conto_banca: "",
  conto_iban: "",
  conto_intestato_a: "",
  conto_bic: "",
  conto_abi: "",
  conto_cab: "",
  conto_note: "",
  sede_denominazione: "",
  sede_indirizzo: "",
  sede_cap: "",
  sede_citta: "",
  sede_provincia: "",
  referente_compagnia: "",
  email_referente: "",
  telefono_referente: "",
  note: "",
};

export default function RapportiCompagniaDialog({ open, onOpenChange, compagniaId, compagniaNome }: Props) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RapportoForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: rapporti = [], isLoading } = useQuery({
    queryKey: ["compagnia_rapporti", compagniaId],
    queryFn: async () => {
      if (!compagniaId) return [];
      const { data, error } = await supabase
        .from("compagnia_rapporti" as any)
        .select("*, gruppi_compagnia:gruppo_compagnia_id(id, descrizione, codice)")
        .eq("compagnia_id", compagniaId)
        .order("attivo", { ascending: false })
        .order("data_inizio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!compagniaId && open,
  });

  const { data: gruppi = [] } = useQuery({
    queryKey: ["gruppi_compagnia_for_rapporti"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_compagnia" as any)
        .select("id, descrizione, codice")
        .eq("attivo", true)
        .order("descrizione");
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  // Load conto bancario fields when editing a rapporto with linked account
  useEffect(() => {
    if (!formOpen || !form.id || !form.conto_bancario_id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conti_bancari" as any)
        .select("etichetta, banca, iban, intestato_a, bic, abi, cab, note")
        .eq("id", form.conto_bancario_id)
        .maybeSingle();
      if (cancelled || !data) return;
      const d = data as any;
      setForm((p) => ({
        ...p,
        conto_etichetta: d.etichetta || "",
        conto_banca: d.banca || "",
        conto_iban: d.iban || "",
        conto_intestato_a: d.intestato_a || "",
        conto_bic: d.bic || "",
        conto_abi: d.abi || "",
        conto_cab: d.cab || "",
        conto_note: d.note || "",
      }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, form.id]);

  const persistContoRapporto = async (currentContoId: string | null): Promise<string | null> => {
    const rawIban = (form.conto_iban || "").replace(/\s+/g, "").toUpperCase();
    if (!rawIban) return null;
    const ibanCheck = validateIban(rawIban);
    if (!ibanCheck.valid) {
      throw new Error(ibanCheck.error || "IBAN non valido");
    }
    const iban = ibanCheck.normalized || rawIban;
    const intestato = (form.conto_intestato_a || form.nome_rapporto || compagniaNome || "").trim();
    if (!intestato) throw new Error("Specifica l'intestatario del conto");
    const banca = (form.conto_banca || "Banca da definire").trim();
    const etichetta = (form.conto_etichetta || form.nome_rapporto || "Conto rapporto").trim();
    const payload: any = {
      tipo: "agenzia",
      etichetta,
      banca,
      iban,
      intestato_a: intestato,
      bic: form.conto_bic || null,
      abi: form.conto_abi || null,
      cab: form.conto_cab || null,
      note: form.conto_note || null,
      attivo: true,
    };
    if (currentContoId) {
      const { error } = await supabase.from("conti_bancari" as any).update(payload).eq("id", currentContoId);
      if (error) throw error;
      return currentContoId;
    }
    const { data, error } = await supabase.from("conti_bancari" as any).insert(payload).select("id").single();
    if (error) throw error;
    return (data as any).id as string;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!compagniaId) throw new Error("Agenzia non valida");
      if (!form.gruppo_compagnia_id) throw new Error("Seleziona la Compagnia Assicurativa");
      if (!form.nome_rapporto.trim()) throw new Error("Inserisci il nome del rapporto");
      if (form.sede_indirizzo && (!form.sede_citta || !form.sede_provincia)) {
        throw new Error("Se inserisci l'indirizzo della sede, specifica anche città e provincia");
      }

      const ibanFilled = !!(form.conto_iban || "").replace(/\s+/g, "").trim();
      const basePayload: any = {
        compagnia_id: compagniaId,
        nome_rapporto: form.nome_rapporto.trim(),
        gruppo_compagnia_id: form.gruppo_compagnia_id,
        codice_rapporto: form.codice_rapporto || null,
        tipo_rapporto: form.tipo_rapporto || null,
        rami_abilitati: form.rami_abilitati
          ? form.rami_abilitati.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        data_inizio: form.data_inizio || null,
        data_fine: form.data_fine || null,
        attivo: form.attivo,
        percentuale_provvigione: form.percentuale_provvigione ? Number(form.percentuale_provvigione) : null,
        sede_denominazione: form.sede_denominazione || null,
        sede_indirizzo: form.sede_indirizzo || null,
        sede_cap: form.sede_cap || null,
        sede_citta: form.sede_citta || null,
        sede_provincia: form.sede_provincia ? form.sede_provincia.toUpperCase().slice(0, 2) : null,
        referente_compagnia: form.referente_compagnia || null,
        email_referente: form.email_referente || null,
        telefono_referente: form.telefono_referente || null,
        note: form.note || null,
      };

      if (form.id) {
        // UPDATE rapporto + sync conto
        const contoId = await persistContoRapporto(form.conto_bancario_id);
        const { error } = await supabase
          .from("compagnia_rapporti" as any)
          .update({ ...basePayload, conto_bancario_id: ibanFilled ? contoId : null })
          .eq("id", form.id);
        if (error) throw error;
      } else {
        // INSERT rapporto, poi conto, poi link; rollback se conto fallisce
        const { data: created, error: insErr } = await supabase
          .from("compagnia_rapporti" as any)
          .insert({ ...basePayload, conto_bancario_id: null })
          .select("id")
          .single();
        if (insErr) throw insErr;
        const newId = (created as any).id as string;
        try {
          if (ibanFilled) {
            const contoId = await persistContoRapporto(null);
            const { error: upErr } = await supabase
              .from("compagnia_rapporti" as any)
              .update({ conto_bancario_id: contoId })
              .eq("id", newId);
            if (upErr) throw upErr;
          }
        } catch (e) {
          await supabase.from("compagnia_rapporti" as any).delete().eq("id", newId);
          throw e;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      qc.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      qc.invalidateQueries({ queryKey: ["rapporti-per-gruppo"] });
      setFormOpen(false);
      setForm(emptyForm);
      toast.success("Rapporto salvato");
    },
    onError: (e: any) => {
      const msg = e?.message || "";
      if (msg.includes("intestato_a")) toast.error("Manca l'intestatario del conto bancario");
      else toast.error(msg || "Errore nel salvataggio");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("compagnia_rapporti" as any)
        .update({ attivo: false, data_fine: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      qc.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      qc.invalidateQueries({ queryKey: ["rapporti-per-gruppo"] });
      toast.success("Rapporto chiuso");
    },
    onError: () => toast.error("Errore"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compagnia_rapporti" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti", compagniaId] });
      qc.invalidateQueries({ queryKey: ["compagnia_rapporti_counts"] });
      qc.invalidateQueries({ queryKey: ["agenzie-madri-list"] });
      qc.invalidateQueries({ queryKey: ["rapporti-per-gruppo"] });
      setDeleteId(null);
      toast.success("Rapporto eliminato");
    },
    onError: () => toast.error("Errore eliminazione"),
  });

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      nome_rapporto: r.nome_rapporto || "",
      gruppo_compagnia_id: r.gruppo_compagnia_id || "",
      codice_rapporto: r.codice_rapporto || "",
      tipo_rapporto: r.tipo_rapporto || "Agenzia",
      rami_abilitati: Array.isArray(r.rami_abilitati) ? r.rami_abilitati.join(", ") : "",
      data_inizio: r.data_inizio || "",
      data_fine: r.data_fine || "",
      attivo: r.attivo ?? true,
      percentuale_provvigione: r.percentuale_provvigione?.toString() || "",
      conto_bancario_id: r.conto_bancario_id || null,
      conto_etichetta: "",
      conto_banca: "",
      conto_iban: "",
      conto_intestato_a: "",
      conto_bic: "",
      conto_abi: "",
      conto_cab: "",
      conto_note: "",
      sede_denominazione: r.sede_denominazione || "",
      sede_indirizzo: r.sede_indirizzo || "",
      sede_cap: r.sede_cap || "",
      sede_citta: r.sede_citta || "",
      sede_provincia: r.sede_provincia || "",
      referente_compagnia: r.referente_compagnia || "",
      email_referente: r.email_referente || "",
      telefono_referente: r.telefono_referente || "",
      note: r.note || "",
    });
    setFormOpen(true);
  };

  const openNew = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const gruppiOptions = (gruppi as any[]).map((g) => ({
    value: g.id,
    label: g.descrizione,
    description: g.codice || undefined,
  }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />
              Rapporti con Compagnie Assicurative — <span className="text-primary">{compagniaNome}</span>
              <Badge variant="secondary" className="ml-2">{rapporti.length}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNew} className="gap-2">
                <Plus className="w-4 h-4" /> Nuovo Rapporto
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <p className="text-muted-foreground text-sm">Caricamento...</p>
                ) : rapporti.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Nessun rapporto registrato. Clicca "Nuovo Rapporto" per crearne uno.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome rapporto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Sede</TableHead>
                        <TableHead>Codice</TableHead>
                        <TableHead>Rami</TableHead>
                        <TableHead>Inizio</TableHead>
                        <TableHead>Fine</TableHead>
                        <TableHead className="text-right">% Provv.</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rapporti as any[]).map((r, idx) => (
                        <TableRow key={r.id} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                          <TableCell className="font-medium">
                            <div>{r.nome_rapporto || "—"}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {r.gruppi_compagnia?.descrizione || ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{r.tipo_rapporto || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {r.sede_denominazione || r.sede_citta ? (
                              <>
                                <div>{r.sede_denominazione || "—"}</div>
                                <div className="text-muted-foreground">
                                  {[r.sede_citta, r.sede_provincia].filter(Boolean).join(" ")}
                                </div>
                              </>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.codice_rapporto || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                            {Array.isArray(r.rami_abilitati) && r.rami_abilitati.length
                              ? r.rami_abilitati.join(", ")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{r.data_inizio || "—"}</TableCell>
                          <TableCell className="text-sm">{r.data_fine || "—"}</TableCell>
                          <TableCell className="text-right text-sm">
                            {r.percentuale_provvigione != null ? `${r.percentuale_provvigione}%` : "—"}
                          </TableCell>
                          <TableCell>
                            {r.attivo ? (
                              <Badge className="bg-primary/10 text-primary border-primary/30">Attivo</Badge>
                            ) : (
                              <Badge variant="secondary">Chiuso</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Modifica">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {r.attivo && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => closeMutation.mutate(r.id)}
                                  title="Chiudi rapporto"
                                >
                                  <XCircle className="w-4 h-4 text-amber-600" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteId(r.id)}
                                title="Elimina"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form create/edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifica Rapporto" : "Nuovo Rapporto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome del rapporto *</Label>
              <Input
                value={form.nome_rapporto}
                onChange={(e) => setForm((p) => ({ ...p, nome_rapporto: e.target.value }))}
                placeholder="es. Nobis – Agenzia Torino Centro"
              />
              <p className="text-[11px] text-muted-foreground">Etichetta libera che identifica univocamente questo rapporto.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Compagnia Assicurativa *</Label>
              <SearchableSelect
                options={gruppiOptions}
                value={form.gruppo_compagnia_id}
                onValueChange={(v) => setForm((p) => ({ ...p, gruppo_compagnia_id: v }))}
                placeholder="Seleziona Compagnia Assicurativa..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Codice Rapporto</Label>
                <Input
                  value={form.codice_rapporto}
                  onChange={(e) => setForm((p) => ({ ...p, codice_rapporto: e.target.value }))}
                  placeholder="es. AG12345"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo Rapporto</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.tipo_rapporto}
                  onChange={(e) => setForm((p) => ({ ...p, tipo_rapporto: e.target.value }))}
                >
                  {TIPI_RAPPORTO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rami abilitati (separati da virgola)</Label>
              <Input
                value={form.rami_abilitati}
                onChange={(e) => setForm((p) => ({ ...p, rami_abilitati: e.target.value }))}
                placeholder="es. RCA, Property, Vita"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Inizio</Label>
                <Input
                  type="date"
                  value={form.data_inizio}
                  onChange={(e) => setForm((p) => ({ ...p, data_inizio: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data Fine</Label>
                <Input
                  type="date"
                  value={form.data_fine}
                  onChange={(e) => setForm((p) => ({ ...p, data_fine: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">% Provvigione</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.percentuale_provvigione}
                  onChange={(e) => setForm((p) => ({ ...p, percentuale_provvigione: e.target.value }))}
                  placeholder="es. 12.5"
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <Label className="text-sm font-medium">Conto bancario del rapporto</Label>
              <p className="text-[11px] text-muted-foreground">
                Inserisci l'IBAN dell'agenzia per questo rapporto. Se lasci vuoto, verrà usato l'IBAN della Compagnia Assicurativa.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Etichetta (es. Conto Nobis Torino)"
                  value={form.conto_etichetta}
                  onChange={(e) => setForm((p) => ({ ...p, conto_etichetta: e.target.value }))}
                />
                <Input
                  placeholder="Banca (es. Intesa Sanpaolo)"
                  value={form.conto_banca}
                  onChange={(e) => setForm((p) => ({ ...p, conto_banca: e.target.value }))}
                />
              </div>
              {(() => {
                const ibanRaw = (form.conto_iban || "").replace(/\s+/g, "").toUpperCase();
                const ibanCheck = ibanRaw ? validateIban(ibanRaw) : { valid: true as const };
                return (
                  <div className="space-y-1">
                    <Input
                      placeholder="IBAN (es. IT60X0542811101000000123456)"
                      value={form.conto_iban}
                      maxLength={34}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, conto_iban: e.target.value.replace(/\s+/g, "").toUpperCase() }))
                      }
                      className={!ibanCheck.valid ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {!ibanCheck.valid && (
                      <p className="text-xs text-destructive">{ibanCheck.error}</p>
                    )}
                  </div>
                );
              })()}
              <Input
                placeholder="Intestato a (default: nome rapporto)"
                value={form.conto_intestato_a}
                onChange={(e) => setForm((p) => ({ ...p, conto_intestato_a: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-3">
                <Input
                  placeholder="BIC (opz.)"
                  value={form.conto_bic}
                  onChange={(e) => setForm((p) => ({ ...p, conto_bic: e.target.value.toUpperCase() }))}
                />
                <Input
                  placeholder="ABI (opz.)"
                  value={form.conto_abi}
                  onChange={(e) => setForm((p) => ({ ...p, conto_abi: e.target.value }))}
                />
                <Input
                  placeholder="CAB (opz.)"
                  value={form.conto_cab}
                  onChange={(e) => setForm((p) => ({ ...p, conto_cab: e.target.value }))}
                />
              </div>
              <Input
                placeholder="Note conto (opz.)"
                value={form.conto_note}
                onChange={(e) => setForm((p) => ({ ...p, conto_note: e.target.value }))}
              />
            </div>

            <div className="border-t pt-3 space-y-3">
              <Label className="text-sm font-medium">Sede del rapporto (presso la Compagnia partner)</Label>
              <Input
                placeholder="Denominazione (es. Agenzia Nobis Torino Centro)"
                value={form.sede_denominazione}
                onChange={(e) => setForm((p) => ({ ...p, sede_denominazione: e.target.value }))}
              />
              <AddressAutocomplete
                placeholder="Indirizzo (es. Via Moncalieri 12)"
                value={form.sede_indirizzo}
                onChange={(v) => setForm((p) => ({ ...p, sede_indirizzo: v }))}
                onSelect={(c) =>
                  setForm((p) => ({
                    ...p,
                    sede_indirizzo: c.indirizzo || p.sede_indirizzo,
                    sede_cap: c.cap || p.sede_cap,
                    sede_citta: c.citta || p.sede_citta,
                    sede_provincia: (c.provincia || p.sede_provincia).toUpperCase(),
                  }))
                }
              />
              <div className="grid grid-cols-[100px_1fr_80px] gap-3">
                <Input
                  placeholder="CAP"
                  value={form.sede_cap}
                  onChange={(e) => setForm((p) => ({ ...p, sede_cap: e.target.value }))}
                />
                <Input
                  placeholder="Città"
                  value={form.sede_citta}
                  onChange={(e) => setForm((p) => ({ ...p, sede_citta: e.target.value }))}
                />
                <Input
                  placeholder="Prov."
                  maxLength={2}
                  value={form.sede_provincia}
                  onChange={(e) => setForm((p) => ({ ...p, sede_provincia: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <Label className="text-sm font-medium">Referente in Compagnia Assicurativa</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  placeholder="Nome referente"
                  value={form.referente_compagnia}
                  onChange={(e) => setForm((p) => ({ ...p, referente_compagnia: e.target.value }))}
                />
                <Input
                  placeholder="Email"
                  value={form.email_referente}
                  onChange={(e) => setForm((p) => ({ ...p, email_referente: e.target.value }))}
                />
                <Input
                  placeholder="Telefono"
                  value={form.telefono_referente}
                  onChange={(e) => setForm((p) => ({ ...p, telefono_referente: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Note</Label>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>Annulla</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={
                  !form.gruppo_compagnia_id ||
                  !form.nome_rapporto.trim() ||
                  saveMutation.isPending ||
                  (!!form.conto_iban.trim() && !validateIban(form.conto_iban).valid)
                }
              >
                {saveMutation.isPending ? "Salvataggio..." : "Salva Rapporto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare definitivamente questo rapporto?</AlertDialogTitle>
            <AlertDialogDescription>
              Verrà rimossa ogni traccia del rapporto. Per mantenere lo storico,
              usa invece "Chiudi rapporto".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
