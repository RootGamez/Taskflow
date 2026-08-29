import { Button, Input } from "@heroui/react";

export function TicketForm() {
  return (
    <form className="space-y-3">
      <Input label="Titulo" placeholder="Titulo del ticket" radius="none" />
      <Button color="primary" className="rounded-none">
        Crear ticket
      </Button>
    </form>
  );
}
