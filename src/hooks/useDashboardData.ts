import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AdminData {
  rinnoviMeseCount: number;
  rinnoviMeseImporto: number;
  rinnoviOggiCount: number;
  rinnoviOggiImporto: number;
  incassiIeriCount: number;
  incassiIeriImporto: number;
  incassiMeseCount: number;
  incassiMeseImporto: number;
  polizzeAttive: number;
  portafoglioTotale: number;
  raccoltaPremiAnno: number;
  nuoviClientiMese: number;
  attivitaRecenti: { id: string; azione: string; utente: string; data: string; entita_tipo: string }[];
}

export interface UfficioData {
  clientiUfficio: number;
  incassiRecenti: number;
  sinistriAperti: number;
  scadenze30gg: number;
  incassiMensili: { mese: string; importo: number }[];
  sinistriPerStato: { name: string; value: number }[];
}

export interface ProduttoreData {
  trattativeAperte: number;
  titoliAnno: number;
  provvigioniDaLiquidare: number;
  provvigioniMensili: { mese: string; importo: number }[];
}

export interface ContabilitaData {
  anomalieIncroci: number;
  fattureDaVerificare: number;
  incassiKO: number;
}

export interface CfoData {
  entrateTotali: number;
  usciteTotali: number;
  redditivita: number;
  provvigioniDaPagare: number;
}

export function useDashboardData(ruolo: string) {
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [ufficio, setUfficio] = useState<UfficioData | null>(null);
  const [produttore, setProduttore] = useState<ProduttoreData | null>(null);
  const [contabilita, setContabilita] = useState<ContabilitaData | null>(null);
  const [cfo, setCfo] = useState<CfoData | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        switch (ruolo) {
          case "admin":
            await loadAdmin();
            break;
          case "ufficio":
            await loadUfficio();
            break;
          case "produttore":
            await loadProduttore();
            break;
          case "contabilita":
            await loadContabilita();
            break;
          case "cfo":
            await loadCfo();
            break;
          default:
            await loadAdmin();
        }
      } catch (e) {
        console.error("Dashboard data error:", e);
      } finally {
        setLoading(false);
      }
    };
    if (ruolo) load();
  }, [ruolo]);

  const currentYear = new Date().getFullYear();
  const startOfYear = `${currentYear}-01-01`;
  const startOfMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

  const loadAdmin = async () => {
    const oggi = new Date().toISOString().substring(0, 10);
    const ieri = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().substring(0, 10);

    const [
      { data: rinnoviMese },
      { data: rinnoviOggi },
      { data: incassiIeri },
      { data: incassiMese },
      { count: polizzeAttive },
      { data: portafoglioData },
      { data: raccoltaAnno },
      { count: nuoviClientiMese },
      { data: logData },
    ] = await Promise.all([
      supabase.from("titoli").select("premio_lordo").gte("data_scadenza", startOfMonth).lte("data_scadenza", endOfMonth),
      supabase.from("titoli").select("premio_lordo").eq("data_scadenza", oggi),
      supabase.from("titoli").select("premio_lordo").eq("data_messa_cassa", ieri),
      supabase.from("titoli").select("premio_lordo").gte("data_messa_cassa", startOfMonth).lte("data_messa_cassa", endOfMonth),
      supabase.from("titoli").select("*", { count: "exact", head: true }).eq("stato", "attivo"),
      supabase.from("titoli").select("premio_lordo").eq("stato", "attivo"),
      supabase.from("titoli").select("premio_lordo").gte("data_messa_cassa", startOfYear),
      supabase.from("clienti").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
      supabase.from("log_attivita").select("id, azione, created_at, entita_tipo, user_id, profiles:user_id(nome, cognome)").order("created_at", { ascending: false }).limit(10),
    ]);

    const sumPremio = (arr: any[] | null) => (arr || []).reduce((s: number, t: any) => s + (t.premio_lordo || 0), 0);

    const attivitaRecenti = (logData || []).map((l: any) => ({
      id: l.id,
      azione: l.azione || "",
      utente: l.profiles ? `${l.profiles.nome || ""} ${l.profiles.cognome || ""}`.trim() : "Sistema",
      data: l.created_at,
      entita_tipo: l.entita_tipo || "",
    }));

    setAdmin({
      rinnoviMeseCount: rinnoviMese?.length || 0,
      rinnoviMeseImporto: sumPremio(rinnoviMese),
      rinnoviOggiCount: rinnoviOggi?.length || 0,
      rinnoviOggiImporto: sumPremio(rinnoviOggi),
      incassiIeriCount: incassiIeri?.length || 0,
      incassiIeriImporto: sumPremio(incassiIeri),
      incassiMeseCount: incassiMese?.length || 0,
      incassiMeseImporto: sumPremio(incassiMese),
      polizzeAttive: polizzeAttive || 0,
      portafoglioTotale: sumPremio(portafoglioData),
      raccoltaPremiAnno: sumPremio(raccoltaAnno),
      nuoviClientiMese: nuoviClientiMese || 0,
      attivitaRecenti,
    });
  };

  const loadUfficio = async () => {
    const [
      { count: clientiUfficio },
      { count: sinistriAperti },
      { data: movimenti },
      { data: titoli },
      { data: sinistriAll },
    ] = await Promise.all([
      supabase.from("clienti").select("*", { count: "exact", head: true }),
      supabase.from("sinistri").select("*", { count: "exact", head: true }).in("stato", ["aperto", "in_gestione"]),
      supabase.from("movimenti_contabili").select("importo, data_movimento").eq("tipo", "entrata").gte("data_movimento", startOfMonth),
      supabase.from("titoli").select("stato, created_at"),
      supabase.from("sinistri").select("stato"),
    ]);

    const incassiRecenti = (movimenti || []).reduce((s: number, m: any) => s + (m.importo || 0), 0);
    const oggi = new Date();
    const fra30 = new Date();
    fra30.setDate(fra30.getDate() + 30);
    const scadenze30gg = (titoli || []).filter((t: any) => t.stato === "attivo").length; // simplified

    // Incassi mensili
    const mesiMap: Record<string, number> = {};
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      mesiMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }

    // Sinistri per stato
    const statoMap: Record<string, number> = {};
    (sinistriAll || []).forEach((s: any) => {
      statoMap[s.stato] = (statoMap[s.stato] || 0) + 1;
    });
    const sinistriPerStato = Object.entries(statoMap).map(([name, value]) => ({ name, value }));

    const incassiMensili = Object.entries(mesiMap).map(([k]) => {
      const [, m] = k.split("-");
      return { mese: monthNames[parseInt(m) - 1], importo: 0 };
    });

    setUfficio({
      clientiUfficio: clientiUfficio || 0,
      incassiRecenti,
      sinistriAperti: sinistriAperti || 0,
      scadenze30gg,
      incassiMensili,
      sinistriPerStato,
    });
  };

  const loadProduttore = async () => {
    const [
      { count: trattativeAperte },
      { count: titoliAnno },
      { data: provvigioni },
    ] = await Promise.all([
      supabase.from("prospect").select("*", { count: "exact", head: true }).in("stato", ["nuovo", "contattato", "in_trattativa"]),
      supabase.from("titoli").select("*", { count: "exact", head: true }).gte("created_at", startOfYear),
      supabase.from("provvigioni_generate").select("importo_provvigione, calcolata_il").eq("pagata", false),
    ]);

    const provvigioniDaLiquidare = (provvigioni || []).reduce((s: number, p: any) => s + (p.importo_provvigione || 0), 0);

    // Provvigioni mensili
    const mesiMap: Record<string, number> = {};
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      mesiMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    (provvigioni || []).forEach((p: any) => {
      if (p.calcolata_il) {
        const key = p.calcolata_il.substring(0, 7);
        if (key in mesiMap) mesiMap[key] += p.importo_provvigione || 0;
      }
    });
    const provvigioniMensili = Object.entries(mesiMap).map(([k, v]) => {
      const [, m] = k.split("-");
      return { mese: monthNames[parseInt(m) - 1], importo: v };
    });

    setProduttore({
      trattativeAperte: trattativeAperte || 0,
      titoliAnno: titoliAnno || 0,
      provvigioniDaLiquidare,
      provvigioniMensili,
    });
  };

  const loadContabilita = async () => {
    const [
      { count: anomalieIncroci },
      { count: incassiKO },
      { count: fattureDaVerificare },
    ] = await Promise.all([
      supabase.from("incroci_bancari").select("*", { count: "exact", head: true }).eq("esito", "ko"),
      supabase.from("incroci_bancari").select("*", { count: "exact", head: true }).eq("esito", "ko").eq("verificato", false),
      supabase.from("movimenti_contabili").select("*", { count: "exact", head: true }).eq("stato", "da_verificare"),
    ]);

    setContabilita({
      anomalieIncroci: anomalieIncroci || 0,
      fattureDaVerificare: fattureDaVerificare || 0,
      incassiKO: incassiKO || 0,
    });
  };

  const loadCfo = async () => {
    const [
      { data: entrate },
      { data: uscite },
      { data: provvigioni },
    ] = await Promise.all([
      supabase.from("movimenti_contabili").select("importo").eq("tipo", "entrata").gte("data_movimento", startOfYear),
      supabase.from("movimenti_contabili").select("importo").eq("tipo", "uscita").gte("data_movimento", startOfYear),
      supabase.from("provvigioni_generate").select("importo_provvigione").eq("pagata", false),
    ]);

    const entrateTotali = (entrate || []).reduce((s: number, e: any) => s + (e.importo || 0), 0);
    const usciteTotali = (uscite || []).reduce((s: number, e: any) => s + (e.importo || 0), 0);
    const redditivita = entrateTotali > 0 ? Math.round(((entrateTotali - usciteTotali) / entrateTotali) * 100) : 0;
    const provvigioniDaPagare = (provvigioni || []).reduce((s: number, p: any) => s + (p.importo_provvigione || 0), 0);

    setCfo({ entrateTotali, usciteTotali, redditivita, provvigioniDaPagare });
  };

  return { loading, admin, ufficio, produttore, contabilita, cfo };
}
