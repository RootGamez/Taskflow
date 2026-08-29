import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import { Textarea } from "@/components/ui/shadcn/textarea";

describe("Input", () => {
  it("accepts typed text", async () => {
    render(<Input aria-label="Título" defaultValue="" />);

    const input = screen.getByLabelText<HTMLInputElement>("Título");
    await userEvent.type(input, "Arreglar login");

    expect(input.value).toBe("Arreglar login");
  });

  it("has a 2px token border and shifts the border to primary on focus (not a diffuse glow)", () => {
    render(<Input aria-label="Buscar" />);

    const input = screen.getByLabelText("Buscar");

    expect(input.className).toContain("border-2");
    expect(input.className).toContain("border-border");
    expect(input.className).toContain("focus-visible:border-primary");
  });

  it("respects the disabled attribute", async () => {
    render(<Input aria-label="Bloqueado" disabled />);

    const input = screen.getByLabelText<HTMLInputElement>("Bloqueado");
    await userEvent.type(input, "x");

    expect(input.value).toBe("");
  });
});

describe("Textarea", () => {
  it("accepts multi-line text and carries the brutalist border classes", async () => {
    render(<Textarea aria-label="Descripción" />);

    const textarea = screen.getByLabelText<HTMLTextAreaElement>("Descripción");
    await userEvent.type(textarea, "Línea 1{enter}Línea 2");

    expect(textarea.value).toBe("Línea 1\nLínea 2");
    expect(textarea.className).toContain("border-2");
    expect(textarea.className).toContain("focus-visible:border-primary");
  });
});

describe("Label", () => {
  it("associates with its control via htmlFor and uses the foreground token color", () => {
    render(
      <>
        <Label htmlFor="email">Correo</Label>
        <Input id="email" />
      </>,
    );

    const label = screen.getByText("Correo");

    expect(label).toHaveAttribute("for", "email");
    expect(label.className).toContain("text-foreground");
  });
});
