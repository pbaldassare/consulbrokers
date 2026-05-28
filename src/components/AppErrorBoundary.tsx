import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { refreshToLatestVersion } from "@/lib/versionCheck";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] React crash", error, info);
  }

  private reload = async () => {
    await refreshToLatestVersion("user clicked reload from error boundary");
  };

  private goHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <section className="w-full max-w-lg border bg-card rounded-lg shadow-lg p-6 space-y-4">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Si è verificato un errore</h1>
            <p className="text-sm text-muted-foreground">
              L'applicazione ha intercettato un crash imprevisto. Puoi ricaricare la pagina senza perdere la sessione.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={this.reload}>Ricarica</Button>
            <Button variant="outline" onClick={this.goHome}>Torna alla home</Button>
          </div>
        </section>
      </main>
    );
  }
}

export default AppErrorBoundary;