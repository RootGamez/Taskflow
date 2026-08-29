import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import {
  useDeleteWorkspace,
  useUploadWorkspaceLogo,
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
  const uploadWorkspaceLogoMutation = useUploadWorkspaceLogo(workspaceSlug);
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
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleSelectLogo = () => {
    logoFileInputRef.current?.click();
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !workspace) {
      return;
    }

    try {
      const updated = await uploadWorkspaceLogoMutation.mutateAsync(file);
      setLogoUrl(updated.logo_url ?? "");
      if (activeWorkspace?.id === updated.id) {
        setActiveWorkspace(updated);
      }
      toast.success("Logo actualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo subir el logo"));
    } finally {
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!workspace) {
    return (
      <div>
        <PageHeader eyebrow="Espacio" title="Configuracion del espacio" />
        <div className="border-2 border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Espacio no encontrado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espacio"
        title="Configuracion del espacio"
        subtitle="Edita datos generales y administra opciones criticas"
      />

      <div className="border-2 border-border bg-card">
        <div className="space-y-4 p-6">
          <p className="eyebrow text-foreground">Datos generales</p>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-name">Nombre</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canEdit || updateWorkspaceMutation.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-slug">Slug</Label>
            <Input
              id="workspace-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              disabled={!canEdit || updateWorkspaceMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">URL publica del espacio</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="workspace-logo-url">Logo URL</Label>
            <Input
              id="workspace-logo-url"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              disabled={!canEdit || updateWorkspaceMutation.isPending}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="space-y-3 border-t-2 border-border p-6">
          <p className="eyebrow text-foreground">Logo del espacio</p>
          <div className="flex items-center gap-3">
            <img
              src={logoUrl || undefined}
              alt="Logo del espacio"
              className="h-12 w-12 rounded border-2 border-border object-cover"
            />
            <div className="space-y-1">
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                size="sm"
                variant="flat"
                className="rounded-none"
                onPress={handleSelectLogo}
                isDisabled={!canEdit}
                isLoading={uploadWorkspaceLogoMutation.isPending}
              >
                Subir logo
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP o GIF. Max 5MB.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-border p-6">
          <Button
            color="primary"
            className="rounded-none"
            onPress={handleSave}
            isLoading={updateWorkspaceMutation.isPending}
            isDisabled={!canEdit || !name.trim() || !slug.trim()}
          >
            Guardar cambios
          </Button>
          {!canEdit ? (
            <p className="text-xs text-muted-foreground">
              Solo owner o admin pueden editar configuraciones.
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-2 border-destructive bg-destructive/5">
        <div className="space-y-3 p-6">
          <p className="eyebrow text-destructive">Zona de peligro</p>
          <p className="text-sm text-foreground">
            Eliminar un espacio borra proyectos, tickets y configuraciones asociadas.
          </p>
          <Button
            color="danger"
            variant="flat"
            className="rounded-none"
            isDisabled={!canDelete}
            onPress={() => setDeleteDialogOpen(true)}
          >
            Eliminar espacio
          </Button>
          {!canDelete ? (
            <p className="text-xs text-muted-foreground">Solo el owner puede eliminar este espacio.</p>
          ) : null}
        </div>
      </div>

      <Modal
        isOpen={isDeleteDialogOpen}
        classNames={{
          backdrop: "bg-foreground/60",
          base: "rounded-none border-2 border-border",
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setDeleteConfirmation("");
          }
        }}
      >
        <ModalContent>
          <ModalHeader className="font-display tracking-tight">Eliminar espacio</ModalHeader>
          <ModalBody>
            <p className="text-sm text-muted-foreground">
              Esta accion no se puede deshacer. Escribe <strong>{workspace.name}</strong> para confirmar.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="workspace-delete-confirm">Confirmacion</Label>
              <Input
                id="workspace-delete-confirm"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={workspace.name}
                disabled={deleteWorkspaceMutation.isPending}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              className="rounded-none"
              onPress={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
            >
              Cancelar
            </Button>
            <Button
              color="danger"
              className="rounded-none"
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
