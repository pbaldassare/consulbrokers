import { Route, Navigate } from "react-router-dom";
import PlaceholderPage from "@/components/PlaceholderPage";
import TitoliList from "@/pages/TitoliList";
import TitoloDetail from "@/pages/TitoloDetail";
import PolizzaDetail from "@/pages/PolizzaDetail";
import QuietanzaDetail from "@/pages/QuietanzaDetail";

import ImmissionePolizzaPage from "@/pages/ImmissionePolizzaPage";
import AppendiciPolizzaPage from "@/pages/AppendiciPolizzaPage";
import RinnoviPolizzaPage from "@/pages/RinnoviPolizzaPage";
import GestionePolizzePage from "@/pages/GestionePolizzePage";

import DocPrecontrattualePage from "@/pages/DocPrecontrattualePage";
import EstrazioniStampePage from "@/pages/EstrazioniStampePage";

import DocumentalePage from "@/pages/DocumentalePage";
import ProvvigioniMaturatePage from "@/pages/ProvvigioniMaturatePage";
import ProvvigioniCompagnieRamoPage from "@/pages/ProvvigioniCompagnieRamoPage";
import PortafoglioAttivePage from "@/pages/PortafoglioAttivePage";
import PortafoglioCaricoPage from "@/pages/PortafoglioCaricoPage";
import PortafoglioStoricoPage from "@/pages/PortafoglioStoricoPage";
import PortafoglioDetail from "@/pages/PortafoglioDetail";
import CompensazioniTitoloDetail from "@/pages/contabilita/CompensazioniTitoloDetail";
import PortafoglioPerClientePage from "@/pages/estrazioni/PortafoglioPerClientePage";
import PortafoglioPerCompagniaPage from "@/pages/estrazioni/PortafoglioPerCompagniaPage";
import PremiProvvigioniPage from "@/pages/estrazioni/PremiProvvigioniPage";
import PremiScopertiGarantitiPage from "@/pages/estrazioni/PremiScopertiGarantitiPage";
import ECClientiPage from "@/pages/estrazioni/ECClientiPage";
import { BookOpen } from "lucide-react";

export const portafoglioRoutes = (
  <>
    <Route path="/titoli" element={<TitoliList />} />
    <Route path="/titoli/:id" element={<TitoloDetail />} />
    <Route path="/polizze/:id" element={<PolizzaDetail />} />
    <Route path="/quietanze/:id" element={<QuietanzaDetail />} />
    <Route path="/portafoglio" element={<Navigate to="/portafoglio/attive" replace />} />
    <Route path="/portafoglio/attive" element={<PortafoglioAttivePage />} />
    <Route path="/portafoglio/carico" element={<PortafoglioCaricoPage />} />
    <Route path="/portafoglio/storico" element={<PortafoglioStoricoPage />} />
    <Route path="/portafoglio/:id/compensazioni" element={<CompensazioniTitoloDetail />} />
    <Route path="/portafoglio/:id" element={<PortafoglioDetail />} />
    
    <Route path="/portafoglio/immissione" element={<ImmissionePolizzaPage />} />
    <Route path="/portafoglio/appendici" element={<AppendiciPolizzaPage />} />
    <Route path="/portafoglio/rinnovi" element={<RinnoviPolizzaPage />} />
    <Route path="/portafoglio/gestione" element={<GestionePolizzePage />} />

    <Route path="/portafoglio/doc-precontrattuale" element={<DocPrecontrattualePage />} />
    <Route path="/portafoglio/estrazioni-stampe" element={<EstrazioniStampePage />} />
    <Route path="/portafoglio/estrazioni/per-cliente" element={<PortafoglioPerClientePage />} />
    <Route path="/portafoglio/estrazioni/per-compagnia" element={<PortafoglioPerCompagniaPage />} />
    <Route path="/portafoglio/estrazioni/premi-provvigioni" element={<PremiProvvigioniPage />} />
    <Route path="/portafoglio/estrazioni/premi-scoperti-garantiti" element={<PremiScopertiGarantitiPage />} />
    <Route path="/portafoglio/estrazioni/ec-clienti" element={<ECClientiPage />} />
    <Route path="/portafoglio/collettive" element={<PlaceholderPage title="Collettive / Libri Matricola" description="Gestione polizze collettive e libri matricola" icon={BookOpen} />} />
    <Route path="/portafoglio/documentale" element={<DocumentalePage />} />
    <Route path="/provvigioni-maturate" element={<ProvvigioniMaturatePage />} />
    <Route path="/provvigioni-compagnie-ramo" element={<ProvvigioniCompagnieRamoPage />} />
  </>
);
