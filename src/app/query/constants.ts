export const RAG_SOURCE_EXCERPT_PREVIEW_LENGTH = 320;

export const RAG_INVALID_REQUEST_MESSAGE =
  "Digite uma pergunta valida para consultar.";

export const RAG_UNAUTHORIZED_MESSAGE =
  "O secret de consulta foi rejeitado. Digite-o novamente para continuar.";

export const RAG_TECHNICAL_ERROR_MESSAGE =
  "Nao foi possivel consultar a base agora. Tente novamente em instantes.";

export const RAG_GENERATION_FAILED_MESSAGE =
  "A geracao da resposta falhou. Tente reformular a pergunta ou tentar novamente.";

export const RAG_GENERATION_UNAVAILABLE_MESSAGE =
  "Servico de geracao indisponivel no momento. Aguarde alguns instantes e tente de novo.";

export const RAG_RERANKING_FAILED_MESSAGE =
  "A etapa de reranking falhou antes da geracao da resposta. Tente novamente em instantes.";

export const RAG_RERANKING_UNAVAILABLE_MESSAGE =
  "Servico de reranking indisponivel no momento. Aguarde alguns instantes e tente de novo.";

export const RAG_NETWORK_ERROR_MESSAGE =
  "Falha de rede ao falar com o servidor. Verifique a conexao e tente novamente.";

export const RAG_FOCUSED_DOCUMENT_NOT_FOUND_MESSAGE =
  "Documento nao encontrado ou indisponivel para foco.";

export const RAG_FOCUSED_DOCUMENT_NOT_FOCUSABLE_MESSAGE =
  "Documento ainda nao esta pronto para consulta focada.";

export const RAG_FOCUSED_DOCUMENTS_ERROR_MESSAGE =
  "Nao foi possivel carregar os documentos focaveis agora. Tente novamente em instantes.";

export const RAG_FOCUSED_DOCUMENTS_EMPTY_MESSAGE =
  "Nenhum documento pronto para consulta focada foi encontrado.";

export function formatTechnicalErrorMessage(httpStatus: number | null): string {
  const tail = httpStatus === null ? "" : ` [HTTP ${httpStatus}]`;
  return `Erro tecnico ao consultar a base.${tail} Tente novamente em instantes.`;
}

export const RAG_EMPTY_SOURCES_MESSAGE =
  "Nenhuma fonte foi recuperada para esta pergunta.";

export const RAG_HISTORY_IDLE_MESSAGE =
  "Carregue o historico para inspecionar execucoes auditadas persistidas.";

export const RAG_HISTORY_EMPTY_MESSAGE =
  "Nenhuma execucao auditada foi encontrada ainda.";

export const RAG_HISTORY_ERROR_MESSAGE =
  "Nao foi possivel carregar o historico agora. Tente novamente em instantes.";

export const RAG_RUN_DETAIL_IDLE_MESSAGE =
  "Selecione uma execucao do historico para inspecionar a auditoria persistida.";

export const RAG_RUN_DETAIL_ERROR_MESSAGE =
  "Nao foi possivel carregar esta execucao agora. Tente novamente em instantes.";

export const RAG_NO_GENERATION_AUDIT_MESSAGE =
  "Esta execucao nao consumiu geracao de resposta.";

export const STRATEGY_LABEL_STANDARD = "Padrão";
export const STRATEGY_LABEL_EXPLORE = "Explorar";
export const STRATEGY_LABEL_RERANK = "Rerank";

export const STRATEGY_TOOLTIP_STANDARD =
  "Recupera as fontes mais relevantes pela busca híbrida e responde direto. Indicado para perguntas objetivas.";
export const STRATEGY_TOOLTIP_EXPLORE =
  "Amplia a busca para descobrir abordagens e termos relacionados. Útil quando a pergunta ainda está aberta.";
export const STRATEGY_TOOLTIP_RERANK =
  "Recupera mais candidatos e os reordena com um modelo dedicado antes da resposta. Mais lento, porém com fontes melhor priorizadas.";

export const STRATEGY_FOCUSED_NOTE =
  "No modo focado apenas a estratégia padrão está disponível.";

export function truncateExcerptPreview(excerpt: string): string {
  if (excerpt.length <= RAG_SOURCE_EXCERPT_PREVIEW_LENGTH) {
    return excerpt;
  }

  return `${excerpt.slice(0, RAG_SOURCE_EXCERPT_PREVIEW_LENGTH).trimEnd()}...`;
}
