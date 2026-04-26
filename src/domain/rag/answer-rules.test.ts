import { describe, expect, it } from "vitest";

import {
  GENERATION_FAILURE_CODES,
  GenerationFailure,
  buildNoEvidenceAnswer,
  isNoEvidenceAnswer,
  toSafeGenerationFailureCode,
} from "./answer-rules";

describe("buildNoEvidenceAnswer", () => {
  it("returns the exact formal Portuguese insufficient-evidence answer", () => {
    expect(buildNoEvidenceAnswer()).toBe(
      "Não encontrei nada relacionado a essa pergunta na base de dados.",
    );
  });
});

describe("isNoEvidenceAnswer", () => {
  it("matches the canonical insufficient-evidence answer", () => {
    expect(isNoEvidenceAnswer(buildNoEvidenceAnswer())).toBe(true);
  });

  it("matches equivalent variants after normalizing case, accents, spacing, and ending punctuation", () => {
    const variants = [
      "nao encontrei nada relacionado a essa pergunta na base de dados",
      "  NÃO ENCONTREI NADA RELACIONADO A ESSA PERGUNTA NA BASE DE DADOS! ",
      "Não   encontrei nada relacionado a essa pergunta na base de dados???",
    ];

    expect(variants.map(isNoEvidenceAnswer)).toEqual([true, true, true]);
  });

  it("matches approved legacy no-evidence wording so older prompt outputs do not become errors", () => {
    const variants = [
      "Não encontrei nada relacionado a essa pergunta na base.",
      "Não encontrei nada relacionado a essa pergunta na base de dados consultada.",
      "Não encontrei evidências suficientes nos documentos recuperados para responder com segurança.",
    ];

    expect(variants.map(isNoEvidenceAnswer)).toEqual([true, true, true]);
  });

  it("rejects nearby but non-canonical wording", () => {
    const negatives = [
      "Não encontrei nada relacionado a essa pergunta.",
      "Resposta sem citação.",
    ];

    expect(negatives.map(isNoEvidenceAnswer)).toEqual([false, false]);
  });
});

describe("GENERATION_FAILURE_CODES", () => {
  it("defines the closed safe generation failure catalog", () => {
    expect(GENERATION_FAILURE_CODES).toEqual([
      "generation_failed",
      "generation_unavailable",
    ]);
  });

  it("is frozen so the runtime catalog cannot be widened by mutation", () => {
    expect(Object.isFrozen(GENERATION_FAILURE_CODES)).toBe(true);
  });
});

describe("GenerationFailure", () => {
  it("preserves explicitly typed safe codes", () => {
    const error = new GenerationFailure(
      "generation_unavailable",
      "Provider timed out",
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GenerationFailure");
    expect(error.code).toBe("generation_unavailable");
    expect(toSafeGenerationFailureCode(error)).toBe("generation_unavailable");
  });
});

describe("toSafeGenerationFailureCode", () => {
  it("returns generation_failed for arbitrary inputs and never leaks messages", () => {
    const inputs: unknown[] = [
      new Error("OPENAI_API_KEY=sk-secret DATABASE_URL=postgres://secret"),
      { code: "generation_unavailable" },
      "generation_unavailable",
      null,
      undefined,
      42,
    ];

    expect(inputs.map(toSafeGenerationFailureCode)).toEqual([
      "generation_failed",
      "generation_failed",
      "generation_failed",
      "generation_failed",
      "generation_failed",
      "generation_failed",
    ]);
  });
});
