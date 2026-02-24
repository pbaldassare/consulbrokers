import { Bell, LogOut, Menu } from "lucide-react";

interface TopbarProps {
  onToggleSidebar: () => void;
}

const Topbar = ({ onToggleSidebar }: TopbarProps) => {
  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-3 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground leading-tight">Mario Rossi</p>
            <p className="text-xs text-muted-foreground">Amministratore</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-xs font-semibold text-primary-foreground">MR</span>
          </div>
        </div>

        <button className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default Topbar;
