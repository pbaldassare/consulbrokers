import { Route } from "react-router-dom";
import PlaceholderPage from "@/components/PlaceholderPage";
import TitoliList from "@/pages/TitoliList";
import TitoloDetail from "@/pages/TitoloDetail";
import GestionePolizzePage from "@/pages/GestionePolizzePage";
import ImmissionePolizzaPage from "@/pages/ImmissionePolizzaPage";
import AppendiciPolizzaPage from "@/pages/AppendiciPolizzaPage";
import DuplicazionePolizzaPage from "@/pages/DuplicazionePolizzaPage";
import ConfermaEmittendePage from "@/pages/ConfermaEmittendePage";
import RinnoviPolizzaPage from "@/pages/RinnoviPolizzaPage";
import StornoPolizzaPage from "@/pages/StornoPolizzaPage";
import DiffProvvigioniPage from "@/pages/DiffProvvigioniPage";
import SospensionePolizzaPage from "@/pages/SospensionePolizzaPage";
import RiattivazionePolizzaPage from "@/pages/RiattivazionePolizzaPage";
import DocPrecontrattualePage from "@/pages/DocPrecontrattualePage";
import EstrazioniStampePage from "@/pages/EstrazioniStampePage";
import AnalisiPreventivoRCAPage from "@/pages/AnalisiPreventivoRCAPage";
import DocumentalePage from "@/pages/DocumentalePage";
import PortafoglioList from "@/pages/PortafoglioList";
import PortafoglioDetail from "@/pages/PortafoglioDetail";
import PortafoglioPerClientePage from "@/pages/estrazioni/PortafoglioPerClientePage";
import PortafoglioPerCompagniaPage from "@/pages/estrazioni/PortafoglioPerCompagniaPage";
import PremiProvvigioniPage from "@/pages/estrazioni/PremiProvvigioniPage";
import PremiScopertiGarantitiPage from "@/pages/estrazioni/PremiScopertiGarantitiPage";
import ECClientiPage from "@/pages/estrazioni/ECClientiPage";
import { BookOpen, ClipboardList, FileCheck, FileUp } from "lucide-react";

export const portafoglioRoutes = (
  <>
    <Route path="/titoli" element={<TitoliList />} />
    <Route path="/titoli/:id" element={<TitoloDetail />} />
    <Route path="/portafoglio" element={<PortafoglioList />} />
    <Route path="/portafoglio/:id" element={<PortafoglioDetail />} />
    <Route path="/portafoglio/gestione-polizze" element={<GestionePolizzePage />} />
    <Route path="/portafoglio/immissione" element={<ImmissionePolizzaPage />} />
    <Route path="/portafoglio/appendici" element={<AppendiciPolizzaPage />} />
    <Route path="/portafoglio/duplicazione" element={<DuplicazionePolizzaPage />} />
    <Route path="/portafoglio/conferma-emittende" element={<ConfermaEmittendePage />} />
    <Route path="/portafoglio/rinnovi" element={<RinnoviPolizzaPage />} />
    <Route path="/portafoglio/storno" element={<StornoPolizzaPage />} />
    <Route path="/portafoglio/diff-provvigionali" element={<DiffProvvigioniPage />} />
    <Route path="/portafoglio/sospensione" element={<SospensionePolizzaPage />} />
    <Route path="/portafoglio/riattivazione" element={<RiattivazionePolizzaPage />} />
    <Route path="/portafoglio/doc-precontrattuale" element={<DocPrecontrattualePage />} />
    <Route path="/portafoglio/estrazioni-stampe" element={<EstrazioniStampePage />} />
    <Route path="/portafoglio/estrazioni/per-cliente" element={<PortafoglioPerClientePage />} />
    <Route path="/portafoglio/estrazioni/per-compagnia" element={<PortafoglioPerCompagniaPage />} />
    <Route path="/portafoglio/estrazioni/premi-provvigioni" element={<PremiProvvigioniPage />} />
    <Route path="/portafoglio/estrazioni/premi-scoperti-garantiti" element={<PremiScopertiGarantitiPage />} />
    <Route path="/portafoglio/estrazioni/ec-clienti" element={<ECClientiPage />} />
    <Route path="/portafoglio/collettive" element={<PlaceholderPage title="Collettive / Libri Matricola" description="Gestione polizze collettive e libri matricola" icon={BookOpen} />} />
    <Route path="/portafoglio/regolazioni" element={<PlaceholderPage title="Regolazioni" description="Regolazioni premio polizze" icon={ClipboardList} />} />
    <Route path="/portafoglio/documentale" element={<DocumentalePage />} />
    <Route path="/portafoglio/rientro-documenti" element={<PlaceholderPage title="Rientro Documenti" description="Gestione rientro documenti dalle compagnie" icon={FileCheck} />} />
    <Route path="/portafoglio/import-titoli" element={<PlaceholderPage title="Import Titoli (Excel)" description="Importazione massiva titoli da file Excel" icon={FileUp} />} />
    <Route path="/portafoglio/analisi-preventivo-rca" element={<AnalisiPreventivoRCAPage />} />
  </>
);
