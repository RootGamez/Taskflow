import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";

interface FieldLock {
  userId: string;
  userName: string;
}

interface UseCollaborativeFieldOptions<T, TField extends string> {
  field: TField;
  value: T;
  setValue: (value: T) => void;
  isOpen: boolean;
  currentUserId: string | null;
  lock?: FieldLock | null;
  activeFieldRef: MutableRefObject<string | null>;
  onLockField?: (field: TField) => void;
  onUnlockField?: (field: TField) => void;
  hasRemoteValue?: boolean;
  remoteValue?: T;
  onBeforeApplyRemote?: () => void;
}

export function useCollaborativeField<T, TField extends string>({
  field,
  value,
  setValue,
  isOpen,
  currentUserId,
  lock,
  activeFieldRef,
  onLockField,
  onUnlockField,
  hasRemoteValue = false,
  remoteValue,
  onBeforeApplyRemote,
}: UseCollaborativeFieldOptions<T, TField>) {
  const isLockedByOther = useMemo(() => {
    return Boolean(currentUserId && lock && lock.userId !== currentUserId);
  }, [currentUserId, lock]);

  const onFocus = useCallback(() => {
    activeFieldRef.current = field;
    onLockField?.(field);
  }, [activeFieldRef, field, onLockField]);

  const onBlur = useCallback(() => {
    activeFieldRef.current = null;
    onUnlockField?.(field);
  }, [activeFieldRef, field, onUnlockField]);

  useEffect(() => {
    if (!isOpen || !hasRemoteValue || remoteValue === undefined) {
      return;
    }

    if (activeFieldRef.current === field) {
      return;
    }

    if (remoteValue === value) {
      return;
    }

    onBeforeApplyRemote?.();
    setValue(remoteValue);
  }, [
    activeFieldRef,
    field,
    hasRemoteValue,
    isOpen,
    onBeforeApplyRemote,
    remoteValue,
    setValue,
    value,
  ]);

  return {
    isLockedByOther,
    lockOwner: lock?.userName,
    onFocus,
    onBlur,
  };
}
