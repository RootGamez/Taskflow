import { Button, Card, CardBody, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  useDeleteWorkspace,
  useUpdateWorkspace,
  useWorkspaces,
} from "@/features/workspaces/hooks/useWorkspaces";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function WorkspaceSettingsPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const { data: workspaces = [], isLoading, refetch } = useWorkspaces();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);

  const updateWorkspaceMutation = useUpdateWorkspace(workspaceSlug);
  const deleteWorkspaceMutation = useDeleteWorkspace(workspaceSlug);

  const workspace = useMemo(
    () => workspaces.find((item) => item.slug === workspaceSlug) ?? null,
    [workspaces, workspaceSlug],
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const canEdit = workspace?.role === "owner" || workspace?.role === "admin";
  const canDelete = workspace?.role === "owner";

  useEffect(() => {
    if (!workspace) {
      return;
    }

    setName(workspace.name ?? "");
    setSlug(workspace.slug ?? "");
    setLogoUrl(workspace.logo_url ?? "");
  }, [workspace]);

  const handleSave = async () => {
    if (!workspace || !canEdit) {
      return;
    }

    try {
      const updated = await updateWorkspaceMutation.mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
        logo_url: logoUrl.trim(),
      });
      if (activeWorkspace?.id === updated.id) {
        setActiveWorkspace(updated);
      }

      if (updated.slug !== workspaceSlug) {
        navigate(`/workspaces/${updated.slug}/settings`);
      }

      toast.success("Espacio de trabajo actualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el espacio de trabajo"));
    }
  };

  const handleDelete = async () => {
    if (!workspace || !canDelete) {
      return;
    }

    try {
      await deleteWorkspaceMutation.mutateAsync();
      const refreshed = await refetch();
      const nextWorkspaces = refreshed.data ?? [];
      const nextActive = nextWorkspaces.find((item) => item.is_active) ?? nextWorkspaces[0] ?? null;

      if (nextActive) {
        setActiveWorkspace(nextActive);
        navigate(`/workspaces/${nextActive.slug}`);
      } else {
        navigate("/");
      }

      toast.success("Espacio de trabajo eliminado");
      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el espacio de trabajo"));
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!workspace) {
    return (
      <div>
        <PageHeader title="Configuracion del espacio" />
        <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardBody>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Espacio no encontrado.</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configuracion del espacio" subtitle="Edita datos generales y administra opciones criticas" />

      <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardBody className="space-y-4">
          <Input
            label="Nombre"
            value={name}
            onValueChange={setName}
            isDisabled={!canEdit || updateWorkspaceMutation.isPending}
          />
          <Input
            label="Slug"
            value={slug}
            onValueChange={setSlug}
            isDisabled={!canEdit || updateWorkspaceMutation.isPending}
            description="URL publica del espacio"
          />
          <Input
            label="Logo URL"
            value={logoUrl}
            onValueChange={setLogoUrl}
            isDisabled={!canEdit || updateWorkspaceMutation.isPending}
            placeholder="https://..."
          />

          <div className="flex flex-wrap gap-2">
            <Button
              color="primary"
              onPress={handleSave}
              isLoading={updateWorkspaceMutation.isPending}
              isDisabled={!canEdit || !name.trim() || !slug.trim()}
            >
              Guardar cambios
            </Button>
          </div>

          {!canEdit ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Solo owner o admin pueden editar configuraciones.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card className="border border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20">
        <CardBody className="space-y-3">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">Zona de peligro</p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Eliminar un espacio borra proyectos, tickets y configuraciones asociadas.
          </p>
          <Button
            color="danger"
            variant="flat"
            isDisabled={!canDelete}
            onPress={() => setDeleteDialogOpen(true)}
          >
            Eliminar espacio
          </Button>
          {!canDelete ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Solo el owner puede eliminar este espacio.</p>
          ) : null}
        </CardBody>
      </Card>

      <Modal
        isOpen={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setDeleteConfirmation("");
          }
        }}
      >
        <ModalContent>
          <ModalHeader>Eliminar espacio</ModalHeader>
          <ModalBody>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Esta accion no se puede deshacer. Escribe <strong>{workspace.name}</strong> para confirmar.
            </p>
            <Input
              label="Confirmacion"
              value={deleteConfirmation}
              onValueChange={setDeleteConfirmation}
              placeholder={workspace.name}
              isDisabled={deleteWorkspaceMutation.isPending}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
            >
              Cancelar
            </Button>
            <Button
              color="danger"
              isLoading={deleteWorkspaceMutation.isPending}
              onPress={() => {
                if (deleteConfirmation.trim() !== workspace.name) {
                  toast.error("El nombre no coincide. No se elimino el espacio.");
                  return;
                }
                void handleDelete();
              }}
            >
              Eliminar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
