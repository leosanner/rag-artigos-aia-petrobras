export const RAG_SOURCE_EXCERPT_PREVIEW_LENGTH = 320;

export const RAG_INVALID_REQUEST_MESSAGE =
  "Digite uma pergunta valida para consultar.";

export const RAG_UNAUTHORIZED_MESSAGE =
  "O secret de consulta foi rejeitado. Digite-o novamente para continuar.";

export const RAG_TECHNICAL_ERROR_MESSAGE =
  "Nao foi possivel consultar a base agora. Tente novamente em instantes.";

export const RAG_EMPTY_SOURCES_MESSAGE =
  "Nenhuma fonte foi recuperada para esta pergunta.";

export function truncateExcerptPreview(excerpt: string): string {
  if (excerpt.length <= RAG_SOURCE_EXCERPT_PREVIEW_LENGTH) {
    return excerpt;
  }

  return `${excerpt.slice(0, RAG_SOURCE_EXCERPT_PREVIEW_LENGTH).trimEnd()}...`;
}
