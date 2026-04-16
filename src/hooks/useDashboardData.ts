import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ChatNonRisposta {
  canaleId: string;
  canaleNome: string;
  mittente: string;
  testo: string;
  data: string;
}

export interface AdminData {
  rinnoviMeseCount: number;
  rinnoviMeseImporto: number;
  rinnoviOggiCount: number;
  rinnoviOggiImporto: number;
  incassiIeriCount: number;
  incassiIeriImporto: number;
  incassiMeseCount: number;
  incassiMeseImporto: number;
  raccoltaPremiAnno: number;
  nuoviClientiMese: number;
  chatNonRisposte: ChatNonRisposta[];
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

    const { data: { user } } = await supabase.auth.getUser();

    const [
      { data: rinnoviMese, count: rinnoviMeseCount },
      { data: rinnoviOggi, count: rinnoviOggiCount },
      { data: incassiIeri, count: incassiIeriCount },
      { data: incassiMese, count: incassiMeseCount },
      { data: raccoltaAnno },
      { count: nuoviClientiMese },
    ] = await Promise.all([
      supabase.from("v_portafoglio_titoli").select("premio_lordo", { count: "exact" }).gte("data_scadenza", startOfMonth).lte("data_scadenza", endOfMonth).limit(10000),
      supabase.from("v_portafoglio_titoli").select("premio_lordo", { count: "exact" }).eq("data_scadenza", oggi).limit(10000),
      supabase.from("v_portafoglio_titoli").select("premio_lordo", { count: "exact" }).eq("data_messa_cassa", ieri).limit(10000),
      supabase.from("v_portafoglio_titoli").select("premio_lordo", { count: "exact" }).gte("data_messa_cassa", startOfMonth).lte("data_messa_cassa", endOfMonth).limit(10000),
      supabase.from("v_portafoglio_titoli").select("premio_lordo").gte("data_messa_cassa", startOfYear).limit(10000),
      supabase.from("clienti").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
    ]);

    const sumPremio = (arr: any[] | null) => (arr || []).reduce((s: number, t: any) => s + (t.premio_lordo || 0), 0);

    // Chat non risposte
    let chatNonRisposte: ChatNonRisposta[] = [];
    if (user) {
      const { data: memberships } = await supabase
        .from("chat_canali_membri")
        .select("canale_id")
        .eq("user_id", user.id);

      if (memberships && memberships.length > 0) {
        const canaleIds = memberships.map((m: any) => m.canale_id);
        
        // Fetch channels info
        const { data: canali } = await supabase
          .from("chat_canali")
          .select("id, nome")
          .in("id", canaleIds);

        // For each channel, get the last message
        const chatPromises = canaleIds.map((cId: string) =>
          supabase
            .from("chat_messaggi_interni")
            .select("id, messaggio, mittente_id, created_at, profiles:mittente_id(nome, cognome)")
            .eq("canale_id", cId)
            .order("created_at", { ascending: false })
            .limit(1)
        );

        const chatResults = await Promise.all(chatPromises);

        chatResults.forEach((res, idx) => {
          const msg = res.data?.[0];
          if (msg && msg.mittente_id !== user.id) {
            const canale = canali?.find((c: any) => c.id === canaleIds[idx]);
            const prof = msg.profiles as any;
            chatNonRisposte.push({
              canaleId: canaleIds[idx],
              canaleNome: canale?.nome || "Chat",
              mittente: prof ? `${prof.nome || ""} ${prof.cognome || ""}`.trim() : "Utente",
              testo: msg.messaggio || "",
              data: msg.created_at || "",
            });
          }
        });
      }
    }

    setAdmin({
      rinnoviMeseCount: rinnoviMese?.length || 0,
      rinnoviMeseImporto: sumPremio(rinnoviMese),
      rinnoviOggiCount: rinnoviOggi?.length || 0,
      rinnoviOggiImporto: sumPremio(rinnoviOggi),
      incassiIeriCount: incassiIeri?.length || 0,
      incassiIeriImporto: sumPremio(incassiIeri),
      incassiMeseCount: incassiMese?.length || 0,
      incassiMeseImporto: sumPremio(incassiMese),
      raccoltaPremiAnno: sumPremio(raccoltaAnno),
      nuoviClientiMese: nuoviClientiMese || 0,
      chatNonRisposte,
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
    const scadenze30gg = (titoli || []).filter((t: any) => t.stato === "attivo").length;

    const mesiMap: Record<string, number> = {};
    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      mesiMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }

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
