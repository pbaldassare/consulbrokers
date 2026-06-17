import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Percent, Clock, List, Users, ShieldCheck, StickyNote, Pencil, Eye, Download } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import DocumentiTab from "@/components/DocumentiTab";
import ChatTab from "@/components/ChatTab";
import TimelineTab from "@/components/TimelineTab";
import { fmtEuro } from "@/lib/formatCurrency";

interface TitoloTabsProps {
  id: string;
  t: any;
  movimentiPolizza: any[];
  provvigioni: any[];
  appendiciPolizza: any[];
  navigate: (path: string) => void;
  /** Id della catena (madre + tutte le quietanze) per condividere documenti su tutta la polizza. */
  chainIds?: string[];
}

/**
 * Estratto da TitoloDetail.tsx (lines 3143-3280) per ridurre la complessità del file principale.
 * Comportamento e markup identici all'originale.
 */
export const TitoloTabs = ({ id, t, movimentiPolizza, provvigioni, appendiciPolizza, navigate, chainIds }: TitoloTabsProps) => {

  // Lazy mount: ogni tab si monta solo la prima volta che viene aperto, poi resta in cache.
  const [tab, setTab] = useState<string>("movimenti");
  const [mounted, setMounted] = useState<Record<string, boolean>>({ movimenti: true });
  const open = (v: string) => {
    setTab(v);
    setMounted((m) => (m[v] ? m : { ...m, [v]: true }));
  };
  return (
    <Tabs value={tab} onValueChange={open}>
      <TabsList className="flex-wrap h-auto">

        <TabsTrigger value="movimenti"><List className="w-4 h-4 mr-1" />Movimenti ({movimentiPolizza.length})</TabsTrigger>
        <TabsTrigger value="provvigioni"><Percent className="w-4 h-4 mr-1" />Provvigioni ({provvigioni.length})</TabsTrigger>
        <TabsTrigger value="appendici"><FileText className="w-4 h-4 mr-1" />Appendici ({appendiciPolizza.length})</TabsTrigger>
        <TabsTrigger value="garanzie"><ShieldCheck className="w-4 h-4 mr-1" />Garanzie</TabsTrigger>
        {/* Voci RCA spostate dentro la sezione Importi */}
        <TabsTrigger value="familiari"><Users className="w-4 h-4 mr-1" />Familiari</TabsTrigger>
        <TabsTrigger value="note"><StickyNote className="w-4 h-4 mr-1" />Note</TabsTrigger>
        <TabsTrigger value="documenti"><FileText className="w-4 h-4 mr-1" />Documenti</TabsTrigger>
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="timeline"><Clock className="w-4 h-4 mr-1" />Log Attività</TabsTrigger>
      </TabsList>

      <TabsContent value="movimenti">
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            I movimenti sono visualizzati nella sezione sopra. Questa tab potrà contenere funzionalità di gestione avanzata (aggiunta rinnovi, appendici, storni).
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="provvigioni">
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beneficiario</TableHead>
                  <TableHead>Percentuale</TableHead>
                  <TableHead>Importo €</TableHead>
                  <TableHead>Calcolata il</TableHead>
                  <TableHead>Pagata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provvigioni.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.profiles ? `${p.profiles.nome} ${p.profiles.cognome}` : "—"}</TableCell>
                    <TableCell className="font-mono">{p.percentuale}%</TableCell>
                    <TableCell className="font-mono">{fmtEuro(p.importo_provvigione)}</TableCell>
                    <TableCell>{p.calcolata_il ? format(new Date(p.calcolata_il), "dd/MM/yyyy HH:mm", { locale: it }) : "—"}</TableCell>
                    <TableCell><Badge variant={p.pagata ? "default" : "secondary"}>{p.pagata ? "Sì" : "No"}</Badge></TableCell>
                  </TableRow>
                ))}
                {provvigioni.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nessuna provvigione generata</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="appendici">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Appendici registrate per questa polizza</p>
              <Button size="sm" onClick={() => navigate(`/portafoglio/appendici?polizza=${encodeURIComponent(t.numero_titolo || "")}&riga=${encodeURIComponent(t.riga || "")}&clienteId=${encodeURIComponent((t.cliente_anagrafica as any)?.id || "")}&titoloId=${encodeURIComponent(t.id)}`)}>
                <FileText className="w-4 h-4 mr-1" /> Nuova Appendice
              </Button>
            </div>
            {appendiciPolizza.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nessuna appendice registrata.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">N°</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Effetto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Oggetto</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="w-28">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(appendiciPolizza as any[]).map((a: any) => (
                    <AppendiceTableRow key={a.id} a={a} t={t} navigate={navigate} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="garanzie">
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sezione Garanzie — in fase di sviluppo. Qui verranno mostrate le coperture e garanzie della polizza.</CardContent></Card>
      </TabsContent>
      {/* Voci RCA: integrate dentro la sezione Importi sopra */}
      <TabsContent value="familiari">
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Sezione Familiari — in fase di sviluppo. Qui verranno mostrati assicurati e beneficiari collegati alla polizza.</CardContent></Card>
      </TabsContent>
      <TabsContent value="note">
        <Card><CardContent className="pt-6"><p className="text-sm whitespace-pre-wrap">{t.note || "Nessuna nota."}</p></CardContent></Card>
      </TabsContent>
      <TabsContent value="documenti">
        <Card><CardContent className="pt-6">{mounted.documenti ? <DocumentiTab entitaTipo="titolo" entitaId={id} entitaIds={chainIds && chainIds.length > 0 ? chainIds : undefined} bucketName="documenti_titoli" /> : null}</CardContent></Card>

      </TabsContent>
      <TabsContent value="chat">
        <Card><CardContent className="pt-6">{mounted.chat ? <ChatTab entitaTipo="titolo" entitaId={id} /> : null}</CardContent></Card>
      </TabsContent>
      <TabsContent value="timeline">
        <Card><CardContent className="pt-6">{mounted.timeline ? <TimelineTab entitaTipo="titolo" entitaId={id} /> : null}</CardContent></Card>
      </TabsContent>
    </Tabs>
  );
};
