import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChangelogContenuto } from "@/components/ChangelogPopup";

describe("ChangelogContenuto", () => {
  it("renderizza heading, grassetto, lista e link (non il markdown grezzo)", () => {
    render(
      <ChangelogContenuto
        changelog={{
          cambiamenti: [
            "# Prova changelog\n\nTesto con **grassetto** e [sito](https://cbnet.it)\n\n- primo\n- secondo",
          ],
          bug_in_carico: [],
          problemi_noti: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Prova changelog" })).toBeInTheDocument();
    expect(screen.queryByText("# Prova changelog")).not.toBeInTheDocument();
    expect(screen.getByText("grassetto").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "sito" })).toHaveAttribute("href", "https://cbnet.it");
    expect(screen.getByText("primo").closest("li")).toBeTruthy();
  });

  it("non esegue HTML raw (niente script)", () => {
    render(
      <ChangelogContenuto
        changelog={{
          cambiamenti: ['<script>window.__xss = 1</script>\n# Titolo sicuro'],
          bug_in_carico: [],
          problemi_noti: [],
        }}
      />,
    );

    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("heading", { name: "Titolo sicuro" })).toBeInTheDocument();
  });

  it("non rende clickabili i link javascript:", () => {
    render(
      <ChangelogContenuto
        changelog={{
          cambiamenti: ["[click](javascript:alert(1))"],
          bug_in_carico: [],
          problemi_noti: [],
        }}
      />,
    );

    const link = screen.queryByRole("link", { name: "click" });
    if (link) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/^javascript:/i);
    }
  });

  it("accetta heading e liste senza spazio dopo # e -", () => {
    render(
      <ChangelogContenuto
        changelog={{
          cambiamenti: ["##Titolo senza spazio\n-voce"],
          bug_in_carico: [],
          problemi_noti: [],
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Titolo senza spazio" })).toBeInTheDocument();
    expect(screen.getByText("voce").closest("li")).toBeTruthy();
  });

  it("nasconde le sezioni vuote e mostra i titoli delle altre", () => {
    render(
      <ChangelogContenuto
        changelog={{
          cambiamenti: [],
          bug_in_carico: ["- login lento"],
          problemi_noti: [],
        }}
      />,
    );

    expect(screen.getByText("Bug presi in carico")).toBeInTheDocument();
    expect(screen.queryByText("Problemi noti")).not.toBeInTheDocument();
    expect(screen.getByText("login lento")).toBeInTheDocument();
  });
});
