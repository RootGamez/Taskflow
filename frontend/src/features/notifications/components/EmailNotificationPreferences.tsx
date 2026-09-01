import { Switch } from "@heroui/react";
import { AtSign, Loader2, MessageSquare, UserPlus, type LucideIcon } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/features/notifications/hooks/useNotificationPreferences";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationEmailTypeKey,
} from "@/features/notifications/types/notificationPreferences.types";

interface EmailPreferenceRow {
  key: NotificationEmailTypeKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Un renglon por tipo de correo. Los iconos son los mismos que usa la
 * campana (`lib/notificationPresentation.ts`) para que el usuario reconozca
 * de un vistazo que notificacion esta apagando.
 */
const EMAIL_PREFERENCE_ROWS: readonly EmailPreferenceRow[] = [
  {
    key: "email_ticket_assigned",
    label: "Te asignan un ticket",
    description: "Cuando alguien te suma como responsable de un ticket.",
    icon: UserPlus,
  },
  {
    key: "email_ticket_mentioned",
    label: "Te mencionan",
    description: "Cuando te nombran en un comentario con @.",
    icon: AtSign,
  },
  {
    key: "email_ticket_commented",
    label: "Comentan un ticket tuyo",
    description: "Nuevos comentarios en tickets que creaste, tienes asignados o comentaste.",
    icon: MessageSquare,
  },
];

interface EmailNotificationPreferencesProps {
  /** Correo al que llegan los avisos; se muestra para que no haya dudas. */
  email?: string;
}

/**
 * Panel de "que correos quiero recibir".
 *
 * No hay boton de guardar: cada switch se persiste solo (ver
 * `useUpdateNotificationPreferences`). Apagar todo aca nunca silencia la
 * campana de la app, solo el correo.
 */
export function EmailNotificationPreferences({ email }: EmailNotificationPreferencesProps) {
  const { data, isPending, isError } = useNotificationPreferences();
  const updateMutation = useUpdateNotificationPreferences();

  // Mientras carga se pintan los defaults del backend (todo activado) con
  // los controles deshabilitados: evita el salto visual de un panel vacio.
  const preferences = data ?? DEFAULT_NOTIFICATION_PREFERENCES;
  const isEmailEnabled = preferences.email_notifications;
  const isLocked = isPending || isError;

  const savePreference = (patch: Parameters<typeof updateMutation.mutate>[0]) => {
    updateMutation.mutate(patch, {
      onError: () => {
        toast.error("No se pudieron guardar las preferencias");
      },
    });
  };

  return (
    <section className="space-y-4 border-t-2 border-border pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-foreground">Notificaciones por correo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige que te avisamos
            {email ? (
              <>
                {" a "}
                <span className="font-mono text-foreground">{email}</span>
              </>
            ) : null}
            . Dentro de la app las sigues viendo todas en la campana.
          </p>
        </div>
        {updateMutation.isPending ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            Guardando
          </span>
        ) : null}
      </div>

      {isError ? (
        <p className="border-2 border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
          No se pudieron cargar tus preferencias. Recarga la pagina para intentarlo de nuevo.
        </p>
      ) : null}

      <div className="divide-y-2 divide-border border-2 border-border">
        <div className="flex items-center justify-between gap-3 bg-secondary px-3 py-3">
          <div>
            <p className="font-medium text-foreground">Recibir correos de TaskFlow</p>
            <p className="text-sm text-muted-foreground">
              Apagalo para no recibir ningun correo de notificaciones.
            </p>
          </div>
          <Switch
            aria-label="Recibir correos de TaskFlow"
            isSelected={isEmailEnabled}
            isDisabled={isLocked}
            onValueChange={(isSelected) => savePreference({ email_notifications: isSelected })}
          />
        </div>

        {EMAIL_PREFERENCE_ROWS.map(({ key, label, description, icon: Icon }) => (
          <div
            key={key}
            className={`flex items-center justify-between gap-3 bg-card px-3 py-3 transition-opacity ${
              isEmailEnabled ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="boxed-icon mt-0.5 h-7 w-7 shrink-0 text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-medium text-foreground">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              aria-label={label}
              isSelected={preferences[key]}
              // El maestro apagado manda: los switches por tipo quedan
              // visibles (para que se vea que siguen configurados) pero sin
              // efecto hasta que se vuelva a encender.
              isDisabled={isLocked || !isEmailEnabled}
              onValueChange={(isSelected) => savePreference({ [key]: isSelected })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
