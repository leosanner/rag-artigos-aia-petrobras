type RagErrorContext = Record<string, unknown>;

type SerializedError =
  | { value: unknown }
  | {
      name?: string;
      message: string;
      stack?: string;
      statusCode?: number;
      cause?: SerializedError;
    };

export function logRagError(
  event: string,
  context: RagErrorContext,
  error: unknown,
): void {
  const payload = {
    level: "error",
    scope: "rag",
    event,
    ...context,
    error: serializeError(error),
  };

  console.error(JSON.stringify(payload));
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const serialized: Extract<SerializedError, { message: string }> = {
      name: error.name,
      message: error.message,
    };

    if (typeof error.stack === "string") {
      serialized.stack = error.stack;
    }

    const statusCode = extractStatusCode(error);
    if (statusCode !== null) {
      serialized.statusCode = statusCode;
    }

    if (error.cause !== undefined) {
      serialized.cause = serializeError(error.cause);
    }

    return serialized;
  }

  if (typeof error === "object" && error !== null) {
    const message = extractMessage(error);
    const statusCode = extractStatusCode(error);

    if (message !== "" || statusCode !== null) {
      const serialized: Extract<SerializedError, { message: string }> = {
        message,
      };

      if (statusCode !== null) {
        serialized.statusCode = statusCode;
      }

      return serialized;
    }
  }

  return { value: error };
}

function extractStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const value = Reflect.get(error, "statusCode") ?? Reflect.get(error, "status");
  return typeof value === "number" ? value : null;
}

function extractMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  const value = Reflect.get(error, "message");
  return typeof value === "string" ? value : "";
}
