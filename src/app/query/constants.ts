export const RAG_SOURCE_EXCERPT_PREVIEW_LENGTH = 320;

export const RAG_INVALID_REQUEST_MESSAGE =
  "Digite uma pergunta válida para consultar.";

export const RAG_UNAUTHORIZED_MESSAGE =
  "O secret de consulta foi rejeitado. Digite-o novamente para continuar.";

export const RAG_TECHNICAL_ERROR_MESSAGE =
  "Não foi possível consultar a base agora. Tente novamente em instantes.";

export const RAG_GENERATION_FAILED_MESSAGE =
  "A geração da resposta falhou. Tente reformular a pergunta ou tentar novamente.";

export const RAG_GENERATION_UNAVAILABLE_MESSAGE =
  "Serviço de geração indisponível no momento. Aguarde alguns instantes e tente de novo.";

export const RAG_RERANKING_FAILED_MESSAGE =
  "A etapa de reranking falhou antes da geração da resposta. Tente novamente em instantes.";

export const RAG_RERANKING_UNAVAILABLE_MESSAGE =
  "Serviço de reranking indisponível no momento. Aguarde alguns instantes e tente de novo.";

export const RAG_NETWORK_ERROR_MESSAGE =
  "Falha de rede ao falar com o servidor. Verifique a conexão e tente novamente.";

export const RAG_FOCUSED_DOCUMENT_NOT_FOUND_MESSAGE =
  "Documento não encontrado ou indisponível para foco.";

export const RAG_FOCUSED_DOCUMENT_NOT_FOCUSABLE_MESSAGE =
  "Documento ainda não está pronto para consulta focada.";

export const RAG_FOCUSED_DOCUMENTS_ERROR_MESSAGE =
  "Não foi possível carregar os documentos focáveis agora. Tente novamente em instantes.";

export const RAG_FOCUSED_DOCUMENTS_EMPTY_MESSAGE =
  "Nenhum documento pronto para consulta focada foi encontrado.";

export function formatTechnicalErrorMessage(httpStatus: number | null): string {
  const tail = httpStatus === null ? "" : ` [HTTP ${httpStatus}]`;
  return `Erro técnico ao consultar a base.${tail} Tente novamente em instantes.`;
}

export const RAG_EMPTY_SOURCES_MESSAGE =
  "Nenhuma fonte foi recuperada para esta pergunta.";

export const RAG_HISTORY_IDLE_MESSAGE =
  "Carregue o histórico para inspecionar execuções auditadas persistidas.";

export const RAG_HISTORY_EMPTY_MESSAGE =
  "Nenhuma execução auditada foi encontrada ainda.";

export const RAG_HISTORY_ERROR_MESSAGE =
  "Não foi possível carregar o histórico agora. Tente novamente em instantes.";

export const RAG_RUN_DETAIL_IDLE_MESSAGE =
  "Selecione uma execução do histórico para inspecionar a auditoria persistida.";

export const RAG_RUN_DETAIL_ERROR_MESSAGE =
  "Não foi possível carregar esta execução agora. Tente novamente em instantes.";

export const RAG_NO_GENERATION_AUDIT_MESSAGE =
  "Esta execução não consumiu geração de resposta.";

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

export const RAG_AUDIT_DRAWER_TITLE = "Auditoria da mensagem";
export const RAG_AUDIT_DRAWER_CLOSE_LABEL = "Fechar auditoria";
export const RAG_AUDIT_DRAWER_EMPTY = "Nenhuma mensagem selecionada para auditoria.";

export const RAG_PHASE_COPY_RETRIEVING = "Recuperando candidatos…";
export const RAG_PHASE_COPY_RERANKING = "Reordenando candidatos…";
export const RAG_PHASE_COPY_GENERATING = "Gerando resposta…";

export const RAG_STREAM_RELATED_TERMS_TITLE = "Termos relacionados";

export function truncateExcerptPreview(excerpt: string): string {
  if (excerpt.length <= RAG_SOURCE_EXCERPT_PREVIEW_LENGTH) {
    return excerpt;
  }

  return `${excerpt.slice(0, RAG_SOURCE_EXCERPT_PREVIEW_LENGTH).trimEnd()}...`;
}
