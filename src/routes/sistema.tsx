import { Route, Navigate } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import ImpostazioniPage from "@/pages/ImpostazioniPage";
import GestioneUtentiPrivilegi from "@/pages/GestioneUtentiPrivilegi";
import BackupExport from "@/pages/BackupExport";
import ManutenzionePage from "@/pages/ManutenzionePage";
import TabelleBasePage from "@/pages/TabelleBasePage";
import GestioneUfficiPage from "@/pages/GestioneUfficiPage";
import AnomalieList from "@/pages/AnomalieList";
import AnomalieKO from "@/pages/AnomalieKO";
import NotifichePage from "@/pages/NotifichePage";
import CompagnieList from "@/pages/CompagnieList";
import TemplatePage from "@/pages/TemplatePage";
import PrivacyConsensi from "@/pages/PrivacyConsensi";
import ComunicazioniPage from "@/pages/ComunicazioniPage";
import ReportPage from "@/pages/ReportPage";

import SpedizioniList from "@/pages/SpedizioniList";
import NoteRestituzioneList from "@/pages/NoteRestituzioneList";
import NotaRestituzioneDetail from "@/pages/NotaRestituzioneDetail";
import FlussiCompagnieList from "@/pages/FlussiCompagnieList";
import FlussoCompagniaDetail from "@/pages/FlussoCompagniaDetail";
import PagamentiProvvigioniList from "@/pages/PagamentiProvvigioniList";
import PagamentoProvvigioneDetail from "@/pages/PagamentoProvvigioneDetail";
import SitemapPage from "@/pages/SitemapPage";
import StoricoGarePage from "@/pages/StoricoGarePage";

export const sistemaRoutes = (
  <>
    {/* ADMIN */}
    <Route path="/impostazioni" element={<RoleGuard allowedRoles={["admin", "ufficio"]}><ImpostazioniPage /></RoleGuard>} />
    <Route path="/crea-utente" element={<Navigate to="/utenti-privilegi?wizard=open" replace />} />
    <Route path="/gestione-utenti" element={<Navigate to="/utenti-privilegi" replace />} />
    <Route path="/utenti-privilegi" element={<RoleGuard allowedRoles={["admin"]}><GestioneUtentiPrivilegi /></RoleGuard>} />
    <Route path="/backup-export" element={<RoleGuard allowedRoles={["admin"]}><BackupExport /></RoleGuard>} />
    <Route path="/manutenzione" element={<RoleGuard allowedRoles={["admin"]}><ManutenzionePage /></RoleGuard>} />
    <Route path="/tabelle-base" element={<RoleGuard allowedRoles={["admin"]}><TabelleBasePage /></RoleGuard>} />
    <Route path="/compagnie" element={<RoleGuard allowedRoles={["admin"]}><CompagnieList /></RoleGuard>} />
    {/* Categorie e Prodotti rimossi dal menu — gestiti nella tab Agenzie */}
    <Route path="/gestione-uffici" element={<RoleGuard allowedRoles={["admin"]}><GestioneUfficiPage /></RoleGuard>} />
    <Route path="/template" element={<RoleGuard allowedRoles={["admin", "ufficio"]}><TemplatePage /></RoleGuard>} />
    <Route path="/anomalie-sistema" element={<RoleGuard allowedRoles={["admin", "cfo", "ufficio"]}><AnomalieList /></RoleGuard>} />
    <Route path="/sitemap" element={<RoleGuard allowedRoles={["admin"]}><SitemapPage /></RoleGuard>} />

    {/* STANDALONE */}
    <Route path="/portafoglio/gestione-polizze" element={<Navigate to="/portafoglio/gestione" replace />} />
    <Route path="/anomalie-ko" element={<AnomalieKO />} />
    <Route path="/note-restituzione" element={<NoteRestituzioneList />} />
    <Route path="/note-restituzione/:id" element={<NotaRestituzioneDetail />} />
    <Route path="/spedizioni" element={<SpedizioniList />} />
    <Route path="/notifiche" element={<NotifichePage />} />
    <Route path="/privacy" element={<PrivacyConsensi />} />
    <Route path="/flussi-compagnie" element={<FlussiCompagnieList />} />
    <Route path="/flussi-compagnie/:id" element={<FlussoCompagniaDetail />} />
    <Route path="/pagamenti-provvigioni" element={<PagamentiProvvigioniList />} />
    <Route path="/pagamenti-provvigioni/:id" element={<PagamentoProvvigioneDetail />} />
    <Route path="/report" element={<ReportPage />} />
    <Route path="/chat" element={<ComunicazioniPage />} />
    <Route path="/comunicazioni" element={<ComunicazioniPage />} />
    <Route path="/trattative/storico-gare" element={<RoleGuard allowedRoles={["admin","cfo","responsabile_sede","ufficio","backoffice","account_executive","specialist","produttore","executive"]}><StoricoGarePage /></RoleGuard>} />
  </>
);
