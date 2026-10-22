import type {
  IndexingRunDetailResponse,
  IndexingRunItemResponse,
} from "@/application/indexing/schemas";
import { useLocale } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/locales";

type RunStatus = IndexingRunDetailResponse["status"];
type ItemStatus = IndexingRunItemResponse["status"];

export type IndexingMessages = {
  title: string;
  lede: string;
  secretLabel: string;
  documentIdLabel: string;
  documentIdPlaceholder: string;
  forceLabel: string;
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
    skipped: string;
    lastError: string;
    runStatus: Record<RunStatus, string>;
  };
  items: {
    title: string;
    document: string;
    status: string;
    chunks: string;
    error: string;
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

const PT_BR: IndexingMessages = {
  title: "Indexação de documentos",
  lede: "Inicie a indexação manual dos documentos processados. O segredo fica somente nesta aba do navegador.",
  secretLabel: "Segredo do operador",
  documentIdLabel: "Documento específico",
  documentIdPlaceholder: "UUID opcional do documento",
  forceLabel: "Recriar chunks existentes",
  start: "Iniciar indexação",
  starting: "Iniciando...",
  clearSecret: "Limpar segredo",
  unauthorized: "O segredo foi recusado. Informe novamente.",
  conflict: "Outra indexação já está ativa. Execução ativa:",
  unknownRun: "desconhecida",
  pollActiveRun: "Acompanhar execução ativa",
  run: {
    title: "Execução",
    id: "Id",
    status: "Status",
    selected: "Selecionados",
    processed: "Processados",
    failed: "Falhos",
    skipped: "Ignorados",
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
    document: "Documento",
    status: "Status",
    chunks: "Chunks",
    error: "Erro",
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
      `Erro de rede ao iniciar indexação: ${detail ?? "desconhecido"}`,
    unexpected: (httpStatus) => `Resposta inesperada (HTTP ${httpStatus})`,
  },
};

const EN: IndexingMessages = {
  title: "Document indexing",
  lede: "Start a manual indexing run for processed documents. The secret is kept only in this browser tab.",
  secretLabel: "Operator secret",
  documentIdLabel: "Specific document",
  documentIdPlaceholder: "Optional document UUID",
  forceLabel: "Rebuild existing chunks",
  start: "Start indexing",
  starting: "Starting...",
  clearSecret: "Clear secret",
  unauthorized: "The secret was rejected. Enter it again.",
  conflict: "Another indexing run is already active. Active run:",
  unknownRun: "unknown",
  pollActiveRun: "Follow active run",
  run: {
    title: "Run",
    id: "Id",
    status: "Status",
    selected: "Selected",
    processed: "Processed",
    failed: "Failed",
    skipped: "Skipped",
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
    document: "Document",
    status: "Status",
    chunks: "Chunks",
    error: "Error",
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
      `Network error while starting indexing: ${detail ?? "unknown"}`,
    unexpected: (httpStatus) => `Unexpected response (HTTP ${httpStatus})`,
  },
};

export const INDEXING_MESSAGES: Readonly<Record<Locale, IndexingMessages>> = {
  "pt-BR": PT_BR,
  en: EN,
};

export function useIndexingMessages(): IndexingMessages {
  return INDEXING_MESSAGES[useLocale().locale];
}

// Errors are stored as codes, not text, so an alert already on screen is
// re-rendered in the new language when the locale changes.
export type IndexingRunError =
  | { code: "poll_http"; httpStatus: number }
  | { code: "malformed_detail" }
  | { code: "malformed_queued" }
  | { code: "network"; detail: string | null }
  | { code: "unexpected"; httpStatus: number };

export function describeIndexingError(
  messages: IndexingMessages,
  error: IndexingRunError,
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
