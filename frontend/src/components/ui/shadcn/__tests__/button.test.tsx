import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button, buttonVariants } from "@/components/ui/shadcn/button";

describe("Button", () => {
  it("renders its label and fires onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Crear ticket</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Crear ticket" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("carries the brutalist token classes (thick border + hard shadow) on the primary variant", () => {
    render(<Button>Aceptar</Button>);

    const button = screen.getByRole("button", { name: "Aceptar" });

    expect(button.className).toContain("border-2");
    expect(button.className).toContain("border-foreground");
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("shadow-hard");
  });

  it("renders as the child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/tickets">Ir a tickets</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Ir a tickets" });

    expect(link).toHaveAttribute("href", "/tickets");
    expect(link.className).toContain("btn-brutal");
  });

  it("exposes buttonVariants for composition (e.g. calendar nav buttons)", () => {
    const outline = buttonVariants({ variant: "outline" });

    expect(outline).toContain("border-foreground");
    expect(outline).toContain("bg-transparent");
  });
});
