import type { RagQueryRunStatus } from "@/domain/rag";
import { useLocale } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/locales";

export type QueryMessages = {
  header: {
    titleLead: string;
    titleAccent: string;
    lede: string;
  };
  toolbar: {
    ariaLabel: string;
    secretLabel: string;
    modeLegend: string;
    modeGlobal: string;
    modeFocused: string;
    focusedDocumentLabel: string;
    focusedSecretRequired: string;
    focusedDocumentsLoading: string;
    retry: string;
    selectDocumentPlaceholder: string;
    documentAuthors: string;
    documentYear: string;
    documentDoi: string;
    documentChunks: string;
    documentUpdated: string;
    chooseDocumentHint: string;
    clearSecret: string;
    newConversation: string;
    loading: string;
  };
  strategies: {
    selectLabel: string;
    guideAriaLabel: string;
    guideTitle: string;
    guideCopy: string;
    focusedNote: string;
    standard: { label: string; tooltip: string };
    explore: { label: string; tooltip: string };
    rerank: { label: string; tooltip: string };
  };
  conversation: {
    title: string;
    notFound: string;
    loading: string;
    assistant: string;
    operator: string;
    live: string;
    viewAudit: string;
    questionLabel: string;
    questionPlaceholder: string;
    advanced: string;
    topKLabel: string;
    candidateTopKLabel: string;
    submit: string;
    submitting: string;
    phaseRetrieving: string;
    phaseReranking: string;
    phaseGenerating: string;
    hintRetrieving: string;
    hintGenerating: string;
    relatedTermsTitle: string;
  };
  audit: {
    drawerTitle: string;
    drawerClose: string;
    summaryTitle: string;
    relatedTermsTitle: string;
    sourcesTitle: string;
    notApplied: string;
    noGeneration: string;
    relatedTermsEmpty: string;
    emptySources: string;
    cited: string;
    yes: string;
    no: string;
    focusAction: string;
    focusStarting: string;
    runStatus: Record<RagQueryRunStatus, string>;
  };
  errors: {
    invalidRequest: string;
    unauthorized: string;
    technical: string;
    generationFailed: string;
    generationUnavailable: string;
    network: string;
    focusedDocumentNotFound: string;
    focusedDocumentNotFocusable: string;
    focusedDocumentsError: string;
    focusedDocumentsEmpty: string;
    technicalWithStatus: (httpStatus: number | null) => string;
  };
};

const PT_BR: QueryMessages = {
  header: {
    titleLead: "Consulta na base",
    titleAccent: "de artigos",
    lede: "Faça uma pergunta sobre toda a base ou restrinja a consulta a um documento específico. Todas as respostas mantêm citações inline, fontes numeradas e trilha de auditoria. Apenas usuários com o secret podem consultar ou ler o histórico persistido.",
  },
  toolbar: {
    ariaLabel: "Controles da consulta",
    secretLabel: "Secret de consulta",
    modeLegend: "Modo de consulta",
    modeGlobal: "Base inteira",
    modeFocused: "Documento específico",
    focusedDocumentLabel: "Documento alvo",
    focusedSecretRequired: "Informe o secret para listar documentos disponíveis.",
    focusedDocumentsLoading: "Carregando documentos disponíveis...",
    retry: "Tentar novamente",
    selectDocumentPlaceholder: "Selecione um documento focável",
    documentAuthors: "autores",
    documentYear: "ano",
    documentDoi: "doi",
    documentChunks: "chunks indexados",
    documentUpdated: "atualizado",
    chooseDocumentHint: "Escolha um documento para habilitar a consulta focada.",
    clearSecret: "Limpar secret",
    newConversation: "Nova conversa",
    loading: "Carregando...",
  },
  strategies: {
    selectLabel: "Estratégia",
    guideAriaLabel: "Guia de estratégias",
    guideTitle: "Estratégias de busca",
    guideCopy:
      "Escolha o modo no seletor abaixo. Em consultas focadas a estratégia padrão é aplicada automaticamente.",
    focusedNote: "No modo focado apenas a estratégia padrão está disponível.",
    standard: {
      label: "Padrão",
      tooltip:
        "Recupera as fontes mais relevantes pela busca híbrida e responde direto. Indicado para perguntas objetivas.",
    },
    explore: {
      label: "Explorar",
      tooltip:
        "Amplia a busca para descobrir abordagens e termos relacionados. Útil quando a pergunta ainda está aberta.",
    },
    rerank: {
      label: "Rerank",
      tooltip:
        "Recupera mais candidatos e os reordena com um modelo dedicado antes da resposta. Mais lento, porém com fontes melhor priorizadas.",
    },
  },
  conversation: {
    title: "Conversa",
    notFound: "Conversa não encontrada ou indisponível para recarga.",
    loading: "Carregando conversa...",
    assistant: "Assistente",
    operator: "Operador",
    live: "Ao vivo",
    viewAudit: "Ver auditoria",
    questionLabel: "Pergunta",
    questionPlaceholder:
      "Ex.: Quais técnicas aparecem com mais frequência nos estudos ou neste documento?",
    advanced: "Avançado",
    topKLabel: "Fontes recuperadas",
    candidateTopKLabel: "Candidatos para rerank",
    submit: "Consultar base",
    submitting: "Consultando...",
    phaseRetrieving: "Recuperando candidatos…",
    phaseReranking: "Reordenando candidatos…",
    phaseGenerating: "Gerando resposta…",
    hintRetrieving: "Selecionando os trechos finais para responder.",
    hintGenerating:
      "A resposta vai aparecendo abaixo conforme os tokens chegam.",
    relatedTermsTitle: "Termos relacionados",
  },
  audit: {
    drawerTitle: "Auditoria da mensagem",
    drawerClose: "Fechar auditoria",
    summaryTitle: "Parâmetros da consulta",
    relatedTermsTitle: "Termos relacionados",
    sourcesTitle: "Fontes consultadas",
    notApplied: "não aplicado",
    noGeneration: "Esta execução não consumiu geração de resposta.",
    relatedTermsEmpty: "Nenhum termo relacionado auditavel foi encontrado.",
    emptySources: "Nenhuma fonte foi recuperada para esta pergunta.",
    cited: "citado",
    yes: "sim",
    no: "não",
    focusAction: "Conversar apenas sobre este artigo",
    focusStarting: "Preparando foco...",
    runStatus: {
      answered: "respondida",
      answered_no_evidence: "respondida sem evidência",
      generation_failed: "falha segura",
      generation_unavailable: "geração indisponível",
      reranking_failed: "reranking com falha segura",
      reranking_unavailable: "reranking indisponível",
    },
  },
  errors: {
    invalidRequest: "Digite uma pergunta válida para consultar.",
    unauthorized:
      "O secret de consulta foi rejeitado. Digite-o novamente para continuar.",
    technical:
      "Não foi possível consultar a base agora. Tente novamente em instantes.",
    generationFailed:
      "A geração da resposta falhou. Tente reformular a pergunta ou tentar novamente.",
    generationUnavailable:
      "Serviço de geração indisponível no momento. Aguarde alguns instantes e tente de novo.",
    network:
      "Falha de rede ao falar com o servidor. Verifique a conexão e tente novamente.",
    focusedDocumentNotFound: "Documento não encontrado ou indisponível para foco.",
    focusedDocumentNotFocusable:
      "Documento ainda não está pronto para consulta focada.",
    focusedDocumentsError:
      "Não foi possível carregar os documentos focáveis agora. Tente novamente em instantes.",
    focusedDocumentsEmpty:
      "Nenhum documento pronto para consulta focada foi encontrado.",
    technicalWithStatus: (httpStatus) =>
      `Erro técnico ao consultar a base.${formatHttpTail(httpStatus)} Tente novamente em instantes.`,
  },
};

const EN: QueryMessages = {
  header: {
    titleLead: "Search the",
    titleAccent: "article base",
    lede: "Ask a question about the entire base or narrow the query to a specific document. Every answer keeps inline citations, numbered sources, and an audit trail. Only users with the secret can query or read the persisted history.",
  },
  toolbar: {
    ariaLabel: "Query controls",
    secretLabel: "Query secret",
    modeLegend: "Query mode",
    modeGlobal: "Entire base",
    modeFocused: "Specific document",
    focusedDocumentLabel: "Target document",
    focusedSecretRequired: "Enter the secret to list available documents.",
    focusedDocumentsLoading: "Loading available documents...",
    retry: "Try again",
    selectDocumentPlaceholder: "Select a focusable document",
    documentAuthors: "authors",
    documentYear: "year",
    documentDoi: "doi",
    documentChunks: "indexed chunks",
    documentUpdated: "updated",
    chooseDocumentHint: "Choose a document to enable the focused query.",
    clearSecret: "Clear secret",
    newConversation: "New conversation",
    loading: "Loading...",
  },
  strategies: {
    selectLabel: "Strategy",
    guideAriaLabel: "Strategy guide",
    guideTitle: "Search strategies",
    guideCopy:
      "Pick the mode in the selector below. Focused queries apply the standard strategy automatically.",
    focusedNote: "Only the standard strategy is available in focused mode.",
    standard: {
      label: "Standard",
      tooltip:
        "Retrieves the most relevant sources through hybrid search and answers directly. Best for objective questions.",
    },
    explore: {
      label: "Explore",
      tooltip:
        "Broadens the search to surface related approaches and terms. Useful while the question is still open-ended.",
    },
    rerank: {
      label: "Rerank",
      tooltip:
        "Retrieves more candidates and reorders them with a dedicated model before answering. Slower, but with better-prioritized sources.",
    },
  },
  conversation: {
    title: "Conversation",
    notFound: "Conversation not found or unavailable to reload.",
    loading: "Loading conversation...",
    assistant: "Assistant",
    operator: "Operator",
    live: "Live",
    viewAudit: "View audit",
    questionLabel: "Question",
    questionPlaceholder:
      "E.g.: Which techniques appear most often in the studies or in this document?",
    advanced: "Advanced",
    topKLabel: "Retrieved sources",
    candidateTopKLabel: "Rerank candidates",
    submit: "Search base",
    submitting: "Searching...",
    phaseRetrieving: "Retrieving candidates…",
    phaseReranking: "Reranking candidates…",
    phaseGenerating: "Generating answer…",
    hintRetrieving: "Selecting the final excerpts to answer.",
    hintGenerating: "The answer appears below as tokens arrive.",
    relatedTermsTitle: "Related terms",
  },
  audit: {
    drawerTitle: "Message audit",
    drawerClose: "Close audit",
    summaryTitle: "Query parameters",
    relatedTermsTitle: "Related terms",
    sourcesTitle: "Sources consulted",
    notApplied: "not applied",
    noGeneration: "This run did not use answer generation.",
    relatedTermsEmpty: "No auditable related terms were found.",
    emptySources: "No sources were retrieved for this question.",
    cited: "cited",
    yes: "yes",
    no: "no",
    focusAction: "Chat only about this article",
    focusStarting: "Preparing focus...",
    runStatus: {
      answered: "answered",
      answered_no_evidence: "answered without evidence",
      generation_failed: "safe failure",
      generation_unavailable: "generation unavailable",
      reranking_failed: "reranking safe failure",
      reranking_unavailable: "reranking unavailable",
    },
  },
  errors: {
    invalidRequest: "Enter a valid question to search.",
    unauthorized: "The query secret was rejected. Enter it again to continue.",
    technical: "Could not search the base right now. Try again shortly.",
    generationFailed:
      "Answer generation failed. Try rephrasing the question or trying again.",
    generationUnavailable:
      "The generation service is unavailable right now. Wait a moment and try again.",
    network:
      "Network error while reaching the server. Check your connection and try again.",
    focusedDocumentNotFound: "Document not found or unavailable for focus.",
    focusedDocumentNotFocusable: "Document is not ready for focused queries yet.",
    focusedDocumentsError:
      "Could not load the focusable documents right now. Try again shortly.",
    focusedDocumentsEmpty: "No document ready for focused queries was found.",
    technicalWithStatus: (httpStatus) =>
      `Technical error while searching the base.${formatHttpTail(httpStatus)} Try again shortly.`,
  },
};

export const QUERY_MESSAGES: Readonly<Record<Locale, QueryMessages>> = {
  "pt-BR": PT_BR,
  en: EN,
};

export function useQueryMessages(): QueryMessages {
  return QUERY_MESSAGES[useLocale().locale];
}

// Errors are stored as codes, not text, so an alert already on screen is
// re-rendered in the new language when the locale changes.
export type QueryTechnicalError =
  | {
      code:
        | "technical"
        | "network"
        | "generation_failed"
        | "generation_unavailable"
        | "document_not_found"
        | "document_not_focusable";
    }
  | { code: "http"; httpStatus: number | null };

export function describeTechnicalError(
  messages: QueryMessages,
  error: QueryTechnicalError,
): string {
  switch (error.code) {
    case "technical":
      return messages.errors.technical;
    case "network":
      return messages.errors.network;
    case "generation_failed":
      return messages.errors.generationFailed;
    case "generation_unavailable":
      return messages.errors.generationUnavailable;
    case "document_not_found":
      return messages.errors.focusedDocumentNotFound;
    case "document_not_focusable":
      return messages.errors.focusedDocumentNotFocusable;
    case "http":
      return messages.errors.technicalWithStatus(error.httpStatus);
  }
}

function formatHttpTail(httpStatus: number | null): string {
  return httpStatus === null ? "" : ` [HTTP ${httpStatus}]`;
}
