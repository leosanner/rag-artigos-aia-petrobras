import { describe, expect, it, vi } from "vitest";

import { buildNoEvidenceAnswer } from "@/domain/rag";

import {
  OpenAiGenerationProvider,
  createOpenAiGenerationProviderFromEnv,
} from "./openai-generation-provider";

const GENERATION_MODEL = "gpt-4.1-mini";
const PROMPT_VERSION = "f04-global-rag-v1";

async function* streamChunks(chunks: string[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe("OpenAiGenerationProvider", () => {
  it("generates an answer with normalized usage and estimated cost", async () => {
    const model = { provider: "openai", modelId: GENERATION_MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const generateText = vi.fn().mockResolvedValue({
      text: "Resposta em português [1].",
      usage: {
        inputTokens: 100,
        outputTokens: 25,
        totalTokens: 125,
        inputTokenDetails: {
          cacheReadTokens: 20,
        },
      },
    });
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory,
      generateText,
    });

    await expect(
      provider.generateAnswer({
        question: "O que os documentos dizem?",
        promptContext: "[1] Título: artigo.pdf\nChunk: 0\nTrecho:\nTexto",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "standard",
      }),
    ).resolves.toEqual({
      answer: "Resposta em português [1].",
      usage: {
        inputTokens: 100,
        outputTokens: 25,
        totalTokens: 125,
        estimatedCostUsd: 0.000074,
      },
    });

    expect(modelFactory).toHaveBeenCalledWith(GENERATION_MODEL);
    expect(generateText).toHaveBeenCalledWith({
      model,
      system: expect.stringContaining("Responda sempre em português do Brasil."),
      prompt: expect.stringContaining("Pergunta:\nO que os documentos dizem?"),
    });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(PROMPT_VERSION),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("Use apenas o contexto numerado fornecido"),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("marcadores inline no formato [n]"),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(buildNoEvidenceAnswer()),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.not.stringContaining("2 a 4 perspectivas"),
      }),
    );
  });

  it("adds explore-mode instructions for cited perspectives only when requested", async () => {
    const model = { provider: "openai", modelId: GENERATION_MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const generateText = vi.fn().mockResolvedValue({
      text: "Perspectiva A [1]. Perspectiva B [2].",
      usage: {
        inputTokens: 88,
        outputTokens: 19,
        totalTokens: 107,
        inputTokenDetails: {
          cacheReadTokens: 0,
        },
      },
    });
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory,
      generateText,
    });

    await expect(
      provider.generateAnswer({
        question: "Quais perspectivas aparecem?",
        promptContext:
          "[1] Título: artigo-a.pdf\nChunk: 0\nTrecho:\nTexto A\n\n[2] Título: artigo-b.pdf\nChunk: 0\nTrecho:\nTexto B",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "explore",
      }),
    ).resolves.toEqual({
      answer: "Perspectiva A [1]. Perspectiva B [2].",
      usage: {
        inputTokens: 88,
        outputTokens: 19,
        totalTokens: 107,
        estimatedCostUsd: 0.0000656,
      },
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("2 a 4 perspectivas"),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("cite cada perspectiva"),
      }),
    );
  });

  it("treats rerank like the standard synthesis branch instead of adding explore instructions", async () => {
    const model = { provider: "openai", modelId: GENERATION_MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const generateText = vi.fn().mockResolvedValue({
      text: "Resposta reranqueada [1].",
      usage: {
        inputTokens: 92,
        outputTokens: 23,
        totalTokens: 115,
        inputTokenDetails: {
          cacheReadTokens: 0,
        },
      },
    });
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory,
      generateText,
    });

    await expect(
      provider.generateAnswer({
        question: "O que os documentos priorizam após reranqueamento?",
        promptContext: "[1] Título: artigo.pdf\nChunk: 0\nTrecho:\nTexto",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "rerank",
      }),
    ).resolves.toEqual({
      answer: "Resposta reranqueada [1].",
      usage: {
        inputTokens: 92,
        outputTokens: 23,
        totalTokens: 115,
        estimatedCostUsd: 0.0000736,
      },
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.not.stringContaining("2 a 4 perspectivas"),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.not.stringContaining("cite cada perspectiva"),
      }),
    );
  });

  it("includes the optional conversation transcript in the generation prompt without replacing the latest question", async () => {
    const model = { provider: "openai", modelId: GENERATION_MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const generateText = vi.fn().mockResolvedValue({
      text: "Resposta contextualizada [1].",
      usage: {
        inputTokens: 90,
        outputTokens: 21,
        totalTokens: 111,
        inputTokenDetails: {
          cacheReadTokens: 0,
        },
      },
    });
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory,
      generateText,
    });

    await expect(
      provider.generateAnswer({
        question: "Pergunta atual",
        conversationContext: {
          transcript: "User: Pergunta anterior\n\nAssistant: Resposta anterior [1].",
        },
        promptContext: "[1] Título: artigo.pdf\nChunk: 0\nTrecho:\nTexto",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "standard",
      }),
    ).resolves.toEqual({
      answer: "Resposta contextualizada [1].",
      usage: {
        inputTokens: 90,
        outputTokens: 21,
        totalTokens: 111,
        estimatedCostUsd: 0.0000696,
      },
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Historico da conversa:\nUser: Pergunta anterior"),
      }),
    );
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Pergunta atual:\nPergunta atual"),
      }),
    );
  });

  it("returns zeroed audit metrics for unknown or test generation models", async () => {
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: "test-rag-generation-model",
      modelFactory: vi.fn().mockReturnValue({}),
      generateText: vi.fn().mockResolvedValue({
        text: "Resposta [1].",
        usage: {
          inputTokens: 11,
          outputTokens: 7,
          totalTokens: 18,
          inputTokenDetails: {
            cacheReadTokens: 5,
          },
        },
      }),
    });

    await expect(
      provider.generateAnswer({
        question: "Pergunta",
        promptContext: "[1] Fonte",
        promptVersion: PROMPT_VERSION,
        generationModel: "test-rag-generation-model",
        retrievalStrategy: "standard",
      }),
    ).resolves.toEqual({
      answer: "Resposta [1].",
      usage: {
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18,
        estimatedCostUsd: 0,
      },
    });
  });

  it("streams text deltas, accumulates the final answer, and returns normalized usage", async () => {
    const model = { provider: "openai", modelId: GENERATION_MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const onTextDelta = vi.fn();
    const streamText = vi.fn().mockReturnValue({
      textStream: streamChunks(["Resposta", " em", " stream", " [1]."]),
      text: Promise.resolve("Resposta em stream [1]."),
      usage: Promise.resolve({
        inputTokens: 91,
        outputTokens: 18,
        totalTokens: 109,
        inputTokenDetails: {
          cacheReadTokens: 9,
        },
      }),
    });
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory,
      streamText,
    });

    await expect(
      provider.streamAnswer({
        question: "O que os documentos dizem?",
        promptContext: "[1] Título: artigo.pdf\nChunk: 0\nTrecho:\nTexto",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "standard",
        onTextDelta,
      }),
    ).resolves.toEqual({
      answer: "Resposta em stream [1].",
      usage: {
        inputTokens: 91,
        outputTokens: 18,
        totalTokens: 109,
        estimatedCostUsd: 0.0000625,
      },
    });

    expect(onTextDelta).toHaveBeenCalledTimes(4);
    expect(onTextDelta).toHaveBeenNthCalledWith(1, "Resposta");
    expect(streamText).toHaveBeenCalledWith({
      model,
      system: expect.stringContaining("Responda sempre em português do Brasil."),
      prompt: expect.stringContaining("Pergunta:\nO que os documentos dizem?"),
    });
  });

  it("streams rerank answers through the standard branch without explore instructions", async () => {
    const model = { provider: "openai", modelId: GENERATION_MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const streamText = vi.fn().mockReturnValue({
      textStream: streamChunks(["Resposta", " reranqueada", " [1]."]),
      text: Promise.resolve("Resposta reranqueada [1]."),
      usage: Promise.resolve({
        inputTokens: 88,
        outputTokens: 17,
        totalTokens: 105,
        inputTokenDetails: {
          cacheReadTokens: 0,
        },
      }),
    });
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory,
      streamText,
    });

    await expect(
      provider.streamAnswer({
        question: "O que os documentos priorizam após reranqueamento?",
        promptContext: "[1] Título: artigo.pdf\nChunk: 0\nTrecho:\nTexto",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "rerank",
      }),
    ).resolves.toEqual({
      answer: "Resposta reranqueada [1].",
      usage: {
        inputTokens: 88,
        outputTokens: 17,
        totalTokens: 105,
        estimatedCostUsd: 0.0000624,
      },
    });

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.not.stringContaining("2 a 4 perspectivas"),
      }),
    );
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.not.stringContaining("cite cada perspectiva"),
      }),
    );
  });

  it("rejects an empty streamed answer with a sanitized generation_failed error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory: vi.fn().mockReturnValue({}),
      streamText: vi.fn().mockReturnValue({
        textStream: streamChunks(["   ", "\n"]),
        text: Promise.resolve("   "),
        usage: Promise.resolve({
          inputTokens: 10,
          outputTokens: 1,
          totalTokens: 11,
        }),
      }),
    });

    await expect(
      provider.streamAnswer({
        question: "Pergunta",
        promptContext: "[1] Fonte",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "standard",
      }),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message: "generation_failed",
    });

    errorSpy.mockRestore();
  });

  it("maps transient provider failures during streaming to generation_unavailable", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory: vi.fn().mockReturnValue({}),
      streamText: vi.fn(() => {
        throw {
          statusCode: 503,
          message: "temporarily unavailable",
        };
      }),
    });

    await expect(
      provider.streamAnswer({
        question: "Pergunta",
        promptContext: "[1] Fonte",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "standard",
      }),
    ).rejects.toMatchObject({
      code: "generation_unavailable",
      message: "generation_unavailable",
    });

    errorSpy.mockRestore();
  });

  it("maps transient provider failures to a sanitized generation_unavailable error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory: vi.fn().mockReturnValue({}),
      generateText: vi.fn().mockRejectedValue({
        statusCode: 429,
        message: "rate limit: OPENAI_API_KEY=sk-secret",
      }),
    });

    await expect(
      provider.generateAnswer({
        question: "Pergunta",
        promptContext: "[1] Fonte",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "standard",
      }),
    ).rejects.toMatchObject({
      code: "generation_unavailable",
      message: "generation_unavailable",
    });

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("maps generic raw provider failures to sanitized generation_failed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = new OpenAiGenerationProvider({
      defaultGenerationModel: GENERATION_MODEL,
      modelFactory: vi.fn().mockReturnValue({}),
      generateText: vi
        .fn()
        .mockRejectedValue(new Error("OPENAI_API_KEY=sk-secret DATABASE_URL=db")),
    });

    await expect(
      provider.generateAnswer({
        question: "Pergunta",
        promptContext: "[1] Fonte",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "standard",
      }),
    ).rejects.toMatchObject({
      code: "generation_failed",
      message: "generation_failed",
    });

    const payload = JSON.parse(errorSpy.mock.calls[0]![0] as string) as Record<
      string,
      unknown
    >;
    expect(payload.event).toBe("ai.generation_provider_failed");
    expect(payload.model).toBe(GENERATION_MODEL);
    errorSpy.mockRestore();
  });

  it("creates the provider from validated env with explicit api-key wiring", async () => {
    const chatModel = { provider: "openai", modelId: GENERATION_MODEL };
    const chat = vi.fn().mockReturnValue(chatModel);
    const createProvider = vi.fn().mockReturnValue({
      chat,
    });
    const generateText = vi.fn().mockResolvedValue({
      text: "Resposta em português [1].",
      usage: {
        inputTokens: 44,
        outputTokens: 9,
        totalTokens: 53,
        inputTokenDetails: {
          cacheReadTokens: 4,
        },
      },
    });
    const provider = createOpenAiGenerationProviderFromEnv(
      {
        OPENAI_API_KEY: "test-openai-api-key",
        RAG_GENERATION_MODEL: GENERATION_MODEL,
      },
      {
        createProvider,
        generateText,
      },
    );

    await expect(
      provider.generateAnswer({
        question: "Pergunta",
        promptContext: "[1] Fonte",
        promptVersion: PROMPT_VERSION,
        generationModel: GENERATION_MODEL,
        retrievalStrategy: "standard",
      }),
    ).resolves.toEqual({
      answer: "Resposta em português [1].",
      usage: {
        inputTokens: 44,
        outputTokens: 9,
        totalTokens: 53,
        estimatedCostUsd: 0.0000308,
      },
    });

    expect(createProvider).toHaveBeenCalledWith({
      apiKey: "test-openai-api-key",
    });
    expect(chat).toHaveBeenCalledWith(GENERATION_MODEL);
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: chatModel,
      }),
    );
  });
});
