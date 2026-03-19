import { Button, Input } from "@heroui/react";

export function TicketForm() {
  return (
    <form className="space-y-3">
      <Input label="Titulo" placeholder="Titulo del ticket" />
      <Button color="primary">Crear ticket</Button>
    </form>
  );
}
