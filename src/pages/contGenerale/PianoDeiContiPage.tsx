import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit, ChevronRight, Building2, Landmark } from "lucide-react";

type SezioneBilancio = { id: string; codice: string; descrizione: string };

type Gruppo = {
  id: string;
  codice: string;
  descrizione: string;
  sezione_bilancio_id: string | null;
  natura_tipo: string;
  natura_segno: string;
  attivo: boolean;
};

type Conto = {
  id: string;
  gruppo_id: string;
  codice: string;
  descrizione: string;
  sezione_bilancio_id: string | null;
  natura_tipo: string;
  natura_segno: string;
  gestione_partite: boolean;
  tipo_sezionale: string;
  voce_spesa: string | null;
  flag_stato: boolean;
  data_sospensione: string | null;
  gestione_tesoreria: boolean;
  iban: string | null;
  bic: string | null;
  citta: string | null;
  cf_piva: string | null;
  attivo: boolean;
};

const emptyGruppo = (): Partial<Gruppo> => ({
  codice: "",
  descrizione: "",
  sezione_bilancio_id: null,
  natura_tipo: "patrimoniale",
  natura_segno: "attivo",
  attivo: true,
});

const emptyConto = (gruppo_id?: string): Partial<Conto> => ({
  gruppo_id: gruppo_id || "",
  codice: "",
  descrizione: "",
  sezione_bilancio_id: null,
  natura_tipo: "patrimoniale",
  natura_segno: "attivo",
  gestione_partite: false,
  tipo_sezionale: "no",
  voce_spesa: null,
  flag_stato: false,
  data_sospensione: null,
  gestione_tesoreria: false,
  iban: null,
  bic: null,
  citta: null,
  cf_piva: null,
  attivo: true,
});

export default function PianoDeiContiPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [gruppoDialog, setGruppoDialog] = useState(false);
  const [contoDialog, setContoDialog] = useState(false);
  const [editingGruppo, setEditingGruppo] = useState<Partial<Gruppo> | null>(null);
  const [editingConto, setEditingConto] = useState<Partial<Conto> | null>(null);
  const [selectedGruppoId, setSelectedGruppoId] = useState<string | null>(null);

  // Queries
  const { data: sezioni = [] } = useQuery({
    queryKey: ["sezioni_bilancio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sezioni_bilancio")
        .select("*")
        .order("ordine");
      if (error) throw error;
      return data as SezioneBilancio[];
    },
  });

  const { data: gruppi = [], isLoading: loadingGruppi } = useQuery({
    queryKey: ["piano_conti_gruppi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("piano_conti_gruppi")
        .select("*")
        .order("codice");
      if (error) throw error;
      return data as Gruppo[];
    },
  });

  const { data: conti = [] } = useQuery({
    queryKey: ["piano_conti_conti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("piano_conti_conti")
        .select("*")
        .order("codice");
      if (error) throw error;
      return data as Conto[];
    },
  });

  // Mutations
  const saveGruppo = useMutation({
    mutationFn: async (g: Partial<Gruppo>) => {
      if (g.id) {
        const { error } = await supabase.from("piano_conti_gruppi").update(g).eq("id", g.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("piano_conti_gruppi").insert(g as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["piano_conti_gruppi"] });
      setGruppoDialog(false);
      toast.success("Gruppo salvato");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveConto = useMutation({
    mutationFn: async (c: Partial<Conto>) => {
      if (c.id) {
        const { error } = await supabase.from("piano_conti_conti").update(c).eq("id", c.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("piano_conti_conti").insert(c as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["piano_conti_conti"] });
      setContoDialog(false);
      toast.success("Conto salvato");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getSezioneName = (id: string | null) =>
    sezioni.find((s) => s.id === id)?.descrizione || "-";

  const contiPerGruppo = (gruppoId: string) =>
    conti.filter((c) => c.gruppo_id === gruppoId);

  const nextGruppoCodice = () => {
    const codes = gruppi.map((g) => parseInt(g.codice));
    const max = codes.length > 0 ? Math.max(...codes) : 0;
    return String(max + 10000).padStart(6, "0").slice(0, 6);
  };

  const nextContoCodice = (gruppoId: string) => {
    const existing = conti.filter((c) => c.gruppo_id === gruppoId);
    const codes = existing.map((c) => parseInt(c.codice));
    const max = codes.length > 0 ? Math.max(...codes) : 0;
    return String(max + 1).padStart(6, "0");
  };

  const filteredGruppi = gruppi.filter(
    (g) =>
      g.codice.includes(searchTerm) ||
      g.descrizione.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Piano dei Conti
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestione centri di costo, sottocentri e anagrafiche contabili
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingGruppo({ ...emptyGruppo(), codice: nextGruppoCodice() });
              setGruppoDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Nuovo Gruppo
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per codice o descrizione..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gruppi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gruppi.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sottoconti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conti.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Con Tesoreria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conti.filter((c) => c.gestione_tesoreria).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accordion list */}
      <Card>
        <CardContent className="p-0">
          {loadingGruppi ? (
            <div className="p-8 text-center text-muted-foreground">Caricamento...</div>
          ) : filteredGruppi.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nessun gruppo trovato</div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {filteredGruppi.map((g) => {
                const sottoconti = contiPerGruppo(g.id);
                return (
                  <AccordionItem key={g.id} value={g.id}>
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-center gap-4 flex-1 text-left">
                        <Badge variant="outline" className="font-mono text-xs">
                          {g.codice}
                        </Badge>
                        <span className="font-medium">{g.descrizione}</span>
                        <Badge variant="secondary" className="text-xs">
                          {g.natura_tipo} / {g.natura_segno}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto mr-4">
                          {sottoconti.length} conti
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGruppo(g);
                            setGruppoDialog(true);
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-4 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            Sezione: {getSezioneName(g.sezione_bilancio_id)}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingConto({
                                ...emptyConto(g.id),
                                codice: nextContoCodice(g.id),
                                sezione_bilancio_id: g.sezione_bilancio_id,
                                natura_tipo: g.natura_tipo,
                                natura_segno: g.natura_segno,
                              });
                              setContoDialog(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Nuovo Sottoconto
                          </Button>
                        </div>
                        {sottoconti.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Nessun sottoconto</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-24">Codice</TableHead>
                                <TableHead>Descrizione</TableHead>
                                <TableHead className="w-32">Natura</TableHead>
                                <TableHead className="w-28">Sezionale</TableHead>
                                <TableHead className="w-20">Tesoreria</TableHead>
                                <TableHead className="w-20">Stato</TableHead>
                                <TableHead className="w-12"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sottoconti.map((c) => (
                                <TableRow
                                  key={c.id}
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => {
                                    setEditingConto(c);
                                    setContoDialog(true);
                                  }}
                                >
                                  <TableCell className="font-mono text-xs">{c.codice}</TableCell>
                                  <TableCell className="font-medium">{c.descrizione}</TableCell>
                                  <TableCell className="text-xs">
                                    {c.natura_tipo}/{c.natura_segno}
                                  </TableCell>
                                  <TableCell>
                                    {c.tipo_sezionale !== "no" && (
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {c.tipo_sezionale}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {c.gestione_tesoreria && (
                                      <Badge className="text-xs bg-primary/10 text-primary border-0">
                                        <Building2 className="h-3 w-3 mr-1" /> Sì
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={c.attivo ? "default" : "secondary"} className="text-xs">
                                      {c.attivo ? "Attivo" : "Inattivo"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Dialog Gruppo */}
      <Dialog open={gruppoDialog} onOpenChange={setGruppoDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingGruppo?.id ? "Modifica Gruppo" : "Nuovo Gruppo (Centro di Costo)"}
            </DialogTitle>
          </DialogHeader>
          {editingGruppo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Codice (6 cifre)</Label>
                  <Input
                    value={editingGruppo.codice || ""}
                    onChange={(e) =>
                      setEditingGruppo({ ...editingGruppo, codice: e.target.value.replace(/\D/g, "").slice(0, 6) })
                    }
                    maxLength={6}
                    placeholder="010101"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label>Sezione Bilancio</Label>
                  <Select
                    value={editingGruppo.sezione_bilancio_id || ""}
                    onValueChange={(v) =>
                      setEditingGruppo({ ...editingGruppo, sezione_bilancio_id: v })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      {sezioni.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.descrizione}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrizione</Label>
                <Input
                  value={editingGruppo.descrizione || ""}
                  onChange={(e) =>
                    setEditingGruppo({ ...editingGruppo, descrizione: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Natura Tipo</Label>
                  <Select
                    value={editingGruppo.natura_tipo || "patrimoniale"}
                    onValueChange={(v) =>
                      setEditingGruppo({ ...editingGruppo, natura_tipo: v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patrimoniale">Patrimoniale</SelectItem>
                      <SelectItem value="economico">Economico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Natura Segno</Label>
                  <Select
                    value={editingGruppo.natura_segno || "attivo"}
                    onValueChange={(v) =>
                      setEditingGruppo({ ...editingGruppo, natura_segno: v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attivo">Attivo</SelectItem>
                      <SelectItem value="passivo">Passivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGruppoDialog(false)}>Annulla</Button>
            <Button
              onClick={() => editingGruppo && saveGruppo.mutate(editingGruppo)}
              disabled={!editingGruppo?.codice || !editingGruppo?.descrizione || editingGruppo.codice.length !== 6}
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Conto (Sottoconto) */}
      <Dialog open={contoDialog} onOpenChange={setContoDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConto?.id ? "Modifica Sottoconto" : "Nuovo Sottoconto"}
            </DialogTitle>
          </DialogHeader>
          {editingConto && (
            <div className="space-y-4">
              {/* Row 1 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Codice (6 cifre)</Label>
                  <Input
                    value={editingConto.codice || ""}
                    onChange={(e) =>
                      setEditingConto({ ...editingConto, codice: e.target.value.replace(/\D/g, "").slice(0, 6) })
                    }
                    maxLength={6}
                    className="font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Descrizione</Label>
                  <Input
                    value={editingConto.descrizione || ""}
                    onChange={(e) =>
                      setEditingConto({ ...editingConto, descrizione: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Sezione Bilancio</Label>
                  <Select
                    value={editingConto.sezione_bilancio_id || ""}
                    onValueChange={(v) =>
                      setEditingConto({ ...editingConto, sezione_bilancio_id: v })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      {sezioni.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.descrizione}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Natura Tipo</Label>
                  <Select
                    value={editingConto.natura_tipo || "patrimoniale"}
                    onValueChange={(v) =>
                      setEditingConto({ ...editingConto, natura_tipo: v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patrimoniale">Patrimoniale</SelectItem>
                      <SelectItem value="economico">Economico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Natura Segno</Label>
                  <Select
                    value={editingConto.natura_segno || "attivo"}
                    onValueChange={(v) =>
                      setEditingConto({ ...editingConto, natura_segno: v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attivo">Attivo</SelectItem>
                      <SelectItem value="passivo">Passivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3 - Tipo Sezionale */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo Sezionale</Label>
                  <Select
                    value={editingConto.tipo_sezionale || "no"}
                    onValueChange={(v) =>
                      setEditingConto({ ...editingConto, tipo_sezionale: v })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="clienti">Clienti</SelectItem>
                      <SelectItem value="fornitori">Fornitori</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Voce di Spesa</Label>
                  <Input
                    value={editingConto.voce_spesa || ""}
                    onChange={(e) =>
                      setEditingConto({ ...editingConto, voce_spesa: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Row 4 - Checkboxes */}
              <div className="flex gap-6 items-center border rounded-md p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="gestione_partite"
                    checked={editingConto.gestione_partite || false}
                    onCheckedChange={(v) =>
                      setEditingConto({ ...editingConto, gestione_partite: !!v })
                    }
                  />
                  <Label htmlFor="gestione_partite" className="text-sm cursor-pointer">Gestione Partite</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="flag_stato"
                    checked={editingConto.flag_stato || false}
                    onCheckedChange={(v) =>
                      setEditingConto({ ...editingConto, flag_stato: !!v })
                    }
                  />
                  <Label htmlFor="flag_stato" className="text-sm cursor-pointer">Flag Stato</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="gestione_tesoreria"
                    checked={editingConto.gestione_tesoreria || false}
                    onCheckedChange={(v) =>
                      setEditingConto({ ...editingConto, gestione_tesoreria: !!v })
                    }
                  />
                  <Label htmlFor="gestione_tesoreria" className="text-sm cursor-pointer">Gestione Tesoreria</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="attivo"
                    checked={editingConto.attivo !== false}
                    onCheckedChange={(v) =>
                      setEditingConto({ ...editingConto, attivo: !!v })
                    }
                  />
                  <Label htmlFor="attivo" className="text-sm cursor-pointer">Attivo</Label>
                </div>
              </div>

              {/* Row 5 - Dati bancari / anagrafica */}
              <div className="border rounded-md p-4 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Dati Bancari / Anagrafica</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>IBAN</Label>
                    <Input
                      value={editingConto.iban || ""}
                      onChange={(e) =>
                        setEditingConto({ ...editingConto, iban: e.target.value })
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                  <div>
                    <Label>BIC/SWIFT</Label>
                    <Input
                      value={editingConto.bic || ""}
                      onChange={(e) =>
                        setEditingConto({ ...editingConto, bic: e.target.value })
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Città</Label>
                    <Input
                      value={editingConto.citta || ""}
                      onChange={(e) =>
                        setEditingConto({ ...editingConto, citta: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>CF / P.IVA</Label>
                    <Input
                      value={editingConto.cf_piva || ""}
                      onChange={(e) =>
                        setEditingConto({ ...editingConto, cf_piva: e.target.value })
                      }
                      className="font-mono"
                    />
                  </div>
                </div>
                {editingConto.flag_stato && (
                  <div className="max-w-xs">
                    <Label>Data Sospensione</Label>
                    <Input
                      type="date"
                      value={editingConto.data_sospensione || ""}
                      onChange={(e) =>
                        setEditingConto({ ...editingConto, data_sospensione: e.target.value || null })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContoDialog(false)}>Annulla</Button>
            <Button
              onClick={() => editingConto && saveConto.mutate(editingConto)}
              disabled={!editingConto?.codice || !editingConto?.descrizione || (editingConto?.codice?.length ?? 0) !== 6}
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
