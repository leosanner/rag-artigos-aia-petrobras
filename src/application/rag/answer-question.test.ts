import { describe, expect, it, vi } from "vitest";

import { buildNoEvidenceAnswer, type RetrievedChunkMatch } from "@/domain/rag";

import { AnswerQuestion } from "./answer-question";

const GENERATION_MODEL = "gpt-4.1-mini";
const EMBEDDING_MODEL = "text-embedding-3-large";
const PROMPT_VERSION = "f03-global-rag-v1";

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

function createService(overrides: {
  matches?: RetrievedChunkMatch[];
  answer?: string;
  generationError?: unknown;
} = {}) {
  const retrieveChunks = {
    topK: 6,
    embeddingModel: EMBEDDING_MODEL,
    search: vi
      .fn()
      .mockResolvedValue(overrides.matches ?? [buildMatch(), buildMatch({
        chunkId: "33333333-3333-4333-8333-333333333333",
        chunkIndex: 1,
        excerpt: "Second chunk excerpt",
        score: 0.82,
      })]),
  };
  const generationProvider = {
    generateAnswer:
      overrides.generationError === undefined
        ? vi
            .fn()
            .mockResolvedValue({ answer: overrides.answer ?? "Resposta [1] [2]." })
        : vi.fn().mockRejectedValue(overrides.generationError),
  };

  const service = new AnswerQuestion({
    retrieveChunks,
    generationProvider,
    generationModel: GENERATION_MODEL,
    promptVersion: PROMPT_VERSION,
  });

  return {
    service,
    retrieveChunks,
    generationProvider,
  };
}

describe("AnswerQuestion", () => {
  it("rejects unsupported modes before retrieval", async () => {
    const { service, retrieveChunks, generationProvider } = createService();

    await expect(
      service.execute({
        question: "Pergunta",
        mode: "focused" as never,
      }),
    ).rejects.toThrow(/unsupported/i);

    expect(retrieveChunks.search).not.toHaveBeenCalled();
    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
  });

  it("short-circuits with the Portuguese no-evidence answer when no chunks are retrieved", async () => {
    const { service, retrieveChunks, generationProvider } = createService({
      matches: [],
    });

    await expect(
      service.execute({
        question: "O que os artigos dizem sobre isso?",
        mode: "global",
      }),
    ).resolves.toEqual({
      kind: "answered",
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      sources: [],
      metadata: {
        mode: "global",
        topK: 6,
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
      },
    });

    expect(retrieveChunks.search).toHaveBeenCalledWith(
      "O que os artigos dizem sobre isso?",
    );
    expect(generationProvider.generateAnswer).not.toHaveBeenCalled();
  });

  it("returns numbered sources, stable metadata, and forwards the prompt inputs to generation", async () => {
    const { service, generationProvider } = createService();

    const result = await service.execute({
      question: "Quais abordagens aparecem com mais frequência?",
      mode: "global",
    });

    expect(result).toMatchObject({
      kind: "answered",
      answer: "Resposta [1] [2].",
      mode: "global",
      metadata: {
        mode: "global",
        topK: 6,
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        embeddingModel: EMBEDDING_MODEL,
      },
    });
    expect(result.kind).toBe("answered");
    if (result.kind === "answered") {
      expect(result.sources.map((source) => source.sourceNumber)).toEqual([1, 2]);
    }
    expect(generationProvider.generateAnswer).toHaveBeenCalledWith({
      question: "Quais abordagens aparecem com mais frequência?",
      promptContext: expect.stringContaining("[1] Título: article.pdf"),
      promptVersion: PROMPT_VERSION,
      generationModel: GENERATION_MODEL,
    });
  });

  it("accepts the canonical insufficient-evidence answer from generation even when sources exist", async () => {
    const { service } = createService({
      answer: buildNoEvidenceAnswer(),
    });

    const result = await service.execute({
      question: "Há evidências suficientes para concluir algo?",
      mode: "global",
    });

    expect(result).toMatchObject({
      kind: "answered",
      answer: buildNoEvidenceAnswer(),
      mode: "global",
      sources: expect.arrayContaining([
        expect.objectContaining({ sourceNumber: 1 }),
      ]),
    });
  });

  it.each([
    "Resposta sem citação.",
    "Resposta com marcador inválido [abc].",
    "Resposta com fonte inexistente [3].",
  ])(
    "maps invalid citation output to generation_failed: %s",
    async (answer) => {
      const { service } = createService({ answer });

      await expect(
        service.execute({
          question: "Pergunta",
          mode: "global",
        }),
      ).resolves.toEqual({
        kind: "error",
        error: "generation_failed",
      });
    },
  );

  it("maps transient generation failures to generation_unavailable", async () => {
    const { service } = createService({
      generationError: {
        statusCode: 503,
        message: "provider unavailable",
      },
    });

    await expect(
      service.execute({
        question: "Pergunta",
        mode: "global",
      }),
    ).resolves.toEqual({
      kind: "error",
      error: "generation_unavailable",
    });
  });
});
