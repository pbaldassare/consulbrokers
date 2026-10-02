import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileThemeToggle } from "@/components/ThemeToggle";
import { initializeTheme } from "@/hooks/useTheme";
import { purgeClientCaches } from "@/lib/versionCheck";

function mockSystemDark(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("tema applicazione", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa il tema chiaro di default anche se il sistema è scuro", () => {
    mockSystemDark(true);

    initializeTheme();

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("aprire il selettore profilo non cambia il tema inizializzato", async () => {
    mockSystemDark(true);
    initializeTheme();

    render(<ProfileThemeToggle />);

    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
    expect(screen.getByLabelText("Tema chiaro")).toHaveAttribute("data-state", "on");
  });

  it("applica e memorizza il tema scuro solo dopo la scelta esplicita", async () => {
    mockSystemDark(false);
    initializeTheme();
    render(<ProfileThemeToggle />);

    fireEvent.click(screen.getByLabelText("Tema scuro"));

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(localStorage.getItem("consulnet-theme")).toBe("dark");
  });

  it("mantiene la preferenza tema durante la pulizia delle cache", async () => {
    localStorage.setItem("consulnet-theme", "light");
    localStorage.setItem("chiave-temporanea", "da eliminare");

    await purgeClientCaches();

    expect(localStorage.getItem("consulnet-theme")).toBe("light");
    expect(localStorage.getItem("chiave-temporanea")).toBeNull();
  });
});
