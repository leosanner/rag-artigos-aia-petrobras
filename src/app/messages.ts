import { useLocale } from "@/i18n/LocaleProvider";
import type { Locale } from "@/i18n/locales";

type Step = { title: string; body: string };

export type HomeMessages = {
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  lede: string;
  entry: {
    index: string;
    title: string;
    copy: string;
    cta: string;
  };
  flow: {
    index: string;
    title: string;
    copy: string;
    openIngestion: string;
    openIndexing: string;
    upload: Step;
    ingest: { title: string; bodyLead: string; bodyTail: string };
    confirm: Step;
    indexStep: {
      title: string;
      bodyLead: string;
      bodyMiddle: string;
      bodyOr: string;
      bodyTail: string;
    };
  };
  capabilitiesLabel: string;
  governance: Step;
  traceability: Step;
  audit: Step;
};

const PT_BR: HomeMessages = {
  eyebrow: "Sistema :: Estudo de caso: RAG / DEMO",
  titleLead: "Plataforma RAG",
  titleAccent: "rastreável",
  lede: "Explore a base documental governada com respostas auditáveis, citações inline e fontes numeradas para apoiar análises de EIA.",
  entry: {
    index: "[ 01 ] Entrada operacional",
    title: "Consulte a base com trilha de auditoria.",
    copy: "A página de consulta concentra conversa, controles de recuperação e histórico persistido em uma única superfície para operadores.",
    cta: "Acessar consulta RAG",
  },
  flow: {
    index: "[ 02 ] Adição de documentos",
    title: "Como colocar novos PDFs na base",
    copy: "A adição de documentos acontece em duas etapas manuais separadas. Primeiro a plataforma busca e processa os PDFs no Drive. Depois ela gera chunks e vetores para liberar esse conteúdo nas consultas RAG.",
    openIngestion: "Abrir ingestão",
    openIndexing: "Abrir indexação",
    upload: {
      title: "Enviar os arquivos para o Drive",
      body: "Coloque os PDFs na pasta configurada do Google Drive. Essa pasta é a origem oficial dos novos documentos da base.",
    },
    ingest: {
      title: "Executar a ingestão",
      bodyLead: "Acesse",
      bodyTail:
        ", informe o segredo do operador e inicie a execução para importar, extrair e refinar os textos.",
    },
    confirm: {
      title: "Confirmar documentos processados",
      body: "Espere a execução terminar e verifique se os arquivos ficaram prontos para indexação. Somente documentos processados seguem para a etapa de vetores.",
    },
    indexStep: {
      title: "Gerar chunks e vetores",
      bodyLead: "Acesse",
      bodyMiddle:
        "para criar embeddings dos documentos processados. Use",
      bodyOr: "ou",
      bodyTail: "quando precisar reindexar um item específico.",
    },
  },
  capabilitiesLabel: "Capacidades principais",
  governance: {
    title: "Governança",
    body: "Status, versão de pipeline e origem documentada em cada registro.",
  },
  traceability: {
    title: "Rastreabilidade",
    body: "Respostas ligadas a fontes numeradas, trechos e metadados.",
  },
  audit: {
    title: "Auditoria",
    body: "Histórico persistido com custo, latência, modelos e termos.",
  },
};

const EN: HomeMessages = {
  eyebrow: "System :: Case study: RAG / DEMO",
  titleLead: "Traceable",
  titleAccent: "RAG platform",
  lede: "Explore the governed document base with auditable answers, inline citations, and numbered sources to support EIA analyses.",
  entry: {
    index: "[ 01 ] Operational entry",
    title: "Query the base with an audit trail.",
    copy: "The query page brings conversation, retrieval controls, and persisted history together in a single surface for operators.",
    cta: "Open RAG query",
  },
  flow: {
    index: "[ 02 ] Adding documents",
    title: "How to add new PDFs to the base",
    copy: "Adding documents happens in two separate manual steps. First the platform fetches and processes the PDFs from Drive. Then it generates chunks and vectors to make that content available to RAG queries.",
    openIngestion: "Open ingestion",
    openIndexing: "Open indexing",
    upload: {
      title: "Upload the files to Drive",
      body: "Put the PDFs in the configured Google Drive folder. That folder is the official source of new documents for the base.",
    },
    ingest: {
      title: "Run ingestion",
      bodyLead: "Go to",
      bodyTail:
        ", enter the operator secret, and start the run to import, extract, and refine the texts.",
    },
    confirm: {
      title: "Confirm processed documents",
      body: "Wait for the run to finish and check that the files are ready for indexing. Only processed documents move on to the vector step.",
    },
    indexStep: {
      title: "Generate chunks and vectors",
      bodyLead: "Go to",
      bodyMiddle: "to create embeddings for processed documents. Use",
      bodyOr: "or",
      bodyTail: "when you need to reindex a specific item.",
    },
  },
  capabilitiesLabel: "Core capabilities",
  governance: {
    title: "Governance",
    body: "Status, pipeline version, and documented origin on every record.",
  },
  traceability: {
    title: "Traceability",
    body: "Answers linked to numbered sources, excerpts, and metadata.",
  },
  audit: {
    title: "Audit",
    body: "Persisted history with cost, latency, models, and terms.",
  },
};

export const HOME_MESSAGES: Readonly<Record<Locale, HomeMessages>> = {
  "pt-BR": PT_BR,
  en: EN,
};

export function useHomeMessages(): HomeMessages {
  return HOME_MESSAGES[useLocale().locale];
}
