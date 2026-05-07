import type { AxiosResponse } from "axios";

export const readServerStatus = {
  validateStatus: () => true,
} as const;

export function getServerMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const body = data as { error?: unknown; message?: unknown };

    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }

    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  }

  return fallback;
}

export function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const response = (error as { response?: { data?: unknown } }).response;
    return getServerMessage(response?.data, fallback);
  }

  return fallback;
}

export function assertOkResponse<T>(
  response: AxiosResponse<T>,
  fallback: string,
) {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(getServerMessage(response.data, fallback));
  }

  return response;
}

export function assertSuccessResponse<T extends { success?: boolean }>(
  response: AxiosResponse<T>,
  fallback: string,
) {
  assertOkResponse(response, fallback);

  if (response.data?.success !== true) {
    throw new Error(getServerMessage(response.data, fallback));
  }

  return response;
}
