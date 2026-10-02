import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAnticipoUtilizzi, useSegnaAnticipoRimborsato, statoAnticipo } from "@/hooks/useAnticipiCliente";
import { fmtEuro } from "@/lib/formatCurrency";
import { useNavigate } from "react-router-dom";
import { Banknote, ExternalLink } from "lucide-react";
import ContoBancarioSelect from "@/components/anagrafiche/ContoBancarioSelect";

interface Props {
  anticipoId: string | null;
  onClose: () => void;
}

const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString("it-IT"); } catch { return s; } };
const todayISO = () => new Date().toISOString().slice(0, 10);
const maskIban = (iban: string) =>
  iban && iban.length >= 8 ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : iban;

export default function AnticipoUtilizziDrawer({ anticipoId, onClose }: Props) {
  const navigate = useNavigate();
  const { data: utilizzi = [], isLoading } = useAnticipoUtilizzi(anticipoId || undefined);
  const rimborsa = useSegnaAnticipoRimborsato();
  const [rimborsoOpen, setRimborsoOpen] = useState(false);
  const [dataRimborso, setDataRimborso] = useState(todayISO());
  const [contoRimborsoId, setContoRimborsoId] = useState<string | null>(null);
  const [noteRimborso, setNoteRimborso] = useState("");

  const { data: anticipo } = useQuery({
    queryKey: ["anticipo-dettaglio", anticipoId],
    enabled: !!anticipoId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .select("id, cliente_id, importo, importo_residuo, note, titolo_origine_id, rimborsato_il, rimborsato_importo, rimborsato_note, rimborsato_conto_bancario_id, data_anticipo, conto_rimborso:conti_bancari!cliente_anticipi_rimborsato_conto_bancario_id_fkey(id, etichetta, iban), operatore_rimborso:profiles!cliente_anticipi_rimborsato_da_fkey(nome, cognome, email)")
        .eq("id", anticipoId!)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        cliente_id: string;
        importo: number;
        importo_residuo: number;
        note: string | null;
        titolo_origine_id: string | null;
        rimborsato_il: string | null;
        rimborsato_importo: number | null;
        rimborsato_note: string | null;
        rimborsato_conto_bancario_id: string | null;
        conto_rimborso: { id: string; etichetta: string; iban: string } | null;
        operatore_rimborso: { nome: string | null; cognome: string | null; email: string | null } | null;
        data_anticipo: string;
      } | null;
    },
  });

  const stato = anticipo ? statoAnticipo(anticipo) : null;
  const canRimborsare = !!anticipo && stato !== "rimborsato" && Number(anticipo.importo_residuo) > 0;

  return (
    <>
      <Dialog open={!!anticipoId} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Dettaglio Acconto</DialogTitle>
          </DialogHeader>

          {anticipo && (
            <div className="space-y-2 text-sm border rounded-md p-3 bg-muted/30">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Importo / Residuo</span>
                <span className="font-mono font-medium">
                  {fmtEuro(anticipo.importo)} / {fmtEuro(anticipo.importo_residuo)}
                </span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-muted-foreground">Stato</span>
                {stato === "rimborsato" ? (
                  <Badge className="bg-slate-600">Rimborsato {fmtDate(anticipo.rimborsato_il!)}</Badge>
                ) : stato === "disponibile" ? (
                  <Badge className="bg-green-600">Disponibile</Badge>
                ) : stato === "parziale" ? (
                  <Badge className="bg-amber-500">Parziale</Badge>
                ) : (
                  <Badge variant="secondary">Esaurito</Badge>
                )}
              </div>
              {anticipo.note && (
                <p className="text-xs text-muted-foreground pt-1 border-t">{anticipo.note}</p>
              )}
              {stato === "rimborsato" && (
                <div className="rounded-md border border-slate-300 bg-background p-2.5 space-y-1.5">
                  <div className="text-xs font-semibold">Storico rimborso</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Data</span>
                    <span className="text-right">{fmtDate(anticipo.rimborsato_il!)}</span>
                    <span className="text-muted-foreground">Importo</span>
                    <span className="text-right font-medium">{fmtEuro(anticipo.rimborsato_importo ?? 0)}</span>
                    <span className="text-muted-foreground">Conto di uscita</span>
                    <span className="text-right font-medium">{anticipo.conto_rimborso?.etichetta || "Non registrato (storico)"}</span>
                    {anticipo.conto_rimborso?.iban && (
                      <>
                        <span className="text-muted-foreground">IBAN</span>
                        <span className="text-right font-mono">{maskIban(anticipo.conto_rimborso.iban)}</span>
                      </>
                    )}
                    {anticipo.operatore_rimborso && (
                      <>
                        <span className="text-muted-foreground">Registrato da</span>
                        <span className="text-right">
                          {[anticipo.operatore_rimborso.nome, anticipo.operatore_rimborso.cognome]
                            .filter(Boolean)
                            .join(" ") || anticipo.operatore_rimborso.email || "—"}
                        </span>
                      </>
                    )}
                    {anticipo.rimborsato_note && (
                      <>
                        <span className="text-muted-foreground">Note</span>
                        <span className="text-right">{anticipo.rimborsato_note}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              {anticipo.titolo_origine_id && (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => {
                    navigate(`/titoli/${anticipo.titolo_origine_id}`);
                    onClose();
                  }}
                >
                  <ExternalLink className="w-3 h-3 mr-1" /> Vai al titolo di origine
                </Button>
              )}
              {canRimborsare && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => {
                    setDataRimborso(todayISO());
                    setContoRimborsoId(null);
                    setNoteRimborso("");
                    setRimborsoOpen(true);
                  }}
                >
                  <Banknote className="w-4 h-4 mr-1" /> Segna come rimborsato / bonificato
                </Button>
              )}
            </div>
          )}

          <h4 className="text-sm font-medium pt-1">Utilizzi</h4>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Caricamento...</div>
          ) : utilizzi.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Acconto non ancora utilizzato su quietanze</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Polizza</TableHead>
                  <TableHead className="text-xs text-right">Importo Usato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utilizzi.map((u: any, i: number) => (
                  <TableRow
                    key={u.id}
                    className={`cursor-pointer ${i % 2 === 0 ? "bg-muted/30" : ""}`}
                    onClick={() => {
                      if (u.titolo?.id) {
                        navigate(`/titoli/${u.titolo.id}`);
                        onClose();
                      }
                    }}
                  >
                    <TableCell className="text-xs">{fmtDate(u.data_utilizzo)}</TableCell>
                    <TableCell className="text-xs">{u.titolo?.numero_titolo || u.titolo_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmtEuro(u.importo_utilizzato)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rimborsoOpen} onOpenChange={setRimborsoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Segna acconto rimborsato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Chiude il residuo ({fmtEuro(anticipo?.importo_residuo ?? 0)}) come bonifico/rimborso al cliente.
              L&apos;acconto non sarà più usabile in messa a cassa.
            </p>
            <div>
              <Label className="text-xs">Data rimborso</Label>
              <Input
                type="date"
                className="mt-1"
                value={dataRimborso}
                onChange={(e) => setDataRimborso(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Conto bancario di uscita *</Label>
              <ContoBancarioSelect
                className="mt-1"
                value={contoRimborsoId}
                onChange={setContoRimborsoId}
                tipi={["incasso_clienti", "generico"]}
                placeholder="Seleziona il conto del rimborso…"
                autoSelectDefault
              />
            </div>
            <div>
              <Label className="text-xs">Note (opz.)</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={noteRimborso}
                onChange={(e) => setNoteRimborso(e.target.value)}
                placeholder="Es. bonifico IBAN… / rif. movimento"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRimborsoOpen(false)}>Annulla</Button>
            <Button
              disabled={rimborsa.isPending || !dataRimborso || !contoRimborsoId}
              onClick={() => {
                if (!anticipoId || !anticipo) return;
                rimborsa.mutate(
                  {
                    anticipoId,
                    clienteId: anticipo.cliente_id,
                    dataRimborso,
                    contoBancarioId: contoRimborsoId,
                    note: noteRimborso || null,
                  },
                  {
                    onSuccess: () => {
                      setRimborsoOpen(false);
                      onClose();
                    },
                  },
                );
              }}
            >
              Conferma rimborso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
