import { describe, expect, it, vi } from "vitest";

import {
  OpenAiGenerationProvider,
  createOpenAiGenerationProviderFromEnv,
} from "./openai-generation-provider";

const GENERATION_MODEL = "gpt-4.1-mini";
const PROMPT_VERSION = "f03-global-rag-v1";

describe("OpenAiGenerationProvider", () => {
  it("generates an answer through the configured OpenAI model with the expected grounded prompt", async () => {
    const model = { provider: "openai", modelId: GENERATION_MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const generateText = vi.fn().mockResolvedValue({
      text: "Resposta em português [1].",
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
      }),
    ).resolves.toEqual({
      answer: "Resposta em português [1].",
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
      }),
    ).resolves.toEqual({
      answer: expect.any(String),
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
