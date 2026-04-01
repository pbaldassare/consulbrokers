import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell, TableFooter } from "@/components/ui/table";
import { Shield, Calendar } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";

const statoBadge: Record<string, string> = {
  attivo: "bg-emerald-100 text-emerald-800 border-emerald-300",
  scaduto: "bg-red-100 text-red-800 border-red-300",
  sospeso: "bg-yellow-100 text-yellow-800 border-yellow-300",
  incassato: "bg-blue-100 text-blue-800 border-blue-300",
};

const fmt = (v: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(v);

const ClientePolizze = () => {
  const { user } = useAuth();
  const [titoli, setTitoli] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: clienteIds } = await supabase.rpc("get_my_cliente_ids");
      if (!clienteIds?.length) { setLoading(false); return; }
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, stato, premio_lordo, data_scadenza, durata_da, periodicita, descrizione_polizza, produttore_nome, targa_telaio, prodotto_nome, compagnie(nome), rami(descrizione)")
        .in("cliente_anagrafica_id", clienteIds.map((c: any) => c))
        .order("created_at", { ascending: false });
      setTitoli(data ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );

  const today = new Date();
  const totale = titoli.reduce((sum, t) => sum + (t.premio_lordo ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-teal-700 flex items-center justify-center">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">
            Elenco Posizioni Assicurative Attive
          </h1>
          <p className="text-sm text-muted-foreground">{titoli.length} polizze trovate</p>
        </div>
      </div>

      {titoli.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Nessuna polizza trovata.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-teal-700 hover:bg-teal-700">
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Stato</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Mandato / Compagnia</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Prodotto</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">N° Polizza / Targa</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider">Data Scadenza</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider text-center">Fraz.</TableHead>
                  <TableHead className="text-white font-bold text-xs uppercase tracking-wider text-right">Premio Annuo Lordo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {titoli.map((t, idx) => {
                  const giorni = t.data_scadenza ? differenceInDays(new Date(t.data_scadenza), today) : null;
                  const compagnia = (t.compagnie as any)?.nome ?? "—";
                  const prodotto = (t.rami as any)?.descrizione ?? t.prodotto_nome ?? t.descrizione_polizza ?? "—";
                  const polizzaTarga = [t.numero_titolo, t.targa_telaio].filter(Boolean).join(" / ") || "N/D";

                  return (
                    <TableRow
                      key={t.id}
                      className={`cursor-pointer transition-colors hover:bg-teal-50 ${idx % 2 === 0 ? "bg-white" : "bg-muted/30"}`}
                      onClick={() => {}}
                    >
                      <TableCell className="py-2.5">
                        <Link to={`/cliente/polizze/${t.id}`} className="block">
                          <Badge className={`text-[10px] ${statoBadge[t.stato] ?? "bg-muted text-muted-foreground"}`}>
                            {t.stato}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Link to={`/cliente/polizze/${t.id}`} className="block">
                          <p className="font-semibold text-sm text-foreground">{compagnia}</p>
                          {t.produttore_nome && (
                            <p className="text-xs text-muted-foreground">{t.produttore_nome}</p>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Link to={`/cliente/polizze/${t.id}`} className="block">
                          <p className="text-sm font-medium text-teal-800">{prodotto}</p>
                        </Link>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Link to={`/cliente/polizze/${t.id}`} className="block">
                          <p className="text-sm font-mono text-foreground">{polizzaTarga}</p>
                        </Link>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Link to={`/cliente/polizze/${t.id}`} className="block">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">
                              {t.data_scadenza
                                ? format(new Date(t.data_scadenza), "dd/MM/yyyy", { locale: it })
                                : "—"}
                            </span>
                          </div>
                          {giorni !== null && giorni >= 0 && giorni <= 90 && (
                            <Badge className={`mt-0.5 text-[10px] ${giorni <= 30 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                              {giorni} gg
                            </Badge>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell className="py-2.5 text-center">
                        <Link to={`/cliente/polizze/${t.id}`} className="block">
                          <span className="text-sm">{t.periodicita ?? "—"}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="py-2.5 text-right">
                        <Link to={`/cliente/polizze/${t.id}`} className="block">
                          <span className="text-sm font-bold text-foreground">
                            {t.premio_lordo ? fmt(t.premio_lordo) : "—"}
                          </span>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-teal-50 border-t-2 border-teal-700">
                  <TableCell colSpan={6} className="font-bold text-sm text-teal-900 uppercase">
                    Totale Premio Annuo Lordo
                  </TableCell>
                  <TableCell className="text-right font-bold text-base text-teal-900">
                    {fmt(totale)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientePolizze;
