import { describe, expect, it, vi } from "vitest";

import {
  buildNoEvidenceAnswer,
  extractRelatedTerms,
  type RagRerankingAudit,
  type RagRerankingMetadata,
  type RerankedChunkMatch,
} from "@/domain/rag";
import type { FocusedDocumentClassification } from "@/repositories/documents-repository";

import type { EmbeddingUsage, GenerationUsage } from "./ports";
import { AnswerQuestion } from "./answer-question";
import { RetrieveChunksFailure, RerankingFailure } from "./retrieve-chunks";

const GENERATION_MODEL = "gpt-4.1-mini";
const EMBEDDING_MODEL = "text-embedding-3-large";
const PROMPT_VERSION = "f04-global-rag-v1";
const CREATED_RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FOCUSED_DOCUMENT_ID = "44444444-4444-4444-8444-444444444444";
const NULL_RERANK_PERSISTENCE = {
  rerankerProvider: null,
  rerankerModel: null,
  rerankingLatencyMs: null,
  rerankingCandidatesEvaluated: null,
  rerankingInputTokens: null,
  rerankingCostUsd: null,
} as const;

function buildMatch(
  overrides: Partial<RerankedChunkMatch> = {},
): RerankedChunkMatch {
  return {
    chunkId: "11111111-1111-4111-8111-111111111111",
    documentId: "22222222-2222-4222-8222-222222222222",
    documentTitle: "article.pdf",
    chunkIndex: 0,
    excerpt: "Chunk excerpt",
    retrievalScore: 0.91,
    rerankScore: null,
    documentPipelineVersion: "documents-v1",
    chunkingVersion: "hybrid-v1-900-150",
    embeddingModel: EMBEDDING_MODEL,
    ...overrides,
  };
}

function buildEmbeddingUsage(
  overrides: Partial<EmbeddingUsage> = {},
): EmbeddingUsage {
  return {
    inputTokens: 17,
    estimatedCostUsd: 0.00000221,
    ...overrides,
  };
}

function buildGenerationUsage(
  overrides: Partial<GenerationUsage> = {},
): GenerationUsage {
  return {
    inputTokens: 120,
    outputTokens: 42,
    totalTokens: 162,
    estimatedCostUsd: 0.000048,
    ...overrides,
  };
}

function toPersistedSource(input: {
  match: RerankedChunkMatch;
  sourceNumber: number;
  citedInAnswer: boolean;
}) {
  return {
    sourceNumber: input.sourceNumber,
    chunkId: input.match.chunkId,
    documentId: input.match.documentId,
    documentTitle: input.match.documentTitle,
    chunkIndex: input.match.chunkIndex,
    excerpt: input.match.excerpt,
    retrievalScore: input.match.retrievalScore,
    rerankScore: input.match.rerankScore,
    documentPipelineVersion: input.match.documentPipelineVersion,
    chunkingVersion: input.match.chunkingVersion,
    embeddingModel: input.match.embeddingModel,
    citedInAnswer: input.citedInAnswer,
  };
}

function toPublicSource(input: {
  match: RerankedChunkMatch;
  sourceNumber: number;
}) {
  return {
    sourceNumber: input.sourceNumber,
    chunkId: input.match.chunkId,
    documentId: input.match.documentId,
    documentTitle: input.match.documentTitle,
    chunkIndex: input.match.chunkIndex,
    excerpt: input.match.excerpt,
    score: input.match.retrievalScore,
    documentPipelineVersion: input.match.documentPipelineVersion,
    chunkingVersion: input.match.chunkingVersion,
    embeddingModel: input.match.embeddingModel,
  };
}

function buildRerankingMetadata(
  overrides: Partial<RagRerankingMetadata> = {},
): RagRerankingMetadata {
  return {
    rerankerProvider: "test-reranker",
    rerankerModel: "rerank-v1",
    ...overrides,
  };
}

function buildRerankingAudit(
  overrides: Partial<RagRerankingAudit> = {},
): RagRerankingAudit {
  return {
    latencyMs: 41,
    candidatesEvaluated: 6,
    inputTokens: 22,
    estimatedCostUsd: 0.000031,
    ...overrides,
  };
}

function createNowMs(latencyMs: number) {
  return vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_000 + latencyMs);
}

function createService(
  overrides: {
    matches?: RerankedChunkMatch[];
    reranking?: {
      metadata: RagRerankingMetadata;
      audit: RagRerankingAudit;
    } | null;
    embeddingUsage?: EmbeddingUsage;
    answer?: string;
    generationUsage?: GenerationUsage;
    generationError?: unknown;
    streamedAnswerChunks?: string[];
    retrievalError?: unknown;
    createError?: unknown;
    nowMs?: () => number;
    createdRunId?: string;
    classification?: FocusedDocumentClassification;
  } = {},
) {
  const matches =
    overrides.matches ??
    [
      buildMatch(),
      buildMatch({
        chunkId: "33333333-3333-4333-8333-333333333333",
        chunkIndex: 1,
        excerpt: "Second chunk excerpt",
        retrievalScore: 0.82,
      }),
    ];
  const embeddingUsage = overrides.embeddingUsage ?? buildEmbeddingUsage();
  const generationUsage = overrides.generationUsage ?? buildGenerationUsage();

  const retrieveChunks = {
    embeddingModel: EMBEDDING_MODEL,
    search:
      overrides.retrievalError === undefined
        ? vi.fn().mockResolvedValue({
            matches,
            embedding: embeddingUsage,
            reranking: overrides.reranking ?? null,
          })
        : vi.fn().mockRejectedValue(overrides.retrievalError),
  };
  const generationProvider = {
    generateAnswer:
      overrides.generationError === undefined
        ? vi.fn().mockResolvedValue({
            answer: overrides.answer ?? "Resposta [2].",
            usage: generationUsage,
          })
        : vi.fn().mockRejectedValue(overrides.generationError),
    streamAnswer:
      overrides.generationError === undefined
        ? vi.fn().mockImplementation(async (input) => {
            const chunks =
              overrides.streamedAnswerChunks ??
              [overrides.answer ?? "Resposta [2]."];

            for (const chunk of chunks) {
              await input.onTextDelta?.(chunk);
            }

            return {
              answer: chunks.join(""),
              usage: generationUsage,
            };
          })
        : vi.fn().mockRejectedValue(overrides.generationError),
  };
  const runsRepository = {
    create:
      overrides.createError === undefined
        ? vi.fn().mockResolvedValue({
            id: overrides.createdRunId ?? CREATED_RUN_ID,
            createdAt: new Date("2026-04-23T00:00:00.000Z"),
          })
        : vi.fn().mockRejectedValue(overrides.createError),
  };
  const focusedDocumentClassifier = {
    classifyForFocusedRag: vi
      .fn()
      .mockResolvedValue(overrides.classification ?? "ok"),
  };

  const service = new AnswerQuestion({
    retrieveChunks,
    generationProvider,
    runsRepository,
    focusedDocumentClassifier,
    generationModel: GENERATION_MODEL,
    promptVersion: PROMPT_VERSION,
    nowMs: overrides.nowMs ?? createNowMs(432),
  });

  return {
    service,
    retrieveChunks,
    generationProvider,
    runsRepository,
    focusedDocumentClassifier,
    matches,
    embeddingUsage,
    generationUsage,
  };
}

describe("AnswerQuestion", () => {
  it("rejects a focused request when classification returns not_processed without calling embedding, generation, or persisting a run", async () => {
    const {
      service,
      retrieveChunks,
      generationProvider,
      runsRepository,
      focusedDocumentClassifier,
    } = createService({ classification: "not_processed" });

    await expect(
      service.execute({
        question: "Quais técnicas o documento descreve?",
        mode: "focused",
        documentId: FOCUSED_DOCUMENT_ID,
      }),
    ).resolves.toEqual({
      kind: "focused_document_rejected",
      reason: "not_processed",
    });

    expect(focusedDocumentClassifier.classifyForFocusedRag).toHaveBeenCalledWith(
      FOCUSED_DOCUMENT_ID,
    );
    expect(retrieveChunks.search).not.toHaveBeenCalled();
    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(runsRepository.create).not.toHaveBeenCalled();
  });

  it("rejects a focused request for an unknown document with the not_found reason", async () => {
    const { service, runsRepository } = createService({
      classification: "not_found",
    });

    await expect(
      service.execute({
        question: "Pergunta",
        mode: "focused",
        documentId: FOCUSED_DOCUMENT_ID,
      }),
    ).resolves.toEqual({
      kind: "focused_document_rejected",
      reason: "not_found",
    });
    expect(runsRepository.create).not.toHaveBeenCalled();
  });

  it("forwards documentId to retrieval and persists a focused trace with mode=focused and the documentId", async () => {
    const {
      service,
      retrieveChunks,
      runsRepository,
      focusedDocumentClassifier,
    } = createService({
      answer: "Resposta focada [2].",
    });
    const question = "Pergunta focada?";

    const result = await service.execute({
      question,
      mode: "focused",
      documentId: FOCUSED_DOCUMENT_ID,
    });

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered",
      mode: "focused",
      metadata: expect.objectContaining({
        mode: "focused",
        documentId: FOCUSED_DOCUMENT_ID,
      }),
    });
    expect(focusedDocumentClassifier.classifyForFocusedRag).toHaveBeenCalledWith(
      FOCUSED_DOCUMENT_ID,
    );
    expect(retrieveChunks.search).toHaveBeenCalledWith({
      question,
      retrieval: {
        topK: 6,
        strategy: "standard",
      },
      documentId: FOCUSED_DOCUMENT_ID,
    });
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "focused",
        documentId: FOCUSED_DOCUMENT_ID,
        status: "answered",
      }),
    );
  });

  it("returns answered_no_evidence on a focused request when retrieval finds no chunks and persists mode=focused with documentId", async () => {
    const { service, generationProvider, runsRepository } = createService({
      matches: [],
    });

    const result = await service.execute({
      question: "Pergunta focada sem evidência?",
      mode: "focused",
      documentId: FOCUSED_DOCUMENT_ID,
    });

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered_no_evidence",
      mode: "focused",
      sources: [],
    });
    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "focused",
        documentId: FOCUSED_DOCUMENT_ID,
        status: "answered_no_evidence",
      }),
    );
  });

  it("persists a focused generation_failed run with mode=focused and the documentId", async () => {
    const { service, runsRepository } = createService({
      generationError: new Error("boom"),
    });

    await expect(
      service.execute({
        question: "Pergunta focada?",
        mode: "focused",
        documentId: FOCUSED_DOCUMENT_ID,
      }),
    ).resolves.toEqual({
      kind: "error",
      error: "generation_failed",
    });
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "focused",
        documentId: FOCUSED_DOCUMENT_ID,
        status: "generation_failed",
        errorCode: "generation_failed",
      }),
    );
  });

  it("persists answered_no_evidence when no chunks are retrieved and derives related terms from the question only", async () => {
    const nowMs = createNowMs(245);
    const embeddingUsage = buildEmbeddingUsage({
      inputTokens: 23,
      estimatedCostUsd: 0.00000299,
    });
    const { service, retrieveChunks, generationProvider, runsRepository } =
      createService({
        matches: [],
        embeddingUsage,
        nowMs,
      });

    const question = "O que os artigos dizem sobre avaliação ambiental com GIS?";

    await expect(
      service.execute({
        question,
        mode: "global",
      }),
    ).resolves.toEqual({
      kind: "answered",
      status: "answered_no_evidence",
      traceId: CREATED_RUN_ID,
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      sources: [],
      relatedTerms: extractRelatedTerms({
        question,
        sourceExcerpts: [],
      }),
      metadata: {
        mode: "global",
        documentId: null,
        topK: 6,
        retrievalStrategy: "standard",
        candidateTopK: 6,
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
        rerankerProvider: null,
        rerankerModel: null,
      },
      audit: {
        latencyMs: 245,
        embedding: embeddingUsage,
        reranking: null,
        generation: null,
        totalCostUsd: embeddingUsage.estimatedCostUsd,
      },
    });

    expect(retrieveChunks.search).toHaveBeenCalledWith({
      question,
      retrieval: {
        topK: 6,
        strategy: "standard",
      },
    });
    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(runsRepository.create).toHaveBeenCalledTimes(1);
    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      documentId: null,
      status: "answered_no_evidence",
      errorCode: null,
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      ...NULL_RERANK_PERSISTENCE,
      latencyMs: 245,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: embeddingUsage.estimatedCostUsd,
      sources: [],
      relatedTerms: extractRelatedTerms({
        question,
        sourceExcerpts: [],
      }),
    });
    expect(nowMs).toHaveBeenCalledTimes(2);
  });

  it("persists a successful answered run with traceId, related terms, audit metrics, and cited source flags", async () => {
    const nowMs = createNowMs(432);
    const embeddingUsage = buildEmbeddingUsage({
      inputTokens: 19,
      estimatedCostUsd: 0.00000247,
    });
    const generationUsage = buildGenerationUsage({
      inputTokens: 140,
      outputTokens: 35,
      totalTokens: 175,
      estimatedCostUsd: 0.000061,
    });
    const { service, retrieveChunks, generationProvider, runsRepository, matches } =
      createService({
        embeddingUsage,
        generationUsage,
        nowMs,
        answer: "A síntese prioriza a segunda fonte [2].",
      });
    const question = "Quais abordagens aparecem com mais frequência?";
    const expectedRelatedTerms = extractRelatedTerms({
      question,
      sourceExcerpts: matches.map((match) => match.excerpt),
    });

    const result = await service.execute({
      question,
      mode: "global",
      retrieval: {
        topK: 9,
        strategy: "standard",
      },
    });

    expect(result).toEqual({
      kind: "answered",
      status: "answered",
      traceId: CREATED_RUN_ID,
      answer: "A síntese prioriza a segunda fonte [2].",
      mode: "global",
      sources: [
        toPublicSource({
          match: matches[0]!,
          sourceNumber: 1,
        }),
        toPublicSource({
          match: matches[1]!,
          sourceNumber: 2,
        }),
      ],
      relatedTerms: expectedRelatedTerms,
      metadata: {
        mode: "global",
        documentId: null,
        topK: 9,
        retrievalStrategy: "standard",
        candidateTopK: 9,
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
        rerankerProvider: null,
        rerankerModel: null,
      },
      audit: {
        latencyMs: 432,
        embedding: embeddingUsage,
        reranking: null,
        generation: generationUsage,
        totalCostUsd:
          embeddingUsage.estimatedCostUsd + generationUsage.estimatedCostUsd,
      },
    });

    expect(retrieveChunks.search).toHaveBeenCalledWith({
      question,
      retrieval: {
        topK: 9,
        strategy: "standard",
      },
    });
    expect(generationProvider.generateAnswer).toHaveBeenCalledWith({
      question,
      promptContext: expect.stringContaining("[1] Título: article.pdf"),
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      retrievalStrategy: "standard",
    });
    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: "A síntese prioriza a segunda fonte [2].",
      mode: "global",
      documentId: null,
      status: "answered",
      errorCode: null,
      topK: 9,
      retrievalStrategy: "standard",
      candidateTopK: 9,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      ...NULL_RERANK_PERSISTENCE,
      latencyMs: 432,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: generationUsage.inputTokens,
      generationOutputTokens: generationUsage.outputTokens,
      generationTotalTokens: generationUsage.totalTokens,
      generationCostUsd: generationUsage.estimatedCostUsd,
      totalCostUsd:
        embeddingUsage.estimatedCostUsd + generationUsage.estimatedCostUsd,
      sources: [
        toPersistedSource({
          match: matches[0]!,
          sourceNumber: 1,
          citedInAnswer: false,
        }),
        toPersistedSource({
          match: matches[1]!,
          sourceNumber: 2,
          citedInAnswer: true,
        }),
      ],
      relatedTerms: expectedRelatedTerms,
    });
    expect(nowMs).toHaveBeenCalledTimes(2);
  });

  it("normalizes explore retrieval defaults, forwards explore prompting, and persists the applied strategy metadata", async () => {
    const { service, retrieveChunks, generationProvider, runsRepository } =
      createService({
        answer: "Perspectiva A [1]. Perspectiva B [2].",
      });

    const result = await service.execute({
      question: "Quais perspectivas diferentes aparecem?",
      mode: "global",
      retrieval: {
        strategy: "explore",
      },
    });

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered",
      metadata: {
        mode: "global",
        documentId: null,
        topK: 6,
        retrievalStrategy: "explore",
        candidateTopK: 18,
      },
    });
    expect(retrieveChunks.search).toHaveBeenCalledWith({
      question: "Quais perspectivas diferentes aparecem?",
      retrieval: {
        topK: 6,
        strategy: "explore",
      },
    });
    expect(generationProvider.generateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalStrategy: "explore",
      }),
    );
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalStrategy: "explore",
        candidateTopK: 18,
      }),
    );
  });

  it("persists rerank metadata, reranking audit, and split source scores when reranking succeeds", async () => {
    const nowMs = createNowMs(387);
    const embeddingUsage = buildEmbeddingUsage({
      inputTokens: 21,
      estimatedCostUsd: 0.00000273,
    });
    const generationUsage = buildGenerationUsage({
      inputTokens: 136,
      outputTokens: 31,
      totalTokens: 167,
      estimatedCostUsd: 0.000059,
    });
    const reranking = {
      metadata: buildRerankingMetadata(),
      audit: buildRerankingAudit(),
    };
    const matches = [
      buildMatch({
        chunkId: "33333333-3333-4333-8333-333333333333",
        chunkIndex: 1,
        excerpt: "Second chunk excerpt",
        retrievalScore: 0.82,
        rerankScore: 0.97,
      }),
      buildMatch({
        retrievalScore: 0.91,
        rerankScore: 0.94,
      }),
    ];
    const { service, generationProvider, runsRepository, retrieveChunks } =
      createService({
        matches,
        reranking,
        embeddingUsage,
        generationUsage,
        nowMs,
        answer: "A fonte reranqueada mais forte é a primeira [1].",
      });
    const question = "Quais evidências ficaram mais relevantes após reranqueamento?";
    const expectedRelatedTerms = extractRelatedTerms({
      question,
      sourceExcerpts: matches.map((match) => match.excerpt),
    });

    const result = await service.execute({
      question,
      mode: "global",
      retrieval: {
        topK: 6,
        strategy: "rerank",
      },
    });

    expect(result).toEqual({
      kind: "answered",
      status: "answered",
      traceId: CREATED_RUN_ID,
      answer: "A fonte reranqueada mais forte é a primeira [1].",
      mode: "global",
      sources: [
        toPublicSource({
          match: matches[0]!,
          sourceNumber: 1,
        }),
        toPublicSource({
          match: matches[1]!,
          sourceNumber: 2,
        }),
      ],
      relatedTerms: expectedRelatedTerms,
      metadata: {
        mode: "global",
        documentId: null,
        topK: 6,
        retrievalStrategy: "rerank",
        candidateTopK: 18,
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
        rerankerProvider: reranking.metadata.rerankerProvider,
        rerankerModel: reranking.metadata.rerankerModel,
      },
      audit: {
        latencyMs: 387,
        embedding: embeddingUsage,
        reranking: reranking.audit,
        generation: generationUsage,
        totalCostUsd:
          embeddingUsage.estimatedCostUsd +
          reranking.audit.estimatedCostUsd +
          generationUsage.estimatedCostUsd,
      },
    });

    expect(retrieveChunks.search).toHaveBeenCalledWith({
      question,
      retrieval: {
        topK: 6,
        strategy: "rerank",
      },
    });
    expect(generationProvider.generateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievalStrategy: "rerank",
      }),
    );
    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: "A fonte reranqueada mais forte é a primeira [1].",
      mode: "global",
      documentId: null,
      status: "answered",
      errorCode: null,
      topK: 6,
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      rerankerProvider: reranking.metadata.rerankerProvider,
      rerankerModel: reranking.metadata.rerankerModel,
      rerankingLatencyMs: reranking.audit.latencyMs,
      rerankingCandidatesEvaluated: reranking.audit.candidatesEvaluated,
      rerankingInputTokens: reranking.audit.inputTokens,
      rerankingCostUsd: reranking.audit.estimatedCostUsd,
      latencyMs: 387,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: generationUsage.inputTokens,
      generationOutputTokens: generationUsage.outputTokens,
      generationTotalTokens: generationUsage.totalTokens,
      generationCostUsd: generationUsage.estimatedCostUsd,
      totalCostUsd:
        embeddingUsage.estimatedCostUsd +
        reranking.audit.estimatedCostUsd +
        generationUsage.estimatedCostUsd,
      sources: [
        toPersistedSource({
          match: matches[0]!,
          sourceNumber: 1,
          citedInAnswer: true,
        }),
        toPersistedSource({
          match: matches[1]!,
          sourceNumber: 2,
          citedInAnswer: false,
        }),
      ],
      relatedTerms: expectedRelatedTerms,
    });
  });

  it("returns answered_no_evidence for rerank when retrieval finds no candidates, without calling generation or persisting rerank metadata", async () => {
    const nowMs = createNowMs(245);
    const embeddingUsage = buildEmbeddingUsage({
      inputTokens: 23,
      estimatedCostUsd: 0.00000299,
    });
    const { service, generationProvider, runsRepository } = createService({
      matches: [],
      embeddingUsage,
      nowMs,
    });
    const question = "O que resta relevante quando tentamos reranquear?";

    await expect(
      service.execute({
        question,
        mode: "global",
        retrieval: {
          topK: 6,
          strategy: "rerank",
        },
      }),
    ).resolves.toEqual({
      kind: "answered",
      status: "answered_no_evidence",
      traceId: CREATED_RUN_ID,
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      sources: [],
      relatedTerms: extractRelatedTerms({
        question,
        sourceExcerpts: [],
      }),
      metadata: {
        mode: "global",
        documentId: null,
        topK: 6,
        retrievalStrategy: "rerank",
        candidateTopK: 18,
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
        rerankerProvider: null,
        rerankerModel: null,
      },
      audit: {
        latencyMs: 245,
        embedding: embeddingUsage,
        reranking: null,
        generation: null,
        totalCostUsd: embeddingUsage.estimatedCostUsd,
      },
    });

    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      documentId: null,
      status: "answered_no_evidence",
      errorCode: null,
      topK: 6,
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      ...NULL_RERANK_PERSISTENCE,
      latencyMs: 245,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: embeddingUsage.estimatedCostUsd,
      sources: [],
      relatedTerms: extractRelatedTerms({
        question,
        sourceExcerpts: [],
      }),
    });
  });

  it("preserves rerank metadata and audit when generation still resolves to no evidence", async () => {
    const embeddingUsage = buildEmbeddingUsage({
      inputTokens: 20,
      estimatedCostUsd: 0.0000026,
    });
    const generationUsage = buildGenerationUsage({
      inputTokens: 132,
      outputTokens: 18,
      totalTokens: 150,
      estimatedCostUsd: 0.000052,
    });
    const reranking = {
      metadata: buildRerankingMetadata(),
      audit: buildRerankingAudit({
        latencyMs: 35,
        candidatesEvaluated: 4,
        inputTokens: 18,
        estimatedCostUsd: 0.000024,
      }),
    };
    const { service, runsRepository } = createService({
      matches: [
        buildMatch({
          rerankScore: 0.93,
        }),
      ],
      reranking,
      embeddingUsage,
      generationUsage,
      answer: buildNoEvidenceAnswer(),
    });
    const question = "Existe evidência suficiente mesmo após reranquear?";
    const expectedRelatedTerms = extractRelatedTerms({
      question,
      sourceExcerpts: [],
    });

    const result = await service.execute({
      question,
      mode: "global",
      retrieval: {
        topK: 6,
        strategy: "rerank",
      },
    });

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered_no_evidence",
      traceId: CREATED_RUN_ID,
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      sources: [],
      relatedTerms: expectedRelatedTerms,
      metadata: {
        retrievalStrategy: "rerank",
        candidateTopK: 18,
        rerankerProvider: reranking.metadata.rerankerProvider,
        rerankerModel: reranking.metadata.rerankerModel,
      },
      audit: {
        embedding: embeddingUsage,
        reranking: reranking.audit,
        generation: generationUsage,
        totalCostUsd:
          embeddingUsage.estimatedCostUsd +
          reranking.audit.estimatedCostUsd +
          generationUsage.estimatedCostUsd,
      },
    });
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "answered_no_evidence",
        errorCode: null,
        retrievalStrategy: "rerank",
        rerankerProvider: reranking.metadata.rerankerProvider,
        rerankerModel: reranking.metadata.rerankerModel,
        rerankingLatencyMs: reranking.audit.latencyMs,
        rerankingCandidatesEvaluated: reranking.audit.candidatesEvaluated,
        rerankingInputTokens: reranking.audit.inputTokens,
        rerankingCostUsd: reranking.audit.estimatedCostUsd,
        generationInputTokens: generationUsage.inputTokens,
        generationOutputTokens: generationUsage.outputTokens,
        generationTotalTokens: generationUsage.totalTokens,
        generationCostUsd: generationUsage.estimatedCostUsd,
        sources: [],
        relatedTerms: expectedRelatedTerms,
      }),
    );
  });

  it("persists a reranking_failed run and does not call generation", async () => {
    const nowMs = createNowMs(187);
    const embeddingUsage = buildEmbeddingUsage({
      inputTokens: 12,
      estimatedCostUsd: 0.00000156,
    });
    const retrievalError = new RerankingFailure(
      "reranking_failed",
      new Error("invalid rerank payload"),
      embeddingUsage,
    );
    const { service, generationProvider, runsRepository } = createService({
      retrievalError,
      nowMs,
    });
    const question = "Quais abordagens falham no reranqueamento?";

    await expect(
      service.execute({
        question,
        mode: "global",
        retrieval: {
          topK: 6,
          strategy: "rerank",
        },
      }),
    ).resolves.toEqual({
      kind: "error",
      error: "reranking_failed",
    });

    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: null,
      mode: "global",
      documentId: null,
      status: "reranking_failed",
      errorCode: "reranking_failed",
      topK: 6,
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      ...NULL_RERANK_PERSISTENCE,
      latencyMs: 187,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: embeddingUsage.estimatedCostUsd,
      sources: [],
      relatedTerms: extractRelatedTerms({
        question,
        sourceExcerpts: [],
      }),
    });
  });

  it("persists a reranking_unavailable run and does not call generation", async () => {
    const nowMs = createNowMs(187);
    const embeddingUsage = buildEmbeddingUsage({
      inputTokens: 12,
      estimatedCostUsd: 0.00000156,
    });
    const retrievalError = new RerankingFailure(
      "reranking_unavailable",
      {
        statusCode: 503,
        message: "reranker unavailable",
      },
      embeddingUsage,
    );
    const { service, generationProvider, runsRepository } = createService({
      retrievalError,
      nowMs,
    });
    const question = "Quais abordagens ficam indisponíveis ao reranquear?";

    await expect(
      service.execute({
        question,
        mode: "global",
        retrieval: {
          topK: 6,
          strategy: "rerank",
        },
      }),
    ).resolves.toEqual({
      kind: "error",
      error: "reranking_unavailable",
    });

    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: null,
      mode: "global",
      documentId: null,
      status: "reranking_unavailable",
      errorCode: "reranking_unavailable",
      topK: 6,
      retrievalStrategy: "rerank",
      candidateTopK: 18,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      ...NULL_RERANK_PERSISTENCE,
      latencyMs: 187,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: embeddingUsage.estimatedCostUsd,
      sources: [],
      relatedTerms: extractRelatedTerms({
        question,
        sourceExcerpts: [],
      }),
    });
  });

  it("returns answered_no_evidence with empty sources when generation says nothing is related to the base", async () => {
    const { service, runsRepository, generationUsage } = createService({
      answer: buildNoEvidenceAnswer(),
    });
    const question = "Há evidências suficientes para concluir algo?";
    const expectedRelatedTerms = extractRelatedTerms({
      question,
      sourceExcerpts: [],
    });

    const result = await service.execute({
      question,
      mode: "global",
    });

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered_no_evidence",
      traceId: CREATED_RUN_ID,
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      sources: [],
      relatedTerms: expectedRelatedTerms,
    });
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "answered_no_evidence",
        errorCode: null,
        answer: buildNoEvidenceAnswer(),
        sources: [],
        relatedTerms: expectedRelatedTerms,
        generationInputTokens: generationUsage.inputTokens,
        generationOutputTokens: generationUsage.outputTokens,
        generationTotalTokens: generationUsage.totalTokens,
        generationCostUsd: generationUsage.estimatedCostUsd,
      }),
    );
  });

  it("canonicalizes legacy no-evidence wording from generation as answered_no_evidence instead of surfacing an error", async () => {
    const { service, runsRepository, generationUsage } = createService({
      answer:
        "  nao encontrei evidencias suficientes nos documentos recuperados para responder com seguranca! ",
    });
    const question = "Há evidências suficientes para concluir algo?";
    const expectedRelatedTerms = extractRelatedTerms({
      question,
      sourceExcerpts: [],
    });

    const result = await service.execute({
      question,
      mode: "global",
    });

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered_no_evidence",
      traceId: CREATED_RUN_ID,
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      sources: [],
      relatedTerms: expectedRelatedTerms,
    });
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "answered_no_evidence",
        errorCode: null,
        answer: buildNoEvidenceAnswer(),
        sources: [],
        relatedTerms: expectedRelatedTerms,
        generationInputTokens: generationUsage.inputTokens,
        generationOutputTokens: generationUsage.outputTokens,
        generationTotalTokens: generationUsage.totalTokens,
        generationCostUsd: generationUsage.estimatedCostUsd,
      }),
    );
  });

  it("persists a failed run with provider usage metrics when citation validation fails after generation", async () => {
    const generationUsage = buildGenerationUsage({
      inputTokens: 200,
      outputTokens: 20,
      totalTokens: 220,
      estimatedCostUsd: 0.000083,
    });
    const { service, runsRepository, matches, embeddingUsage } = createService({
      answer: "Resposta sem citação.",
      generationUsage,
    });
    const question = "Pergunta";
    const expectedRelatedTerms = extractRelatedTerms({
      question,
      sourceExcerpts: matches.map((match) => match.excerpt),
    });

    await expect(
      service.execute({
        question,
        mode: "global",
      }),
    ).resolves.toEqual({
      kind: "error",
      error: "generation_failed",
    });

    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: null,
      mode: "global",
      documentId: null,
      status: "generation_failed",
      errorCode: "generation_failed",
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      ...NULL_RERANK_PERSISTENCE,
      latencyMs: 432,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: generationUsage.inputTokens,
      generationOutputTokens: generationUsage.outputTokens,
      generationTotalTokens: generationUsage.totalTokens,
      generationCostUsd: generationUsage.estimatedCostUsd,
      totalCostUsd:
        embeddingUsage.estimatedCostUsd + generationUsage.estimatedCostUsd,
      sources: [
        toPersistedSource({
          match: matches[0]!,
          sourceNumber: 1,
          citedInAnswer: false,
        }),
        toPersistedSource({
          match: matches[1]!,
          sourceNumber: 2,
          citedInAnswer: false,
        }),
      ],
      relatedTerms: expectedRelatedTerms,
    });
  });

  it("persists a failed run without generation metrics when generation is unavailable", async () => {
    const { service, runsRepository, matches, embeddingUsage } = createService({
      generationError: {
        statusCode: 503,
        message: "provider unavailable",
      },
    });
    const question = "Pergunta";
    const expectedRelatedTerms = extractRelatedTerms({
      question,
      sourceExcerpts: matches.map((match) => match.excerpt),
    });

    await expect(
      service.execute({
        question,
        mode: "global",
      }),
    ).resolves.toEqual({
      kind: "error",
      error: "generation_unavailable",
    });

    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: null,
      mode: "global",
      documentId: null,
      status: "generation_unavailable",
      errorCode: "generation_unavailable",
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      ...NULL_RERANK_PERSISTENCE,
      latencyMs: 432,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: embeddingUsage.estimatedCostUsd,
      sources: [
        toPersistedSource({
          match: matches[0]!,
          sourceNumber: 1,
          citedInAnswer: false,
        }),
        toPersistedSource({
          match: matches[1]!,
          sourceNumber: 2,
          citedInAnswer: false,
        }),
      ],
      relatedTerms: expectedRelatedTerms,
    });
  });

  it("uses the conversation transcript for retrieval while keeping the latest user message as the persisted question", async () => {
    const { service, retrieveChunks, generationProvider, runsRepository } =
      createService({
        answer: "Resposta contextualizada [1].",
      });
    const question = "E no turno seguinte?";
    const transcript = [
      "User: Pergunta anterior",
      "Assistant: Resposta anterior [1].",
      `User: ${question}`,
    ].join("\n\n");

    const result = await service.execute({
      question,
      mode: "global",
      retrieval: {
        topK: 7,
        strategy: "standard",
      },
      conversationContext: {
        transcript,
      },
    });

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered",
      traceId: CREATED_RUN_ID,
      answer: "Resposta contextualizada [1].",
    });
    expect(retrieveChunks.search).toHaveBeenCalledWith({
      question: transcript,
      retrieval: {
        topK: 7,
        strategy: "standard",
      },
    });
    expect(generationProvider.generateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        question,
        conversationContext: {
          transcript,
        },
      }),
    );
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        question,
      }),
    );
  });

  it("persists a failed run when retrieval fails after validation and preserves known embedding audit data", async () => {
    const nowMs = createNowMs(187);
    const embeddingUsage = buildEmbeddingUsage({
      inputTokens: 12,
      estimatedCostUsd: 0.00000156,
    });
    const retrievalError = new RetrieveChunksFailure(
      {
        statusCode: 503,
        message: "vector search unavailable",
      },
      embeddingUsage,
    );
    const { service, generationProvider, runsRepository } = createService({
      retrievalError,
      nowMs,
    });
    const question = "Quais abordagens aparecem com maior frequência?";

    await expect(
      service.execute({
        question,
        mode: "global",
      }),
    ).resolves.toEqual({
      kind: "error",
      error: "generation_unavailable",
    });

    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(runsRepository.create).toHaveBeenCalledWith({
      question,
      answer: null,
      mode: "global",
      documentId: null,
      status: "generation_unavailable",
      errorCode: "generation_unavailable",
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      ...NULL_RERANK_PERSISTENCE,
      latencyMs: 187,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: embeddingUsage.estimatedCostUsd,
      sources: [],
      relatedTerms: extractRelatedTerms({
        question,
        sourceExcerpts: [],
      }),
    });
    expect(nowMs).toHaveBeenCalledTimes(2);
  });

  it("rejects when trace persistence fails after a successful answer and does not reclassify the run as a generation failure", async () => {
    const persistenceError = new Error("database unavailable");
    const { service, generationProvider, runsRepository } = createService({
      answer: "A síntese prioriza a segunda fonte [2].",
      createError: persistenceError,
    });

    await expect(
      service.execute({
        question: "Quais abordagens aparecem com mais frequência?",
        mode: "global",
      }),
    ).rejects.toThrow(/trace_persistence_failed/i);

    expect(generationProvider.generateAnswer).toHaveBeenCalledTimes(1);
    expect(runsRepository.create).toHaveBeenCalledTimes(1);
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "answered",
        errorCode: null,
        answer: "A síntese prioriza a segunda fonte [2].",
      }),
    );
  });

  it("streams sources first, then text deltas, and validates citations after the final accumulated answer", async () => {
    const eventLog: string[] = [];
    const { service, generationProvider, runsRepository } = createService({
      streamedAnswerChunks: ["Resposta", " stream", " [", "2]."],
    });

    const result = await service.executeStream(
      {
        question: "Quais abordagens aparecem com mais frequência?",
        mode: "global",
      },
      {
        onSources: (sources) => {
          eventLog.push(`sources:${sources.map((source) => source.sourceNumber).join(",")}`);
        },
        onGenerationStart: () => {
          eventLog.push("generation:start");
        },
        onAnswerDelta: (textDelta) => {
          eventLog.push(`delta:${textDelta}`);
        },
      },
    );

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered",
      answer: "Resposta stream [2].",
    });
    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(generationProvider.streamAnswer).toHaveBeenCalledTimes(1);
    expect(eventLog).toEqual([
      "sources:1,2",
      "generation:start",
      "delta:Resposta",
      "delta: stream",
      "delta: [",
      "delta:2].",
    ]);
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "answered",
        answer: "Resposta stream [2].",
        sources: expect.arrayContaining([
          expect.objectContaining({
            sourceNumber: 1,
            citedInAnswer: false,
          }),
          expect.objectContaining({
            sourceNumber: 2,
            citedInAnswer: true,
          }),
        ]),
      }),
    );
  });

  it("persists a failed run when streamed generation fails after sources were selected", async () => {
    const onSources = vi.fn();
    const onGenerationStart = vi.fn();
    const onAnswerDelta = vi.fn();
    const { service, runsRepository } = createService({
      generationError: new Error("provider stream failed"),
    });

    await expect(
      service.executeStream(
        {
          question: "Quais abordagens aparecem com mais frequência?",
          mode: "global",
        },
        {
          onSources,
          onGenerationStart,
          onAnswerDelta,
        },
      ),
    ).resolves.toEqual({
      kind: "error",
      error: "generation_failed",
    });

    expect(onSources).toHaveBeenCalledTimes(1);
    expect(onGenerationStart).toHaveBeenCalledTimes(1);
    expect(onAnswerDelta).not.toHaveBeenCalled();
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "generation_failed",
        errorCode: "generation_failed",
        answer: null,
        sources: expect.arrayContaining([
          expect.objectContaining({
            sourceNumber: 1,
          }),
        ]),
      }),
    );
  });
});
