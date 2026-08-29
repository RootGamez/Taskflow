import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcn/card";

describe("Card", () => {
  it("has a 2px token border and no resting shadow by default", () => {
    render(<Card data-testid="panel">Contenido</Card>);

    const card = screen.getByTestId("panel");

    expect(card.className).toContain("border-2");
    expect(card.className).toContain("border-border");
    expect(card.className).not.toContain("shadow-hard");
  });

  it("adds a 3px border and a hard shadow for hero panels (weekly goals board, stats)", () => {
    render(
      <Card hero data-testid="panel">
        Pizarra
      </Card>,
    );

    const card = screen.getByTestId("panel");

    expect(card.className).toContain("border-3");
    expect(card.className).toContain("shadow-hard-lg");
  });

  it("adds a resting hard shadow for elevated (floating) panels", () => {
    render(
      <Card elevated data-testid="panel">
        Popover-like
      </Card>,
    );

    expect(screen.getByTestId("panel").className).toContain("shadow-hard");
  });

  it("renders the full header/title/description/content/footer composition", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Proyectos</CardTitle>
          <CardDescription>Resumen del espacio</CardDescription>
        </CardHeader>
        <CardContent>3 activos</CardContent>
        <CardFooter>Pie</CardFooter>
      </Card>,
    );

    expect(screen.getByRole("heading", { name: "Proyectos" })).toBeInTheDocument();
    expect(screen.getByText("Resumen del espacio")).toBeInTheDocument();
    expect(screen.getByText("3 activos")).toBeInTheDocument();
    expect(screen.getByText("Pie")).toBeInTheDocument();
  });

  it("titles use the display font", () => {
    render(<CardTitle>Sprint activo</CardTitle>);

    expect(screen.getByRole("heading", { name: "Sprint activo" }).className).toContain(
      "font-display",
    );
  });
});
