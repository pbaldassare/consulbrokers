import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CanaliSidebar from "@/components/chat/CanaliSidebar";
import ChatArea from "@/components/chat/ChatArea";
import NuovaConversazioneDialog from "@/components/chat/NuovaConversazioneDialog";

export default function ComunicazioniPage() {
  const { profile } = useAuth();
  const [canaleAttivoId, setCanaleAttivoId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!profile) return null;

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar canali */}
      <div className="w-72 shrink-0">
        <CanaliSidebar
          canaleAttivoId={canaleAttivoId}
          onSelectCanale={setCanaleAttivoId}
          onNuovaConversazione={() => setDialogOpen(true)}
          userId={profile.id}
        />
      </div>

      {/* Area chat */}
      <ChatArea canaleId={canaleAttivoId} />

      {/* Dialog nuova conversazione */}
      <NuovaConversazioneDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(id) => {
          setCanaleAttivoId(id);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
