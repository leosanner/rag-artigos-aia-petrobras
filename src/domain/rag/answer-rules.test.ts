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
      "Não encontrei evidências suficientes nos documentos recuperados para responder com segurança.",
    );
  });
});

describe("isNoEvidenceAnswer", () => {
  it("matches the canonical insufficient-evidence answer", () => {
    expect(isNoEvidenceAnswer(buildNoEvidenceAnswer())).toBe(true);
  });

  it("matches equivalent variants after normalizing case, accents, spacing, and ending punctuation", () => {
    const variants = [
      "nao encontrei evidencias suficientes nos documentos recuperados para responder com seguranca",
      "  NÃO ENCONTREI EVIDÊNCIAS SUFICIENTES NOS DOCUMENTOS RECUPERADOS PARA RESPONDER COM SEGURANÇA! ",
      "Não   encontrei evidências suficientes nos documentos recuperados para responder com segurança???",
    ];

    expect(variants.map(isNoEvidenceAnswer)).toEqual([true, true, true]);
  });

  it("rejects nearby but non-canonical wording", () => {
    const negatives = [
      "Não encontrei evidências suficientes para responder com segurança.",
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
