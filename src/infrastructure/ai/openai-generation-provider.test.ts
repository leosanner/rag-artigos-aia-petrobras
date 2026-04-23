import { describe, expect, it, vi } from "vitest";

import {
  OpenAiGenerationProvider,
  createOpenAiGenerationProviderFromEnv,
} from "./openai-generation-provider";

const GENERATION_MODEL = "gpt-4.1-mini";
const PROMPT_VERSION = "f04-global-rag-v1";

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
        system: expect.stringContaining(
          "não encontrou evidências suficientes",
        ),
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

  it("maps transient provider failures to a sanitized generation_unavailable error", async () => {
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
  });

  it("maps generic raw provider failures to sanitized generation_failed", async () => {
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
