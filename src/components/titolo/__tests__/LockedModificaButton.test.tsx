import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TITOLO_MODIFICA_LOCKED_INCASSO } from "@/lib/titoloModificaLocked";
import { LockedModificaButton } from "../LockedModificaButton";

describe("LockedModificaButton", () => {
  it("quando locked per incasso, hover/focus espone il tooltip sul wrapper", () => {
    render(
      <TooltipProvider>
        <LockedModificaButton
          disabled
          lockedTitle={TITOLO_MODIFICA_LOCKED_INCASSO}
          onClick={vi.fn()}
        />
      </TooltipProvider>,
    );

    expect(screen.getByRole("button", { name: /Modifica/ })).toBeDisabled();
    expect(screen.getByLabelText(TITOLO_MODIFICA_LOCKED_INCASSO)).toBeInTheDocument();
  });

  it("quando editabile non avvolge con tooltip", () => {
    render(
      <LockedModificaButton disabled={false} onClick={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /Modifica/ })).toBeEnabled();
    expect(screen.queryByLabelText(TITOLO_MODIFICA_LOCKED_INCASSO)).not.toBeInTheDocument();
  });
});
