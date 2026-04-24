import { describe, expect, it, vi } from "vitest";

import {
  buildNoEvidenceAnswer,
  extractRelatedTerms,
  type RetrievedChunkMatch,
} from "@/domain/rag";

import type { EmbeddingUsage, GenerationUsage } from "./ports";
import { AnswerQuestion } from "./answer-question";
import { RetrieveChunksFailure } from "./retrieve-chunks";

const GENERATION_MODEL = "gpt-4.1-mini";
const EMBEDDING_MODEL = "text-embedding-3-large";
const PROMPT_VERSION = "f04-global-rag-v1";
const CREATED_RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function buildMatch(
  overrides: Partial<RetrievedChunkMatch> = {},
): RetrievedChunkMatch {
  return {
    chunkId: "11111111-1111-4111-8111-111111111111",
    documentId: "22222222-2222-4222-8222-222222222222",
    documentTitle: "article.pdf",
    chunkIndex: 0,
    excerpt: "Chunk excerpt",
    score: 0.91,
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

function createNowMs(latencyMs: number) {
  return vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_000 + latencyMs);
}

function createService(
  overrides: {
    matches?: RetrievedChunkMatch[];
    embeddingUsage?: EmbeddingUsage;
    answer?: string;
    generationUsage?: GenerationUsage;
    generationError?: unknown;
    retrievalError?: unknown;
    createError?: unknown;
    nowMs?: () => number;
    createdRunId?: string;
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
        score: 0.82,
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

  const service = new AnswerQuestion({
    retrieveChunks,
    generationProvider,
    runsRepository,
    generationModel: GENERATION_MODEL,
    promptVersion: PROMPT_VERSION,
    nowMs: overrides.nowMs ?? createNowMs(432),
  });

  return {
    service,
    retrieveChunks,
    generationProvider,
    runsRepository,
    matches,
    embeddingUsage,
    generationUsage,
  };
}

describe("AnswerQuestion", () => {
  it("rejects unsupported modes before retrieval or persistence", async () => {
    const { service, retrieveChunks, generationProvider, runsRepository } =
      createService();

    await expect(
      service.execute({
        question: "Pergunta",
        mode: "focused" as never,
      }),
    ).rejects.toThrow(/unsupported/i);

    expect(retrieveChunks.search).not.toHaveBeenCalled();
    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
    expect(runsRepository.create).not.toHaveBeenCalled();
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
        topK: 6,
        retrievalStrategy: "standard",
        candidateTopK: 6,
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
      },
      audit: {
        latencyMs: 245,
        embedding: embeddingUsage,
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
      status: "answered_no_evidence",
      errorCode: null,
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
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
        {
          sourceNumber: 1,
          ...matches[0],
        },
        {
          sourceNumber: 2,
          ...matches[1],
        },
      ],
      relatedTerms: expectedRelatedTerms,
      metadata: {
        mode: "global",
        topK: 9,
        retrievalStrategy: "standard",
        candidateTopK: 9,
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
      },
      audit: {
        latencyMs: 432,
        embedding: embeddingUsage,
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
      status: "answered",
      errorCode: null,
      topK: 9,
      retrievalStrategy: "standard",
      candidateTopK: 9,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
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
        {
          sourceNumber: 1,
          ...matches[0],
          citedInAnswer: false,
        },
        {
          sourceNumber: 2,
          ...matches[1],
          citedInAnswer: true,
        },
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

  it("accepts the canonical insufficient-evidence answer from generation as an answered run when sources exist", async () => {
    const { service, runsRepository, generationUsage, matches } = createService({
      answer: buildNoEvidenceAnswer(),
    });
    const question = "Há evidências suficientes para concluir algo?";

    const result = await service.execute({
      question,
      mode: "global",
    });

    expect(result).toMatchObject({
      kind: "answered",
      status: "answered",
      traceId: CREATED_RUN_ID,
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      sources: [
        expect.objectContaining({ sourceNumber: 1 }),
        expect.objectContaining({ sourceNumber: 2 }),
      ],
    });
    expect(runsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "answered",
        errorCode: null,
        answer: buildNoEvidenceAnswer(),
        sources: [
          {
            sourceNumber: 1,
            ...matches[0],
            citedInAnswer: false,
          },
          {
            sourceNumber: 2,
            ...matches[1],
            citedInAnswer: false,
          },
        ],
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
      status: "generation_failed",
      errorCode: "generation_failed",
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
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
        {
          sourceNumber: 1,
          ...matches[0],
          citedInAnswer: false,
        },
        {
          sourceNumber: 2,
          ...matches[1],
          citedInAnswer: false,
        },
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
      status: "generation_unavailable",
      errorCode: "generation_unavailable",
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
      latencyMs: 432,
      embeddingInputTokens: embeddingUsage.inputTokens,
      embeddingCostUsd: embeddingUsage.estimatedCostUsd,
      generationInputTokens: null,
      generationOutputTokens: null,
      generationTotalTokens: null,
      generationCostUsd: null,
      totalCostUsd: embeddingUsage.estimatedCostUsd,
      sources: [
        {
          sourceNumber: 1,
          ...matches[0],
          citedInAnswer: false,
        },
        {
          sourceNumber: 2,
          ...matches[1],
          citedInAnswer: false,
        },
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
      status: "generation_unavailable",
      errorCode: "generation_unavailable",
      topK: 6,
      retrievalStrategy: "standard",
      candidateTopK: 6,
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
      embeddingModel: EMBEDDING_MODEL,
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
});
