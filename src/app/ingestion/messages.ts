import type {
  IngestionRunDetailResponse,
  IngestionRunItemResponse,
} from "@/application/ingestion/schemas";
import { useLocale } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/locales";

type RunStatus = IngestionRunDetailResponse["status"];
type ItemStatus = IngestionRunItemResponse["status"];

export type IngestionMessages = {
  title: string;
  lede: string;
  secretLabel: string;
  start: string;
  starting: string;
  clearSecret: string;
  unauthorized: string;
  conflict: string;
  unknownRun: string;
  pollActiveRun: string;
  run: {
    title: string;
    id: string;
    status: string;
    selected: string;
    processed: string;
    failed: string;
    skippedExisting: string;
    lastError: string;
    runStatus: Record<RunStatus, string>;
  };
  items: {
    title: string;
    driveFileId: string;
    status: string;
    lastError: string;
    itemStatus: Record<ItemStatus, string>;
  };
  errors: {
    pollHttp: (httpStatus: number) => string;
    malformedDetail: string;
    malformedQueued: string;
    network: (detail: string | null) => string;
    unexpected: (httpStatus: number) => string;
  };
};

const PT_BR: IngestionMessages = {
  title: "Ingestão de documentos",
  lede: "Inicie uma nova execução de ingestão para buscar novos PDFs na pasta configurada do Drive. O segredo do operador fica somente nesta aba do navegador.",
  secretLabel: "Segredo do operador",
  start: "Iniciar ingestão",
  starting: "Iniciando...",
  clearSecret: "Limpar segredo",
  unauthorized:
    "O segredo do operador foi recusado. Informe-o novamente e tente outra vez.",
  conflict: "Outra ingestão já está ativa. Execução ativa:",
  unknownRun: "desconhecida",
  pollActiveRun: "Acompanhar execução ativa",
  run: {
    title: "Execução",
    id: "Id da execução",
    status: "Status",
    selected: "Selecionados",
    processed: "Processados",
    failed: "Falhos",
    skippedExisting: "Ignorados (já existentes)",
    lastError: "Último erro",
    runStatus: {
      queued: "na fila",
      processing: "processando",
      completed: "concluída",
      failed: "falhou",
    },
  },
  items: {
    title: "Título",
    driveFileId: "Id do arquivo no Drive",
    status: "Status",
    lastError: "Último erro",
    itemStatus: {
      processing: "processando",
      processed: "processado",
      failed: "falhou",
    },
  },
  errors: {
    pollHttp: (httpStatus) =>
      `Falha ao consultar a execução (HTTP ${httpStatus})`,
    malformedDetail: "A resposta da execução veio em formato inválido",
    malformedQueued: "A resposta de fila veio em formato inválido",
    network: (detail) =>
      `Erro de rede ao iniciar a ingestão: ${detail ?? "desconhecido"}`,
    unexpected: (httpStatus) => `Resposta inesperada (HTTP ${httpStatus})`,
  },
};

const EN: IngestionMessages = {
  title: "Document ingestion",
  lede: "Start a new ingestion run to pick up new PDFs from the configured Drive folder. The operator secret is kept only in this browser tab.",
  secretLabel: "Operator secret",
  start: "Start ingestion run",
  starting: "Starting...",
  clearSecret: "Clear secret",
  unauthorized: "Operator secret was rejected. Please re-enter it and try again.",
  conflict: "Another ingestion run is already active. Active run id:",
  unknownRun: "unknown",
  pollActiveRun: "Poll active run",
  run: {
    title: "Run",
    id: "Run id",
    status: "Status",
    selected: "Selected",
    processed: "Processed",
    failed: "Failed",
    skippedExisting: "Skipped (existing)",
    lastError: "Last error",
    runStatus: {
      queued: "queued",
      processing: "processing",
      completed: "completed",
      failed: "failed",
    },
  },
  items: {
    title: "Title",
    driveFileId: "Drive file id",
    status: "Status",
    lastError: "Last error",
    itemStatus: {
      processing: "processing",
      processed: "processed",
      failed: "failed",
    },
  },
  errors: {
    pollHttp: (httpStatus) => `Failed to fetch run status (HTTP ${httpStatus})`,
    malformedDetail: "Received a malformed run detail response",
    malformedQueued: "Received a malformed queued response",
    network: (detail) =>
      `Network error while starting the run: ${detail ?? "unknown"}`,
    unexpected: (httpStatus) => `Unexpected response (HTTP ${httpStatus})`,
  },
};

export const INGESTION_MESSAGES: Readonly<Record<Locale, IngestionMessages>> = {
  "pt-BR": PT_BR,
  en: EN,
};

export function useIngestionMessages(): IngestionMessages {
  return INGESTION_MESSAGES[useLocale().locale];
}

// Errors are stored as codes, not text, so an alert already on screen is
// re-rendered in the new language when the locale changes.
export type IngestionRunError =
  | { code: "poll_http"; httpStatus: number }
  | { code: "malformed_detail" }
  | { code: "malformed_queued" }
  | { code: "network"; detail: string | null }
  | { code: "unexpected"; httpStatus: number };

export function describeIngestionError(
  messages: IngestionMessages,
  error: IngestionRunError,
): string {
  switch (error.code) {
    case "poll_http":
      return messages.errors.pollHttp(error.httpStatus);
    case "malformed_detail":
      return messages.errors.malformedDetail;
    case "malformed_queued":
      return messages.errors.malformedQueued;
    case "network":
      return messages.errors.network(error.detail);
    case "unexpected":
      return messages.errors.unexpected(error.httpStatus);
  }
}
