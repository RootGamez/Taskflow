import { Card, CardBody } from "@heroui/react";

import { PageHeader } from "@/components/ui/PageHeader";

export default function WorkspaceSettingsPage() {
  return (
    <div>
      <PageHeader title="Configuracion del workspace" />
      <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardBody>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Configuraciones generales del workspace (placeholder)</p>
        </CardBody>
      </Card>
    </div>
  );
}
