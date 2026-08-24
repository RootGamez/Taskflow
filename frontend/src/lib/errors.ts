import axios from "axios";

interface ApiErrorDetailMap {
  [key: string]: string[] | string;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return typeof first === "string" ? first : null;
  }

  return null;
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (!axios.isAxiosError(error)) {
    return fallbackMessage;
  }

  const data = error.response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const objectData = data as {
      detail?: string;
      non_field_errors?: string[];
    } & ApiErrorDetailMap;

    const detailMessage = firstString(objectData.detail);
    if (detailMessage) {
      return detailMessage;
    }

    const nonFieldErrorMessage = firstString(objectData.non_field_errors);
    if (nonFieldErrorMessage) {
      return nonFieldErrorMessage;
    }

    const firstFieldMessage = Object.values(objectData)
      .map((value) => firstString(value))
      .find((message) => Boolean(message));

    if (firstFieldMessage) {
      return firstFieldMessage;
    }
  }

  return fallbackMessage;
}
