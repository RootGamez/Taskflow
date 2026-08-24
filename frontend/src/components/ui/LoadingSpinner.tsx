import { Spinner } from "@heroui/react";

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Spinner color="primary" />
    </div>
  );
}
